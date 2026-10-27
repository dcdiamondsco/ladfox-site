// LADFOX sheet logging: saved designs and a new tab for every new enquiry (no separate Requests / Sign-ups tabs).
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
  var base = String(d.name || d.email || "Customer").replace(/[\[\]\*\?\:\\\/]/g, "").trim().slice(0, 40) || "Customer";
  var name = base, n = 2;
  while (ss.getSheetByName(name)) { name = base + " " + n++; }
  if (!tpl) {
    // No Template tab yet: build a plain enquiry tab so nothing is lost.
    var np = ss.insertSheet(name);
    var rows = [["Received", d.createdAt], ["Name", safe(d.name)], ["Email", safe(d.email)], ["Title", safe(d.title)],
      ["Piece", safe(d.ringType)], ["Budget", safe(d.budget)], ["Ring for", safe(d.ringFor)], ["Details", safe(d.details)]];
    np.getRange(1, 1, rows.length, 2).setValues(rows);
    np.getRange(1, 1, rows.length, 1).setFontWeight("bold");
    np.setColumnWidth(1, 110); np.setColumnWidth(2, 520);
    np.getRange(1, 2, rows.length, 1).setWrap(true).setVerticalAlignment("top");
    return name;
  }
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

function doPost(e) {
  var out = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  try {
    var d = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty("SECRET");
    if (!secret || d.secret !== secret) return out({ ok: false, error: "unauthorised" });
    var ss = SpreadsheetApp.openById(SHEET_ID);

    // Sign-ups are no longer logged to their own tab (the enquiry tab below is created when they send a request).
    if (d.type === "signup" || d.type === "price") return out({ ok: true });

    // Every new enquiry becomes its own tab, named after the customer.
    if (d.type === "request") {
      return out({ ok: true, tab: customerTab(ss, d) });
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
