# Meridian

A public weather instrument: search any city, or use the browser’s location, and read current conditions plus a 7-day forecast. Powered by [Open-Meteo](https://open-meteo.com/) — no API key, no account.

**Live:** [https://vinybrun.github.io/meridian-weather/](https://vinybrun.github.io/meridian-weather/)

## Features

- Search by city name with live suggestions
- Optional “Use my location” geolocation
- Current temperature, description, humidity, wind, and feels-like
- °C / °F toggle (also converts wind to mph)
- Next 24 hours and a 7-day outlook
- Weather-tinted atmosphere, loading and error states, invalid-city handling
- Shareable city links via `?q=Lisbon`
- Last place and unit preference stay in this browser

## Run locally

Requires Node.js 20+.

```bash
cd meridian
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Checks:

```bash
npm test
npm run lint
```

Production build:

```bash
npm run build
npm run preview
```

Preview serves `dist/` at `http://127.0.0.1:4173`.

## Deploy

This is a static Vite app. Build output is `dist/`.

### GitHub Pages

The repo includes `.github/workflows/pages.yml`. Push `main` to GitHub, then:

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. The live site is `https://<user>.github.io/meridian-weather/`

`vite.config.ts` uses `base: './'`, so the same build works at a domain root or in a GitHub Pages subdirectory.

```bash
# from the meridian folder
git init
git add .
git commit -m "Ship Meridian weather app"
gh repo create meridian-weather --public --source=. --remote=origin --push
gh api --method POST /repos/<user>/meridian-weather/pages -f build_type=workflow
```

### Vercel

```bash
npx vercel --prod
```

Or import the `meridian` folder in the Vercel dashboard. `vercel.json` already points at `npm run build` and `dist`.

### Netlify

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

Or connect the repo; `netlify.toml` already sets the build command and publish directory.

### Cloudflare Pages

Build command `npm run build`, output directory `dist`.

## APIs

| Use | Endpoint | Key |
| --- | --- | --- |
| City search | `https://geocoding-api.open-meteo.com/v1/search` | none |
| Forecast | `https://api.open-meteo.com/v1/forecast` | none |
| Reverse geocode (optional, for “Use my location” place names) | `https://api.bigdatacloud.net/data/reverse-geocode-client` | none |

If reverse geocoding fails, the app still loads weather and labels the pin “Your location”.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and production bundle |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | Oxlint |
| `npm test` | Formatter and weather-mapping checks |

## Remaining risks

- Open-Meteo and BigDataCloud are third-party, CORS-open, rate-limited services. Forecast requests retry twice on HTTP 429/503; a longer outage or stricter CORS still surfaces as the in-app error state.
- Browser geolocation requires HTTPS (or localhost) and an explicit user grant.
- Geocoding can miss small hamlets or ambiguous names; the invalid-city state covers that.
- Hourly and daily times are interpreted from Open-Meteo’s local ISO strings for the place timezone, not the viewer’s clock.
