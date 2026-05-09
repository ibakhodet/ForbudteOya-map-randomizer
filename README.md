# Handoff: Den Forbudte Øya — Map Randomizer

## Overview
A small, mobile-first single-page web app for the board game *Den Forbudte Øya* (Forbidden Island). The user opens it on their phone and taps a button to draw a random map layout from a 24-card deck. While "shuffling," the card back animates and a wav clip plays; then the chosen map is revealed.

Designed as a static site to be hosted (e.g. GitHub Pages, Netlify, Cloudflare Pages, any static host).

## About the Design Files
The files in this bundle are **a working HTML prototype** — not production code to copy verbatim, but very close. The shuffle logic, animations, randomness rules, and asset pipeline are all implemented and battle-tested in the prototype. The task for the dev is to **recreate (or directly host) this design in the target environment**, choosing whatever framework fits best (or just shipping the HTML/JSX as-is — it's already self-contained).

If you just want to deploy: drop the whole folder on a static host. The entry point is `Forbudte øya - randomizer.html`.

## Fidelity
**High-fidelity.** Final colors, typography, asset compression, animation timings, sound timing and randomness logic are all locked in. Recreate pixel-perfectly.

## Screens / Views
There is one screen.

### Draw screen
- **Purpose**: User taps "Trekk tilfeldig kart" → shuffle animation + sound (~1.25 s) → reveals a random map card.
- **Layout** (mobile-first, single column, full viewport height):
  - `header.topbar` — brand row (compass icon + kicker "Map randomizer" + h1 "Den Forbudte Øya")
  - `main.stage` — flex-centered card stack (max-width 420 px, aspect ratio 657/916)
  - `footer.actions` — primary button + loading meta when assets aren't yet preloaded
- **Card stack**: three decorative `.stack-layer` divs behind the main `.card-frame`, only visible during shuffle (rotated/translated to fan out). The `.card-frame` holds either the back, the revealed card, or an empty/ready state.

## Interactions & Behavior

### Draw flow
1. User taps the primary button.
2. App picks a random card from a "feels-random" pool (see logic below).
3. **Immediately** mounts a hidden `<img>` for the chosen card so the browser decodes it during the shuffle (avoids a blank flash on reveal). Also kicks off `img.decode()`.
4. Sets phase = `shuffling`. The card-back is shown with a fast riffle/jitter animation (`backRiffle 0.14s alternate` + `backFlicker 0.09s steps(2)` + a per-mount random CSS filter on the back so each "card" looks slightly different).
5. Plays `shuffle.wav` (preloaded `Audio` object, volume 0.85).
6. After both `decode()` resolves AND a `setTimeout(1250 ms)` fires, sets phase = `revealing`, swaps to the chosen card with a `cardReveal 0.65s` keyframe (translateY + rotate + scale + brightness ramp).
7. After 650 ms more, returns to phase = `idle`.

### "Feels random" logic
Pure RNG repeats too often. Hold back the most-recently-drawn cards:
- `holdBack = clamp(floor(N / 3), 2, 8)` where N = deck size (so 8 with 24 cards)
- Pool excludes the last `holdBack` draws from `history`
- Fall back to full deck if pool empties
- History capped at last 12 entries

### Preload gate
Button is disabled and shows `Laster bilder… X%` until **all 24 card images + the back** have either loaded or errored. `ready` flag flips true only when all 25 are accounted for.

### Card-back idle vs flicker
- **Idle** (before first draw / between draws while idle): no animation. Just the back image with a small per-mount random filter.
- **Flicker** (during shuffle): two stacked animations + the random filter, plus the parent `.card-frame` does a 0.10 s `cardJitter`.

## State Management
React state in `app.jsx`:
- `currentIdx: number | null` — currently revealed card index
- `history: number[]` — last 12 draws, used by the "feels random" logic
- `phase: "idle" | "shuffling" | "revealing"`
- `pendingIdx: number | null` — chosen card mounted hidden during shuffle for pre-decode
- `loaded: number`, `totalToLoad: number` — asset preload progress
- Refs: `shuffleTimers` (cleanup), `audioRef` (preloaded `Audio`)

## Design Tokens

### Colors (from the HTML `:root`)
- Pub-table dark wood background (CSS var `--bg`-ish, see HTML)
- Gold accent `#c89544` for compass + meta dot
- Teal `--teal` / `--teal-deep` for secondary surfaces
- Ink-soft `--ink-soft` for muted text
- Card frame uses `#1a1208` background once a card is shown

### Typography
- Display headings: a serif/display family (see HTML — pinned via Google Fonts in `<head>`)
- Body / kicker: small caps for "Map randomizer" kicker
- Sizes are all in the inline `<style>` — copy verbatim

### Spacing / Radii / Shadows
- Card aspect ratio: **657 / 916** (matches the source PNGs)
- Card stack max-width: 420 px
- Primary button min-height 56 px
- All shadows/radii inline in the `<style>` block — copy from there

## Assets

### Images (`/cards/`, all webp w/ transparency, ~70 KB each, 540 px wide)
- `01_Forbidden_Island.webp` … `24_Walk_the_Plank.webp` — 24 map tile cards
- `_back.webp` — the card back

Source PNGs were ~1.2 MB each (29 MB total). Compressed to webp at q=0.85 with `clearRect` to preserve alpha. Names + display names live in `cards.js`.

### Audio
- `shuffle.wav` — ~1.8 s shuffle sound, played at start of shuffle phase. Preloaded into a single `Audio` object on mount.

## Files
- `Forbudte øya - randomizer.html` — entry point. Contains all CSS in inline `<style>`, loads React + Babel + `cards.js` + `app.jsx` via script tags.
- `app.jsx` — the React app (Babel-transpiled in browser). Single file; defines `App`, `DrawView`, `CardDisplay`, `CardBack`, etc.
- `cards.js` — declares `window.CARD_BACK` (string) and `window.CARDS` (array of `{ name, file }`).
- `cards/` — all map tile webps + the card back.
- `shuffle.wav` — shuffle sound effect.

## Deploying
This is a fully static site. To deploy:

1. Upload the entire folder to any static host (Netlify drop, GitHub Pages, Cloudflare Pages, S3, etc.). No build step required.
2. The HTML uses pinned `unpkg.com` script tags for React 18.3.1 + Babel standalone — these need internet access at runtime. If you want full offline / no-CDN: bundle React with esbuild/Vite and pre-compile the JSX to JS, then drop the Babel CDN script.
3. Test on iPhone Safari — the user's primary target.

### Caching gotcha
When you replace `_back.webp` or any card image, iPhone Safari caches aggressively. Bump a query string (`cards/_back.webp?v=2`) in `cards.js` or use a build step that hashes filenames.

## Recommended next steps for the dev
- Strip out Babel-in-browser; pre-compile to plain JS for faster cold loads on mobile.
- Consider service-worker caching for true offline use at the table.
- Add a swipe-to-redraw gesture (currently button only).
