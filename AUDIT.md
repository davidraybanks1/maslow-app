# maslow-app Audit

## P0 — Data loss, broken functionality, security

**[P0] checkins restored from wrong user.id on pre-migration rows** — `src/lib/store.js:127` — `restoreFromSupabase` queries `checkins`, `moods`, and `note_deck` using `user.id` (the `users` table row id) rather than `userId` (auth UID), and the restored state sets `state.userId = user.id` (line 140), meaning all subsequent writes go to the mismatched id; fix by detecting the mismatch early and either migrating the row or consistently using `userId` (auth UID) for all Supabase operations.

**[P0] `checkIn` reads `state.userId` via stale closure** — `src/lib/store.js:301` — `checkIn` is a plain function inside `useAppState` that closes over `state` at definition time; if `state.userId` was null when the function was created and the user later signs in, `checkIn` will never write to Supabase; fix by accessing `userId` inside `setState`'s updater or via a ref, similar to how `checkinsRef` is handled.

**[P0] `appendNoteHistory` has a read-modify-write race condition** — `src/lib/store.js:499–506` — it reads `note_history` then writes the updated array with no transaction or optimistic-lock; two concurrent card edits/deletes will clobber each other's history entries; fix by using a Postgres function/RPC or converting the JSONB column to a proper `note_history` table.

**[P0] `DiagnosticFlow.handleSignUp` completes without passing canvas to `completeOnboarding`** — `src/screens/Onboarding/DiagnosticFlow.jsx:488–504` — `handleAccountDone` calls `completeOnboarding(null, null, { userId })` which only sets `userId` and `onboarded: true` in local state; the canvas stored in Supabase is not reflected in `state.canvas` and the user arrives at `/practices` with an empty canvas until the next page reload triggers `restoreFromSupabase`; fix by passing the recommendation canvas object to `completeOnboarding`.

**[P0] Journal save uses stale `state.userId` in debounce callback** — `src/screens/Today.jsx:296–297` — `saveJournalEntry(state.userId, today, val)` is called 1.5 s after the keystroke; if the component re-renders between keypress and save and `state.userId` was briefly null (auth loading), the journal write is silently dropped; fix by capturing `userId` in a ref at debounce-schedule time rather than reading it at fire time.

**[P0] `reorderNoteDeck` fires parallel writes with no rollback on partial failure** — `src/lib/store.js:530–538` — `Promise.all` issues one Supabase `PATCH` per card; any single failure is logged but not rolled back, leaving the DB in an inconsistent order while the UI shows the new order; fix by wrapping all position updates in a single RPC/transaction or reverting local state on any error.

**[P0] `Debriefs.refresh` called without awaiting and with no error handling** — `src/screens/Debriefs.jsx:136–138` — `refresh()` is called after add/remove/color operations without `await` and with no `.catch`; if Supabase returns an error the list silently stays stale with no feedback to the user; fix by adding `await` and surfacing errors inline.

---

## P1 — Visible bugs, UX friction

**[P1] Streak diverges between Data screen and guidance trigger — `isDayHit` counts survival needs, `isStreakDay` excludes them** — `src/lib/dataStats.js:83–88` and `:118–123` — `isStreakDay` (used for 14-day guidance) correctly filters out survival needs per the spec, but `isDayHit` (used for the streak counter on the Data screen) counts all canvas needs regardless of mode; fix by making `isDayHit` also filter out survival needs so both use the same threshold.

**[P1] `MODE_WEIGHTS` in `constants.js` and `DiagnosticFlow.jsx` represent different quantities but share a name** — `src/lib/constants.js:29` and `src/screens/Onboarding/DiagnosticFlow.jsx:199` — `constants.js` exports equal weights for scoring (all modes 1pt except survival 0.5pt); DiagnosticFlow uses `{ exploration: 3, appreciation: 2, nourishment: 1, survival: 0.5 }` for canvas budget estimation (total daily practices per need); the same name for two different things is a maintenance hazard; rename the DiagnosticFlow constant to `MODE_DAILY_PRACTICES` or similar.

**[P1] `saveProfile` does not update `state.profile.name` in local state** — `src/lib/store.js:393–404` — the function writes `name` to Supabase but only updates `state.profile.smsEnabled` in local state; the user's display name stays stale in memory until the next full restore; fix by including `name` in the returned profile object.

**[P1] `CanvasScreen.handleSave` fires N parallel `updateCanvas` calls — partial save on network error** — `src/screens/CanvasScreen.jsx:205` — `Promise.all(allNeeds.map(need => updateCanvas(...)))` issues one Supabase `PATCH` per need; any single failure rejects the outer promise but already-resolved patches are not rolled back, leaving the DB in a partial state; fix by collecting the full new canvas object and issuing a single `UPDATE users SET canvas = $1`.

**[P1] Debrief list excerpt shows raw JSON string for structured entries** — `src/screens/Debriefs.jsx:224` — `(d.entry || '').slice(0, 80)` is displayed as the episode excerpt; for structured debriefs this renders `{"name_it":"..."}` instead of the actual text; fix by calling `parseDebriefEntry(d.entry, isPeak).sections[0].slice(0, 80)`.

**[P1] `loadMoods` exported from `useAppState` but never passed to any screen** — `src/lib/store.js:407` and `src/App.jsx:46` — moods are never refreshed after the initial session restore; fix by either wiring `loadMoods` to a pull-to-refresh gesture or removing it from the public API.

**[P1] `weekKey()` anchors to Sunday via `d.getDay()`, but the app is Monday-first throughout** — `src/lib/store.js:418–420` — `d.setDate(d.getDate() - d.getDay())` produces a Sunday-anchored week start; Log.jsx, review scheduling, and all UI labels treat Monday as day 0; fix by computing `d.setDate(d.getDate() - ((d.getDay() + 6) % 7))`.

**[P1] `onSaved` callback increments debrief count optimistically with no rollback on save failure** — `src/screens/Today.jsx:329–336` — the `onSaved` prop increments `todayDebriefCount` by 1 unconditionally; if `saveDebrief` returns an error the count is still incremented; fix by passing an error flag from `DebriefForm`/`PeakDebriefForm` back to the callback.

**[P1] `UpdatePassword` submit button is outside the `<form>` — Enter key does not submit** — `src/screens/UpdatePassword.jsx:77–82` — the `<button onClick={handleSubmit}>` is in a footer `div` outside the `<form>` element; pressing Enter in the confirm-password input does nothing; fix by placing the submit button inside the `<form>`.

**[P1] iOS Safari: inputs in `DiagnosticFlow` and `SignIn` have `font-size < 16px` — triggers auto-zoom on focus** — `src/screens/Onboarding/DiagnosticFlow.module.css:329` and `src/screens/SignIn.module.css:10` — iOS Safari auto-zooms any input with `font-size < 16px`; fix by setting inputs to `font-size: 16px` (or add the equivalent viewport meta tag, but the font-size approach is preferred).

**[P1] `noteDeckWrapper` scroll container missing `overscroll-behavior-x: contain`** — `src/screens/Today.module.css:84–92` — the horizontal swipe deck inside the vertically scrolling page will propagate horizontal scroll momentum to the page on iOS Safari, causing accidental page navigation; fix by adding `overscroll-behavior-x: contain` to `.noteDeckWrapper`.

**[P1] `--ink4` CSS variable used throughout but never declared in `:root`** — `src/index.css` — `--ink4` appears as placeholder/empty-text color in `Today.module.css`, `Log.module.css`, `DiagnosticFlow.module.css`, and others but is absent from the `:root` block; browsers render it as transparent; fix by adding `--ink4: #C4C0BA;` (or equivalent) to `:root` in `index.css`.

---

## P2 — Polish, consistency, dead code

**[P2] `saveProfile` exported from `useAppState` but no screen calls it** — `src/lib/store.js:407` and `src/App.jsx:46` — dead exported function; remove from the public API or wire it to a Settings/Profile UI.

**[P2] `loadMoods` exported but never consumed** — `src/lib/store.js:351–355` — same situation as `saveProfile`; remove or wire up.

**[P2] `ALWAYS_MATTERS_TO_NEED` maps both `beauty` and `creativity` to `beauty` — undocumented** — `src/screens/Onboarding/DiagnosticFlow.jsx:128–137` — the duplicate mapping is intentional but surprising; add a comment explaining the consolidation.

**[P2] `HamburgerMenu.handleSignOut` manually clears localStorage — duplicates the `SIGNED_OUT` handler in `store.js`** — `src/components/HamburgerMenu.jsx:31–36` — both paths clear localStorage; remove the manual `localStorage.removeItem` from the menu handler since the auth listener already handles it.

**[P2] `Today.module.css` hardcodes `#E8E4F0` for journal/note surfaces instead of a CSS token** — `src/screens/Today.module.css:67,74` — define `--bg-reflective: #E8E4F0` in `:root` and reference the token throughout so the color can be changed in one place.

**[P2] `Data.module.css` and `index.css` card borders use `1px` instead of the design-spec `0.5px`** — `src/screens/Data.module.css:29` and `src/index.css:157` — align to `border: 0.5px solid var(--border)` used on all other card surfaces.

**[P2] `SignIn.module.css` hardcodes colors instead of CSS tokens** — `src/screens/SignIn.module.css:10–12` — `#D8D8D8`, `#ADADAD`, and `#1A1A1A` should be `var(--border)`, `var(--ink4)`, and `var(--ink)` respectively.

**[P2] `AppHeader` logo circles use `fill="#ffffff"` — invisible on light `--bg2` background** — `src/components/AppHeader.jsx:7–17` — circles other than the first render as white-on-white; set fills to `var(--ink)` or the appropriate design color.

**[P2] `canSave` in `CanvasScreen` requires an exploration or appreciation need — blocks valid survival+nourishment canvases** — `src/screens/CanvasScreen.jsx:142` — a user who deliberately wants only survival and nourishment practices cannot save; consider gating only on "at least one assigned need" rather than requiring a specific mode tier.

**[P2] `completeOnboarding` stores `onboardedAt: todayKey()` only in localStorage — lost on cross-device sign-in** — `src/lib/store.js:362` — the field never reaches Supabase; users signing in on a new device on their onboarding day will see the canvas guidance card incorrectly; fix by persisting `onboarded_at` to the `users` table.

**[P2] `Practices.jsx` uses `sessionStorage` for onboarding CTA flag — resets on tab close** — `src/screens/Practices.jsx:8,15` — the `OB_FLAG` banner re-appears whenever a new tab or PWA cold-start occurs for fully onboarded users; gate on `state.onboarded` or a persistent localStorage flag instead.

**[P2] Debrief list `moodNote` input visible without a mood selection can produce orphaned notes** — `src/screens/Today.jsx:497–505` — if a user types a note then clears their mood selection, `handleNoteBlur` returns early without saving or clearing the input; fix by clearing the note field when mood is deselected.

**[P2] `CanvasScreen` local `MODE_MAX` constant confusingly named — similar to `MODE_MAX_BUBBLES` in `constants.js` but represents different data** — `src/screens/CanvasScreen.jsx:23` — rename the canvas-slot ceiling to `MODE_NEED_LIMIT` to distinguish from the per-need bubble count.

**[P2] `completeOnboarding` in `store.js` comment references `onboardedAt` but the field is not in `migrateState` defaults** — `src/lib/store.js:361–367` — a user loading an older localStorage snapshot will have `onboardedAt: undefined`; add `if (!saved.onboardedAt) saved.onboardedAt = null` to `migrateState`.

---

**P0: 7 | P1: 11 | P2: 14 | Total: 32**
