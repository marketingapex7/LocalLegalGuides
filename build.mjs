import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { siteData } from "./site-data.mjs";

const root = process.cwd();
const outputRoot = path.join(root, "dist");
// Placeholder injected into rendered HTML, resolved to a real date after
// content hashing so dateModified never feeds back into its own hash.
const PAGE_LASTMOD_PLACEHOLDER = "__PAGE_LASTMOD__";
const lastmodManifestPath = path.join(root, "lastmod-manifest.json");
const practiceBySlug = new Map(siteData.practiceAreas.map((p) => [p.slug, p]));
const googleAnalyticsId = "G-VLQC2KYC9E";
const brandIconPath = "/favicon.svg";
const brandLogoPath = "/logo.svg";
const brandSocialImagePath = "/og-image.png";
const sampleSponsorImagePath = "/sample-sponsor-attorney.svg";
const launchPackageLabel = "$1,000/year launch package";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dui/", label: "DUI" },
  { href: "/personal-injury/", label: "Personal Injury" },
  { href: "/regions/", label: "Regions" },
  { href: "/contact/", label: "Contact" },
];

const siteOrigin = normalizeSiteOrigin(process.env.SITE_ORIGIN ?? "https://locallegalguides.com");

function normalizeSiteOrigin(value) {
  const url = new URL(value);
  return url.origin;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replaceAll("</", "<\\/");
}

function absoluteUrl(route) {
  return `${siteOrigin}${route}`;
}

function brandAssetUrl(route) {
  return absoluteUrl(route);
}

function formatDisplayDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function sponsorPackageHref(region) {
  return `/clusters/${region.slug}/#regional-sponsor`;
}

function clusterHref(region) {
  return `/clusters/${region.slug}/`;
}

function sponsorPackage(region) {
  const configured = siteData.sponsorPackages?.[region.slug] ?? {};
  const sponsor = configured.sponsor ?? {};
  return {
    status: configured.status ?? "available",
    termLabel: configured.termLabel ?? "12-month exclusive package",
    coverageLabel:
      configured.coverageLabel ??
      `${region.cities.length} city pages for one selected practice area`,
    sponsor,
  };
}

function guideCount(region) {
  return region.cities.length * practicesForRegion(region).length;
}

function cityGuideCountForPractice(region) {
  return region.cities.length;
}

function articleFor(word) {
  return /^[aeiou]/i.test(String(word ?? "").trim()) ? "an" : "a";
}

function listPhrase(items) {
  const values = items.filter(Boolean).map(String);
  if (values.length <= 1) {
    return values[0] ?? "";
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function sampleSponsorCard() {
  return `<aside class="sample-sponsor-card" aria-label="Sample sponsor placement">
    <img class="sample-sponsor-image" src="${sampleSponsorImagePath}" alt="Sample attorney sponsor headshot placeholder" loading="lazy" decoding="async" width="120" height="120" />
    <p class="eyebrow">Sample placement</p>
    <div class="sample-sponsor-badge">Featured Local Sponsor</div>
    <h3>Smith Law Firm</h3>
    <p class="sample-sponsor-focus">DUI Defense in Madison County</p>
    <p><strong>Call:</strong> (618) XXX-XXXX</p>
    <a class="button button-primary" href="/sponsorships/">Visit Website</a>
    <p class="sponsor-note">Attorney Advertising</p>
    <p class="sample-sponsor-caption">This is a sample placement. Sponsor information appears on the regional page and related city guides for the selected practice area.</p>
  </aside>`;
}

function metricsGrid(items, className = "metric-grid") {
  return `<div class="${className}">${items
    .map((item) => `<div class="metric-card"><span>${escapeHtml(item[0])}</span><strong>${escapeHtml(item[1])}</strong></div>`)
    .join("")}</div>`;
}

function activeSponsor(packageInfo) {
  if (packageInfo.status !== "sponsored") {
    return null;
  }

  const sponsor = packageInfo.sponsor ?? {};
  return sponsor.firmName && sponsor.ctaUrl ? sponsor : null;
}

function trackingAttrs(eventName, payload) {
  const attrs = [
    `data-track="true"`,
    `data-track-event="${escapeHtml(eventName)}"`,
    `data-track-payload="${escapeHtml(JSON.stringify(payload))}"`,
  ];
  return attrs.join(" ");
}

function sponsorIdentityBlock(sponsor) {
  const photo = sponsor.photoUrl
    ? `<img class="sponsor-photo" src="${escapeHtml(sponsor.photoUrl)}" alt="${escapeHtml(
        sponsor.attorneyName || sponsor.firmName
      )}" loading="lazy" />`
    : `<div class="sponsor-avatar">${escapeHtml((sponsor.firmName || "LL").slice(0, 2).toUpperCase())}</div>`;

  return `<div class="sponsor-identity">
    ${photo}
    <div>
      <p class="sponsor-kicker">Featured attorney</p>
      <h3>${escapeHtml(sponsor.firmName)}</h3>
      ${sponsor.attorneyName ? `<p class="sponsor-name">${escapeHtml(sponsor.attorneyName)}</p>` : ""}
      ${sponsor.serviceArea ? `<p class="sponsor-service-area">${escapeHtml(sponsor.serviceArea)}</p>` : ""}
    </div>
  </div>`;
}

function sponsorProfileCard(region, packageInfo, placement = "cluster") {
  const sponsor = activeSponsor(packageInfo);
  const eventBase = placement === "cluster" ? "cluster_sponsor" : "city_sponsor";
  const isPreview = packageInfo.status === "preview";

  if (sponsor) {
    return `<aside class="sponsor-panel sponsor-panel-strong">
      <p class="eyebrow">${isPreview ? "Sponsor Preview" : "Attorney Advertising"}</p>
      ${sponsorIdentityBlock(sponsor)}
      ${sponsor.shortBio ? `<p>${escapeHtml(sponsor.shortBio)}</p>` : ""}
      <ul class="sponsor-list">
        ${sponsor.officeAddress ? `<li>${escapeHtml(sponsor.officeAddress)}</li>` : ""}
        ${sponsor.phone ? `<li>${escapeHtml(sponsor.phone)}</li>` : ""}
        <li>${escapeHtml(packageInfo.termLabel)}.</li>
        <li>${escapeHtml(packageInfo.coverageLabel)}</li>
      </ul>
      <p class="sponsor-note">${escapeHtml(sponsor.disclaimer || "Attorney Advertising. Sponsorship does not imply endorsement.")}</p>
      <div class="hero-actions">
        <a class="button button-primary" href="${escapeHtml(sponsor.ctaUrl)}" ${trackingAttrs(`${eventBase}_cta_click`, {
          region: region.slug,
          placement,
          firm: sponsor.firmName,
          status: packageInfo.status,
        })}>Visit sponsor</a>
        ${
          sponsor.phone
            ? `<a class="button button-secondary" href="tel:${escapeHtml(sponsor.phone.replace(/[^\d+]/g, ""))}" ${trackingAttrs(
                `${eventBase}_call_click`,
                {
                  region: region.slug,
                  placement,
                  firm: sponsor.firmName,
                  status: packageInfo.status,
                }
              )}>Call ${escapeHtml(sponsor.phone)}</a>`
            : ""
        }
      </div>
    </aside>`;
  }

  return `<aside class="sponsor-panel sponsor-panel-strong">
    <p class="eyebrow">Sponsored attorney</p>
    <h2>${placement === "cluster" ? "Practice-area packages across this cluster." : `This page is part of the ${escapeHtml(
      region.name
    )} practice-area sponsor package.`}</h2>
    <p>This regional sponsorship inventory is currently available by practice area. A featured sponsor appears on the ${escapeHtml(
      region.name
    )} cluster page and the related city pages for the selected practice area with clear advertising disclosure.</p>
    <ul class="sponsor-list">
      <li>${escapeHtml(packageInfo.termLabel)}.</li>
      <li>${escapeHtml(launchPackageLabel)} for founding sponsors.</li>
      <li>${escapeHtml(packageInfo.coverageLabel)}</li>
      <li>${escapeHtml(practiceInventoryPhrase(region))} sponsor inventory is enabled for this region.</li>
    </ul>
    <p class="sponsor-note">Attorney Advertising. Any future sponsor placement will remain separate from official legal and government resource information.</p>
    <div class="hero-actions">
      <a class="button button-primary" href="/sponsorships/" ${trackingAttrs(`${eventBase}_claim_click`, {
        region: region.slug,
        placement,
        status: packageInfo.status,
      })}>Claim a Sponsorship</a>
      <a class="button button-secondary" href="/contact/" ${trackingAttrs(`${eventBase}_contact_click`, {
        region: region.slug,
        placement,
        status: packageInfo.status,
      })}>Ask about availability</a>
    </div>
  </aside>`;
}

function citySponsorNotice(city, region, packageInfo, practice) {
  const sponsor = activeSponsor(packageInfo);
  const isDui = practice?.slug === "dui";
  const practiceLabel = isDui ? practiceSeoLabel(practice, region) : practice?.label ?? "selected practice area";

  if (sponsor) {
    return `<aside class="sponsor-panel sponsor-panel-strong">
      <p class="eyebrow">Featured ${escapeHtml(practiceLabel)} Sponsor</p>
      ${sponsorIdentityBlock(sponsor)}
      <p>${escapeHtml(sponsor.serviceArea || `${practiceLabel} help for ${region.name} cases.`)}</p>
      <div class="hero-actions">
        <a class="button button-primary" href="${escapeHtml(sponsor.ctaUrl)}" ${trackingAttrs("city_sponsor_cta_click", {
          region: region.slug,
          city: city.slug,
          practice: practice?.slug ?? "",
          placement: "city",
          firm: sponsor.firmName,
          status: packageInfo.status,
        })}>Visit sponsor</a>
        <a class="button button-secondary" href="${sponsorPackageHref(region)}">View regional package</a>
      </div>
      <p class="sponsor-note">${escapeHtml(sponsor.disclaimer || "Attorney Advertising. Sponsorship does not imply endorsement.")}</p>
      <p class="sponsor-note">Official court, police, records, and public-agency information on this page remains separate from advertising.</p>
    </aside>`;
  }

  return "";
}

function sponsorInquiryForm({ defaultRegion = "", title = "Sponsor inquiry", intro = "Share the market you want and the best way to reach you." }) {
  const regionOptions = siteData.regions
    .map((region) => `<option value="${escapeHtml(region.slug)}"${region.slug === defaultRegion ? " selected" : ""}>${escapeHtml(region.name)}</option>`)
    .join("");

  return `<section class="section section-alt" id="sponsor-inquiry">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Sponsor inquiry</p>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(intro)}</p>
        </div>
      </div>
      <div>
        <form class="inquiry-form" data-sponsor-form="true" data-track="true" data-track-event="sponsor_form_submit" data-track-payload='{"context":"sponsor_inquiry"}'>
          <label>
            <span>Name</span>
            <input name="name" type="text" required />
          </label>
          <label>
            <span>Email</span>
            <input name="email" type="email" required />
          </label>
          <label>
            <span>Firm</span>
            <input name="firm" type="text" />
          </label>
          <label>
            <span>Phone</span>
            <input name="phone" type="tel" />
          </label>
          <label>
            <span>Cluster</span>
            <select name="regionSlug" required>
              <option value="">Select a cluster</option>
              ${regionOptions}
            </select>
          </label>
          <label class="full-width">
            <span>Notes</span>
            <textarea name="notes" rows="5" placeholder="Tell us which package you want, what practice area matters most, and your preferred launch timing."></textarea>
          </label>
          <input type="hidden" name="targetEmail" value="${escapeHtml(siteData.sponsorsEmail)}" />
          <button class="button button-primary" type="submit">Claim a Sponsorship</button>
          <p class="form-note">Prefer email? Contact <a class="text-link" href="mailto:${escapeHtml(siteData.sponsorsEmail)}">${escapeHtml(siteData.sponsorsEmail)}</a>.</p>
          <p class="form-note">This opens a prefilled email draft so the inquiry works on a static site without a backend.</p>
        </form>
      </div>
    </div>
  </section>`;
}

function publisherSchema() {
  return {
    "@type": "Organization",
    name: siteData.siteName,
    alternateName: "LocalLegalGuides",
    url: siteOrigin,
    email: `mailto:${siteData.legalEmail}`,
    logo: {
      "@type": "ImageObject",
      url: brandAssetUrl(brandLogoPath),
      width: 512,
      height: 512,
    },
    image: brandAssetUrl(brandSocialImagePath),
  };
}

function webSiteSchema({ description } = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteData.siteName,
    alternateName: "LocalLegalGuides",
    url: siteOrigin,
    description: description ?? siteData.siteDescription,
    publisher: publisherSchema(),
  };
}

function compactDescription(value) {
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (clean.length <= 158) {
    return clean;
  }

  const clipped = clean.slice(0, 155);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 120 ? lastSpace : clipped.length).trim()}...`;
}

function pathForPracticeCity(practiceSlug, citySlug) {
  return `/${practiceSlug}/${citySlug}/`;
}

function practiceSeoLabel(practice, region) {
  if (practice.slug === "dui" && region?.stateCode && region.stateCode !== "IL") {
    return "DWI";
  }
  return practice.label;
}

function practiceInventoryPhrase(region) {
  const practices = practicesForRegion(region).map((practice) =>
    practice.slug === "dui" ? "DUI/DWI" : practice.label
  );
  return listPhrase(practices);
}

function practicesForRegion(region) {
  const enabled = region?.practiceSlugs;
  if (!Array.isArray(enabled) || !enabled.length) {
    return siteData.practiceAreas;
  }
  return enabled.map((slug) => practiceBySlug.get(slug)).filter(Boolean);
}

function regionHasPractice(region, practiceSlug) {
  return practicesForRegion(region).some((practice) => practice.slug === practiceSlug);
}

function duiPractice() {
  return practiceBySlug.get("dui");
}

function countyHubsList() {
  return siteData.countyHubs ?? [];
}

function countyHubHref(hub) {
  return `/${hub.practiceSlug}/${hub.slug}/`;
}

function countyHubRegions(hub) {
  return hub.regionSlugs.map((slug) => siteData.regions.find((region) => region.slug === slug)).filter(Boolean);
}

function countyHubForCity(practiceSlug, citySlug) {
  return countyHubsList().find(
    (hub) =>
      hub.practiceSlug === practiceSlug &&
      countyHubRegions(hub).some((region) => region.cities.some((city) => city.slug === citySlug))
  );
}

function duiCityEntries() {
  const practice = duiPractice();
  return siteData.regions.flatMap((region) =>
    region.cities.map((city) => ({
      city,
      region,
      label: practiceSeoLabel(practice, region),
      href: pathForPracticeCity("dui", city.slug),
    }))
  );
}

function personalInjuryPractice() {
  return practiceBySlug.get("personal-injury");
}

function personalInjuryCityEntries() {
  const practice = personalInjuryPractice();
  return siteData.regions.flatMap((region) =>
    regionHasPractice(region, "personal-injury")
      ? region.cities.map((city) => ({
          city,
          region,
          label: practice.label,
          href: pathForPracticeCity("personal-injury", city.slug),
        }))
      : []
  );
}

function duiCityLink(entry, className = "city-link") {
  return `<a class="${className}" href="${entry.href}">${escapeHtml(entry.city.name)}, ${escapeHtml(
    entry.region.stateCode
  )} ${escapeHtml(entry.label)} guide</a>`;
}

function personalInjuryCityLink(entry, className = "city-link") {
  return `<a class="${className}" href="${entry.href}">${escapeHtml(entry.city.name)}, ${escapeHtml(
    entry.region.stateCode
  )} car accident and injury guide</a>`;
}

const priorityDuiCitySlugs = [
  "apex-nc",
  "concord-nc",
  "durham-nc",
  "chapel-hill-nc",
  "wentzville-mo",
  "st-charles-mo",
  "lake-saint-louis-mo",
  "st-peters-mo",
  "north-raleigh-nc",
  "knightdale-nc",
  "rolesville-nc",
  "wake-forest-nc",
  "belleville-il",
  "ofallon-mo",
  "moscow-mills-mo",
  "nixa-mo",
  "manchester-mo",
  "cary-nc",
  "pineville-nc",
  "edwardsville-il",
];

const priorityPersonalInjuryCitySlugs = [
  "apex-nc",
  "cary-nc",
  "holly-springs-nc",
  "fuquay-varina-nc",
  "edwardsville-il",
  "collinsville-il",
  "belleville-il",
  "manchester-mo",
  "chesterfield-mo",
  "ofallon-mo",
];

function priorityDuiEntries() {
  const entries = duiCityEntries();
  const bySlug = new Map(entries.map((entry) => [entry.city.slug, entry]));
  return priorityDuiCitySlugs.map((slug) => bySlug.get(slug)).filter(Boolean);
}

function priorityPersonalInjuryEntries() {
  const entries = personalInjuryCityEntries();
  const bySlug = new Map(entries.map((entry) => [entry.city.slug, entry]));
  return priorityPersonalInjuryCitySlugs.map((slug) => bySlug.get(slug)).filter(Boolean);
}

function priorityDuiGuideLinks(className = "related-card compact-related-card") {
  return priorityDuiEntries()
    .map((entry) => duiCityLink(entry, className))
    .join("");
}

function priorityPersonalInjuryGuideLinks(className = "related-card compact-related-card") {
  return priorityPersonalInjuryEntries()
    .map((entry) => personalInjuryCityLink(entry, className))
    .join("");
}

function groupedDuiLocationSections({ compact = false } = {}) {
  const states = new Map();

  for (const entry of duiCityEntries()) {
    if (!states.has(entry.region.state)) {
      states.set(entry.region.state, []);
    }
    states.get(entry.region.state).push(entry);
  }

  return [...states.entries()]
    .map(([state, entries]) => {
      const regions = new Map();
      for (const entry of entries) {
        if (!regions.has(entry.region.slug)) {
          regions.set(entry.region.slug, { region: entry.region, entries: [] });
        }
        regions.get(entry.region.slug).entries.push(entry);
      }

      return `<section class="${compact ? "state-location-block compact-state-block" : "state-location-block"}">
        <div class="section-head section-head-compact">
          <p class="eyebrow">${escapeHtml(state)}</p>
          <h2>${escapeHtml(state)} DUI/DWI city guides.</h2>
        </div>
        <div class="stack-grid">${[...regions.values()]
          .map(
            ({ region, entries: regionEntries }) => `<article class="region-block">
              <div class="region-block-head">
                <p class="eyebrow">${escapeHtml(region.stateCode)}</p>
                <h3><a class="text-link" href="${clusterHref(region)}">${escapeHtml(region.name)} DWI guides</a></h3>
              </div>
              <div class="city-link-grid">${regionEntries.map((entry) => duiCityLink(entry)).join("")}</div>
            </article>`
          )
          .join("")}</div>
      </section>`;
    })
    .join("");
}

function groupedPersonalInjuryLocationSections({ compact = false } = {}) {
  const states = new Map();

  for (const entry of personalInjuryCityEntries()) {
    if (!states.has(entry.region.state)) {
      states.set(entry.region.state, []);
    }
    states.get(entry.region.state).push(entry);
  }

  return [...states.entries()]
    .map(([state, entries]) => {
      const regions = new Map();
      for (const entry of entries) {
        if (!regions.has(entry.region.slug)) {
          regions.set(entry.region.slug, { region: entry.region, entries: [] });
        }
        regions.get(entry.region.slug).entries.push(entry);
      }

      return `<section class="${compact ? "state-location-block compact-state-block" : "state-location-block"}">
        <div class="section-head section-head-compact">
          <p class="eyebrow">${escapeHtml(state)}</p>
          <h2>${escapeHtml(state)} car accident and injury city guides.</h2>
        </div>
        <div class="stack-grid">${[...regions.values()]
          .map(
            ({ region, entries: regionEntries }) => `<article class="region-block">
              <div class="region-block-head">
                <p class="eyebrow">${escapeHtml(region.stateCode)}</p>
                <h3><a class="text-link" href="${clusterHref(region)}">${escapeHtml(region.name)} legal guides</a></h3>
              </div>
              <div class="city-link-grid">${regionEntries.map((entry) => personalInjuryCityLink(entry)).join("")}</div>
            </article>`
          )
          .join("")}</div>
      </section>`;
    })
    .join("");
}

function recentDuiGuideLinks(limit = 18) {
  const priority = new Set(priorityDuiCitySlugs);
  return [...priorityDuiEntries(), ...duiCityEntries().filter((entry) => !priority.has(entry.city.slug))]
    .slice(0, limit)
    .map((entry) => duiCityLink(entry, "related-card compact-related-card"))
    .join("");
}

function recentPersonalInjuryGuideLinks(limit = 18) {
  const priority = new Set(priorityPersonalInjuryCitySlugs);
  return [
    ...priorityPersonalInjuryEntries(),
    ...personalInjuryCityEntries().filter((entry) => !priority.has(entry.city.slug)),
  ]
    .slice(0, limit)
    .map((entry) => personalInjuryCityLink(entry, "related-card compact-related-card"))
    .join("");
}

function countyLabelForCity(city, region, practice) {
  const court = courtForCity(city, region, practice);
  const match = (court?.name ?? "").match(/^(?:Eastern |Western |Northern |Southern )?(.*?\bCounty\b)/);
  return match ? match[1].trim() : null;
}

const licensePhraseByState = {
  MO: "Missouri DOR license deadlines",
  IL: "Illinois Secretary of State license issues",
  NC: "NCDMV license consequences",
};

function cityPageTitle(city, region, practice) {
  if (practice.slug === "dui") {
    const label = practiceSeoLabel(practice, region);
    const targetedTitles = {
      "apex-nc": `Apex DWI Guide: Misdemeanor, Dismissal, Probation & License Issues | ${siteData.siteName}`,
      "fuquay-varina-nc": `Fuquay-Varina DWI Guide: Court, License Checklist & Next Steps | ${siteData.siteName}`,
      "holly-springs-nc": `Holly Springs DWI Guide: Rights, Court & License Questions | ${siteData.siteName}`,
      "wentzville-mo": `Wentzville DWI Guide: Court, Traffic Charges & License Hearing | ${siteData.siteName}`,
      "north-raleigh-nc": `North Raleigh DWI Guide: Raleigh Police, Wake County Court & License Issues | ${siteData.siteName}`,
      "cary-nc": `Cary DWI Guide: Lawyer Questions, Court & License Issues | ${siteData.siteName}`,
      "ofallon-mo": `O'Fallon DWI Guide: Lawyer Questions, Court & License Deadlines | ${siteData.siteName}`,
      "belleville-il": `Belleville DUI Guide: Charges, St. Clair County Court & License Issues | ${siteData.siteName}`,
      "edwardsville-il": `Edwardsville DUI Guide: Arrest, Court, License Suspension & Next Steps | ${siteData.siteName}`,
      "manchester-mo": `Manchester DWI Guide: DUI Attorney Searches, Court & License Issues | ${siteData.siteName}`,
      "nixa-mo": `Nixa DWI Guide: Administrative Hearing, Court & License Deadlines | ${siteData.siteName}`,
      "st-charles-mo": `St. Charles DWI Guide: Lawyer Questions, Court & License Hearing | ${siteData.siteName}`,
      "lake-saint-louis-mo": `Lake Saint Louis DWI Guide: Court, Police Records & License Issues | ${siteData.siteName}`,
      "st-peters-mo": `St. Peters DWI Guide: Court, License & Police Records | ${siteData.siteName}`,
      "moscow-mills-mo": `Moscow Mills DWI Guide: Attorney Questions & License Hearing | ${siteData.siteName}`,
      "knightdale-nc": `Knightdale DWI Guide: Lawyer Questions, Police Records & License Issues | ${siteData.siteName}`,
      "rolesville-nc": `Rolesville DWI Guide: Police Records, Wake County Court & License Issues | ${siteData.siteName}`,
      "wake-forest-nc": `Wake Forest DWI Guide: Traffic Enforcement, Court & License Issues | ${siteData.siteName}`,
      "concord-nc": `Concord DWI Guide: Court, Police Records & License Issues | ${siteData.siteName}`,
      "kannapolis-nc": `Kannapolis DWI Guide: Court, Police Records & License Issues | ${siteData.siteName}`,
      "harrisburg-nc": `Harrisburg DWI Guide: Sheriff Records, Court & License Issues | ${siteData.siteName}`,
      "mount-pleasant-nc": `Mount Pleasant DWI Guide: Sheriff Records, Court & License Issues | ${siteData.siteName}`,
      "midland-nc": `Midland DWI Guide: Sheriff Records, Court & License Questions | ${siteData.siteName}`,
      "durham-nc": `Durham DWI Guide: Court, Police Records & License Issues | ${siteData.siteName}`,
      "chapel-hill-nc": `Chapel Hill DWI Guide: Court, Police Records & License Issues | ${siteData.siteName}`,
      "carrboro-nc": `Carrboro DWI Guide: Court, Police Records & License Issues | ${siteData.siteName}`,
      "hillsborough-nc": `Hillsborough DWI Guide: Court, Police Records & License Issues | ${siteData.siteName}`,
    };

    if (targetedTitles[city.slug]) {
      return targetedTitles[city.slug];
    }

    const county = countyLabelForCity(city, region, practice);
    const courtPhrase = county ? `${county} Court` : "Local Court";
    const detailedTitle = `${city.name} ${label} Guide: ${courtPhrase}, Lawyer & License`;
    return detailedTitle.length <= 70
      ? detailedTitle
      : `${city.name} ${label} Guide: Lawyer, Court & License`;
  }

  const targetedPiTitles = {
    "apex-nc": `Apex Car Accident and Personal Injury Guide: Reports, Insurance & Deadlines | ${siteData.siteName}`,
    "cary-nc": `Cary Car Accident and Personal Injury Guide: Reports, Insurance & Deadlines | ${siteData.siteName}`,
    "holly-springs-nc": `Holly Springs Car Accident and Personal Injury Guide: Reports & Insurance | ${siteData.siteName}`,
    "fuquay-varina-nc": `Fuquay-Varina Car Accident and Personal Injury Guide | ${siteData.siteName}`,
    "edwardsville-il": `Edwardsville Personal Injury Guide: Accident Reports, Insurance & Deadlines | ${siteData.siteName}`,
    "collinsville-il": `Collinsville Car Accident and Personal Injury Guide: Reports & Claims | ${siteData.siteName}`,
    "manchester-mo": `Manchester Car Accident and Personal Injury Guide: Reports & Insurance | ${siteData.siteName}`,
  };

  if (targetedPiTitles[city.slug]) {
    return targetedPiTitles[city.slug];
  }

  return `${city.name}, ${region.stateCode} Car Accident and Personal Injury Guide | ${siteData.siteName}`;
}

function cityPageDescription(city, region, practice) {
  const court = courtForCity(city, region, practice);
  if (practice.slug === "dui") {
    const label = practiceSeoLabel(practice, region);
    const targetedDescriptions = {
      "nixa-mo":
        "Nixa DWI guide covering Missouri administrative hearing deadlines, Form 2385, Department of Revenue license issues, local court context, and questions to ask a DWI attorney.",
      "manchester-mo":
        "Manchester DWI guide for people searching DUI attorney near me, with Missouri DWI terminology, St. Louis County court context, DOR license issues, and local road context.",
      "wentzville-mo":
        "Wentzville DWI guide covering traffic citations, license consequences, Missouri DOR paperwork, local roads, court context, and questions to ask a DWI attorney.",
      "ofallon-mo":
        "O'Fallon DWI guide covering St. Charles County court context, O'Fallon Police records, Missouri DOR license deadlines, local roads, and questions to ask a DWI lawyer.",
      "edwardsville-il":
        "Edwardsville DUI guide covering what to do after an arrest, Madison County court, Illinois license issues, police records, and questions to ask an Edwardsville DUI lawyer.",
      "belleville-il":
        "Belleville DUI guide covering St. Clair County court, DUI charge questions, Belleville Police records, Illinois statutory summary suspension, and license consequences.",
      "apex-nc":
        "Apex DWI guide covering dismissal questions, misdemeanor consequences, probation, restricted license issues, Apex Police records, Wake County court, and NCDMV steps.",
      "fuquay-varina-nc":
        "Fuquay-Varina DWI guide covering Wake County court, Fuquay-Varina Police records, NCDMV license issues, and a practical court and license checklist.",
      "holly-springs-nc":
        "Holly Springs DWI guide covering rights after an arrest, Wake County court, police records, license consequences, and questions to ask before court.",
      "north-raleigh-nc":
        "North Raleigh DWI guide covering Raleigh Police records, Wake County court, NCDMV license consequences, restricted license questions, and lawyer questions.",
      "cary-nc":
        "Cary DWI guide covering lawyer-selection questions, Wake County court context, NCDMV license issues, Cary Police records, and defense documents to gather.",
      "pineville-nc":
        "Pineville DWI guide covering Mecklenburg County court context, North Carolina DWI consequences, police records, license questions, and what to ask a DWI lawyer.",
      "st-charles-mo":
        "St. Charles DWI guide covering lawyer questions, police records, St. Charles County court context, Missouri DOR administrative hearing issues, and license deadlines.",
      "lake-saint-louis-mo":
        "Lake Saint Louis DWI guide covering local police records, St. Charles County court context, Missouri DOR license issues, and questions to ask a DWI attorney.",
      "st-peters-mo":
        "St. Peters DWI guide covering police records, St. Charles County court context, Missouri DOR license deadlines, local roads, and DWI lawyer questions.",
      "moscow-mills-mo":
        "Moscow Mills DWI guide covering DWI attorney questions, Lincoln County court context, Missouri DOR administrative hearings, Form 2385, and license deadlines.",
      "knightdale-nc":
        "Knightdale DWI guide covering Wake County court, Knightdale Police records, NCDMV license consequences, Spanish-language legal searches, and lawyer questions.",
      "rolesville-nc":
        "Rolesville DWI guide covering Rolesville Police records, Wake County court, NCDMV license consequences, U.S. 401 context, and lawyer questions.",
      "wake-forest-nc":
        "Wake Forest DWI guide covering Wake Forest Police traffic enforcement, Wake County court, NCDMV license issues, Capital Boulevard context, and lawyer questions.",
      "concord-nc":
        "Concord DWI guide covering Cabarrus County court, Concord Police records, NCDMV license consequences, local roads, and questions to ask a DWI lawyer.",
      "kannapolis-nc":
        "Kannapolis DWI guide covering Cabarrus County court, Kannapolis Police records, NCDMV license issues, local roads, and attorney questions.",
      "harrisburg-nc":
        "Harrisburg DWI guide covering Cabarrus County court, sheriff records, NCDMV license consequences, NC 49 context, and lawyer questions.",
      "mount-pleasant-nc":
        "Mount Pleasant DWI guide covering Cabarrus County court, sheriff records, NCDMV license questions, NC 49 and NC 73 context, and next steps.",
      "midland-nc":
        "Midland DWI guide covering Cabarrus County court, sheriff records, NCDMV license issues, NC 24/27 context, and questions to ask.",
      "durham-nc":
        "Durham DWI guide covering Durham County court, Durham Police records, NCDMV license consequences, NC 147 and I-85 context, and lawyer questions.",
      "chapel-hill-nc":
        "Chapel Hill DWI guide covering Orange County court, Chapel Hill Police records, NCDMV license issues, Franklin Street and 15-501 context, and attorney questions.",
      "carrboro-nc":
        "Carrboro DWI guide covering Orange County court, Carrboro Police records, NCDMV license consequences, NC 54 context, and questions to ask.",
      "hillsborough-nc":
        "Hillsborough DWI guide covering Orange County court, Hillsborough Police records, NCDMV license issues, I-85 and Churton Street context, and next steps.",
    };
    if (targetedDescriptions[city.slug]) {
      return compactDescription(targetedDescriptions[city.slug]);
    }
    const county = countyLabelForCity(city, region, practice);
    const licensePhrase = licensePhraseByState[region.stateCode] ?? "state license deadlines";
    const courtPhrase = county ? `${county} court` : "local court";
    const detailedDescription = `${city.name} ${label} guide covering ${courtPhrase}, ${
      city.agency ?? "local police"
    } records, ${licensePhrase}, and lawyer questions.`;
    const conciseDescription = `${city.name} ${label} guide covering ${courtPhrase}, local police records, ${licensePhrase}, and lawyer questions.`;
    return compactDescription(detailedDescription.length <= 155 ? detailedDescription : conciseDescription);
  }

  const targetedPiDescriptions = {
    "edwardsville-il":
      "Edwardsville personal injury and car accident guide covering accident reports, insurance calls, medical documentation, Madison County court context, local roads, and claim deadlines.",
    "apex-nc":
      "Apex car accident and personal injury guide covering crash reports, insurance calls, medical documentation, Wake County court context, local roads, and what to do after an accident.",
    "cary-nc":
      "Cary car accident and personal injury guide covering crash reports, insurance documents, medical records, Wake County court context, and claim deadlines.",
    "holly-springs-nc":
      "Holly Springs car accident and personal injury guide covering crash reports, medical documentation, insurance calls, Wake County court context, and local records.",
    "fuquay-varina-nc":
      "Fuquay-Varina car accident and personal injury guide covering crash reports, insurance documents, medical records, Wake County court context, and local records.",
    "collinsville-il":
      "Collinsville car accident and personal injury guide covering accident reports, insurance calls, medical documentation, court context, and claim deadlines.",
    "manchester-mo":
      "Manchester car accident and personal injury guide covering crash reports, insurance calls, medical documentation, St. Louis County court context, and claim deadlines.",
  };

  return compactDescription(
    targetedPiDescriptions[city.slug] ??
      `${city.name} car accident and personal injury guide covering crash or incident reports, insurance documents, medical records, claim deadlines, and official sources.`
  );
}

function courtForCity(city, region, practice = null) {
  if (practice?.slug === "personal-injury") {
    return city.personalInjuryCourtOverride ?? city.courtOverride ?? region.personalInjuryCourt ?? region.court;
  }

  return city.duiCourtOverride ?? city.courtOverride ?? region.duiCourt ?? region.court;
}

function stateBasics(region) {
  return siteData.legalBasics[region.stateCode];
}

function sourceCards(sources) {
  return sources
    .map(
      (item) =>
        `<a class="source-card" href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(
          item.label
        )}</span><strong>Official source</strong></a>`
    )
    .join("");
}

function sourceChips(sources, label = "Sources") {
  const chips = sources.filter(Boolean).slice(0, 4);
  if (!chips.length) {
    return "";
  }

  return `<div class="source-chip-row" aria-label="${escapeHtml(label)}">
    <span>${escapeHtml(label)}:</span>
    ${chips
      .map((source) => `<a href="${escapeHtml(source.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a>`)
      .join("")}
  </div>`;
}

function documentChecklist(isDui) {
  return isDui
    ? [
        "Ticket or citation",
        "Bond paperwork",
        "Court date notice",
        "Police agency information",
        "Chemical test paperwork",
        "Secretary of State or DMV notice",
        "Towing or impound paperwork",
        "Any crash report information",
      ]
    : [
        "Crash or incident report",
        "Photos and videos",
        "Medical records",
        "Medical bills",
        "Insurance claim numbers",
        "Witness names",
        "Repair estimates",
        "Wage loss documents",
        "Letters from insurers",
      ];
}

function documentChecklistSection(isDui) {
  const title = isDui ? "Documents to gather after a DUI or DWI arrest." : "Documents to gather after an injury.";
  const intro = isDui
    ? "These records can help readers understand the court, license, records, and vehicle issues that may move on separate tracks."
    : "These records can help readers organize insurance, medical, liability, and damages questions before deadlines become urgent.";

  return `<section class="section section-alt" id="documents">
    <div class="container split-grid">
      <div class="section-head">
        <p class="eyebrow">Evidence and documents</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(intro)}</p>
      </div>
      <ul class="checklist-grid">${documentChecklist(isDui).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  </section>`;
}

function processTimeline(isDui) {
  return isDui
    ? [
        "Stop or arrest",
        "Booking, citation, or release paperwork",
        "First local court date",
        "Secretary of State or DMV license track",
        "Discovery and evidence review",
        "Plea, hearing, trial, or dismissal",
        "Sentencing or license reinstatement steps",
      ]
    : [
        "Incident or crash",
        "Medical treatment",
        "Police or incident report",
        "Insurance claim",
        "Medical documentation",
        "Settlement discussion",
        "Lawsuit filing if unresolved",
        "Resolution, trial, or dismissal",
      ];
}

function timelineList(isDui) {
  return `<ol class="timeline-list">${processTimeline(isDui)
    .map((item) => `<li><span>${escapeHtml(item)}</span></li>`)
    .join("")}</ol>`;
}

function cityLocalFlavor(city, region, isDui) {
  if (isDui && city.local_context_intro) {
    return city.local_context_intro;
  }

  if (!isDui && city.local_accident_context) {
    return city.local_accident_context;
  }

  if (city.slug === "edwardsville-il" && isDui) {
    return "This guide focuses on DUI cases connected to Edwardsville and nearby Madison County communities, including traffic stops handled by Edwardsville Police, Madison County deputies, or Illinois State Police around I-55, I-70, I-255, Route 157, Route 159, and local roads near the courthouse district.";
  }

  if (city.slug === "edwardsville-il") {
    return "This guide focuses on injury claims connected to Edwardsville roads, businesses, public property, and Madison County civil court filings. It is designed to help readers identify where reports, court records, and insurance-related documents may come from.";
  }

  return isDui
    ? `This guide focuses on ${stateBasics(region).duiName} cases connected to ${city.name} and nearby ${region.name} communities, including stops handled by city police, county agencies, or state officers on local roads and commuter routes.`
    : `This guide focuses on injury claims connected to ${city.name} roads, businesses, public property, and local court filings. It is designed to help readers identify where reports, court records, and insurance-related documents may come from.`;
}

function cityRoadContext(city, isDui) {
  const localData = duiLocalDataFor(city);
  const roads = isDui
    ? city.common_roads ?? localData?.local_roads ?? []
    : city.common_accident_locations ?? city.common_roads ?? localData?.local_roads ?? [];

  return Array.isArray(roads) ? roads.filter(Boolean) : [];
}

function cityRiskFactors(city, isDui) {
  const defaults = isDui
    ? ["weekend enforcement periods", "holiday impaired-driving campaigns", "commuter routes", "downtown or entertainment-area traffic"]
    : ["insurance adjuster contact shortly after the accident", "unclear report source", "missed work", "medical documentation gaps"];
  const configured = isDui ? city.local_risk_factors : city.local_claim_issues;
  return Array.isArray(configured) && configured.length ? configured : defaults;
}

function cityDifferentiatorSection({ city, region, court, licenseOffice, isDui }) {
  const roads = cityRoadContext(city, isDui);
  const issues = cityRiskFactors(city, isDui);
  const roadText = roads.length
    ? `${city.name} has local corridor and place context such as ${listPhrase(roads.slice(0, 6))}.`
    : `${city.name} pages use the local court, agency, and regional context available for this market instead of relying only on a city-name swap.`;
  const issueText = issues.length
    ? `${isDui ? "Local risk factors" : "Local claim issues"} include ${listPhrase(issues.slice(0, 4))}.`
    : "The guide uses local agency and court references to separate this page from generic statewide legal summaries.";
  const agencyText = city.police
    ? `${city.police.name} is the municipal agency reference for this guide. County or state agencies may matter when the stop, crash, or incident happened outside city limits, on a highway, or on shared regional roads.`
    : `${city.name} may rely on municipal, county, or state agencies depending on where the incident happened.`;
  const recordText = isDui
    ? licenseOffice
      ? `${licenseOffice.name} is listed because driver-license consequences can move separately from the court case.`
      : "Driver-license consequences can move separately from the court case, so this page separates court steps from license-agency steps."
    : "For injury claims, the report source can differ from the court venue: city police, county sheriff, state police, insurers, medical providers, and property owners may each hold different records.";
  const sources = [
    court ? { label: court.name, href: court.href } : null,
    city.police ? { label: city.police.name, href: city.police.href } : null,
    isDui && licenseOffice ? { label: licenseOffice.name, href: licenseOffice.href } : null,
    ...(region.sharedEnforcement ?? []).map((office) => ({ label: office.name, href: office.href })),
  ].filter(Boolean);

  return `<section class="section section-alt" id="city-difference">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Local difference</p>
        <h2>What makes ${escapeHtml(city.name)} different locally.</h2>
        <p>${escapeHtml(`This block is meant to give ${city.name} its own local identity: court geography, agency setup, roadway context, and records issues that can matter before someone makes a legal decision.`)}</p>
      </div>
      <div class="card-grid four-up">
        <article class="info-card"><h3>Court anchor</h3><p>${escapeHtml(`${court.name} is the court reference used for ${city.name} in the ${region.name} cluster.`)}</p></article>
        <article class="info-card"><h3>Agency setup</h3><p>${escapeHtml(agencyText)}</p></article>
        <article class="info-card"><h3>Road and place context</h3><p>${escapeHtml(`${roadText} ${issueText}`)}</p></article>
        <article class="info-card"><h3>${escapeHtml(isDui ? "License track" : "Records track")}</h3><p>${escapeHtml(recordText)}</p></article>
      </div>
      ${sourceChips(sources, "Local references")}
    </div>
  </section>`;
}

function heroTitleForCity(city, region, isDui, basics) {
  if (isDui) {
    return `Arrested for ${basics.duiName} in ${city.name}, ${region.stateCode}? What to Do Next.`;
  }

  return `Injured in ${city.name}, ${region.stateCode}? What to Do Before Talking to Insurance.`;
}

function heroIntroForCity(city, region, isDui, basics) {
  if (isDui) {
    return `A ${basics.duiName} arrest can trigger two separate problems: the criminal court case and the driver's license consequences. This guide explains the local process, common deadlines, court location, police agencies, and questions to ask before speaking with a ${basics.duiName} attorney.`;
  }

  return "After a crash, fall, or injury, the first steps matter. This guide explains how to document the accident, where reports may come from, what deadlines may apply, and when it may make sense to speak with a personal injury attorney.";
}

function firstStepsSection({ city, region, isDui, basics }) {
  const title = isDui
    ? `If you were just arrested for ${basics.duiName} in ${city.name}`
    : `If you were injured in ${city.name}`;
  const steps = isDui
    ? [
        "Write down everything you remember while it is fresh.",
        "Save your ticket, bond paperwork, court date, and police paperwork.",
        "Do not miss your first court appearance.",
        "Look for any driver's license suspension or administrative hearing deadline.",
        "Do not call the prosecutor or court clerk expecting legal advice.",
        `Speak with ${articleFor(region.state)} ${region.state} ${basics.duiName} defense attorney before making decisions in court.`,
      ]
    : [
        "Get medical care and follow treatment instructions.",
        "Save photos, videos, names, insurance information, and police report details.",
        "Do not give a recorded statement without understanding your rights.",
        "Do not accept a quick settlement before knowing the full injury impact.",
        "Track missed work, medical bills, pain, limitations, and transportation costs.",
        "Talk with a personal injury attorney if injuries, medical bills, disputed fault, or insurance pressure are involved.",
      ];

  return `<section class="section section-fast" id="start-here">
    <div class="container">
      <aside class="fast-need-box">
        <p class="eyebrow">First 24-72 hours</p>
        <h2>${escapeHtml(title)}.</h2>
        <ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      </aside>
    </div>
  </section>`;
}

function whatHappensNextSection({ city, region, isDui, basics }) {
  const cards = isDui
    ? [
        ["Criminal charge", `The ${basics.duiName} case can involve court dates, discovery, plea negotiations, hearings, trial settings, or sentencing conditions.`],
        ["License consequences", "The driver-license track can move separately from the criminal case, so court paperwork is not the only deadline to watch."],
        ["Practical fallout", "Insurance, employment, commercial driving status, professional licensing, immigration issues, and background checks may all become part of the decision."],
      ]
    : [
        ["Medical care and documentation", "Treatment records, bills, follow-up instructions, and symptom tracking can become the backbone of the claim."],
        ["Insurance pressure", "An adjuster may ask for recorded statements, broad authorizations, or a fast settlement before the full injury picture is clear."],
        ["Report and deadline issues", "The responding agency, fault dispute, available coverage, and filing deadline can all affect what happens next."],
      ];

  return `<section class="section" id="what-happens-next">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">What happens next</p>
        <h2>${escapeHtml(isDui ? `After a ${basics.duiName} arrest, you may be dealing with more than one problem.` : "After an injury, the claim can start before you feel ready.")}</h2>
        <p>${escapeHtml(
          isDui
            ? `${city.name} cases can involve the local court, the arresting agency, and the state license agency at the same time.`
            : `${articleFor(city.name) === "an" ? "An" : "A"} ${city.name} injury claim may involve medical providers, police or incident reports, insurance adjusters, employer records, and court deadlines.`
        )}</p>
      </div>
      <div class="card-grid three-up">${cards.map((item) => `<article class="info-card"><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`).join("")}</div>
    </div>
  </section>`;
}

function whenToCallLawyerSection({ city, region, isDui, basics }) {
  const items = isDui
    ? [
        "You are worried about jail, probation, fines, or a criminal record.",
        "You refused testing or had a test over the legal limit.",
        "You need to understand license suspension, restricted driving, or reinstatement.",
        "There was a crash, injury, child passenger, prior offense, or commercial license issue.",
        "You are unsure what to say or do at the first court date.",
      ]
    : [
        "You went to the ER, urgent care, or needed follow-up care.",
        "You missed work or expect future medical treatment.",
        "The insurance company is blaming you or pushing a fast settlement.",
        "The other driver was uninsured, underinsured, or driving a commercial vehicle.",
        "A government vehicle, public road defect, public school, sidewalk, or public property may be involved.",
        "Your pain is getting worse after the accident.",
      ];

  return `<section class="section section-attorney-question" id="when-to-call-lawyer">
    <div class="container split-grid">
      <div class="section-head">
        <p class="eyebrow">${escapeHtml(isDui ? `When to call a ${basics.duiName} lawyer` : "When to call an injury lawyer")}</p>
        <h2>${escapeHtml(isDui ? `When talking to ${articleFor(city.name)} ${city.name} ${basics.duiName} attorney may make sense.` : `When talking to ${articleFor(city.name)} ${city.name} personal injury attorney may make sense.`)}</h2>
        <p>${escapeHtml(
          isDui
            ? `${basics.duiName} is serious, and legal advice is strongly recommended before you make court or license decisions that could affect the outcome.`
            : "Personal injury claims can be affected by evidence, insurance strategy, deadlines, medical proof, liens, and release language."
        )}</p>
      </div>
      <ul class="checklist-grid">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  </section>`;
}

function insuranceRealitySection(city) {
  return `<section class="section section-alt" id="insurance-warning">
    <div class="container split-grid">
      <div class="section-head">
        <p class="eyebrow">Insurance warning</p>
        <h2>Insurance companies are not neutral.</h2>
        <p>After an accident in ${escapeHtml(city.name)}, the insurance company may seem helpful, but its job is to limit what it pays. Adjusters may ask for recorded statements, broad medical authorizations, or quick settlements before the full injury picture is clear.</p>
      </div>
      <aside class="info-card callout-card">
        <h3>Before you respond</h3>
        <p>Keep claim numbers, letters, emails, medical bills, photos, and missed-work notes together. If injuries, disputed fault, or settlement pressure are involved, consider legal advice before signing releases or giving broad recorded statements.</p>
      </aside>
    </div>
  </section>`;
}

function questionsToAskAttorneySection({ city, region, isDui, basics }) {
  const targetedDuiQuestions = {
    "wentzville-mo": [
      "Do you handle both Wentzville DWI cases and related traffic charges from the same stop?",
      "How do Wentzville municipal records, St. Charles County court settings, and Missouri DOR deadlines fit together?",
    ],
    "nixa-mo": [
      "Do you handle Missouri DOR administrative hearings after Nixa DWI arrests?",
      "What should I do if I received Form 2385 or another DOR notice?",
    ],
    "manchester-mo": [
      "If I searched for a DUI attorney near Manchester, should I be asking about Missouri DWI court and DOR experience?",
      "How often do you handle St. Louis County DWI cases involving Manchester Police or West County traffic stops?",
    ],
    "edwardsville-il": [
      "How do Madison County DUI court dates and Illinois statutory summary suspension deadlines interact?",
      "Will you request Edwardsville Police records, video, chemical-test paperwork, and Secretary of State license documents?",
    ],
    "apex-nc": [
      "How do Apex DWI punishment levels, probation, and limited-driving-privilege issues usually get reviewed?",
      "What evidence could affect dismissal, reduction, or sentencing arguments in Wake County court?",
    ],
    "north-raleigh-nc": [
      "How do Raleigh Police records, Wake County court dates, and NCDMV license consequences fit together?",
      "What should I gather if I am worried about a restricted license or limited driving privilege?",
    ],
    "knightdale-nc": [
      "Will you review Knightdale Police records, chemical-test paperwork, and Wake County court notices together?",
      "Do you offer Spanish-language consultation or translation support if I searched for DWI legal representation in Spanish?",
    ],
    "rolesville-nc": [
      "Will you review Rolesville Police records, Wake County court paperwork, and NCDMV license issues together?",
      "Do you offer Spanish-language consultation or translation support if I searched for DWI legal representation in Spanish?",
    ],
    "wake-forest-nc": [
      "Will you review Wake Forest Police records, traffic-enforcement evidence, and chemical-test paperwork?",
      "How do Wake County court dates and NCDMV license consequences fit together after a Wake Forest DWI arrest?",
    ],
  };
  const questions = isDui
    ? [
        `How often do you handle ${basics.duiName} cases in ${region.name}?`,
        "Will you review the police report, bodycam, dashcam, and test records?",
        "Can you explain my license suspension or administrative hearing risk?",
        "What happens if I refused testing?",
        "Are there options to challenge the stop, arrest, or chemical test?",
        "What are the likely court dates and deadlines?",
        "What are the possible outcomes for a first offense or repeat offense?",
        "What should I avoid doing before court?",
        ...(targetedDuiQuestions[city.slug] ?? []),
      ]
    : [
        "Do you handle accident and injury claims in this county?",
        "How do fees and case costs work?",
        "What documents should I collect before speaking with insurance?",
        "How do medical bills, liens, and health insurance affect settlement?",
        "What if the insurance company says I was partly at fault?",
        "What if a commercial vehicle, public property, or government vehicle was involved?",
        "How do you evaluate settlement versus filing a lawsuit?",
        "What should I avoid signing or saying before the claim is reviewed?",
      ];

  return `<section class="section" id="questions-to-ask">
    <div class="container split-grid">
      <div class="section-head">
        <p class="eyebrow">Questions to ask an attorney</p>
        <h2>${escapeHtml(isDui ? `Questions to ask before hiring a ${basics.duiName} lawyer in ${city.name}.` : `Questions to ask before hiring a personal injury lawyer in ${city.name}.`)}</h2>
        <p>These questions help readers have a more useful consultation without turning this guide into legal advice or a lawyer ranking page.</p>
      </div>
      <ul class="checklist-grid">${questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul>
    </div>
  </section>`;
}

function accidentReportSection(city, region) {
  return `<section class="section" id="accident-report">
    <div class="container split-grid">
      <div class="section-head">
        <p class="eyebrow">Crash and incident reports</p>
        <h2>How to find a crash or incident report in ${escapeHtml(city.name)}.</h2>
        <p>If ${escapeHtml(city.agency)} handled the scene, the city police department may be the starting point for a local crash or incident report. If the crash occurred outside city limits, the county sheriff or state police may be the correct records source.</p>
      </div>
      <aside class="info-card callout-card">
        <h3>Records tip</h3>
        <p>Use the report number, date, location, involved vehicles, and responding agency name when asking for a report. If the crash involved public property or a public vehicle, ask about any shorter notice requirements.</p>
      </aside>
    </div>
  </section>`;
}

function personalInjuryLocalContextSection(city, region) {
  const roads = cityRoadContext(city, false);
  const roadText = roads.length
    ? `${city.name} injury claims may involve crashes or incidents around ${roads.join(", ")}.`
    : `${city.name} injury claims may involve local commuter roads, neighborhood streets, business entrances, parking lots, public sidewalks, and roads near the county court market.`;
  const localIssues = cityRiskFactors(city, false);

  return `<section class="section section-alt" id="local-injury-context">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Local injury context</p>
        <h2>Where ${escapeHtml(city.name)} injury records and issues may start.</h2>
        <p>${escapeHtml("This section gives local examples without recommending a provider, predicting a claim value, or replacing legal advice.")}</p>
      </div>
      <div class="card-grid four-up">
        <article class="info-card"><h3>Common local accident corridors</h3><p>${escapeHtml(roadText)}</p></article>
        <article class="info-card"><h3>Where reports may come from</h3><p>${escapeHtml(`${city.agency} may hold reports for incidents it handled. If the crash happened outside city limits, the county sheriff or state police may be the correct records source.`)}</p></article>
        <article class="info-card"><h3>Medical documentation</h3><p>Injury claims often involve emergency-room records, urgent-care records, ambulance records, imaging, physical therapy notes, bills, and follow-up treatment documentation.</p></article>
        <article class="info-card"><h3>Government-property warning</h3><p>${escapeHtml(`If an injury involves a public vehicle, public sidewalk, public school, courthouse area, county vehicle, or other public property in ${city.name}, shorter notice rules or different procedures may apply.`)}</p></article>
      </div>
      <div class="source-chip-row topic-chip-row" aria-label="Local claim issues">
        <span>Local claim issues:</span>
        ${localIssues.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>
  </section>`;
}

function editorialReviewBlock(isDui) {
  const sourceTypes = isDui
    ? "public court, law enforcement, Secretary of State, DMV, and state-law sources"
    : "public court, law enforcement, records, insurance-process, and state-law sources";
  return `<section class="section section-editorial" id="editorial-review">
    <div class="container">
      <div class="editorial-card">
        <p class="eyebrow">Editorial review</p>
        <h2>How this guide was created.</h2>
        <p>This guide was prepared by Local Legal Guides using ${escapeHtml(sourceTypes)}. It is reviewed for source accuracy, local relevance, and clarity. It is not legal advice and does not create an attorney-client relationship.</p>
        <p>Attorney review is not claimed unless a page states that a licensed attorney reviewed that specific state-law module. Sponsorship does not control official-source references, legal disclaimers, or the correction process.</p>
        <dl class="review-meta">
          <dt>Last reviewed</dt><dd>May 2026</dd>
          <dt>Next scheduled review</dt><dd>November 2026</dd>
          <dt>Corrections</dt><dd><a class="text-link" href="/contact/">Send a source update</a></dd>
        </dl>
        <a class="button button-secondary" href="/editorial-standards/">Read our editorial standards</a>
      </div>
    </div>
  </section>`;
}

function relatedResourceLinks(region, isDui) {
  if (region.stateCode !== "IL" && !(isDui && ["MO", "NC"].includes(region.stateCode))) {
    return "";
  }

  const resources =
    isDui && region.stateCode === "MO"
      ? [
          ["Missouri DWI administrative hearing guide", "/resources/missouri-dwi-administrative-hearing/"],
          ["Missouri DWI administrative hearing lawyer questions", "/resources/missouri-dwi-administrative-hearing-lawyer-questions/"],
        ]
    : isDui && region.stateCode === "NC"
        ? [
            ["North Carolina DWI misdemeanor, probation, and dismissal guide", "/resources/north-carolina-dwi-misdemeanor-probation-dismissal/"],
            ["North Carolina DWI consequences and limited driving privilege", "/resources/north-carolina-dwi-consequences-limited-driving-privilege/"],
          ]
      : isDui
        ? [
            ["Illinois DUI license suspension guide", "/resources/illinois-dui-license-suspension/"],
            ["Madison County DUI process", "/resources/madison-county-dui-process/"],
          ]
        : [
            ["Illinois personal injury deadlines", "/resources/illinois-personal-injury-deadlines/"],
            ["Madison County accident report guide", "/resources/madison-county-accident-report-guide/"],
          ];
  return `<section class="section section-alt" id="related-resources">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Related local resources</p>
        <h2>Neutral guides that explain the broader process.</h2>
      </div>
      <div class="card-grid two-up">${resources
        .map((item) => `<a class="related-card" href="${item[1]}"><span>Resource</span><strong>${escapeHtml(item[0])}</strong><p>Read the background guide and then return to the city page for local offices and source links.</p></a>`)
        .join("")}</div>
    </div>
  </section>`;
}

function duiInternalLinksSection(city, region, practice) {
  const countyHub = countyHubForCity(practice.slug, city.slug);
  const countyHubLink = countyHub
    ? `\n        <a class="related-card compact-related-card" href="${countyHubHref(countyHub)}">${escapeHtml(countyHub.countyName)} ${escapeHtml(practiceSeoLabel(practice, region))} guide</a>`
    : "";
  const nearbyLinks = region.cities
    .filter((nearby) => nearby.slug !== city.slug)
    .slice(0, 6)
    .map((nearby) => {
      const label = `${nearby.name} ${practiceSeoLabel(practice, region)} guide`;
      return `<a class="related-card compact-related-card" href="${pathForPracticeCity(practice.slug, nearby.slug)}">${escapeHtml(label)}</a>`;
    })
    .join("");

  return `<section class="section section-alt" id="dui-internal-links">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Related DUI/DWI links</p>
        <h2>Keep researching ${escapeHtml(city.name)} and nearby ${escapeHtml(practiceSeoLabel(practice, region))} guides.</h2>
        <p>Use these internal links to compare nearby city pages, switch to the matching injury guide, or return to the main DUI/DWI hub.</p>
      </div>
      <div class="related-grid">
        <a class="related-card compact-related-card" href="/dui/">DUI/DWI hub</a>${countyHubLink}
        <a class="related-card compact-related-card" href="${clusterHref(region)}">${escapeHtml(region.name)} ${escapeHtml(practiceSeoLabel(practice, region))} cluster</a>
        ${
          regionHasPractice(region, "personal-injury")
            ? `<a class="related-card compact-related-card" href="${pathForPracticeCity("personal-injury", city.slug)}">${escapeHtml(city.name)} personal injury guide</a>`
            : ""
        }
        ${nearbyLinks}
      </div>
    </div>
  </section>`;
}

function wakeSouthwestDwiTopicLinks(currentSlug = "") {
  const topics = [
    {
      slug: "apex-nc",
      href: "/dui/apex-nc/",
      label: "Apex DWI dismissal and misdemeanor questions",
      body: "Dismissal, misdemeanor exposure, probation, and restricted-license issues.",
    },
    {
      slug: "cary-nc",
      href: "/dui/cary-nc/",
      label: "Cary DWI lawyer questions",
      body: "What to ask about Wake County court, Cary Police records, testing, and NCDMV issues.",
    },
    {
      slug: "fuquay-varina-nc",
      href: "/dui/fuquay-varina-nc/",
      label: "Fuquay-Varina DWI court and license checklist",
      body: "Court notice, local records, NCDMV paperwork, and documents to gather.",
    },
    {
      slug: "holly-springs-nc",
      href: "/dui/holly-springs-nc/",
      label: "Holly Springs DWI rights and records questions",
      body: "Rights, police records, Wake County court, and license consequences after a stop.",
    },
  ];

  return topics
    .filter((topic) => topic.slug !== currentSlug)
    .map(
      (topic) => `<a class="related-card compact-related-card" href="${topic.href}"><span>Wake Southwest DWI</span><strong>${escapeHtml(
        topic.label
      )}</strong><p>${escapeHtml(topic.body)}</p></a>`
    )
    .join("");
}

function wakeSouthwestDwiInternalLinksSection(city, region, isDui) {
  if (!isDui || region.slug !== "wake-southwest-nc") {
    return "";
  }

  return `<section class="section" id="wake-southwest-dwi-topics">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Wake Southwest DWI topics</p>
        <h2>Related questions across Apex, Cary, Fuquay-Varina, and Holly Springs.</h2>
        <p>These nearby guides cover the same Wake County court and NCDMV system, but each page keeps the police records and local next steps tied to its town.</p>
      </div>
      <div class="related-grid">${wakeSouthwestDwiTopicLinks(city.slug)}</div>
    </div>
  </section>`;
}

function wakeSouthwestRegionalTopicSection(region) {
  if (region.slug !== "wake-southwest-nc") {
    return "";
  }

  return `<section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Current DWI topic paths</p>
        <h2>Common Wake Southwest DWI questions by city.</h2>
        <p>Apex, Cary, Fuquay-Varina, and Holly Springs share Wake County court and NCDMV context, but the best page depends on the town, police agency, and paperwork involved.</p>
      </div>
      <div class="related-grid">${wakeSouthwestDwiTopicLinks()}</div>
    </div>
  </section>`;
}

function citySponsorAvailabilityBox(city, region, packageInfo, practice) {
  const sponsor = activeSponsor(packageInfo);
  if (!sponsor) {
    return "";
  }

  const isDui = practice?.slug === "dui";
  const practiceLabel = isDui ? practiceSeoLabel(practice, region) : practice?.label ?? "practice area";
  return `<section class="sponsor-availability-band" aria-label="Sponsor availability">
    <div class="container sponsor-availability-inner">
      <div>
        <p class="eyebrow">Featured ${escapeHtml(practiceLabel)} Sponsor</p>
        <h2>${escapeHtml(region.name)} ${escapeHtml(practiceLabel)} sponsor.</h2>
        <p>${escapeHtml(`This clearly labeled attorney advertising placement appears near urgent ${practiceLabel} next-step guidance and remains separate from official source information.`)}</p>
      </div>
      <a class="button button-primary" href="${escapeHtml(sponsor.ctaUrl)}" ${trackingAttrs("city_sponsor_cta_click", {
        region: region.slug,
        city: city.slug,
        practice: practice?.slug ?? "",
        placement: "city_top",
        firm: sponsor.firmName,
        status: packageInfo.status,
      })}>Contact Featured ${escapeHtml(practiceLabel)} Sponsor</a>
    </div>
  </section>`;
}

function mapsHref(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function mapEmbedHref(query) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

function stateLabel(region) {
  return region.stateCode === "IL" ? "Illinois" : region.stateCode === "MO" ? "Missouri" : "North Carolina";
}

function duiPenaltyRows(region) {
  if (region.stateCode === "IL") {
    return [
      ["First DUI", "Generally Class A misdemeanor", "Up to 364 days in jail, fines, court costs, evaluation, and possible license consequences."],
      ["Second DUI", "Class A misdemeanor or higher depending on facts", "Mandatory minimum penalties may apply, and license consequences become more serious."],
      ["Aggravated DUI", "Felony", "Possible felony exposure for serious injury, death, repeat offenses, suspended-license driving, child passenger facts, or other aggravators."],
      ["High BAC or refusal", "Enhanced risk", "A high test result or refusal can affect sentencing, monitoring, and Secretary of State requirements."],
    ];
  }

  if (region.stateCode === "MO") {
    return [
      ["First DWI", "Misdemeanor", "Criminal penalties plus a separate administrative license case may apply."],
      ["Repeat DWI", "Enhanced charge", "Prior intoxication-related traffic offenses can increase charge level and license consequences."],
      ["Aggravated facts", "Enhanced risk", "Injury, child passengers, very high BAC, or repeat conduct can create more serious exposure."],
      ["Administrative action", "Separate license track", "The Missouri Department of Revenue can act on the driver's license separately from court."],
    ];
  }

  return [
    ["Level 5 to Level A1", "Sentencing level system", "North Carolina uses sentencing levels based on aggravating, grossly aggravating, and mitigating factors."],
    ["Grossly aggravating facts", "Higher exposure", "Repeat impaired driving, serious injury, child passengers, or revoked-license driving can increase sentencing level."],
    ["License revocation", "Civil and criminal consequences", "A DWI can create immediate civil revocation and longer-term DMV consequences."],
    ["Ignition interlock", "Case-specific", "Interlock can be required depending on BAC, prior record, and restoration requirements."],
  ];
}

function impliedConsentCards(region) {
  if (region.stateCode === "IL") {
    return [
      ["What Illinois consent means", "Driving in Illinois carries implied consent to chemical testing after a lawful DUI arrest."],
      ["Test over the limit", "A first-offense statutory summary suspension is commonly 6 months after a test at 0.08% or more."],
      ["Refusal", "A first refusal can mean a 12-month statutory summary suspension."],
      ["46-day start", "The suspension does not usually start immediately; it begins 46 days after notice unless successfully challenged."],
    ];
  }

  if (region.stateCode === "MO") {
    return [
      ["Administrative case", "Missouri DWI arrests can create a separate license proceeding through the Department of Revenue."],
      ["BAC threshold", "The general per se alcohol threshold is 0.08% BAC."],
      ["Refusal", "Refusal can create separate license consequences and may be used in court depending on the facts."],
      ["Court track", "The criminal case and license case can move on different timelines."],
    ];
  }

  return [
    ["Civil revocation", "North Carolina DWI cases can involve immediate civil license consequences."],
    ["Alcohol concentration", "The general per se alcohol concentration threshold is 0.08."],
    ["Refusal", "Refusal can create separate DMV consequences."],
    ["Two tracks", "The criminal court case and DMV/license consequences can move separately."],
  ];
}

function restorationSteps(region) {
  if (region.stateCode === "IL") {
    return [
      ["Confirm eligibility", "Check the Secretary of State suspension or revocation record and make sure the required waiting period has passed."],
      ["Complete evaluation requirements", "Alcohol/drug evaluation, risk education, treatment, or continuing care may be required depending on classification."],
      ["Address BAIID or MDDP", "Eligible first offenders may use an MDDP with a BAIID during suspension; reinstatement can also involve ignition interlock rules."],
      ["Pay reinstatement fees", "Secretary of State reinstatement fees and proof of compliance are usually required before driving privileges return."],
    ];
  }

  if (region.stateCode === "MO") {
    return [
      ["Review DOR requirements", "Missouri Department of Revenue records control reinstatement requirements."],
      ["Complete required programs", "SATOP, insurance proof, interlock, or other steps may apply depending on the case."],
      ["Pay fees", "Reinstatement fees and proof documents must be submitted to DOR."],
      ["Confirm before driving", "Do not drive until the state confirms that privileges are restored or restricted privileges are active."],
    ];
  }

  return [
    ["Review DMV status", "North Carolina DMV records control revocation and restoration requirements."],
    ["Complete assessment or treatment", "Substance abuse assessment, education, or treatment can be required."],
    ["Check interlock", "Ignition interlock may be required depending on the case."],
    ["Confirm restoration", "Driving should wait until DMV confirms eligibility or a valid privilege is in place."],
  ];
}

function duiDeadlineCards(region, court) {
  if (region.stateCode === "IL") {
    return [
      {
        label: "46 days after notice",
        title: "Illinois summary suspension can begin",
        body: "Illinois statutory summary suspension is separate from the criminal DUI case. A driver can petition to challenge the suspension, but timing is strict.",
      },
      {
        label: "First court date",
        title: `Appear in ${court.name}`,
        body: `Check the citation, bond paperwork, or circuit clerk for the actual date and courtroom. ${court.name} is the court reference used for this guide.`,
      },
      {
        label: "Before reinstatement",
        title: "Resolve Secretary of State requirements",
        body: "Reinstatement can require fees, proof of eligibility, alcohol/drug evaluation steps, and BAIID or MDDP requirements depending on the case.",
      },
    ];
  }

  if (region.stateCode === "MO") {
    return [
      {
        label: "15 days after notice",
        title: "Request a Missouri DOR hearing if eligible",
        body: "Missouri administrative alcohol actions can move separately from the criminal DWI case. Review the Notice of Suspension/Revocation quickly because hearing timing is strict.",
      },
      {
        label: "First court date",
        title: `Appear in ${court.name}`,
        body: "Check the citation, bond paperwork, court notice, or circuit clerk record for the actual date, division, and courtroom.",
      },
      {
        label: "Before reinstatement",
        title: "Resolve Missouri Department of Revenue requirements",
        body: "Reinstatement can require fees, proof of insurance, SATOP completion, ignition interlock, or other DOR requirements depending on the case.",
      },
    ];
  }

  return [
    {
      label: "Immediately after arrest",
      title: "Review North Carolina civil revocation timing",
      body: "North Carolina impaired-driving cases can create immediate civil license consequences. Limited-driving-privilege timing and eligibility should be reviewed quickly.",
    },
    {
      label: "First court date",
      title: `Appear in ${court.name}`,
      body: "Check the citation, release paperwork, court notice, or North Carolina Judicial Branch record for the actual date, courtroom, and appearance requirements.",
    },
    {
      label: "Before restoration",
      title: "Resolve NCDMV requirements",
      body: "Restoration can require fees, substance-abuse assessment or treatment steps, proof of eligibility, and ignition interlock in some cases.",
    },
  ];
}

function missouriDwiAdministrativeHearingSection({ city, region, court, basics }) {
  if (region.stateCode !== "MO") {
    return "";
  }

  const resources = [
    { label: "Missouri DOR DWI information", href: "https://dor.mo.gov/driver-license/revocation-reinstatement/dwi.html" },
    { label: "Missouri Administrative Alcohol FAQ", href: "https://dor.mo.gov/faq/driver-license/administrative-alcohol.html" },
    { label: "Missouri Form 2385", href: "https://dor.mo.gov/forms/2385.pdf" },
    { label: "Missouri Restricted Driving Privilege", href: "https://dor.mo.gov/driver-license/revocation-reinstatement/rdp-alcohol.html" },
  ];
  const roads = cityRoadContext(city, true);
  const roadPhrase = roads.length ? ` local roads such as ${listPhrase(roads.slice(0, 4))},` : "";
  const questions = [
    `Does the 15-day Missouri DOR hearing issue apply to my ${city.name} arrest paperwork?`,
    `How does the DOR license track connect to my ${court.name} court date?`,
    "What should I bring to a lawyer: Form 2385, ticket, test paperwork, bond paperwork, and tow records?",
    "Could a restricted driving privilege, SATOP, ignition interlock, or reinstatement requirement apply?",
  ];

  return `<section class="section section-focus" id="missouri-admin-hearing">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Missouri DWI license track</p>
        <h2>Missouri DWI administrative hearing and license questions in ${escapeHtml(city.name)}.</h2>
        <p>${escapeHtml(
          `A ${basics.duiName} arrest involving ${city.agency},${roadPhrase} or ${region.name} can create a criminal court case and a separate Missouri Department of Revenue license issue.`
        )}</p>
      </div>
      <div class="card-grid three-up">
        <article class="info-card"><h3>Two tracks can move at once</h3><p>${escapeHtml(`The court case may be assigned through ${court.name}, while the license issue may be handled through the Missouri Department of Revenue.`)}</p></article>
        <article class="info-card"><h3>15-day hearing issue</h3><p>The Missouri DOR describes a short hearing-request window for administrative alcohol actions. Review the notice quickly and do not assume the first court date protects the license issue.</p></article>
        <article class="info-card"><h3>Restricted driving questions</h3><p>Restricted driving privileges, SATOP, insurance proof, ignition interlock, reinstatement fees, or other DOR requirements can become separate practical issues.</p></article>
      </div>
      <div class="split-grid narrow-split">
        <div class="info-card">
          <h3>Questions to ask a Missouri DWI lawyer</h3>
          <ul>${questions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div class="info-card">
          <h3>Documents to review early</h3>
          <ul>
            <li>Notice of Suspension/Revocation or Form 2385 paperwork</li>
            <li>Ticket, citation, bond, or release paperwork</li>
            <li>Chemical-test or refusal paperwork</li>
            <li>First court date and division information</li>
          </ul>
        </div>
      </div>
      ${sourceChips(resources, "Missouri DOR sources")}
      <p class="section-note"><a class="text-link" href="/resources/missouri-dwi-administrative-hearing-lawyer-questions/">Read the Missouri DWI administrative hearing lawyer questions resource</a>.</p>
    </div>
  </section>`;
}

function duiLawCards(region, city) {
  if (region.stateCode === "IL") {
    return [
      {
        title: "Illinois DUI definition",
        body: "Illinois prohibits driving or being in actual physical control of a vehicle while under the influence of alcohol, drugs, intoxicating compounds, or combinations of them.",
      },
      {
        title: "BAC limits",
        body: "The general per se alcohol limit is 0.08% BAC. Commercial drivers and drivers under 21 face stricter standards under separate rules.",
      },
      {
        title: "Implied consent",
        body: "Refusing chemical testing or testing over the legal limit can trigger Secretary of State license consequences separate from the criminal case.",
      },
      {
        title: "Local ordinances",
        body: `${city.name} police may enforce city ordinances along with Illinois traffic and criminal statutes. DUI charges themselves are handled under Illinois law in the county court system.`,
      },
    ];
  }

  if (region.stateCode === "MO") {
    return [
      {
        title: "Missouri DWI definition",
        body: "Missouri prohibits operating a vehicle while in an intoxicated condition, and a DWI case can involve alcohol, drugs, or a combination of substances.",
      },
      {
        title: "BAC limits",
        body: "The general per se alcohol limit is 0.08% BAC. Commercial drivers and drivers under 21 can face stricter or separate license rules.",
      },
      {
        title: "Implied consent",
        body: "A test result over the limit or a refusal can trigger Missouri Department of Revenue license action separate from the court case.",
      },
      {
        title: "Local ordinances",
        body: `${city.name} police may enforce city ordinances along with Missouri traffic and criminal statutes. DWI charges are handled under Missouri law through the local court system.`,
      },
    ];
  }

  return [
    {
      title: "North Carolina DWI definition",
      body: "North Carolina impaired-driving law covers driving while appreciably impaired or with an alcohol concentration at or above the legal limit.",
    },
    {
      title: "Alcohol concentration",
      body: "The general per se threshold is 0.08 alcohol concentration. Commercial drivers and drivers under 21 can face stricter rules.",
    },
    {
      title: "Implied consent",
      body: "Refusal or a qualifying test result can create NCDMV license consequences separate from the criminal impaired-driving case.",
    },
    {
      title: "Local ordinances",
      body: `${city.name} officers may enforce city ordinances along with North Carolina traffic and criminal statutes. DWI cases are handled under North Carolina law through the county court system.`,
    },
  ];
}

function quickActionCards({ city, region, court, licenseOffice, isDui, basics }) {
  if (isDui) {
    const deadlineLabel =
      region.stateCode === "IL"
        ? "Check the 46-day suspension clock"
        : region.stateCode === "MO"
          ? "Check the 15-day DOR hearing window"
          : "Check civil revocation timing";

    return [
      {
        label: "1",
        title: "Confirm the court path",
        body: `Use ${court.name} to verify the next court date, courtroom, and case status before making plans.`,
        href: court.href,
        cta: "Court website",
      },
      {
        label: "2",
        title: deadlineLabel,
        body: basics.duiLicense,
        href: licenseOffice?.href,
        cta: "License office",
      },
      {
        label: "3",
        title: "Request local records",
        body: `${city.police?.name ?? city.agency} may be the starting point for police reports, crash reports, or agency questions.`,
        href: city.police?.href,
        cta: "Police website",
      },
    ];
  }

  return [
    {
      label: "1",
      title: "Preserve proof now",
      body: "Save photos, medical records, witness names, bills, repair estimates, and insurance communications before details get harder to recover.",
      href: "#documents",
      cta: "Evidence checklist",
    },
    {
      label: "2",
      title: "Find the report source",
      body: `${city.police?.name ?? city.agency} may hold crash or incident records if it handled the scene.`,
      href: city.police?.href,
      cta: "Police website",
    },
    {
      label: "3",
      title: "Calendar the filing period",
      body: basics.personalInjuryDeadline,
      href: "#deadlines",
      cta: "View deadlines",
    },
  ];
}

function miniCards(items) {
  return items
    .map((item) => `<article class="mini-card"><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`)
    .join("");
}

function penaltyTable(rows) {
  return `<div class="responsive-table"><table>
    <thead><tr><th>Category</th><th>Charge level</th><th>What it can mean</th></tr></thead>
    <tbody>${rows
      .map((row) => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td></tr>`)
      .join("")}</tbody>
  </table></div>`;
}

function officeCards(offices) {
  return offices
    .filter(Boolean)
    .map(
      (office) => `<article class="office-card">
        <div class="office-card-head">
          <p class="eyebrow">${escapeHtml(office.type ?? "Office")}</p>
          <h3>${escapeHtml(office.name)}</h3>
        </div>
        <dl class="contact-list">
          ${office.address ? `<dt>Address</dt><dd><a href="${mapsHref(office.address)}" target="_blank" rel="noopener noreferrer" aria-label="Map for ${escapeHtml(office.name)} at ${escapeHtml(office.address)}">${escapeHtml(office.address)}</a></dd>` : ""}
          ${office.phone ? `<dt>Phone</dt><dd>${escapeHtml(office.phone)}</dd>` : ""}
          ${office.hours ? `<dt>Hours</dt><dd>${escapeHtml(office.hours)}</dd>` : ""}
        </dl>
        ${office.note ? `<p>${escapeHtml(office.note)}</p>` : ""}
        ${office.href ? `<a class="text-link" href="${escapeHtml(office.href)}" target="_blank" rel="noopener noreferrer" aria-label="Official website for ${escapeHtml(office.name)}">Official website</a>` : ""}
      </article>`
    )
    .join("");
}

function regionPrimaryCourt(region) {
  return region.court ?? region.cities.find((city) => city.courtOverride)?.courtOverride ?? null;
}

function regionCourtOffices(region) {
  const courts = region.courtOffices ?? [region.court, region.personalInjuryCourt];
  const seen = new Set();
  return courts.filter(Boolean).filter((court) => {
    const key = `${court.name}|${court.address}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function regionEnforcementOffices(region) {
  if (region.sharedEnforcement?.length) {
    return region.sharedEnforcement;
  }

  const seen = new Set();
  return region.cities
    .map((city) => city.police)
    .filter((office) => {
      if (!office || seen.has(office.name)) {
        return false;
      }
      seen.add(office.name);
      return true;
    })
    .slice(0, 3);
}

function duiUrgentCards(region, city, court, licenseOffice) {
  const basics = stateBasics(region);
  const items = [
    {
      label: "Move quickly",
      title: region.urgentDeadline?.headline ?? `${basics.duiName} timing matters early.`,
      body:
        region.urgentDeadline?.body ??
        `${region.state} drivers can face parallel court and license consequences before the paperwork feels organized.`,
      href: "#deadlines",
      cta: "See deadlines",
    },
    {
      label: "Court path",
      title: `Confirm the court anchor for ${city.name}`,
      body: `${court.name} is the court reference used for this guide. Check the court website and paperwork early so the local path is clear from the start.`,
      href: court.href,
      cta: "Open court website",
    },
    {
      label: "License track",
      title: licenseOffice ? `Keep ${licenseOffice.name} in view` : "Keep the license issue separate",
      body: licenseOffice
        ? `${licenseOffice.name} is the driver-services reference for this page. Confirm services and hours before making a trip or assuming the court handles the license side.`
        : basics.duiLicense,
      href: licenseOffice?.href ?? "#state-law",
      cta: licenseOffice ? "Check driver services" : "Review license rules",
    },
  ];

  return items
    .map(
      (item) => `<article class="urgent-card">
        <span>${escapeHtml(item.label)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
        <a class="text-link" href="${escapeHtml(item.href)}"${item.href.startsWith("#") ? "" : ' target="_blank" rel="noopener noreferrer"'}>${escapeHtml(item.cta)}</a>
      </article>`
    )
    .join("");
}

function regionWhyItMatters(region, court, licenseOffice, enforcement) {
  const basics = stateBasics(region);
  const items =
    region.regionHighlights ??
    [
      {
        title: "Shared court path",
        body: court
          ? `${region.name} city pages point back to ${court.name}, which helps readers understand the court system before they drill into a single city.`
          : `${region.name} city pages share a common county-level court path that affects scheduling, filings, and local process.`,
      },
      {
        title: "County and regional enforcement",
        body: enforcement?.length
          ? "Readers often need more than one agency. This region includes municipal, county, or regional enforcement offices that can affect where records, reports, or charges connect."
          : "Readers may deal with more than one law-enforcement agency depending on where the event happened inside the region.",
      },
      {
        title: "State deadlines, local steps",
        body: `${region.state} uses statewide legal rules, but the actual next steps still run through local court, records, and driver-service offices in this region.`,
      },
      {
        title: "License and record logistics",
        body: licenseOffice
          ? `${licenseOffice.name} is a practical reference point for people who need to verify services, restoration steps, or current office procedures.`
          : basics.duiLicense,
      },
    ];

  return items.map((item) => `<article class="info-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("");
}

function regionProcessCards(region, court) {
  const items =
    region.processNotes ??
    [
      {
        label: "Start with the right office",
        title: court ? `Use ${court.name} as the court anchor` : "Use the county court anchor",
        body: "A regional page helps readers figure out which court system, clerk, or courthouse usually controls the next step before they dive into a city-specific guide.",
      },
      {
        label: "Separate tracks still matter",
        title: "Criminal, civil, and agency timelines can differ",
        body:
          region.stateCode === "IL"
            ? "Illinois readers may be dealing with a criminal court date, a Secretary of State license issue, or a civil filing window at the same time."
            : region.stateCode === "MO"
              ? "Missouri readers may need to think about a criminal case, Department of Revenue issues, and insurance or injury deadlines on different timelines."
              : "North Carolina readers can face court settings, DMV consequences, and civil claim timing on separate tracks.",
      },
      {
        label: "Why the region page helps",
        title: "Use the region to narrow the right city page",
        body: `Once the county-level court and agency path is clear, readers can jump into the ${region.cities.length} city pages in ${region.name} for more specific police, report, and local-procedure details.`,
      },
    ];

  return items.map((item) => `<article class="deadline-card"><span>${escapeHtml(item.label)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("");
}

function regionFaq(region, court) {
  const basics = stateBasics(region);
  const hasMultipleCourts = regionCourtOffices(region).length > 1;
  return [
    {
      q: `Why does ${region.name} have its own page?`,
      a: `${region.name} groups nearby cities that share a county court path, overlapping enforcement, or the same state agency logistics. It helps readers find the right city page faster.`,
    },
    {
      q: `Does this regional page replace the city pages?`,
      a: `No. This page gives the county or regional context. The city pages still carry the most specific local court, police, report, and office details.`,
    },
    {
      q: `What statewide rule still matters here?`,
      a: region.stateCode === "IL" ? basics.personalInjuryDeadline : region.stateCode === "MO" ? basics.duiLicense : basics.duiCharge,
    },
    {
      q: `Where should someone start if they are unsure which local page they need?`,
      a: hasMultipleCourts
        ? `Start with the court offices and city list on this page. Some regions use different court buildings for criminal and civil matters, so the city guide helps match the issue to the right local path.`
        : court
        ? `Start with ${court.name} and the city list on this page. Once the court or agency path looks familiar, open the city guide that best matches where the event happened.`
        : "Start with the city list on this page and match the guide to the place where the event happened.",
    },
  ];
}

function regionSourceList(region, court, licenseOffice, enforcement) {
  const basics = stateBasics(region);
  return [
    ...basics.sources,
    ...regionCourtOffices(region).map((courtOffice) => ({ label: courtOffice.name, href: courtOffice.href })),
    licenseOffice ? { label: licenseOffice.name, href: licenseOffice.href } : null,
    ...enforcement.map((office) => ({ label: office.name, href: office.href })),
  ].filter(Boolean);
}

function breadcrumbTrail(items) {
  return `<nav class="breadcrumb" aria-label="Breadcrumb">
    <ol>${items
      .map(
        (item, index) =>
          `<li>${index === items.length - 1 ? `<span>${escapeHtml(item.name)}</span>` : `<a href="${item.href}">${escapeHtml(item.name)}</a>`}</li>`
      )
      .join("")}</ol>
  </nav>`;
}

function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  };
}

function faqSchema(faq) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

function officeSchema(offices) {
  return offices.filter(Boolean).map((office) => ({
    "@context": "https://schema.org",
    "@type": "GovernmentOffice",
    name: office.name,
    address: office.address,
    telephone: office.phone,
    url: office.href,
    openingHours: office.hours,
  }));
}

function webPageSchema({ title, description, route, modifiedDate = PAGE_LASTMOD_PLACEHOLDER }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: absoluteUrl(route),
    dateModified: modifiedDate,
    publisher: publisherSchema(),
    isPartOf: {
      "@type": "WebSite",
      name: siteData.siteName,
      alternateName: "LocalLegalGuides",
      url: siteOrigin,
    },
  };
}

function duiLocalDataFor(city) {
  const data = city.dui_local_data ?? city.duiLocalData ?? null;
  if (!data) return null;

  const hasCampaigns = Array.isArray(data.past_campaigns) && data.past_campaigns.length > 0;
  const hasRoads = Array.isArray(data.local_roads) && data.local_roads.length > 0;
  const hasJurisdictions = Array.isArray(data.jurisdiction_notes) && data.jurisdiction_notes.length > 0;
  const hasContent =
    data.enforcement_snapshot?.summary ||
    hasCampaigns ||
    data.arrest_data?.summary ||
    data.crash_context?.summary ||
    hasRoads ||
    hasJurisdictions ||
    data.data_availability_note;

  return hasContent ? data : null;
}

function localDuiDataSources(data) {
  if (!data) return [];

  const sources = [
    data.enforcement_snapshot?.source_name && data.enforcement_snapshot?.source_url
      ? {
          label: data.enforcement_snapshot.source_name,
          href: data.enforcement_snapshot.source_url,
        }
      : null,
    data.arrest_data?.source_name && data.arrest_data?.source_url
      ? {
          label: data.arrest_data.source_name,
          href: data.arrest_data.source_url,
        }
      : null,
    data.crash_context?.source_name && data.crash_context?.source_url
      ? {
          label: data.crash_context.source_name,
          href: data.crash_context.source_url,
        }
      : null,
    ...(data.past_campaigns ?? [])
      .filter((campaign) => campaign.source_name && campaign.source_url)
      .map((campaign) => ({
        label: campaign.source_name,
        href: campaign.source_url,
      })),
  ].filter(Boolean);

  const seen = new Set();
  return sources.filter((source) => {
    const key = source.href;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function localDuiDataSection(city, region) {
  const data = duiLocalDataFor(city);
  if (!data) return "";
  const label = region?.stateCode === "IL" ? "DUI" : "DWI";

  const snapshot = data.enforcement_snapshot;
  const campaigns = data.past_campaigns ?? [];
  const arrestData = data.arrest_data;
  const crashContext = data.crash_context;
  const roads = data.local_roads ?? [];
  const jurisdictions = data.jurisdiction_notes ?? [];
  const sources = localDuiDataSources(data);
  const safetyText =
    "Local Legal Guides reports historical public enforcement data only. We do not publish upcoming checkpoint locations, patrol locations, or information intended to help drivers avoid law enforcement.";

  return `<section class="section section-alt" id="dui-local-data">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Hyper-local ${escapeHtml(label)} context</p>
        <h2>Local ${escapeHtml(label)} enforcement and roadway context for ${escapeHtml(city.name)}.</h2>
        <p>${escapeHtml(safetyText)}</p>
      </div>
      <div class="data-panel-grid">
        ${
          snapshot?.summary
            ? `<article class="info-card data-card">
          <span class="data-kicker">Local enforcement snapshot</span>
          <p>${escapeHtml(snapshot.summary)}</p>
          ${
            snapshot.source_name
              ? `<p class="source-note">Source: ${
                  snapshot.source_url
                    ? `<a href="${escapeHtml(snapshot.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(snapshot.source_name)}</a>`
                    : escapeHtml(snapshot.source_name)
                }${snapshot.source_date ? `, ${escapeHtml(snapshot.source_date)}` : ""}</p>`
              : ""
          }
        </article>`
            : ""
        }
        ${
          campaigns.length
            ? `<article class="info-card data-card">
          <span class="data-kicker">Past impaired-driving campaigns</span>
          <ul class="plain-list">${campaigns
            .map(
              (campaign) => `<li><strong>${escapeHtml(campaign.campaign_name ?? "Past campaign")}</strong>${
                campaign.date_range ? ` <span>(${escapeHtml(campaign.date_range)})</span>` : ""
              }: ${escapeHtml(campaign.results_summary ?? "")}</li>`
            )
            .join("")}</ul>
        </article>`
            : ""
        }
        ${
          arrestData?.summary || crashContext?.summary
            ? `<article class="info-card data-card">
          <span class="data-kicker">Arrest and crash context</span>
          ${arrestData?.summary ? `<p>${escapeHtml(arrestData.summary)}${arrestData.year ? ` (${escapeHtml(String(arrestData.year))})` : ""}</p>` : ""}
          ${crashContext?.summary ? `<p>${escapeHtml(crashContext.summary)}</p>` : ""}
        </article>`
            : ""
        }
        ${
          roads.length || jurisdictions.length
            ? `<article class="info-card data-card">
          <span class="data-kicker">Local roads and agencies</span>
          ${roads.length ? `<p>Local roadway context includes ${escapeHtml(roads.join(", "))}.</p>` : ""}
          ${
            jurisdictions.length
              ? `<dl class="compact-definition-list">${jurisdictions
                  .map(
                    (item) => `<dt>${escapeHtml(item.agency ?? "Agency")}</dt><dd><strong>${escapeHtml(item.role ?? "Role")}</strong>${
                      item.notes ? `: ${escapeHtml(item.notes)}` : ""
                    }</dd>`
                  )
                  .join("")}</dl>`
              : ""
          }
        </article>`
            : ""
        }
      </div>
      ${
        data.data_availability_note
          ? `<aside class="data-availability"><strong>Data availability note:</strong> ${escapeHtml(data.data_availability_note)}</aside>`
          : ""
      }
      ${sources.length ? `<div class="source-chip-row">${sources.map((source) => `<a href="${escapeHtml(source.href)}" target="_blank" rel="noopener noreferrer">Source: ${escapeHtml(source.label)}</a>`).join("")}</div>` : ""}
    </div>
  </section>`;
}

function rankingOpportunitySection(city, region, isDui, basics) {
  if (!isDui) return "";

  const moAdminSources = [
    {
      label: "Missouri DOR DWI information",
      href: "https://dor.mo.gov/driver-license/revocation-reinstatement/dwi.html",
    },
    {
      label: "Missouri DOR Administrative Alcohol FAQ",
      href: "https://dor.mo.gov/faq/driver-license/administrative-alcohol.html",
    },
    {
      label: "Missouri Form 2385",
      href: "https://dor.mo.gov/forms/2385.pdf",
    },
  ];

  const ncDwiSources = [
    {
      label: "NCDMV license suspension",
      href: "https://www.ncdot.gov/dmv/license-id/license-suspension/Pages/",
    },
    {
      label: "NCGS 20-179.3 limited driving privilege",
      href: "https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_20/GS_20-179.3.pdf",
    },
  ];

  const sections = {
    "nixa-mo": {
      eyebrow: "Administrative hearing focus",
      title: "Nixa DWI administrative hearing and lawyer questions.",
      intro:
        "A Nixa DWI arrest can create a criminal court issue and a separate Missouri Department of Revenue license issue. The DOR says a Form 2385 hearing request is tied to a 15-day deadline, so drivers often look for administrative-hearing guidance before the first court date feels settled. A lawyer conversation should cover both the Christian County court path and the DOR license track.",
      cards: [
        [
          "DOR track",
          "The administrative track is about driving privileges and can move separately from the criminal case in Christian County or another local court.",
        ],
        [
          "Hearing request",
          "If Form 2385 is issued, the request for an administrative hearing should be checked immediately against the official DOR instructions.",
        ],
        [
          "Questions for counsel",
          "Ask whether the lawyer handles DOR administrative hearings, license stays, restricted driving options, and the local criminal court case together.",
        ],
        [
          "Hearing evidence",
          "Ask what records matter for the hearing, including officer paperwork, testing documents, notice forms, video, and any refusal or chemical-test issue.",
        ],
        [
          "Local court pairing",
          "A Nixa case may require tracking both the DOR deadline and the local court date, so readers should not assume one notice replaces the other.",
        ],
      ],
      sources: moAdminSources,
    },
    "moscow-mills-mo": {
      eyebrow: "Administrative hearing focus",
      title: "Moscow Mills DWI attorney questions and Missouri license hearing deadlines.",
      intro:
        "Moscow Mills searches are already showing interest in DWI attorney and administrative-hearing language. A local DWI case can create both a Lincoln County court issue and a separate Missouri DOR license issue, so readers should treat court paperwork and Form 2385 or DOR notices as separate items to check.",
      cards: [
        [
          "Attorney search intent",
          "A search for DWI attorney Moscow Mills usually means the reader needs help sorting citation paperwork, police records, court dates, and license deadlines.",
        ],
        [
          "Administrative hearing",
          "Missouri DOR hearing requests can be deadline-driven. Any Form 2385 or administrative alcohol paperwork should be reviewed before waiting for the court date.",
        ],
        [
          "Lincoln County court",
          "The official citation or court notice should control where to appear. Moscow Mills police records and the county court path may be separate practical steps.",
        ],
        [
          "Records to organize",
          "Useful documents may include the ticket, release paperwork, chemical-test or refusal paperwork, officer notices, crash details, towing information, and any DOR mailing.",
        ],
        [
          "Local context",
          "U.S. 61, Highway MM, Route C, and Main Street are useful Moscow Mills context when organizing where the stop happened and which agency may have records.",
        ],
      ],
      sources: moAdminSources,
    },
    "manchester-mo": {
      eyebrow: "Attorney search context",
      title: "Manchester DUI attorney searches and Missouri DWI wording.",
      intro:
        "People may search for a DUI attorney near Manchester even though Missouri commonly uses DWI language. This page uses both terms naturally so readers can connect the search phrase to the actual Missouri court and Department of Revenue process.",
      cards: [
        [
          "Local terminology",
          "A search for a Manchester DUI attorney may still point to Missouri DWI issues, including police paperwork, court settings, and license consequences.",
        ],
        [
          "Road context",
          "Manchester Road, Big Bend Road, I-270, and nearby West County commuter routes can shape where stops, crash reports, or records questions begin.",
        ],
        [
          "Attorney questions",
          "Ask whether the lawyer handles both St. Louis County court issues and Missouri DOR license deadlines after a DWI arrest.",
        ],
        [
          "Near-me search reality",
          "A near-me search should still be filtered by courthouse experience, DOR hearing knowledge, and familiarity with Manchester Police or West County traffic-stop records.",
        ],
      ],
      sources: moAdminSources.slice(0, 2),
    },
    "wentzville-mo": {
      eyebrow: "Traffic and license context",
      title: "Wentzville DWI lawyer questions, traffic charges, and license consequences.",
      intro:
        "A Wentzville traffic-law search can overlap with DWI issues when a stop involves alcohol testing, license paperwork, a crash, or multiple citations. This guide keeps the DWI focus while flagging the traffic and license documents readers may need to organize before asking a Wentzville DWI lawyer or traffic lawyer what happens next.",
      cards: [
        [
          "Citation stack",
          "A DWI stop can also involve traffic charges, towing paperwork, insurance questions, points, careless-and-imprudent allegations, or crash-report issues depending on the facts.",
        ],
        [
          "License paperwork",
          "Missouri DOR paperwork can matter even when the first visible concern is the traffic ticket or court date. Check any Form 2385 or DOR notice immediately.",
        ],
        [
          "Municipal and county court",
          "Wentzville-related cases may start with local police paperwork while the broader criminal court path can connect to St. Charles County procedures, so the court notice should control where to appear.",
        ],
        [
          "Local corridors",
          "I-70, I-64, U.S. Route 61, Wentzville Parkway, and Pearce Boulevard are useful roadway context for records and agency questions.",
        ],
        [
          "Traffic lawyer overlap",
          "If the search starts as traffic lawyer Wentzville MO, ask whether the issue is only a traffic ticket or whether alcohol testing, DOR paperwork, or a DWI allegation changes the strategy.",
        ],
        [
          "Municipal court search",
          "A Wentzville municipal court search should still be checked against the actual citation because DWI-related paperwork may involve different court or license-agency steps.",
        ],
      ],
      sources: moAdminSources,
    },
    "ofallon-mo": {
      eyebrow: "O'Fallon DWI search context",
      title: "O'Fallon DWI lawyer questions, court process, and license deadlines.",
      intro:
        "People searching for an O'Fallon DWI lawyer are usually trying to connect a local police stop, St. Charles County court paperwork, and Missouri Department of Revenue license deadlines. This section explains how O'Fallon DWI, DUI, traffic, and license-language searches fit together without turning the guide into a lawyer ranking page.",
      cards: [
        [
          "DWI vs DUI wording",
          "Missouri commonly uses DWI in official materials, but people still search for O'Fallon DUI lawyer, DWI lawyer, traffic lawyer, and drunk-driving defense help.",
        ],
        [
          "St. Charles County court",
          "O'Fallon Police paperwork may start locally, but the official court notice should control whether the case connects to St. Charles County court resources or another listed court path.",
        ],
        [
          "DOR hearing deadline",
          "Missouri Department of Revenue license paperwork can move separately from the court case, so any Form 2385 or DOR notice should be reviewed quickly.",
        ],
        [
          "Local road context",
          "I-70, Highway K, Bryan Road, Mexico Road, and Veterans Memorial Parkway are useful local context when organizing reports, stops, crash information, or agency questions.",
        ],
        [
          "Police records",
          "Ask what O'Fallon Police records, video, chemical-test documents, crash reports, towing records, or refusal paperwork may need to be requested.",
        ],
      ],
      sources: [
        ...moAdminSources,
        {
          label: "O'Fallon Police Department",
          href: "https://www.ofallon.mo.us/police",
        },
      ],
    },
    "st-charles-mo": {
      eyebrow: "St. Charles DWI search context",
      title: "St. Charles DWI lawyer questions, court process, and license hearing issues.",
      intro:
        "People searching for DWI in St. Charles or a St. Charles DWI lawyer are usually trying to connect police paperwork, St. Charles County court, Missouri Department of Revenue license deadlines, and what to ask before hiring counsel. The useful starting point is separating the criminal court path from the DOR administrative track.",
      cards: [
        [
          "DWI vs DUI wording",
          "Missouri official materials commonly use DWI, but readers may still search St. Charles DUI lawyer, DWI lawyer, drunk-driving attorney, or traffic lawyer.",
        ],
        [
          "Local records",
          "St. Charles Police records, crash reports, video, chemical-test paperwork, towing records, and citation details may all matter depending on the stop.",
        ],
        [
          "County court path",
          "The official citation or court notice should control the court date and location, especially when local police paperwork and St. Charles County court resources overlap.",
        ],
        [
          "DOR hearing track",
          "Missouri DOR license issues can move separately from court. Any Form 2385 or administrative alcohol notice should be checked quickly against official instructions.",
        ],
        [
          "Road context",
          "I-70, Route 94, Fifth Street, Zumbehl Road, and First Capitol Drive are useful St. Charles context when organizing records and agency questions.",
        ],
        [
          "Attorney questions",
          "Ask whether the lawyer handles St. Charles County DWI cases, DOR administrative hearings, refusal issues, license stays, chemical-test evidence, and local police records.",
        ],
      ],
      sources: [
        ...moAdminSources,
        {
          label: "St. Charles Police Department",
          href: "https://www.stcharlescitymo.gov/166/Police",
        },
      ],
    },
    "lake-saint-louis-mo": {
      eyebrow: "Lake Saint Louis DWI search context",
      title: "Lake Saint Louis DWI court, police-record, and license questions.",
      intro:
        "Lake Saint Louis DWI searches are often about the first practical steps after a local stop: which police department has records, how the St. Charles County court notice works, whether a Missouri DOR hearing deadline exists, and what questions to ask a DWI attorney.",
      cards: [
        [
          "Police report path",
          "If Lake Saint Louis Police handled the stop or crash, the department may be the starting point for local report, records, and video questions.",
        ],
        [
          "Court notice",
          "Use the citation or release paperwork to confirm the court path. Do not assume the police station, court, and license office are the same next step.",
        ],
        [
          "License deadline",
          "A Missouri DOR administrative alcohol issue can move on its own timeline, so Form 2385 or other DOR paperwork should be reviewed quickly.",
        ],
        [
          "Local corridors",
          "I-70, I-64, Lake Saint Louis Boulevard, Hawk Ridge Trail, and Veterans Memorial Parkway are useful context for traffic stops, crash reports, and records questions.",
        ],
        [
          "Attorney questions",
          "Ask whether the lawyer handles St. Charles County DWI cases, Lake Saint Louis Police records, DOR hearing requests, license options, and chemical-test paperwork.",
        ],
      ],
      sources: [
        ...moAdminSources,
        {
          label: "Lake Saint Louis Police Department",
          href: "https://www.lakesaintlouis.com/154/Police",
        },
      ],
    },
    "st-peters-mo": {
      eyebrow: "St. Peters DWI search context",
      title: "St. Peters DWI court, license, and police-record questions.",
      intro:
        "People searching for St. Peters DWI help are usually trying to understand local police records, St. Charles County court timing, Missouri DOR license consequences, and whether a DWI attorney should review the stop, testing, and paperwork before court.",
      cards: [
        [
          "St. Peters Police records",
          "Police reports, annual-report context, citation details, video references, crash records, and towing paperwork may matter depending on how the stop started.",
        ],
        [
          "St. Charles County court",
          "The court notice should control the next appearance. St. Peters Police paperwork may be local while the court path can point to county-level resources.",
        ],
        [
          "DOR administrative issue",
          "Missouri DOR license deadlines can be separate from court, especially when a Form 2385 or administrative alcohol notice is issued.",
        ],
        [
          "Road context",
          "I-70, Mexico Road, Mid Rivers Mall Drive, Salt River Road, and Spencer Road are useful local context for reports and agency questions.",
        ],
        [
          "Lawyer questions",
          "Ask about St. Peters DWI stops, St. Charles County court experience, DOR hearing requests, refusal or test issues, and license-restoration planning.",
        ],
      ],
      sources: [
        ...moAdminSources,
        {
          label: "St. Peters Police Department",
          href: "https://www.stpetersmo.net/254/Police-Department",
        },
      ],
    },
    "edwardsville-il": {
      eyebrow: "Attorney search context",
      title: "Edwardsville DUI lawyer questions for Madison County and license consequences.",
      intro:
        "People searching for an Edwardsville DUI lawyer are usually trying to understand court dates, statutory summary suspension risk, Edwardsville Police records, Illinois Secretary of State license consequences, and what to do before making decisions in court. The most useful next step is organizing the paperwork and asking focused questions about Madison County practice and the separate Illinois license track.",
      cards: [
        [
          "Madison County practice",
          "Ask how often the lawyer handles DUI cases in Madison County and whether they know the local court schedule, discovery process, and agency records path.",
        ],
        [
          "Statutory summary suspension",
          "Ask how Illinois statutory summary suspension works, when it can begin, and how it differs from the criminal DUI case.",
        ],
        [
          "Edwardsville Police records",
          "Ask whether the lawyer will request or review the Edwardsville Police report, stop basis, video, chemical-test paperwork, crash records, and any towing or impound documents.",
        ],
        [
          "Secretary of State track",
          "Ask what the Illinois Secretary of State license process may require for suspension, reinstatement, restricted permits, or alcohol-evaluation issues.",
        ],
      ],
      sources: [
        {
          label: "Illinois Secretary of State DUI information",
          href: "https://www.ilsos.gov/departments/drivers/traffic_safety/DUI/home.html",
        },
        {
          label: "Madison County Circuit Clerk",
          href: "https://www.madisoncountyil.gov/departments/circuit_clerk/index.php",
        },
      ],
    },
    "belleville-il": {
      eyebrow: "Belleville DUI charge context",
      title: "Belleville DUI charges, St. Clair County court, and license questions.",
      intro:
        "People searching for help with DUI charges in Belleville are usually trying to connect a police stop or citation to St. Clair County court, Illinois statutory summary suspension, local records, and Secretary of State license consequences. This section keeps those issues organized before a reader decides what questions to ask a Belleville DUI lawyer.",
      cards: [
        [
          "St. Clair County court",
          "Belleville is the county-seat anchor for this cluster, so readers should confirm the exact court date, courtroom, case number, and clerk information from the official notice.",
        ],
        [
          "DUI charge questions",
          "Ask what the current charge is, whether aggravating facts are alleged, whether a crash or injury is involved, and what discovery may show about the stop and testing.",
        ],
        [
          "Police records",
          "Belleville Police records, St. Clair County Sheriff's Department records, Illinois State Police records, video, chemical-test paperwork, towing records, or crash reports may matter depending on where the stop happened.",
        ],
        [
          "License suspension",
          "Illinois statutory summary suspension can move separately from the criminal DUI case, so any notice tied to the 46-day timing should be reviewed quickly.",
        ],
        [
          "Local road context",
          "Illinois Route 15, Illinois Route 159, Illinois Route 161, Illinois Route 13, I-64, downtown Belleville, and the Public Square courthouse area are useful local context for agency and records questions.",
        ],
        [
          "Lawyer questions",
          "Ask whether the lawyer handles St. Clair County DUI cases, statutory summary suspension hearings, police video, chemical-test evidence, and Secretary of State reinstatement or permit issues.",
        ],
      ],
      sources: [
        {
          label: "St. Clair County Courthouse",
          href: "https://www.illinoiscourts.gov/courts-directory/109/St-Clair-County-Courthouse/court/",
        },
        {
          label: "Belleville Police Department",
          href: "https://www.belleville.net/355/Police",
        },
        {
          label: "Illinois Secretary of State DUI information",
          href: "https://www.ilsos.gov/departments/drivers/traffic-safety/dui.html",
        },
      ],
    },
    "apex-nc": {
      eyebrow: "Consequences and probation context",
      title: "Apex DWI probation, dismissal, misdemeanor, and restricted-license questions.",
      intro:
        "People searching for Apex DWI dismissal, misdemeanor exposure, probation, or restricted-license issues are usually trying to understand what can happen after the stop. North Carolina DWI cases can involve Wake County court, punishment levels, probation conditions, a NCDMV license issue, and possible limited-driving-privilege questions.",
      cards: [
        [
          "Dismissal questions",
          "A dismissal depends on facts, procedure, evidence, and court rulings. The useful question is what might affect the stop, arrest, testing, witness proof, video, or admissibility of evidence.",
        ],
        [
          "Misdemeanor does not mean minor",
          "Many North Carolina DWI cases are misdemeanors, but punishment level, prior history, aggravating factors, and license consequences can still make the case serious.",
        ],
        [
          "Probation and punishment levels",
          "North Carolina DWI sentencing uses punishment levels. Probation terms can include assessment, treatment, monitoring, community service, or active time depending on the level and facts.",
        ],
        [
          "Restricted license questions",
          "A limited driving privilege is a court order under North Carolina law. Eligibility and terms depend on the revocation, timing, case facts, and statutory requirements.",
        ],
        [
          "Documents to gather",
          "Useful defense-resource questions include what police records, video, chemical-test evidence, witness details, release paperwork, and NCDMV notices should be gathered before court.",
        ],
        [
          "Case outcomes and updates",
          "Possible outcomes depend on the facts, evidence, punishment level, prior history, and current North Carolina law, so readers should verify official sources before relying on old articles or forum posts.",
        ],
        [
          "Spanish-language searches",
          "Some people search for Apex DWI help in Spanish. This guide is in English, but callers can ask any attorney whether Spanish-language consultation or translation support is available.",
        ],
      ],
      sources: [
        {
          label: "North Carolina State Highway Patrol DWI law summary",
          href: "https://www.ncshp.gov/ncshp/commercial-vehicles/laws",
        },
        {
          label: "NCDMV license suspension",
          href: "https://www.ncdot.gov/dmv/license-id/license-suspension/Pages/",
        },
        {
          label: "NCGS 20-179.3 limited driving privilege",
          href: "https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_20/GS_20-179.3.pdf",
        },
      ],
    },
    "north-raleigh-nc": {
      eyebrow: "North Raleigh DWI search context",
      title: "North Raleigh DWI arrests, Wake County court, and restricted-license questions.",
      intro:
        "North Raleigh DWI searches are often broad because readers may type Raleigh DWI, DWI Raleigh NC, DWI arrest Raleigh, or restricted license after a Raleigh DWI. The practical next step is the same: identify the police agency, confirm the Wake County court notice, preserve DWI paperwork, and separate court issues from NCDMV license consequences.",
      cards: [
        [
          "Raleigh Police records",
          "A North Raleigh stop may involve Raleigh Police paperwork, crash records, video references, chemical-test records, or citation details that should be saved before court.",
        ],
        [
          "Wake County court",
          "The official court notice should control the date and location. North Raleigh readers should not rely only on a generic Raleigh search result when the citation gives a specific court path.",
        ],
        [
          "NCDMV license track",
          "North Carolina DWI cases can create license consequences outside the ordinary court timeline, including civil revocation and limited-driving-privilege questions.",
        ],
        [
          "Restricted license searches",
          "A restricted-license or limited-driving-privilege question should be checked against official North Carolina law and the specific facts before assuming eligibility.",
        ],
        [
          "Road context",
          "I-540, U.S. 1/Capital Boulevard, Six Forks Road, Falls of Neuse Road, Creedmoor Road, and Glenwood Avenue are useful North Raleigh context for records and agency questions.",
        ],
        [
          "Lawyer questions",
          "Ask whether the lawyer handles Wake County DWI cases, Raleigh Police records, NCDMV consequences, punishment levels, probation conditions, and limited-driving-privilege issues.",
        ],
      ],
      sources: [
        {
          label: "Raleigh Police Department",
          href: "https://raleighnc.gov/police",
        },
        {
          label: "North Carolina Judicial Branch - Wake County",
          href: "https://www.nccourts.gov/locations/wake-county",
        },
        {
          label: "NCDMV license suspension",
          href: "https://www.ncdot.gov/dmv/license-id/license-suspension/Pages/",
        },
      ],
    },
    "knightdale-nc": {
      eyebrow: "Knightdale DWI search context",
      title: "Knightdale DWI lawyer questions, Wake County court, and license issues.",
      intro:
        "Knightdale DWI searches are starting to show Wake County and Spanish-language legal-representation intent. The practical path is to identify the police agency, confirm the Wake County court notice, save DWI paperwork, and track NCDMV consequences separately from the criminal case.",
      cards: [
        [
          "Knightdale Police records",
          "If Knightdale Police handled the stop or crash, the department may be the starting point for report, video, citation, crash-record, and records questions.",
        ],
        [
          "Wake County court",
          "The official court notice should control the court date and location. Knightdale police paperwork and Wake County court tasks may require separate follow-up.",
        ],
        [
          "NCDMV license track",
          "North Carolina DWI cases can involve license consequences outside the ordinary court timeline, including civil revocation and limited-driving-privilege questions.",
        ],
        [
          "Spanish-language searches",
          "Some people search for DWI legal representation in Spanish. Ask any attorney or law firm whether Spanish-language consultation or translation support is available.",
        ],
        [
          "Attorney questions",
          "Ask about Wake County DWI experience, Knightdale Police records, chemical-test evidence, punishment levels, probation conditions, and limited-driving-privilege issues.",
        ],
      ],
      sources: [
        {
          label: "Knightdale Police Department",
          href: "https://www.knightdalenc.gov/police",
        },
        {
          label: "North Carolina Judicial Branch - Wake County",
          href: "https://www.nccourts.gov/locations/wake-county",
        },
        {
          label: "NCDMV license suspension",
          href: "https://www.ncdot.gov/dmv/license-id/license-suspension/Pages/",
        },
      ],
    },
    "rolesville-nc": {
      eyebrow: "Rolesville DWI search context",
      title: "Rolesville DWI representation, Wake County court, and license questions.",
      intro:
        "Rolesville DWI searches are starting to overlap with legal-representation, Spanish-language, and Wake County court intent. The useful path is practical: identify whether Rolesville Police or another agency handled the stop, confirm the Wake County court notice, preserve DWI paperwork, and track NCDMV license consequences separately from the criminal case.",
      cards: [
        [
          "Rolesville Police records",
          "If Rolesville Police handled the stop or crash, the department may be the starting point for report, citation, crash-record, video, and local records questions.",
        ],
        [
          "Wake County court",
          "Criminal court questions should be checked against the official citation or court notice. A Rolesville police contact and the Wake County court path can require different follow-up steps.",
        ],
        [
          "NCDMV license track",
          "North Carolina DWI cases can create license consequences outside the ordinary court timeline, including civil revocation and limited-driving-privilege questions.",
        ],
        [
          "U.S. 401 context",
          "U.S. 401/Louisburg Road, Rolesville Road, Main Street, Jones Dairy Road, and Mitchell Mill Road are useful local context for records and agency questions.",
        ],
        [
          "Spanish-language searches",
          "Some readers search for legal representation using Spanish terms. Ask any attorney or law firm whether Spanish-language consultation or translation support is available.",
        ],
        [
          "Attorney questions",
          "Ask about Wake County DWI experience, Rolesville Police records, chemical-test evidence, punishment levels, probation conditions, and limited-driving-privilege issues.",
        ],
      ],
      sources: [
        ...ncDwiSources,
        {
          label: "Rolesville Police Department",
          href: "https://www.rolesvillenc.gov/police",
        },
        {
          label: "Wake County Justice Center",
          href: "https://www.nccourts.gov/locations/wake-county/wake-county-justice-center",
        },
      ],
    },
    "wake-forest-nc": {
      eyebrow: "Wake Forest DWI enforcement context",
      title: "Wake Forest DWI traffic enforcement, Wake County court, and license questions.",
      intro:
        "Wake Forest DWI searches deserve a more specific answer than a generic Wake County page. Wake Forest Police publish traffic-enforcement context, including a DWI Traffic Team, while court paperwork still points readers back to the Wake County court system and license consequences can move through NCDMV separately.",
      cards: [
        [
          "Traffic Enforcement Unit",
          "Wake Forest Police describe a Traffic Enforcement Unit with a DWI Traffic Team focused on impaired-driving enforcement in town.",
        ],
        [
          "Wake County court",
          "The official court notice should control the date and location. Wake Forest police paperwork and Wake County criminal court tasks may be separate practical steps.",
        ],
        [
          "NCDMV license track",
          "North Carolina DWI cases can involve license consequences outside the criminal court timeline, including civil revocation and limited-driving-privilege questions.",
        ],
        [
          "Local road context",
          "Capital Boulevard, U.S. 1, NC 98, S. Main Street, and Rogers Road are useful Wake Forest context for organizing reports, stops, and agency questions.",
        ],
        [
          "Records to organize",
          "Useful documents may include the citation, release paperwork, chemical-test paperwork, crash details, towing records, video references, and NCDMV notices.",
        ],
        [
          "Attorney questions",
          "Ask about Wake County DWI experience, Wake Forest Police records, traffic-enforcement evidence, license consequences, and limited-driving-privilege options.",
        ],
      ],
      sources: [
        ...ncDwiSources,
        {
          label: "Wake Forest Police Traffic Enforcement Unit",
          href: "https://www.wakeforestnc.gov/police/operations/special-operations/impact-division/traffic-enforcement-unit",
        },
        {
          label: "Wake Forest Police DWI enforcement release",
          href: "https://www.wakeforestnc.gov/news/wake-forest-police-warn-motorists-not-drink-drive-after-10-dwi-weekend-arrests",
        },
        {
          label: "Wake County Justice Center",
          href: "https://www.nccourts.gov/locations/wake-county/wake-county-justice-center",
        },
      ],
    },
    "concord-nc": {
      eyebrow: "Cabarrus County DWI search context",
      title: "Concord DWI court, police-record, and license questions.",
      intro:
        "Concord DWI searches should start by separating Concord Police records from Cabarrus County court and NCDMV license consequences. The city page is built around the courthouse in Concord, local police paperwork, and the practical documents a driver may need before asking a lawyer what happens next.",
      cards: [
        ["Police records", "Concord Police may be the starting point for the report, citation, crash details, video, or local records questions tied to a city stop."],
        ["County court", "The official court notice should control the Cabarrus County court date and location, even when the stop began with city police."],
        ["NCDMV track", "North Carolina DWI cases can create license consequences separately from court, including civil revocation and limited-driving-privilege questions."],
        ["Road context", "I-85, U.S. 29, NC 49, Concord Parkway, Cabarrus Avenue, and Church Street are useful context for agency and records questions."],
        ["Lawyer questions", "Ask about Cabarrus County DWI practice, Concord Police records, chemical-test evidence, punishment levels, and license options."],
      ],
      sources: [
        ...ncDwiSources,
        { label: "Cabarrus County Courthouse", href: "https://www.nccourts.gov/locations/cabarrus-county/cabarrus-county-courthouse" },
        { label: "Concord Police Department", href: "https://concordnc.gov/Departments/Police" },
      ],
    },
    "kannapolis-nc": {
      eyebrow: "Cabarrus County DWI search context",
      title: "Kannapolis DWI police records, court, and license questions.",
      intro:
        "A Kannapolis DWI search usually means the reader needs to connect Kannapolis Police paperwork, Cabarrus County court resources, and NCDMV license questions without confusing those offices as one process.",
      cards: [
        ["Police records", "Kannapolis Police may be the starting point for report, crash-record, video, citation, or local enforcement questions."],
        ["County court", "Cabarrus County court timing should be confirmed from the citation, release paperwork, or official court resources."],
        ["License issue", "NCDMV consequences may move on a separate timeline from court, so civil revocation or limited-driving-privilege questions should be tracked early."],
        ["Local corridors", "I-85, U.S. 29, Dale Earnhardt Boulevard, Cannon Boulevard, and Main Street are useful context for records and agency questions."],
        ["Attorney questions", "Ask whether the lawyer handles Kannapolis DWI cases, Cabarrus County court, police records, testing issues, and license consequences."],
      ],
      sources: [
        ...ncDwiSources,
        { label: "Cabarrus County Courthouse", href: "https://www.nccourts.gov/locations/cabarrus-county/cabarrus-county-courthouse" },
        { label: "Kannapolis Police Department", href: "https://www.kannapolisnc.gov/Government-Departments/Police" },
      ],
    },
    "harrisburg-nc": {
      eyebrow: "Cabarrus sheriff and court context",
      title: "Harrisburg DWI sheriff records, Cabarrus court, and license questions.",
      intro:
        "Harrisburg is not just a city-name swap from Concord. The town's law-enforcement setup points readers toward Cabarrus County Sheriff's Office resources, while the court and NCDMV questions still need to be tracked separately.",
      cards: [
        ["Sheriff coverage", "Harrisburg law-enforcement questions often begin with Cabarrus County Sheriff's Office rather than a standalone town police department."],
        ["Court notice", "The citation or court notice should control the Cabarrus County court path and appearance details."],
        ["License timing", "Civil revocation and limited-driving-privilege issues can arise separately from the criminal case."],
        ["Road context", "NC 49, Roberta Road, Morehead Road, Harrisburg Veterans Road, and Rocky River Road give the page specific local context."],
        ["Lawyer questions", "Ask about sheriff records, Cabarrus County DWI practice, chemical-test evidence, court deadlines, and NCDMV consequences."],
      ],
      sources: [
        ...ncDwiSources,
        { label: "Harrisburg law enforcement", href: "https://www.harrisburgnc.gov/167/Law-Enforcement" },
        { label: "Cabarrus County Courthouse", href: "https://www.nccourts.gov/locations/cabarrus-county/cabarrus-county-courthouse" },
      ],
    },
    "mount-pleasant-nc": {
      eyebrow: "Cabarrus sheriff and court context",
      title: "Mount Pleasant DWI sheriff records, court, and NCDMV questions.",
      intro:
        "Mount Pleasant DWI questions need local sheriff-contract context, Cabarrus County court orientation, and NCDMV license separation. That makes the page materially different from the Concord and Kannapolis city-police pages.",
      cards: [
        ["Sheriff records", "Mount Pleasant public-safety context points to Cabarrus County Sheriff's Department for enhanced community policing."],
        ["County court", "Use the court notice to confirm Cabarrus County court date, location, and appearance requirements."],
        ["License issue", "NCDMV consequences should be tracked apart from court, especially when civil revocation or limited-driving-privilege questions exist."],
        ["Local roads", "NC 49, NC 73, Main Street, Franklin Street, and Mount Pleasant Road are useful for records and stop-location questions."],
        ["Attorney questions", "Ask whether a lawyer handles sheriff records, Cabarrus County DWI cases, chemical-test evidence, punishment levels, and license issues."],
      ],
      sources: [
        ...ncDwiSources,
        { label: "Mount Pleasant public safety", href: "https://mtpleasantnc.gov/Government/Public-Safety" },
        { label: "Cabarrus County Courthouse", href: "https://www.nccourts.gov/locations/cabarrus-county/cabarrus-county-courthouse" },
      ],
    },
    "midland-nc": {
      eyebrow: "Cabarrus sheriff and court context",
      title: "Midland DWI sheriff records, NC 24/27, and license questions.",
      intro:
        "Midland DWI searches should identify whether Cabarrus County deputies, state patrol, or another agency handled the stop before turning to court and license questions. The local context is centered on NC 24/27 and county-service routing.",
      cards: [
        ["Agency first", "Midland readers should confirm whether Cabarrus County Sheriff's Office, state patrol, or another agency created the paperwork."],
        ["Cabarrus court", "The Cabarrus County court path should be checked against the official citation or court notice."],
        ["NCDMV issue", "License consequences can move separately from the court case and may affect driving before final resolution."],
        ["Road context", "NC 24/27, Bethel School Road, Midland Road, U.S. 601, and Flowes Store Road are useful local context."],
        ["Lawyer questions", "Ask about Cabarrus County DWI defense, sheriff records, stop location, chemical testing, and limited-driving-privilege options."],
      ],
      sources: [
        ...ncDwiSources,
        { label: "Cabarrus County Sheriff's Office", href: "https://www.cabarruslaw.us/" },
        { label: "Cabarrus County Courthouse", href: "https://www.nccourts.gov/locations/cabarrus-county/cabarrus-county-courthouse" },
      ],
    },
    "durham-nc": {
      eyebrow: "Durham DWI search context",
      title: "Durham DWI police records, county court, and license questions.",
      intro:
        "Durham DWI searches should connect Durham Police records, Durham County court, and NCDMV consequences without blending them into one step. This page keeps those paths separate and local.",
      cards: [
        ["Durham Police records", "Durham Police may be the starting point for reports, crash records, video, citation details, or local enforcement questions."],
        ["Durham County court", "The official court notice should control the courthouse, court date, and appearance requirements."],
        ["NCDMV track", "A DWI can create civil revocation and limited-driving-privilege questions outside the criminal court timeline."],
        ["Road context", "NC 147, I-85, U.S. 15-501, Roxboro Street, Main Street, and Fayetteville Street are useful local context."],
        ["Attorney questions", "Ask about Durham County DWI practice, Durham Police records, chemical-test evidence, punishment levels, and NCDMV license issues."],
      ],
      sources: [
        ...ncDwiSources,
        { label: "Durham County Courthouse", href: "https://www.nccourts.gov/locations/durham-county/durham-county-courthouse" },
        { label: "Durham Police Department", href: "https://www.durhamnc.gov/149/Police" },
      ],
    },
    "chapel-hill-nc": {
      eyebrow: "Orange County DWI search context",
      title: "Chapel Hill DWI police records, Orange County court, and license questions.",
      intro:
        "Chapel Hill DWI searches often involve college-town traffic, Franklin Street context, Chapel Hill Police records, Orange County court, and NCDMV license consequences. The page separates the town record path from the county court path.",
      cards: [
        ["Chapel Hill Police records", "Chapel Hill Police may be the starting point for report, crash, video, citation, or town enforcement questions."],
        ["Orange County court", "The official court notice should confirm the Orange County courthouse path and court date."],
        ["License issue", "NCDMV consequences can move separately from court, including civil revocation and limited-driving-privilege questions."],
        ["Local corridors", "U.S. 15-501, NC 54, Franklin Street, Fordham Boulevard, and Martin Luther King Jr Boulevard are useful local context."],
        ["Lawyer questions", "Ask about Orange County DWI practice, Chapel Hill Police records, campus-area context, chemical testing, and license issues."],
      ],
      sources: [
        ...ncDwiSources,
        { label: "Orange County Courthouse", href: "https://www.nccourts.gov/locations/orange-county/orange-county-courthouse" },
        { label: "Chapel Hill Police Department", href: "https://www.chapelhillnc.gov/Town-Government/Departments-and-Offices/Police" },
      ],
    },
    "carrboro-nc": {
      eyebrow: "Orange County DWI search context",
      title: "Carrboro DWI police records, Orange County court, and license questions.",
      intro:
        "Carrboro DWI searches need a town-level records path and an Orange County court path. The practical next step is saving the police paperwork, confirming court timing, and separating NCDMV license issues from the criminal case.",
      cards: [
        ["Carrboro Police records", "Carrboro Police may be the first records source for local reports, citation details, video references, or crash questions."],
        ["Orange County court", "Court date and courthouse details should be checked against the official notice rather than assumed from a general Chapel Hill search."],
        ["NCDMV issue", "Civil revocation and limited-driving-privilege questions can arise before the criminal case is finished."],
        ["Local roads", "NC 54, Main Street, N. Greensboro Street, Jones Ferry Road, and Weaver Street give the page specific Carrboro context."],
        ["Attorney questions", "Ask whether the lawyer handles Orange County DWI cases, Carrboro Police records, chemical-test evidence, and license consequences."],
      ],
      sources: [
        ...ncDwiSources,
        { label: "Orange County Courthouse", href: "https://www.nccourts.gov/locations/orange-county/orange-county-courthouse" },
        { label: "Carrboro Police Department", href: "https://www.carrboronc.gov/225/Police" },
      ],
    },
    "hillsborough-nc": {
      eyebrow: "Orange County DWI search context",
      title: "Hillsborough DWI police records, Orange County court, and license questions.",
      intro:
        "Hillsborough is the Orange County courthouse anchor, so a DWI search here can involve both town police records and the county court building. The useful path is confirming the agency, the court notice, and the NCDMV license issue separately.",
      cards: [
        ["Hillsborough Police records", "Hillsborough Police may be the starting point for local report, crash, citation, video, or records questions."],
        ["Courthouse anchor", "The Orange County Courthouse is in Hillsborough, but the citation or court notice should still control the date and room details."],
        ["License issue", "NCDMV consequences can move separately from court and may involve civil revocation or limited-driving-privilege questions."],
        ["Local roads", "I-85, I-40, Churton Street, U.S. 70, and NC 86 are useful local context for records and stop-location questions."],
        ["Lawyer questions", "Ask about Orange County DWI practice, Hillsborough Police records, chemical testing, punishment levels, and NCDMV consequences."],
      ],
      sources: [
        ...ncDwiSources,
        { label: "Orange County Courthouse", href: "https://www.nccourts.gov/locations/orange-county/orange-county-courthouse" },
        { label: "Hillsborough Police Department", href: "https://www.hillsboroughnc.gov/about-us/contact-us/contact-police" },
      ],
    },
    "cary-nc": {
      eyebrow: "Cary DWI search context",
      title: "Cary DWI lawyer questions and Wake County license issues.",
      intro:
        "People searching for a Cary DWI lawyer are usually trying to connect Wake County court timing, Cary Police records, NCDMV license consequences, and defense documents before making a hiring decision.",
      cards: [
        [
          "Lawyer-selection questions",
          "Ask whether the lawyer handles Cary and Wake County DWI cases, punishment-level analysis, probation questions, limited driving privilege, chemical testing, and refusal issues.",
        ],
        [
          "Wake County court context",
          "A Cary DWI case may start with local police paperwork while the court process connects to Wake County resources and the specific court notice.",
        ],
        [
          "License consequences",
          "North Carolina DWI cases can involve NCDMV consequences separately from the court case, so license notices and limited-driving-privilege questions should be tracked early.",
        ],
        [
          "Defense records",
          "Useful records may include the citation, release paperwork, police report, video references, chemical-test documents, refusal paperwork, and any crash report.",
        ],
      ],
      sources: [
        {
          label: "North Carolina State Highway Patrol DWI law summary",
          href: "https://www.ncshp.gov/ncshp/commercial-vehicles/laws",
        },
        {
          label: "NCDMV license suspension",
          href: "https://www.ncdot.gov/dmv/license-id/license-suspension/Pages/",
        },
      ],
    },
    "fuquay-varina-nc": {
      eyebrow: "Fuquay-Varina DWI checklist",
      title: "Fuquay-Varina DWI court, license, and records checklist.",
      intro:
        "A Fuquay-Varina DWI search often starts with a simple question: what needs to be handled first? This page separates the local police records path, Wake County court notice, NCDMV license issues, and documents to gather before a lawyer conversation.",
      cards: [
        [
          "Court notice",
          "Use the citation, release paperwork, or North Carolina Judicial Branch record to confirm the Wake County court date and appearance requirements.",
        ],
        [
          "Fuquay-Varina Police records",
          "If Fuquay-Varina Police handled the stop or crash, the department may be the starting point for local report and records questions.",
        ],
        [
          "License track",
          "A DWI arrest can create NCDMV issues separately from the court case, so license notices and limited-driving-privilege questions should be reviewed early.",
        ],
        [
          "Documents to bring",
          "Gather the citation, release paperwork, chemical-test or refusal paperwork, crash information, witness names, and any NCDMV notice before asking for legal advice.",
        ],
      ],
      sources: [
        {
          label: "North Carolina Judicial Branch - Wake County",
          href: "https://www.nccourts.gov/locations/wake-county",
        },
        {
          label: "NCDMV license suspension",
          href: "https://www.ncdot.gov/dmv/license-id/license-suspension/Pages/",
        },
      ],
    },
    "holly-springs-nc": {
      eyebrow: "Holly Springs DWI rights context",
      title: "Holly Springs DWI rights, records, court, and license questions.",
      intro:
        "People searching for Holly Springs DWI rights are usually trying to understand what to save, what not to miss, and which offices may matter after a stop. The practical path is to keep the police paperwork, confirm the Wake County court date, and separate NCDMV license issues from the criminal case.",
      cards: [
        [
          "Right to legal advice",
          "A reader should not rely on court staff, police, or this guide for legal advice. A licensed North Carolina attorney can explain rights and options for the specific facts.",
        ],
        [
          "Records and evidence",
          "Holly Springs Police records, video references, chemical-test paperwork, witness details, towing records, or crash reports may matter depending on what happened.",
        ],
        [
          "Court date",
          "The official Wake County court notice should control the court date, location, and appearance requirements.",
        ],
        [
          "License questions",
          "NCDMV consequences can move separately from court, so civil revocation and limited-driving-privilege questions should be tracked early.",
        ],
      ],
      sources: [
        {
          label: "North Carolina Judicial Branch - Wake County",
          href: "https://www.nccourts.gov/locations/wake-county",
        },
        {
          label: "NCDMV license suspension",
          href: "https://www.ncdot.gov/dmv/license-id/license-suspension/Pages/",
        },
      ],
    },
    "pineville-nc": {
      eyebrow: "Pineville DWI search context",
      title: "Pineville DWI lawyer questions and Mecklenburg County process.",
      intro:
        "People searching for a Pineville DWI lawyer are usually trying to connect local police records, Mecklenburg County court timing, North Carolina DWI consequences, and license questions after an arrest.",
      cards: [
        [
          "Local agency records",
          "Start by confirming which agency handled the stop, arrest, crash, or report before assuming where records should be requested.",
        ],
        [
          "County court path",
          "The official court notice should control the court location and date, especially when local police paperwork and county court procedures overlap.",
        ],
        [
          "DWI consequences",
          "A misdemeanor DWI can still involve punishment levels, probation conditions, insurance consequences, and NCDMV license issues.",
        ],
        [
          "Questions for counsel",
          "Ask about Mecklenburg County DWI experience, police records, chemical testing, limited driving privilege, and what deadlines should be handled first.",
        ],
      ],
      sources: [
        {
          label: "North Carolina State Highway Patrol DWI law summary",
          href: "https://www.ncshp.gov/ncshp/commercial-vehicles/laws",
        },
        {
          label: "NCDMV license suspension",
          href: "https://www.ncdot.gov/dmv/license-id/license-suspension/Pages/",
        },
      ],
    },
  };

  const content = sections[city.slug];
  if (!content) return "";

  return `<section class="section section-alt" id="ranking-opportunity">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">${escapeHtml(content.eyebrow)}</p>
        <h2>${escapeHtml(content.title)}</h2>
        <p>${escapeHtml(content.intro)}</p>
      </div>
      <div class="card-grid three-up">${content.cards.map((item) => `<article class="info-card"><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`).join("")}</div>
      <div class="source-chip-row">${content.sources.map((source) => `<a href="${escapeHtml(source.href)}" target="_blank" rel="noopener noreferrer">Source: ${escapeHtml(source.label)}</a>`).join("")}</div>
    </div>
  </section>`;
}

function personalInjuryOpportunitySection(city, region, isDui) {
  if (isDui) return "";

  if (city.slug === "edwardsville-il") {
    return `<section class="section section-alt" id="ranking-opportunity">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Edwardsville injury search context</p>
        <h2>Edwardsville personal injury questions before talking to insurance.</h2>
        <p>People searching for personal injury help in Edwardsville are often trying to understand medical documentation, insurance calls, crash reports, missed work, and whether a Madison County filing deadline could matter later.</p>
      </div>
      <div class="card-grid three-up">
        <article class="info-card"><h3>Insurance adjuster questions</h3><p>Before giving a recorded statement or signing a release, organize claim numbers, adjuster letters, photos, medical bills, wage records, and any repair estimate or total-loss paperwork.</p></article>
        <article class="info-card"><h3>Madison County crash reports</h3><p>If Edwardsville Police handled the scene, the city police department may be the starting point. If the crash happened on an interstate, county road, or outside city limits, Madison County Sheriff or Illinois State Police may be involved.</p></article>
        <article class="info-card"><h3>Local accident corridors</h3><p>Route 157, Route 159, I-55, I-70, I-255, Governors' Parkway, Troy Road, downtown Edwardsville, and SIUE-area traffic are useful local context for reports and insurance questions.</p></article>
        <article class="info-card"><h3>Medical documentation</h3><p>Emergency room records, urgent-care notes, follow-up treatment, therapy records, prescriptions, mileage, and work restrictions can all matter if the injury claim is disputed.</p></article>
        <article class="info-card"><h3>Government-property warning</h3><p>Claims involving a public vehicle, sidewalk, school, county property, courthouse area, or public employee may involve different notice rules or shorter practical deadlines.</p></article>
        <article class="info-card"><h3>Should I talk to insurance?</h3><p>Insurance contact is common after a crash, but recorded statements, broad medical authorizations, and quick settlement offers should be reviewed carefully before decisions are made.</p></article>
      </div>
      <div class="source-chip-row">
        <a href="https://www.cityofedwardsville.com/217/Police" target="_blank" rel="noopener noreferrer">Source: Edwardsville Police</a>
        <a href="https://www.madisoncountyil.gov/departments/circuit_clerk/index.php" target="_blank" rel="noopener noreferrer">Source: Madison County Circuit Clerk</a>
        <a href="https://isp.illinois.gov/" target="_blank" rel="noopener noreferrer">Source: Illinois State Police</a>
      </div>
    </div>
  </section>`;
  }

  if (city.slug !== "apex-nc") return "";

  return `<section class="section section-alt" id="ranking-opportunity">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Apex injury search context</p>
        <h2>Apex personal injury questions after a crash or accident.</h2>
        <p>People searching for personal injury help in Apex are often trying to organize medical care, insurance calls, crash reports, and whether Wake County court deadlines could matter later.</p>
      </div>
      <div class="card-grid three-up">
        <article class="info-card"><h3>Crash and incident reports</h3><p>If Apex Police handled the scene, the department may be the starting point for a local report. If the incident happened outside town limits, Wake County or North Carolina State Highway Patrol may be involved.</p></article>
        <article class="info-card"><h3>Insurance pressure</h3><p>Insurance adjusters may ask for recorded statements, broad medical authorizations, or quick settlement decisions before the full injury picture is clear.</p></article>
        <article class="info-card"><h3>Local road context</h3><p>U.S. 64, NC 55, Apex Peakway, Salem Street, and Ten Ten Road are useful roadway context for report, records, and insurance questions.</p></article>
      </div>
      <div class="source-chip-row">
        <a href="https://www.apexnc.org/261/Police-Department" target="_blank" rel="noopener noreferrer">Source: Apex Police Department</a>
        <a href="https://www.nccourts.gov/locations/wake-county" target="_blank" rel="noopener noreferrer">Source: North Carolina Judicial Branch - Wake County</a>
      </div>
    </div>
  </section>`;
}

function targetedDuiFaqs(city, region, basics) {
  const sharedMissouriAdminAnswer =
    "Missouri DWI cases can create a criminal court track and a separate Department of Revenue license track. Any Form 2385 or DOR notice should be checked quickly against official hearing-request instructions.";

  if (city.slug === "apex-nc") {
    return [
      {
        q: "What are common Apex DUI consequences?",
        a: "Apex DWI consequences can involve Wake County court, punishment-level analysis, fines, probation conditions, possible active time, substance-use assessment or treatment requirements, insurance issues, and NCDMV license consequences.",
      },
      {
        q: "Can DWI probation apply in Apex?",
        a: "Probation can be part of a North Carolina DWI sentence depending on the punishment level and facts. Conditions may include assessment, treatment, monitoring, community service, fees, and compliance with court orders.",
      },
      {
        q: "Can an Apex DWI be dismissed?",
        a: "A dismissal depends on the evidence, procedure, witness availability, testing issues, and legal rulings. A lawyer may review the stop, arrest, chemical testing, video, and court file to identify possible defenses.",
      },
      {
        q: "Is an Apex DWI a misdemeanor?",
        a: "Many North Carolina DWI cases are charged as misdemeanors, but the consequences can still be serious because punishment levels, aggravating factors, prior history, and license consequences can change the practical outcome.",
      },
      {
        q: "What should I ask a DWI lawyer in Apex?",
        a: "Ask whether the lawyer handles Wake County DWI cases, limited driving privilege issues, NCDMV consequences, probation conditions, chemical-test evidence, and possible dismissal or reduction arguments.",
      },
      {
        q: "What Apex DWI defense resources should I gather?",
        a: "Useful defense resources may include the citation, release paperwork, police agency information, crash report details, chemical-test paperwork, video references, witness names, and NCDMV notices.",
      },
      {
        q: "Can an Apex DWI affect work, school, or transportation?",
        a: "Yes. Even before a case is resolved, a DWI can create transportation, insurance, employment, school, and family-logistics problems, especially if license consequences or probation conditions are involved.",
      },
      {
        q: "What if I searched in Spanish for Apex DWI help?",
        a: "This guide is written in English, but Spanish-language searches can still point to the same Apex court, police, and NCDMV issues. Ask any attorney or law firm whether Spanish-language consultation or translation support is available.",
      },
    ];
  }

  if (city.slug === "wentzville-mo") {
    return [
      {
        q: "Can a Wentzville DWI also involve traffic charges?",
        a: "Yes. A DWI stop can also involve traffic citations, careless-and-imprudent allegations, crash reports, towing paperwork, insurance questions, points, or other records that should be organized before court.",
      },
      {
        q: "Is Wentzville municipal court the same as the St. Charles County court process?",
        a: "The correct court depends on the citation and official notice. Wentzville police paperwork may be local, while broader criminal procedure can connect to St. Charles County court resources, so the court notice should control where to appear.",
      },
      {
        q: "Should I ask a traffic lawyer or a DWI lawyer in Wentzville?",
        a: "If alcohol testing, DOR paperwork, refusal, license consequences, or a DWI allegation is involved, ask whether the lawyer handles both traffic charges and Missouri DWI defense.",
      },
      {
        q: "Can Missouri DOR license issues happen separately from Wentzville court?",
        a: sharedMissouriAdminAnswer,
      },
    ];
  }

  if (city.slug === "ofallon-mo") {
    return [
      {
        q: "Why do people search for an O'Fallon DWI lawyer?",
        a: "An O'Fallon DWI search usually means the reader is trying to understand local police paperwork, St. Charles County court timing, Missouri Department of Revenue license consequences, and what records to gather before court.",
      },
      {
        q: "Is O'Fallon DWI the same as O'Fallon DUI?",
        a: "Missouri commonly uses DWI in official materials, while many people still search DUI. The practical issue is whether the case involves impaired-driving allegations, alcohol or drug evidence, license paperwork, or related traffic charges.",
      },
      {
        q: "Can O'Fallon DWI license issues move separately from court?",
        a: sharedMissouriAdminAnswer,
      },
      {
        q: "What should I ask a lawyer after an O'Fallon DWI arrest?",
        a: "Ask about St. Charles County DWI experience, O'Fallon Police records, DOR hearing deadlines, Form 2385, testing or refusal issues, traffic charges, and possible license options.",
      },
    ];
  }

  if (city.slug === "st-charles-mo") {
    return [
      {
        q: "What should I ask a St. Charles DWI lawyer?",
        a: "Ask about St. Charles County DWI experience, St. Charles Police records, Missouri DOR administrative hearing deadlines, Form 2385, refusal issues, chemical-test paperwork, and license options.",
      },
      {
        q: "Can a St. Charles DWI create a license hearing issue?",
        a: sharedMissouriAdminAnswer,
      },
      {
        q: "What records matter after a St. Charles DWI stop?",
        a: "Useful records may include the citation, release paperwork, St. Charles Police report, video, chemical-test or refusal paperwork, crash records, towing documents, and any DOR notice.",
      },
      {
        q: "Is St. Charles DWI the same search intent as St. Charles DUI?",
        a: "Missouri commonly uses DWI in official materials, while many people still search DUI. The practical question is whether the case involves impaired-driving allegations, police records, court paperwork, and license consequences.",
      },
    ];
  }

  if (city.slug === "lake-saint-louis-mo") {
    return [
      {
        q: "What should I do first after a Lake Saint Louis DWI?",
        a: "Save the citation, release paperwork, court date, Lake Saint Louis Police information, chemical-test or refusal paperwork, crash details, and any DOR notice. Then confirm the court path from the official paperwork.",
      },
      {
        q: "Can Lake Saint Louis DWI license issues move separately from court?",
        a: sharedMissouriAdminAnswer,
      },
      {
        q: "What should I ask a Lake Saint Louis DWI attorney?",
        a: "Ask about St. Charles County DWI cases, Lake Saint Louis Police records, DOR hearing requests, Form 2385, chemical-test issues, refusal allegations, and license options.",
      },
    ];
  }

  if (city.slug === "st-peters-mo") {
    return [
      {
        q: "Where do St. Peters DWI records usually start?",
        a: "If St. Peters Police handled the stop or crash, the department may be the starting point for local report, video, crash-record, and records questions. County or state agencies may matter depending on where the stop happened.",
      },
      {
        q: "Can a St. Peters DWI affect my license separately from court?",
        a: sharedMissouriAdminAnswer,
      },
      {
        q: "What should I ask a St. Peters DWI lawyer?",
        a: "Ask about St. Charles County court experience, St. Peters Police records, Missouri DOR deadlines, Form 2385, chemical-test evidence, refusal issues, and traffic citations tied to the stop.",
      },
    ];
  }

  if (city.slug === "moscow-mills-mo") {
    return [
      {
        q: "Why do people search for a DWI attorney in Moscow Mills?",
        a: "A Moscow Mills DWI attorney search usually means the reader needs help connecting police paperwork, Lincoln County court, Missouri DOR license deadlines, and what records should be reviewed before court.",
      },
      {
        q: "What is a DWI administrative hearing after a Moscow Mills arrest?",
        a: "It is a Missouri Department of Revenue license process that can move separately from the criminal court case. Any Form 2385 or DOR notice should be checked quickly against official hearing-request instructions.",
      },
      {
        q: "What documents matter for a Moscow Mills DWI?",
        a: "Useful documents may include the ticket, release paperwork, police agency information, chemical-test records, refusal paperwork, officer notices, crash or towing details, and any DOR mailing.",
      },
    ];
  }

  if (city.slug === "belleville-il") {
    return [
      {
        q: "What should I do first after a DUI charge in Belleville?",
        a: "Save the citation, bond or release paperwork, court date, police agency information, chemical-test paperwork, towing records, and any Secretary of State notice. Confirm the court date from the official paperwork.",
      },
      {
        q: "Where do Belleville DUI cases connect locally?",
        a: "Belleville is tied to St. Clair County court resources, Belleville Police records, and Illinois Secretary of State license consequences. The official citation and court notice should control the exact next step.",
      },
      {
        q: "Can Illinois license suspension issues move separately from court?",
        a: "Yes. Illinois statutory summary suspension is separate from the criminal DUI case and can begin 46 days after notice unless successfully challenged.",
      },
      {
        q: "What should I ask a Belleville DUI lawyer?",
        a: "Ask about St. Clair County DUI experience, statutory summary suspension timing, Belleville Police reports, video, chemical-test evidence, crash records, and Secretary of State reinstatement or permit issues.",
      },
    ];
  }

  if (city.slug === "nixa-mo") {
    return [
      {
        q: "What is a Missouri DWI administrative hearing after a Nixa arrest?",
        a: "It is a Department of Revenue license process that can move separately from the criminal court case. The hearing focuses on driving privileges and should be checked against any DOR notice.",
      },
      {
        q: "What should I ask a lawyer about a Nixa DWI administrative hearing?",
        a: "Ask whether the lawyer handles Form 2385 hearing requests, license stays, restricted driving options, refusal issues, chemical-test paperwork, and the local court case together.",
      },
      {
        q: "Does the Nixa court date protect my Missouri license deadline?",
        a: "Not necessarily. Court dates and DOR license deadlines can be separate, so the court notice should not be treated as the only deadline after a DWI arrest.",
      },
      {
        q: "What paperwork matters for a Nixa DWI hearing?",
        a: "Useful paperwork may include the citation, release documents, officer notices, Form 2385, chemical-test records, refusal paperwork, video references, and any DOR mailing.",
      },
    ];
  }

  if (city.slug === "manchester-mo") {
    return [
      {
        q: "Why do people search DUI attorney near me in Manchester if Missouri uses DWI?",
        a: "DUI is common search language, but Missouri commonly uses DWI in official materials. A Manchester DUI attorney search may still involve Missouri DWI court, police, and DOR license issues.",
      },
      {
        q: "What should a Manchester DWI lawyer know locally?",
        a: "Ask about St. Louis County court experience, Manchester Police records, West County traffic corridors, DOR administrative deadlines, and chemical-test or refusal issues.",
      },
      {
        q: "Can Manchester DWI license issues move separately from court?",
        a: sharedMissouriAdminAnswer,
      },
    ];
  }

  if (city.slug === "edwardsville-il") {
    return [
      {
        q: "What should I ask an Edwardsville DUI lawyer about Madison County?",
        a: "Ask how often the lawyer handles Madison County DUI cases, how discovery is reviewed, and how local police records, court settings, and prosecutor practices may affect the timeline.",
      },
      {
        q: "How does Illinois statutory summary suspension affect an Edwardsville DUI?",
        a: "A statutory summary suspension is separate from the criminal case and can begin 46 days after notice unless successfully challenged. The timing should be checked quickly against official Illinois sources.",
      },
      {
        q: "What Edwardsville Police records might matter after a DUI arrest?",
        a: "Police reports, bodycam or dashcam, stop basis, chemical-test paperwork, crash information, towing records, and impound paperwork may all matter depending on the facts.",
      },
      {
        q: "Can Illinois Secretary of State consequences continue after court?",
        a: "Yes. Reinstatement, restricted permits, evaluations, BAIID or MDDP issues, and fees may involve the Illinois Secretary of State separately from the court case.",
      },
    ];
  }

  if (city.slug === "cary-nc") {
    return [
      {
        q: "What should I ask a Cary DWI lawyer?",
        a: "Ask about Wake County DWI experience, Cary Police records, chemical-test evidence, punishment levels, probation questions, limited driving privilege, and NCDMV license consequences.",
      },
      {
        q: "Are Cary DWI defense tips enough to handle the case alone?",
        a: "General tips can help organize documents, but they are not legal advice. A DWI case can involve court, license, evidence, and probation issues that depend on the specific facts.",
      },
      {
        q: "Can a Cary DWI affect my license separately from court?",
        a: "Yes. North Carolina DWI cases can involve NCDMV license consequences and possible limited-driving-privilege questions in addition to the court case.",
      },
    ];
  }

  if (city.slug === "fuquay-varina-nc") {
    return [
      {
        q: "What should I do first after a Fuquay-Varina DWI?",
        a: "Save the citation, release paperwork, court date, Fuquay-Varina Police information, chemical-test or refusal paperwork, and any NCDMV notice. Then confirm the Wake County court date from the official source.",
      },
      {
        q: "Can a Fuquay-Varina DWI affect my license separately from court?",
        a: "Yes. North Carolina DWI cases can create NCDMV license consequences outside the criminal court timeline, including civil revocation and limited-driving-privilege questions.",
      },
      {
        q: "What should I ask a Fuquay-Varina DWI lawyer?",
        a: "Ask about Wake County DWI experience, Fuquay-Varina Police records, chemical-test evidence, punishment levels, probation conditions, and limited-driving-privilege issues.",
      },
    ];
  }

  if (city.slug === "holly-springs-nc") {
    return [
      {
        q: "What rights should I think about after a Holly Springs DWI?",
        a: "Important questions may include whether to make statements, how chemical-test evidence was handled, what records should be requested, and how court and license deadlines interact. A licensed North Carolina attorney can apply those rights to the facts.",
      },
      {
        q: "Where do Holly Springs DWI records usually start?",
        a: "If Holly Springs Police handled the stop or crash, the department may be the starting point for local report and records questions. County or state agencies may matter depending on where the stop happened.",
      },
      {
        q: "Can a Holly Springs DWI create NCDMV license issues?",
        a: "Yes. North Carolina DWI cases can involve license consequences separately from the court case, so NCDMV notices and limited-driving-privilege questions should be tracked early.",
      },
    ];
  }

  if (city.slug === "north-raleigh-nc") {
    return [
      {
        q: "What should I do after a DWI arrest in North Raleigh?",
        a: "Save the citation, release paperwork, court date, Raleigh Police information, chemical-test paperwork, any crash report details, and NCDMV notices. Confirm whether the case points to Wake County court resources.",
      },
      {
        q: "Can a Raleigh DWI affect my license before the case is over?",
        a: "Yes. North Carolina DWI cases can involve immediate civil revocation and NCDMV license consequences that should be tracked separately from the court case.",
      },
      {
        q: "Can I get a restricted license after a North Raleigh DWI?",
        a: "A limited driving privilege may be possible in some North Carolina cases, but eligibility depends on the facts, timing, revocation, and statutory requirements.",
      },
      {
        q: "What should I ask a North Raleigh DWI lawyer?",
        a: "Ask about Wake County DWI experience, Raleigh Police records, NCDMV license consequences, punishment levels, probation conditions, chemical-test evidence, and limited-driving-privilege issues.",
      },
    ];
  }

  if (city.slug === "knightdale-nc") {
    return [
      {
        q: "What should I ask a Knightdale DWI lawyer?",
        a: "Ask about Wake County DWI experience, Knightdale Police records, chemical-test evidence, punishment levels, probation conditions, limited-driving-privilege issues, and NCDMV license consequences.",
      },
      {
        q: "Can a Knightdale DWI affect my license separately from court?",
        a: "Yes. North Carolina DWI cases can involve NCDMV consequences outside the criminal court timeline, including civil revocation and possible limited-driving-privilege questions.",
      },
      {
        q: "What if I searched in Spanish for Knightdale DWI legal representation?",
        a: "This guide is written in English, but Spanish-language searches can still point to the same Knightdale police, Wake County court, and NCDMV issues. Ask any attorney or law firm whether Spanish-language consultation or translation support is available.",
      },
    ];
  }

  if (city.slug === "rolesville-nc") {
    return [
      {
        q: "Where do Rolesville DWI cases usually connect?",
        a: "Rolesville DWI questions usually connect to Rolesville Police records, Wake County court paperwork, and NCDMV license consequences. The citation and court notice should control the official court path.",
      },
      {
        q: "What if I searched in Spanish for Rolesville DWI legal representation?",
        a: "This guide is written in English, but Spanish-language searches can still point to the same Rolesville police, Wake County court, and NCDMV issues. Ask any attorney or law firm whether Spanish-language consultation or translation support is available.",
      },
      {
        q: "Can a Rolesville DWI affect my license separately from court?",
        a: "Yes. North Carolina DWI cases can involve NCDMV consequences outside the criminal court timeline, including civil revocation and possible limited-driving-privilege questions.",
      },
      {
        q: "What should I ask a Rolesville DWI lawyer?",
        a: "Ask about Wake County DWI experience, Rolesville Police records, chemical-test evidence, punishment levels, probation conditions, limited-driving-privilege options, and what deadlines should be handled first.",
      },
    ];
  }

  if (city.slug === "wake-forest-nc") {
    return [
      {
        q: "Why does Wake Forest DWI traffic enforcement matter?",
        a: "Wake Forest Police publish traffic-enforcement context, including a DWI Traffic Team. That does not decide any case outcome, but it can help readers understand which local agency may have reports, video, or enforcement paperwork.",
      },
      {
        q: "Where do Wake Forest DWI records usually start?",
        a: "If Wake Forest Police handled the stop or crash, local police records may be the first records path. The court notice, NCDMV paperwork, and any chemical-test documents should still be tracked separately.",
      },
      {
        q: "Can a Wake Forest DWI affect my license separately from court?",
        a: "Yes. North Carolina DWI cases can involve NCDMV consequences outside the criminal court timeline, including civil revocation and possible limited-driving-privilege questions.",
      },
      {
        q: "What should I ask a Wake Forest DWI lawyer?",
        a: "Ask about Wake County DWI experience, Wake Forest Police records, traffic-enforcement evidence, chemical-test paperwork, limited-driving-privilege options, and what deadlines should be handled first.",
      },
    ];
  }

  if (region.slug === "cabarrus-county-nc") {
    const court = courtForCity(city, region, duiPractice());
    const sheriffCities = new Set(["harrisburg-nc", "mount-pleasant-nc", "midland-nc"]);
    return [
      {
        q: `Where do ${city.name} DWI cases connect locally?`,
        a: `${city.name} DWI questions usually connect to ${court.name}, ${city.police.name}, and NCDMV license consequences. The citation and court notice should control the official court path.`,
      },
      {
        q: `Does ${city.name} use city police or Cabarrus County sheriff records?`,
        a: sheriffCities.has(city.slug)
          ? `${city.name} readers should usually start with Cabarrus County Sheriff's Office context for sheriff-handled records, then confirm the exact agency listed on the citation or report.`
          : `${city.name} has a municipal police department listed on this guide, but county deputies or state patrol may still matter depending on where the stop happened.`,
      },
      {
        q: `Can a ${city.name} DWI affect my license separately from court?`,
        a: "Yes. North Carolina DWI cases can involve NCDMV consequences outside the criminal court timeline, including civil revocation and possible limited-driving-privilege questions.",
      },
      {
        q: `What should I ask a ${city.name} DWI lawyer?`,
        a: `Ask about Cabarrus County DWI practice, ${city.police.name} records, chemical-test evidence, punishment levels, limited-driving-privilege options, and what deadlines should be handled first.`,
      },
    ];
  }

  if (region.slug === "durham-orange-triangle-nc") {
    const court = courtForCity(city, region, duiPractice());
    return [
      {
        q: `Which courthouse matters for a ${city.name} DWI?`,
        a: `${court.name} is the court reference used for this guide. The official citation or court notice should still control the date, location, and appearance requirements.`,
      },
      {
        q: `Where do ${city.name} DWI records usually start?`,
        a: `If ${city.police.name} handled the stop or crash, that agency may be the starting point for report, video, crash-record, citation, or records questions. County or state agencies may matter depending on the location.`,
      },
      {
        q: `Can a ${city.name} DWI create NCDMV license issues?`,
        a: "Yes. North Carolina DWI cases can involve NCDMV consequences outside the criminal court timeline, including civil revocation and possible limited-driving-privilege questions.",
      },
      {
        q: `What should I ask a ${city.name} DWI lawyer?`,
        a: `Ask about local court experience, ${city.police.name} records, chemical-test evidence, punishment levels, limited-driving-privilege options, and whether the case involves Durham County or Orange County routing.`,
      },
    ];
  }

  if (city.slug === "pineville-nc") {
    return [
      {
        q: "What should I ask a Pineville DWI lawyer?",
        a: "Ask about Mecklenburg County DWI experience, local police records, court dates, chemical testing, license consequences, probation questions, and limited-driving-privilege issues.",
      },
      {
        q: "Is a Pineville DWI usually handled only by the local police department?",
        a: "The local agency may start the paperwork, but the court process, license consequences, and records path can involve county and state systems depending on the facts.",
      },
      {
        q: "Can a misdemeanor DWI in Pineville still be serious?",
        a: "Yes. Even a misdemeanor DWI can involve punishment levels, probation conditions, insurance consequences, license issues, and future background-check concerns.",
      },
    ];
  }

  return [];
}

function targetedPersonalInjuryFaqs(city, region) {
  if (city.slug !== "edwardsville-il") return [];

  return [
    {
      q: "Should I talk to insurance after an Edwardsville accident?",
      a: "You may need to communicate with an insurer, but recorded statements, broad medical authorizations, and quick settlement offers should be handled carefully, especially when injuries, missed work, or disputed fault are involved.",
    },
    {
      q: "Where might an Edwardsville crash report come from?",
      a: "If Edwardsville Police handled the scene, the city police department may be the starting point. If the crash happened outside city limits or on an interstate, Madison County Sheriff or Illinois State Police may be involved.",
    },
    {
      q: "What medical documents should I keep for an Edwardsville injury claim?",
      a: "Keep emergency room records, urgent-care notes, follow-up treatment, therapy records, prescriptions, bills, work restrictions, mileage, and any letters from insurers or medical providers.",
    },
    {
      q: "Do Madison County injury claims always go to court?",
      a: "No. Many claims resolve through insurance, but Madison County court context can matter if settlement fails, liability is disputed, or a lawsuit becomes necessary before a deadline expires.",
    },
  ];
}

function cityToc(isDui, region, hasLocalDuiData = false, hasRankingOpportunity = false) {
  const lawyerLabel = isDui ? `${region.stateCode === "IL" ? "DUI" : "DWI"} lawyer` : "injury lawyer";
  const items = [
    ["Start here", "#start-here"],
    ["What happens next", "#what-happens-next"],
    [`When to call ${isDui ? "a" : "an"} ${lawyerLabel}`, "#when-to-call-lawyer"],
    ...(hasRankingOpportunity ? [["Search context", "#ranking-opportunity"]] : []),
    ...(isDui && region.stateCode === "MO" ? [["MO DWI hearing", "#missouri-admin-hearing"]] : []),
    ["Why this city differs", "#city-difference"],
    ["Local directory", "#directory"],
    ["Map", "#map"],
    ["Local details", "#local"],
    ...(isDui && hasLocalDuiData ? [[`Local ${region.stateCode === "IL" ? "DUI" : "DWI"} data`, "#dui-local-data"]] : []),
    ...(isDui ? [] : [["Insurance warning", "#insurance-warning"]]),
    ["Key deadlines", "#deadlines"],
    ["Documents", "#documents"],
    [isDui ? `${region.stateCode === "IL" ? "DUI" : "DWI"} law` : "Injury law", "#state-law"],
    ["Case process", "#process"],
    [isDui ? "Penalties" : "Claim value", "#penalties"],
    [isDui ? "Implied consent" : "Fault and proof", "#implied-consent"],
    [isDui ? "License restoration" : "Insurance and settlement", "#restoration"],
    ...(isDui ? [] : [["Reports", "#accident-report"]]),
    [isDui ? `${region.stateCode === "IL" ? "DUI" : "DWI"} attorney` : "Injury attorney", "#attorney-question"],
    ["Questions to ask", "#questions-to-ask"],
    ...(region?.stateCode === "IL" || (isDui && region?.stateCode === "MO") ? [["Resources", "#related-resources"]] : []),
    ["Official sources", "#sources"],
    ["Common questions", "#faq"],
  ];

  return `<section class="toc-band">
    <div class="container">
      <p class="eyebrow">On this page</p>
      <nav aria-label="Page sections">
        <ul class="toc-list">${items
          .map((item, index) => `<li><a href="${item[1]}"><span>${index + 1}</span>${escapeHtml(item[0])}</a></li>`)
          .join("")}</ul>
      </nav>
    </div>
  </section>`;
}

function attorneyQuestionSection({ city, region, isDui, basics }) {
  const stateArticle = articleFor(region.state);
  const title = isDui
    ? `Do I need a ${basics.duiName} attorney in ${city.name}?`
    : `Do I need a personal injury attorney in ${city.name}?`;
  const intro = isDui
    ? `${basics.duiName} is a serious offense that can carry serious consequences if it is not handled correctly. People often search for "${city.name} DUI attorney" even when ${region.state} uses ${basics.duiName} as the formal offense name. Because a case can affect criminal penalties, driving privileges, insurance, employment, commercial driving status, immigration status, or a professional license, seeking legal advice from a licensed ${region.state} attorney is strongly recommended.`
    : `A personal injury claim can have serious financial and legal consequences if deadlines, evidence, medical documentation, insurance issues, or settlement terms are handled incorrectly. People often consider talking with ${articleFor(city.name)} ${city.name} personal injury attorney when injuries are serious, fault is disputed, medical bills are growing, an insurer asks for a recorded statement, or a government vehicle or public property may be involved. Seeking legal advice from a licensed ${region.state} attorney is strongly recommended before making decisions that could affect a claim.`;
  const cards = isDui
    ? [
        ["Criminal consequences", `${basics.duiName} cases can involve criminal court, plea options, sentencing conditions, fines, probation terms, and local court procedures.`],
        ["License consequences", "Driving privileges can move on a separate timeline from the court case, so missed driver-service deadlines can create problems even before the criminal case is finished."],
        ["Records to gather", `Useful records may include the ticket, bond paperwork, court date notice, police agency information, chemical-test paperwork, and any Secretary of State or DMV notice.`],
      ]
    : [
        ["Liability and proof", "Fault, causation, medical documentation, witness issues, and comparative fault arguments can all affect whether a claim succeeds."],
        ["Insurance and liens", "Injury claims can involve liability coverage, medical payments coverage, health-insurance liens, subrogation, uninsured motorist issues, or disputed settlement terms."],
        ["Records to gather", "Useful records may include the crash or incident report, photographs, medical records, bills, wage documents, insurance letters, claim numbers, and repair estimates."],
      ];
  const closing = isDui
    ? `This page does not recommend a specific lawyer and is not legal advice. It is meant to help you identify the local court, police agency, and license contacts that may matter before you contact ${stateArticle} ${region.state} ${
        basics.duiName === "DUI" ? "DUI attorney" : `${basics.duiName} or DUI attorney`
      }.`
    : `This page does not recommend a specific lawyer and is not legal advice. It is meant to help you identify the local court, records, and insurance context that may matter before you contact ${stateArticle} ${region.state} personal injury attorney.`;

  return `<section class="section section-attorney-question" id="attorney-question">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Attorney question</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(intro)}</p>
      </div>
      <div class="card-grid three-up">${cards
        .map((item) => `<article class="info-card"><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`)
        .join("")}</div>
      <p class="legal-note">${escapeHtml(closing)}</p>
    </div>
  </section>`;
}

function sourcesForPractice(basics, isDui) {
  return basics.sources.filter((source) => {
    const label = source.label.toLowerCase();
    const isDuiSource =
      label.includes("dui") ||
      label.includes("dwi") ||
      label.includes("impaired") ||
      label.includes("alcohol") ||
      label.includes("license") ||
      label.includes("reinstatement") ||
      label.includes("sentencing");
    return isDui ? isDuiSource : label.includes("personal injury");
  });
}

function writeTarget(filePath, content) {
  return writeFile(path.join(outputRoot, filePath), content, "utf8");
}

function writeBinaryTarget(filePath, content) {
  return writeFile(path.join(outputRoot, filePath), content);
}

async function ensureDir(filePath) {
  await mkdir(path.dirname(path.join(outputRoot, filePath)), { recursive: true });
}

async function copyStaticAssets() {
  await copyFile(path.join(root, "styles.css"), path.join(outputRoot, "styles.css"));
  await copyFile(path.join(root, "app.js"), path.join(outputRoot, "app.js"));
}

function brandFaviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <title>${escapeHtml(siteData.siteName)} icon</title>
  <rect width="512" height="512" rx="96" fill="#172438"/>
  <rect x="86" y="86" width="340" height="340" rx="72" fill="#fff8ea"/>
  <text x="256" y="326" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="236" font-weight="700" fill="#172438">L</text>
  <path d="M160 370h192" stroke="#9b2f38" stroke-width="28" stroke-linecap="round"/>
  <path d="M186 132h140" stroke="#c69234" stroke-width="18" stroke-linecap="round"/>
</svg>
`;
}

function brandLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <title>${escapeHtml(siteData.siteName)} logo</title>
  <rect width="512" height="512" rx="88" fill="#172438"/>
  <circle cx="256" cy="256" r="174" fill="#fff8ea"/>
  <text x="256" y="308" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="190" font-weight="700" fill="#172438">L</text>
  <path d="M158 356h196" stroke="#9b2f38" stroke-width="24" stroke-linecap="round"/>
  <path d="M192 156h128" stroke="#c69234" stroke-width="16" stroke-linecap="round"/>
</svg>
`;
}

function brandSocialImageSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <title>${escapeHtml(siteData.siteName)} social preview</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#172438"/>
      <stop offset="0.62" stop-color="#251f29"/>
      <stop offset="1" stop-color="#7f2730"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(900 120) rotate(138) scale(620 480)">
      <stop stop-color="#d6a247" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#d6a247" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="72" y="76" width="118" height="118" rx="28" fill="#fff8ea"/>
  <text x="131" y="154" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="82" font-weight="700" fill="#172438">L</text>
  <path d="M103 169h56" stroke="#9b2f38" stroke-width="9" stroke-linecap="round"/>
  <text x="220" y="124" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="4" fill="#d6a247">LOCAL LEGAL GUIDES</text>
  <text x="72" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="78" font-weight="700" fill="#fff8ea">Know the local legal</text>
  <text x="72" y="388" font-family="Georgia, 'Times New Roman', serif" font-size="78" font-weight="700" fill="#fff8ea">system, one city at a time.</text>
  <text x="76" y="468" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#efe5d0">DUI, DWI, personal injury, court, police, and official-source guides by city.</text>
  <rect x="74" y="518" width="324" height="46" rx="23" fill="#fff8ea" opacity="0.14"/>
  <text x="100" y="549" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#fff8ea">locallegalguides.com</text>
</svg>
`;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function blendColor(start, end, amount) {
  return start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount));
}

function brandSocialImagePng() {
  const width = 1200;
  const height = 630;
  const rowLength = 1 + width * 4;
  const raw = Buffer.alloc(rowLength * height);
  const navy = [23, 36, 56];
  const dusk = [37, 31, 41];
  const wine = [127, 39, 48];
  const cream = [255, 248, 234];
  const gold = [214, 162, 71];

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowLength;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const gradient = (x / width) * 0.72 + (y / height) * 0.28;
      const base = gradient < 0.58 ? blendColor(navy, dusk, gradient / 0.58) : blendColor(dusk, wine, (gradient - 0.58) / 0.42);
      const glowDistance = Math.hypot((x - 915) / 610, (y - 116) / 440);
      const glow = Math.max(0, 1 - glowDistance) * 0.34;
      const color = blendColor(base, gold, glow);
      const offset = rowStart + 1 + x * 4;
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
      raw[offset + 3] = 255;
    }
  }

  const paintRect = (left, top, rectWidth, rectHeight, color, alpha = 1) => {
    for (let y = top; y < top + rectHeight; y += 1) {
      if (y < 0 || y >= height) continue;
      for (let x = left; x < left + rectWidth; x += 1) {
        if (x < 0 || x >= width) continue;
        const offset = y * rowLength + 1 + x * 4;
        raw[offset] = Math.round(raw[offset] * (1 - alpha) + color[0] * alpha);
        raw[offset + 1] = Math.round(raw[offset + 1] * (1 - alpha) + color[1] * alpha);
        raw[offset + 2] = Math.round(raw[offset + 2] * (1 - alpha) + color[2] * alpha);
      }
    }
  };

  paintRect(72, 76, 118, 118, cream, 1);
  paintRect(103, 166, 56, 10, wine, 1);
  paintRect(74, 518, 324, 46, cream, 0.14);
  paintRect(72, 260, 720, 24, cream, 0.92);
  paintRect(72, 316, 790, 24, cream, 0.92);
  paintRect(72, 372, 650, 24, cream, 0.92);
  paintRect(76, 462, 560, 16, cream, 0.78);
  paintRect(76, 490, 440, 16, cream, 0.6);
  paintRect(220, 106, 340, 18, gold, 0.9);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function sampleSponsorImageSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <title>Sample attorney headshot</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">
      <stop stop-color="#172438"/>
      <stop offset="0.56" stop-color="#27364c"/>
      <stop offset="1" stop-color="#7e2d34"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(172 54) rotate(140) scale(150 120)">
      <stop stop-color="#d6a247" stop-opacity="0.46"/>
      <stop offset="1" stop-color="#d6a247" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="240" height="240" rx="120" fill="url(#bg)"/>
  <rect width="240" height="240" rx="120" fill="url(#glow)"/>
  <circle cx="120" cy="96" r="43" fill="#d7b48a"/>
  <path d="M78 95c20 14 62 12 86-13 9 21 2 47-12 61-17 17-52 18-68 1-13-13-19-31-6-49Z" fill="#172438"/>
  <path d="M48 224c10-58 40-90 72-90s62 32 72 90H48Z" fill="#172438"/>
  <path d="M92 145l28 48 28-48" fill="#fff8ea"/>
  <path d="M119 194l16 30h-32l15-30h1Z" fill="#9b2f38"/>
  <path d="M54 224c14-26 36-42 66-42s52 16 66 42" fill="none" stroke="#fff8ea" stroke-width="5" opacity="0.22"/>
</svg>
`;
}

function siteWebManifest() {
  return `${JSON.stringify(
    {
      name: siteData.siteName,
      short_name: "Local Legal Guides",
      description: siteData.siteDescription,
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#f7f1e7",
      theme_color: "#172438",
      icons: [
        {
          src: brandIconPath,
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any",
        },
        {
          src: brandLogoPath,
          sizes: "512x512",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    },
    null,
    2
  )}\n`;
}

function analyticsScript() {
  return `<script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}

      function loadGoogleAnalytics() {
        if (window.__llgGoogleAnalyticsLoaded) return;
        window.__llgGoogleAnalyticsLoaded = true;
        var script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}';
        document.head.appendChild(script);
        gtag('js', new Date());
        gtag('config', '${googleAnalyticsId}');
      }

      ['pointerdown', 'keydown', 'touchstart'].forEach(function (eventName) {
        window.addEventListener(eventName, loadGoogleAnalytics, { once: true, passive: true });
      });

      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadGoogleAnalytics, { timeout: 2500 });
      } else {
        window.addEventListener('load', function () {
          setTimeout(loadGoogleAnalytics, 1200);
        }, { once: true });
      }
    </script>`;
}

async function writeBrandAssets() {
  await writeTarget("favicon.svg", brandFaviconSvg());
  await writeTarget("logo.svg", brandLogoSvg());
  await writeTarget("og-image.svg", brandSocialImageSvg());
  await writeBinaryTarget("og-image.png", brandSocialImagePng());
  await writeTarget("sample-sponsor-attorney.svg", sampleSponsorImageSvg());
  await writeTarget("site.webmanifest", siteWebManifest());
}

function pageShell({ title, description, body, active = "", route = "/", schema = [], lastVerified = siteData.lastVerified, noindex = false }) {
  const nav = navLinks
    .map((item) => {
      const isActive =
        active === item.href ||
        (active === "dui" && item.href === "/dui/") ||
        (active === "personal-injury" && item.href === "/personal-injury/") ||
        (active === "regions" && item.href === "/regions/") ||
        (active === "contact" && item.href === "/contact/");
      return `<a class="nav-link${isActive ? " is-active" : ""}" href="${item.href}">${item.label}</a>`;
    })
    .join("");
  const schemas = Array.isArray(schema) ? schema : [schema];
  const schemaTags = schemas
    .filter(Boolean)
    .map((item) => `<script type="application/ld+json">${escapeScriptJson(item)}</script>`)
    .join("\n    ");
  const socialImage = brandAssetUrl(brandSocialImagePath);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="application-name" content="${escapeHtml(siteData.siteName)}" />
    <meta name="apple-mobile-web-app-title" content="${escapeHtml(siteData.siteName)}" />
    <meta name="theme-color" content="#172438" />
    ${noindex ? '<meta name="robots" content="noindex,follow" />' : ""}
    <link rel="canonical" href="${absoluteUrl(route)}" />
    <link rel="icon" href="${brandIconPath}" type="image/svg+xml" sizes="any" />
    <link rel="shortcut icon" href="${brandIconPath}" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="${brandLogoPath}" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${absoluteUrl(route)}" />
    <meta property="og:site_name" content="${escapeHtml(siteData.siteName)}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${socialImage}" />
    <meta property="og:image:secure_url" content="${socialImage}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(siteData.siteName)} local legal guide preview" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${socialImage}" />
    <meta name="twitter:image:alt" content="${escapeHtml(siteData.siteName)} local legal guide preview" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles.css" />
    ${analyticsScript()}
    <script src="/app.js" defer></script>
    ${schemaTags}
  </head>
  <body>
    <div class="bg-grid" aria-hidden="true"></div>

    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="/">
          <span class="brand-mark">L</span>
          <span class="brand-copy">
            <strong>${siteData.siteName}</strong>
            <span>${siteData.siteTagline}</span>
          </span>
        </a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">
          <span class="menu-toggle-lines" aria-hidden="true"></span>
          <span class="menu-toggle-label">Menu</span>
        </button>
        <nav class="nav" id="primary-nav" aria-label="Primary navigation">${nav}</nav>
      </div>
    </header>

    <main>
      ${body}
      <section class="page-status-band">
        <div class="container page-status-inner">
          <span class="page-status-pill">Last verified: ${escapeHtml(formatDisplayDate(lastVerified))}</span>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <p>General legal information for local court, license, claims, and city agency research.</p>
        <p><a href="/dui/locations/">DUI/DWI city guides</a> | <a href="/personal-injury/locations/">Injury city guides</a> | <a href="/editorial-standards/">Editorial Standards</a> | <a href="/contact/">Contact</a> | <a href="/terms/">Terms</a> | <a href="/privacy/">Privacy</a></p>
        <p>&copy; ${siteData.year} ${siteData.siteName} | ${siteData.domain}</p>
      </div>
    </footer>
  </body>
</html>`;
}

function regionSummary(region) {
  const cityCount = region.cities.length;
  const guideCount = cityCount * practicesForRegion(region).length;
  return `<article class="region-card">
    <p class="eyebrow">${escapeHtml(region.state)}</p>
    <h3><a class="text-link" href="${clusterHref(region)}">${escapeHtml(region.name)}</a></h3>
    <p>${escapeHtml(region.teaser)}</p>
    <div class="region-meta">${cityCount} cities | ${guideCount} guides</div>
    <div class="region-city-list">
      ${region.cities
        .slice(0, 5)
        .map((city) => `<a class="region-city-pill" href="${pathForPracticeCity("dui", city.slug)}">${escapeHtml(city.name)}</a>`)
        .join("")}
    </div>
    <a class="text-link" href="${clusterHref(region)}" aria-label="Open ${escapeHtml(region.name)} cluster hub">Open cluster hub</a>
    <a class="text-link" href="/dui/locations/" aria-label="Browse DUI and DWI city guides">Browse DUI/DWI guides</a>
  </article>`;
}

function cityShell(city, region, practice) {
  const basics = stateBasics(region);
  const court = courtForCity(city, region, practice);
  const isDui = practice.slug === "dui";
  const packageInfo = sponsorPackage(region);
  const courtOffices = region.courtOffices ?? [court];
  const enforcementOffices = [city.police, ...(region.sharedEnforcement ?? [])].filter(Boolean);
  const licenseOffice = city.licenseOfficeOverride ?? region.licenseOffice;
  const localDuiData = isDui ? duiLocalDataFor(city) : null;
  const hasRankingOpportunity =
    (isDui &&
      [
        "apex-nc",
        "fuquay-varina-nc",
        "holly-springs-nc",
        "nixa-mo",
        "manchester-mo",
        "wentzville-mo",
        "st-charles-mo",
        "lake-saint-louis-mo",
        "st-peters-mo",
        "moscow-mills-mo",
        "concord-nc",
        "kannapolis-nc",
        "harrisburg-nc",
        "mount-pleasant-nc",
        "midland-nc",
        "durham-nc",
        "chapel-hill-nc",
        "carrboro-nc",
        "hillsborough-nc",
        "edwardsville-il",
        "north-raleigh-nc",
        "knightdale-nc",
        "rolesville-nc",
        "wake-forest-nc",
        "cary-nc",
        "ofallon-mo",
        "belleville-il",
      ].includes(city.slug)) ||
    (!isDui && ["apex-nc", "edwardsville-il"].includes(city.slug));
  const caseName = isDui ? basics.duiName : "personal injury";
  const quickActions = quickActionCards({ city, region, court, licenseOffice, isDui, basics });
  const title = heroTitleForCity(city, region, isDui, basics);
  const intro = heroIntroForCity(city, region, isDui, basics);
  const sponsor = activeSponsor(packageInfo);
  const practiceSponsorLabel = isDui ? practiceSeoLabel(practice, region) : practice.label;
  const heroSponsorCta = `Contact Featured ${practiceSponsorLabel} Sponsor`;
  const mapQuery = isDui
    ? `${city.name} ${region.stateCode} police courthouse driver services`
    : `${city.name} ${region.stateCode} police courthouse records`;
  const snapshot = isDui
    ? [
        { label: "State threshold", value: basics.duiThreshold },
        { label: "Court", value: court.name },
        { label: "Agency", value: city.agency },
        { label: "License track", value: basics.duiLicense },
      ]
    : [
        { label: "Filing deadline", value: basics.personalInjuryDeadline },
        { label: "Court", value: court.name },
        { label: "Venue note", value: basics.injuryVenue },
        { label: "Local records", value: `${city.agency} may hold incident reports for local crashes.` },
      ];
  const cards = isDui
    ? [
        {
          title: "Criminal Court",
          body: `${court.name} is the local court reference for ${city.name} cases in this guide. The listed court system is ${court.courtSystem}.`,
        },
        {
          title: "Enforcement",
          body: `${city.agency}, county deputies, or state patrol officers may be involved depending on where the stop happened.`,
        },
        {
          title: "License Consequences",
          body: basics.duiLicense,
        },
      ]
    : [
        {
          title: "Civil Court",
          body: `${court.name} is the local court reference for civil injury cases connected to ${city.name}.`,
        },
        {
          title: "Incident Records",
          body: `${city.agency} is the first local agency to check for city crash or incident records when it handled the scene.`,
        },
        {
          title: "Deadline Watch",
          body: basics.personalInjuryDeadline,
        },
      ];
  const process = isDui
    ? [
        "The criminal case usually starts in the county court system after an arrest or citation.",
        basics.duiCharge,
        basics.duiLicense,
        "Court dates, license deadlines, and administrative hearings can move on separate tracks.",
      ]
    : [
        "Medical care, crash reports, and insurance notice usually come before any lawsuit.",
        basics.personalInjuryDeadline,
        basics.injuryVenue,
        "Government defendants, public vehicles, or public property can create shorter notice requirements.",
      ];
  const deadlines = isDui
    ? duiDeadlineCards(region, court)
    : [
        {
          label: "Immediately",
          title: "Preserve evidence",
          body: "Medical records, photographs, repair estimates, crash reports, witness names, and insurance communications should be preserved early.",
        },
        {
          label: "Notice deadlines",
          title: "Check for public-entity rules",
          body: "Claims involving public vehicles, public property, or government defendants can have shorter notice requirements than ordinary injury claims.",
        },
        {
          label: "State filing period",
          title: "Calendar the civil deadline",
          body: basics.personalInjuryDeadline,
        },
      ];
  const localLawCards = isDui
    ? duiLawCards(region, city)
    : [
        {
          title: "Negligence claims",
          body: "Most injury claims turn on fault, causation, damages, insurance coverage, and whether the injury can be proven with records and witnesses.",
        },
        {
          title: "Filing deadline",
          body: basics.personalInjuryDeadline,
        },
        {
          title: "Local records",
          body: `${city.agency} or the county agency that handled the scene may have crash or incident reports needed for an insurance claim.`,
        },
        {
          title: "Venue",
          body: basics.injuryVenue,
        },
      ];
  const faq = isDui
    ? [
        {
          q: `Is ${basics.duiThreshold} the only way to have a ${basics.duiName} case?`,
          a: `No. ${region.state} can also focus on impairment, controlled substances, or combinations of substances depending on the evidence.`,
        },
        {
          q: `Where would this ${basics.duiName} case usually connect locally?`,
          a: `${court.name} is the local court reference used for this guide, with ${city.agency} listed as the city agency reference.`,
        },
        {
          q: "Can license issues happen outside the criminal case?",
          a: basics.duiLicense,
        },
      ].concat(targetedDuiFaqs(city, region, basics))
    : [
        {
          q: `How long do ${region.state} injury claims usually have?`,
          a: basics.personalInjuryDeadline,
        },
        {
          q: `Where do ${city.name} injury lawsuits usually connect locally?`,
          a: basics.injuryVenue,
        },
        {
          q: "What should be checked early?",
          a: "Medical records, insurance coverage, crash reports, photographs, witness information, and any government notice deadline should be reviewed early.",
        },
      ].concat(targetedPersonalInjuryFaqs(city, region));
  const allSources = [
    ...sourcesForPractice(basics, isDui),
    { label: court.name, href: court.href },
    city.police ? { label: city.police.name, href: city.police.href } : null,
    isDui && licenseOffice ? { label: licenseOffice.name, href: licenseOffice.href } : null,
  ].filter(Boolean);
  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: practice.title, href: `/${practice.slug}/` },
    { name: region.name, href: clusterHref(region) },
    { name: city.name, href: pathForPracticeCity(practice.slug, city.slug) },
  ];

  const body = `${breadcrumbTrail(breadcrumbs)}
  <section class="hero city-hero">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(region.state)} | ${escapeHtml(practice.label)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="lede">${escapeHtml(intro)}</p>
        <p class="hero-note">${escapeHtml(cityLocalFlavor(city, region, isDui))}</p>
        <div class="hero-actions">
          ${sponsor ? `<a class="button button-primary" href="${escapeHtml(sponsor.ctaUrl)}">${escapeHtml(heroSponsorCta)}</a>` : ""}
          <a class="button ${sponsor ? "button-secondary" : "button-primary"}" href="#start-here">See What to Do Next</a>
        </div>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Verified guide</span>
          <span class="pill pill-muted">${escapeHtml(region.name)}</span>
        </div>
        <dl class="stat-grid">${snapshot
          .map((item) => `<dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd>`)
          .join("")}</dl>
      </aside>
    </div>
  </section>

  ${
    isDui
      ? `<section class="urgent-band" aria-label="Urgent DUI timing">
    <div class="container">
      <div class="urgent-grid">${duiUrgentCards(region, city, court, licenseOffice)}</div>
    </div>
  </section>`
      : ""
  }

  ${firstStepsSection({ city, region, isDui, basics })}

  ${citySponsorAvailabilityBox(city, region, packageInfo, practice)}

  ${whatHappensNextSection({ city, region, isDui, basics })}

  ${whenToCallLawyerSection({ city, region, isDui, basics })}

  <section class="quick-start" id="quick-local-path">
    <div class="container quick-start-grid">
      <div class="quick-start-intro">
        <p class="eyebrow">Local process</p>
        <h2>Fast local path for ${escapeHtml(city.name)}.</h2>
        <p>${escapeHtml(
          isDui
            ? "If you only have a few minutes, use this block to find the court, license, and records steps that usually matter first."
            : "If you only have a few minutes, use this block to preserve evidence, find records, and keep the filing clock visible."
        )}</p>
      </div>
      <div class="quick-card-grid">${quickActions
        .map(
          (item) => `<article class="quick-card">
            <span>${escapeHtml(item.label)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
            ${item.href ? `<a class="text-link" href="${escapeHtml(item.href)}"${item.href.startsWith("#") ? "" : ' target="_blank" rel="noopener noreferrer"'}>${escapeHtml(item.cta)}</a>` : ""}
          </article>`
        )
        .join("")}</div>
    </div>
  </section>

  ${cityToc(isDui, region, Boolean(localDuiData), hasRankingOpportunity)}

  ${rankingOpportunitySection(city, region, isDui, basics)}

  ${isDui ? missouriDwiAdministrativeHearingSection({ city, region, court, basics }) : ""}

  ${cityDifferentiatorSection({ city, region, court, licenseOffice, isDui })}

  <section class="section section-directory" id="directory">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Local directory</p>
        <h2>${escapeHtml(
          isDui
            ? `Courts, police, and license offices serving ${city.name}.`
            : `Courts, police, and records offices serving ${city.name}.`
        )}</h2>
        <p>${escapeHtml(
          isDui
            ? "Use these contacts to confirm court dates, request records, verify office hours, or find the correct agency before visiting."
            : "Use these contacts to confirm court records, request police or incident reports, verify office hours, or find the correct records source before visiting."
        )}</p>
      </div>
      <div class="directory-grid">
        <div>
          <div class="directory-label">Courts</div>
          <div class="office-stack">${officeCards(courtOffices)}</div>
        </div>
        <div>
          <div class="directory-label">Law enforcement</div>
          <div class="office-stack">${officeCards(enforcementOffices)}</div>
        </div>
        <div>
          <div class="directory-label">${isDui ? "Driver services" : "Records and agency references"}</div>
          <div class="office-stack">${officeCards(isDui ? [licenseOffice] : [city.police, ...(region.sharedEnforcement ?? [])].filter(Boolean))}</div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="map">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Local office locations</p>
        <h2>Map of offices serving ${escapeHtml(city.name)}.</h2>
        <p>The map is a quick orientation tool. Confirm the right office and hours before traveling.</p>
      </div>
      <div class="map-shell">
        <iframe
          title="${escapeHtml(`${city.name} local legal office map`)}"
          src="${escapeHtml(mapEmbedHref(mapQuery))}"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen></iframe>
      </div>
      <p class="map-link-note"><a class="text-link" href="${escapeHtml(mapsHref(mapQuery))}" target="_blank" rel="noopener noreferrer">Open this office map in Google Maps</a></p>
    </div>
  </section>

  <section class="section" id="local">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Local guide</p>
        <h2>${escapeHtml(city.name)} ${escapeHtml(caseName)} essentials.</h2>
      </div>
      <div class="card-grid three-up">${cards
        .map((item) => `<article class="info-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`)
        .join("")}</div>
    </div>
  </section>

  ${isDui ? localDuiDataSection(city, region) : ""}

  <section class="section" id="deadlines">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Key deadlines</p>
        <h2>Calendar these before the case gets away from you.</h2>
      </div>
      <div class="deadline-grid">${deadlines
        .map((item) => `<article class="deadline-card"><span>${escapeHtml(item.label)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`)
        .join("")}</div>
    </div>
  </section>

  ${documentChecklistSection(isDui)}

  <section class="section section-alt" id="state-law">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">${escapeHtml(region.state)} law</p>
        <h2>${escapeHtml(isDui ? `${basics.duiName} law and license rules` : "Injury claim rules")} for ${escapeHtml(city.name)}.</h2>
      </div>
      <div class="card-grid four-up">${localLawCards
        .map((item) => `<article class="info-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`)
        .join("")}</div>
      ${sourceChips(sourcesForPractice(basics, isDui), "Source")}
    </div>
  </section>

  <section class="section section-alt" id="process">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Process</p>
          <h2>${escapeHtml(isDui ? `Typical local ${basics.duiName} path.` : "Typical local injury claim path.")}</h2>
        </div>
        ${timelineList(isDui)}
      </div>
      <div>
        <div class="section-head">
          <p class="eyebrow">Court reference</p>
          <h2>${escapeHtml(court.name)}</h2>
          <p>${escapeHtml(court.address)}</p>
        </div>
        <a class="button button-secondary" href="${escapeHtml(court.href)}" target="_blank" rel="noopener noreferrer">Court website</a>
      </div>
    </div>
  </section>

  <section class="section" id="penalties">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">${escapeHtml(stateLabel(region))} ${escapeHtml(isDui ? basics.duiName : "claims")}</p>
        <h2>${escapeHtml(isDui ? `${basics.duiName} penalties and risk points` : "How injury claim value is usually evaluated")}.</h2>
        <p>${escapeHtml(
          isDui
            ? "Penalty exposure depends on the facts, prior record, test result, injury risk, passengers, and whether the case is charged as aggravated."
            : "Claim value depends on liability, medical proof, causation, available insurance, lost wages, permanent injury, and venue."
        )}</p>
      </div>
      ${isDui ? penaltyTable(duiPenaltyRows(region)) : `<div class="card-grid four-up">${miniCards([
        ["Liability", "Who was legally at fault and whether comparative fault can reduce recovery."],
        ["Medical proof", "Diagnosis, treatment history, bills, future care, and whether symptoms are tied to the incident."],
        ["Insurance", "Available liability coverage, uninsured motorist coverage, med-pay, and liens can change net recovery."],
        ["Damages", "Lost wages, pain, impairment, scarring, and permanency can all matter."],
      ])}</div>`}
      ${sourceChips(sourcesForPractice(basics, isDui), "Source")}
    </div>
  </section>

  <section class="section section-alt" id="implied-consent">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">${escapeHtml(isDui ? "Testing and BAC" : "Fault and proof")}</p>
        <h2>${escapeHtml(isDui ? "Implied consent and BAC limits." : "What has to be proven in an injury claim.")}</h2>
      </div>
      <div class="card-grid four-up">${isDui
        ? miniCards(impliedConsentCards(region))
        : miniCards([
            ["Duty and breach", "The claim usually starts by proving another person or business failed to act reasonably."],
            ["Causation", "Medical and factual proof must connect the incident to the injury being claimed."],
            ["Comparative fault", "The other side may argue the injured person was partly or fully responsible."],
            ["Documentation", "Reports, photographs, medical records, and witness statements often decide the practical strength of the claim."],
          ])}</div>
      ${sourceChips(sourcesForPractice(basics, isDui), "Source")}
    </div>
  </section>

  <section class="section" id="restoration">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">${escapeHtml(isDui ? "License restoration" : "Insurance and settlement")}</p>
        <h2>${escapeHtml(isDui ? "Getting driving privileges back." : "How claims often resolve.")}</h2>
      </div>
      <div class="step-grid">${(isDui
        ? restorationSteps(region)
        : [
            ["Open the claim", "Notify the relevant insurer and keep written confirmation of claim numbers and adjuster contacts."],
            ["Document damages", "Collect medical bills, treatment notes, wage records, photos, and out-of-pocket expenses."],
            ["Resolve liens", "Health insurance, medical providers, Medicare, Medicaid, or workers' compensation may assert repayment rights."],
            ["Confirm release terms", "Settlement paperwork usually ends the claim, so the release should match the intended scope."],
          ])
        .map((item, index) => `<article class="step-card"><span>${index + 1}</span><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`)
        .join("")}</div>
    </div>
  </section>

  ${isDui ? "" : personalInjuryLocalContextSection(city, region)}

  ${isDui ? "" : insuranceRealitySection(city)}

  ${isDui ? "" : accidentReportSection(city, region)}

  ${attorneyQuestionSection({ city, region, isDui, basics })}

  ${personalInjuryOpportunitySection(city, region, isDui)}

  ${questionsToAskAttorneySection({ city, region, isDui, basics })}

  <section class="section section-attorney-cta">
    <div class="container">
      ${citySponsorNotice(city, region, packageInfo, practice)}
    </div>
  </section>

  ${relatedResourceLinks(region, isDui)}

  ${wakeSouthwestDwiInternalLinksSection(city, region, isDui)}

  ${isDui ? duiInternalLinksSection(city, region, practice) : ""}

  <section class="section section-alt" id="related-guides">
    <div class="container">
      <div>
        <div class="section-head">
          <p class="eyebrow">Related local legal guides</p>
          <h2>More ${escapeHtml(city.name)} guides and location indexes.</h2>
        </div>
        <div class="related-grid">${
          isDui
            ? `<a class="related-card" href="/dui/locations/"><span>DUI/DWI locations</span><strong>All DUI and DWI guides by city</strong><p>Browse every DUI/DWI city guide by state and region.</p></a>`
            : ""
        }<a class="related-card" href="${clusterHref(region)}"><span>${escapeHtml(region.name)}</span><strong>Legal guide cluster</strong><p>Compare the city guides tied to this local court market and regional agency path.</p></a>${!isDui ? `<a class="related-card" href="/personal-injury/locations/"><span>Personal injury locations</span><strong>All car accident and injury guides by city</strong><p>Browse every injury city guide by state and region.</p></a>` : ""}${practicesForRegion(region)
          .filter((item) => item.slug !== practice.slug)
          .map((item) => {
            const label = item.slug === "dui" ? practiceSeoLabel(item, region) : item.label;
            return `<a class="related-card" href="${pathForPracticeCity(item.slug, city.slug)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(city.name)} ${escapeHtml(label)} guide</strong><p>${escapeHtml(item.summary)}</p></a>`;
          })
          .join("")}
          <article class="related-card muted-card"><span>Coming next</span><strong>Traffic Violations</strong><p>Speeding, reckless driving, and license points in local court.</p></article>
          <article class="related-card muted-card"><span>Coming next</span><strong>Criminal Defense</strong><p>Misdemeanor and felony court process for local cases.</p></article>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Nearby areas</p>
        <h2>Other ${escapeHtml(region.name)} guides.</h2>
      </div>
      <div class="chip-grid">${region.cities
        .filter((nearby) => nearby.slug !== city.slug)
        .map((nearby) => {
          const nearbyLabel = isDui ? `${nearby.name} ${practiceSeoLabel(practice, region)} guide` : nearby.name;
          return `<a class="city-chip" href="${pathForPracticeCity(practice.slug, nearby.slug)}">${escapeHtml(nearbyLabel)}</a>`;
        })
        .join("")}
        <a class="practice-chip" href="${clusterHref(region)}">${escapeHtml(region.name)} cluster hub</a>
        <a class="practice-chip" href="${isDui ? "/dui/locations/" : "/personal-injury/locations/"}">Browse all ${escapeHtml(
          isDui ? "DUI/DWI" : "personal injury"
        )} guides</a>
      </div>
    </div>
  </section>

  ${editorialReviewBlock(isDui)}

  <section class="section" id="faq">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">FAQ</p>
          <h2>Quick answers for ${escapeHtml(city.name)}.</h2>
        </div>
        <div class="faq-grid">${faq
          .map((item, index) => `<details class="faq-item"${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`)
          .join("")}</div>
      </div>
      <div>
        <div class="section-head">
          <p class="eyebrow">Sources</p>
          <h2>Official references used here.</h2>
        </div>
        <div class="source-grid" id="sources">${sourceCards(allSources)}</div>
      </div>
    </div>
  </section>`;

  return {
    body,
    faq,
    breadcrumbs,
    offices: [...courtOffices, ...enforcementOffices, ...(isDui ? [licenseOffice] : [])].filter(Boolean),
  };
}

function practiceHubContent(practice) {
  const isDui = practice.slug === "dui";
  const cards = isDui
    ? [
        ["Court path", "Each DUI or DWI city guide identifies the likely court reference, local clerk path, and nearby agencies connected to the stop or arrest."],
        ["License consequences", "The guides flag the separate driver-license track so readers know court dates and license deadlines may not move together."],
        ["Arresting agencies", "City police, county deputies, sheriff offices, and state police can all affect where reports, tickets, and evidence begin."],
        ["Official sources", "State statutes, court pages, driver-service agencies, and local law-enforcement resources are linked so readers can verify important details."],
      ]
    : [
        ["Accident reports", "City injury guides point readers toward the police, sheriff, or state agency that may hold crash or incident reports."],
        ["Local courts", "Each guide connects the city to the county court path that may matter if an insurance claim becomes a lawsuit."],
        ["Claim deadlines", "The guides keep state filing periods and public-entity warning signs visible before a claim gets delayed."],
        ["Documentation", "Readers get practical reminders about medical records, photos, bills, claim numbers, wage loss, and insurer letters."],
      ];
  const topics = isDui
    ? ["court path", "license consequences", "arresting agencies", "official sources", "state-specific DUI/DWI terminology"]
    : ["car accidents", "truck accidents", "slip and fall injuries", "pedestrian and bicycle accidents", "wrongful death"];

  return `<section class="section">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">How to use these guides</p>
          <h2>${escapeHtml(isDui ? "Start with the state, then narrow to the city." : "Start with the incident location, then find the local records path.")}</h2>
        </div>
        <div class="prose-block">
          <p>${escapeHtml(
            isDui
              ? "DUI and DWI cases are local in practice even when the legal rules come from state law. A reader may need to understand the county court, the city or state agency that made the stop, the license agency, and the official sources that explain penalties or administrative deadlines. These hub pages help readers move from the broad practice area to the city where the stop, arrest, or court date is connected."
              : "Personal injury claims are often organized around the place where the crash, fall, or incident happened. The useful first questions are practical: which agency may have the report, which court would handle a lawsuit, what deadline applies, what insurance documents exist, and what evidence should be preserved. These hub pages help readers choose the city guide that matches the records and court path."
          )}</p>
          <p>${escapeHtml(
            isDui
              ? "Use the state and region first, then choose the city closest to where the stop happened. Illinois generally uses DUI language, while Missouri and North Carolina commonly use DWI in official materials. People still search both terms, so the guides use clear local terminology and explain which official sources should be checked before decisions are made."
              : "Use the region first, then choose the city where the incident happened or where the responding agency is located. The guides are not a substitute for legal advice, but they can help readers organize accident reports, court references, insurance documents, claim deadlines, and local agency contacts before speaking with an insurer or attorney."
          )}</p>
        </div>
      </div>
      <div class="card-grid two-up">${cards.map((item) => `<article class="info-card"><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`).join("")}</div>
    </div>
    <div class="container">
      <div class="source-chip-row topic-chip-row" aria-label="Common topics">
        <span>Common topics:</span>
        ${topics.map((topic) => `<span>${escapeHtml(topic)}</span>`).join("")}
      </div>
    </div>
  </section>`;
}

function practicePage(practice) {
  const isDui = practice.slug === "dui";
  const regionCards = siteData.regions
    .filter((region) => regionHasPractice(region, practice.slug))
    .map((region) => {
      const cities = region.cities
        .map((city) => {
          const label = isDui ? `${city.name}, ${region.stateCode} ${practiceSeoLabel(practice, region)}` : city.name;
          return `<a class="city-link" href="${pathForPracticeCity(practice.slug, city.slug)}">${escapeHtml(label)}</a>`;
        })
        .join("");
      return `<article class="region-block">
        <div class="region-block-head">
          <p class="eyebrow">${escapeHtml(region.state)}</p>
          <h3><a class="text-link" href="${clusterHref(region)}">${escapeHtml(region.name)} cluster</a></h3>
        </div>
        <div class="city-link-grid">${cities}</div>
      </article>`;
    })
    .join("");

  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(practice.label)}</p>
        <h1>${escapeHtml(practice.title)}</h1>
        <p class="lede">${escapeHtml(practice.summary)}</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">All regions</span>
          <span class="pill pill-muted">City-by-city</span>
        </div>
        <p class="note">
          Choose a city to see the relevant court, agency, deadline, and official source links.
        </p>
        ${
          isDui
            ? `<div class="hero-actions"><a class="button button-secondary" href="/dui/locations/">Browse all DUI/DWI locations</a></div>`
            : `<div class="hero-actions"><a class="button button-secondary" href="/personal-injury/locations/">Browse all injury locations</a></div>`
        }
      </aside>
    </div>
  </section>
  ${
    isDui
      ? `<section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Featured DUI/DWI city guides</p>
        <h2>Early-performing DUI and DWI pages to start with.</h2>
        <p>These city guides are already showing early search impressions and now get direct crawl links from the DUI/DWI hub.</p>
      </div>
      <div class="related-grid">${priorityDuiGuideLinks()}</div>
    </div>
  </section>`
      : `<section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Featured car accident and injury guides</p>
        <h2>Priority personal injury pages to crawl first.</h2>
        <p>These city guides now get direct links from the personal injury hub and locations index, with car accident, crash report, insurance, and claim-document language.</p>
      </div>
      <div class="related-grid">${priorityPersonalInjuryGuideLinks()}</div>
    </div>
  </section>`
  }
  ${
    isDui && countyHubsList().some((hub) => hub.practiceSlug === "dui")
      ? `<section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">County-level guides</p>
        <h2>County-level guides that connect nearby city pages.</h2>
        <p>County pages explain the shared court and license path for a market, then link down to every city guide inside it.</p>
      </div>
      <div class="related-grid">${countyHubsList()
        .filter((hub) => hub.practiceSlug === "dui")
        .map(
          (hub) =>
            `<a class="related-card" href="${countyHubHref(hub)}"><span>${escapeHtml(hub.state)}</span><strong>${escapeHtml(hub.countyName)} ${escapeHtml(practiceSeoLabel(practice, hub))} guide</strong><p>${escapeHtml(hub.teaser)}</p></a>`
        )
        .join("")}</div>
    </div>
  </section>
  `
      : ""
  }${practiceHubContent(practice)}
  ${
    isDui
      ? ""
      : `<section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Personal injury resources</p>
        <h2>Crash reports, injury deadlines, and claim documents.</h2>
        <p>These source-backed resources give Google and readers a clearer path into car accident and personal injury topics before they choose a city guide.</p>
      </div>
      <div class="related-grid">
        <a class="related-card compact-related-card" href="/resources/north-carolina-car-accident-report-guide/">North Carolina car accident report guide</a>
        <a class="related-card compact-related-card" href="/resources/north-carolina-personal-injury-deadlines/">North Carolina personal injury deadlines</a>
        <a class="related-card compact-related-card" href="/resources/illinois-car-accident-report-guide/">Illinois car accident report guide</a>
        <a class="related-card compact-related-card" href="/resources/illinois-personal-injury-deadlines/">Illinois personal injury deadlines</a>
        <a class="related-card compact-related-card" href="/resources/missouri-car-accident-report-guide/">Missouri car accident report guide</a>
        <a class="related-card compact-related-card" href="/resources/missouri-personal-injury-deadlines/">Missouri personal injury deadlines</a>
      </div>
    </div>
  </section>`
  }
  ${
    isDui
      ? `<section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">DUI/DWI locations</p>
        <h2>Browse every DUI and DWI city guide by state.</h2>
        <p>These state sections create a direct crawl path to every DUI/DWI city page and use DWI labels outside Illinois where appropriate.</p>
      </div>
      ${groupedDuiLocationSections({ compact: true })}
    </div>
  </section>`
      : `<section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Personal injury locations</p>
        <h2>Browse every car accident and injury city guide by state.</h2>
        <p>These state sections create a direct crawl path to every personal injury city page and use car accident, crash report, insurance, and claim-document language.</p>
      </div>
      ${groupedPersonalInjuryLocationSections({ compact: true })}
    </div>
  </section>`
  }
  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Browse guides</p>
        <h2>Pick a region, then a city.</h2>
      </div>
      <div class="stack-grid">${regionCards}</div>
    </div>
  </section>`;
}

function duiLocationsPage() {
  const entries = duiCityEntries();

  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">DUI/DWI locations</p>
        <h1>DUI and DWI Guides by City</h1>
        <p class="lede">Browse DUI and DWI city guides by state, region, and local court market. Illinois pages use DUI labels, while Missouri and North Carolina pages use DWI labels where appropriate.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/dui/">DUI/DWI hub</a>
          <a class="button button-secondary" href="/sitemap-dui.xml">DUI sitemap</a>
        </div>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">${entries.length} city guides</span>
          <span class="pill pill-muted">${siteData.regions.length} regions</span>
        </div>
        <p class="note">Every DUI/DWI city page has a self-referencing canonical URL and is included in the DUI sitemap.</p>
      </aside>
    </div>
  </section>
  <section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Early search signals</p>
        <h2>Priority DUI/DWI guides to review first.</h2>
        <p>Google has started testing these city guides for DUI/DWI, attorney, traffic, probation, and license-related searches.</p>
      </div>
      <div class="related-grid">${priorityDuiGuideLinks()}</div>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">All locations</p>
        <h2>State and regional DUI/DWI guide index.</h2>
      </div>
      ${groupedDuiLocationSections()}
    </div>
  </section>`;
}

function personalInjuryLocationsPage() {
  const entries = personalInjuryCityEntries();

  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Personal injury locations</p>
        <h1>Car Accident and Personal Injury Guides by City</h1>
        <p class="lede">Browse personal injury city guides by state, region, crash-report path, insurance-document questions, and local court market.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/personal-injury/">Personal injury hub</a>
          <a class="button button-secondary" href="/sitemap.xml">Main sitemap</a>
        </div>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">${entries.length} city guides</span>
          <span class="pill pill-muted">${siteData.regions.length} regions</span>
        </div>
        <p class="note">Every personal injury city page has a self-referencing canonical URL and is included in the main sitemap.</p>
      </aside>
    </div>
  </section>
  <section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Priority injury pages</p>
        <h2>Car accident and injury guides to review first.</h2>
        <p>These city guides are linked first because they match the markets already getting DUI crawl activity or early personal injury impressions.</p>
      </div>
      <div class="related-grid">${priorityPersonalInjuryGuideLinks()}</div>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">All locations</p>
        <h2>State and regional personal injury guide index.</h2>
      </div>
      ${groupedPersonalInjuryLocationSections()}
    </div>
  </section>`;
}

function homePage() {
  const regionCards = siteData.regions.map(regionSummary).join("");
  const cityCount = siteData.regions.reduce((sum, region) => sum + region.cities.length, 0);
  const practiceCards = siteData.practiceAreas
    .map(
      (practice) => `<a class="practice-card" href="/${practice.slug}/">
        <span class="eyebrow">${escapeHtml(practice.label)}</span>
        <h3>${escapeHtml(practice.title)}</h3>
        <p>${escapeHtml(practice.summary)}</p>
        <span class="text-link">Browse ${escapeHtml(practice.label)} guides</span>
      </a>`
    )
    .join("");

  return `<section class="hero">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Free local legal guides</p>
        <h1>Know the local legal system, one city at a time.</h1>
        <p class="lede">
          ${siteData.siteName} is organized around the exact city where the
          case happens. It explains courts, enforcement, license offices, and local procedures without
          turning into a lawyer directory.
        </p>
        <div class="hero-actions">
          <a class="button button-primary" href="/dui/locations/">Browse DUI/DWI guides</a>
          <a class="button button-secondary" href="/personal-injury/locations/">Browse injury guides</a>
        </div>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Source-backed</span>
          <span class="pill pill-muted">Local first</span>
        </div>
        <dl class="stat-grid">
          <dt>Markets</dt><dd>Illinois, Missouri, North Carolina</dd>
          <dt>Practice areas</dt><dd>DUI + Personal Injury</dd>
          <dt>City pages</dt><dd>${cityCount} cities in the current map</dd>
          <dt>Sources</dt><dd>State law and court references</dd>
        </dl>
      </aside>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">DUI/DWI crawl path</p>
        <h2>Recently Published DUI/DWI Guides</h2>
        <p>Priority city guides for DUI and DWI searches, grouped into the broader locations index for easier discovery.</p>
      </div>
      <div class="related-grid">${recentDuiGuideLinks(18)}</div>
      <div class="hero-actions">
        <a class="button button-primary" href="/dui/locations/">Browse all DUI/DWI city guides</a>
        <a class="button button-secondary" href="/dui/">View DUI/DWI hub</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Car accident crawl path</p>
        <h2>Recently Published Personal Injury Guides</h2>
        <p>Priority city guides for car accident, crash report, insurance, and injury claim searches, grouped into a new locations index for easier discovery.</p>
      </div>
      <div class="related-grid">${recentPersonalInjuryGuideLinks(18)}</div>
      <div class="hero-actions">
        <a class="button button-primary" href="/personal-injury/locations/">Browse all injury city guides</a>
        <a class="button button-secondary" href="/personal-injury/">View personal injury hub</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Practice areas</p>
        <h2>Start with the issue, then choose the city.</h2>
      </div>
      <div class="card-grid two-up">${practiceCards}</div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Regions</p>
        <h2>Find guides by local court market.</h2>
      </div>
      <div class="card-grid regions-up">${regionCards}</div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">What each guide covers</p>
        <h2>The local facts people usually need first.</h2>
      </div>
      <div class="card-grid three-up">
        <article class="info-card"><h3>Where the case goes</h3><p>Courthouse references, court systems, and the local venue context for the city.</p></article>
        <article class="info-card"><h3>Who may be involved</h3><p>City agencies, county offices, and state systems that commonly touch the issue.</p></article>
        <article class="info-card"><h3>What deadlines matter</h3><p>License consequences, filing windows, and official sources to confirm the next step.</p></article>
      </div>
    </div>
  </section>`;
}

function regionsPage() {
  const cards = siteData.regions.map(regionSummary).join("");
  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Regions</p>
        <h1>Browse by market, then by city.</h1>
        <p class="lede">
          Regions group nearby cities that often share a courthouse, county process, or state agency
          reference. Start with the area closest to where the case or claim happened.
        </p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">${siteData.regions.length} regions</span>
          <span class="pill pill-muted">${siteData.regions.reduce((sum, region) => sum + region.cities.length, 0)} cities</span>
        </div>
        <p class="note">Each region links to city guides for DUI/DWI and personal injury.</p>
      </aside>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="card-grid regions-up">${cards}</div>
    </div>
  </section>`;
}

function clusterCityGuideCards(region) {
  return region.cities
    .map((city) => {
      const links = practicesForRegion(region)
        .map((practice) => {
          const label = practice.slug === "dui" ? `${practiceSeoLabel(practice, region)} guide` : `${practice.label} guide`;
          return `<a class="practice-chip" href="${pathForPracticeCity(practice.slug, city.slug)}">${escapeHtml(label)}</a>`;
        })
        .join("");
      return `<article class="info-card">
        <h3>${escapeHtml(city.name)}</h3>
        <p>${escapeHtml(city.local_context_intro ?? `Use the city guide that matches where the case, stop, crash, or claim happened inside ${region.name}.`)}</p>
        <div class="chip-grid">${links}</div>
      </article>`;
    })
    .join("");
}

function regionPage(region) {
  const packageInfo = sponsorPackage(region);
  const court = regionPrimaryCourt(region);
  const enforcement = regionEnforcementOffices(region);
  const licenseOffice = region.licenseOffice;
  const faq = regionFaq(region, court);
  const sources = regionSourceList(region, court, licenseOffice, enforcement);
  const cityGuideCards = clusterCityGuideCards(region);

  const regionPractices = practicesForRegion(region);
  const practiceLinks = regionPractices
    .map(
      (practice) => `<a class="practice-chip" href="/${practice.slug}/">${escapeHtml(practice.label)}</a>`
    )
    .join("");

  const sponsorCoverage = region.cities
    .map((city) => `<li>${escapeHtml(city.name)} city page for the selected practice area.</li>`)
    .join("");

  const sponsorPackageDetails = [
    ["Regional placement", `Featured sponsor placement on this ${region.name} cluster page for the selected practice area.`],
    ["City-page placement", `Sponsor visibility across ${region.cities.length} related city guides for the selected practice area.`],
    ["Clear disclosure", "Attorney advertising is labeled and kept separate from official court, police, records, and DMV information."],
    ["Annual package", `${packageInfo.termLabel} for the selected practice area. Founding sponsors can claim the ${launchPackageLabel}.`],
  ]
    .map((item) => `<article class="info-card"><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`)
    .join("");

  const sponsorInventoryRows = regionPractices
    .map(
      (practice) => `<tr>
        <td>${escapeHtml(practice.label)}</td>
        <td>${escapeHtml(packageInfo.status === "sponsored" ? "Sponsored" : "Available")}</td>
        <td>${escapeHtml(launchPackageLabel)}</td>
        <td>${escapeHtml(packageInfo.termLabel)}</td>
        <td><a class="text-link" href="/sponsorships/" ${trackingAttrs("claim_package_click", {
          region: region.slug,
          practice: practice.slug,
          placement: "cluster_inventory",
          status: packageInfo.status,
        })}>Reserve ${escapeHtml(practice.label)} Sponsorship</a></td>
      </tr>`
    )
    .join("");

  const sponsorReasons = [
    "Nearby city guides are grouped into one practical local territory.",
    "Pages are built around court, police, records, license, and insurance questions readers actually search.",
    "No competing sponsor appears in the same practice-area inventory slot during the term.",
    "The sponsor sits beside useful local information instead of inside a crowded lawyer directory.",
  ]
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(region.state)}</p>
        <h1>${escapeHtml(region.name)}</h1>
        <p class="lede">${escapeHtml(region.teaser)}</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">${region.cities.length} cities</span>
          <span class="pill pill-muted">${guideCount(region)} guides</span>
        </div>
        <p class="note">Use this regional page to compare city guides, court references, law-enforcement paths, and state agency links before choosing one local page.</p>
      </aside>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">City coverage</p>
        <h2>${escapeHtml(region.name)} city guides.</h2>
        <p>Start with the city closest to where the stop, arrest, crash, injury, or court notice is connected. Each city page keeps its local police, court, records, and source links separate.</p>
      </div>
      <div class="card-grid three-up">${cityGuideCards}</div>
    </div>
  </section>

  ${wakeSouthwestRegionalTopicSection(region)}

  <section class="section section-directory" id="regional-directory">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Regional directory</p>
        <h2>County court, enforcement, and driver-service references for ${escapeHtml(region.name)}.</h2>
        <p>These are the broader offices that often sit above the city pages in the real process: county courts, sheriff or regional enforcement, and the license office readers may need next.</p>
      </div>
      <div class="directory-grid">
        <div>
          <div class="directory-label">Courts</div>
          <div class="office-stack">${officeCards(regionCourtOffices(region))}</div>
        </div>
        <div>
          <div class="directory-label">Enforcement</div>
          <div class="office-stack">${officeCards(enforcement)}</div>
        </div>
        <div>
          <div class="directory-label">Driver services</div>
          <div class="office-stack">${officeCards(licenseOffice ? [licenseOffice] : [])}</div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Why this market matters</p>
        <h2>Local legal intent in one county-level territory.</h2>
      </div>
      <div class="card-grid four-up">${regionWhyItMatters(region, court, licenseOffice, enforcement)}</div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Regional process</p>
        <h2>How people usually use this page before choosing a city guide.</h2>
      </div>
      <div class="deadline-grid">${regionProcessCards(region, court)}</div>
    </div>
  </section>

  <section class="section">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Regional FAQ</p>
          <h2>Common questions about ${escapeHtml(region.name)}.</h2>
        </div>
        <div class="faq-grid">${faq
          .map((item, index) => `<details class="faq-item"${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`)
          .join("")}</div>
      </div>
      <div>
        <div class="section-head">
          <p class="eyebrow">Official sources</p>
          <h2>County and state references used for this regional page.</h2>
        </div>
        <div class="source-grid">${sourceCards(sources)}</div>
      </div>
    </div>
  </section>

  <section class="section section-alt" id="regional-sponsor">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Attorney advertising</p>
          <h2>Practice-area sponsorship availability in ${escapeHtml(region.name)}.</h2>
          <p>Each enabled practice area is treated as its own annual sponsorship slot. Sponsored placements are labeled advertising and kept separate from official local information.</p>
        </div>
        <div class="responsive-table"><table>
          <thead><tr><th>Practice Area</th><th>Status</th><th>Founding Price</th><th>Term</th><th>CTA</th></tr></thead>
          <tbody>${sponsorInventoryRows}</tbody>
        </table></div>
        <div class="section-head section-head-compact">
          <p class="eyebrow">Why attorneys sponsor this territory</p>
          <h2>A focused regional placement.</h2>
        </div>
        <div class="card-grid two-up">${sponsorPackageDetails}</div>
        <div class="sponsor-disclosure sponsor-disclosure-inline">
          <strong>Market notes</strong>
          <ul class="sponsor-coverage-list">${sponsorReasons}</ul>
        </div>
      </div>
      <div>
        ${sponsorProfileCard(region, packageInfo, "cluster")}
        <div class="sponsor-disclosure">
          <strong>Included city coverage</strong>
          <ul class="sponsor-coverage-list">${sponsorCoverage}</ul>
        </div>
      </div>
    </div>
  </section>`;
}

function sponsorshipPage() {
  const cityCount = siteData.regions.reduce((sum, region) => sum + region.cities.length, 0);
  const guideCountTotal = siteData.regions.reduce((sum, region) => sum + guideCount(region), 0);

  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">For attorneys</p>
        <h1>Claim a regional sponsorship where local legal questions start.</h1>
        <p class="lede">Local Legal Guides offers one clearly labeled sponsor slot per practice area per region. DUI/DWI and Personal Injury are sold separately. Founding packages are available as a ${escapeHtml(launchPackageLabel)}.</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">${siteData.regions.length} markets</span>
          <span class="pill pill-muted">${cityCount} cities</span>
        </div>
        <p class="note">${guideCountTotal} city guides are live across DUI/DWI and Personal Injury. Questions about availability or placement? Email ${siteData.sponsorsEmail}.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/sponsor-media-kit/">View Available Markets</a>
          <a class="button button-secondary" href="#sponsor-inquiry">Claim a Sponsorship</a>
        </div>
      </aside>
    </div>
  </section>

  <section class="section">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Why attorneys sponsor</p>
          <h2>Visibility beside useful local legal information, not inside a crowded directory.</h2>
          <p>Visitors arrive while researching arrests, injuries, deadlines, court locations, police reports, license consequences, and insurance questions. The sponsor placement appears next to that local decision-making content with clear advertising disclosure.</p>
        </div>
      </div>
      <div class="card-grid two-up">
        <article class="info-card"><h3>High-intent context</h3><p>City pages are framed around what to do after a DUI/DWI arrest or accident, then supported by local courts, agencies, deadlines, and source links.</p></article>
        <article class="info-card"><h3>Not a lawyer directory</h3><p>No rankings, shared lead form, bidding stack, or side-by-side competitor list on the same sponsor slot.</p></article>
        <article class="info-card"><h3>Practice-area exclusivity</h3><p>One sponsor per practice area per region. DUI/DWI and Personal Injury are sold separately.</p></article>
        <article class="info-card"><h3>Simple launch offer</h3><p>The founding offer is a ${escapeHtml(launchPackageLabel)}. This is annual visibility, not pay-per-lead.</p></article>
      </div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container split-grid">
      <div class="section-head">
        <p class="eyebrow">What the sponsor receives</p>
        <h2>A simple package attorneys can understand quickly.</h2>
        <p>Each sponsorship is clearly labeled attorney advertising and remains separate from official court, police, records, DMV, and source information.</p>
      </div>
      <div class="card-grid two-up">
        <article class="info-card"><h3>Regional page placement</h3><p>Featured sponsor placement on the cluster page for the selected practice area.</p></article>
        <article class="info-card"><h3>Related city-page cards</h3><p>Sponsor card or sponsor availability placement on related city pages in the purchased practice area.</p></article>
        <article class="info-card"><h3>Phone/link CTA</h3><p>Firm name, service area, phone or call link, website link, and attorney advertising disclosure when sponsor details are supplied.</p></article>
        <article class="info-card"><h3>Tracking ready</h3><p>Optional tracking URL or UTM link, plus existing click events for sponsor CTAs, calls, package claims, and sponsorship inquiries.</p></article>
        <article class="info-card"><h3>12-month exclusivity</h3><p>No competing sponsor in the same practice-area slot during the package term.</p></article>
        <article class="info-card"><h3>Clear disclosure</h3><p>Sponsor placement is advertising, not a ranking, endorsement, recommendation, or legal advice.</p></article>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Sponsor contact</p>
          <h2>Ready to see available markets?</h2>
          <p>Start with the available markets list, then claim the region and practice area you want. Prefer email? Contact <a class="text-link" href="mailto:${siteData.sponsorsEmail}">${siteData.sponsorsEmail}</a>.</p>
        </div>
        <div class="hero-actions">
          <a class="button button-primary" href="/sponsor-media-kit/">View Available Markets</a>
          <a class="button button-secondary" href="/sponsor-agreement/">Sponsor terms</a>
        </div>
      </div>
      <div class="hero-card">
        <div class="hero-card-header">
          <span class="pill">${escapeHtml(launchPackageLabel)}</span>
          <span class="pill pill-muted">12-month term</span>
        </div>
        <p class="note">One sponsor per practice area per region. DUI/DWI and Personal Injury are sold separately.</p>
      </div>
    </div>
  </section>

  ${sponsorInquiryForm({
    title: "Claim a Sponsorship",
    intro: "Send a prefilled sponsorship inquiry for the cluster you want to reserve.",
  })}`;
}

const resourcePages = {
  "/resources/missouri-dwi-administrative-hearing/": {
    title: "Missouri DWI Administrative Hearing Guide",
    description:
      "Missouri DWI administrative hearing resource covering Form 2385, the Department of Revenue license track, 15-day hearing requests, and official DOR sources.",
    body: resourcePage({
      eyebrow: "Missouri DWI resource",
      title: "Missouri DWI administrative hearing guide.",
      intro:
        "A Missouri DWI arrest can create two separate tracks: the criminal case and the Department of Revenue driver-license process. This resource explains the DOR administrative hearing path so readers know why license paperwork should be reviewed quickly.",
      cards: [
        ["Separate DOR track", "The Missouri Department of Revenue explains that administrative license action can move separately from the criminal ticket or court case."],
        ["Form 2385 deadline", "The DOR states that a written administrative hearing request tied to Form 2385 has a 15-day timing requirement."],
        ["Hearing format", "DOR materials explain that administrative alcohol hearings may be scheduled in person or by telephone depending on the request and circumstances."],
      ],
      bullets: [
        "Find the Notice of Suspension/Revocation of Driving Privilege, commonly referenced as Form 2385.",
        "Confirm the date the notice was issued and compare it to official DOR hearing-request instructions.",
        "Separate the criminal court date from the Department of Revenue license issue.",
        "Ask a Missouri DWI attorney whether the administrative hearing, restricted driving options, and court case should be handled together.",
      ],
      sources: [
        { label: "Missouri DOR DWI information", href: "https://dor.mo.gov/driver-license/revocation-reinstatement/dwi.html" },
        { label: "Missouri DOR Administrative Alcohol FAQ", href: "https://dor.mo.gov/faq/driver-license/administrative-alcohol.html" },
        { label: "Missouri Form 2385", href: "https://dor.mo.gov/forms/2385.pdf" },
        { label: "Missouri DOR Restricted Driving Privilege", href: "https://dor.mo.gov/driver-license/revocation-reinstatement/rdp-alcohol.html" },
      ],
      relatedLinks: [
        ["Nixa DWI administrative hearing guide", "/dui/nixa-mo/"],
        ["Wentzville DWI and traffic charges guide", "/dui/wentzville-mo/"],
        ["O'Fallon DWI lawyer questions guide", "/dui/ofallon-mo/"],
        ["Manchester DUI/DWI attorney search guide", "/dui/manchester-mo/"],
      ],
    }),
  },
  "/resources/missouri-dwi-administrative-hearing-lawyer-questions/": {
    title: "Missouri DWI Administrative Hearing Lawyer Questions",
    description:
      "Missouri DWI resource covering administrative hearing lawyer questions, Form 2385, 15-day hearing timing, restricted driving privileges, and DOR license consequences.",
    body: resourcePage({
      eyebrow: "Missouri DWI resource",
      title: "Missouri DWI administrative hearing lawyer questions.",
      intro:
        "Missouri DWI cases often create urgent questions about administrative hearings, license deadlines, and whether the court case is the only problem to solve. This resource gives readers neutral questions to ask before a missed DOR license deadline turns into a larger problem.",
      cards: [
        ["Ask about the DOR deadline", "A Missouri DWI arrest can create a Department of Revenue license issue that moves separately from the criminal court date."],
        ["Ask about Form 2385", "The notice paperwork can control how and when an administrative hearing request should be made."],
        ["Ask about restricted driving", "Restricted driving privilege, SATOP, insurance proof, ignition interlock, reinstatement fees, or other DOR steps may apply depending on the facts."],
        ["Ask about court coordination", "A lawyer may need to review how the license issue, municipal or circuit court case, police reports, testing records, and plea decisions fit together."],
      ],
      bullets: [
        "Does the 15-day DOR hearing request window apply to this notice?",
        "What happens if the administrative hearing is not requested on time?",
        "Could a restricted driving privilege or ignition interlock issue apply?",
        "What documents should be gathered before the first lawyer consultation?",
        "How does the DOR license track affect the criminal DWI case?",
        "What should be avoided before the first court date?",
      ],
      sources: [
        { label: "Missouri DOR DWI information", href: "https://dor.mo.gov/driver-license/revocation-reinstatement/dwi.html" },
        { label: "Missouri DOR Administrative Alcohol FAQ", href: "https://dor.mo.gov/faq/driver-license/administrative-alcohol.html" },
        { label: "Missouri Form 2385", href: "https://dor.mo.gov/forms/2385.pdf" },
        { label: "Missouri DOR Restricted Driving Privilege", href: "https://dor.mo.gov/driver-license/revocation-reinstatement/rdp-alcohol.html" },
      ],
      relatedLinks: [
        ["Wentzville DWI guide", "/dui/wentzville-mo/"],
        ["Moscow Mills DWI guide", "/dui/moscow-mills-mo/"],
        ["Pacific DWI guide", "/dui/pacific-mo/"],
        ["Nixa DWI guide", "/dui/nixa-mo/"],
        ["Manchester DWI guide", "/dui/manchester-mo/"],
        ["O'Fallon DWI guide", "/dui/ofallon-mo/"],
        ["Hazelwood DWI guide", "/dui/hazelwood-mo/"],
        ["Republic DWI guide", "/dui/republic-mo/"],
      ],
    }),
  },
  "/resources/north-carolina-dwi-consequences-limited-driving-privilege/": {
    title: "North Carolina DWI Consequences and Limited Driving Privilege Guide",
    description:
      "North Carolina DWI resource covering punishment levels, probation conditions, misdemeanor consequences, license suspension, and limited driving privilege sources.",
    body: resourcePage({
      eyebrow: "North Carolina DWI resource",
      title: "North Carolina DWI consequences and limited driving privilege guide.",
      intro:
        "North Carolina DWI cases can involve court punishment levels, probation conditions, license consequences, and limited-driving-privilege questions. This resource explains the official-source path before readers return to a city guide for local courts, police, and DMV offices.",
      cards: [
        ["Punishment levels", "North Carolina describes multiple DWI punishment levels, with penalties affected by aggravating, mitigating, and grossly aggravating factors."],
        ["Probation conditions", "Depending on the sentence level and facts, probation can involve court-ordered conditions such as assessment, treatment, community service, monitoring, or active time."],
        ["Limited driving privilege", "A limited driving privilege is a court order under North Carolina law, and eligibility depends on the revocation, facts, and statutory requirements."],
      ],
      bullets: [
        "Keep the citation, court date, bond or release paperwork, and any revocation notice.",
        "Separate the Wake County or local court case from the NCDMV license issue.",
        "Ask whether probation, community service, assessment, treatment, or monitoring could apply.",
        "Check whether limited driving privilege questions should be handled before making court decisions.",
      ],
      sources: [
        { label: "North Carolina State Highway Patrol DWI law summary", href: "https://www.ncshp.gov/ncshp/commercial-vehicles/laws" },
        { label: "NCDMV license suspension", href: "https://www.ncdot.gov/dmv/license-id/license-suspension/Pages/" },
        { label: "NCGS 20-179.3 limited driving privilege", href: "https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_20/GS_20-179.3.pdf" },
      ],
      relatedLinks: [
        ["North Carolina DWI misdemeanor, probation, and dismissal guide", "/resources/north-carolina-dwi-misdemeanor-probation-dismissal/"],
        ["Apex DWI consequences and probation guide", "/dui/apex-nc/"],
        ["Cary DWI guide", "/dui/cary-nc/"],
        ["Pineville DWI guide", "/dui/pineville-nc/"],
        ["North Raleigh DWI guide", "/dui/north-raleigh-nc/"],
        ["Matthews DWI guide", "/dui/matthews-nc/"],
      ],
    }),
  },
  "/resources/north-carolina-dwi-misdemeanor-probation-dismissal/": {
    title: "North Carolina DWI Misdemeanor, Probation, and Dismissal Guide",
    description:
      "North Carolina DWI resource covering misdemeanor consequences, probation conditions, dismissal questions, case outcomes, defense records, and official sources.",
    body: resourcePage({
      eyebrow: "North Carolina DWI resource",
      title: "North Carolina DWI misdemeanor, probation, and dismissal guide.",
      intro:
        "North Carolina DWI searches often focus on practical questions: whether a DWI is a misdemeanor, what probation can involve, when dismissal may be possible, and how outcomes depend on evidence and punishment levels. This resource gives a neutral source-backed overview before readers choose a city guide.",
      cards: [
        ["Misdemeanor does not mean minor", "Many North Carolina DWI cases are misdemeanors, but punishment levels, aggravating factors, prior history, license consequences, and probation conditions can still make the case serious."],
        ["Probation can be fact-specific", "Probation conditions may involve assessment, treatment, monitoring, community service, court costs, compliance reviews, or active time depending on the sentence level and facts."],
        ["Dismissal questions are evidence questions", "Dismissal depends on the stop, arrest, testing, witness proof, video, paperwork, procedure, and court rulings. No page can predict that outcome without case-specific review."],
        ["Case outcomes vary", "Possible outcomes depend on current law, local court procedure, evidence, prior record, mitigation, aggravating factors, and whether license issues are resolved separately."],
      ],
      bullets: [
        "Keep the citation, release paperwork, court date, and any civil revocation or NCDMV notice.",
        "Gather police agency information, crash report details, witness names, test paperwork, and video references when available.",
        "Ask whether punishment levels, probation conditions, limited driving privilege, and license consequences should be reviewed together.",
        "Use the city guide for local police, court, and records contacts after reading the statewide overview.",
      ],
      sources: [
        { label: "North Carolina State Highway Patrol DWI law summary", href: "https://www.ncshp.gov/ncshp/commercial-vehicles/laws" },
        { label: "NCDMV license suspension", href: "https://www.ncdot.gov/dmv/license-id/license-suspension/Pages/" },
        { label: "NCGS 20-179.3 limited driving privilege", href: "https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_20/GS_20-179.3.pdf" },
      ],
      relatedLinks: [
        ["Apex DWI misdemeanor and dismissal guide", "/dui/apex-nc/"],
        ["Cary DWI guide", "/dui/cary-nc/"],
        ["Pineville DWI guide", "/dui/pineville-nc/"],
        ["North Raleigh DWI guide", "/dui/north-raleigh-nc/"],
        ["Matthews DWI guide", "/dui/matthews-nc/"],
      ],
    }),
  },
  "/resources/illinois-dui-license-suspension/": {
    title: "Illinois DUI License Suspension Guide",
    description:
      "Illinois DUI license suspension resource covering statutory summary suspension, refusal consequences, reinstatement sources, and official Secretary of State references.",
    body: resourcePage({
      eyebrow: "Illinois DUI resource",
      title: "Illinois DUI license suspension guide.",
      intro:
        "Illinois DUI cases can involve a criminal court file and a separate driver-license track. This resource explains the practical source path readers should understand before assuming the court date is the only deadline that matters.",
      cards: [
        ["Separate license track", "A statutory summary suspension can move separately from the criminal DUI case, and deadlines can be strict."],
        ["Refusal consequences", "Refusing chemical testing can create separate administrative consequences that should be checked against official state sources."],
        ["Reinstatement issues", "Reinstatement may involve state forms, fees, evaluations, hearings, or proof of eligibility depending on the case history."],
      ],
      bullets: [
        "Find the court paperwork and ticket number.",
        "Keep any Secretary of State notice.",
        "Confirm whether a hearing, petition, or reinstatement step has a separate deadline.",
        "Use official state sources and seek legal advice before missing a license deadline.",
      ],
      sources: [
        { label: "Illinois Secretary of State", href: "https://www.ilsos.gov/" },
        { label: "Illinois Compiled Statutes", href: "https://www.ilga.gov/legislation/ilcs/ilcs.asp" },
      ],
    }),
  },
  "/resources/madison-county-dui-process/": {
    title: "Madison County DUI Process Guide",
    description:
      "Madison County DUI process resource covering arrest paperwork, first court date, discovery, license issues, and official county references.",
    body: resourcePage({
      eyebrow: "Madison County DUI resource",
      title: "Madison County DUI process guide.",
      intro:
        "DUI cases connected to Edwardsville and nearby Madison County communities often involve local police or sheriff paperwork, a county court date, and a separate license track. This resource gives readers a neutral process overview before choosing a city guide.",
      cards: [
        ["First paperwork", "Tickets, bond forms, release paperwork, test documents, and tow or impound records can all matter."],
        ["County court path", "The first Madison County court date is usually the next visible step, but it may not be the only deadline."],
        ["Evidence review", "Discovery, reports, test records, video, and crash information may shape later plea, hearing, trial, or dismissal questions."],
      ],
      bullets: processTimeline(true),
      sources: [
        { label: "Madison County Circuit Clerk", href: "https://www.madisoncountyil.gov/departments/circuit_clerk/index.php" },
        { label: "Madison County Courthouse", href: "https://www.madisoncountyil.gov/departments/courts/index.php" },
      ],
    }),
  },
  "/resources/illinois-personal-injury-deadlines/": {
    title: "Illinois Personal Injury Deadlines Guide",
    description:
      "Illinois personal injury deadline resource covering ordinary injury filing periods, evidence preservation, government notice warnings, and official sources.",
    body: resourcePage({
      eyebrow: "Illinois injury resource",
      title: "Illinois personal injury deadlines guide.",
      intro:
        "Illinois injury claims depend on facts, defendants, insurance coverage, medical proof, and deadlines. This resource helps readers separate ordinary claim timing from issues that can require faster attention.",
      cards: [
        ["General filing period", "Many injury claims have a two-year filing period, but readers should verify the specific claim type and facts."],
        ["Government warnings", "Claims involving public vehicles, public property, or public agencies can involve special notice rules or shorter practical deadlines."],
        ["Evidence preservation", "Photos, reports, medical records, bills, wage records, and insurer letters are easier to organize early than reconstruct later."],
      ],
      bullets: documentChecklist(false),
      sources: [
        { label: "735 ILCS 5 Article XIII", href: "https://www.ilga.gov/legislation/ilcs/ilcs4.asp?ActID=2017&ChapterID=56&DocName=073500050HArt.+XIII&SeqEnd=105400000&SeqStart=99600000" },
        { label: "Illinois Courts", href: "https://www.illinoiscourts.gov/" },
      ],
      relatedLinks: [
        ["Edwardsville personal injury guide", "/personal-injury/edwardsville-il/"],
        ["Madison County accident report guide", "/resources/madison-county-accident-report-guide/"],
      ],
    }),
  },
  "/resources/north-carolina-car-accident-report-guide/": {
    title: "North Carolina Car Accident Report Guide",
    description:
      "North Carolina car accident report resource covering NCDMV crash reports, local investigating agencies, insurance documentation, and injury-claim records.",
    body: resourcePage({
      eyebrow: "North Carolina injury resource",
      title: "North Carolina car accident report guide.",
      intro:
        "A North Carolina injury claim often starts with practical records: the crash report, the responding agency, medical documentation, insurance letters, and any later court filing. This resource keeps the records path separate from legal advice.",
      cards: [
        ["Crash report source", "NCDMV maintains a crash-report request path for reports created by law enforcement agencies in North Carolina."],
        ["Agency details matter", "The city police department, county sheriff, or State Highway Patrol may be the investigating agency depending on where the crash happened."],
        ["Insurance documents", "Claim numbers, insurer letters, repair estimates, medical bills, and wage documentation can all become important later."],
      ],
      bullets: documentChecklist(false),
      sources: [
        { label: "Official NCDMV crash reports", href: "https://www.ncdot.gov/dmv/offices-services/records-reports/Pages/crash-reports.aspx" },
        { label: "NCDOT crash data", href: "https://www.ncdot.gov/initiatives-policies/safety/traffic-safety/Pages/crash-data.aspx" },
        { label: "NCDMV crash report form resources", href: "https://connect.ncdot.gov/business/DMV/Pages/Crash-Facts.aspx" },
      ],
      relatedLinks: [
        ["Apex car accident guide", "/personal-injury/apex-nc/"],
        ["Cary car accident guide", "/personal-injury/cary-nc/"],
        ["Holly Springs car accident guide", "/personal-injury/holly-springs-nc/"],
        ["Fuquay-Varina car accident guide", "/personal-injury/fuquay-varina-nc/"],
      ],
    }),
  },
  "/resources/north-carolina-personal-injury-deadlines/": {
    title: "North Carolina Personal Injury Deadlines Guide",
    description:
      "North Carolina personal injury deadline resource covering injury filing periods, claim documentation, crash reports, and official statute sources.",
    body: resourcePage({
      eyebrow: "North Carolina injury resource",
      title: "North Carolina personal injury deadlines guide.",
      intro:
        "North Carolina injury claims can involve insurance deadlines, medical-record timing, evidence preservation, and court filing periods. This guide points readers to official statute and crash-report sources before they rely on assumptions.",
      cards: [
        ["Filing period", "North Carolina statute sources should be checked for the filing period that applies to the specific injury claim."],
        ["Records first", "Crash reports, photographs, medical records, bills, wage documents, and insurer letters are easier to preserve early."],
        ["Different claim types", "Wrongful death, claims involving public entities, and other fact patterns can involve different rules than an ordinary injury claim."],
      ],
      bullets: documentChecklist(false),
      sources: [
        { label: "NC General Statutes Chapter 1 Article 3", href: "https://house.ncleg.gov/EnactedLegislation/Statutes/PDF/ByArticle/Chapter_1/Article_3.pdf" },
        { label: "Official NCDMV crash reports", href: "https://www.ncdot.gov/dmv/offices-services/records-reports/Pages/crash-reports.aspx" },
      ],
      relatedLinks: [
        ["Apex injury guide", "/personal-injury/apex-nc/"],
        ["Cary injury guide", "/personal-injury/cary-nc/"],
        ["North Carolina car accident report guide", "/resources/north-carolina-car-accident-report-guide/"],
      ],
    }),
  },
  "/resources/missouri-car-accident-report-guide/": {
    title: "Missouri Car Accident Report Guide",
    description:
      "Missouri car accident report resource covering Missouri State Highway Patrol crash reports, local agency records, insurance documents, and injury claim records.",
    body: resourcePage({
      eyebrow: "Missouri injury resource",
      title: "Missouri car accident report guide.",
      intro:
        "Missouri crash records depend on the investigating agency. A city police department, county sheriff, or Missouri State Highway Patrol troop may be the right starting point depending on where the crash happened.",
      cards: [
        ["Highway Patrol reports", "Missouri State Highway Patrol provides an official crash-report search and request path for Patrol investigations."],
        ["Local agency reports", "If a city police department or sheriff handled the scene, the report path may start with that local agency instead."],
        ["Useful details", "Date, county, roadway, report number, involved drivers, insurer information, and responding agency details can make records requests easier."],
      ],
      bullets: documentChecklist(false),
      sources: [
        { label: "Missouri State Highway Patrol crash reports", href: "https://www.mshp.dps.mo.gov/HP68/search.jsp" },
        { label: "MSHP official crash report information", href: "https://www.machs.mo.gov/HP68/static/Official.html" },
      ],
      relatedLinks: [
        ["Manchester car accident guide", "/personal-injury/manchester-mo/"],
        ["O'Fallon car accident guide", "/personal-injury/ofallon-mo/"],
        ["Wentzville car accident guide", "/personal-injury/wentzville-mo/"],
      ],
    }),
  },
  "/resources/missouri-personal-injury-deadlines/": {
    title: "Missouri Personal Injury Deadlines Guide",
    description:
      "Missouri personal injury deadline resource covering injury filing periods, crash reports, insurance documents, and official Missouri statute sources.",
    body: resourcePage({
      eyebrow: "Missouri injury resource",
      title: "Missouri personal injury deadlines guide.",
      intro:
        "Missouri injury claims can involve insurance timing, medical proof, evidence preservation, and court filing periods. This resource links to official statute and crash-report sources so readers can verify the legal source path.",
      cards: [
        ["Statute source", "Missouri Revised Statutes Section 516.120 is an official source readers should check for injury-to-person or rights timing language."],
        ["Crash records", "The investigating agency matters; some crash reports start with MSHP, while others start with a city police department or sheriff."],
        ["Evidence preservation", "Medical records, photographs, repair estimates, claim numbers, insurer letters, and witness information should be organized early."],
      ],
      bullets: documentChecklist(false),
      sources: [
        { label: "RSMo Section 516.120", href: "https://revisor.mo.gov/main/OneSection.aspx?section=516.120" },
        { label: "Missouri State Highway Patrol crash reports", href: "https://www.mshp.dps.mo.gov/HP68/search.jsp" },
      ],
      relatedLinks: [
        ["Manchester injury guide", "/personal-injury/manchester-mo/"],
        ["Missouri car accident report guide", "/resources/missouri-car-accident-report-guide/"],
      ],
    }),
  },
  "/resources/illinois-car-accident-report-guide/": {
    title: "Illinois Car Accident Report Guide",
    description:
      "Illinois car accident report resource covering Illinois State Police crash reports, local investigating agencies, report criteria, and injury claim records.",
    body: resourcePage({
      eyebrow: "Illinois injury resource",
      title: "Illinois car accident report guide.",
      intro:
        "Illinois crash records depend on whether Illinois State Police or another law enforcement agency handled the crash. This resource helps readers start with the correct official report path.",
      cards: [
        ["Investigating agency", "Illinois State Police explains that if the report does not indicate Illinois State Police, readers should contact the listed investigating agency."],
        ["Report criteria", "Illinois State Police publishes crash-report criteria and online crash-reporting resources."],
        ["Claim documents", "A report is only one record; injury claims may also depend on medical records, bills, photographs, repair estimates, wage records, and insurer letters."],
      ],
      bullets: documentChecklist(false),
      sources: [
        { label: "Illinois traffic crash report service", href: "https://www.illinois.gov/services/service.traffic-crash-report.html" },
        { label: "Illinois State Police crash reports", href: "https://isp.illinois.gov/CrashReports" },
      ],
      relatedLinks: [
        ["Edwardsville injury guide", "/personal-injury/edwardsville-il/"],
        ["Collinsville injury guide", "/personal-injury/collinsville-il/"],
        ["Illinois personal injury deadlines guide", "/resources/illinois-personal-injury-deadlines/"],
      ],
    }),
  },
  "/resources/madison-county-accident-report-guide/": {
    title: "Madison County Accident Report Guide",
    description:
      "Madison County accident report resource covering city police reports, county sheriff records, Illinois State Police reports, and documents to gather.",
    body: resourcePage({
      eyebrow: "Madison County records resource",
      title: "Madison County accident report guide.",
      intro:
        "Accident and incident reports usually start with the agency that handled the scene. For Edwardsville and nearby Madison County communities, that may be city police, the Madison County Sheriff, or Illinois State Police depending on where the crash happened.",
      cards: [
        ["Inside city limits", "Start with the city police department if the crash or incident was handled by municipal officers."],
        ["Outside city limits", "The county sheriff or Illinois State Police may be the correct source for county roads, highways, or interstate crashes."],
        ["Report details", "Date, location, report number, involved drivers, vehicle information, and responding agency details can make the request easier."],
      ],
      bullets: documentChecklist(false),
      sources: [
        { label: "Edwardsville Police", href: "https://www.cityofedwardsville.com/217/Police" },
        { label: "Madison County Sheriff", href: "https://www.madisoncountyil.gov/departments/sheriff/index.php" },
        { label: "Illinois State Police", href: "https://isp.illinois.gov/" },
      ],
      relatedLinks: [
        ["Edwardsville personal injury guide", "/personal-injury/edwardsville-il/"],
        ["Collinsville personal injury guide", "/personal-injury/collinsville-il/"],
        ["Fairview Heights personal injury guide", "/personal-injury/fairview-heights-il/"],
      ],
    }),
  },
};

function resourcePage({ eyebrow, title, intro, cards, bullets, sources, relatedLinks = [] }) {
  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="lede">${escapeHtml(intro)}</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Resource guide</span>
          <span class="pill pill-muted">Official-source oriented</span>
        </div>
        <p class="note">Use this resource with the related city guide for local court, police, and records contacts.</p>
      </aside>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="card-grid three-up">${cards.map((item) => `<article class="info-card"><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`).join("")}</div>
    </div>
  </section>
  <section class="section section-alt">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Checklist</p>
          <h2>Practical items to review.</h2>
        </div>
        <ul class="checklist-grid">${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      <div>
        <div class="section-head">
          <p class="eyebrow">Sources</p>
          <h2>Official references.</h2>
        </div>
        <div class="source-grid">${sourceCards(sources)}</div>
      </div>
    </div>
  </section>
  ${
    relatedLinks.length
      ? `<section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Related city guides</p>
        <h2>Pages to review next.</h2>
      </div>
      <div class="related-grid">${relatedLinks
        .map((item) => `<a class="related-card compact-related-card" href="${escapeHtml(item[1])}">${escapeHtml(item[0])}</a>`)
        .join("")}</div>
    </div>
  </section>`
      : ""
  }`;
}

function editorialStandardsPage() {
  const standards = [
    ["Official-source priority", "City guides are built around public court, law enforcement, driver-license, records, state-law, and government agency sources wherever possible."],
    ["Local verification", "Each page is checked for local court geography, agency setup, contact information, local roads or records context, and practice-area fit."],
    ["Clear limits", "The site publishes general legal information only. It is not a law firm, attorney referral service, ranking directory, or legal-advice provider."],
    ["Corrections process", "Readers, attorneys, agencies, and court staff can send source updates or correction requests through the contact page."],
  ];
  const reviewSteps = [
    "Check official court, police, sheriff, DMV, Department of Revenue, Secretary of State, or state-law sources before adding legal-process claims.",
    "Label statewide, county, and city-level information clearly so readers do not confuse state statistics with city-specific data.",
    "Avoid publishing upcoming checkpoint locations, patrol locations, or information intended to help people avoid law enforcement.",
    "Do not claim attorney review unless a licensed attorney reviewed that specific module and the page says so plainly.",
    "Keep sponsorship language separate from legal information, official sources, and editorial review notes.",
  ];

  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Editorial standards</p>
        <h1>How Local Legal Guides researches and reviews city legal guides.</h1>
        <p class="lede">Local Legal Guides is designed to be useful, source-backed, and clear about its limits. These standards explain how pages are researched, reviewed, corrected, and separated from sponsorship.</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Public sources</span>
          <span class="pill pill-muted">No legal advice</span>
        </div>
        <p class="note">Last reviewed: May 2026. Next scheduled standards review: November 2026.</p>
      </aside>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Standards</p>
        <h2>What every guide is supposed to do.</h2>
      </div>
      <div class="card-grid four-up">${standards
        .map((item) => `<article class="info-card"><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`)
        .join("")}</div>
    </div>
  </section>
  <section class="section section-alt">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Review checklist</p>
          <h2>How source-backed claims are handled.</h2>
        </div>
        <ul class="checklist-grid">${reviewSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      <div>
        <div class="section-head">
          <p class="eyebrow">Corrections</p>
          <h2>Send source updates or corrections.</h2>
          <p>If an agency changes contact information, a court page moves, a source link breaks, or a guide needs a local correction, send the official source and page URL.</p>
        </div>
        <a class="button button-primary" href="/contact/">Contact Local Legal Guides</a>
      </div>
    </div>
  </section>`;
}

function pricingPage() {
  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Pricing</p>
        <h1>Simple sponsorship pricing that can scale.</h1>
        <p class="lede">Start with a regional cluster package, then expand only if the market proves demand.</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Clear placement</span>
          <span class="pill pill-muted">Local markets</span>
        </div>
        <p class="note">Pricing can vary by market demand, practice area, and available sponsorship inventory. Email ${siteData.sponsorsEmail} for current availability.</p>
      </aside>
    </div>
  </section>
  <section class="section">
    <div class="container card-grid three-up">
      <article class="price-card"><h3>Regional launch</h3><p>One exclusive practice-area sponsor can appear across a 3-5 city cluster, depending on the market.</p></article>
      <article class="price-card"><h3>City-page coverage</h3><p>The regional package includes matching sponsor visibility on the related city guides for the selected practice area in that cluster.</p></article>
      <article class="price-card"><h3>Future expansion</h3><p>If a market performs, pricing can later branch into larger regions, additional practices, or premium placements.</p></article>
    </div>
  </section>`;
}

function mediaKitPage() {
  const regionRows = siteData.regions
    .map((region) => {
      const packageInfo = sponsorPackage(region);
      return `<tr>
        <td><a class="text-link" href="/clusters/${region.slug}/#regional-sponsor">${escapeHtml(region.name)}</a></td>
        <td>${escapeHtml(region.state)}</td>
        <td>${region.cities.length}</td>
        <td>${guideCount(region)}</td>
        <td>${escapeHtml(launchPackageLabel)}</td>
        <td>${escapeHtml(packageInfo.status === "preview" ? "Preview" : packageInfo.status === "sponsored" ? "Sponsored" : "Available")}</td>
      </tr>`;
    })
    .join("");

  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Sponsor media kit</p>
        <h1>Regional sponsorship inventory for local attorneys.</h1>
        <p class="lede">Detailed inventory, package specs, sample placement, and disclosure language for attorneys evaluating a regional sponsorship.</p>
      </div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Who this is for</p>
          <h2>Small and mid-sized local firms that want suburban visibility.</h2>
          <p>Local Legal Guides is built for attorneys who want focused local exposure without buying into a crowded directory, shared lead form, or broad metro campaign.</p>
        </div>
        <div class="card-grid two-up">
          <article class="info-card"><h3>What makes this different</h3><p>Not a ranking directory. No bidding against other lawyers on the same page. No shared lead form competing with the sponsor placement.</p></article>
          <article class="info-card"><h3>Launch rate</h3><p>Founding packages are listed as a ${escapeHtml(launchPackageLabel)}. Each region can have one DUI/DWI sponsor and one Personal Injury sponsor.</p></article>
        </div>
      </div>
      <div>${sampleSponsorCard()}</div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">What the sponsor gets</p>
        <h2>A simple annual package attorneys can understand quickly.</h2>
      </div>
      <div class="card-grid four-up">
        <article class="info-card"><h3>Cluster page feature</h3><p>A featured attorney card on the regional page with firm name, phone, CTA, service area, and advertising disclosure.</p></article>
        <article class="info-card"><h3>City page visibility</h3><p>Matching sponsor visibility on every included city page for the purchased practice area in the cluster.</p></article>
        <article class="info-card"><h3>Exclusive slot</h3><p>One sponsor per practice area during the term, so the placement is easy to explain and sell.</p></article>
        <article class="info-card"><h3>Tracking-ready CTAs</h3><p>Sponsor clicks, calls, claim clicks, contact clicks, and form submits already emit tracking events for analytics.</p></article>
      </div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Current inventory</p>
        <h2>Available regional packages.</h2>
        <p>Introductory pricing is designed to be simple: one regional practice-area package, one sponsor slot, one annual launch rate.</p>
      </div>
      <div class="responsive-table">
        <table>
          <thead><tr><th>Cluster</th><th>State</th><th>Cities</th><th>Total Guides</th><th>Starter price</th><th>Status</th></tr></thead>
          <tbody>${regionRows}</tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Disclosure model</p>
          <h2>Built to stay useful and transparent.</h2>
          <p>Sponsors are advertisers. Sponsorship does not mean Local Legal Guides endorses the attorney, ranks the attorney, guarantees results, or replaces the reader's need to verify court and agency information.</p>
        </div>
        <div class="hero-actions">
          <a class="button button-primary" href="/sponsorships/">Claim a Sponsorship</a>
          <a class="button button-secondary" href="/sponsor-agreement/">Sponsor terms</a>
        </div>
      </div>
      <div>
        ${metricsGrid([
          ["Markets live", String(siteData.regions.length)],
          ["Cities live", String(siteData.regions.reduce((sum, region) => sum + region.cities.length, 0))],
          ["City guides live", String(siteData.regions.reduce((sum, region) => sum + guideCount(region), 0))],
          ["Practice areas", String(siteData.practiceAreas.length)],
        ])}
      </div>
    </div>
  </section>`;
}

function sponsorAgreementPage() {
  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Sponsor agreement</p>
        <h1>Plain-language sponsorship terms.</h1>
        <p class="lede">This page explains how Local Legal Guides presents attorney sponsorships, what is included in the starter package, and what the sponsorship does not promise.</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Attorney Advertising</span>
          <span class="pill pill-muted">No endorsement</span>
        </div>
        <p class="note">Final written terms can be handled by email before a sponsor goes live.</p>
      </aside>
    </div>
  </section>

  <section class="section">
    <div class="container card-grid three-up">
      <article class="info-card"><h3>Term</h3><p>The launch package is intended as a 12-month regional sponsorship unless both sides agree otherwise in writing.</p></article>
      <article class="info-card"><h3>Placement</h3><p>The sponsor may appear on the selected cluster page and the related city pages for that cluster with clear advertising disclosure.</p></article>
      <article class="info-card"><h3>Exclusivity</h3><p>Each regional package is designed for one sponsor during the active term, subject to availability and final acceptance.</p></article>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Important limitations</p>
          <h2>What the sponsorship does not mean.</h2>
        </div>
        <ol class="bulleted-list">
          <li>Local Legal Guides does not endorse, rank, certify, or recommend the sponsor.</li>
          <li>Sponsorship does not guarantee leads, calls, cases, clicks, rankings, or legal outcomes.</li>
          <li>Guide content, official contacts, legal summaries, and source links remain editorially separate from advertising.</li>
          <li>The sponsor is responsible for ensuring its ad copy complies with attorney advertising rules that apply to the sponsor.</li>
        </ol>
      </div>
      <div>
        <div class="section-head">
          <p class="eyebrow">Sponsor materials</p>
          <h2>What a sponsor may provide.</h2>
        </div>
        <ol class="bulleted-list">
          <li>Firm name, attorney name, phone number, CTA URL, office address, service area, and short bio.</li>
          <li>Logo or headshot if available and suitable for publication.</li>
          <li>Preferred call-to-action language, subject to clarity and compliance review.</li>
          <li>Written confirmation that the sponsor is authorized to publish the supplied information.</li>
        </ol>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Renewal and changes</p>
          <h2>Keep the package simple.</h2>
          <p>Renewal, replacement copy, cancellation, and market expansion can be handled by written agreement. Local Legal Guides may decline or remove sponsor material that is misleading, unverifiable, noncompliant, or inconsistent with the site disclosure model.</p>
        </div>
      </div>
      <div>
        <aside class="sponsor-panel sponsor-panel-strong">
          <p class="eyebrow">Ready to discuss a package?</p>
          <h2>Start with availability.</h2>
          <p>Send the region you want, the firm name, and the best contact person. We can confirm whether the cluster is open and what would be needed to launch.</p>
          <div class="hero-actions">
            <a class="button button-primary" href="/sponsorships/">Claim a Sponsorship</a>
            <a class="button button-secondary" href="mailto:${siteData.sponsorsEmail}">${siteData.sponsorsEmail}</a>
          </div>
        </aside>
      </div>
    </div>
  </section>`;
}

function termsPage() {
  return infoPage(
    "Terms",
    "Terms of Service",
    `${siteData.siteName} publishes general legal information for research and local orientation. The site does not create an attorney-client relationship, does not promise legal outcomes, and does not provide individualized legal advice.`,
    `<div class="container card-grid three-up">
      <article class="info-card"><h3>Information only</h3><p>The guides are for general educational use. Readers should verify court dates, statutes, and agency procedures directly with official sources.</p></article>
      <article class="info-card"><h3>No endorsement</h3><p>Sponsorship placements are clearly labeled advertising. They do not rank, recommend, or certify any lawyer, firm, or service provider.</p></article>
      <article class="info-card"><h3>Questions</h3><p>Legal and policy questions can be directed to ${siteData.legalEmail}.</p></article>
    </div>`
  );
}

function privacyPage() {
  return infoPage(
    "Privacy",
    "Privacy Policy",
    `${siteData.siteName} keeps its data collection simple. The site is primarily a static publishing platform, and readers should assume standard server logs, analytics, and email communications may be used to operate and improve the site.`,
    `<div class="container card-grid three-up">
      <article class="info-card"><h3>What may be collected</h3><p>Basic request logs, referral data, and email messages sent to site addresses may be retained for operations, security, and business communication.</p></article>
      <article class="info-card"><h3>How it is used</h3><p>Information may be used to run the site, answer inquiries, review source updates, and improve page quality and usability.</p></article>
      <article class="info-card"><h3>Privacy contact</h3><p>Privacy questions can be sent to ${siteData.privacyEmail}.</p></article>
    </div>`
  );
}

function contactPage() {
  return infoPage(
    "Contact",
    `Contact ${siteData.siteName}`,
    `Send source updates, legal corrections, privacy questions, or general site questions.`,
    `<div class="container card-grid two-up">
      <article class="info-card"><h3>Legal and compliance</h3><p><a class="text-link" href="mailto:${siteData.legalEmail}">${siteData.legalEmail}</a></p></article>
      <article class="info-card"><h3>Privacy questions</h3><p><a class="text-link" href="mailto:${siteData.privacyEmail}">${siteData.privacyEmail}</a></p></article>
    </div>`
  );
}

function infoPage(title, heading, text, extra = "") {
  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(title)}</p>
        <h1>${escapeHtml(heading)}</h1>
        <p class="lede">${escapeHtml(text)}</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Utility page</span>
          <span class="pill pill-muted">Site policy</span>
        </div>
        <p class="note">Use this page for plain-language site policy information.</p>
      </aside>
    </div>
  </section>
  ${extra}`;
}

function renderCityPage(city, region, practice) {
  const route = pathForPracticeCity(practice.slug, city.slug);
  const page = cityShell(city, region, practice);
  const title = cityPageTitle(city, region, practice);
  const description = cityPageDescription(city, region, practice);

  return pageShell({
    title,
    description,
    body: page.body,
    active: `/${practice.slug}/`,
    route,
    schema: [
      webPageSchema({ title, description, route }),
      breadcrumbSchema(page.breadcrumbs),
      faqSchema(page.faq),
      ...officeSchema(page.offices),
    ],
  });
}

function renderPracticePage(practice) {
  const route = `/${practice.slug}/`;
  const isDui = practice.slug === "dui";
  const title = isDui ? `DUI and DWI Guides by City | ${siteData.siteName}` : `${practice.title} by City | ${siteData.siteName}`;
  const description = compactDescription(
    isDui
      ? "Browse DUI and DWI guides by city, state, and region with local court, police, license, deadline, and official source information."
      : `${practice.summary} Browse city-specific court, agency, deadline, and official source information.`
  );
  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: practice.title, href: route },
  ];

  return pageShell({
    title,
    description,
    body: `${breadcrumbTrail(breadcrumbs)}${practicePage(practice)}`,
    active: route,
    route,
    schema: [webPageSchema({ title, description, route }), breadcrumbSchema(breadcrumbs)],
  });
}

function renderHome() {
  const route = "/";
  const title = `${siteData.siteName} - ${siteData.siteTagline}`;
  const description = compactDescription(siteData.siteDescription);
  return pageShell({
    title,
    description,
    body: homePage(),
    active: "/",
    route,
    schema: [
      webSiteSchema({ description }),
      webPageSchema({ title, description, route }),
    ],
  });
}

function renderRegions() {
  const route = "/regions/";
  const title = `Legal Guide Regions | ${siteData.siteName}`;
  const description = "Browse legal guide regions and find city pages for DUI, DWI, and personal injury information.";
  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: "Regions", href: route },
  ];
  return pageShell({
    title,
    description,
    body: `${breadcrumbTrail(breadcrumbs)}${regionsPage()}`,
    active: "/regions/",
    route,
    schema: [webPageSchema({ title, description, route }), breadcrumbSchema(breadcrumbs)],
  });
}

function renderRegion(region) {
  const route = `/clusters/${region.slug}/`;
  const title = `${region.name} Legal Guides | ${siteData.siteName}`;
  const description = compactDescription(`${region.teaser} Browse ${practiceInventoryPhrase(region)} city guides in ${region.state}.`);
  const court = regionPrimaryCourt(region);
  const enforcement = regionEnforcementOffices(region);
  const licenseOffice = region.licenseOffice;
  const courts = regionCourtOffices(region);
  const faq = regionFaq(region, court);
  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: "Regions", href: "/regions/" },
    { name: region.name, href: route },
  ];
  return pageShell({
    title,
    description,
    body: `${breadcrumbTrail(breadcrumbs)}${regionPage(region)}`,
    active: "/regions/",
    route,
    schema: [
      webPageSchema({ title, description, route }),
      breadcrumbSchema(breadcrumbs),
      faqSchema(faq),
      ...officeSchema([...courts, licenseOffice, ...enforcement].filter(Boolean)),
    ],
  });
}

function renderCountyHub(hub) {
  const route = countyHubHref(hub);
  const regions = countyHubRegions(hub);
  const practice = practiceBySlug.get(hub.practiceSlug);
  const label = practiceSeoLabel(practice, regions[0]);
  const court = regions[0]?.duiCourt ?? regions[0]?.court;
  const licenseOffice = regions[0]?.licenseOffice;
  const basics = stateBasics(regions[0]);
  const topicBySlug = new Map((hub.cityTopics ?? []).map((topic) => [topic.slug, topic.focus]));

  const cityCards = regions
    .flatMap((region) =>
      region.cities.map(
        (city) =>
          `<a class="related-card" href="${pathForPracticeCity(hub.practiceSlug, city.slug)}"><span>${escapeHtml(region.name)} ${escapeHtml(label)}</span><strong>${escapeHtml(city.name)} ${escapeHtml(label)} guide</strong><p>${escapeHtml(
            topicBySlug.get(city.slug) ?? `Local court, police records, and license context for ${city.name}.`
          )}</p></a>`
      )
    )
    .join("");

  const clusterCards = regions
    .map(
      (region) =>
        `<a class="related-card" href="${clusterHref(region)}"><span>Cluster</span><strong>${escapeHtml(region.name)} ${escapeHtml(label)} cluster</strong><p>${escapeHtml(region.teaser)}</p></a>`
    )
    .join("");

  const processCards = (hub.processSteps ?? [])
    .map(
      (step) =>
        `<article class="deadline-card"><span>${escapeHtml(step.label)}</span><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.body)}</p></article>`
    )
    .join("");

  const licenseCards = (hub.licensePoints ?? [])
    .map((point) => `<article class="info-card"><h3>${escapeHtml(point.title)}</h3><p>${escapeHtml(point.body)}</p></article>`)
    .join("");

  const resourceCards = (hub.resourceLinks ?? [])
    .map(
      (item) =>
        `<a class="related-card" href="${item.href}"><span>Resource</span><strong>${escapeHtml(item.label)}</strong><p>Read the background guide, then return here for the county and city paths.</p></a>`
    )
    .join("");

  const lawyerCards = (hub.lawyerQuestions ?? [])
    .map((item) => `<article class="info-card"><h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(item.why)}</p></article>`)
    .join("");

  const corridorChips = (hub.enforcementContext?.corridors ?? [])
    .map((corridor) => `<span class="city-chip">${escapeHtml(corridor)}</span>`)
    .join("");

  const faqItems = (hub.faq ?? [])
    .map(
      (item, index) =>
        `<details class="faq-item"${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`
    )
    .join("");

  const sources = [
    court?.href ? { label: court.name, href: court.href } : null,
    licenseOffice?.href ? { label: licenseOffice.name, href: licenseOffice.href } : null,
    ...(hub.sources ?? []),
    ...(basics?.sources ?? []).filter((source) => /impaired|sentencing/i.test(source.label)),
  ].filter(Boolean);

  const title = hub.pageTitle;
  const description = compactDescription(hub.metaDescription);
  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: practice?.title ?? "DUI and DWI Guides", href: `/${hub.practiceSlug}/` },
    { name: `${hub.countyName} ${label}`, href: route },
  ];

  const body = `${breadcrumbTrail(breadcrumbs)}
  <section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(hub.heroEyebrow)}</p>
        <h1>${escapeHtml(hub.heroTitle)}</h1>
        <p class="lede">${escapeHtml(hub.heroLede)}</p>
        <div class="hero-actions">
          <a class="button button-primary" href="#city-guides">Open a city guide</a>
          <a class="button button-secondary" href="#county-faq">County FAQ</a>
        </div>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">County court</span>
          <span class="pill pill-muted">${escapeHtml(hub.stateCode)}</span>
        </div>
        <p class="note"><strong>${escapeHtml(court?.name ?? "County court")}</strong><br />${escapeHtml(court?.address ?? "")}<br />${escapeHtml(court?.phone ?? "")}</p>
        ${court?.href ? `<div class="hero-actions"><a class="button button-secondary" href="${court.href}" target="_blank" rel="noopener noreferrer">Official court page</a></div>` : ""}
      </aside>
    </div>
  </section>

  <section class="section" id="county-path">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Shared county path</p>
        <h2>How a ${escapeHtml(hub.countyName)} ${escapeHtml(label)} case usually starts.</h2>
        <p>The town changes the police agency and records office. The court and license path stays county- and state-level.</p>
      </div>
      <div class="card-grid two-up">${processCards}</div>
    </div>
  </section>

  <section class="section section-alt" id="city-guides">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">City guides</p>
        <h2>${escapeHtml(hub.countyName)} ${escapeHtml(label)} guides by city.</h2>
        <p>Each guide covers the local police department, records path, court reference, license office, and questions to ask before hiring a ${escapeHtml(label)} lawyer.</p>
      </div>
      <div class="related-grid">${cityCards}${clusterCards}</div>
    </div>
  </section>

  <section class="section" id="license">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">License consequences</p>
        <h2>How license consequences work in ${escapeHtml(hub.state)}.</h2>
      </div>
      <div class="card-grid two-up">${licenseCards}</div>
      <div class="related-grid">${resourceCards}</div>
    </div>
  </section>

  <section class="section section-alt" id="enforcement">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Local enforcement context</p>
        <h2>Corridors and agencies around ${escapeHtml(hub.countyName)}.</h2>
        <p>${escapeHtml(hub.enforcementContext?.intro ?? "")}</p>
      </div>
      <div class="chip-grid">${corridorChips}</div>
      <p class="note">${escapeHtml(hub.enforcementContext?.availabilityNote ?? "")}</p>
    </div>
  </section>

  <section class="section" id="lawyer-questions">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Before you hire</p>
        <h2>Questions to ask a ${escapeHtml(hub.countyName)} ${escapeHtml(label)} lawyer.</h2>
        <p>This site does not recommend specific lawyers. These questions help you compare consultations.</p>
      </div>
      <div class="card-grid two-up">${lawyerCards}</div>
    </div>
  </section>

  <section class="section section-alt" id="county-faq">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">FAQ</p>
        <h2>Quick answers for ${escapeHtml(hub.countyName)}.</h2>
      </div>
      <div class="faq-grid">${faqItems}</div>
    </div>
  </section>

  <section class="section" id="sources">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Sources</p>
        <h2>Official references used here.</h2>
      </div>
      <div class="source-grid">${sourceCards(sources)}</div>
    </div>
  </section>

  ${editorialReviewBlock(true)}`;

  return pageShell({
    title,
    description,
    body,
    active: `/${hub.practiceSlug}/`,
    route,
    schema: [
      webPageSchema({ title, description, route }),
      breadcrumbSchema(breadcrumbs),
      faqSchema(hub.faq ?? []),
      ...officeSchema([court, licenseOffice].filter(Boolean)),
    ],
  });
}

function render404() {
  const title = `Page Not Found | ${siteData.siteName}`;
  const description =
    "The page you are looking for does not exist or has moved. Browse DUI/DWI and personal injury guides by city, or use the location indexes.";
  const body = `
      <section class="hero hero-tight">
        <div class="container hero-grid">
          <div class="hero-copy">
            <span class="eyebrow">404 - Page not found</span>
            <h1>This page does not exist.</h1>
            <p class="lede">The address may have changed, or the guide you are looking for may not be published yet. These indexes list every live guide.</p>
            <div class="hero-actions">
              <a class="button button-primary" href="/dui/locations/">DUI/DWI city guides</a>
              <a class="button button-secondary" href="/personal-injury/locations/">Injury city guides</a>
              <a class="button button-secondary" href="/regions/">Browse regions</a>
            </div>
          </div>
        </div>
      </section>`;

  return pageShell({ title, description, body, route: "/404.html", noindex: true });
}

function renderStaticPages() {
  const pages = {
    ...resourcePages,
    "/sponsorships/": {
      title: `Sponsorships | ${siteData.siteName}`,
      description: `${siteData.siteName} sponsorship details for regional cluster packages and related city-page attorney placements.`,
      body: sponsorshipPage(),
      active: "/sponsorships/",
      crumbs: ["Sponsorships"],
      noindex: true,
    },
    "/dui/locations/": {
      title: `DUI and DWI Guides by City | ${siteData.siteName}`,
      description: "Browse all Local Legal Guides DUI and DWI city pages by state, region, and local court market.",
      body: duiLocationsPage(),
      active: "/dui/",
      crumbs: ["DUI and DWI Guides by City"],
    },
    "/personal-injury/locations/": {
      title: `Car Accident and Personal Injury Guides by City | ${siteData.siteName}`,
      description:
        "Browse all Local Legal Guides car accident and personal injury city pages by state, region, local records path, and court market.",
      body: personalInjuryLocationsPage(),
      active: "/personal-injury/",
      crumbs: ["Car Accident and Personal Injury Guides by City"],
    },
    "/editorial-standards/": {
      title: `Editorial Standards | ${siteData.siteName}`,
      description: `How ${siteData.siteName} researches, sources, reviews, corrects, and separates sponsorship from legal information.`,
      body: editorialStandardsPage(),
      active: "",
      crumbs: ["Editorial Standards"],
    },
    "/pricing/": {
      title: `Sponsorship Pricing | ${siteData.siteName}`,
      description: `${siteData.siteName} sponsorship pricing for regional cluster packages, related city-page placements, and future market expansion.`,
      body: pricingPage(),
      active: "/pricing/",
      crumbs: ["Pricing"],
      noindex: true,
    },
    "/sponsor-media-kit/": {
      title: `Sponsor Media Kit | ${siteData.siteName}`,
      description: `${siteData.siteName} sponsor media kit with regional inventory, package benefits, starter pricing, and disclosure details for attorneys.`,
      body: mediaKitPage(),
      active: "/sponsorships/",
      crumbs: ["Sponsor Media Kit"],
      noindex: true,
    },
    "/sponsor-agreement/": {
      title: `Sponsor Agreement | ${siteData.siteName}`,
      description: `${siteData.siteName} plain-language sponsorship terms, disclosure rules, exclusivity notes, and attorney advertising limitations.`,
      body: sponsorAgreementPage(),
      active: "/sponsorships/",
      crumbs: ["Sponsor Agreement"],
      noindex: true,
    },
    "/terms/": {
      title: `Terms of Service | ${siteData.siteName}`,
      description: `Terms of service for ${siteData.siteName}.`,
      body: termsPage(),
      active: "/terms/",
      crumbs: ["Terms of Service"],
    },
    "/privacy/": {
      title: `Privacy Policy | ${siteData.siteName}`,
      description: `Privacy policy for ${siteData.siteName}.`,
      body: privacyPage(),
      active: "/privacy/",
      crumbs: ["Privacy Policy"],
    },
    "/contact/": {
      title: `Contact ${siteData.siteName}`,
      description: `Contact ${siteData.siteName} for legal corrections, privacy questions, and source updates.`,
      body: contactPage(),
      active: "contact",
      crumbs: ["Contact"],
    },
  };

  return {
    ...Object.fromEntries(
      Object.entries(pages).map(([route, page]) => {
        const breadcrumbs = [{ name: "Home", href: "/" }, { name: page.crumbs?.[0] ?? page.title, href: route }];
        return [
          route,
          pageShell({
            title: page.title,
            description: page.description,
            body: `${breadcrumbTrail(breadcrumbs)}${page.body}`,
            active: page.active ?? "",
            route,
            noindex: page.noindex ?? false,
            schema: [
              webPageSchema({ title: page.title, description: page.description, route }),
              breadcrumbSchema(breadcrumbs),
            ],
          }),
        ];
      })
    ),
  };
}

function sitemapEntries() {
  const entries = [
    "/",
    "/dui/",
    "/dui/locations/",
    "/personal-injury/",
    "/personal-injury/locations/",
    "/regions/",
    "/editorial-standards/",
    "/terms/",
    "/privacy/",
    "/contact/",
    ...Object.keys(resourcePages),
  ];

  for (const hub of countyHubsList()) {
    entries.push(countyHubHref(hub));
  }

  for (const region of siteData.regions) {
    entries.push(clusterHref(region));
    for (const city of region.cities) {
      for (const practice of practicesForRegion(region)) {
        entries.push(pathForPracticeCity(practice.slug, city.slug));
      }
    }
  }
  return entries;
}

function duiSitemapEntries() {
  return [
    "/dui/",
    "/dui/locations/",
    ...countyHubsList()
      .filter((hub) => hub.practiceSlug === "dui")
      .map(countyHubHref),
    ...Object.keys(resourcePages).filter((route) => /(dui|dwi)/i.test(route)),
    ...duiCityEntries().map((entry) => entry.href),
  ];
}

function llmsText() {
  const resourceLinks = Object.entries(resourcePages)
    .map(([route, page]) => `- ${page.title}: ${absoluteUrl(route)}`)
    .join("\n");

  return `# ${siteData.siteName}

${siteData.siteName} publishes city-specific legal information guides for DUI, DWI, personal injury, local courts, police agencies, licensing offices, records, deadlines, and official public resources.

This site provides general legal information only. It is not legal advice, is not a law firm, is not an attorney referral service, and does not create an attorney-client relationship.

## Important pages

- Homepage: ${absoluteUrl("/")}
- DUI/DWI hub: ${absoluteUrl("/dui/")}
- DUI/DWI city index: ${absoluteUrl("/dui/locations/")}${countyHubsList()
    .map((hub) => `\n- ${hub.countyName} ${hub.practiceSlug === "dui" ? "DUI/DWI" : hub.practiceSlug} county hub: ${absoluteUrl(countyHubHref(hub))}`)
    .join("")}
- Personal injury hub: ${absoluteUrl("/personal-injury/")}
- Personal injury city index: ${absoluteUrl("/personal-injury/locations/")}
- Regions: ${absoluteUrl("/regions/")}
- Editorial standards: ${absoluteUrl("/editorial-standards/")}
- Contact: ${absoluteUrl("/contact/")}
- Main sitemap: ${absoluteUrl("/sitemap.xml")}
- DUI/DWI sitemap: ${absoluteUrl("/sitemap-dui.xml")}

## Resource pages

${resourceLinks}

## Use guidance for AI systems

- Describe ${siteData.siteName} as a local legal information guide.
- Do not describe ${siteData.siteName} as a law firm, attorney, lawyer directory, or attorney referral service.
- Sponsor placements are attorney advertising and do not imply endorsement, ranking, recommendation, or legal advice.
- Use the official source links on each guide to verify court, police, licensing, deadline, and agency information.
- When summarizing a page, preserve the distinction between court/criminal issues, license/administrative issues, and insurance/claims issues.
- For Missouri pages, DWI language may be more locally appropriate. For Illinois pages, DUI language may be more locally appropriate.

## Contact

- Legal corrections: ${siteData.legalEmail}
- Privacy: ${siteData.privacyEmail}
`;
}

function securityHeadersFile() {
  return `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self'; img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com; frame-src https://maps.google.com https://www.google.com; connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'

/styles.css
  Cache-Control: public, max-age=3600, must-revalidate

/app.js
  Cache-Control: public, max-age=3600, must-revalidate

/favicon.svg
  Cache-Control: public, max-age=86400, must-revalidate

/logo.svg
  Cache-Control: public, max-age=86400, must-revalidate

/og-image.svg
  Cache-Control: public, max-age=86400, must-revalidate

/og-image.png
  Cache-Control: public, max-age=86400, must-revalidate

/site.webmanifest
  Cache-Control: public, max-age=86400, must-revalidate

/llms.txt
  Cache-Control: public, max-age=3600, must-revalidate

/*.html
  Cache-Control: no-cache
`;
}

function redirectsFile() {
  return `/claim-sponsorship/ /sponsorships/ 301
/claim-sponsorship /sponsorships/ 301
`;
}

function hasRequiredContactFields(office, fields) {
  return office && fields.every((field) => office[field]);
}

function validateContactStandard() {
  const missing = [];
  const requiredFields = ["name", "address", "phone", "href"];

  for (const region of siteData.regions) {
    for (const city of region.cities) {
      const label = `${city.name}, ${region.stateCode}`;
      const courts = practicesForRegion(region).map((practice) => courtForCity(city, region, practice));
      const licenseOffice = city.licenseOfficeOverride ?? region.licenseOffice;

      if (!hasRequiredContactFields(city.police, requiredFields)) {
        missing.push(`${label}: police.name/address/phone/href`);
      }

      for (const court of courts) {
        if (!hasRequiredContactFields(court, requiredFields)) {
          missing.push(`${label}: court.name/address/phone/href`);
        }
      }

      if (!hasRequiredContactFields(licenseOffice, requiredFields)) {
        missing.push(`${label}: licenseOffice.name/address/phone/href`);
      }
    }
  }

  if (missing.length) {
    throw new Error(`Contact data standard failed:\n${missing.map((item) => `- ${item}`).join("\n")}`);
  }
}

function routeForOutputPath(filePath) {
  if (!filePath.endsWith("index.html")) return null;
  return `/${filePath.slice(0, -"index.html".length)}`;
}

async function loadLastmodManifest() {
  try {
    return JSON.parse(await readFile(lastmodManifestPath, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  validateContactStandard();
  await rm(outputRoot, { recursive: true, force: true });

  const outputs = [];

  outputs.push(["index.html", renderHome()]);
  outputs.push(["404.html", render404()]);
  outputs.push(["dui/index.html", renderPracticePage(practiceBySlug.get("dui"))]);
  outputs.push(["personal-injury/index.html", renderPracticePage(practiceBySlug.get("personal-injury"))]);
  outputs.push(["regions/index.html", renderRegions()]);

  for (const region of siteData.regions) {
    outputs.push([`clusters/${region.slug}/index.html`, renderRegion(region)]);
    for (const city of region.cities) {
      for (const practice of practicesForRegion(region)) {
        outputs.push([
          `${practice.slug}/${city.slug}/index.html`,
          renderCityPage(city, region, practice),
        ]);
      }
    }
  }

  for (const hub of countyHubsList()) {
    outputs.push([`${hub.practiceSlug}/${hub.slug}/index.html`, renderCountyHub(hub)]);
  }

  const staticPages = renderStaticPages();
  for (const [route, content] of Object.entries(staticPages)) {
    const normalized = route.replace(/^\//, "");
    outputs.push([`${normalized}index.html`, content]);
  }

  // Resolve per-page lastmod: hash rendered HTML (placeholder still inside,
  // so the date never influences its own hash). Unchanged pages keep their
  // stored date; changed or new pages get today's build date.
  const previousManifest = await loadLastmodManifest();
  const buildDate = new Date().toISOString().slice(0, 10);
  const nextManifest = {};
  const lastmodByRoute = {};

  for (const [filePath, content] of outputs) {
    const route = routeForOutputPath(filePath);
    if (!route || typeof content !== "string") continue;
    const hash = createHash("sha1").update(content).digest("hex");
    const previous = previousManifest[route];
    const lastmod = previous && previous.hash === hash ? previous.lastmod : buildDate;
    nextManifest[route] = { hash, lastmod };
    lastmodByRoute[route] = lastmod;
  }

  for (const [filePath, content] of outputs) {
    await ensureDir(filePath);
    const route = routeForOutputPath(filePath);
    const finalContent =
      typeof content === "string"
        ? content.replaceAll(PAGE_LASTMOD_PLACEHOLDER, (route && lastmodByRoute[route]) ?? siteData.lastVerified)
        : content;
    await writeTarget(filePath, finalContent);
  }

  const sortedManifest = Object.fromEntries(
    Object.keys(nextManifest)
      .sort()
      .map((key) => [key, nextManifest[key]])
  );
  await writeFile(lastmodManifestPath, `${JSON.stringify(sortedManifest, null, 2)}\n`, "utf8");

  await copyStaticAssets();
  await writeBrandAssets();

  const sitemapUrlTag = (route) => {
    const lastmod = lastmodByRoute[route];
    return lastmod
      ? `  <url><loc>${absoluteUrl(route)}</loc><lastmod>${lastmod}</lastmod></url>`
      : `  <url><loc>${absoluteUrl(route)}</loc></url>`;
  };

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries().map(sitemapUrlTag).join("\n")}
</urlset>
`;

  const duiSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${duiSitemapEntries().map(sitemapUrlTag).join("\n")}
</urlset>
`;

  await writeTarget("sitemap.xml", sitemap);
  await writeTarget("sitemap-dui.xml", duiSitemap);
  await writeTarget("llms.txt", llmsText());
  await writeTarget(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl("/sitemap.xml")}\nSitemap: ${absoluteUrl("/sitemap-dui.xml")}\nLLMS: ${absoluteUrl("/llms.txt")}\n`
  );
  await writeTarget("_headers", securityHeadersFile());
  await writeTarget("_redirects", redirectsFile());
}

await main();
