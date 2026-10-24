// LADFOX sheet logging: saved designs, sign-ups, requests and a tab per customer.
// SETUP (once, or again after replacing this file):
// 1. Open your sheet > Extensions > Apps Script, paste this whole file over the old one, save.
// 2. Project Settings (gear) > Script properties: SECRET = your long random phrase (keep the existing one).
// 3. Deploy > Manage deployments > pencil (edit) > Version: New version > Deploy. (First time: Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone.)
// 4. Netlify > Environment variables: GOOGLE_SHEET_WEBHOOK_URL = the Web app URL, GOOGLE_SHEET_SECRET = the same phrase. Redeploy.
// 5. For customer tabs: right-click your "Ben" tab > Duplicate, rename the copy to  Template , and clear the customer details
//    (keep the layout and the Progress checkboxes). Each new design request will copy that tab and name it after the customer.

var SHEET_ID = "1U0SUVywwcF98zBUfxVhNslDZuAvKScd1bQbqz75DuR8";
var SAVED_TAB = "Saved designs";
var SAVED_HEADERS = ["Saved at", "Email", "Name", "Product page", "Title", "Summary", "Price", "Selections", "Resume link", "OK to email offers", "utm_source", "utm_campaign", "gclid"];

function safe(v) { v = String(v == null ? "" : v); return /^[=+\-@]/.test(v) ? "'" + v : v; } // stop spreadsheet formulas

function tab(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sh;
}

function detail(details, label) {
  var m = String(details || "").match(new RegExp("^" + label + ":\\s*(.+)$", "mi"));
  return m ? m[1].trim() : "";
}

function customerTab(ss, d) {
  var tpl = ss.getSheetByName("Template");
  if (!tpl) return "";
  var base = String(d.name || d.email || "Customer").replace(/[\[\]\*\?\:\\\/]/g, "").trim().slice(0, 40) || "Customer";
  var name = base, n = 2;
  while (ss.getSheetByName(name)) { name = base + " " + n++; }
  var sh = tpl.copyTo(ss).setName(name);
  try {
    sh.getRange("F2:F9").setValue(false); // reset the Progress checkboxes
    sh.getRange("D4").setValue(safe(detail(d.details, "Ring size")));
    sh.getRange("D5").setValue(safe(detail(d.details, "Metal")));
    sh.getRange("D3").setValue("Bobby");
    sh.getRange("D2").setValue("UK");
  } catch (e) {}
  return name;
}

// Finds the customer's tab from the Requests tab (newest match on email + title).
function tabForCustomer(ss, email, title) {
  var req = ss.getSheetByName("Requests");
  if (!req || req.getLastRow() < 2) return null;
  var rows = req.getRange(2, 1, req.getLastRow() - 1, 8).getValues();
  email = String(email || "").toLowerCase(); title = String(title || "");
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][2]).toLowerCase() === email && (!title || String(rows[i][3]) === title) && rows[i][7]) {
      var sh = ss.getSheetByName(String(rows[i][7]));
      if (sh) return sh;
    }
  }
  return null;
}

// Writes the price into the cell to the right of a cell labelled "Price" (searches the top of the tab).
function writePrice(sh, price) {
  var vals = sh.getRange(1, 1, 20, 8).getValues();
  for (var r = 0; r < vals.length; r++) {
    for (var c = 0; c < vals[r].length; c++) {
      if (/^\s*(ring\s+)?price\b/i.test(String(vals[r][c]))) { sh.getRange(r + 1, c + 2).setValue(Number(price)); return true; }
    }
  }
  return false;
}

function doPost(e) {
  var out = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  try {
    var d = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty("SECRET");
    if (!secret || d.secret !== secret) return out({ ok: false, error: "unauthorised" });
    var ss = SpreadsheetApp.openById(SHEET_ID);

    if (d.type === "signup") {
      tab(ss, "Sign-ups", ["Signed up", "Name", "Email", "Came from", "Contacted?"])
        .appendRow([d.createdAt, safe(d.name), safe(d.email), safe(d.intent), false]);
      return out({ ok: true });
    }

    if (d.type === "progress") {
      var sh = tabForCustomer(ss, d.email, d.title);
      if (!sh) return out({ ok: true, note: "no customer tab" });
      // Progress checkboxes F2:F9, in order: Sketch sent, Sketch approved, Price sent, Price approved,
      // CAD sent, CAD approved, Payment details sent, Paid.
      if (typeof d.progress === "number") {
        var n = Math.max(0, Math.min(8, d.progress)), vals = [];
        for (var i = 0; i < 8; i++) vals.push([i < n]);
        sh.getRange("F2:F9").setValues(vals);
      }
      var priced = d.price ? writePrice(sh, d.price) : null;
      return out({ ok: true, priceWritten: priced });
    }

    if (d.type === "request") {
      tab(ss, "Requests", ["Received", "Name", "Email", "Title", "Piece", "Budget", "Details", "Customer tab"])
        .appendRow([d.createdAt, safe(d.name), safe(d.email), safe(d.title), safe(d.ringType), safe(d.budget), safe(d.details), safe(customerTab(ss, d))]);
      return out({ ok: true });
    }

    // default: saved design from the ring pages
    tab(ss, SAVED_TAB, SAVED_HEADERS).appendRow([
      d.createdAt, safe(d.email), safe(d.name), safe(d.product), safe(d.title), safe(d.summary), safe(d.price),
      safe(JSON.stringify(d.selections || {})), safe(d.resumeUrl), d.marketingOptIn, safe(d.utm_source), safe(d.utm_campaign), safe(d.gclid)
    ]);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}
