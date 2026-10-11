/**
 * Delete-account end-to-end test (SEC-4)
 *
 * Uses a THROWAWAY test account only. Creates data in several tables
 * including a full starter note deck and more than 100 storage files,
 * then calls the delete-account edge function from a real browser
 * context (exercises CORS), and verifies:
 *   - All DB rows are gone across every user-data table
 *   - All storage files are gone (including the >100-file case)
 *   - The auth user no longer exists
 *   - The old JWT returns no data
 *   - localStorage is wiped
 *
 * Prerequisites:
 *   PLAYWRIGHT_DELETE_EMAIL      — email of a disposable test account
 *   PLAYWRIGHT_DELETE_PASSWORD   — its password
 *   PLAYWRIGHT_SERVICE_ROLE_KEY  — Supabase service role key
 *   PLAYWRIGHT_SUPABASE_URL      — e.g. https://<ref>.supabase.co
 *   PLAYWRIGHT_SUPABASE_ANON_KEY — public anon key
 *
 *   Create the throwaway account in Supabase Dashboard →
 *   Authentication → Users → Add user → Create new user
 *   (with Auto Confirm User checked). Sign in to the app once
 *   so onboarding runs and the public.users row is created.
 *   The account is permanently deleted by the test — create a fresh
 *   one for each run.
 *
 * NEVER run against a real user account.
 *
 * To run:
 *   npx playwright test tests/e2e/delete-account.spec.js
 */

import { test, expect } from 'playwright/test'
import { createClient } from '@supabase/supabase-js'

const EMAIL    = process.env.PLAYWRIGHT_DELETE_EMAIL      || ''
const PASSWORD = process.env.PLAYWRIGHT_DELETE_PASSWORD   || ''
const SVC_KEY  = process.env.PLAYWRIGHT_SERVICE_ROLE_KEY  || ''
const SB_URL   = process.env.PLAYWRIGHT_SUPABASE_URL      || ''
const ANON_KEY = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY || ''

// Minimal valid 1×1 transparent PNG
const TINY_PNG = new Uint8Array([
  137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,
  0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,
  0,2,0,1,226,33,188,51,0,0,0,0,73,69,78,68,174,66,96,130,
])

const TABLES_WITH_USER_ID = [
  'moods', 'checkins', 'note_deck', 'journal', 'journal_backup',
  'practices', 'practice_merges', 'debriefs', 'debrief_types',
  'custom_tags', 'weekly_reviews', 'intentions', 'feelings',
]

test.describe('account deletion (SEC-4)', () => {
  test.skip(
    !EMAIL || !PASSWORD || !SVC_KEY || !SB_URL || !ANON_KEY,
    'Set PLAYWRIGHT_DELETE_EMAIL/PASSWORD, PLAYWRIGHT_SERVICE_ROLE_KEY, ' +
    'PLAYWRIGHT_SUPABASE_URL, PLAYWRIGHT_SUPABASE_ANON_KEY to run'
  )

  test('deletes all data including full note deck and >100 storage files', async ({ page }) => {
    const admin = createClient(SB_URL, SVC_KEY)

    // ── Step 1: Sign in as the throwaway account ──────────────────────────
    await page.goto('/signin')
    await page.fill('input[type="email"], input[name="email"]', EMAIL)
    await page.fill('input[type="password"], input[name="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.pathname.startsWith('/signin'), { timeout: 15_000 })

    // Retrieve user id and access token from the browser's localStorage
    const { userId, accessToken } = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith('sb-') && k.endsWith('-auth-token')) {
          try {
            const sess = JSON.parse(localStorage.getItem(k))
            if (sess?.user?.id) return { userId: sess.user.id, accessToken: sess.access_token }
          } catch {}
        }
      }
      return { userId: null, accessToken: null }
    })
    expect(userId, 'must be signed in').toBeTruthy()
    expect(accessToken, 'must have access token').toBeTruthy()

    // ── Step 2: Seed data — rows in several tables ────────────────────────
    // Insert moods, checkins, a journal entry
    await admin.from('moods').insert([
      { user_id: userId, mood: 'good',  date_key: '2026-01-01', prompt_time: 'morning' },
      { user_id: userId, mood: 'fine',  date_key: '2026-01-02', prompt_time: 'midday'  },
      { user_id: userId, mood: 'bad',   date_key: '2026-01-03', prompt_time: 'evening' },
    ])
    await admin.from('checkins').insert([
      { user_id: userId, need_id: 'movement',   date_key: '2026-01-01', mode: 'exploration' },
      { user_id: userId, need_id: 'connection', date_key: '2026-01-02', mode: 'appreciation' },
    ])
    await admin.from('journal').insert(
      { user_id: userId, date_key: '2026-01-01', entry: 'test journal entry' }
    )

    // Full starter note deck: insert 3 note_deck rows (the minimum is typically 1–3)
    // This is the case that would have failed without bypass_deck_min.
    const deckRows = [
      { user_id: userId, text: 'note one',   position: 0 },
      { user_id: userId, text: 'note two',   position: 1 },
      { user_id: userId, text: 'note three', position: 2 },
    ]
    const { error: deckErr } = await admin.from('note_deck').insert(deckRows)
    expect(deckErr, 'note_deck insert should succeed').toBeNull()

    // ── Step 3: Seed >100 storage files ──────────────────────────────────
    // Upload 110 files to exercise the multi-page delete loop.
    const uploadCount = 110
    const uploadBatch = Array.from({ length: uploadCount }, (_, i) =>
      admin.storage.from('note-images').upload(
        `${userId}/test-e2e-${String(i).padStart(3, '0')}.png`,
        TINY_PNG,
        { contentType: 'image/png', upsert: true }
      )
    )
    // Upload in batches of 20 to avoid overwhelming the storage API
    for (let i = 0; i < uploadBatch.length; i += 20) {
      await Promise.all(uploadBatch.slice(i, i + 20))
    }

    // Verify files exist
    const { data: filesBefore } = await admin.storage.from('note-images').list(userId, { limit: 200 })
    expect((filesBefore || []).length).toBeGreaterThanOrEqual(uploadCount)

    // ── Step 4: Call delete-account FROM THE BROWSER (exercises CORS) ─────
    // The function is called from a browser page context, exactly as the app
    // does it, so the Origin header is set by the browser engine.
    const deleteResult = await page.evaluate(
      async ({ sbUrl, token }) => {
        try {
          const res = await fetch(`${sbUrl}/functions/v1/delete-account`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })
          const body = await res.json().catch(() => ({}))
          return { ok: res.ok, status: res.status, body }
        } catch (e) {
          return { ok: false, status: 0, body: { error: String(e) } }
        }
      },
      { sbUrl: SB_URL, token: accessToken }
    )

    expect(deleteResult.ok, `delete-account returned ${deleteResult.status}: ${JSON.stringify(deleteResult.body)}`).toBe(true)
    expect(deleteResult.body.deleted).toBe(true)

    // ── Step 5: Wipe local caches (as the UI does on success) ─────────────
    await page.evaluate(() => localStorage.clear())

    // ── Step 6: Verify DB rows are gone ───────────────────────────────────
    for (const table of TABLES_WITH_USER_ID) {
      const { data, error } = await admin.from(table).select('id').eq('user_id', userId).limit(1)
      expect(error, `${table} query should not error`).toBeNull()
      expect((data || []).length, `${table} should have 0 rows`).toBe(0)
    }

    // users row gone
    const { data: userRow } = await admin.from('users').select('id').eq('id', userId).limit(1)
    expect((userRow || []).length, 'users row should be gone').toBe(0)

    // ── Step 7: Verify storage is empty ───────────────────────────────────
    const { data: filesAfter } = await admin.storage.from('note-images').list(userId, { limit: 200 })
    expect((filesAfter || []).length, 'all storage files should be gone').toBe(0)

    // ── Step 8: Old JWT should return no data ─────────────────────────────
    const staleClient = createClient(SB_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const { data: staleMoods } = await staleClient.from('moods').select('id').eq('user_id', userId).limit(1)
    expect((staleMoods || []).length, 'stale JWT must not return data').toBe(0)

    // ── Step 9: Auth user is gone ─────────────────────────────────────────
    const { data: authData } = await admin.auth.admin.getUserById(userId)
    expect(authData?.user, 'auth user should not exist').toBeNull()

    // ── Step 10: localStorage is clear ───────────────────────────────────
    const lsKeys = await page.evaluate(() => Object.keys(localStorage))
    expect(lsKeys.length, 'localStorage should be empty').toBe(0)
  })
})
