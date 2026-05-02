# Maslow App

Get better at the habit of living.

## Stack
- React 18
- React Router 6
- Vite
- CSS Modules
- Deployed on Vercel

## Local development

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push to GitHub
2. Import repo in Vercel dashboard
3. Framework preset: Vite
4. Deploy

## Project structure

```
src/
  lib/
    constants.js   # Needs, layers, canvas logic
    store.js       # App state (localStorage)
  components/
    Canvas.jsx     # Interactive canvas visualization
  screens/
    Today.jsx      # Daily checklist
    CanvasScreen.jsx  # Canvas view + trade mode
  App.jsx          # Routing + bottom nav
  index.css        # Global design system
```

## Screens

- `/today` — daily checklist, stats, check-in
- `/canvas` — your maslow canvas, mode adjustments
- `/intentions` — weekly intention setting (coming soon)
- `/log` — feeling logger (coming soon)
- `/gallery` — 12-week history (coming soon)
