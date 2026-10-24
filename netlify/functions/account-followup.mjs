import {
  getDb, sha, newToken, escapeHtml, sendEmail, plainShell, getCustomer, listProjects, followKey, LOGIN_TTL_MS
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

export default async () => {
  const db = await getDb();
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
