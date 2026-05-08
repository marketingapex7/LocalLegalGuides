# Deployment Notes

## Cloudflare Pages

Use `dist` as the production output directory. Do not deploy the repository root, because the root contains source files such as `build.mjs`, `server.mjs`, and `site-data.mjs`.

Recommended settings:

- Build command: `node build.mjs`
- Output directory: `dist`
- Environment variable: `SITE_ORIGIN=https://locallegalguides.com`

`SITE_ORIGIN` controls canonical URLs, sitemap URLs, robots.txt, Open Graph URLs, and JSON-LD URLs. Set it before production builds so Google sees the final domain as canonical.

After deployment:

- Verify `https://locallegalguides.com/robots.txt`
- Verify `https://locallegalguides.com/sitemap.xml`
- Confirm a city page canonical points to the final domain
- Submit the sitemap in Google Search Console
