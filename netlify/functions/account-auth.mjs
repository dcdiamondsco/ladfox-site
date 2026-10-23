import { json, readJsonBody } from "./http.mjs";
import {
  getDb, sha, newToken, normaliseEmail, validEmail, clean, siteUrl, sendEmail, emailShell,
  upsertCustomer, sessionCookie, LOGIN_TTL_MS, SESSION_TTL_MS, getSession, readCookie, COOKIE_NAME
} from "./account-lib.mjs";

const GENERIC = { ok: true, message: "If that email address is valid, a sign-in link is on its way. It works for 20 minutes." };

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });

  let body;
  try { body = await readJsonBody(request, 4000); } catch (e) { return json({ error: e.message }, 400); }

  const db = await getDb();

  if (body.action === "request") {
    const email = normaliseEmail(body.email);
    if (!validEmail(email)) return json({ error: "Please enter a valid email address." }, 400);

    const limitKey = `ratelimit/${sha(email)}`;
    const last = await db.get(limitKey, { type: "json" });
    if (last && Date.now() - last.at < 60_000) return json(GENERIC);
    await db.setJSON(limitKey, { at: Date.now() });

    const name = clean(body.name, 80);
    if (name) await upsertCustomer(db, email, { name });

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
          ? `${hello}thank you for choosing LADFOX. Your personal design page is ready. It takes about two minutes to tell us about your ring, and we then send you a complimentary sketch and a clear quote, with no obligation. You can follow every step there.\n\nContinue here (the link works once and lasts 20 minutes):\n${link}\n\nIf you did not ask for this, you can ignore this email.`
          : sketch
          ? `Thank you for your interest in LADFOX. Use this link to tell us about your ring and request your complimentary sketch (valid for 20 minutes):\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`
          : `Use this link to sign in to your LADFOX account (valid for 20 minutes):\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
        html: startKind
          ? emailShell("Your ring is waiting",
              `<p style="margin:0">${hello.replace(/[<>&"]/g, "")}thank you for choosing LADFOX. Your personal design page is ready.</p><p style="margin:14px 0 0">Tell us about your ring in about two minutes and we will send you a complimentary sketch and a clear quote. No obligation, and you can follow every step in one place.</p><p style="margin:14px 0 0;color:#777;font-size:13px">The link works once and expires in 20 minutes. If you did not ask for this, you can safely ignore this email.</p>`,
              "Continue my design", link)
          : sketch
          ? emailShell("Start your complimentary sketch",
              "<p style=\"margin:0\">Tap the button below to tell us about the ring you have in mind. We will create a complimentary sketch and quote, and you can follow every step in your LADFOX account.</p><p style=\"margin:14px 0 0;color:#777;font-size:13px\">The link works once and expires in 20 minutes. If you did not ask for this, you can safely ignore this email.</p>",
              "Request my sketch", link)
          : emailShell("Sign in to your LADFOX account",
              "<p style=\"margin:0\">Tap the button below to sign in. The link works once and expires in 20 minutes.</p><p style=\"margin:14px 0 0;color:#777;font-size:13px\">If you did not ask for this, you can safely ignore this email.</p>",
              "Sign in", link)
      });
    } catch (error) {
      console.error("sign-in email failed", error.message);
      if (error.code === "email_not_configured") return json({ error: "Sign-in email is not set up yet. Please contact hello@ladfox.com." }, 503);
      return json({ error: "We could not send the email just now. Please try again." }, 502);
    }
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
