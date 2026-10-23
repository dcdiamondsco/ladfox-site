import { json, readJsonBody } from "./http.mjs";
import {
  getDb, sha, newToken, normaliseEmail, validEmail, clean, siteUrl, sendEmail, emailShell,
  upsertCustomer, getSession, LOGIN_TTL_MS
} from "./account-lib.mjs";
import {
  PAGES, designPrefix, MAX_DESIGNS_PER_CUSTOMER, cleanSelections, resumeUrl, publicDesign, listDesigns, pushToSheet
} from "./design-lib.mjs";

// At most one email a minute and 4 a day per address.
const mayEmail = async (db, email) => {
  const key = `ratelimit/sd-${sha(email)}`;
  const rec = (await db.get(key, { type: "json" })) || { at: 0, day: "", n: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const n = rec.day === today ? rec.n : 0;
  if (Date.now() - rec.at < 60_000 || n >= 4) return false;
  await db.setJSON(key, { at: Date.now(), day: today, n: n + 1 });
  return true;
};

export default async (request) => {
  const db = await getDb();
  const session = await getSession(db, request);

  if (request.method === "GET") {
    if (!session) return json({ error: "signed_out" }, 401);
    const designs = (await listDesigns(db, session.email)).map(publicDesign);
    return json({ designs });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST" });

  let body;
  try { body = await readJsonBody(request, 12_000); } catch (e) { return json({ error: e.message }, 400); }

  if (body.action === "status") return json({ signedIn: Boolean(session), email: session?.email || "" });

  if (body.action === "delete") {
    if (!session) return json({ error: "signed_out" }, 401);
    const id = clean(body.id, 40).replace(/[^A-Za-z0-9_-]/g, "");
    if (id) await db.delete(`${designPrefix(session.email)}${id}`);
    return json({ ok: true });
  }

  if (body.action === "save") {
    const email = session ? session.email : normaliseEmail(body.email);
    if (!validEmail(email)) return json({ error: "Please enter a valid email address." }, 400);
    const page = clean(body.page, 40);
    if (!PAGES.has(page)) return json({ error: "Unknown ring page." }, 400);
    const selections = cleanSelections(body.selections);
    if (Object.keys(selections).length < 3) return json({ error: "Choose some options first." }, 400);

    const existing = await listDesigns(db, email);
    if (existing.length >= MAX_DESIGNS_PER_CUSTOMER) {
      return json({ error: "You have reached the limit of saved designs. Please delete one first." }, 429);
    }

    const now = new Date().toISOString();
    const id = newToken(9);
    const attribution = body.attribution && typeof body.attribution === "object" ? body.attribution : {};
    const design = {
      id, email, name: clean(body.name, 80), page, selections,
      title: clean(body.title, 100) || "My LADFOX ring",
      summary: clean(body.summary, 300), price: clean(body.price, 30),
      marketing: body.marketing === true, createdAt: now,
      attribution: {
        utm_source: clean(attribution.utm_source, 100), utm_campaign: clean(attribution.utm_campaign, 100),
        gclid: clean(attribution.gclid, 200)
      }
    };
    await db.setJSON(`${designPrefix(email)}${id}`, design);

    const fields = { name: design.name };
    if (design.marketing) {
      fields.marketingOptIn = "yes";
      fields.marketingOptInAt = now;
      fields.marketingSource = "saved ring design";
    }
    await upsertCustomer(db, email, fields);

    const base = siteUrl(request);
    design.resumeAbsolute = `${base}${resumeUrl(page, selections)}`;
    await pushToSheet(design);

    let emailed = false;
    if (!session && await mayEmail(db, email)) {
      try {
        const token = newToken();
        await db.setJSON(`logins/${sha(token)}`, { email, exp: Date.now() + LOGIN_TTL_MS });
        const link = `${base}/account?token=${encodeURIComponent(token)}`;
        await sendEmail({
          to: email,
          subject: "Your LADFOX ring design is saved",
          text: `Your ring design is saved: ${design.summary || design.title}\n\nSign in to your LADFOX account to see it, change it or order it (this link works once and lasts 20 minutes):\n${link}\n\nOr go straight back to your design: ${design.resumeAbsolute}\n\nIf you did not ask for this, you can ignore this email.`,
          html: emailShell("Your ring design is saved",
            `<p style="margin:0">${(design.summary || design.title).replace(/[<>&]/g, "")}</p><p style="margin:14px 0 0;font-size:13px;color:#555">Sign in to see it any time, or go straight back to it: <a href="${design.resumeAbsolute}">${design.resumeAbsolute.replace(/[<>&"]/g, "")}</a></p>`,
            "Sign in to my account", link)
        });
        emailed = true;
      } catch (error) {
        console.error("save-design email failed", error.message);
      }
    }
    return json({ ok: true, id, signedIn: Boolean(session), emailed });
  }

  return json({ error: "Unknown action." }, 400);
};
