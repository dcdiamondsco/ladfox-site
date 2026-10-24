(() => {
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('form[data-netlify="true"]:not([hidden])').forEach((form) => {
      if (form.querySelector('[name="marketing_consent"]')) return;
      const submit = form.querySelector('button[type="submit"], input[type="submit"]');
      if (!submit) return;
      const label = document.createElement("label");
      label.className = "site-marketing-optin";
      label.innerHTML = '<input type="checkbox" name="marketing_consent" value="yes"> <span>Email me occasional LADFOX news and jewellery guidance. Optional; unsubscribe at any time.</span>';
      const row = submit.closest(".submit-row") || submit.parentElement;
      row?.parentElement?.insertBefore(label, row);
    });

    document.querySelectorAll('form[action*="thank-you"]').forEach((form) => {
      form.addEventListener("submit", () => {
        sessionStorage.setItem("ladfox_pending_lead", String(Date.now()));
      });
    });
  });
})();

// LADFOX lead conversion: fires the Google Ads "Website lead" conversion once
// whenever a site form (Netlify form or account-auth enquiry) is accepted by the server.
(() => {
  const LABEL = "AW-18173399172/Ly6MCOPyp6gdEISh4NlD";
  const isLeadRequest = (url, method) => {
    try {
      const u = new URL(url, window.location.origin);
      if (u.origin !== window.location.origin) return false;
      if (String(method || "GET").toUpperCase() !== "POST") return false;
      return u.pathname === "/" || u.pathname === "/.netlify/functions/account-auth";
    } catch (e) { return false; }
  };
  window.lfxFireLead = (source) => {
    try {
      const last = Number(sessionStorage.getItem("ladfox_lead_fired") || 0);
      if (Date.now() - last < 60000) return;
      sessionStorage.setItem("ladfox_lead_fired", String(Date.now()));
    } catch (e) { /* ignore */ }
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "conversion", { send_to: LABEL, value: 1, currency: "GBP" });
        window.gtag("event", "generate_lead", { form_name: source || "site-form" });
      }
    } catch (e) { /* ignore */ }
  };
  if (typeof window.fetch === "function" && !window.__lfxFetchWrapped) {
    window.__lfxFetchWrapped = true;
    const original = window.fetch.bind(window);
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      const method = (init && init.method) || (input && input.method) || "GET";
      const lead = isLeadRequest(url, method);
      const p = original(input, init);
      if (lead) {
        p.then((res) => { if (res && res.ok) window.lfxFireLead("fetch-form"); }).catch(() => {});
      }
      return p;
    };
  }
})();
