import {
  getDb, sha, newToken, escapeHtml, sendEmail, emailShell, getCustomer, listProjects, followKey, LOGIN_TTL_MS
} from "./account-lib.mjs";

/* Runs every 10 minutes. Sends ONE follow-up to anyone who signed up on the site,
   then left without submitting a design request. Skips anyone who has submitted
   or who has been on their account page in the last 15 minutes. */
export const config = { schedule: "*/10 * * * *" };

const SITE = "https://ladfox.com";
const WA = "https://wa.me/447853362904";
const CALL = "tel:+447853362904";

const btn = (href, label, solid, green) =>
  `<a href="${href}" style="display:inline-block;margin:5px 4px;padding:13px 26px;border-radius:999px;font-size:15px;font-weight:700;text-decoration:none;${green ? "background:#25D366;color:#0a0a0a" : solid ? "background:#dfe3ea;color:#0a0a0a" : "background:#1c1d21;color:#ffffff"}">${label}</a>`;

export const buildFollowUp = (name, link) => {
  const first = String(name || "").trim().split(/\s+/)[0];
  const hi = "Your";
  const steps = [["1", "Tell us about your ring", "Takes about two minutes."], ["2", "We create your initial design", "Complimentary, with a clear quote. No obligation."], ["3", "Approve it and we handcraft it", "Follow every step from your account until it reaches you."]]
    .map(([n, t, d]) => `<tr><td valign="top" style="padding:7px 12px 7px 0;font-size:20px;font-weight:700;color:#dfe3ea">${n}</td><td align="left" style="padding:7px 0;font-size:15px;line-height:1.5;color:#ffffff"><b>${t}</b><br><span style="color:#aab0ba">${d}</span></td></tr>`).join("");
  const body = `<p style="margin:0">${hi} personal design page is open and waiting. Pick up exactly where you left off.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 0;text-align:left">${steps}</table>`;
  const extra = `<p style="margin:0 0 8px;font-size:14px;color:#aab0ba">Prefer to talk it through?</p>${btn(WA, "WhatsApp us", false, true)}${btn(CALL, "Call us")}`;
  const text = `${first ? first + ", your" : "Your"} personal design page is open and waiting.\n\n1. Tell us about your ring (about two minutes)\n2. We create your complimentary initial design and a clear quote, no obligation\n3. Approve it and we handcraft it, and you follow every step from your account\n\nContinue your design:\n${link}\n\nPrefer to talk it through? WhatsApp us: ${WA}\nOr reply to this email.\n\nLADFOX`;
  return { text, html: emailShell(first ? `${first}, your design is waiting` : "Your design is waiting", body, "Continue my design", link, { hideLink: true, extraHtml: extra }) };
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
