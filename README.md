# Local Legal Guides

Static legal guide site generator for city-based DUI/DWI and personal injury pages.

## Stack

- Static HTML/CSS/JS
- Build script: `node build.mjs`
- Local preview: `node server.mjs`
- Production output: `dist/`

## Commands

```bash
npm run build
npm run serve
```

## Deployment

Recommended host: Cloudflare Pages

- Build command: `node build.mjs`
- Output directory: `dist`
- Environment variable: `SITE_ORIGIN=https://locallegalguides.com`

See `DEPLOYMENT.md` for the deployment checklist.

## Project structure

- `site-data.mjs`: source data for regions, cities, legal basics, and sponsor package scaffolding
- `build.mjs`: static site generator
- `server.mjs`: local preview server for `dist`
- `styles.css`: shared site styles
- `app.js`: small client-side enhancements only
- `LOCAL_DATA_RULES.md`: sourcing and safety rules for hyper-local DUI data
- `dist/`: generated production site

## Hyper-local DUI data

City records can include optional `dui_local_data` for historical public enforcement data, local roads, campaign results, crash context, and jurisdiction notes.

Rules:

- Use official, public, historical sources.
- Do not publish upcoming checkpoint locations, expected checkpoint times, patrol locations, or avoidance advice.
- Do not name private individuals from routine arrest records.
- Label city, county, and state data clearly so the page does not imply statewide data is city-specific.

See `LOCAL_DATA_RULES.md` before adding new DUI local-data fields.

## Sponsorship model

- One exclusive sponsor package per cluster/region
- Cluster page acts as the primary sponsorship sales page
- Related city pages inherit a matching regional sponsor package block
- Sponsor placements must remain clearly labeled advertising and separate from official legal/government resource content

## Sponsor data scaffold

Regional sponsor package records live in `site-data.mjs` under `sponsorPackages`.

Current fields:

- `status`
- `annualPriceUsd`
- `termLabel`
- `coverageLabel`
- `sponsor`

Recommended future sponsor fields inside `sponsor`:

- `firmName`
- `attorneyName`
- `phone`
- `ctaUrl`
- `officeAddress`
- `serviceArea`
- `shortBio`
- `photoUrl`
- `disclaimer`

## Tracking hooks

Sponsor CTAs already emit lightweight browser events through `app.js`.

Supported integrations:

- `window.dataLayer`
- `window.gtag`
- `window.plausible`
- custom browser event: `locallegalguides:tracking`

Current event patterns:

- `cluster_sponsor_claim_click`
- `cluster_sponsor_contact_click`
- `cluster_sponsor_cta_click`
- `cluster_sponsor_call_click`
- `city_sponsor_claim_click`
- `city_sponsor_contact_click`
- `city_sponsor_cta_click`
- `city_sponsor_call_click`

## Verification

- Pages render with a visible last-verified date
- Structured data includes `dateModified`
- `robots.txt`, `sitemap.xml`, and canonicals are generated into `dist`

## Lastmod manifest

`lastmod-manifest.json` stores a content hash and last-modified date per route. The build:

- keeps a page's stored date when its rendered HTML is unchanged
- bumps the date to the build date when content changes or a page is new
- writes real `<lastmod>` values into both sitemaps and per-page schema `dateModified`

Commit manifest changes together with content changes. If the manifest is missing (fresh clone without the file), all dates reset to that build's date.

## 404 handling

The build emits `dist/404.html`. Cloudflare Pages serves it with a real 404 status for unknown URLs. Without this file, Pages falls back to SPA mode and serves the homepage with HTTP 200 for every unknown path (soft-404s).
