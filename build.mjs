import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { siteData } from "./site-data.mjs";

const root = process.cwd();
const outputRoot = path.join(root, "dist");
const practiceBySlug = new Map(siteData.practiceAreas.map((p) => [p.slug, p]));
const googleAnalyticsId = "G-VLQC2KYC9E";
const brandIconPath = "/favicon.svg";
const brandLogoPath = "/logo.svg";
const brandSocialImagePath = "/og-image.svg";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dui/", label: "DUI" },
  { href: "/personal-injury/", label: "Personal Injury" },
  { href: "/regions/", label: "Regions" },
  { href: "/sponsorships/", label: "For Attorneys" },
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

function sponsorPackage(region) {
  const configured = siteData.sponsorPackages?.[region.slug] ?? {};
  const sponsor = configured.sponsor ?? {};
  return {
    status: configured.status ?? "available",
    annualPriceUsd: configured.annualPriceUsd ?? 1000,
    termLabel: configured.termLabel ?? "12-month exclusive package",
    coverageLabel:
      configured.coverageLabel ??
      `${region.cities.length} city pages for one selected practice area`,
    sponsor,
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function guideCount(region) {
  return region.cities.length * siteData.practiceAreas.length;
}

function cityGuideCountForPractice(region) {
  return region.cities.length;
}

function articleFor(word) {
  return /^[aeiou]/i.test(String(word ?? "").trim()) ? "an" : "a";
}

function sampleSponsorCard() {
  return `<aside class="sample-sponsor-card" aria-label="Sample sponsor placement">
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
  if (!["sponsored", "preview"].includes(packageInfo.status)) {
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
      <li>Starter pricing: ${escapeHtml(formatCurrency(packageInfo.annualPriceUsd))} per year per practice area.</li>
      <li>${escapeHtml(packageInfo.coverageLabel)}</li>
      <li>DUI/DWI and Personal Injury are separate sponsor inventory slots.</li>
    </ul>
    <p class="sponsor-note">Attorney Advertising. Any future sponsor placement will remain separate from official legal and government resource information.</p>
    <div class="hero-actions">
      <a class="button button-primary" href="/sponsorships/" ${trackingAttrs(`${eventBase}_claim_click`, {
        region: region.slug,
        placement,
        status: packageInfo.status,
      })}>Claim this package</a>
      <a class="button button-secondary" href="/contact/" ${trackingAttrs(`${eventBase}_contact_click`, {
        region: region.slug,
        placement,
        status: packageInfo.status,
      })}>Ask about availability</a>
    </div>
  </aside>`;
}

function citySponsorNotice(region, packageInfo, practice) {
  const sponsor = activeSponsor(packageInfo);
  const isDui = practice?.slug === "dui";
  const practiceLabel = isDui ? practiceSeoLabel(practice, region) : practice?.label ?? "selected practice area";
  const includedCities = region.cities.map((city) => city.name).join(", ");

  if (sponsor) {
    return `<aside class="sponsor-panel sponsor-panel-strong">
      <p class="eyebrow">Featured ${escapeHtml(practiceLabel)} Sponsor</p>
      ${sponsorIdentityBlock(sponsor)}
      <p>${escapeHtml(sponsor.serviceArea || `${practiceLabel} help for ${region.name} cases.`)}</p>
      <div class="hero-actions">
        <a class="button button-primary" href="${escapeHtml(sponsor.ctaUrl)}" ${trackingAttrs("city_sponsor_cta_click", {
          region: region.slug,
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

  return `<aside class="sponsor-panel sponsor-panel-strong">
    <p class="eyebrow">Attorney Advertising Position Available</p>
    <h2>Featured ${escapeHtml(practiceLabel)} Sponsor for ${escapeHtml(region.name)}.</h2>
    <p>This attorney advertising position is currently available for one ${escapeHtml(
      isDui ? `${practiceLabel} defense attorney or law firm` : "personal injury attorney or law firm"
    )} serving ${escapeHtml(includedCities)}.</p>
    <ul class="sponsor-list">
      <li>${escapeHtml(region.cities.length)} city ${escapeHtml(practiceLabel)} guides plus regional placement.</li>
      <li>Phone/link CTA placement on related city guides for this practice area.</li>
      <li>${escapeHtml(packageInfo.termLabel)} with no competing sponsor in the same practice-area slot.</li>
      <li>Launch price: ${escapeHtml(formatCurrency(packageInfo.annualPriceUsd))}/year per practice area.</li>
    </ul>
    <div class="hero-actions">
      <a class="button button-primary" href="${sponsorPackageHref(region)}">Claim This ${escapeHtml(practiceLabel)} Sponsorship</a>
      <a class="button button-secondary" href="/sponsorships/">Ask about sponsorship</a>
    </div>
    <p class="sponsor-note">Attorney Advertising. Sponsorship does not imply endorsement or legal recommendation. Official court, police, records, and public-agency references remain separate.</p>
  </aside>`;
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
          <button class="button button-primary" type="submit">Open sponsorship email</button>
          <p class="form-note">This opens a prefilled email draft to ${escapeHtml(siteData.sponsorsEmail)} so the inquiry works on a static site without a backend.</p>
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

function duiPractice() {
  return practiceBySlug.get("dui");
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

function duiCityLink(entry, className = "city-link") {
  return `<a class="${className}" href="${entry.href}">${escapeHtml(entry.city.name)}, ${escapeHtml(
    entry.region.stateCode
  )} ${escapeHtml(entry.label)} guide</a>`;
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
                <h3>${escapeHtml(region.name)}</h3>
              </div>
              <div class="city-link-grid">${regionEntries.map((entry) => duiCityLink(entry)).join("")}</div>
            </article>`
          )
          .join("")}</div>
      </section>`;
    })
    .join("");
}

function recentDuiGuideLinks(limit = 18) {
  return duiCityEntries()
    .slice(0, limit)
    .map((entry) => duiCityLink(entry, "related-card compact-related-card"))
    .join("");
}

function cityPageTitle(city, region, practice) {
  if (practice.slug === "dui") {
    const label = practiceSeoLabel(practice, region);
    return `Arrested for ${label} in ${city.name}, ${region.stateCode}? What to Do Next | ${siteData.siteName}`;
  }

  return `Injured in ${city.name}, ${region.stateCode}? What to Do Before Talking to Insurance | ${siteData.siteName}`;
}

function cityPageDescription(city, region, practice) {
  const court = courtForCity(city, region, practice);
  if (practice.slug === "dui") {
    const label = practiceSeoLabel(practice, region);
    return compactDescription(
      `Arrested for ${label} in ${city.name}? Learn what to do next, court and license deadlines, local police records, questions to ask a ${label} attorney, and official sources.`
    );
  }

  return compactDescription(
    `Injured in ${city.name}? Learn what to do before dealing with insurance, how to document a claim, where reports may come from, deadlines, and official sources.`
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
        <p class="eyebrow">${escapeHtml(isDui ? "When to call a DUI lawyer" : "When to call an injury lawyer")}</p>
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
        <dl class="review-meta">
          <dt>Last reviewed</dt><dd>May 2026</dd>
          <dt>Next scheduled review</dt><dd>November 2026</dd>
        </dl>
      </div>
    </div>
  </section>`;
}

function relatedResourceLinks(region, isDui) {
  if (region.stateCode !== "IL") {
    return "";
  }

  const resources = isDui
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

function citySponsorAvailabilityBox(region, packageInfo, practice) {
  const isDui = practice?.slug === "dui";
  const practiceLabel = isDui ? practiceSeoLabel(practice, region) : practice?.label ?? "practice area";
  const includedCities = region.cities.map((city) => city.name).join(", ");
  return `<section class="sponsor-availability-band" aria-label="Sponsor availability">
    <div class="container sponsor-availability-inner">
      <div>
        <p class="eyebrow">Featured ${escapeHtml(practiceLabel)} Sponsor ${packageInfo.status === "sponsored" ? "" : "Available"}</p>
        <h2>${escapeHtml(packageInfo.status === "sponsored" ? `${region.name} ${practiceLabel} sponsor.` : `Featured ${practiceLabel} Sponsor for ${region.name}.`)}</h2>
        <p>${escapeHtml(
          packageInfo.status === "sponsored"
            ? `This clearly labeled attorney advertising placement appears near urgent ${practiceLabel} next-step guidance and remains separate from official source information.`
            : `Available to one ${isDui ? `${practiceLabel} defense attorney or law firm` : "personal injury attorney or law firm"} serving ${includedCities}. Includes ${region.cities.length} city guides, regional placement, phone/link CTA, and ${packageInfo.termLabel.toLowerCase()}. Launch price: ${formatCurrency(packageInfo.annualPriceUsd)}/year.`
        )}</p>
      </div>
      <a class="button button-primary" href="${sponsorPackageHref(region)}" ${trackingAttrs("claim_package_click", {
        region: region.slug,
        placement: "city_top",
        status: packageInfo.status,
      })}>${escapeHtml(packageInfo.status === "sponsored" ? "View sponsor package" : `Claim This ${practiceLabel} Sponsorship`)}</a>
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
        title: "Appear in Madison County court",
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

function webPageSchema({ title, description, route, modifiedDate = siteData.lastVerified }) {
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

function localDuiDataSection(city) {
  const data = duiLocalDataFor(city);
  if (!data) return "";

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
        <p class="eyebrow">Hyper-local DUI context</p>
        <h2>Local DUI enforcement and roadway context for ${escapeHtml(city.name)}.</h2>
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

function cityToc(isDui, region, hasLocalDuiData = false) {
  const lawyerLabel = isDui ? `${region.stateCode === "IL" ? "DUI" : "DWI"} lawyer` : "injury lawyer";
  const items = [
    ["Start here", "#start-here"],
    ["What happens next", "#what-happens-next"],
    [`When to call ${isDui ? "a" : "an"} ${lawyerLabel}`, "#when-to-call-lawyer"],
    ["Local directory", "#directory"],
    ["Map", "#map"],
    ["Local details", "#local"],
    ...(isDui && hasLocalDuiData ? [["Local DUI data", "#dui-local-data"]] : []),
    ...(isDui ? [] : [["Insurance warning", "#insurance-warning"]]),
    ["Key deadlines", "#deadlines"],
    ["Documents", "#documents"],
    [isDui ? "DUI law" : "Injury law", "#state-law"],
    ["Case process", "#process"],
    [isDui ? "Penalties" : "Claim value", "#penalties"],
    [isDui ? "Implied consent" : "Fault and proof", "#implied-consent"],
    [isDui ? "License restoration" : "Insurance and settlement", "#restoration"],
    ...(isDui ? [] : [["Reports", "#accident-report"]]),
    [isDui ? `${region.stateCode === "IL" ? "DUI" : "DWI"} attorney` : "Injury attorney", "#attorney-question"],
    ["Questions to ask", "#questions-to-ask"],
    ...(region?.stateCode === "IL" ? [["Resources", "#related-resources"]] : []),
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

async function writeBrandAssets() {
  await writeTarget("favicon.svg", brandFaviconSvg());
  await writeTarget("logo.svg", brandLogoSvg());
  await writeTarget("og-image.svg", brandSocialImageSvg());
  await writeTarget("site.webmanifest", siteWebManifest());
}

function pageShell({ title, description, body, active = "", route = "/", schema = [], lastVerified = siteData.lastVerified }) {
  const nav = navLinks
    .map((item) => {
      const isActive =
        active === item.href ||
        (active === "dui" && item.href === "/dui/") ||
        (active === "personal-injury" && item.href === "/personal-injury/") ||
        (active === "regions" && item.href === "/regions/") ||
        (active === "/sponsorships/" && item.href === "/sponsorships/") ||
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
    <meta property="og:image:type" content="image/svg+xml" />
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
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${googleAnalyticsId}');
    </script>
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
        <p><a href="/dui/locations/">DUI/DWI city guides</a> | <a href="/contact/">Contact</a> | <a href="/terms/">Terms</a> | <a href="/privacy/">Privacy</a></p>
        <p>&copy; ${siteData.year} ${siteData.siteName} | ${siteData.domain}</p>
      </div>
    </footer>
  </body>
</html>`;
}

function regionSummary(region) {
  const cityCount = region.cities.length;
  const guideCount = cityCount * siteData.practiceAreas.length;
  return `<article class="region-card">
    <p class="eyebrow">${escapeHtml(region.state)}</p>
    <h3>${escapeHtml(region.name)}</h3>
    <p>${escapeHtml(region.teaser)}</p>
    <div class="region-meta">${cityCount} cities | ${guideCount} guides</div>
    <div class="region-city-list">
      ${region.cities
        .slice(0, 5)
        .map((city) => `<a class="region-city-pill" href="${pathForPracticeCity("dui", city.slug)}">${escapeHtml(city.name)}</a>`)
        .join("")}
    </div>
    <a class="text-link" href="/clusters/${region.slug}/" aria-label="View ${escapeHtml(region.name)} region">View region</a>
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
  const caseName = isDui ? basics.duiName : "personal injury";
  const quickActions = quickActionCards({ city, region, court, licenseOffice, isDui, basics });
  const title = heroTitleForCity(city, region, isDui, basics);
  const intro = heroIntroForCity(city, region, isDui, basics);
  const sponsor = activeSponsor(packageInfo);
  const practiceSponsorLabel = isDui ? practiceSeoLabel(practice, region) : practice.label;
  const heroSponsorCta = sponsor ? `Contact Featured ${practiceSponsorLabel} Sponsor` : `${practiceSponsorLabel} Sponsor Available`;
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
      ]
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
      ];
  const allSources = [
    ...sourcesForPractice(basics, isDui),
    { label: court.name, href: court.href },
    city.police ? { label: city.police.name, href: city.police.href } : null,
    isDui && licenseOffice ? { label: licenseOffice.name, href: licenseOffice.href } : null,
  ].filter(Boolean);
  const breadcrumbs = [
    { name: "Home", href: "/" },
    { name: practice.title, href: `/${practice.slug}/` },
    { name: region.name, href: `/clusters/${region.slug}/` },
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
          <a class="button button-primary" href="${sponsor ? escapeHtml(sponsor.ctaUrl) : sponsorPackageHref(region)}">${escapeHtml(heroSponsorCta)}</a>
          <a class="button button-secondary" href="#start-here">See What to Do Next</a>
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

  ${citySponsorAvailabilityBox(region, packageInfo, practice)}

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

  ${cityToc(isDui, region, Boolean(localDuiData))}

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
        <div class="map-placeholder" data-map-src="${escapeHtml(mapEmbedHref(mapQuery))}" data-map-title="${escapeHtml(`${city.name} local legal office map`)}">
          <p>Map embed is held until requested so the page loads faster.</p>
          <div class="hero-actions">
            <button class="button button-secondary" type="button" data-load-map="true">Load office map</button>
            <a class="text-link" href="${escapeHtml(mapsHref(mapQuery))}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
          </div>
        </div>
      </div>
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

  ${isDui ? localDuiDataSection(city) : ""}

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

  ${questionsToAskAttorneySection({ city, region, isDui, basics })}

  <section class="section section-attorney-cta">
    <div class="container">
      ${citySponsorNotice(region, packageInfo, practice)}
    </div>
  </section>

  ${relatedResourceLinks(region, isDui)}

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
        }${siteData.practiceAreas
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
        .map((nearby) => `<a class="city-chip" href="${pathForPracticeCity(practice.slug, nearby.slug)}">${escapeHtml(nearby.name)}</a>`)
        .join("")}
        <a class="practice-chip" href="/clusters/${region.slug}/">View all in ${escapeHtml(region.name)}</a>
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
          <h3>${escapeHtml(region.name)}</h3>
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
            : ""
        }
      </aside>
    </div>
  </section>
  ${practiceHubContent(practice)}
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
      : ""
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
          <a class="button button-primary" href="/regions/">Browse regions</a>
          <a class="button button-secondary" href="/sponsorships/">For Attorneys</a>
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

  <section class="section section-attorney-cta">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">For attorneys</p>
          <h2>Attorneys: regional sponsorships are open.</h2>
          <p>Local Legal Guides offers one clearly labeled attorney sponsor slot per practice area in each regional market. DUI/DWI and Personal Injury are sold separately.</p>
        </div>
        <div class="hero-actions">
          <a class="button button-primary" href="/sponsorships/">View Available Sponsorships</a>
          <a class="button button-secondary" href="/sponsor-media-kit/">See Media Kit</a>
        </div>
      </div>
      <div>
        ${metricsGrid([
          ["Markets", String(siteData.regions.length)],
          ["Cities", String(cityCount)],
          ["City guides", String(siteData.regions.reduce((sum, region) => sum + guideCount(region), 0))],
          ["Starter packages", "$1,000/year"],
        ], "metric-grid metric-grid-compact")}
      </div>
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

function regionPage(region) {
  const packageInfo = sponsorPackage(region);
  const court = regionPrimaryCourt(region);
  const enforcement = regionEnforcementOffices(region);
  const licenseOffice = region.licenseOffice;
  const faq = regionFaq(region, court);
  const sources = regionSourceList(region, court, licenseOffice, enforcement);
  const cityLinks = region.cities
    .map(
      (city) => `<a class="city-chip" href="/dui/${city.slug}/">${escapeHtml(city.name)}</a>`
    )
    .join("");

  const practiceLinks = siteData.practiceAreas
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
    ["Flat annual package", `${packageInfo.termLabel} at ${formatCurrency(packageInfo.annualPriceUsd)} per year to start, per practice area.`],
  ]
    .map((item) => `<article class="info-card"><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`)
    .join("");

  const sponsorInventoryRows = siteData.practiceAreas
    .map(
      (practice) => `<tr>
        <td>${escapeHtml(practice.label)}</td>
        <td>${escapeHtml(packageInfo.status === "sponsored" ? "Sponsored" : "Available")}</td>
        <td>${escapeHtml(formatCurrency(packageInfo.annualPriceUsd))}/year for ${region.cities.length} ${escapeHtml(practice.label)} city pages</td>
        <td>${escapeHtml(packageInfo.termLabel)}</td>
        <td><a class="text-link" href="/sponsorships/" ${trackingAttrs("claim_package_click", {
          region: region.slug,
          practice: practice.slug,
          placement: "cluster_inventory",
          status: packageInfo.status,
        })}>Reserve ${escapeHtml(practice.label)}</a></td>
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
          <span class="pill pill-muted">${region.cities.length * siteData.practiceAreas.length} guides</span>
        </div>
        <p class="note">This market has separate sponsorship inventory for each practice area and future pages.</p>
      </aside>
    </div>
  </section>

  <section class="section">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">City coverage</p>
          <h2>${escapeHtml(region.name)} city coverage.</h2>
          <p>Each sponsor package covers the selected practice area across the city guides in this region.</p>
        </div>
        <div class="chip-grid">${cityLinks}</div>
      </div>
      <div>
        <div class="section-head">
          <p class="eyebrow">Practice areas</p>
          <h2>DUI/DWI and Personal Injury are sold separately.</h2>
        </div>
        <div class="chip-grid">${practiceLinks}</div>
      </div>
    </div>
  </section>

  <section class="section section-alt" id="regional-sponsor">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Practice-area inventory</p>
          <h2>Reserve one practice area in ${escapeHtml(region.name)}.</h2>
          <p>DUI/DWI and Personal Injury are separate annual sponsorship slots. Buying one practice area does not include the other unless a separate package is reserved.</p>
        </div>
        <div class="responsive-table"><table>
          <thead><tr><th>Practice Area</th><th>Status</th><th>Founding Price</th><th>Term</th><th>CTA</th></tr></thead>
          <tbody>${sponsorInventoryRows}</tbody>
        </table></div>
        <div class="section-head section-head-compact">
          <p class="eyebrow">What the sponsor gets</p>
          <h2>A focused regional placement.</h2>
        </div>
        <div class="card-grid two-up">${sponsorPackageDetails}</div>
      </div>
      <div>
        ${sponsorProfileCard(region, packageInfo, "cluster")}
        <div class="sponsor-disclosure">
          <strong>Included city coverage</strong>
          <ul class="sponsor-coverage-list">${sponsorCoverage}</ul>
        </div>
      </div>
    </div>
  </section>

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
      <div class="sponsor-disclosure sponsor-disclosure-inline">
        <strong>Why lawyers sponsor this territory</strong>
        <ul class="sponsor-coverage-list">${sponsorReasons}</ul>
      </div>
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
        <p class="lede">Local Legal Guides offers one clearly labeled sponsor slot per practice area per region. DUI/DWI and Personal Injury are sold separately, with launch packages starting at $1,000/year.</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">${siteData.regions.length} markets</span>
          <span class="pill pill-muted">${cityCount} cities</span>
        </div>
        <p class="note">${guideCountTotal} city guides are live across DUI/DWI and Personal Injury. Questions about availability or placement? Email ${siteData.sponsorsEmail}.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/sponsor-media-kit/">See available markets</a>
          <a class="button button-secondary" href="#sponsor-inquiry">Ask about a package</a>
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
        <article class="info-card"><h3>Flat annual pricing</h3><p>Launch packages start at $1,000/year. This is an annual visibility sponsorship, not pay-per-lead.</p></article>
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
        <article class="info-card"><h3>Tracking ready</h3><p>Optional tracking URL or UTM link, plus existing click events for sponsor CTAs, calls, package claims, and inquiry actions.</p></article>
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
          <h2>Talk to the sponsorship team.</h2>
          <p>Use ${siteData.sponsorsEmail} for inventory, pricing, and launch timing.</p>
        </div>
        <div class="hero-actions">
          <a class="button button-primary" href="/sponsor-media-kit/">View media kit</a>
          <a class="button button-secondary" href="/sponsor-agreement/">Sponsor terms</a>
        </div>
      </div>
      <div>${sampleSponsorCard()}</div>
    </div>
  </section>

  ${sponsorInquiryForm({
    title: "Request a regional package",
    intro: "Send a prefilled sponsorship inquiry for the cluster you want to reserve.",
  })}`;
}

const resourcePages = {
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
        { label: "Illinois Compiled Statutes", href: "https://www.ilga.gov/legislation/ilcs/ilcs.asp" },
        { label: "Illinois Courts", href: "https://www.illinoiscourts.gov/" },
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
    }),
  },
};

function resourcePage({ eyebrow, title, intro, cards, bullets, sources }) {
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
      <article class="price-card"><h3>Regional launch</h3><p>Start at $1,000 per year for one exclusive practice-area sponsor across a 3-5 city cluster.</p></article>
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
        <td>${escapeHtml(formatCurrency(packageInfo.annualPriceUsd))}/year per practice area</td>
        <td>${escapeHtml(packageInfo.status === "preview" ? "Preview" : packageInfo.status === "sponsored" ? "Sponsored" : "Available")}</td>
      </tr>`;
    })
    .join("");

  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Sponsor media kit</p>
        <h1>Regional sponsorship inventory for local attorneys.</h1>
        <p class="lede">Each package gives one attorney or firm a clearly labeled sponsor position across a local cluster page and the related city guides for one selected practice area. The guide content remains neutral, source-backed, and useful without a sponsor.</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Launch offer</span>
          <span class="pill pill-muted">$1,000/year per practice area</span>
        </div>
        <p class="note">Use this page when discussing available regional inventory with attorneys.</p>
      </aside>
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
          <article class="info-card"><h3>Launch pricing</h3><p>Starter packages are $1,000/year per practice area per region. Each region can have one DUI/DWI sponsor and one Personal Injury sponsor.</p></article>
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
        <p>Introductory pricing is designed to test demand before expanding into more markets or raising package prices.</p>
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
          <a class="button button-primary" href="/sponsorships/">Claim sponsorship</a>
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
            <a class="button button-primary" href="/sponsorships/">Claim sponsorship</a>
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
      <article class="info-card"><h3>How it is used</h3><p>Information may be used to run the site, answer inquiries, review sponsorship interest, and improve page quality and usability.</p></article>
      <article class="info-card"><h3>Privacy contact</h3><p>Privacy questions can be sent to ${siteData.privacyEmail}.</p></article>
    </div>`
  );
}

function contactPage() {
  return infoPage(
    "Contact",
    `Contact ${siteData.siteName}`,
    `Ask about a $1,000 founding territory sponsorship, source updates, legal corrections, or privacy questions.`,
    `<div class="container card-grid three-up">
      <article class="info-card"><h3>Legal and compliance</h3><p><a class="text-link" href="mailto:${siteData.legalEmail}">${siteData.legalEmail}</a></p></article>
      <article class="info-card"><h3>Privacy questions</h3><p><a class="text-link" href="mailto:${siteData.privacyEmail}">${siteData.privacyEmail}</a></p></article>
      <article class="info-card"><h3>Sponsorship inquiries</h3><p><a class="text-link" href="mailto:${siteData.sponsorsEmail}">${siteData.sponsorsEmail}</a></p></article>
    </div>${sponsorInquiryForm({
      title: "Ask about a $1,000 founding territory sponsorship.",
      intro: "Use the form to open a prefilled email draft with the cluster, contact details, and notes already organized.",
    })}`
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
  const description = compactDescription(`${region.teaser} Browse DUI, DWI, and personal injury city guides in ${region.state}.`);
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

function renderStaticPages() {
  const pages = {
    ...resourcePages,
    "/sponsorships/": {
      title: `Sponsorships | ${siteData.siteName}`,
      description: `${siteData.siteName} sponsorship details for regional cluster packages and related city-page attorney placements.`,
      body: sponsorshipPage(),
      active: "/sponsorships/",
      crumbs: ["Sponsorships"],
    },
    "/dui/locations/": {
      title: `DUI and DWI Guides by City | ${siteData.siteName}`,
      description: "Browse all Local Legal Guides DUI and DWI city pages by state, region, and local court market.",
      body: duiLocationsPage(),
      active: "/dui/",
      crumbs: ["DUI and DWI Guides by City"],
    },
    "/pricing/": {
      title: `Sponsorship Pricing | ${siteData.siteName}`,
      description: `${siteData.siteName} sponsorship pricing for regional cluster packages, related city-page placements, and future market expansion.`,
      body: pricingPage(),
      active: "/pricing/",
      crumbs: ["Pricing"],
    },
    "/sponsor-media-kit/": {
      title: `Sponsor Media Kit | ${siteData.siteName}`,
      description: `${siteData.siteName} sponsor media kit with regional inventory, package benefits, starter pricing, and disclosure details for attorneys.`,
      body: mediaKitPage(),
      active: "/sponsorships/",
      crumbs: ["Sponsor Media Kit"],
    },
    "/sponsor-agreement/": {
      title: `Sponsor Agreement | ${siteData.siteName}`,
      description: `${siteData.siteName} plain-language sponsorship terms, disclosure rules, exclusivity notes, and attorney advertising limitations.`,
      body: sponsorAgreementPage(),
      active: "/sponsorships/",
      crumbs: ["Sponsor Agreement"],
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
      description: `Contact ${siteData.siteName} for legal, privacy, and sponsorship questions.`,
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
    "/regions/",
    "/sponsorships/",
    "/pricing/",
    "/sponsor-media-kit/",
    "/sponsor-agreement/",
    "/terms/",
    "/privacy/",
    "/contact/",
    ...Object.keys(resourcePages),
  ];

  for (const region of siteData.regions) {
    entries.push(`/clusters/${region.slug}/`);
    for (const city of region.cities) {
      entries.push(`/dui/${city.slug}/`);
      entries.push(`/personal-injury/${city.slug}/`);
    }
  }
  return entries;
}

function duiSitemapEntries() {
  return [
    "/dui/",
    "/dui/locations/",
    ...Object.keys(resourcePages).filter((route) => /(dui|dwi)/i.test(route)),
    ...duiCityEntries().map((entry) => entry.href),
  ];
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

/site.webmanifest
  Cache-Control: public, max-age=86400, must-revalidate

/*.html
  Cache-Control: no-cache
`;
}

function redirectsFile() {
  return `https://www.locallegalguides.com/* https://locallegalguides.com/:splat 301
/claim-sponsorship/ /sponsorships/ 301
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
      const courts = [
        courtForCity(city, region, practiceBySlug.get("dui")),
        courtForCity(city, region, practiceBySlug.get("personal-injury")),
      ];
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

async function main() {
  validateContactStandard();
  await rm(outputRoot, { recursive: true, force: true });

  const outputs = [];

  outputs.push(["index.html", renderHome()]);
  outputs.push(["dui/index.html", renderPracticePage(practiceBySlug.get("dui"))]);
  outputs.push(["personal-injury/index.html", renderPracticePage(practiceBySlug.get("personal-injury"))]);
  outputs.push(["regions/index.html", renderRegions()]);

  for (const region of siteData.regions) {
    outputs.push([`clusters/${region.slug}/index.html`, renderRegion(region)]);
    for (const city of region.cities) {
      for (const practice of siteData.practiceAreas) {
        outputs.push([
          `${practice.slug}/${city.slug}/index.html`,
          renderCityPage(city, region, practice),
        ]);
      }
    }
  }

  const staticPages = renderStaticPages();
  for (const [route, content] of Object.entries(staticPages)) {
    const normalized = route.replace(/^\//, "");
    outputs.push([`${normalized}index.html`, content]);
  }

  for (const [filePath, content] of outputs) {
    await ensureDir(filePath);
    await writeTarget(filePath, content);
  }

  await copyStaticAssets();
  await writeBrandAssets();

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries()
  .map((route) => `  <url><loc>${absoluteUrl(route)}</loc></url>`)
  .join("\n")}
</urlset>
`;

  const duiSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${duiSitemapEntries()
  .map((route) => `  <url><loc>${absoluteUrl(route)}</loc></url>`)
  .join("\n")}
</urlset>
`;

  await writeTarget("sitemap.xml", sitemap);
  await writeTarget("sitemap-dui.xml", duiSitemap);
  await writeTarget(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl("/sitemap.xml")}\nSitemap: ${absoluteUrl("/sitemap-dui.xml")}\n`
  );
  await writeTarget("_headers", securityHeadersFile());
  await writeTarget("_redirects", redirectsFile());
}

await main();
