# MyMaslow — iOS app via Capacitor

The repo is Capacitor-ready. The PWA pipeline (Vite → Vercel → app.mymaslow.com) is
untouched; the iOS shell bundles the same build. All native code paths no-op on web.

Already in the repo: `capacitor.config.json` (app id `com.mymaslow.app`),
`src/lib/native.js` (haptics on check-in, splash hide, daily mood + weekly review
local notifications), package.json deps and `ios:sync` / `ios:open` scripts.

## One-time setup (your machine)

1. **Apple Developer Program** — enroll at developer.apple.com ($99/yr). Needed for
   TestFlight and the App Store. Xcode from the Mac App Store if not installed.

2. **Install deps and generate the iOS project:**
   ```
   npm install
   npm run build
   npx cap add ios
   npx cap sync ios
   ```

3. **App icon + splash** (generates every required size from one source image):
   ```
   mkdir -p assets
   cp public/AppStore-1024.png assets/icon.png
   npx capacitor-assets generate --ios
   ```

4. **Open and sign:**
   ```
   npm run ios:open
   ```
   In Xcode: select the App target → Signing & Capabilities → set your Team.
   Plug in your iPhone, select it as the run target, hit ▶. That's the app on
   your phone.

## Each release to testers

```
npm run ios:sync        # rebuild web assets + copy into the shell
```
Then in Xcode: Product → Archive → Distribute App → App Store Connect → Upload.
The build appears in App Store Connect → TestFlight within ~15–30 min.

- **Internal testing**: add yourself + up to 100 users (App Store Connect users) —
  available as soon as processing finishes, no review.
- **External testing**: create a group, enable the public link, submit for Beta App
  Review (usually 1–2 days, much lighter than full review). Up to 10,000 testers,
  builds live 90 days, feedback + crashes flow back to App Store Connect.

## Notes

- **Auth**: password sign-in works as-is in the shell. Magic links redirect to
  app.mymaslow.com (the PWA) — fine for beta; add universal links later if you
  want them to open the native app.
- **Guideline 4.2 (minimum functionality)**: the local notifications and haptics
  are the answer — mention them in the review notes when you eventually submit.
- **Live updates**: each web release requires a new TestFlight build. If that gets
  tedious during beta, look at Capgo/Appflow for over-the-air web-layer updates.
- `ios/App/Pods/` is git-ignored; the rest of `ios/` should be committed once
  generated.
