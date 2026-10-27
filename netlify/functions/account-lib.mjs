import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const STAGES = [
  "Enquiry received",
  "Initial design created",
  "Payment received",
  "CAD in progress",
  "CAD approved",
  "In production",
  "Quality check",
  "Dispatched",
  "Delivered"
];

// Stage positions (keep in step with STAGES above and the list in account.html).
export const STAGE_PAID = 2;
export const STAGE_DESIGN = 3;
export const STAGE_DISPATCHED = 7;
export const STAGE_APPROVED = 4;

export const LOGIN_TTL_MS = 365 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const COOKIE_NAME = "lfx_session";

export const getDb = async () => {
  if (globalThis.__LADFOX_TEST_STORE) return globalThis.__LADFOX_TEST_STORE;
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "ladfox-accounts", consistency: "strong" });
};

export const sha = (value) => createHash("sha256").update(String(value)).digest("hex");
export const newToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const normaliseEmail = (value) => String(value || "").trim().toLowerCase();
export const validEmail = (value) => value.length <= 254 && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(value);
export const clean = (value, max) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);

export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export const siteUrl = (request) => {
  const configured = String(process.env.SITE_URL || "").trim();
  return new URL(configured || new URL(request.url).origin).origin;
};

export const readCookie = (request, name) => {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
};

export const sessionCookie = (value, maxAgeSeconds) =>
  `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;

export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- email: Google Workspace SMTP (preferred) or Resend ---------- */
const emailError = (message, code) => { const e = new Error(message); e.code = code; return e; };

export const sendEmail = async ({ to, subject, text, html }) => {
  const smtpUser = String(process.env.SMTP_USER || "").trim();
  const smtpPass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const resendKey = String(process.env.RESEND_API_KEY || "").trim();
  const replyTo = "hello@ladfox.com";

  if (smtpUser && smtpPass) {
    const from = String(process.env.EMAIL_FROM || `LADFOX <${smtpUser}>`).trim();
    let transport = globalThis.__LADFOX_TEST_MAIL;
    if (!transport) {
      const mod = await import("nodemailer");
      const nodemailer = mod.default || mod;
      transport = nodemailer.createTransport({
        host: String(process.env.SMTP_HOST || "smtp.gmail.com").trim(),
        port: 465,
        secure: true,
        auth: { user: smtpUser, pass: smtpPass }
      });
    }
    await transport.sendMail({ from, to, subject, text, html, replyTo });
    return;
  }

  if (resendKey) {
    const from = String(process.env.EMAIL_FROM || "LADFOX <hello@ladfox.com>").trim();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, html, reply_to: replyTo })
    });
    if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}.`);
    return;
  }

  throw emailError("Email is not configured.", "email_not_configured");
};

/* Plain black layout: logo, text, buttons. No card, no borders. Used for customer-facing emails. */
const BLACK_IMG = "https://ladfox.com/Images/email-black.png";
export const plainShell = (heading, bodyHtml, buttons) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"></head>
<body style="margin:0;padding:0;background:#000000;font-family:Arial,Helvetica,sans-serif;color:#ffffff" bgcolor="#000000">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" background="${BLACK_IMG}" style="background:#000000 url(${BLACK_IMG});background-color:#000000"><tr><td align="center" bgcolor="#000000" background="${BLACK_IMG}" style="padding:40px 22px 36px;background:#000000 url(${BLACK_IMG});background-color:#000000">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">
<tr><td align="center" style="padding:0 0 34px"><img src="https://ladfox.com/Images/ladfox-email-logo.png" width="200" alt="LADFOX" style="display:block;border:0;height:auto;width:200px;max-width:60%"></td></tr>
<tr><td align="center" style="font-size:26px;line-height:1.3;font-weight:700;color:#ffffff;padding:0 0 14px">${escapeHtml(heading)}</td></tr>
<tr><td align="center" style="font-size:17px;line-height:1.65;color:#d6d9df">${bodyHtml}</td></tr>
${buttons ? `<tr><td align="center" style="padding:30px 0 0">${buttons}</td></tr>` : ""}
<tr><td align="center" style="font-size:12px;color:#8b9099;padding:44px 10px 0">LADFOX Ltd &middot; <a href="mailto:hello@ladfox.com" style="color:#8b9099;text-decoration:none">hello@ladfox.com</a></td></tr>
</table></td></tr></table></body></html>`;

export const emailShell = (heading, bodyHtml, buttonLabel, buttonUrl, opts = {}) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#000000;font-family:Arial,Helvetica,sans-serif;color:#ffffff" bgcolor="#000000">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background:#000000"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
<tr><td align="center" bgcolor="#000000" style="padding:6px 0 26px;background:#000000"><img src="https://ladfox.com/Images/Logo%20no%20background.png?v=3" width="150" alt="LADFOX" style="display:block;border:0;height:auto;width:150px;max-width:60%"></td></tr>
<tr><td bgcolor="#111113" style="background:#111113;border-radius:20px;padding:36px 30px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="font-size:26px;line-height:1.25;font-weight:700;color:#ffffff;padding:0 0 14px">${escapeHtml(heading)}</td></tr>
<tr><td align="center" style="font-size:16px;line-height:1.65;color:#d6d9df">${bodyHtml}</td></tr>
${buttonUrl ? `<tr><td align="center" style="padding:30px 0 8px"><a href="${escapeHtml(buttonUrl)}" style="background:#dfe3ea;color:#0a0a0a;text-decoration:none;padding:16px 38px;border-radius:999px;font-size:16px;font-weight:700;display:inline-block">${escapeHtml(buttonLabel)}</a></td></tr>
${opts.hideLink ? "" : `<tr><td align="center" style="font-size:12px;line-height:1.5;color:#8b9099;padding:14px 0 0">Button not working? Copy this link into your browser:<br><a href="${escapeHtml(buttonUrl)}" style="color:#c8ccd4;word-break:break-all">${escapeHtml(buttonUrl)}</a></td></tr>`}` : ""}
${opts.extraHtml ? `<tr><td align="center" style="padding:22px 0 0">${opts.extraHtml}</td></tr>` : ""}
</table></td></tr>
<tr><td align="center" style="font-size:13px;line-height:1.7;color:#c8ccd4;padding:26px 10px 4px">&#10003; Lifetime warranty &nbsp;&nbsp; &#10003; Insured UK delivery &nbsp;&nbsp; &#10003; Free engraving</td></tr>
<tr><td align="center" style="font-size:14px;line-height:1.7;color:#d6d9df;padding:12px 10px 0">Questions? Message us on <a href="https://wa.me/447853362904" style="color:#ffffff;font-weight:600">WhatsApp</a> or reply to this email.</td></tr>
<tr><td align="center" style="font-size:12px;color:#8b9099;padding:20px 10px 0">LADFOX Ltd &middot; <a href="mailto:hello@ladfox.com" style="color:#8b9099">hello@ladfox.com</a></td></tr>
</table></td></tr></table></body></html>`;

/* ---------- Google Sheet logging (Apps Script web app) ---------- */
export const sheetEvent = async (payload) => {
  const url = String(process.env.GOOGLE_SHEET_WEBHOOK_URL || "").trim();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: String(process.env.GOOGLE_SHEET_SECRET || ""), createdAt: new Date().toISOString(), ...payload }),
      signal: AbortSignal.timeout(7000)
    });
    return res.ok;
  } catch (error) {
    console.error("sheet event failed", error.message);
    return false;
  }
};

/* ---------- data access ---------- */
export const customerKey = (email) => `customers/${sha(email)}`;
export const draftKey = (email) => `drafts/${sha(email)}`;
export const projectPrefix = (email) => `projects/${sha(email)}/`;

export const getCustomer = async (db, email) => db.get(customerKey(email), { type: "json" });

export const upsertCustomer = async (db, email, fields = {}) => {
  const existing = (await getCustomer(db, email)) || { email, createdAt: new Date().toISOString() };
  const next = { ...existing, email };
  for (const [k, v] of Object.entries(fields)) if (v) next[k] = v;
  await db.setJSON(customerKey(email), next);
  return next;
};

export const listProjects = async (db, email) => {
  const { blobs } = await db.list({ prefix: email ? projectPrefix(email) : "projects/" });
  const rows = await Promise.all(blobs.map((b) => db.get(b.key, { type: "json" })));
  return rows.filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const saveProject = (db, project) => db.setJSON(`${projectPrefix(project.email)}${project.id}`, project);
export const loadProject = (db, email, id) => db.get(`${projectPrefix(email)}${id}`, { type: "json" });

export const createProject = async (db, fields) => {
  const now = new Date().toISOString();
  const project = {
    id: newToken(9),
    email: fields.email,
    name: fields.name || "",
    type: fields.type || "design-request",
    title: clean(fields.title, 140) || "Your ring",
    details: clean(fields.details, 3000),
    ringType: clean(fields.ringType, 80),
    budget: clean(fields.budget, 80),
    orderReference: clean(fields.orderReference, 80),
    standard: fields.standard === true,
    files: [],
    payments: [],
    amountTotal: Number.isFinite(fields.amountTotal) ? fields.amountTotal : null,
    stage: Number.isInteger(fields.stage) ? fields.stage : 0,
    estimate: "",
    createdAt: now,
    updatedAt: now,
    updates: [{ at: now, by: "ladfox", text: fields.firstUpdate || "We have received your enquiry and will be in touch shortly.", stage: Number.isInteger(fields.stage) ? fields.stage : 0 }]
  };
  await saveProject(db, project);
  return project;
};

export const publicProject = (p) => ({
  id: p.id, type: p.type, title: p.title, details: p.details, ringType: p.ringType, budget: p.budget,
  orderReference: p.orderReference, standard: p.standard === true,
  files: p.files || [], payments: p.payments || [], amountTotal: p.amountTotal, stage: p.stage, estimate: p.estimate, trackingUrl: p.trackingUrl || "", videoUrl: p.videoUrl || "",
  videos: videosOf(p).map((v) => ({ id: v.id, name: v.name, type: v.type, size: v.size })),
  createdAt: p.createdAt, updatedAt: p.updatedAt, updates: p.updates
});

/* ---------- sessions ---------- */
export const getSession = async (db, request) => {
  const id = readCookie(request, COOKIE_NAME);
  if (!id || id.length > 100) return null;
  const record = await db.get(`sessions/${sha(id)}`, { type: "json" });
  if (!record || record.exp < Date.now()) return null;
  return record;
};

/* ---------- design files and payments ---------- */
export const FILE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILES_PER_PROJECT = 30;
export const VIDEO_CHUNK = 3 * 1024 * 1024;
export const VIDEO_MAX_CHUNKS = 20; // 60 MB
export const videoPrefix = (email, projectId, vid) => `videos/${sha(email)}/${projectId}/${vid}/`;
export const sniffVideo = (buf) => {
  if (buf.length > 12 && buf.slice(4, 8).toString("latin1") === "ftyp") return buf.slice(8, 12).toString("latin1").startsWith("qt") ? "video/quicktime" : "video/mp4";
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  return "";
};
export const VIDEOS_MAX = 6;
export const videosOf = (p) => (Array.isArray(p.videos) ? p.videos : p.video ? [p.video] : []);
export const dropVideo = async (db, email, project, onlyId) => {
  const all = videosOf(project);
  for (const v of all) {
    if (onlyId && v.id !== onlyId) continue;
    const { blobs } = await db.list({ prefix: videoPrefix(email, project.id, v.id) });
    await Promise.all(blobs.map((b) => db.delete(b.key).catch(() => {})));
  }
  project.videos = onlyId ? all.filter((v) => v.id !== onlyId) : [];
  project.video = null;
};
export const fileKey = (email, projectId, fileId) => `files/${sha(email)}/${projectId}/${fileId}`;

// Checks the real bytes, not just the name or declared type the browser sent.
export const sniffType = (buf) => {
  if (buf.length > 4 && buf.slice(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.slice(0, 4).toString("latin1") === "RIFF" && buf.slice(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return "";
};

export const PAYMENT_MIN_PENCE = 100;
export const PAYMENT_MAX_PENCE = 5_000_000;

export const getStripe = async () => {
  if (globalThis.__LADFOX_TEST_STRIPE) return globalThis.__LADFOX_TEST_STRIPE;
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return null;
  const { default: Stripe } = await import("stripe");
  return new Stripe(key);
};

export const emailCustomerNote = async (request, project, subject, heading, bodyHtml, bodyText) => {
  await sendEmail({
    to: project.email,
    subject,
    text: `${bodyText}\n\n${siteUrl(request)}/account`,
    html: emailShell(heading, bodyHtml, "Open my account", `${siteUrl(request)}/account`)
  });
};

/* ---------- delayed "continue your design" follow-up ---------- */
export const FOLLOWUP_DELAY_MS = 30 * 60 * 1000;
export const followKey = (email) => `followups/${sha(email)}`;

/* ---------- who is on the site (read by the admin page) ---------- */
export const recordVisit = async (db, email, kind) => {
  try {
    const c = await getCustomer(db, email);
    if (!c) return;
    const now = Date.now(), iso = new Date(now).toISOString();
    const last = c.lastSeenAt ? Date.parse(c.lastSeenAt) : 0;
    if (kind === "login") {
      await db.setJSON(customerKey(email), { ...c, lastLoginAt: iso, lastSeenAt: iso, loginCount: (c.loginCount || 0) + 1, logins: [...(c.logins || []).slice(-19), iso] });
    } else if (now - last > 120000) {
      await db.setJSON(customerKey(email), { ...c, lastSeenAt: iso });
    }
  } catch (error) { console.error("visit record failed", error.message); }
};
