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
