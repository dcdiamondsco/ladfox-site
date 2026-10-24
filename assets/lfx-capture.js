(function () {
  "use strict";
  if (document.querySelector(".lfx-capture")) return;
  var footer = document.querySelector("footer");
  if (!footer) return;

  // Make sure the Google tag is present so sign-ups count as lead conversions.
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("consent", "default", { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", wait_for_update: 500 });
    gtag("config", "AW-18173399172");
    var gs = document.createElement("script");
    gs.async = true;
    gs.src = "https://www.googletagmanager.com/gtag/js?id=AW-18173399172";
    document.head.appendChild(gs);
  }

  var css = [
    ".lfx-capture{background:#050505;border-top:1px solid rgba(255,255,255,.12);padding:clamp(44px,7vw,72px) 20px;text-align:center;color:#fff;font-family:inherit}",
    ".lfx-capture__inner{max-width:560px;margin:0 auto}",
    ".lfx-capture h2{margin:0 0 10px;font-size:clamp(1.5rem,3.2vw,2.1rem);line-height:1.2;font-weight:600;letter-spacing:-.01em;color:#fff}",
    ".lfx-capture p{margin:0 auto 22px;max-width:46ch;font-size:1rem;line-height:1.6;color:rgba(255,255,255,.72)}",
    ".lfx-capture form{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:0}",
    ".lfx-capture input{flex:1 1 15rem;min-width:0;padding:13px 20px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.07);color:#fff;font:inherit;font-size:.95rem}",
    ".lfx-capture input::placeholder{color:rgba(255,255,255,.5)}",
    ".lfx-capture button{cursor:pointer;border:0;border-radius:999px;padding:13px 28px;background:#fff;color:#000;font:inherit;font-size:.92rem;font-weight:700;letter-spacing:.02em}",
    ".lfx-capture button:disabled{opacity:.6;cursor:default}",
    ".lfx-capture__msg{min-height:1.4em;margin:14px auto 0;max-width:none;font-size:.9rem;color:rgba(255,255,255,.85)}",
    ".lfx-capture__trust{display:flex;flex-wrap:wrap;gap:8px 22px;justify-content:center;list-style:none;margin:26px 0 0;padding:0;font-size:.78rem;letter-spacing:.04em;color:rgba(255,255,255,.62)}",
    ".lfx-capture__trust li::before{content:\"\\2713\\00a0\";color:#fff}"
  ].join("\n");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var section = document.createElement("section");
  section.className = "lfx-capture";
  section.setAttribute("aria-labelledby", "lfxCaptureHeading");
  section.innerHTML =
    '<div class="lfx-capture__inner">' +
    '<h2 id="lfxCaptureHeading">Prefer to go custom?</h2>' +
    "<p>Get a complimentary sketch of a ring designed around you. Leave your email and we’ll send you a login link.</p>" +
    '<form novalidate><input type="email" name="email" placeholder="Your email address" autocomplete="email" inputmode="email" aria-label="Your email address" required><button type="submit">Submit</button></form>' +
    '<p class="lfx-capture__msg" role="status" aria-live="polite"></p>' +
    '<ul class="lfx-capture__trust"><li>Family-run Hatton Garden jeweller</li><li>Lifetime warranty</li><li>Insured UK delivery</li></ul>' +
    "</div>";
  footer.parentNode.insertBefore(section, footer);

  var form = section.querySelector("form");
  var email = section.querySelector("input");
  var btn = section.querySelector("button");
  var msg = section.querySelector(".lfx-capture__msg");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      msg.textContent = "Please enter a valid email address.";
      email.focus();
      return;
    }
    btn.disabled = true;
    msg.textContent = "Sending…";
    fetch("/.netlify/functions/account-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", email: v, intent: "sketch" })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (x.ok && x.d && x.d.instant) {
          if (window.gtag) { try { gtag("event", "generate_lead", { form_name: "page-sketch-capture" }); gtag("event", "conversion", { send_to: "AW-18173399172/PpNpCLbcpaQdEISh4NlD" }); } catch (err) { /* ignore */ } }
          window.location.href = "account.html?start=design";
          return;
        }
        if (x.ok) {
          form.hidden = true;
          msg.textContent = "Check your inbox. We’ve sent you a link to request your complimentary sketch.";
          if (window.gtag) { try { gtag("event", "generate_lead", { form_name: "page-sketch-capture" }); gtag("event", "conversion", { send_to: "AW-18173399172/PpNpCLbcpaQdEISh4NlD" }); } catch (err) { /* ignore */ } }
        } else {
          btn.disabled = false;
          msg.textContent = (x.d && x.d.error) || "Something went wrong. Please try again.";
        }
      })
      .catch(function () {
        btn.disabled = false;
        msg.textContent = "We could not send that just now. Please try again.";
      });
  });
})();
