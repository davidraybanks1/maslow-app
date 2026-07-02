# maslow-app Audit — Final Status

All 32 findings resolved or won't-fixed as of 2026-07-01.

---

## P0 — Data loss, broken functionality, security ✅ All resolved

**[P0] checkins restored from wrong user.id on pre-migration rows** — RESOLVED — `userIdRef` added to `useAppState`; `checkIn` reads `userIdRef.current` at write time. All new users get `auth.uid()` as `users.id` per prior migration.

**[P0] `checkIn` reads `state.userId` via stale closure** — RESOLVED — `checkIn` now uses `userIdRef.current` (a ref synced via useEffect), not the render-time closure value.

**[P0] `appendNoteHistory` read-modify-write race condition** — RESOLVED — replaced client-side R-M-W with `supabase.rpc('append_note_history')`. Postgres function uses `FOR UPDATE` row-level lock; dedup, prepend, and cap are atomic.

**[P0] `DiagnosticFlow.handleSignUp` canvas not passed to `completeOnboarding`** — RESOLVED — `canvasObj` now threaded through `onDone(dest, userId, canvas)` → `handleAccountDone` → `completeOnboarding(canvas, ...)`. SIGNED_IN handler captures `signInNavRef.skip` before `await restoreFromSupabase` so it skips setState during onboarding sign-up.

**[P0] Journal save uses stale `state.userId` in debounce** — RESOLVED — `journalUserIdRef` (synced via useEffect) read at debounce fire time.

**[P0] `reorderNoteDeck` parallel writes with no rollback** — RESOLVED — replaced N parallel UPDATEs with `supabase.rpc('reorder_note_deck')`. Postgres function updates all positions in one transaction. `handleDragEnd` catches errors and reverts local state.

**[P0] `Debriefs.refresh` fire-and-forget** — RESOLVED — `refresh()` wrapped in try/catch, all three mutation handlers `await refresh()`, error shown with retry button.

---

## P1 — Visible bugs, UX friction ✅ All resolved

**[P1] Streak divergence** — RESOLVED — `isDayHit()` now delegates to `isStreakDay()`, the same module-level function used by `getCanvasGuidance`. One implementation, shared by both.

**[P1] `MODE_WEIGHTS` name collision** — RESOLVED — DiagnosticFlow local constant renamed `MODE_DAILY_PRACTICES` with explanatory comment.

**[P1] `saveProfile` missing local state update** — RESOLVED (then function removed in P2 pass as dead code).

**[P1] `CanvasScreen` N-parallel saves** — RESOLVED — `replaceCanvas(fullCanvas)` in store hook calls `supabase.rpc('save_canvas')` (one atomic write). On failure: central and local canvas revert.

**[P1] Debrief excerpts render raw JSON** — RESOLVED — `parseDebriefEntry(d.entry, isPeak).sections[0].slice(0, 80)` used for all list items.

**[P1] `loadMoods` dead export** — RESOLVED (removed from hook return in P2 pass).

**[P1] `weekKey()` Sunday-anchored** — RESOLVED — changed to `((d.getDay() + 6) % 7)` for Monday anchoring. One existing `weekly_reviews` row remapped from `2026-06-14` (Sunday) → `2026-06-08` (Monday) via migration.

**[P1] Debrief count optimistic increment** — RESOLVED — `DebriefForm` and `PeakDebriefForm` both show a red "save failed — please try again" message when `saveDebrief` errors. Count was already correctly gated inside `onSaved` (not optimistic), so no rollback needed.

**[P1] `UpdatePassword` Enter key** — RESOLVED — submit button moved inside `<form>`. DiagnosticFlow sign-up fields wrapped in `<form onSubmit>` with hidden submit.

**[P1] iOS Safari input auto-zoom** — RESOLVED — global `input, textarea, select { font-size: 16px }` in index.css plus all 10 individual module CSS rules bumped to 16px.

**[P1] Swipe deck overscroll** — RESOLVED — `overscroll-behavior-x: contain` on `.noteDeckWrapper`.

**[P1] `--ink4` undeclared** — RESOLVED — `--ink4: #C4C0BA` added to `:root` in index.css.

---

## P2 — Polish, consistency, dead code ✅ All resolved or won't-fix

**[P2] `saveProfile` dead export** — RESOLVED — function body and hook return entry both deleted; confirmed zero callers across entire src/.

**[P2] `loadMoods` dead export** — RESOLVED — function body and hook return entry both deleted; confirmed zero callers.

**[P2] `ALWAYS_MATTERS_TO_NEED` undocumented dual mapping** — RESOLVED — comment added explaining that 'creativity' → 'beauty' because the canvas has no separate creativity need; beauty covers aesthetic/creative expression.

**[P2] `HamburgerMenu` double localStorage clear** — RESOLVED — removed `localStorage.removeItem('maslow_state')` from `handleSignOut`; the SIGNED_OUT handler in store.js already clears it. Comment left explaining why.

**[P2] `#E8E4F0` hardcoded** — RESOLVED — `--surface-reflective: #E8E4F0` added to `:root` in index.css. All 3 occurrences in Today.module.css replaced with `var(--surface-reflective)`.

**[P2] 1px card borders in Data.module.css and index.css** — RESOLVED — `.rangeToggle` in Data.module.css and `.card` in index.css changed to `0.5px solid var(--border)`. `.btn-ghost` and `.bottom-nav border-top` left at 1px (buttons and dividers are intentionally heavier).

**[P2] `SignIn.module.css` hardcoded colors** — RESOLVED — `#D8D8D8` → `var(--border)`, `#ADADAD` → `var(--ink4)`, `#1A1A1A` → `var(--ink)`, border changed to `0.5px`.

**[P2] `AppHeader` logo circles `fill="#ffffff"`** — RESOLVED — all 9 white circles changed to `fill="var(--ink)"` (inline SVG in JSX inherits CSS custom properties via style cascade).

**[P2] `canSave` blocks valid survival+nourishment canvases** — RESOLVED — changed from `explorationCount >= 1 || appreciationCount >= 1` to `Object.values(canvas).some(v => v)` (at least one assigned need).

**[P2] `onboardedAt` lost on cross-device sign-in** — RESOLVED — `onboarded_at date` column added to `users` table; backfilled from `created_at` for existing onboarded users. DiagnosticFlow upsert now writes `onboarded_at`. `restoreFromSupabase` includes `onboardedAt: user.onboarded_at || null`.

**[P2] Practices.jsx `sessionStorage` CTA flag** — RESOLVED — changed to `localStorage` so the "start my day →" CTA dismissal persists across tab closes and PWA restarts.

**[P2] Orphaned mood note without mood selection** — RESOLVED — error branch in `handleMoodSelect` now also clears `moodNotes[promptTime]` when the mood is removed on save failure.

**[P2] `MODE_MAX` confusing name** — RESOLVED — renamed to `MODE_NEED_LIMIT` throughout CanvasScreen.jsx (3 occurrences) to distinguish from `MODE_MAX_BUBBLES` in constants.js.

**[P2] `onboardedAt` missing from `migrateState`** — RESOLVED — `if (saved.onboardedAt === undefined) saved.onboardedAt = null` added to `migrateState`, preventing `undefined` on older localStorage snapshots.

---

**P0: 7 ✅ | P1: 11 ✅ | P2: 14 ✅ | Total: 32 resolved**
