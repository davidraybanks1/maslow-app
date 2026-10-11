/**
 * Delete-account end-to-end test (SEC-4)
 *
 * Uses a THROWAWAY test account only. Creates data in several tables
 * and an image upload, deletes the account, then verifies:
 *   - The deleted user's old JWT no longer fetches rows from any table
 *   - The user's storage files are gone
 *   - The auth user no longer exists
 *
 * Prerequisites:
 *   PLAYWRIGHT_DELETE_EMAIL    — email of a disposable test account
 *   PLAYWRIGHT_DELETE_PASSWORD — its password
 *   PLAYWRIGHT_SERVICE_ROLE_KEY — Supabase service role key (for verification queries)
 *   PLAYWRIGHT_SUPABASE_URL    — project URL
 *
 * NEVER run this against a real user account. The test permanently deletes
 * the account and all its data.
 *
 * To run:
 *   npx playwright test tests/e2e/delete-account.spec.js
 */

import { test, expect } from 'playwright/test'
import { createClient } from '@supabase/supabase-js'

const EMAIL    = process.env.PLAYWRIGHT_DELETE_EMAIL    || ''
const PASSWORD = process.env.PLAYWRIGHT_DELETE_PASSWORD || ''
const SVC_KEY  = process.env.PLAYWRIGHT_SERVICE_ROLE_KEY || ''
const SB_URL   = process.env.PLAYWRIGHT_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''

const TABLES_WITH_USER_ID = [
  'moods', 'checkins', 'note_deck', 'journal',
  'practices', 'debriefs', 'debrief_types', 'custom_tags',
]

test.describe('account deletion (SEC-4)', () => {
  test.skip(
    !EMAIL || !PASSWORD || !SVC_KEY || !SB_URL,
    'Set PLAYWRIGHT_DELETE_EMAIL/PASSWORD, PLAYWRIGHT_SERVICE_ROLE_KEY, PLAYWRIGHT_SUPABASE_URL to run'
  )

  test('deletes all user data and the auth user', async ({ page }) => {
    const admin = createClient(SB_URL, SVC_KEY)

    // ── Step 1: Sign in as the throwaway account ──────────────────────────
    await page.goto('/signin')
    await page.fill('input[type="email"], input[name="email"]', EMAIL)
    await page.fill('input[type="password"], input[name="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.pathname.startsWith('/signin'), { timeout: 15_000 })

    // Get the user id and access token from localStorage
    const { userId, accessToken } = await page.evaluate(() => {
      let userId = null, accessToken = null
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith('sb-') && k.endsWith('-auth-token')) {
          try {
            const sess = JSON.parse(localStorage.getItem(k))
            userId = sess?.user?.id
            accessToken = sess?.access_token
          } catch {}
        }
      }
      return { userId, accessToken }
    })
    expect(userId).toBeTruthy()
    expect(accessToken).toBeTruthy()

    // ── Step 2: Seed some data via the API so we have rows to verify ──────
    const userClient = createClient(SB_URL, process.env.VITE_SUPABASE_ANON_KEY || '', {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    await userClient.from('moods').insert({ user_id: userId, mood: 'good', date_key: '2026-01-01', prompt_time: 'morning' })
    await userClient.from('checkins').insert({ user_id: userId, need_id: 'movement', date_key: '2026-01-01', mode: 'exploration' })

    // Upload a test image (1x1 transparent PNG)
    const PNG = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,0,2,0,1,226,33,188,51,0,0,0,0,73,69,78,68,174,66,96,130])
    const storagePath = `${userId}/test-e2e.png`
    await admin.storage.from('note-images').upload(storagePath, PNG, { contentType: 'image/png', upsert: true })

    // Verify data exists before deletion
    const { data: moodsBefore } = await admin.from('moods').select('id').eq('user_id', userId)
    expect((moodsBefore || []).length).toBeGreaterThan(0)

    // ── Step 3: Navigate to profile and delete the account ────────────────
    // Open profile menu
    const profileBtn = page.locator('[aria-label*="profile"], [aria-label="Account menu"]').first()
    await profileBtn.click()
    await page.waitForTimeout(300)

    // Click "delete account" link
    const deleteLink = page.locator('button:has-text("delete account")').first()
    await expect(deleteLink).toBeVisible({ timeout: 5_000 })
    await deleteLink.click()

    // Dialog should appear
    await expect(page.locator('[aria-label="delete account"]')).toBeVisible({ timeout: 3_000 })

    // The confirm button should be disabled before typing
    const confirmBtn = page.locator('button:has-text("delete my account")').first()
    await expect(confirmBtn).toBeDisabled()

    // Type the confirmation word
    await page.fill('.deleteConfirmInput, input[placeholder="DELETE"]', 'DELETE')
    await expect(confirmBtn).toBeEnabled()

    // Submit
    await confirmBtn.click()

    // Should navigate to /signin after deletion
    await page.waitForURL('/signin', { timeout: 20_000 })

    // ── Step 4: Verify everything is gone ─────────────────────────────────

    // All user-data tables should have no rows for this userId
    for (const table of TABLES_WITH_USER_ID) {
      const { data, error } = await admin.from(table).select('id').eq('user_id', userId)
      expect(error, `${table} query should not error`).toBeNull()
      expect((data || []).length, `${table} should have 0 rows after deletion`).toBe(0)
    }

    // users table row should be gone
    const { data: userRow } = await admin.from('users').select('id').eq('id', userId)
    expect((userRow || []).length).toBe(0)

    // Storage file should be gone
    const { data: files } = await admin.storage.from('note-images').list(userId)
    const testFile = (files || []).find(f => f.name === 'test-e2e.png')
    expect(testFile).toBeUndefined()

    // The old access token should not be able to fetch the user's own data
    const staleClient = createClient(SB_URL, process.env.VITE_SUPABASE_ANON_KEY || '', {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const { data: staleMoods } = await staleClient.from('moods').select('id').eq('user_id', userId)
    expect((staleMoods || []).length).toBe(0)

    // Auth user should not exist — trying to get the user via admin should fail
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    expect(authUser?.user).toBeNull()

    // localStorage should be cleared
    const lsKeys = await page.evaluate(() => Object.keys(localStorage))
    expect(lsKeys.length).toBe(0)
  })
})
