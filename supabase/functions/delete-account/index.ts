import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Tables that hold rows scoped to a user_id, deleted in dependency order.
// note_deck has a minimum-count trigger; we bypass it via a session setting.
const USER_TABLES = [
  'debriefs',
  'debrief_types',
  'custom_tags',
  'moods',
  'checkins',
  'journal',
  'journal_backup',
  'practice_merges',
  'practices',
  'weekly_reviews',
  'intentions',
  'feelings',
  'note_deck',
]

Deno.serve(async (req) => {
  // config.toml has verify_jwt = true; Supabase validates the JWT before we
  // get here. We extract the caller's sub to scope all deletes to that user.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing authorization' }, 401)
  }

  // Use anon key + the caller's JWT to get the session user — never trust a
  // user_id from the request body.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const userId = user.id

  // Service-role client for privileged deletes.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const errors: string[] = []

  // ── Step 1: delete user-data rows ────────────────────────────────────────
  // Bypass the note_deck minimum-count trigger for this session.
  await admin.rpc('set_config', { setting: 'app.bypass_deck_min', value: 'true', is_local: true }).catch(() => {})

  for (const table of USER_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', userId)
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = relation does not exist — table may not be present in all envs
      errors.push(`${table}: ${error.message}`)
    }
  }

  // users row itself (no user_id FK — keyed on id)
  const { error: usersErr } = await admin.from('users').delete().eq('id', userId)
  if (usersErr) errors.push(`users: ${usersErr.message}`)

  // ── Step 2: delete storage files ─────────────────────────────────────────
  const prefix = `${userId}/`
  let storageErrors = 0
  let nextOffset = 0
  const pageSize = 100
  while (true) {
    const { data: files, error: listErr } = await admin.storage
      .from('note-images')
      .list(userId, { limit: pageSize, offset: nextOffset })

    if (listErr) { errors.push(`storage list: ${listErr.message}`); break }
    if (!files || files.length === 0) break

    const paths = files.map(f => `${prefix}${f.name}`)
    const { error: removeErr } = await admin.storage.from('note-images').remove(paths)
    if (removeErr) { storageErrors++; errors.push(`storage remove: ${removeErr.message}`) }

    if (files.length < pageSize) break
    nextOffset += pageSize
  }

  if (errors.length > 0) {
    // Surface errors so the UI can retry — don't silently succeed.
    console.error(`delete-account partial failure for user ${userId}:`, errors)
    return json({ error: 'Some data could not be deleted. Please try again or contact support.', details: errors }, 500)
  }

  // ── Step 3: delete the auth user (point of no return) ────────────────────
  const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(userId)
  if (deleteAuthErr) {
    // If auth deletion fails after data is already gone, the account is
    // functionally empty but the auth row remains. Log user id (not email).
    console.error(`delete-account: auth.admin.deleteUser failed for ${userId}:`, deleteAuthErr.message)
    return json({ error: 'Account data was deleted but auth removal failed. Contact support.' }, 500)
  }

  return json({ deleted: true }, 200)
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
