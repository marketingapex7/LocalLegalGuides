const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector("#primary-nav");

if (menuToggle && primaryNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    primaryNav.classList.toggle("is-open", !isOpen);
  });

  primaryNav.addEventListener("click", (event) => {
    if (!event.target.closest("a")) {
      return;
    }

    menuToggle.setAttribute("aria-expanded", "false");
    primaryNav.classList.remove("is-open");
  });
}

function emitSponsorEvent(eventName, payload) {
  const detail = {
    event: eventName,
    payload,
    timestamp: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent("locallegalguides:tracking", { detail }));

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(detail);
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, payload);
  }
}

function isSponsorApplyEvent(eventName) {
  return (
    eventName === "claim_package_click" ||
    eventName === "city_sponsor_cta_click" ||
    eventName === "sponsor_form_submit" ||
    eventName.endsWith("_claim_click") ||
    eventName.endsWith("_cta_click")
  );
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-track='true']");
  if (target) {
    const eventName = target.getAttribute("data-track-event");
    const payloadRaw = target.getAttribute("data-track-payload");

    if (!eventName) {
      return;
    }

    let payload = {};

    if (payloadRaw) {
      try {
        payload = JSON.parse(payloadRaw);
      } catch {
        payload = { raw: payloadRaw };
      }
    }

    emitSponsorEvent(eventName, payload);
    if (isSponsorApplyEvent(eventName)) {
      emitSponsorEvent("sponsor_apply", {
        city: payload.city || "",
        region: payload.region || "",
        practice: payload.practice || "",
        placement: payload.placement || "",
        source_event: eventName,
      });
    }
    return;
  }

  const link = event.target.closest("a[href]");
  if (!link) {
    return;
  }

  const href = link.getAttribute("href") || "";
  if (href.startsWith("mailto:")) {
    emitSponsorEvent("email_click", { href });
  } else if (href.startsWith("tel:")) {
    emitSponsorEvent("phone_click", { href });
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-sponsor-form='true']");
  if (!form) {
    return;
  }

  event.preventDefault();

  const formData = new FormData(form);
  const targetEmail = String(formData.get("targetEmail") || "").trim();
  const regionSlug = String(formData.get("regionSlug") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const firm = String(formData.get("firm") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  const payload = {
    region: regionSlug,
    name,
    email,
    firm,
  };

  emitSponsorEvent("sponsor_form_submit", payload);
  emitSponsorEvent("sponsor_apply", {
    region: regionSlug,
    city: "",
    practice: "",
    placement: "form",
    source_event: "sponsor_form_submit",
  });

  const subject = encodeURIComponent(`Sponsorship inquiry: ${regionSlug || "cluster not selected"}`);
  const body = encodeURIComponent(
    [
      `Name: ${name}`,
      `Email: ${email}`,
      `Firm: ${firm}`,
      `Phone: ${phone}`,
      `Cluster: ${regionSlug}`,
      "",
      "Notes:",
      notes || "No notes provided.",
    ].join("\n")
  );

  window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`;
});

const path = window.location.pathname;

function removePublicSponsorPromos() {
  document
    .querySelectorAll(".nav a[href^='/sponsorships'], .nav a[href^='/sponsor-media-kit'], .nav a[href^='/pricing']")
    .forEach((link) => link.remove());

  const footerLinks = document.querySelector(".footer-inner p:nth-of-type(2)");
  if (footerLinks && !footerLinks.querySelector("a[href='/sponsorships/']")) {
    footerLinks.insertAdjacentHTML("beforeend", ' | <a href="/sponsorships/">Sponsorships</a>');
  }

  if (path !== "/") {
    return;
  }

  document.querySelectorAll("section").forEach((section) => {
    const text = section.textContent || "";
    if (text.includes("Attorneys: regional sponsorships are open")) {
      section.remove();
    }
  });
}

function injectBehaviorStyles() {
  if (document.querySelector("#llg-behavior-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "llg-behavior-styles";
  style.textContent = `
    .toc-more-button {
      display: none;
      min-height: 38px;
      margin-top: 0.6rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 0.45rem 0.65rem;
      background: var(--surface);
      color: var(--wine);
      font: inherit;
      font-size: 0.88rem;
      font-weight: 800;
      cursor: pointer;
    }

    @media (max-width: 960px) {
      .toc-list-compact:not(.is-expanded) li:nth-child(n + 7) {
        display: none;
      }

      .toc-more-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    }
  `;
  document.head.append(style);
}

function compactLongToc() {
  document.querySelectorAll(".toc-list").forEach((list) => {
    const items = Array.from(list.querySelectorAll("li"));
    if (items.length <= 8 || list.dataset.compactReady === "true") {
      return;
    }

    list.dataset.compactReady = "true";
    list.classList.add("toc-list-compact");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "toc-more-button";
    button.textContent = "Show all sections";
    button.setAttribute("aria-expanded", "false");

    button.addEventListener("click", () => {
      const isOpen = list.classList.toggle("is-expanded");
      button.setAttribute("aria-expanded", String(isOpen));
      button.textContent = isOpen ? "Show fewer sections" : "Show all sections";
    });

    list.closest(".toc-band")?.querySelector(".container")?.append(button);
  });
}

function cleanSponsorSampleCard() {
  const sample = document.querySelector(".sample-sponsor-card");
  if (!sample) {
    return;
  }

  const heading = sample.querySelector("h3");
  if (heading && heading.textContent.trim() === "Smith Law Firm") {
    heading.textContent = "Your Firm Here";
  }

  const focus = sample.querySelector(".sample-sponsor-focus");
  if (focus) {
    focus.textContent = "Example regional sponsor placement";
  }

  sample.querySelectorAll("p").forEach((paragraph) => {
    if ((paragraph.textContent || "").includes("Call:")) {
      paragraph.innerHTML = "<strong>Call:</strong> sponsor phone number";
    }
  });

  const button = sample.querySelector(".button");
  if (button) {
    button.textContent = "Website CTA";
  }
}

function wakeSouthwestPackagePanel() {
  if (!["/sponsorships/", "/sponsor-media-kit/"].includes(path)) {
    return;
  }

  if (document.querySelector("#wake-southwest-dwi-package")) {
    return;
  }

  const hero = document.querySelector("main > .hero");
  if (!hero) {
    return;
  }

  const section = document.createElement("section");
  section.className = "section section-alt";
  section.id = "wake-southwest-dwi-package";
  section.innerHTML = `
    <div class="container split-grid">
      <div>
        <div class="section-head">
          <p class="eyebrow">Current priority package</p>
          <h2>Wake Southwest DWI sponsorship.</h2>
          <p>One attorney can reserve the DWI sponsor slot across Apex, Cary, Fuquay-Varina, and Holly Springs for a 12-month founding package.</p>
        </div>
        <div class="card-grid two-up">
          <article class="info-card"><h3>4 city DWI pages</h3><p>Apex, Cary, Fuquay-Varina, and Holly Springs are grouped as one Wake County southwest package.</p></article>
          <article class="info-card"><h3>Exclusive practice slot</h3><p>The DWI sponsor is the only attorney sponsor shown for that practice area during the package term.</p></article>
          <article class="info-card"><h3>Early search traction</h3><p>The cluster is indexed and has started receiving Google Search Console impressions, with Apex currently the strongest page.</p></article>
          <article class="info-card"><h3>Founding price</h3><p>$1,000 per year for the regional DWI package while launch inventory is being filled.</p></article>
        </div>
      </div>
      <aside class="sponsor-panel sponsor-panel-strong">
        <p class="eyebrow">Included pages</p>
        <h3>Wake Southwest DWI</h3>
        <ul class="sponsor-list">
          <li><a class="text-link" href="/dui/apex-nc/">Apex DWI guide</a></li>
          <li><a class="text-link" href="/dui/cary-nc/">Cary DWI guide</a></li>
          <li><a class="text-link" href="/dui/fuquay-varina-nc/">Fuquay-Varina DWI guide</a></li>
          <li><a class="text-link" href="/dui/holly-springs-nc/">Holly Springs DWI guide</a></li>
        </ul>
        <div class="hero-actions">
          <a class="button button-primary" href="/clusters/wake-southwest-nc/#regional-sponsor">View package</a>
          <a class="button button-secondary" href="mailto:sponsors@locallegalguides.com?subject=Wake%20Southwest%20DWI%20sponsorship">Ask about this slot</a>
        </div>
      </aside>
    </div>`;

  hero.after(section);
}

injectBehaviorStyles();
removePublicSponsorPromos();
compactLongToc();
cleanSponsorSampleCard();
wakeSouthwestPackagePanel();

if (/^\/clusters\/[^/]+\/?$/.test(path)) {
  emitSponsorEvent("region_page_view", { path });
} else if (/^\/(dui|personal-injury)\/[^/]+\/?$/.test(path)) {
  emitSponsorEvent("city_page_view", { path });
}
