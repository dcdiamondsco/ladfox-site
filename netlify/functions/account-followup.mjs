import {
  getDb, sha, newToken, escapeHtml, sendEmail, plainShell, getCustomer, listProjects, saveProject, followKey, LOGIN_TTL_MS
} from "./account-lib.mjs";

/* Runs every 10 minutes. Sends ONE follow-up to anyone who signed up on the site,
   then left without submitting a design request. Skips anyone who has submitted
   or who has been on their account page in the last 15 minutes. */
export const config = { schedule: "*/10 * * * *" };

const SITE = "https://ladfox.com";
const WA = "https://wa.me/447853362904";
const CALL = "tel:+447853362904";

const btn = (href, label, solid) =>
  `<a href="${href}" style="display:inline-block;margin:5px 4px;padding:13px 26px;border-radius:999px;font-size:15px;font-weight:700;text-decoration:none;${solid ? "background:#dfe3ea;color:#0a0a0a" : "background:#26272b;color:#ffffff"}">${label}</a>`;

export const buildFollowUp = (name, link) => {
  const first = String(name || "").trim().split(/\s+/)[0];
  const hi = first ? `Hi ${first},` : "Hi there,";
  const body = `<p style="margin:0">Your account is set up for when you would like to continue.</p><p style="margin:16px 0 0">Your personal design page is open and waiting. Pick up exactly where you left off.</p>`;
  const buttons = `${btn(link, "Continue my design", true)}<p style="margin:30px 0 8px;font-size:14px;color:#8b9099">Prefer to talk it through?</p>${btn(WA, "WhatsApp us")}${btn(CALL, "Call us")}`;
  const text = `${hi}\n\nYour account is set up for when you would like to continue.\n\nYour personal design page is open and waiting. Pick up exactly where you left off.\n\nContinue your design:\n${link}\n\nPrefer to talk it through? WhatsApp us: ${WA}\nOr reply to this email.\n\nLADFOX`;
  return { text, html: plainShell(hi, body, buttons) };
};

/* One friendly nudge, 3 days after a design request, if we have not heard back (and we have not started on it). */
const NUDGE_AFTER_MS = 72 * 3600_000, NUDGE_WINDOW_MS = 14 * 24 * 3600_000;
export const buildNudge = (name, link) => {
  const first = String(name || "").trim().split(/\s+/)[0];
  const hi = first ? `Hi ${first},` : "Hi there,";
  const body = `<p style="margin:0">It is Lydia from LADFOX. We would love to get started on your design, and all we need is a little steer from you.</p><p style="margin:16px 0 0">A one-word reply is plenty. Even just <strong style="color:#fff">hello</strong>, <strong style="color:#fff">oval</strong> or <strong style="color:#fff">not sure yet</strong> helps us begin.</p><p style="margin:16px 0 0">No pressure at all. If now is not the right time, just tell us and we will pop it aside until you are ready.</p>`;
  const buttons = `${btn(link, "Open my design page", true)}<p style="margin:30px 0 8px;font-size:14px;color:#8b9099">Quicker to chat?</p>${btn(WA, "WhatsApp us")}${btn(CALL, "Call us")}`;
  const text = `${hi}\n\nIt is Lydia from LADFOX. We would love to get started on your design, and all we need is a little steer from you.\n\nA one-word reply is plenty. Even just "hello", "oval" or "not sure yet" helps us begin.\n\nNo pressure at all. If now is not the right time, just tell us and we will pop it aside until you are ready.\n\nYour design page:\n${link}\n\nQuicker to chat? WhatsApp us: ${WA}\nOr call us: tel:+447853362904\n\nWarm regards,\nLydia, LADFOX`;
  return { text, html: plainShell(hi, body, buttons) };
};

const nudgeQuietEnquiries = async (db) => {
  const projects = await listProjects(db);
  for (const p of projects) {
    try {
      if (p.type !== "design-request" || p.stage !== 0 || p.replied || p.nudgedAt) continue;
      const age = Date.now() - Date.parse(p.createdAt);
      if (!(age >= NUDGE_AFTER_MS && age <= NUDGE_WINDOW_MS)) continue;
      const customer = (await getCustomer(db, p.email)) || {};
      const token = newToken();
      await db.setJSON(`logins/${sha(token)}`, { email: p.email, exp: Date.now() + LOGIN_TTL_MS });
      const link = `${SITE}/account?token=${encodeURIComponent(token)}`;
      const mail = buildNudge(customer.name || p.name, link);
      p.nudgedAt = new Date().toISOString();
      await saveProject(db, p); // mark first so a send failure can never produce a second nudge
      await sendEmail({ to: p.email, subject: "A quick question about your ring", ...mail });
    } catch (error) {
      console.error("nudge failed", p && p.id, error.message);
    }
  }
};

export default async () => {
  const db = await getDb();
  await nudgeQuietEnquiries(db);
  const { blobs } = await db.list({ prefix: "followups/" });
  for (const b of blobs) {
    try {
      const rec = await db.get(b.key, { type: "json" });
      if (!rec || !rec.email) { await db.delete(b.key); continue; }
      if (rec.due > Date.now()) continue;
      if (Date.now() - (rec.seen || 0) < 15 * 60_000) continue;

      const projects = await listProjects(db, rec.email);
      if (projects.length) { await db.delete(b.key); continue; }

      const customer = (await getCustomer(db, rec.email)) || {};
      const token = newToken();
      await db.setJSON(`logins/${sha(token)}`, { email: rec.email, exp: Date.now() + LOGIN_TTL_MS });
      const start = rec.kind === "design" || rec.kind === "price" ? `&start=${rec.kind}` : "";
      const link = `${SITE}/account?token=${encodeURIComponent(token)}${rec.kind === "sketch" ? "&new=1" : ""}${start}`;
      const mail = buildFollowUp(rec.name || customer.name, link);
      await sendEmail({ to: rec.email, subject: "Your LADFOX design is waiting", ...mail });
      await db.delete(b.key);
    } catch (error) {
      console.error("follow-up failed", b.key, error.message);
    }
  }
};
