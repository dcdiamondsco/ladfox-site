import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const STAGES = [
  "Enquiry received",
  "Complimentary sketch created",
  "Payment received",
  "Design in progress",
  "Design approved",
  "In production",
  "Quality check",
  "Dispatched",
  "Delivered"
];

// Stage positions (keep in step with STAGES above and the list in account.html).
export const STAGE_PAID = 2;
export const STAGE_DESIGN = 3;
export const STAGE_APPROVED = 4;

export const LOGIN_TTL_MS = 20 * 60 * 1000;
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

export const emailShell = (heading, bodyHtml, buttonLabel, buttonUrl) => `<!doctype html><html><body style="margin:0;background:#f4f2ee;font-family:Arial,Helvetica,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:14px;padding:32px">
<tr><td style="font-size:13px;letter-spacing:.18em;font-weight:700">LADFOX</td></tr>
<tr><td style="font-size:22px;font-weight:600;padding:18px 0 10px">${escapeHtml(heading)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#333">${bodyHtml}</td></tr>
${buttonUrl ? `<tr><td style="padding:24px 0 6px"><a href="${escapeHtml(buttonUrl)}" style="background:#111;color:#fff;text-decoration:none;padding:13px 22px;border-radius:999px;font-size:14px;font-weight:600;display:inline-block">${escapeHtml(buttonLabel)}</a></td></tr>` : ""}
<tr><td style="font-size:12px;color:#777;padding-top:22px">LADFOX Ltd &middot; hello@ladfox.com</td></tr>
</table></td></tr></table></body></html>`;

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
  files: p.files || [], payments: p.payments || [], amountTotal: p.amountTotal, stage: p.stage, estimate: p.estimate,
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
