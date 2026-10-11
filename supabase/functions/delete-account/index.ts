import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.3'

// Origins the Capacitor iOS app and the web app send requests from.
// Capacitor wraps the web view at capacitor://localhost on iOS.
const ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'https://localhost',
  'https://app.mymaslow.com',
  'https://app.loamdaybook.com',
  'https://loamdaybook.com',
  'http://localhost:5173',
])

const CORS_HEADERS = (origin: string | null) => ({
  'Access-Control-Allow-Origin': (origin && ALLOWED_ORIGINS.has(origin)) ? origin : 'null',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
})

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  const requestId = crypto.randomUUID()
  return new Response(JSON.stringify({ ...body as object, requestId }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS(origin),
    },
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS(origin) })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin)
  }

  // ── Auth: extract and verify the caller's JWT ─────────────────────────────
  // config.toml verify_jwt = true means the gateway already validated the
  // token's signature. We call auth.getUser() to confirm it is still live and
  // to obtain the user id from Supabase's auth table — never from the request.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing authorization' }, 401, origin)
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401, origin)
  }
  const userId = user.id

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── Step 1: delete storage files ─────────────────────────────────────────
  // List from offset 0 each iteration (never increment offset after removal;
  // removing items shifts subsequent offsets). Cap at 50 pages to avoid an
  // infinite loop on a pathological bucket.
  const MAX_PAGES = 50
  const PAGE_SIZE = 100
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data: files, error: listErr } = await admin.storage
      .from('note-images')
      .list(userId, { limit: PAGE_SIZE, offset: 0 })

    if (listErr) {
      console.error(`delete-account storage list failed uid=${userId}:`, listErr.message)
      return jsonResponse({ error: 'Failed to list storage files. Please try again.' }, 500, origin)
    }
    if (!files || files.length === 0) break

    const paths = files.map(f => `${userId}/${f.name}`)
    const { error: removeErr } = await admin.storage.from('note-images').remove(paths)
    if (removeErr) {
      console.error(`delete-account storage remove failed uid=${userId}:`, removeErr.message)
      return jsonResponse({ error: 'Failed to delete storage files. Please try again.' }, 500, origin)
    }

    if (page === MAX_PAGES - 1) {
      // Still files remaining after cap — report rather than silently succeed.
      console.error(`delete-account storage cap hit uid=${userId}: files may remain`)
      return jsonResponse({ error: 'Too many storage files to delete in one request. Please try again.' }, 500, origin)
    }
  }

  // ── Step 2: purge all DB rows in one transaction ──────────────────────────
  // purge_user_data is a SECURITY DEFINER function that sets bypass_deck_min,
  // deletes all user rows in FK-safe order, and is executable only by service_role.
  const { error: purgeErr } = await admin.rpc('purge_user_data', { p_user_id: userId })
  if (purgeErr) {
    console.error(`delete-account purge_user_data failed uid=${userId}:`, purgeErr.message)
    return jsonResponse({ error: 'Failed to delete account data. Please try again.' }, 500, origin)
  }

  // ── Step 3: delete the auth user ─────────────────────────────────────────
  // Point of no return — data is already gone. If this fails the account is
  // functionally empty; the user can retry and deleteUser is idempotent
  // (returns 404 for an already-deleted user, which we swallow).
  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr && !authErr.message.includes('User not found')) {
    console.error(`delete-account deleteUser failed uid=${userId}:`, authErr.message)
    return jsonResponse({ error: 'Account data deleted but sign-in removal failed. Contact support.' }, 500, origin)
  }

  return jsonResponse({ deleted: true }, 200, origin)
})
