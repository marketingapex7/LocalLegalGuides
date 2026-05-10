const yearTargets = document.querySelectorAll("[data-year]");
const currentYear = new Date().getFullYear();

for (const node of yearTargets) {
  node.textContent = String(currentYear);
}

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

  if (typeof window.plausible === "function") {
    window.plausible(eventName, { props: payload });
  }
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
if (/^\/clusters\/[^/]+\/?$/.test(path)) {
  emitSponsorEvent("region_page_view", { path });
} else if (/^\/(dui|personal-injury)\/[^/]+\/?$/.test(path)) {
  emitSponsorEvent("city_page_view", { path });
}
