// LADFOX saved designs -> Google Sheet
// 1. Open your sheet > Extensions > Apps Script, paste this whole file, save.
// 2. Project Settings (gear) > Script properties > add  SECRET  = a long random phrase you make up.
// 3. Deploy > New deployment > type "Web app" > Execute as: Me > Who has access: Anyone > Deploy. Copy the Web app URL.
// 4. In Netlify > Site settings > Environment variables add:
//      GOOGLE_SHEET_WEBHOOK_URL = the Web app URL
//      GOOGLE_SHEET_SECRET      = the same SECRET phrase
//    then redeploy. A new tab called "Saved designs" is created automatically on the first save.

var SHEET_ID = "1U0SUVywwcF98zBUfxVhNslDZuAvKScd1bQbqz75DuR8";
var TAB = "Saved designs";
var HEADERS = ["Saved at", "Email", "Name", "Product page", "Title", "Summary", "Price", "Selections", "Resume link", "OK to email offers", "utm_source", "utm_campaign", "gclid"];

function doPost(e) {
  var out = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  try {
    var d = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty("SECRET");
    if (!secret || d.secret !== secret) return out({ ok: false, error: "unauthorised" });

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sh = ss.getSheetByName(TAB);
    if (!sh) {
      sh = ss.insertSheet(TAB);
      sh.appendRow(HEADERS);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    }
    var safe = function (v) { v = String(v == null ? "" : v); return /^[=+\-@]/.test(v) ? "'" + v : v; }; // stop spreadsheet formulas
    sh.appendRow([
      d.createdAt, safe(d.email), safe(d.name), safe(d.product), safe(d.title), safe(d.summary), safe(d.price),
      safe(JSON.stringify(d.selections || {})), safe(d.resumeUrl), d.marketingOptIn, safe(d.utm_source), safe(d.utm_campaign), safe(d.gclid)
    ]);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}
