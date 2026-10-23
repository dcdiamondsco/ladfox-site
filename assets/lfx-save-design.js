(function () {
  "use strict";
  var page = location.pathname.split("/").pop() || "";
  if (!/^(classic-solitaire|signature-solitaire|trilogy-ring)(\.html)?$/.test(page)) return;
  var pageFile = page.indexOf(".html") > -1 ? page : page + ".html";
  var ENDPOINT = "/.netlify/functions/save-design";
  var ENGRAVE_BAD = /[^A-Za-z0-9 &.,'’\-\/]/g;
  var cleanEngraving = function (v) { return String(v || "").replace(ENGRAVE_BAD, "").replace(/\s+/g, " ").trim().slice(0, 20); };

  var css = [
    ".lfx-save{margin:18px 0 6px;padding:16px;border:1px solid rgba(255,255,255,.2);border-radius:12px;background:rgba(255,255,255,.04)}",
    ".lfx-save h3{margin:0 0 6px;font-size:1.02rem;font-weight:600;color:inherit}",
    ".lfx-save p{margin:0 0 12px;font-size:.88rem;line-height:1.5;opacity:.8}",
    ".lfx-save__row{display:flex;gap:8px;flex-wrap:wrap}",
    ".lfx-save input[type=email]{flex:1 1 12rem;min-width:0;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:transparent;color:inherit;font:inherit;font-size:.95rem}",
    ".lfx-save button{min-height:44px;padding:0 20px;border:0;border-radius:999px;background:#c8ccd4;color:#000;font:inherit;font-size:.9rem;font-weight:700;cursor:pointer}",
    ".lfx-save button:disabled{opacity:.6;cursor:default}",
    ".lfx-save label.lfx-save__opt{display:flex;gap:8px;align-items:flex-start;margin:10px 0 0;font-size:.8rem;opacity:.75;cursor:pointer}",
    ".lfx-save__msg{min-height:1.3em;margin:10px 0 0;font-size:.88rem}",
    ".lfx-save a{color:inherit;text-decoration:underline;text-underline-offset:3px}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var read = function (id) { var el = document.getElementById(id); return el ? String(el.value || "").trim() : ""; };

  var collect = function () {
    var out = {};
    Array.prototype.forEach.call(document.querySelectorAll('input[id^="signature"],input[id^="trilogy"]'), function (el) {
      if (!el.id || /Terms|Video/i.test(el.id)) return;
      if (el.type === "checkbox" || el.type === "radio" || el.type === "range" || el.type === "button") return;
      if (String(el.value || "").trim()) out[el.id] = String(el.value).trim();
    });
    var eng = cleanEngraving(read("lfxEngraving"));
    if (eng) out.lfxEngraving = eng;
    return out;
  };

  var summary = function () {
    var el = document.querySelector("[data-summary-output]");
    var t = el ? el.textContent.replace(/\s+/g, " ").trim() : "";
    var eng = cleanEngraving(read("lfxEngraving"));
    return t + (eng ? " Engraving: " + eng + "." : "");
  };

  var priceText = function () {
    var els = document.querySelectorAll("[data-checkout-label],[data-price-output],.checkout-price-stack");
    for (var i = 0; i < els.length; i++) { var m = /£\s?[\d,]+(\.\d\d)?/.exec(els[i].textContent); if (m) return m[0]; }
    return "";
  };

  var attribution = function () {
    var q = new URLSearchParams(location.search), o = {};
    ["utm_source", "utm_campaign", "gclid"].forEach(function (k) { if (q.get(k)) o[k] = q.get(k); });
    return o;
  };

  var post = function (body) {
    return fetch(ENDPOINT, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); });
  };

  // ---- Restore a saved design (trilogy page has no query handling of its own) ----
  var restore = function () {
    var q = new URLSearchParams(location.search);
    var eng = q.get("lfxd_engraving");
    var sel = null;
    if (q.get("lfxd")) {
      try {
        var b64 = q.get("lfxd").replace(/-/g, "+").replace(/_/g, "/");
        sel = JSON.parse(decodeURIComponent(escape(atob(b64))));
      } catch (e) { sel = null; }
    }
    if (sel && typeof sel === "object") {
      Object.keys(sel).forEach(function (id) {
        var v = String(sel[id]);
        try {
          if (id === "lfxEngraving") { eng = v; return; }
          var pill = Array.prototype.find.call(document.querySelectorAll('[data-option-slider="' + id + '"] [data-option-value]'), function (p) { return p.dataset.optionValue === v; });
          if (pill) { pill.click(); return; }
          var dr = document.querySelector('[data-discrete-range="' + id + '"]');
          if (dr) {
            var idx = String(dr.dataset.rangeValues || "").split("|").indexOf(v);
            if (idx > -1) { dr.value = String(idx); dr.dispatchEvent(new Event("input", { bubbles: true })); }
            return;
          }
          var sr = document.querySelector('[data-size-range="' + id + '"]');
          if (sr) { var n = parseFloat(v); if (isFinite(n)) { sr.value = String(n); sr.dispatchEvent(new Event("input", { bubbles: true })); } }
        } catch (e) { /* ignore a value that no longer exists */ }
      });
    }
    var box = document.getElementById("lfxEngraving");
    if (box && eng) { box.value = cleanEngraving(eng); box.dispatchEvent(new Event("input", { bubbles: true })); }
  };

  // ---- Save box ----
  var build = function (anchor) {
    var wrap = document.createElement("div");
    wrap.className = "field field--full lfx-save";
    wrap.innerHTML =
      '<h3>Save your design</h3>' +
      '<p class="lfx-save__intro">Keep your choices and come back to them any time. We will email you a sign-in link, no password needed.</p>' +
      '<div class="lfx-save__row"><input type="email" class="lfx-save__email" placeholder="Your email address" autocomplete="email" inputmode="email" aria-label="Your email address"><button type="button" class="lfx-save__btn">Save my design</button></div>' +
      '<label class="lfx-save__opt"><input type="checkbox" class="lfx-save__mkt"> <span>Send me the occasional LADFOX update (optional)</span></label>' +
      '<p class="lfx-save__msg" role="status" aria-live="polite"></p>';
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);

    var emailEl = wrap.querySelector(".lfx-save__email"), btn = wrap.querySelector(".lfx-save__btn"),
        mkt = wrap.querySelector(".lfx-save__mkt"), msg = wrap.querySelector(".lfx-save__msg"),
        intro = wrap.querySelector(".lfx-save__intro"), row = wrap.querySelector(".lfx-save__row"),
        opt = wrap.querySelector(".lfx-save__opt");
    var signedIn = false;

    post({ action: "status" }).then(function (x) {
      if (x.ok && x.d.signedIn) {
        signedIn = true;
        emailEl.hidden = true; opt.hidden = true;
        intro.textContent = "Save this design to your LADFOX account so you can come back to it, or order it later.";
        btn.textContent = "Save to my account";
      }
    }).catch(function () { /* stays in signed-out mode */ });

    btn.addEventListener("click", function () {
      var email = emailEl.value.trim();
      if (!signedIn && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        msg.textContent = "Please enter a valid email address."; emailEl.focus(); return;
      }
      var sel = collect();
      if (Object.keys(sel).length < 3) { msg.textContent = "Choose some options first."; return; }
      btn.disabled = true; msg.textContent = "Saving…";
      var h1 = document.querySelector("h1");
      post({
        action: "save", email: email, page: pageFile, selections: sel,
        title: (h1 ? h1.textContent.replace(/\s+/g, " ").trim() : "My LADFOX ring"),
        summary: summary(), price: priceText(), marketing: mkt.checked, attribution: attribution()
      }).then(function (x) {
        if (x.ok) {
          row.hidden = true; opt.hidden = true;
          msg.innerHTML = signedIn
            ? 'Saved. <a href="/account">View my saved designs</a>'
            : "Saved. Check your inbox for a link to sign in and see your design.";
          if (window.gtag) { try { window.gtag("event", "generate_lead", { form_name: "save-design" }); } catch (e) { /* ignore */ } }
        } else {
          btn.disabled = false;
          msg.textContent = (x.d && x.d.error) || "Something went wrong. Please try again.";
        }
      }).catch(function () { btn.disabled = false; msg.textContent = "We could not save that just now. Please try again."; });
    });
  };

  var tries = 0;
  var timer = setInterval(function () {
    tries += 1;
    var anchor = document.querySelector(".lfx-engraving-field");
    if (anchor && !document.querySelector(".lfx-save")) { clearInterval(timer); build(anchor); setTimeout(restore, 350); }
    else if (tries > 40) clearInterval(timer);
  }, 150);
})();
