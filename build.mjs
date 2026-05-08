import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { siteData } from "./site-data.mjs";

const root = process.cwd();
const outputRoot = path.join(root, "dist");
const practiceBySlug = new Map(siteData.practiceAreas.map((p) => [p.slug, p]));

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
      `${region.cities.length} cities across ${siteData.practiceAreas.length} live practice areas`,
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

function sponsorMetrics(region, packageInfo = sponsorPackage(region)) {
  return [
    ["Cities included", String(region.cities.length)],
    ["Live city guides", String(guideCount(region))],
    ["Practice areas", siteData.practiceAreas.map((practice) => practice.label).join(" + ")],
    ["Sponsor slots", "1 exclusive regional placement"],
    ["Launch price", `${formatCurrency(packageInfo.annualPriceUsd)} / year`],
    ["Term", packageInfo.termLabel],
  ];
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
    <h2>${placement === "cluster" ? "One annual package across this cluster." : `This page is part of the ${escapeHtml(
      region.name
    )} sponsor package.`}</h2>
    <p>This regional package is currently available. The featured sponsor will appear on the ${escapeHtml(
      region.name
    )} cluster page and across the related city pages with clear advertising disclosure.</p>
    <ul class="sponsor-list">
      <li>${escapeHtml(packageInfo.termLabel)}.</li>
      <li>Starter pricing: $${escapeHtml(packageInfo.annualPriceUsd)} per year.</li>
      <li>${escapeHtml(packageInfo.coverageLabel)}</li>
    </ul>
    <p class="sponsor-note">Attorney Advertising. Any future sponsor placement will remain separate from official legal and government resource information.</p>
    <div class="hero-actions">
      <a class="button button-primary" href="/claim-sponsorship/" ${trackingAttrs(`${eventBase}_claim_click`, {
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
    url: siteOrigin,
    email: `mailto:${siteData.legalEmail}`,
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

function cityPageTitle(city, region, practice) {
  if (practice.slug === "dui") {
    const label = practiceSeoLabel(practice, region);
    const license = region.stateCode === "IL" ? "License Suspension" : "License Help";
    return `${city.name}, ${region.stateCode} ${label}: Court, Police & ${license} | ${siteData.siteName}`;
  }

  return `${city.name}, ${region.stateCode} Personal Injury: Court, Police Reports & Deadlines | ${siteData.siteName}`;
}

function cityPageDescription(city, region, practice) {
  const court = courtForCity(city, region, practice);
  if (practice.slug === "dui") {
    const label = practiceSeoLabel(practice, region);
    return compactDescription(
      `${city.name} ${label} guide with ${court.name}, ${city.agency}, license deadlines, penalties, implied consent rules, nearby offices, FAQs, and official sources.`
    );
  }

  return compactDescription(
    `${city.name} personal injury guide with ${court.name}, police report contacts, filing deadlines, insurance steps, nearby offices, FAQs, and official sources.`
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
      href: "#deadlines",
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
          ${office.address ? `<div><dt>Address</dt><dd><a href="${mapsHref(office.address)}" target="_blank" rel="noopener noreferrer">${escapeHtml(office.address)}</a></dd></div>` : ""}
          ${office.phone ? `<div><dt>Phone</dt><dd>${escapeHtml(office.phone)}</dd></div>` : ""}
          ${office.hours ? `<div><dt>Hours</dt><dd>${escapeHtml(office.hours)}</dd></div>` : ""}
        </dl>
        ${office.note ? `<p>${escapeHtml(office.note)}</p>` : ""}
        ${office.href ? `<a class="text-link" href="${escapeHtml(office.href)}" target="_blank" rel="noopener noreferrer">Official website</a>` : ""}
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
      url: siteOrigin,
    },
  };
}

function cityToc(isDui) {
  const items = [
    ["Local directory", "#directory"],
    ["Map", "#map"],
    ["Local details", "#local"],
    ["Key deadlines", "#deadlines"],
    [isDui ? "DUI law" : "Injury law", "#state-law"],
    ["Case process", "#process"],
    [isDui ? "Penalties" : "Claim value", "#penalties"],
    [isDui ? "Implied consent" : "Fault and proof", "#implied-consent"],
    [isDui ? "License restoration" : "Insurance and settlement", "#restoration"],
    ["Official sources", "#sources"],
    ["Common questions", "#faq"],
  ];

  return `<section class="toc-band">
    <div class="container">
      <p class="eyebrow">On this page</p>
      <nav class="toc-list">${items
        .map((item, index) => `<a href="${item[1]}"><span>${index + 1}</span>${escapeHtml(item[0])}</a>`)
        .join("")}</nav>
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

function pageShell({ title, description, body, active = "", route = "/", schema = [], lastVerified = siteData.lastVerified }) {
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

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${absoluteUrl(route)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${absoluteUrl(route)}" />
    <meta property="og:site_name" content="${escapeHtml(siteData.siteName)}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/styles.css" />
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
        <nav class="nav">${nav}</nav>
      </div>
    </header>

    <main>
      <section class="page-status-band">
        <div class="container page-status-inner">
          <span class="page-status-pill">Last verified: ${escapeHtml(formatDisplayDate(lastVerified))}</span>
          <span class="page-status-copy">Official links, court details, and sponsor package structure were reviewed for this build.</span>
        </div>
      </section>
      ${body}
    </main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <p>General legal information for local court, license, claims, and city agency research.</p>
        <p><a href="/contact/">Contact</a> | <a href="/terms/">Terms</a> | <a href="/privacy/">Privacy</a></p>
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
    <a class="text-link" href="/clusters/${region.slug}/">View region</a>
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
  const caseName = isDui ? basics.duiName : "personal injury";
  const quickActions = quickActionCards({ city, region, court, licenseOffice, isDui, basics });
  const title = isDui
    ? `${city.name} ${basics.duiName} court and license guide`
    : `${city.name} personal injury court guide`;
  const intro = isDui
    ? `${region.state} uses ${basics.duiThreshold} as the per se alcohol threshold. This page ties that state rule to the local court and agencies most relevant to ${city.name}.`
    : `${region.state} injury claims depend on filing deadlines, venue, insurance issues, and proof. This page connects the statewide deadline to the local court path for ${city.name}.`;
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
    licenseOffice ? { label: licenseOffice.name, href: licenseOffice.href } : null,
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
        <div class="hero-actions">
          <a class="button button-primary" href="#local">Local details</a>
          <a class="button button-secondary" href="#sources">Official sources</a>
        </div>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Verified guide</span>
          <span class="pill pill-muted">${escapeHtml(region.name)}</span>
        </div>
        <div class="stat-grid">${snapshot
          .map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`)
          .join("")}</div>
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

  <section class="quick-start" id="start-here">
    <div class="container quick-start-grid">
      <div class="quick-start-intro">
        <p class="eyebrow">Start here</p>
        <h2>Fast path for ${escapeHtml(city.name)}.</h2>
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

  ${cityToc(isDui)}

  <section class="section section-directory" id="directory">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Local directory</p>
        <h2>Courts, police, and license offices serving ${escapeHtml(city.name)}.</h2>
        <p>Use these contacts to confirm court dates, request records, verify office hours, or find the correct agency before visiting.</p>
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
          <div class="directory-label">${isDui ? "Driver services" : "Records and claims"}</div>
          <div class="office-stack">${officeCards([licenseOffice])}</div>
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
        <iframe title="${escapeHtml(city.name)} local legal office map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${mapEmbedHref(`${city.name} ${region.stateCode} police courthouse driver services`)}"></iframe>
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

  <section class="section section-alt" id="state-law">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">${escapeHtml(region.state)} law</p>
        <h2>${escapeHtml(isDui ? `${basics.duiName} law and license rules` : "Injury claim rules")} for ${escapeHtml(city.name)}.</h2>
      </div>
      <div class="card-grid four-up">${localLawCards
        .map((item) => `<article class="info-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`)
        .join("")}</div>
    </div>
  </section>

  <section class="section section-alt" id="process">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Process</p>
          <h2>What to expect next.</h2>
        </div>
        <ol class="bulleted-list">${process.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
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

  <section class="section section-alt" id="related-guides">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">More guides for ${escapeHtml(city.name)}</p>
          <h2>Related legal topics.</h2>
        </div>
        <div class="related-grid">${siteData.practiceAreas
          .filter((item) => item.slug !== practice.slug)
          .map((item) => `<a class="related-card" href="${pathForPracticeCity(item.slug, city.slug)}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(city.name)} ${escapeHtml(item.title)}</strong><p>${escapeHtml(item.summary)}</p></a>`)
          .join("")}
          <article class="related-card muted-card"><span>Coming next</span><strong>Traffic Violations</strong><p>Speeding, reckless driving, and license points in local court.</p></article>
          <article class="related-card muted-card"><span>Coming next</span><strong>Criminal Defense</strong><p>Misdemeanor and felony court process for local cases.</p></article>
        </div>
      </div>
      <div>
        <aside class="sponsor-panel">
          <p class="eyebrow">Regional sponsor package</p>
          <h2>This page is part of the ${escapeHtml(region.name)} sponsor package.</h2>
          <p>Any attorney advertised for ${escapeHtml(region.name)} should be disclosed as a regional sponsor across the related city pages. The legal guide content still stands on its own even when no sponsor is active.</p>
          <ul class="sponsor-list">
            <li>Links back to the featured sponsor position for ${escapeHtml(region.name)}.</li>
            <li>Built for one sponsor across ${region.cities.length} cities in this cluster.</li>
            <li>${escapeHtml(packageInfo.termLabel)} at $${escapeHtml(packageInfo.annualPriceUsd)} per year to start.</li>
            <li>Keeps official court, police, and DMV contacts separate.</li>
            <li>Uses clear advertising disclosure without implying endorsement.</li>
          </ul>
          <div class="hero-actions">
            <a class="button button-primary" href="${sponsorPackageHref(region)}">View regional sponsor package</a>
            <a class="button button-secondary" href="/claim-sponsorship/">Claim this package</a>
          </div>
        </aside>
        <div class="sponsor-inline-card">
          ${sponsorProfileCard(region, packageInfo, "city")}
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
    offices: [...courtOffices, ...enforcementOffices, licenseOffice].filter(Boolean),
  };
}

function duiEdwardsvillePage(city, region, guide) {
  const snapshotCards = guide.snapshot
    .map(
      (item) => `<div class="stat-card"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`
    )
    .join("");

  const localCards = guide.localCards
    .map(
      (item) => `<article class="info-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`
    )
    .join("");

  const processItems = guide.process
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const sources = guide.sources
    .map(
      (item) =>
        `<a class="source-card" href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(
          item.label
        )}</span><strong>Official source</strong></a>`
    )
    .join("");

  const faq = guide.faq
    .map(
      (item, index) => `<details class="faq-item"${index === 0 ? " open" : ""}><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(
        item.a
      )}</p></details>`
    )
    .join("");

  return `<section class="hero">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(region.state)} | Verified local guide</p>
        <h1>${escapeHtml(city.name)} DUI guide built from official Illinois sources.</h1>
        <p class="lede">${escapeHtml(guide.intro)}</p>
        <div class="hero-actions">
          <a class="button button-primary" href="#details">See the details</a>
          <a class="button button-secondary" href="#sources">Jump to sources</a>
        </div>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">${escapeHtml(guide.badge)}</span>
          <span class="pill pill-muted">${escapeHtml(region.name)}</span>
        </div>
        <div class="stat-grid">${snapshotCards}</div>
      </aside>
    </div>
  </section>

  <section class="section" id="details">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Local snapshot</p>
        <h2>The core Edwardsville facts, cleaned up.</h2>
      </div>
      <div class="card-grid three-up">${localCards}</div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Process</p>
          <h2>What usually happens after a DUI arrest.</h2>
        </div>
        <ol class="bulleted-list">${processItems}</ol>
      </div>
      <div>
        <div class="section-head">
          <p class="eyebrow">Official sources</p>
          <h2>Everything on this page is sourced.</h2>
        </div>
        <div class="source-grid" id="sources">${sources}</div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">FAQ</p>
        <h2>Common questions people ask first.</h2>
      </div>
      <div class="faq-grid">${faq}</div>
    </div>
  </section>`;
}

function practicePage(practice) {
  const regionCards = siteData.regions
    .map((region) => {
      const cities = region.cities
        .map((city) => `<a class="city-link" href="${pathForPracticeCity(practice.slug, city.slug)}">${escapeHtml(city.name)}</a>`)
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
      </aside>
    </div>
  </section>
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
          <a class="button button-secondary" href="/dui/">View DUI guides</a>
        </div>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Source-backed</span>
          <span class="pill pill-muted">Local first</span>
        </div>
        <div class="stat-grid">
          <div><dt>Markets</dt><dd>Illinois, Missouri, North Carolina</dd></div>
          <div><dt>Practice areas</dt><dd>DUI + Personal Injury</dd></div>
          <div><dt>City pages</dt><dd>${cityCount} cities in the current map</dd></div>
          <div><dt>Sources</dt><dd>State law and court references</dd></div>
        </div>
      </aside>
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
    .map((city) => `<li>${escapeHtml(city.name)} city pages across ${siteData.practiceAreas.length} practice areas.</li>`)
    .join("");

  const sponsorFeatureCards = [
    ["Exclusive regional visibility", `One attorney sponsor can cover all ${region.cities.length} cities in ${region.name}.`],
    ["Related city-page placement", "Each included city page can reference the same regional sponsor package with clear disclosure."],
    ["Official data stays separate", "Court, police, sheriff, and DMV contacts remain neutral and distinct from the ad placement."],
  ]
    .map((item) => `<article class="info-card"><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`)
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
        <p class="note">This market is ready for both practice areas and future pages.</p>
      </aside>
    </div>
  </section>

  <section class="section">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Cities</p>
          <h2>City pages in this region.</h2>
        </div>
        <div class="chip-grid">${cityLinks}</div>
      </div>
      <div>
        <div class="section-head">
          <p class="eyebrow">Practice areas</p>
          <h2>Same region, multiple topics.</h2>
        </div>
        <div class="chip-grid">${practiceLinks}</div>
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
        <p class="eyebrow">Why this region matters</p>
        <h2>County-level context before the city details.</h2>
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

  <section class="section section-alt" id="regional-sponsor">
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Regional sponsorship</p>
          <h2>Featured attorney package for ${escapeHtml(region.name)}.</h2>
          <p>This is the premium sponsor position for the full ${escapeHtml(region.name)} cluster. It is built to support all included city pages while keeping the guide content neutral and useful on its own.</p>
        </div>
        ${metricsGrid(sponsorMetrics(region, packageInfo), "metric-grid metric-grid-compact")}
        <div class="card-grid three-up">${sponsorFeatureCards}</div>
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
  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">For attorneys</p>
        <h1>Claim a Local Legal Guides regional sponsorship package.</h1>
        <p class="lede">Each cluster can feature one clearly labeled attorney sponsor across its related city pages. Local Legal Guides uses the same regional structure across every market so sponsorship stays consistent and transparent.</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Inventory-driven</span>
          <span class="pill pill-muted">One sponsor per cluster</span>
        </div>
        <p class="note">Questions about availability or placement? Email ${siteData.sponsorsEmail}.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/sponsor-media-kit/">View media kit</a>
          <a class="button button-secondary" href="/sponsor-agreement/">Sponsor terms</a>
        </div>
      </aside>
    </div>
  </section>
  <section class="section">
    <div class="container card-grid two-up">
      <article class="info-card"><h3>Clear labeling</h3><p>No rankings, no directory behavior, and no implied recommendation. Sponsor placements stay separate from official contacts and legal information.</p></article>
      <article class="info-card"><h3>Cluster coverage</h3><p>Each package can cover the full cluster, the related city pages, and both practice areas currently live in that market.</p></article>
    </div>
  </section>
  <section class="section section-alt">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Sponsor contact</p>
        <h2>Talk to the sponsorship team.</h2>
        <p>Use ${siteData.sponsorsEmail} for inventory, pricing, and launch timing.</p>
      </div>
    </div>
  </section>
  ${sponsorInquiryForm({
    title: "Request a regional package",
    intro: "Send a prefilled sponsorship inquiry for the cluster you want to reserve.",
  })}`;
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
      <article class="price-card"><h3>Regional launch</h3><p>Start at $1,000 per year for one exclusive sponsor across a 3-5 city cluster.</p></article>
      <article class="price-card"><h3>City-page coverage</h3><p>The regional package can include matching sponsor visibility on the related city guides in that cluster.</p></article>
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
        <td>${escapeHtml(formatCurrency(packageInfo.annualPriceUsd))}</td>
        <td>${escapeHtml(packageInfo.status === "preview" ? "Preview" : packageInfo.status === "sponsored" ? "Sponsored" : "Available")}</td>
      </tr>`;
    })
    .join("");

  return `<section class="hero hero-tight">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">Sponsor media kit</p>
        <h1>Regional sponsorship inventory for local attorneys.</h1>
        <p class="lede">Each package gives one attorney or firm a clearly labeled sponsor position across a local cluster page and the related city guides. The guide content remains neutral, source-backed, and useful without a sponsor.</p>
      </div>
      <aside class="hero-card">
        <div class="hero-card-header">
          <span class="pill">Launch offer</span>
          <span class="pill pill-muted">$1,000/year starter</span>
        </div>
        <p class="note">Use this page when discussing available regional inventory with attorneys.</p>
      </aside>
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
        <article class="info-card"><h3>City page visibility</h3><p>Matching sponsor visibility on every included city page in the purchased cluster.</p></article>
        <article class="info-card"><h3>Exclusive slot</h3><p>One sponsor per regional package during the term, so the placement is easy to explain and sell.</p></article>
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
          <thead><tr><th>Cluster</th><th>State</th><th>Cities</th><th>Guides</th><th>Starter price</th><th>Status</th></tr></thead>
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
          <a class="button button-primary" href="/claim-sponsorship/">Claim sponsorship</a>
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
            <a class="button button-primary" href="/claim-sponsorship/">Claim sponsorship</a>
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
    `Use the right inbox so your question reaches the right person quickly.`,
    `<div class="container card-grid three-up">
      <article class="info-card"><h3>Legal and compliance</h3><p><a class="text-link" href="mailto:${siteData.legalEmail}">${siteData.legalEmail}</a></p></article>
      <article class="info-card"><h3>Privacy questions</h3><p><a class="text-link" href="mailto:${siteData.privacyEmail}">${siteData.privacyEmail}</a></p></article>
      <article class="info-card"><h3>Sponsorship inquiries</h3><p><a class="text-link" href="mailto:${siteData.sponsorsEmail}">${siteData.sponsorsEmail}</a></p></article>
    </div>${sponsorInquiryForm({
      title: "Prefer a guided sponsorship inquiry?",
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
  const title = `${practice.title} by City | ${siteData.siteName}`;
  const description = compactDescription(`${practice.summary} Browse city-specific court, agency, deadline, and official source information.`);
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
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteData.siteName,
        url: siteOrigin,
        description,
        publisher: publisherSchema(),
      },
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
    "/claim-sponsorship/": {
      title: `Claim Sponsorship | ${siteData.siteName}`,
      description: `${siteData.siteName} sponsorship details for regional cluster packages and related city-page attorney placements.`,
      body: sponsorshipPage(),
      active: "/claim-sponsorship/",
      crumbs: ["Claim Sponsorship"],
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
      active: "/claim-sponsorship/",
      crumbs: ["Sponsor Media Kit"],
    },
    "/sponsor-agreement/": {
      title: `Sponsor Agreement | ${siteData.siteName}`,
      description: `${siteData.siteName} plain-language sponsorship terms, disclosure rules, exclusivity notes, and attorney advertising limitations.`,
      body: sponsorAgreementPage(),
      active: "/claim-sponsorship/",
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
        const breadcrumbs = [{ name: "Home", href: "/" }, { name: page.crumbs[0], href: route }];
        return [
          route,
          pageShell({
            title: page.title,
            description: page.description,
            body: `${breadcrumbTrail(breadcrumbs)}${page.body}`,
            active: page.active,
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
    "/personal-injury/",
    "/regions/",
    "/claim-sponsorship/",
    "/pricing/",
    "/sponsor-media-kit/",
    "/sponsor-agreement/",
    "/terms/",
    "/privacy/",
    "/contact/",
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

function securityHeadersFile() {
  return `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; frame-src https://maps.google.com https://www.google.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'

/styles.css
  Cache-Control: public, max-age=3600, must-revalidate

/app.js
  Cache-Control: public, max-age=3600, must-revalidate

/*.html
  Cache-Control: no-cache
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

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries()
  .map((route) => `  <url><loc>${absoluteUrl(route)}</loc></url>`)
  .join("\n")}
</urlset>
`;

  await writeTarget("sitemap.xml", sitemap);
  await writeTarget(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`
  );
  await writeTarget("_headers", securityHeadersFile());
}

await main();
