import { json, readJsonBody } from "./http.mjs";
import {
  getDb, sha, newToken, normaliseEmail, validEmail, clean, siteUrl, sendEmail, plainShell,
  upsertCustomer, getCustomer, sheetEvent, recordVisit, escapeHtml, sessionCookie, LOGIN_TTL_MS, FOLLOWUP_DELAY_MS, followKey, SESSION_TTL_MS, getSession, readCookie, COOKIE_NAME
} from "./account-lib.mjs";

const mainBtn = (label, url) => `<a href="${escapeHtml(url)}" style="display:inline-block;background:#dfe3ea;color:#0a0a0a;text-decoration:none;padding:16px 38px;border-radius:999px;font-size:16px;font-weight:700">${escapeHtml(label)}</a>`;
const emailShell = (heading, body, label, url) => plainShell(heading, body, mainBtn(label, url));

const GENERIC = { ok: true, message: "Welcome back. We have emailed you a sign-in link. It can take a minute, so please check your spam folder too." };

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });

  let body;
  try { body = await readJsonBody(request, 4000); } catch (e) { return json({ error: e.message }, 400); }

  const db = await getDb();

  if (body.action === "request") {
    const email = normaliseEmail(body.email);
    if (!validEmail(email)) return json({ error: "Please enter a valid email address." }, 400);

    /* A brand-new email goes straight into its account (no inbox round-trip, so spam
       folders cannot block it). An email that already has an account still has to use the
       emailed link, so nobody can open someone else's orders by typing their address. */
    const alreadyCustomer = await getCustomer(db, email);
    const name = clean(body.name, 80);
    const instant = !alreadyCustomer;

    const limitKey = `ratelimit/${sha(email)}`;
    const last = await db.get(limitKey, { type: "json" });
    if (last && Date.now() - last.at < 60_000) return json({ ok: true, message: "A link was sent a moment ago. Please check your inbox and spam folder, or wait a minute and try again." });
    await db.setJSON(limitKey, { at: Date.now() });

    if (name || instant) await upsertCustomer(db, email, { name });
    if (instant) await recordVisit(db, email, "login");
    if (instant) await sheetEvent({ type: "signup", email, name, intent: clean(body.intent, 20) || "login" });
    let instantHeaders = null;
    if (instant) {
      const sessionId = newToken();
      await db.setJSON(`sessions/${sha(sessionId)}`, { email, exp: Date.now() + SESSION_TTL_MS });
      instantHeaders = { "Set-Cookie": sessionCookie(sessionId, Math.floor(SESSION_TTL_MS / 1000)) };
    }

    /* New sign-ups get no email now. If they do not submit a request, a single follow-up with
       their access link goes out later (account-followup.mjs). */
    if (instantHeaders) {
      const kind = body.intent === "design" || body.intent === "price" || body.intent === "sketch" ? body.intent : "";
      await db.setJSON(followKey(email), { email, name, kind, due: Date.now() + FOLLOWUP_DELAY_MS, seen: Date.now() });
      return json({ ok: true, instant: true }, 200, instantHeaders);
    }

    const token = newToken();
    await db.setJSON(`logins/${sha(token)}`, { email, exp: Date.now() + LOGIN_TTL_MS });
    const sketch = body.intent === "sketch";
    const startKind = body.intent === "design" || body.intent === "price" ? body.intent : "";
    const link = `${siteUrl(request)}/account?token=${encodeURIComponent(token)}${sketch ? "&new=1" : ""}${startKind ? `&start=${startKind}` : ""}`;
    const hello = name ? `Hi ${name.split(" ")[0]}, ` : "";

    try {
      await sendEmail({
        to: email,
        subject: startKind ? "Your LADFOX ring is waiting" : sketch ? "Start your complimentary LADFOX sketch" : "Your LADFOX sign-in link",
        text: startKind
          ? `${hello}thank you for choosing LADFOX. Your personal design page is ready. It takes about two minutes to tell us about your ring, and we then send you a complimentary initial design and a clear quote, with no obligation. You can follow every step there.\n\nContinue here:\n${link}\n\nIf you did not ask for this, you can ignore this email.`
          : sketch
          ? `Thank you for your interest in LADFOX. Use this link to tell us about your ring and request your complimentary initial design:\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`
          : `Use this link to sign in to your LADFOX account:\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
        html: startKind
          ? emailShell("Your ring is waiting",
              `<p style="margin:0">${hello.replace(/[<>&"]/g, "")}thank you for choosing LADFOX. Your personal design page is ready.</p><p style="margin:14px 0 0">Tell us about your ring in about two minutes and we will send you a complimentary initial design and a clear quote. No obligation, and you can follow every step in one place.</p><p style="margin:14px 0 0;color:#8b9099;font-size:13px">If you did not ask for this, you can safely ignore this email.</p>`,
              "Continue my design", link)
          : sketch
          ? emailShell("Start your complimentary initial design",
              "<p style=\"margin:0\">Tap the button below to tell us about the ring you have in mind. We will create a complimentary initial design and quote, and you can follow every step in your LADFOX account.</p><p style=\"margin:14px 0 0;color:#8b9099;font-size:13px\">If you did not ask for this, you can safely ignore this email.</p>",
              "Request my sketch", link)
          : emailShell("Sign in to your LADFOX account",
              "<p style=\"margin:0\">Tap the button below to sign in.</p><p style=\"margin:14px 0 0;color:#8b9099;font-size:13px\">If you did not ask for this, you can safely ignore this email.</p>",
              "Sign in", link)
      });
    } catch (error) {
      console.error("sign-in email failed", error.message);
      if (instantHeaders) return json({ ok: true, instant: true }, 200, instantHeaders);
      if (error.code === "email_not_configured") return json({ error: "Sign-in email is not set up yet. Please contact hello@ladfox.com." }, 503);
      return json({ error: "We could not send the email just now. Please try again." }, 502);
    }
    if (instantHeaders) return json({ ok: true, instant: true }, 200, instantHeaders);
    return json(GENERIC);
  }

  if (body.action === "verify") {
    const token = clean(body.token, 100);
    if (!token) return json({ error: "Missing sign-in link." }, 400);
    const key = `logins/${sha(token)}`;
    const record = await db.get(key, { type: "json" });
    if (!record) return json({ error: "This sign-in link has already been used or is not valid. Please request a new one." }, 400);
    await db.delete(key);
    if (record.exp < Date.now()) return json({ error: "This sign-in link has expired. Please request a new one." }, 400);

    const customer = await upsertCustomer(db, record.email, {});
    await recordVisit(db, record.email, "login");
    const sessionId = newToken();
    await db.setJSON(`sessions/${sha(sessionId)}`, { email: record.email, exp: Date.now() + SESSION_TTL_MS });
    return json({ ok: true, name: customer.name || "" }, 200, {
      "Set-Cookie": sessionCookie(sessionId, Math.floor(SESSION_TTL_MS / 1000))
    });
  }

  if (body.action === "logout") {
    const session = await getSession(db, request);
    const id = readCookie(request, COOKIE_NAME);
    if (session && id) await db.delete(`sessions/${sha(id)}`);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }

  return json({ error: "Unknown action." }, 400);
};
