import { sha, clean } from "./account-lib.mjs";

export const PAGES = new Set(["classic-solitaire.html", "signature-solitaire.html", "trilogy-ring.html"]);
export const designPrefix = (email) => `designs/${sha(email)}/`;
export const MAX_DESIGNS_PER_CUSTOMER = 30;

// Existing configurator pages already understand these query parameters.
const QUERY_MAP = {
  signatureSetting: "setting", signatureTrilogyDesign: "trilogy_design", signatureMetalBase: "metal_base",
  signatureMetalKarat: "metal_karat", signatureStoneType: "stone_type", signatureShape: "shape",
  signatureElongated: "elongated", signatureGemstone: "gemstone_type", signatureColour: "colour",
  signatureStoneSize: "stone_size", signatureClarity: "clarity", signatureRingSize: "size"
};

export const cleanSelections = (input) => {
  const out = {};
  if (!input || typeof input !== "object") return out;
  let n = 0;
  for (const [k, v] of Object.entries(input)) {
    if (n >= 40) break;
    if (!/^[A-Za-z][A-Za-z0-9_]{1,40}$/.test(k)) continue;
    if (typeof v !== "string" && typeof v !== "number") continue;
    const value = k === "lfxEngraving"
      ? clean(v, 40).replace(/[^A-Za-z0-9 &.,'\u2019\-\/]/g, "").replace(/\s+/g, " ").trim().slice(0, 20)
      : clean(v, 80);
    if (value) { out[k] = value; n += 1; }
  }
  return out;
};

export const resumeUrl = (page, selections) => {
  if (page === "trilogy-ring.html") {
    const packed = Buffer.from(JSON.stringify(selections)).toString("base64url");
    return `/${page}?lfxd=${packed}`;
  }
  const q = new URLSearchParams();
  for (const [id, param] of Object.entries(QUERY_MAP)) {
    if (!selections[id]) continue;
    q.set(param, id === "signatureStoneSize" ? String(Number.parseFloat(selections[id]) || "") : selections[id]);
  }
  if (selections.lfxEngraving) q.set("lfxd_engraving", selections.lfxEngraving);
  return `/${page}?${q.toString()}`;
};

export const publicDesign = (d) => ({
  id: d.id, title: d.title, summary: d.summary, price: d.price, page: d.page,
  resumeUrl: resumeUrl(d.page, d.selections), createdAt: d.createdAt
});

export const listDesigns = async (db, email) => {
  const { blobs } = await db.list({ prefix: email ? designPrefix(email) : "designs/" });
  const rows = await Promise.all(blobs.map((b) => db.get(b.key, { type: "json" })));
  return rows.filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

// Adds a row to the Google Sheet through the Apps Script web app (see google-sheet-apps-script.gs).
export const pushToSheet = async (design) => {
  const url = String(process.env.GOOGLE_SHEET_WEBHOOK_URL || "").trim();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        secret: String(process.env.GOOGLE_SHEET_SECRET || ""),
        createdAt: design.createdAt, email: design.email, name: design.name || "", product: design.page,
        title: design.title, summary: design.summary, price: design.price || "",
        selections: design.selections, resumeUrl: design.resumeAbsolute || "",
        marketingOptIn: design.marketing ? "yes" : "no",
        utm_source: design.attribution?.utm_source || "", utm_campaign: design.attribution?.utm_campaign || "",
        gclid: design.attribution?.gclid || ""
      }),
      signal: AbortSignal.timeout(6000)
    });
    return res.ok;
  } catch (error) {
    console.error("sheet push failed", error.message);
    return false;
  }
};
