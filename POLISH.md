# UX Crispness Audit — maslow-app

> Audit based on full source reads conducted 2026-07-01.  
> File references use the path relative to `src/`.

---

## 1. Today

### Perceived performance
- **Finding:** The note deck starts from `state.noteDeck || []` (initialised synchronously), but mood selections, journal entry, debrief counts, and the `noteDeck` itself are all loaded in separate `useEffect` calls that fire after first paint. The mood card and practices card therefore render with complete content immediately (good), but the note-to-self card shows "no notes yet" while `loadNoteDeck` is in-flight if `state.noteDeck` is empty in the store snapshot. This flashes a false empty state. — `screens/Today.jsx:133–157` — Reserve the deck card with a single skeleton line ("—") until the first load completes, or initialise loading state to `null` rather than `[]`.

- **Finding:** `loadDebriefTypes` and `loadDebriefs` both fire independently in two `useEffect` calls that share no loading state. The "anxiety debrief" toggle shows no indicator while types are loading; if the user expands it before types arrive, chips render empty then pop in. — `screens/Today.jsx:380–393` — Co-locate the two debrief loads into one `Promise.all` and gate the toggle's content on a `typesReady` flag.

- **Finding:** The journal `useEffect` loads the entry, then calls a `setTimeout(..., 50)` to set textarea height after the DOM paints. This causes a measurable height jump from the initial `120px` minimum to the actual content height. — `screens/Today.jsx:310–316` — Set height synchronously in a `useLayoutEffect` that fires immediately after the entry is set, rather than deferring 50ms.

### Transitions and motion
- **Finding:** The note-deck manage overlay (`noteOverlay`) slides up with `animation: noteSlideUp 0.25s ease-out` — `screens/Today.module.css:216` — but dismissal has no exit animation at all; the overlay snaps off immediately. Use a CSS class-swap pattern with a matching `slideDown` exit, or wrap removal in a short `setTimeout` after toggling an exit-animation class.

- **Finding:** The lightbox overlay (`lightboxOverlay`) appears and disappears with no transition. — `screens/Today.module.css:179–207` — Add `animation: fadeIn 0.15s ease` on entry; match with an exit.

- **Finding:** The debrief expand chevron transitions with `transition: transform 0.2s ease` — `screens/Today.module.css:699` — while all other micro-interactions in the same file use `0.15s`. Standardise the chevron to `0.15s`.

- **Finding:** The `journalInput` has two transition properties combined: `border-color 0.15s, height 0.1s ease` — `screens/Today.module.css:657`. Animating `height` is a layout property and forces reflow every frame. The JS already manually sets `el.style.height` so the CSS height transition is redundant; remove the `height` part of the transition.

- **Finding:** No `@media (prefers-reduced-motion: reduce)` exists anywhere in the codebase. The `noteSlideUp` animation, all chevron rotations, and the progress-bar width transition will run for users who have opted out of motion. — (no file has this query per the grep) — Add a single global rule in `index.css` that suppresses transitions and animations under reduced-motion preference.

### Spacing rhythm
- **Finding:** `moodSection` has `padding: 12px 24px 16px` (left/right 24px) — `screens/Today.module.css:630` — while the enclosing `.card` already provides 16px left/right padding. The effective left edge of mood content is 40px from the screen edge, inconsistent with every other card's 16px inner padding. Change to `padding: 12px 0 16px` to stay within the card's own padding.

- **Finding:** `noteDeckCard` uses `padding: 13px 14px` — `screens/Today.module.css:101` — where 13px is off the 4-point scale (expected: 12px or 16px). Change to `padding: 12px 14px`.

- **Finding:** `.guidanceBody` margin-bottom is 14px — `screens/Today.module.css:488` — while sibling eyebrow margin-bottom is 8px. In the same card, `.guidanceHeadline` is 8px. 14px is off the scale; use 16px.

- **Finding:** `noteOverlayContent` top padding is `4px` — `screens/Today.module.css:248`. This is too tight and off-scale; use 8px or 0.

### Interactive states
- **Finding:** Practice chips (`.practiceChip`) have an `:active { background: var(--bg2) }` state — `screens/Today.module.css:605` — but `.practiceChipDone` has no `:active` state at all. Tapping a completed chip gives no visual feedback. Add `:active { opacity: 0.8 }` to `.practiceChipDone`.

- **Finding:** Mood buttons (`.moodBtn`) have no `:active` state and no `:hover` state. On mobile these feel unresponsive. — `screens/Today.module.css:635` — Add `:active { opacity: 0.75 }`.

- **Finding:** `.notePencilBtn`, `.journalTimestampBtn`, and `.debriefToggle` all have only `:hover` states — `screens/Today.module.css:175,627,697`. On touch devices hover never fires; none of these have `:active`. Add `:active { opacity: 0.7 }` to each.

- **Finding:** The `×` delete button in the lightbox (`.lightboxClose`) has a 4px padding — `screens/Today.module.css:205` — giving an effective tap target of roughly 30×30px. Needs `padding: 12px` to reach 44px.

- **Finding:** The DebriefForm's `save` button is styled as a small pill (`padding: 8px 18px; align-self: flex-start`) — `components/DebriefForm.module.css:46–57`. This is the only primary action in the form but does not look primary, and its tap area is well under 44px vertically. Give it full-width primary button treatment consistent with other save buttons.

### Empty and edge states
- **Finding:** When the note deck is empty, the card shows the static text "no notes yet" alongside the manage button — `screens/Today.jsx:516`. There is no prompt to add a first note. Change copy to "no notes yet — tap manage to add one" or make the empty area itself tappable to open the deck manager.

- **Finding:** When a need has no practices set, the card shows `No practices set — add some in Practices` — `screens/Today.jsx:614` — with a capital "N" on "No". All other empty strings in the app are sentence-case without a capital mid-sentence. Lowercase to "no practices set".

### Copy consistency
- **Finding:** `"No practices yet."` — `screens/Practices.jsx:65` — uses Title-cap "No" and ends with a period. The analogous empty message in Today is `"no notes yet"` (all lowercase, no period) and in Log is `"no data yet"` (lowercase). Standardise to lowercase, no period.

- **Finding:** `"Max 10 practices reached."` — `screens/Practices.jsx:82` — uses Title-caps. All comparable status messages elsewhere are lowercase. Change to `"max 10 practices reached"`.

- **Finding:** The Practices screen's onboarding button has conditional copy: `"i'm done adding practices →"` vs `"start my day →"` — `screens/Practices.jsx:111–112`. The apostrophe in `i'm` is a typographic straight quote. Ensure the apostrophe is a curly right-single quote `'` if the font renders it.

### Touch ergonomics
- **Finding:** `.deckListDelete` has `padding: 0 2px` — `screens/Today.module.css:353` — giving a tap target of approximately 20×20px. Needs `padding: 10px` minimum on all sides.

- **Finding:** The `×` close on `noteOverlayClose` has `padding: 0` — `screens/Today.module.css:244`. This puts a tiny 18px text character as the only interactive close control on the full-screen overlay. Needs `padding: 12px; margin: -12px` to keep visual size while expanding the hit area.

- **Finding:** `viewFullLogToggle` in Log has `padding: 4px 0 16px` — `screens/Log.module.css:183`. The 4px top is too thin; the effective tap height is ~20px for the visible text. Raise to `padding: 12px 0 16px`.

---

## 2. Canvas (CanvasScreen)

### Transitions and motion
- **Finding:** The mode dropdown (`.modeDropdown`) opens with no transition — `screens/CanvasScreen.module.css:355–366`. It appears and disappears instantly. Add `animation: fadeIn 0.12s ease` consistent with other overlays.

- **Finding:** `.modePill:hover { opacity: 0.75 }` and `.poolSelChip:hover { opacity: 0.7 }` exist — `screens/CanvasScreen.module.css:219,273` — but neither has an `:active` state for touch. These are the primary interaction chips; mobile users get no feedback at all. Add `:active { opacity: 0.6 }`.

- **Finding:** `transition: border-color 0.3s` on `.tile` in `index.css:180` is a legacy rule with a different duration (0.3s) than the screen's own chips (0.15s). Audit whether `.tile` is still used on this screen; if not, the rule is dead weight.

### Spacing rhythm
- **Finding:** `.addOwnSection` uses `margin-top: 20px` — `screens/CanvasScreen.module.css:418` — while all mode cards use `margin-bottom: 10px`. The spacing before the "add your own" section therefore doubles. Use `margin-top: 10px` or rely on the previous card's margin-bottom alone.

- **Finding:** `.modeCardHead` has `margin-bottom: 6px` — `screens/CanvasScreen.module.css:101` — which is off the 4-point scale. Use 8px.

- **Finding:** `.needRow` has `padding: 9px 0` — `screens/CanvasScreen.module.css:136`. 9px is off-scale. Use 8px or 10px.

### Interactive states
- **Finding:** The `titleInfoBtn` is 14×14px — `screens/CanvasScreen.module.css:11–28`. This is well below the 44px minimum tap target. It has no hover or active state. The `i` information button needs a minimum 44×44px tap area achieved via negative-margin or a larger invisible hit area.

- **Finding:** `.addRow` (the "+ add a need to [mode]" row) is a `div`, not a `button`. It uses `cursor: pointer` and an `onClick` — `screens/CanvasScreen.jsx:328–336`. Div click handlers receive no keyboard focus, no Enter activation, and no `:active` state. Convert to a `<button>`.

- **Finding:** `.saveBtn:active { opacity: 0.75; transform: scale(0.98) }` exists — `screens/CanvasScreen.module.css:78`. This is the only button in the codebase using `transform: scale()` on active. The scale causes subtle layout shift. Use `opacity` only for consistency.

### Empty and edge states
- **Finding:** The `appreciation` mode empty-note text is extremely long (83 words) — `screens/CanvasScreen.jsx:289`. On a narrow mobile screen this creates a dense paragraph inside a card. Truncate to the key message: "no needs in appreciation yet. that's ok — appreciation is about real presence, not just checking boxes."

### Touch ergonomics
- **Finding:** `.removeBtn` (the × next to a need) has `padding: 0` — `screens/CanvasScreen.module.css:175`. Effective tap area is ~18×24px. Needs `padding: 8px`.

- **Finding:** Mode pill buttons in the dropdown (`.dropdownOption`) have `padding: 10px 14px` — `screens/CanvasScreen.module.css:374`. At 10px padding with a single line of text, total height is roughly 34px — under the 44px minimum. Raise to `padding: 13px 14px`.

---

## 3. Practices

### Transitions and motion
- **Finding:** `.addInput` has `transition: border-color 0.15s` and `.addBtn` has `transition: background 0.1s` — `screens/Practices.module.css:34,37`. Two different durations (0.15s vs 0.1s) on elements that appear side-by-side. Standardise both to 0.15s.

### Spacing rhythm
- **Finding:** `.pool` uses `gap: 2px` — `screens/Practices.module.css:20`. This is off the 4-point scale and makes practice items nearly touch each other. The visual breathing room comes from `padding: 8px 0` on `.poolItem`. The `gap: 2px` is redundant (flex column with bordered items); remove it entirely.

### Interactive states
- **Finding:** `.editToggle` ("edit" / "done" button) has no `:active` state — `screens/Practices.module.css:5–6`. Add `:active { opacity: 0.7 }`.

- **Finding:** `.deleteBtn` (the × remove button per practice) has `padding: 0 4px` — `screens/Practices.module.css:25`. The effective tap area is approximately 26×28px, below the 44px minimum. Change to `padding: 8px` and absorb the visual position with `margin: -8px`.

- **Finding:** `.addToggle` ("+ add practice") has `padding: 4px 0 0` — `screens/Practices.module.css:30`. Effective height is about 20px. This is a common action; raise to `padding: 12px 0 4px`.

- **Finding:** The `Add` button in Practices uses Title-case — `screens/Practices.jsx:93` — while the equivalent button in all other screens (`CanvasScreen`, `Debriefs`, `DiagnosticFlow`) uses lowercase `add`. Normalise to lowercase.

### Empty and edge states
- **Finding:** When a need group has 0 practices and the user is not in edit mode, only `"No practices yet."` and the `"+ add practice"` button appear. The `"+ add practice"` button auto-opens the input correctly, but there is no visual affordance that the empty state is itself actionable (it does not look like a button). Make the entire empty area visually suggest interaction.

### Copy consistency
- **Finding:** `"New practice…"` (input placeholder) — `screens/Practices.jsx:86` — uses Title-cap. Every other placeholder in the app is lowercase (`"add a type…"`, `"name a need…"`, `"add your thoughts for the day…"`). Change to `"new practice…"`.

---

## 4. Data

### Perceived performance
- **Finding:** `loadDebriefs` fires in a `useEffect` — `screens/Data.jsx:383–386` — but the Debriefs tab content renders immediately with the stale `debriefs: []` initial state. If the user quickly switches to the Debriefs tab, the stats cards and episode list flash empty then repopulate. Add a local `debriefLoading` boolean and show a brief loading placeholder (or simply the same empty state without implying it's final) while the load is in progress.

- **Finding:** The modeBarFill animates `width: 0.5s ease` — `screens/Data.module.css:248`. This animation fires on first render (bars animate in from zero), which is a useful perceived-performance trick. However the `0.5s` duration is inconsistent with the rest of the motion scale (everything else is 0.15–0.4s). Accept 0.4s to align with the progress-bar convention.

### Transitions and motion
- **Finding:** The tab buttons use `transition: all 0.15s` — `screens/Data.module.css:70`. `transition: all` includes every CSS property and is expensive; replace with `transition: color 0.15s, border-color 0.15s`.

- **Finding:** The range toggle buttons also use `transition: all 0.15s` — `screens/Data.module.css:42`. Same issue; replace with explicit properties.

- **Finding:** The need-row chevron uses `transition: transform 0.15s ease` — `screens/Data.module.css:494`. There is no `:active` state on the row that reveals the chevron. The row (`.needRow`) has `-webkit-tap-highlight-color: transparent` but no active/pressed visual. Add `:active { opacity: 0.7 }` to `.needRow`.

### Spacing rhythm
- **Finding:** Data screen top padding is `24px 20px 40px` — `screens/Data.module.css:6`. All other screens use `16px` horizontal padding. This 20px horizontal padding is inconsistent with the 16px norm. Align to 16px.

- **Finding:** `.moodLegend` has `margin-bottom: 10px` — `screens/Data.module.css:289`. Its siblings (`.card` elements) have `margin-bottom: 10px` already. The legend therefore gets the same rhythm as a card, which is fine, but its `gap: 16px` between legend items is the widest gap on this screen. Consider 12px to match the `moodBarRow gap: 12px`.

### Interactive states
- **Finding:** The two `infoBtn` circles (14×14px) are below the 44px minimum tap target — `screens/Data.module.css:143–159`. Same pattern as `titleInfoBtn` on Canvas. Needs a larger invisible hit area.

### Copy consistency
- **Finding:** The tab labels in the view toggle are Title-case: "Overview", "Practices", "Mood", "Debriefs" — `screens/Data.jsx:402–405`. The CSS applies `text-transform: uppercase` — `screens/Data.module.css:64`. These render as "OVERVIEW", "PRACTICES", etc. The eyebrow labels throughout the rest of the app are also uppercase mono. This is visually consistent, but the source strings mixing Title-case with the CSS transform creates confusion in code. Source strings should be lowercase to match the intent: `"overview"`, `"practices"`, etc.

---

## 5. Weekly Review (Log)

### Perceived performance
- **Finding:** `startReview()` is async and fires `Promise.all` for journals, debriefs, and debrief types. During this load `reviewStep` jumps to `1` immediately, rendering day cards with `weekJournals = {}`. Every expanded day card for the week will show no journal content until the load completes. The cards do not show a loading indicator in this context (`loading={false}` is hardcoded at `screens/Log.jsx:518`). Users expanding a card see silently missing journal text. Pass the loading state or start from step `0` until data is ready.

- **Finding:** `reviewHistory` is loaded on mount from Supabase — `screens/Log.jsx:417–422`. On first render, `reviewHistory = []`, so the component renders "no reviews yet" regardless of actual history. There is no distinction between "loading" and "truly empty". Add a `historyLoading` state to defer the empty message until load completes.

### Transitions and motion
- **Finding:** `reviewProgressFill` transitions `width: 0.4s ease` — `screens/Log.module.css:236`. Steps advance by replacing the entire screen content (conditional return at each step), so the progress bar does animate correctly across step changes. This is the intended use.

- **Finding:** The step screen (`ReviewStepShell`) replaces its entire content on each step with no entry animation. The transition from step 1 to step 2 is an instant DOM swap, making the multi-step flow feel abrupt. A subtle `fadeIn` (150ms) on `.reviewContent` per step would unify the experience with the slide-up overlays elsewhere.

- **Finding:** The `viewFullLogToggle` toggle text changes from "+ view full log" to "− hide full log" with no transition — `screens/Log.jsx:654`. The `FullLogAccordion` itself appears with no animation. A short `fadeIn` on the list would reduce jarring.

### Spacing rhythm
- **Finding:** `.reviewContent` padding is `24px 16px 8px` — `screens/Log.module.css:238` — while the default screen `.content` is `0 16px 32px`. The inconsistent top padding (24px vs 20px used in other headers) is intentional for step content clearance but should be documented.

- **Finding:** `.reviewHistoryLabel` has `margin: 8px 0 10px` — `screens/Log.module.css:195`. The `8px` top is off the 4-point scale relative to `margin-bottom: 10px`. Use `margin: 8px 0 8px` or `12px 0 10px`.

### Interactive states
- **Finding:** `weeklyMoodCard` has `:active` via `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation` but no explicit `:active` style — `screens/Log.module.css:433–443`. Tapping a mood card gives no visual pressed state. Add `:active { background: var(--bg3) }`.

- **Finding:** `dayCard` has `-webkit-tap-highlight-color: transparent` but no `:active` style — `screens/Log.module.css:317–325`. These are the primary tappable items in the review flow. Add `:active { background: var(--bg2) }`.

- **Finding:** `reviewBackBtn` has only `:hover` — `screens/Log.module.css:253`. Add `:active { opacity: 0.6 }`.

- **Finding:** `startReviewBtnPrimary` and `startReviewBtnSecondary` both lack `:active` styles — `screens/Log.module.css:150–175`. Add `:active { opacity: 0.8 }` to both.

### Empty and edge states
- **Finding:** When no data exists yet (no checkins, no moods), `FullLogAccordion` renders "no data yet — start checking in on the today screen." — `screens/Log.jsx:371`. This is a clear, actionable empty state. However there is no tap/link on "today screen". Make "today screen" a navigable link to `/today`.

- **Finding:** The `completeBanner` ("review complete. see you monday.") disappears after 3 seconds via `setTimeout` — `screens/Log.jsx:485`. This is a flash of confirmation; the user has no way to re-see it. Consider persisting the banner for the remainder of the day, or showing the `reviewHistory` row with a ✓ as the persistent confirmation.

---

## 6. Debriefs

### Perceived performance
- **Finding:** `debriefs` and `debriefTypes` both start as empty arrays (`[]`) — `screens/Debriefs.jsx:122–123`. The episode card renders with "your first debrief will appear here." on first render while `refresh()` is in-flight. If the user has debriefs, this creates a flash of the empty state before content arrives. Add a `loading` state to show nothing (or a subtle "…") until `refresh()` resolves.

### Transitions and motion
- **Finding:** The detail overlay (`DetailOverlay`) appears via the same `slideUp 0.25s ease-out` as `noteSlideUp` in Today — `screens/Debriefs.module.css:149`. This is correct. However dismissal (`setDetail(null)`) is instant. The overlay disappears without any exit animation. Mirror the exit.

- **Finding:** The choose-type overlay uses the same `slideUp` — `screens/Debriefs.module.css:149`. Transitioning from "choose type" to the form overlay involves replacing one `slideUp` div with another; this causes a brief transparent flash while the first unmounts and the second mounts. Keeping both in the tree and using CSS opacity/transform to switch between them would eliminate the flash.

### Spacing rhythm
- **Finding:** The `.card` (episode list container) uses `padding: 4px 16px` — `screens/Debriefs.module.css:66`. The top padding of 4px is off the 4-point scale and visually too tight above the first `monthLabel`. Use `padding: 0 16px` and give `.monthLabel` its own top padding (which it already has: `padding: 14px 0 8px`).

- **Finding:** `.envNote` uses `margin: -4px 0 10px` — `screens/Debriefs.module.css:113`. Negative margin is a spacing smell; typically indicates the parent's spacing was miscalculated. Remove the negative margin and adjust the parent `addRow` bottom padding instead.

### Interactive states
- **Finding:** The color swatch buttons (`.swatch`) are 22×22px — `screens/Debriefs.module.css:103`. Far below 44px. Needs `width: 36px; height: 36px` minimum, or arrange them with enough gap that adjacent targets are not ambiguous.

- **Finding:** Episode rows (`.episodeRow`) use `-webkit-tap-highlight-color: transparent` but have no `:active` — `screens/Debriefs.module.css:70`. Add `:active { background: var(--bg3) }`.

- **Finding:** The `typeAction` buttons ("color", "remove") have `padding: 0` — `screens/Debriefs.module.css:98`. These are inline text-sized buttons with ~14px height. Add `padding: 6px 0` minimum.

### Empty and edge states
- **Finding:** When `filteredDebriefs.length === 0` but `debriefs.length > 0`, the card shows "no debriefs match this filter." — `screens/Debriefs.jsx:220`. There is no affordance to clear the filter. Add a "clear filter" link or auto-show the active filter pill as dismissible.

### Copy consistency
- **Finding:** The `newBtn` label reads `"→ new debrief"` — `screens/Debriefs.jsx:195`. The arrow comes before the label here, while all other navigation CTAs in the app place the arrow after the label (`"save note →"`, `"start my day →"`). Move the arrow to the right: `"new debrief →"`.

---

## 7. Settings

### Interactive states
- **Finding:** The day-of-week buttons (`.dayBtn`) have no `:active` state — `screens/Settings.module.css:66–79`. Add `:active { opacity: 0.75 }`.

- **Finding:** The toggle switch (`toggleSwitch`) is a `div` with an `onClick`. It correctly suppresses the tap highlight — `screens/Settings.module.css:24` — but has no `:active` style and no `role="switch"` or `aria-checked` for screen readers. Add `role="switch"` to the wrapping div and `aria-checked={state.showNoteToSelf}`.

- **Finding:** The `timeInput` (native `<input type="time">`) has `outline: none` but no `:focus` visual style — `screens/Settings.module.css:81–92`. On devices that show an inline time picker, this is fine, but on desktop focus is invisible. Add `:focus { border-color: var(--ink2) }`.

### Spacing rhythm
- **Finding:** `.sectionEyebrow` has `margin: 4px 0 10px` — `screens/Settings.module.css:47`. The 4px top margin is off-scale. Use `margin: 12px 0 10px` to match the eyebrow label rhythm used in other screens.

### Copy consistency
- **Finding:** Settings labels use lowercase mono for everything ("note to self", "day", "time") consistently with the app's lowercase convention. Good.

---

## 8. Onboarding (DiagnosticFlow)

### Transitions and motion
- **Finding:** Step-to-step navigation (e.g. step 1 → step 2) is implemented as a conditional return at each step value — `screens/Onboarding/DiagnosticFlow.jsx:809–1143`. Each step replaces the entire DOM instantly with no transition. The progress bar's width animates (`transition: width 0.4s ease` — `screens/Onboarding/DiagnosticFlow.module.css:4`), but the content below it pops. Add a per-step `fadeIn` on `.content` so the content change is perceivable as a flow.

- **Finding:** The toggle thumb (`toggleThumb`) uses `transition: transform 0.15s ease` — `screens/Onboarding/DiagnosticFlow.module.css:373`. The toggle track uses `transition: background 0.15s ease` — line 361. These are correctly matched. Good.

- **Finding:** No `prefers-reduced-motion` anywhere in the codebase; the progress bar transition and all step-entry animations (if added) must be gated behind this media query.

### Spacing rhythm
- **Finding:** `howItWorksCard` has `padding: 12px 14px 4px` — `screens/Onboarding/DiagnosticFlow.module.css:384`. The bottom 4px is off-scale; the `howItWorksRow` items each have `padding: 8px 0` and their own border-top, so this is likely intentional visual tightening. Still, 4px is off the grid. Use 8px or 0 and rely on the last row's padding-bottom.

- **Finding:** `modeCard` in the canvas reveal screen has `padding: 10px 16px 4px` — `screens/Onboarding/DiagnosticFlow.module.css:118`. The 4px bottom is the same off-grid issue. Use 8px.

### Interactive states
- **Finding:** Option cards (`.optionCard`) have `touch-action: manipulation` and `user-select: none` — good. But they have no `:active` state beyond the browser default. Add `:active { background: var(--bg3) }` for unselected cards so the tap registers visually even before selection state propagates.

- **Finding:** The `addChip` (add a need to a mode) is a `div` with `onClick` — `screens/Onboarding/DiagnosticFlow.jsx:1117`. Same concern as in CanvasScreen's `addRow`. Convert to `<button>`.

- **Finding:** The `removeBtn` in the canvas reveal has `padding: 0 2px` — `screens/Onboarding/DiagnosticFlow.module.css:142`. Tap target ~20×22px. Needs `padding: 8px`.

### Empty and edge states
- **Finding:** On the canvas reveal screen (step 8), if `addableNeeds.length === 0` (all needs are assigned), the "add a need" section disappears with no indication. First-time users may not realise they've assigned everything. Show a brief "all needs are on the canvas" line.

### Copy consistency
- **Finding:** The canvas reveal screen footer has two buttons: `"this feels right →"` and `"i want to adjust this"` — `screens/Onboarding/DiagnosticFlow.jsx:1129–1138`. The latter has no trailing `→` and is phrased as a sentence fragment. Either both should have arrows, or neither should. Propose: `"looks good →"` / `"adjust my canvas"`.

- **Finding:** `UpdatePassword` uses Title-case for labels ("New password", "Confirm new password") and button text ("Update password →", "Updating…") — `screens/UpdatePassword.jsx:49–79`. The rest of the app uses lowercase for everything. This screen imports `styles from './Onboarding.module.css'` and is routed inside the protected app. Change to lowercase to match the app convention.

---

## 9. Auth (SignIn, UpdatePassword)

### Perceived performance
- **Finding:** The global auth loading spinner in `App.jsx` is "loading..." in lowercase mono — `App.jsx:52`. On fast connections this text flashes for under 200ms. No minimum display time is enforced, so the flash is jarring. Consider deferring the render with a `useEffect`-based 200ms debounce before showing any loading indicator.

### Transitions and motion
- **Finding:** The SignIn form mounts with no entry animation. Navigation from the onboarding flow to `/signin` is abrupt. Even a simple `fadeIn 0.2s` on the `.screen` would smooth the transition.

- **Finding:** SignIn uses `transition: border-color 0.15s` on inputs — `screens/SignIn.module.css:10`. This is consistent with the rest of the app.

### Interactive states
- **Finding:** `.secondaryLink` items (magic link, forgot password) are `div` elements — `screens/SignIn.jsx:109–122`. They have `onClick` handlers but are not focusable and cannot be activated by keyboard. Convert to `<button>` with `type="button"`.

- **Finding:** The "← back to start" button has `padding: 0` — `screens/SignIn.module.css:41`. Effective tap area is the text line height only (~18px). Add `padding: 12px 0`.

- **Finding:** The "send a magic link" and "forgot password?" actions have no disabled or loading state while the async Supabase call completes. A user can tap rapidly and trigger multiple OTP sends. Add `loading` state to disable these during the pending call.

### Copy consistency
- **Finding:** `UpdatePassword` error messages use Title-case sentences with a period: `"Password must be at least 8 characters."`, `"Passwords do not match."` — `screens/UpdatePassword.jsx:18–21`. All other error messages in the app are lowercase, no period (e.g., `"save failed — please try again"`, `"select a nature and environment to save."`). Standardise to lowercase: `"password must be at least 8 characters"`.

- **Finding:** `UpdatePassword` button text is `"Update password →"` (Title-case verb) — `screens/UpdatePassword.jsx:79`. SignIn button is `"sign in →"` (lowercase). Standardise to lowercase: `"update password →"`.

---

## 10. Overlays

### Manage Deck Overlay (Today)

#### Transitions and motion
- Already noted: entry has `slideUp 0.25s`; exit has no animation. — `screens/Today.module.css:216–221`.

#### Interactive states
- **Finding:** The "WRITE YOUR OWN" / "FROM THE LIBRARY" / "FROM YOUR HISTORY" / "IMAGE" section labels are styled only — `screens/Today.module.css:251–258`. Not interactive. Good.

- **Finding:** Library cards (`.noteCard`) and history cards (`.noteHistoryCard`) have `:hover` states — `screens/Today.module.css:298,371` — but no `:active`. Add `:active { background: var(--bg3) }`.

- **Finding:** The `composerAddImageBtn` has `padding: 8px 14px` — `screens/Today.module.css:405` — which gives roughly 36px height. Close to but under 44px minimum. Raise to `padding: 12px 14px`.

#### Spacing rhythm
- **Finding:** `noteOverlayFooter` has `padding: 12px 20px 32px` — `screens/Today.module.css:425`. The horizontal 20px diverges from the 16px used in the main screen. Use 16px.

### Debrief Forms (DebriefForm, PeakDebriefForm)

#### Interactive states
- **Finding:** The `saveBtn` has `transition: opacity 0.15s` and renders as a small pill — `components/DebriefForm.module.css:46–58`. When the required fields are unset, it uses inline `style={{ opacity: 0.4 }}` to appear disabled — `screens/Today.jsx:167` — but `disabled` attribute is not set, so the button remains focusable and activatable by Enter. Set the actual `disabled` attribute: `disabled={!nature || !environment}`.

- **Finding:** Debrief chips (`.chip`) have `transition: background 0.1s, color 0.1s, border-color 0.1s` and `:hover { border-color: var(--ink3) }` but no `:active` state — `components/DebriefForm.module.css:11`. Add `:active { opacity: 0.75 }`.

#### Empty and edge states
- **Finding:** The DebriefForm renders all four step fields immediately regardless of whether the nature/environment has been selected. Visually, the form is "ready" before the required tags are set. The `statusDot` turning red is the only gating indicator. Consider keeping the step textareas collapsed until nature and environment are both selected, reducing the form's cognitive weight.

### HamburgerMenu

#### Transitions and motion
- **Finding:** The panel slides in from the right with no animation — `components/HamburgerMenu.module.css`. The overlay darkens the background instantly. Add `animation: slideInRight 0.25s ease-out` on `.panel` (using `transform: translateX(100%)` → `translateX(0)`). Match with an exit animation.

- **Finding:** No `:hover` or `:active` states on `.navItem`, `.secondaryItem`, or `.signOut` beyond the color change for `.navItemActive`. Add `:active { opacity: 0.7 }` to `.navItem` and `.secondaryItem`.

#### Interactive states
- **Finding:** The `AppHeader` hamburger button (`.menuBtn`) has `padding: 4px` — `components/AppHeader.module.css`. Three 1.5px tall bars with 5px gap total approximately 15px of interactive height. The 4px padding gives ~23px total. Well below 44px. Raise `padding` to `12px 4px` and adjust the header alignment accordingly.

- **Finding:** `.navItem` items in the menu have `padding: 12px 0` — `components/HamburgerMenu.module.css`. At `font-size: 12px` the total height is roughly 30px, under the 44px minimum. Raise to `padding: 14px 0`.

#### Copy consistency
- **Finding:** Nav labels in `HamburgerMenu` use Title-case: "Today", "Canvas", "Practices", "Data", "Weekly Review", "Debriefs" — `components/HamburgerMenu.jsx:19–25`. Secondary links also use Title-case: "Update password", "Notifications", "Settings", "Privacy policy", "Terms of service", "Sign out". The main app's bottom-nav labels use lowercase (`nav-item-label` in `index.css`). The HamburgerMenu mixes "Update password" (lower second word) with "Sign out" (lower second word) with "Privacy policy" (lower second word), which is actually sentence-case, not Title-case. This is inconsistent with itself. Adopt a single rule across both menus: recommend lowercase matching the app tone: "today", "canvas", etc.

---

## Reference Tables

### Proposed Motion Scale

| Use case | Duration | Easing | Property |
|---|---|---|---|
| Micro-interaction (chip select, button feedback) | 100ms | ease | opacity, background |
| Focus / hover state transition | 150ms | ease | border-color, color, opacity |
| UI element toggle (chevron rotate, toggle thumb) | 150ms | ease | transform |
| Dropdown / tooltip appear | 150ms | ease-out | opacity (+ transform translateY -4px → 0) |
| Overlay / sheet slide in | 250ms | ease-out | transform translateY(100%) → 0 |
| Overlay / sheet slide out | 200ms | ease-in | transform translateY(0) → translateY(100%) |
| Progress bar fill | 400ms | ease | width |
| Data bar fill (on mount) | 400ms | ease | width |
| Step / screen content change | 150ms | ease | opacity |

All of these should be wrapped in:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```
(Place in `index.css`.)

---

### Proposed Spacing Scale

| Token | Value | Currently used for |
|---|---|---|
| `--space-1` | 4px | bubble gaps, dot gaps, `--gap`, minor eyebrow gap |
| `--space-2` | 8px | chip row gaps, tag gaps, card inner hairlines |
| `--space-3` | 10px | card margin-bottom (primary stack rhythm), mode-bar gaps |
| `--space-4` | 12px | card inner padding top/bottom (small), deck row padding |
| `--space-5` | 14px | card inner padding top/bottom (standard), mode-separator margin |
| `--space-6` | 16px | card inner padding left/right, screen edge padding, section spacing |
| `--space-7` | 20px | screen header padding top, overlay header padding |
| `--space-8` | 24px | content area padding top (review steps, data screen), section top spacing |
| `--space-9` | 32px | screen bottom padding |
| `--space-10` | 40px | canvas scroll bottom padding, data screen bottom padding |

**Off-scale values found and proposed fixes:**

| Current value | Location | Fix |
|---|---|---|
| 2px gap | `Practices.module.css:20` (.pool) | Remove (redundant with border) |
| 4px noteOverlayContent top padding | `Today.module.css:248` | → 8px |
| 4px sectionEyebrow margin-top | `Settings.module.css:47` | → 12px |
| 4px sectionEyebrow margin-top | `Debriefs.module.css:87` | → 12px |
| 5px chipRow gap | `Today.module.css:603` | → 4px or 6px |
| 5px dayCardTags gap | `Log.module.css:374` | → 4px or 6px |
| 6px modeSeparator bottom | `Today.module.css:539` | → 8px |
| 7px modeCardHead gap | `CanvasScreen.module.css:107` | → 8px |
| 9px needRow padding | `CanvasScreen.module.css:136` | → 8px or 10px |
| 13px noteDeckCard padding-top | `Today.module.css:101` | → 12px |
| 14px guidanceBody margin-bottom | `Today.module.css:488` | → 16px |
| 18px margin-bottom in reviewBackBtn | `Log.module.css:250` | → 16px or 20px |
| 20px addOwnSection margin-top | `CanvasScreen.module.css:418` | → 16px |
| 24px Data screen horizontal padding | `Data.module.css:6` | → 16px |
| -4px envNote negative margin | `Debriefs.module.css:113` | → 0 (fix parent) |
