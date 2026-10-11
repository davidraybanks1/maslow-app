/**
 * SEC-7: Cross-user data isolation
 *
 * Verifies that signing out as User A and signing in as User B produces a clean
 * state — no User A data appears in the UI, localStorage, or IndexedDB.
 *
 * Prerequisites:
 *   - PLAYWRIGHT_USER_A_EMAIL / PLAYWRIGHT_USER_A_PASSWORD  — test account A
 *   - PLAYWRIGHT_USER_B_EMAIL / PLAYWRIGHT_USER_B_PASSWORD  — test account B
 *
 *   Create both accounts in Supabase Dashboard → Authentication → Users →
 *   "Add user" → "Create new user". Enter the email and password, and check
 *   "Auto Confirm User". Do NOT use "Invite user" (that sends an email and
 *   requires a link click before the password works).
 *
 *   After creating each account, sign in to the app once so onboarding runs
 *   and a row is inserted into the public.users table.
 *
 * To run:
 *   npx playwright test tests/e2e/cross-user-isolation.spec.js
 */

import { test, expect } from 'playwright/test'

const USER_A = {
  email:    process.env.PLAYWRIGHT_USER_A_EMAIL    || '',
  password: process.env.PLAYWRIGHT_USER_A_PASSWORD || '',
}
const USER_B = {
  email:    process.env.PLAYWRIGHT_USER_B_EMAIL    || '',
  password: process.env.PLAYWRIGHT_USER_B_PASSWORD || '',
}

// ---------------------------------------------------------------------------
// Helper: sign in via the /signin route
// ---------------------------------------------------------------------------
async function signIn(page, { email, password }) {
  await page.goto('/signin')
  await page.fill('input[type="email"], input[name="email"]', email)
  await page.fill('input[type="password"], input[name="password"]', password)
  await page.click('button[type="submit"]')
  // Wait for redirect away from /signin — indicates auth succeeded
  await page.waitForURL(url => !url.pathname.startsWith('/signin'), { timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// Helper: sign out via ProfileMenu
// ---------------------------------------------------------------------------
async function signOut(page) {
  // Open the profile menu — look for avatar / initials button
  const profileBtn = page.locator('[aria-label*="profile"], [aria-label*="Profile"], [data-testid="profile-menu-trigger"]').first()
  if (await profileBtn.count() === 0) {
    // Fallback: look for an element that opens the menu by text
    await page.locator('text=sign out').first().click()
  } else {
    await profileBtn.click()
    // Confirm sign-out in the modal
    const signOutBtn = page.locator('button:has-text("sign out"), button:has-text("Sign out")').first()
    await signOutBtn.click()
  }
  // If a confirmation step exists, accept it
  const confirmBtn = page.locator('button:has-text("sign out"), button:has-text("Sign out"), button:has-text("yes")').first()
  if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await confirmBtn.click()
  }
  await page.waitForURL('/signin', { timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Helper: snapshot all localStorage keys/values (never logs raw values)
// ---------------------------------------------------------------------------
async function getLocalStorage(page) {
  return page.evaluate(() => {
    const out = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      out[k] = localStorage.getItem(k)
    }
    return out
  })
}

// ---------------------------------------------------------------------------
// Helper: collect all IndexedDB database names
// ---------------------------------------------------------------------------
async function getIndexedDBNames(page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases().catch(() => [])
    return dbs.map(d => d.name)
  })
}

// ---------------------------------------------------------------------------
// Helper: read the Supabase session from the auth storage key
// ---------------------------------------------------------------------------
async function getSupabaseSession(page) {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        try { return JSON.parse(localStorage.getItem(k)) } catch { return null }
      }
    }
    return null
  })
}

// ---------------------------------------------------------------------------
// The test
// ---------------------------------------------------------------------------
test.describe('cross-user data isolation (SEC-7)', () => {
  test.skip(!USER_A.email || !USER_B.email, 'Set PLAYWRIGHT_USER_A_EMAIL/PASSWORD and PLAYWRIGHT_USER_B_EMAIL/PASSWORD to run this test')

  test('User B cannot see User A data after sign-out / sign-in', async ({ page }) => {
    // ── Step 1: Sign in as User A ──────────────────────────────────────────
    await signIn(page, USER_A)
    await page.waitForURL('/today', { timeout: 10_000 })

    const sessionA = await getSupabaseSession(page)
    expect(sessionA).not.toBeNull()
    const userAId = sessionA?.user?.id
    expect(userAId).toBeTruthy()

    // Capture what localStorage looks like while A is signed in
    const lsA = await getLocalStorage(page)
    const maslowStateA = lsA['maslow_state'] ? JSON.parse(lsA['maslow_state']) : null

    // A's userId must be in maslow_state if state is loaded
    if (maslowStateA?.userId) {
      expect(maslowStateA.userId).toBe(userAId)
    }

    // ── Step 2: Sign out as User A ─────────────────────────────────────────
    await signOut(page)
    await page.waitForURL('/signin', { timeout: 10_000 })

    // localStorage should no longer contain maslow_state after sign-out
    const lsAfterSignOut = await getLocalStorage(page)
    expect(lsAfterSignOut['maslow_state']).toBeUndefined()

    // Supabase auth token should be gone
    const sessionAfterSignOut = await getSupabaseSession(page)
    expect(sessionAfterSignOut).toBeNull()

    // ── Step 3: Sign in as User B ──────────────────────────────────────────
    await signIn(page, USER_B)
    await page.waitForURL('/today', { timeout: 10_000 })

    const sessionB = await getSupabaseSession(page)
    expect(sessionB).not.toBeNull()
    const userBId = sessionB?.user?.id
    expect(userBId).toBeTruthy()

    // A and B must be different accounts
    expect(userBId).not.toBe(userAId)

    // ── Step 4: Assert maslow_state is B's data, not A's ──────────────────
    const lsB = await getLocalStorage(page)
    const maslowStateB = lsB['maslow_state'] ? JSON.parse(lsB['maslow_state']) : null

    if (maslowStateB?.userId) {
      expect(maslowStateB.userId).toBe(userBId)
      expect(maslowStateB.userId).not.toBe(userAId)
    }

    // ── Step 5: No A-user-id strings appear anywhere in localStorage ───────
    for (const [key, val] of Object.entries(lsB)) {
      if (val && userAId) {
        expect(val, `localStorage key "${key}" must not contain User A's ID`).not.toContain(userAId)
      }
    }

    // ── Step 6: IndexedDB databases don't contain A's user ID in their name
    // (Supabase stores auth state in localStorage, not IDB, but check for completeness)
    const idbNames = await getIndexedDBNames(page)
    for (const name of idbNames) {
      if (userAId) {
        expect(name, `IndexedDB "${name}" must not contain User A's ID`).not.toContain(userAId)
      }
    }

    // ── Step 7: UI does not show any User A identifying info ──────────────
    // Profile email shown in menu should be B's email, not A's
    const profileBtn = page.locator('[aria-label*="profile"], [aria-label*="Profile"], [data-testid="profile-menu-trigger"]').first()
    if (await profileBtn.count() > 0) {
      await profileBtn.click()
      const menuText = await page.locator('[role="dialog"], [data-testid="profile-menu"]').first().innerText().catch(() => '')
      if (menuText) {
        expect(menuText).not.toContain(USER_A.email)
        if (USER_B.email) {
          expect(menuText).toContain(USER_B.email)
        }
      }
      // Close the menu
      await page.keyboard.press('Escape')
    }

    // ── Step 8: Today screen state is loaded for B (not stale A data) ─────
    // If A had practices/checkins, B's fresh state should not show them.
    // We can only check that the state's userId is B's.
    const lsFinal = await getLocalStorage(page)
    const finalState = lsFinal['maslow_state'] ? JSON.parse(lsFinal['maslow_state']) : null
    if (finalState?.userId) {
      expect(finalState.userId).toBe(userBId)
    }
  })
})
