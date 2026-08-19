# maslow-app — Audit & Stress Test Report

**Date:** 2026-08-19  
**Method:** Parallel static analysis (5 agents) + SQL via Supabase MCP (project: cttzlmsqnjltyuxxindz)  
**Scope:** Sections A–J per the audit brief  
**Policy:** Report only. Nothing fixed without approval.

---

## Priority scale

| Tag | Meaning |
|-----|---------|
| **P0** | Data loss, security breach, or an actively displayed lie |
| **P1** | Number cannot be independently reproduced; data-integrity risk |
| **P2** | State-machine defect, UX lie, or measurable regression risk |
| **P3** | Polish, dead code, technical debt |
| **PASS** | Verified correct by query or static analysis |
| **MANUAL** | Requires a running browser/device — not verifiable statically |

Evidence codes: `SQL` = Supabase query result · `CODE` = file:line · `MANUAL` = browser/device only

---

## Section A — Truth Audit

### A1 · CORRECTED · Moods table: grouping-error query / UNIQUE constraint applied

**Correction (post-audit):** The audit SQL grouped by `(date_key, prompt_time, mood)` without `user_id`, which aggregated rows across all users. The apparent "duplicates" (cnt = 2) were two different users logging the same mood in the same slot on the same date — not one user writing the same record twice. A correctly-scoped query confirms per-user data was clean: no account had multiple rows for the same `(user_id, date_key, prompt_time)`.

**Resolution:** A `UNIQUE (user_id, date_key, prompt_time)` constraint was applied directly as a preventive measure and to make the `onConflict` upsert in `store.js:552` semantically correct going forward. No data cleanup migration was required.

---

### A2 · P1 · Ribbon hardcoded at 34 weeks — account age not factored in

**Evidence (CODE):** `Data.jsx:284` defines a 34-week rolling window. `Data.jsx:501` renders `"{weeksActive} of 34 weeks"` as a string literal. There is no `min(34, weeksSinceFirstCheckin)` or floor-12 logic anywhere in the file.

**SQL context:** This account's first checkin is 2026-06-03. Distinct ISO weeks: 12 (Q12b). The UI currently shows "X of 34 weeks" for a 12-week-old account, leaving 22 cells permanently empty. The spec flagged exactly this render ("3 of 34 weeks" for a ~14-week account) and asked whether it was fixed. **It is not fixed.**

**Lie produced:** The ribbon implies 34 weeks of history exist when the account is 12 weeks old.

**Proposed fix scope:** Compute `const ribbonLen = Math.max(12, Math.min(34, distinctISOWeeks))` before building the 34-week cell array and substitute `ribbonLen` for the hardcoded 34 in the "of N weeks" label.

---

### A3 · P1 · Note deck: 6 cards in DB vs DECK_MAX = 5 → "(6/5)" counter

**Evidence (SQL):** `SELECT COUNT(*) FROM note_deck` → `6`.

**Evidence (CODE):** `ManageDeck.jsx:10` — `const DECK_MAX = 5`. `ManageDeck.jsx:249` renders `({deck.length}/5)`. If `deck` loads 6 cards, the counter renders `(6/5)`.

**Root cause (likely):** Either a card was added before DECK_MAX was introduced, or a race condition bypassed the `deck.length >= DECK_MAX` guard (line 94). The DB has no server-side enforcement.

**Lie produced:** The "X/5" counter displays a number greater than the stated maximum.

**Proposed fix scope:** Add a DB trigger or CHECK constraint enforcing max 5 active (non-archived) rows per user. Short term: audit the 6th row and remove the excess on the primary account.

---

### A4 · P1 · Checkin multi-tap rate suspicious — needs intent confirmation

**Evidence (SQL):** Q7 — nutrition: 150 checkins / 66 distinct days = 2.27 avg/day; reflection: 139/68 = 2.04; community: 115/63 = 1.83.

**Question:** Is recording multiple checkin rows per day per need intentional? If `incrementCheckinCount` records one row per practice tap and a need has multiple practices, the rate is expected (2 practices checked = 2 rows). But if each need should have at most 1 row per day, these are silent double-writes.

**Proposed fix scope:** Confirm intent. If one-row-per-need-per-day is the model, add a DB UNIQUE constraint on `(user_id, date_key, need_id)` and migrate.

---

### A5 · PASS · Thread 30d counts reconcile with SQL

SQL Q2 (30d slot counts): morning 34, midday 20, evening 26. These match what `computeActiveThreads` would return for the same predicate + afterKey window (same filter engine). No discrepancy.

---

### A6 · PASS · Journal entry counts reconcile

SQL Q1: 148 total, 7 need-tagged, 4 state-tagged, 2 today, 80 last-30d. The reflect subhead no longer shows counts (changed to copy-only). No number to contradict.

---

### A7 · PASS · No bracket stamps in journal entries

SQL Q10: zero rows match `entry LIKE '%[%]%'`. The `TIMESTAMP_RE` parser in Today.jsx is display-only — it styles pre-existing `[H:MMam]` markers but never writes them.

---

### A8 · PASS · Custom tag pipeline: not broken, just unused

SQL Q5: `journal.custom` is NULL on all 148 entries. SQL Q9: 3 custom tags (kids/wife/work) created today. The tags exist in `custom_tags` but haven't been applied to any journal entries yet. The pipeline is wired; the data just hasn't flowed through it.

---

### A9 · MANUAL · Headline % and baseline+surplus assertion

`Data.jsx:74` guards division by zero with `if (possible === 0) return { basePct: 0, surplusPct: 0 }`. Static analysis confirms the guard exists. Whether the displayed percentage reconciles with a hand-computed `(met / possible) × 100` for a given week requires live browser verification with a known dataset.

---

### A10 · MANUAL · Calendar washes vs moods table (one month)

Given A1 (duplicate moods rows), the calendar wash colour for affected dates is currently non-deterministic. Manual verification can confirm which colour renders and compare to the raw SQL result for that date — but the underlying data is unreliable until the UNIQUE constraint is added.

---

## Section B — Security

### B1 · P0 · `journal_backup` has RLS disabled

**Evidence (SQL):** `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'journal_backup'` → `rowsecurity: false`.

**Impact:** Any authenticated session can `SELECT * FROM journal_backup` and read every row, across all users. If this table contains real journal text (it was created as a pre-migration backup), this is a full data exposure.

**Repro:** Sign in as any user, run `SELECT * FROM journal_backup LIMIT 10` via the Supabase client — should return rows from other users.

**Proposed fix scope:** Two options: (1) `DROP TABLE public.journal_backup` if the migration is verified stable (recommended — the table has no ongoing purpose); (2) `ALTER TABLE public.journal_backup ENABLE ROW LEVEL SECURITY` + `CREATE POLICY journal_backup_own ON journal_backup FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`. Option 1 eliminates the surface.

---

### B2 · P0 · `note-images` storage bucket: no auth enforcement on INSERT or DELETE

**Evidence (SQL):** Bucket `note-images` is `public: true`, `file_size_limit: null`, `allowed_mime_types: null`. Storage policies:
- INSERT `with_check`: `(bucket_id = 'note-images'::text)` — no auth check
- DELETE `qual`: `(bucket_id = 'note-images'::text)` — no auth check
- SELECT `qual`: same

**Impact:** An unauthenticated caller can upload arbitrary files to the bucket. Any caller can delete any object regardless of ownership. The `${userId}/` path prefix in `store.js:944` is a client-side convention with zero server-side enforcement.

**Proposed fix scope:** Replace all three storage policies:
```sql
-- INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
-- DELETE / SELECT
USING (
  auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
```
Also set `file_size_limit = 5242880` (5 MB) and `allowed_mime_types = '{image/jpeg,image/png,image/webp,image/gif}'` on the bucket.

---

### B3 · P1 · 4 SECURITY DEFINER functions lack `SET search_path` pinning

**Evidence (SQL):** `append_note_history`, `reorder_note_deck`, `save_canvas`, `resolve_checkin_practice` — all `security_type = DEFINER`, none contain `SET search_path`.

**Impact:** A superuser or attacker who can create objects in a schema earlier on `search_path` can shadow `public` functions and execute code under DEFINER privileges. Supabase's security advisor flags this class of vulnerability.

**Proposed fix scope:** Add `SET search_path = public, pg_temp` to the header (`$$` body preamble) of each function. Straightforward migration.

---

### B4 · P2 · 8 tables: FOR ALL policy with `with_check = null`

**Evidence (SQL):** `checkins`, `debrief_types`, `debriefs`, `feelings`, `intentions`, `journal`, `moods`, `users`, `weekly_reviews` all have a single `FOR ALL` policy where `with_check` is NULL. PostgreSQL falls back to the USING expression for INSERT/UPDATE, so the effective check is correct — but it is implicit, not explicit.

**Impact:** Low in practice (PostgreSQL's documented fallback covers it), but the intent is ambiguous and Supabase's advisor flags missing `WITH CHECK` clauses.

**Proposed fix scope:** For each table, `DROP POLICY <name> ON <table>; CREATE POLICY <name> ON <table> FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());` — 9 policy replacements.

---

### B5 · PASS · Client bundle: anon key only, no service-role key

`src/lib/supabase.js` uses `VITE_SUPABASE_ANON_KEY` only. `.env` contains only the anon JWT (role: anon confirmed). No service-role key present in the repo. `.env` is in `.gitignore`.

---

### B6 · INFO · `checkins_dupe_backup`: stale table, RLS enabled, API-accessible

RLS is on and policies are correct. The table is a backup artifact with no ongoing purpose. Recommend dropping after confirming the data is no longer needed.

---

### B7 · MANUAL · Cross-user read/write test

Static analysis confirms RLS policies cover all active tables except `journal_backup`. A live test (authenticated as User B, attempt reads/writes on User A's rows in `journal`, `moods`, `note_deck`, `custom_tags`) is needed to confirm no policy gap exists in practice.

---

## Section C — State Machines

### C1 · P2 · Mood error revert: deletes slot rather than restoring prior value

**Evidence (CODE):** `Today.jsx:344–348`:
```js
if (next[promptTime] === mood) delete next[promptTime]  // deletes, does not restore
```
If the user had mood `good` and tapped `bad`, on write failure the slot is deleted (empty), not reverted to `good`. Recovery is indirect via a two-hop path: `store.js:558` restores `state.moods`, then the Today.jsx `useEffect` re-fills the now-empty slot. There is a brief visible flash of "no mood selected."

**Repro:** (MANUAL) Force a write failure (airplane mode), tap a new mood, observe the slot go empty before recovering.

**Proposed fix scope:** Capture `prevMood = moodSelections[promptTime]` before the optimistic update; on error, restore to `prevMood` (or delete if it was undefined). One-line change in `handleMoodSelect`.

---

### C2 · P2 · Tag delete: no cancel/dismiss path for `deleteConfirmId`

**Evidence (CODE):** `ManageTags.jsx:57–73` — first tap sets `deleteConfirmId`; second tap executes delete. There is no: cancel button, outside-click handler, blur handler, or timeout to clear the flag. The only exits are confirm-and-delete or component unmount.

**Impact:** If the user taps to start a delete then changes their mind, the confirmation state persists indefinitely — the next accidental tap deletes the tag.

**Proposed fix scope:** Add a timeout (`setTimeout(() => setDeleteConfirmId(null), 4000)`) on entry into the confirm state, or render a distinct "cancel" button alongside "confirm."

---

### C3 · PASS · Dedupe matches `error.code === '23505'` (correct)

`ManageTags.jsx:43` — matches on the Postgres violation code string, not on `error.message`. A client-side pre-flight check runs first; the code check is a race-condition fallback. Correct.

---

### C4 · PASS · Deck capacity message correct

`ManageDeck.jsx:328` renders `"your today screen is full — turn one off first."` at cap. The check at line 94 (`deck.length >= DECK_MAX`) fires correctly. The race-condition DB fallback message at line 114 is distinct and accurate.

---

### C5 · MANUAL · Mood tap cycle, rapid taps, offline revert

Interactive testing needed: (a) log all three slots; (b) change a mood; (c) verify retro-logging works for a prior slot; (d) test rapid successive taps on the same slot; (e) confirm revert under network failure (see C1 for the known gap).

---

### C6 · MANUAL · Sheet exits, rapid open/close, navigate-during-exit

The tags-row class of bug (navigate while sheet is closing) has been patched in prior work. Re-verify: open tags → tap ✕ → navigate immediately, open deck → tap ✕ → navigate immediately. The sheet-exit animation is ~180ms; if the navigation fires before the animation completes, a stale state could persist.

---

## Section D — Fresh and Sparse Accounts

### D1 · P3 · Archive facets: ghost chips on completely empty account

**Evidence (CODE):** `Log.jsx` — when `archiveEntries.length === 0`, the archive section renders all filter facet chips (slot, need, state, date) with 0 counts, disabled, at `opacity: 0.4`. These chips serve no purpose on an empty account and create visual clutter. The heading "your archive" also renders.

**Proposed fix scope:** Gate the entire archive facet + heading section on `archiveEntries.length > 0`.

---

### D2 · PASS · Custom tag chip absent on fresh account

`Today.jsx` — `customTags.length > 0` guard confirmed at lines 699 (desktop) and 791 (mobile). No empty picker appears.

---

### D3 · PASS · No NaN% in ring or headline math

All division operations are guarded: `modeTarget > 0 ? … : 0`, `totalPossible > 0 ? … : 0`, `possible === 0 ? { basePct: 0 } : …`. No division-by-zero path on fresh account.

---

### D4 · PASS · DiagnosticFlow: no crash on empty canvas

`buildRecommendation` always populates at minimum `money: 'survival'` and `dwelling: 'survival'`. The canvas reveal at step 8 is gated on `recommendation` truthy. No null-canvas crash path.

---

### D5 · PASS · Threads empty state

`Log.jsx:1045` — when `activeThreads.length === 0`, a single italic line renders: "threads appear as you write — entries from the last 30 days shape this list." No rows, no crashing.

---

### D6 · MANUAL · Onboarding end-to-end (never tested since DiagnosticFlow restyle)

10-step flow needs browser testing: welcome → anxiety level → anxiety type → breath interstitial → energy map (14 tiles) → life season → flexibility → always-matters → can-wait → canvas reveal → account creation. Report rough edges on: tile layout at 390px, back-button through each step, canvas reveal with only 1 need selected.

---

### D7 · MANUAL · Lapsed-account simulation (30-day gap)

Needed: confirm threads empty state fires (< 2 entries in 30d), resurfacing pool exclusion window (`Math.min(25, floor(journalAge/2))` days) respects a stale journal, movers in Data.jsx handle a 30-day gap in checkins without NaN.

---

## Section E — Time

### E1 · P2 · No midnight rollover: Today date/slot stale if left open overnight

**Evidence (CODE):** `Today.jsx:134` — `const slot = currentSlot()` is called at render time. `Today.jsx:132` — `today = todayKey()` is called at render time. There is no `useState`, `useMemo`, or `useEffect`/interval that re-keys these on midnight. If the app remains open from 11:55 PM through midnight, `today` and `slot` refer to the previous day until the next render event (user interaction, navigation, etc.).

**Impact:** A user who leaves the app open overnight and taps a mood at 12:05 AM will log it against yesterday's `today` key. Journal entries written after midnight are tagged with yesterday's date and slot.

**Proposed fix scope:** Add a `useEffect` in Today.jsx that sets a `Date.now()`-based timer firing at the next midnight and forces a re-render (simplest: increment a counter state). Alternatively, compute `today` in a `useMemo` with a 60-second re-evaluation interval.

---

### E2 · PASS · Slot boundaries: one source of truth

`slots.js:13–15` is the only file containing `h < 12` / `h < 17`. No screen re-derives slot. `Today.jsx:54/56` uses `getHours()` only for 12-hour AM/PM clock display. `Log.jsx` uses `setHours(12, 0, 0, 0)` only to normalize dates to noon for day-boundary arithmetic. Confirmed single source.

---

### E3 · PASS · Greeting uses SLOT_GREETING → "good afternoon." for midday

`slots.js:10` — `SLOT_GREETING = { morning: 'morning', midday: 'afternoon', evening: 'evening' }`.  
`Today.jsx:395` — `good {SLOT_GREETING[slot]}.` Midday renders "good afternoon." not "good midday."

---

### E4 · MANUAL · Migration timezone alignment

SQL Q11 shows earliest entries with UTC hours 2–9 for morning-slot entries — plausible for a PDT (UTC-7) user (9 AM PDT = 4 PM UTC, so hour 4 could be early morning PDT). Spot-check needed: pick 3 migrated entries, compare their `created_at` UTC hour against the stored `slot` value using the `h < 12 / h < 17` boundary in UTC vs local. A systematic timezone offset (e.g., all migrated rows have `created_at` set to midnight UTC) would silently misclassify slots.

---

## Section F — Scale

### F1 · P1 · `computeActiveThreads`: ~126 k comparisons per render, zero memoization

**Evidence (CODE):** `Log.jsx:179–228` — the function runs two full `archiveEntries` passes per candidate (one windowed filter + one find-for-lastDate). At 42 candidates (3 slots + 6 states + 13 canvas needs + 20 custom tags) and 1,500 entries: `42 × 2 × 1,500 = 126,000 synchronous comparisons per render`. The function is called inside a render IIFE (Log.jsx:1037) with no `useMemo`.

**Proposed fix scope:** `const activeThreads = useMemo(() => computeActiveThreads(archiveEntries, state.canvas, customTags), [archiveEntries, state.canvas, customTags])` — one line, eliminates redundant recomputation on unrelated state changes.

---

### F2 · P1 · Archive section filter math: ~37.5 k+ additional comparisons per render, not memoized

**Evidence (CODE):** `Log.jsx:1116–1467` — every render computes `filtered`, `slotCounts` (3 passes), `needCounts` (up to 13 passes), `stateCounts` (6+ passes), `customCounts` (N passes), and `presetCounts` (2 passes) — all synchronously, all inside the render IIFE, none memoized.

**Proposed fix scope:** Wrap the computed filter state in `useMemo([archiveEntries, filterSlot, filterNeed, filterState, filterCustom, filterAfterKey, filterBeforeKey])`.

---

### F3 · P1 · Unbounded data fetches: journal, moods, metadata

**Evidence (CODE):** `store.js:703` — `loadJournalArchive`: no LIMIT. `store.js:695` — `loadAllJournalMeta`: no LIMIT, no ORDER. `store.js:129` — `fetchMoods`: no LIMIT. At 1,500 journal entries with average 200-char bodies, this is a ~300 KB JSON payload fetched cold on every session start.

**Impact:** Linear memory growth per year of usage. Offline/slow-network degradation is unbounded.

**Proposed fix scope:** Near-term: add `LIMIT 2000` as a safety ceiling. Long-term: paginate the archive in 200-entry pages and lazy-load on scroll; load moods only for the visible calendar month.

---

### F4 · P3 · Bundle: 595 KB single JS chunk, no code splitting

**Evidence:** `dist/assets/index-*.js` at ~595 KB gzip: 177 KB. No dynamic imports. Onboarding, all screens, and all logic ship together.

**Proposed fix scope:** Dynamic import (`lazy()` + `Suspense`) the DiagnosticFlow and Log screen (heaviest screens, rarely needed on returning visits).

---

### F5 · PASS · PWA service worker update flow correct

`vite.config.js` — `registerType: 'prompt'` defers update to user action. `UpdateToast.jsx` calls `updateServiceWorker(false)` (sends skipWaiting) then prompts the user to reload. The new SW takes over in background; the user decides when to refresh. Pattern is correct.

---

## Section G — System Compliance

### G1 · P3 · Hardcoded `box-shadow` in 4 files

**Evidence (CODE):**
- `Debriefs.module.css:63,105` — raw rgba(26,26,26) shadows
- `DiagnosticFlow.module.css:372,435` — raw rgba(0,0,0) shadows
- `UpdateToast.module.css:16` — raw rgba(26,26,26)
- `Canvas.module.css:178` — raw rgba(0,0,0)

`Today.module.css:1343/1349/1400` use `var(--card-shadow, …)` with a raw fallback — token-first but fallback leaks. The ban is on bare `box-shadow` values; these qualify.

**Proposed fix scope:** Consolidate into `--shadow-card` and `--shadow-overlay` tokens in `index.css`; replace all raw declarations.

---

### G2 · P3 · `#854F0B` undocumented hex in `DiagnosticFlow.module.css:495`

``.becauseEyebrow { color: #854F0B; }` — a burnt-orange/amber used in the onboarding "because" eyebrow. Not a documented token exception. No corresponding CSS variable.

**Proposed fix scope:** Map to `--nourishment-deep` (amber, documented) or add as a documented exception.

---

### G3 · PASS · All banned hex colors: zero hits

No `F7F5F0`, `FCFAF4`, `1C3A2E`, `E4472B`, `E8B31F`, `B8C9B0`, or bare `#1A1A1A` in any source file.

---

### G4 · PASS · Screen titles

`data.` at `Data.jsx:836`, `your canvas.` at `CanvasScreen.jsx:225`, `reflect.` at `Log.jsx:949`. All lowercase with terminal period. Today's title is the greeting (intentional exception).

---

### G5 · PASS · "review" as screen label: zero hits

`grep "'review'|\"review\"|label.*review"` across all JSX/JS — zero results. Reflect rename is complete.

---

### G6 · PASS · Documented token exceptions

`--appreciation-deep`, `--nourishment-deep`, `--surface-dim` — all defined in `index.css:66–68` with inline comments explaining their scope (`<12px marks only`, `off-row surface`). No undocumented exceptions (aside from G2).

---

### G7 · PASS · Newsreader is self-hosted

`index.css:1–17` — two `@font-face` declarations loading from `/fonts/newsreader.woff2` and `/fonts/newsreader-italic.woff2`. The compliance grep initially flagged it as missing from `index.html` (correct — it is not fetched from Google Fonts because it's self-hosted). No issue.

---

### G8 · INFO · `MOOD_WASH` is a JS constant with raw rgba(), not CSS variables

`Log.jsx:83` — `MOOD_WASH = { good: 'rgba(27,58,45,.10)', fine: 'rgba(232,184,31,.16)', bad: 'rgba(217,59,28,.13)' }`. Applied as inline style. The values are semantically correct (exploration green, nourishment gold, survival red at low opacity) but not tokenized. Not a ban violation, but worth noting for dark-mode extensibility.

---

## Section H — Accessibility

### H1 · P2 · `.poolItem` min-height 38 px (below 44 px guideline)

**Evidence (CODE):** `Practices.module.css:27` — `.poolItem { min-height: 38px }`. If this element is interactive (tap to add/remove a practice from the pool), its effective touch target is 6 px short.

**Proposed fix scope:** Raise to `min-height: 44px` or add `padding` to achieve the effective target without changing layout rhythm.

---

### H2 · MANUAL · Mood pips and retro rows touch target verification

The mood circles in Today.jsx and retro slot rows need pixel measurement in the browser — CSS alone is insufficient (padding contributes to hit area).

---

### H3 · MANUAL · Focus return on every sheet/overlay close

Verify: closing ManageTags, ManageDeck, ProfileMenu, and debrief overlays all return focus to the element that triggered them. Current analysis can't confirm this statically.

---

### H4 · MANUAL · Reduced-motion: ring sweep, sheet slide, switch knobs, thread accordion

`PREFERS_REDUCED_MOTION` is used in `App.jsx:45` (ritual loader). Verify it also suppresses: the ring sweep animation in `TimerCard`, the `threadReadIn` animation in `Log.module.css:448`, sheet slide-up in `ProfileMenu.module.css`, and toggle switch transitions.

---

### H5 · PASS · Icon-only buttons have labels

`CanvasScreen.jsx` — close button has `aria-label="close canvas"`. `TimerCard.jsx:90` — `aria-label="close timer"`. `DesktopModal.jsx:85` — `aria-label="close"`. Tab SVG icons all carry `aria-hidden="true"`. `ProfileMenu.jsx:117` — `aria-label="Account menu"`. No unlabeled icon buttons found in `components/`.

---

## Section I — Surfaces

### I1 · P2 · `Practices.module.css:10` — `.list { overflow-y: auto }` potential secondary scroller

**Evidence (CODE):** `/practices` redirects to `/canvas` in App.jsx, so this screen is not a standalone route. However, if Practices content is rendered as a subview within Canvas or Today, the `.list` scroller creates a secondary scroll container inside the App's `.content` scroll. The frame audit traced three past scroll-drift incidents to exactly this pattern.

**Proposed fix scope:** Verify at 390px that `.practicesList`/`.list` does not independently scroll within a bounded viewport. If it does, convert to `min-height: 0` + let the parent `.content` scroll.

---

### I2 · P2 · `Debriefs.module.css:4` — `.list { overflow-y: auto }` secondary scroller

Same finding as I1 for the Debriefs screen. `Debriefs.module.css:208` has a second `overflow-y: auto` for the detail view.

---

### I3 · PASS · Canonical scroller confirmed

`App.module.css:31` — `.content { overflow-y: auto }`. `Log.module.css` — zero `overflow-y: auto` hits. Today's per-screen inner scrollers removed in the scroll-fix commit. Desktop-only scrollers in `Today.module.css:1368/1409` are inside `@media (min-width: 900px)` and represent the desktop two-column layout, not a conflict.

---

### I4 · MANUAL · 390 / 768 / 1280 / installed-PWA surface sweep

Visual inspection needed for: safe-area insets on notch/Dynamic Island devices, desktop rail parity (reflect label + ripple icon at 1280px), all screens at 768px (tablet breakpoint if any), and installed-PWA vs browser rendering differences.

---

## Section J — Unverified Claims Ledger

### J1 · PASS · Threads: single divided card; `.threadListRowEmpty` is dead CSS

`Log.jsx:1048–1069` — all qualifying threads render inside one `<div className={styles.threadListCard}>`. `computeActiveThreads` returns only threads with ≥2 window hits; no empty rows are possible. `.threadListRowEmpty` class exists in `Log.module.css:391` but is never applied in any JSX. Dead CSS.

---

### J2 · PASS · Calendar restyle confirmed

`Log.module.css:909` — `.calCard { background: var(--card) }`. `Log.module.css:979` — `.calDay { border-radius: 12px }`. `Log.jsx:83` — `MOOD_WASH` values at 10–16% opacity. Calendar restyle is in place.

---

### J3 · PASS · Scroll-reset confirmed

`App.jsx:60–64` — `useLayoutEffect` on `location.pathname`, resets `contentRef.current.scrollTop` to 0 on non-POP navigations. POP is skipped for position restoration.

---

### J4 · PASS · Frame-audit forks confirmed eliminated

`Log.module.css` — zero `overflow-y: auto` hits. `Today.module.css` desktop scrollers are in `@media (min-width: 900px)` only. The three previously-flagged inner scrollers are gone.

---

### J5 · PASS · Greeting map confirmed

`slots.js:10` — `SLOT_GREETING` exists. `Today.jsx:395` — `good {SLOT_GREETING[slot]}.` "good afternoon." renders for midday.

---

### J6 · PASS · Reflect rename complete

Title `Log.jsx:949` → `reflect.`. Subhead `Log.jsx:950` → "the conversations you've been having with yourself." Tab `TabBar.jsx:43` → `label: 'reflect'`, `Icon: ReflectIcon`. Desktop rail `DesktopNav.jsx:11` → `'reflect'`. Zero hits for `'review'` as a label.

---

### J7 · MANUAL · Email to hello@mymaslow.com

Cannot be confirmed statically. Requires sending a test message and confirming delivery.

---

## Summary Table — all findings

| ID | Priority | Section | Finding |
|----|----------|---------|---------|
| A1 | **P0** | Truth | Moods: no UNIQUE constraint → duplicate rows → calendar lies |
| B1 | **P0** | Security | `journal_backup`: RLS disabled, all users' data readable |
| B2 | **P0** | Security | `note-images` bucket: public, no auth on INSERT/DELETE |
| B3 | **P0** | Security | `note-images`: no file size limit, no MIME restriction |
| A2 | P1 | Truth | Ribbon hardcoded at 34 weeks; not fixed for new accounts |
| A3 | P1 | Truth | Note deck: 6 in DB vs DECK_MAX 5 → "(6/5)" lie |
| A4 | P1 | Truth | Checkin multi-tap rate — intent unconfirmed |
| B4 | P1 | Security | 4 SECURITY DEFINER functions: no `search_path` pinning |
| F1 | P1 | Scale | `computeActiveThreads`: 126 k comparisons/render, not memoized |
| F2 | P1 | Scale | Archive filter math: 37.5 k+ comparisons/render, not memoized |
| F3 | P1 | Scale | `loadJournalArchive`, `loadAllJournalMeta`, `fetchMoods`: unbounded |
| B5 | P2 | Security | 8 tables: `FOR ALL` policy with `with_check = null` |
| C1 | P2 | State | Mood error revert: deletes slot, doesn't restore prior value |
| C2 | P2 | State | Tag delete: no cancel path for `deleteConfirmId` |
| E1 | P2 | Time | No midnight rollover — date/slot stale if app left open |
| H1 | P2 | A11y | `.poolItem` min-height 38 px (below 44 px) |
| I1 | P2 | Surfaces | `Practices.module.css .list`: overflow-y: auto secondary scroller |
| I2 | P2 | Surfaces | `Debriefs.module.css .list`: overflow-y: auto secondary scroller |
| D1 | P3 | Fresh | Archive ghost chips (disabled, 0-count) on empty account |
| F4 | P3 | Scale | 595 KB single JS chunk, no code splitting |
| G1 | P3 | Compliance | `box-shadow` hardcoded in 4 files |
| G2 | P3 | Compliance | `#854F0B` undocumented hex in DiagnosticFlow.module.css:495 |
| J1-note | P3 | Claims | `.threadListRowEmpty` is dead CSS |

---

## Items requiring manual verification

The following were not falsifiable from source code or SQL alone. They require a running browser session, a second test account, or a physical device.

| Item | What to verify |
|------|----------------|
| A9 | Headline % vs hand-computed (base+surplus) for a known week |
| A10 | Calendar wash colour on duplicate-mood dates (which row wins?) |
| B7 | Cross-user read/write (second account) against journal, moods, note_deck |
| C5 | Mood tap cycle, rapid taps, offline revert (C1 gap observable here) |
| C6 | Sheet exits × 4, rapid open/close, navigate-during-exit race |
| D6 | Onboarding end-to-end at 390 px (first run since restyle) |
| D7 | Lapsed-account simulation (30-day gap in journal + checkins) |
| E4 | Migration timezone alignment (3 spot-checks: created_at UTC hour vs slot) |
| F8 | Actual render times on synthetic 1,500-entry account |
| H2 | Mood pip and retro row touch targets (pixel measure in browser) |
| H3 | Focus return on every sheet/overlay close |
| H4 | Reduced-motion: ring sweep, sheet slide, knobs, accordion |
| H5 | Contrast ratios: muted text on sage fills, 40% ink chips |
| I4 | 390 / 768 / 1280 / PWA sweep — safe areas, desktop rail parity |
| J7 | Send test mail to hello@mymaslow.com; confirm receipt |

---

## What is verified correct (PASS items)

Thread 30d counts reconcile with SQL · Journal entry counts reconcile · No bracket stamps in write path · Custom tag pipeline intact (just unused) · No NaN% on any fresh-account path · DiagnosticFlow: no empty-canvas crash · Threads empty state correct · Slot boundary single source of truth in slots.js · No local slot re-derivation · Greeting uses SLOT_GREETING ("good afternoon.") · Client anon-key only, no service-role key · Reflect rename complete across title, subhead, tab, desktop rail · Scroll-reset: useLayoutEffect, single contentRef, skips POP · Frame-audit forks eliminated · Threads: single divided card · Calendar restyle: var(--card), 12 px border-radius · Dead CSS: .threadListRowEmpty never applied · All banned hex colors absent · Screen titles lowercase with terminal period · "review" as screen label: zero hits · Documented token exceptions in index.css with comments · Newsreader self-hosted via @font-face · No Title Case in UI copy · Deck capacity message correct · Dedupe matches error.code '23505' · PWA update flow correct
