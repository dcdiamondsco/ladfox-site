(() => {
  const STORAGE_KEY = "ladfox_cookie_choice";
  const applyConsent = (granted) => {
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        ad_storage: granted ? "granted" : "denied",
        analytics_storage: granted ? "granted" : "denied",
        ad_user_data: granted ? "granted" : "denied",
        ad_personalization: granted ? "granted" : "denied"
      });
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const savedChoice = localStorage.getItem(STORAGE_KEY);
    const hasGoogleTag = Boolean(document.querySelector('script[src*="googletagmanager.com/gtag/js"]'));
    if (hasGoogleTag) {
      if (savedChoice) applyConsent(savedChoice === "accepted");
      const banner = document.createElement("aside");
      banner.className = "cookie-consent";
      banner.setAttribute("aria-label", "Cookie choices");
      banner.hidden = Boolean(savedChoice);
      banner.innerHTML = `
        <strong class="cookie-consent__title">Your privacy choices</strong>
        <p>We use optional Google advertising measurement to understand which enquiries come from our adverts. You can accept or decline it. <a href="/cookie-policy.html">Cookie details</a></p>
        <div class="cookie-consent__actions">
          <button type="button" data-cookie-accept>Accept optional tracking</button>
          <button type="button" data-cookie-reject>Decline</button>
        </div>`;
      document.body.appendChild(banner);
      const choose = (choice) => {
        localStorage.setItem(STORAGE_KEY, choice);
        applyConsent(choice === "accepted");
        banner.hidden = true;
      };
      banner.querySelector("[data-cookie-accept]")?.addEventListener("click", () => choose("accepted"));
      banner.querySelector("[data-cookie-reject]")?.addEventListener("click", () => choose("declined"));
    }

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
