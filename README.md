# AF PFRA Calculator

A fully offline, single-repo GitHub Pages app for computing and optimizing Air Force Physical Fitness Readiness Assessment (PFRA) scores.

## Features

- **Score Calculator** — Enter sex, age, height, waist, and all event options (HR push-ups, standard push-ups, sit-ups, reverse crunches, plank, HAMR, 2-mile run) and get instant scoring
- **WHtR live preview** — Waist-to-height ratio calculates as you type
- **Score breakdown** — Animated bar chart showing contribution of each event
- **Goal Planner** — Automatically targets the next tier (80 → 85 → 90 → 95 → 100) and shows single-event and multi-event combo paths to get there
- **HAMR Explorer** — Slider to see elapsed time, speed, sec/beep, and 2-mile equivalent for any rep count 1–100
- **HAMR Progress Comparison** — Side-by-side comparison of two rep counts with time delta
- **HAMR Rep Table** — Complete 100-rep reference table, filterable by rep or level
- **Print report** — Browser print dialog produces a clean one-page summary

## Deployment (GitHub Pages)

1. Create a new repository (e.g. `af-pfra`)
2. Drop all four files into the root:
   - `index.html`
   - `styles.css`
   - `script.js`
   - `scoreData.js`
3. Go to **Settings → Pages → Source** and set branch to `main`, folder `/` (root)
4. Your app will be live at `https://<username>.github.io/<repo>/`

No build step, no npm, no dependencies. Pure HTML/CSS/JS.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App structure and markup |
| `styles.css` | Dark military-utility theme |
| `script.js` | Scoring engine, goal optimizer, HAMR logic, UI |
| `scoreData.js` | All AF scoring tables + HAMR level data |

## Scoring Notes

- **WHtR** is scored from waist ÷ height (both in same unit). Max 20 pts at WHtR < 0.50.
- **Strength** (HR push-ups or standard push-ups): max 15 pts
- **Core** (sit-ups, reverse crunches, or plank): max 15 pts
- **Cardio** (HAMR or 2-Mile Run): max 50 pts
- **Total max: 100 pts**
- Ratings: Excellent (≥90), Satisfactory (≥75), Marginal (≥70), Unsatisfactory (<70)
