import { json, readJsonBody } from "./http.mjs";
import {
  getDb, sha, newToken, normaliseEmail, validEmail, clean, siteUrl, sendEmail, emailShell, escapeHtml,
  upsertCustomer, createProject, draftKey, LOGIN_TTL_MS
} from "./account-lib.mjs";

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ANSWER_KEYS = [
  "stone_type", "gemstone_type", "stone_shape", "stone_size", "toi_et_moi_first_shape", "toi_et_moi_second_shape",
  "toi_et_moi_first_stone_type", "toi_et_moi_first_gemstone", "toi_et_moi_second_stone_type", "toi_et_moi_second_gemstone",
  "trilogy_centre_shape", "trilogy_side_shape", "multi_stone_style", "style_detail", "pave_band", "pave_coverage",
  "setting_design", "ring_metal", "ring_size", "budget", "design_request_type", "other_notes", "phone", "preferred_contact"
];
const LABELS = {
  stone_type: "Stone type", gemstone_type: "Gemstone", stone_shape: "Shape", stone_size: "Stone size",
  multi_stone_style: "Style", style_detail: "Style detail", pave_band: "Pavé band", pave_coverage: "Pavé coverage",
  setting_design: "Setting", ring_metal: "Metal", ring_size: "Ring size", budget: "Budget", other_notes: "Notes",
  trilogy_centre_shape: "Centre stone shape", trilogy_side_shape: "Side stone shape",
  toi_et_moi_first_shape: "First stone shape", toi_et_moi_second_shape: "Second stone shape"
};

const tokenKey = (token) => `drafttokens/${sha(token)}`;

const cleanAnswers = (input) => {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const key of ANSWER_KEYS) {
    if (typeof input[key] === "string" || typeof input[key] === "number") {
      out[key] = clean(input[key], key === "other_notes" ? 3000 : 300);
    }
  }
  return out;
};

const loadDraft = async (db, token) => {
  const t = clean(token, 100);
  if (!t) return null;
  const pointer = await db.get(tokenKey(t), { type: "json" });
  if (!pointer) return null;
  const draft = await db.get(draftKey(pointer.email), { type: "json" });
  if (!draft || draft.token !== t) return null;
  if (draft.exp < Date.now()) return null;
  return draft;
};

// Not more than one email a minute, and 4 a day, per address and kind.
const mayEmail = async (db, email, kind) => {
  const key = `ratelimit/sp-${kind}-${sha(email)}`;
  const rec = (await db.get(key, { type: "json" })) || { at: 0, day: "", n: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const n = rec.day === today ? rec.n : 0;
  if (Date.now() - rec.at < 60_000 || n >= 4) return false;
  await db.setJSON(key, { at: Date.now(), day: today, n: n + 1 });
  return true;
};

const loginLink = async (db, request, email) => {
  const token = newToken();
  await db.setJSON(`logins/${sha(token)}`, { email, exp: Date.now() + LOGIN_TTL_MS });
  return `${siteUrl(request)}/account?token=${encodeURIComponent(token)}`;
};

const summaryLines = (answers) => Object.entries(LABELS)
  .filter(([k]) => answers[k])
  .map(([k, label]) => `${label}: ${answers[k]}`);

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
  let body;
  try { body = await readJsonBody(request, 20_000); } catch (e) { return json({ error: e.message }, 400); }
  const db = await getDb();

  if (body.action === "start") {
    const email = normaliseEmail(body.email);
    if (!validEmail(email)) return json({ error: "Please enter a valid email address." }, 400);
    const now = new Date().toISOString();
    const token = newToken(24);
    const draft = {
      email, token, answers: cleanAnswers(body.answers), stepKey: clean(body.stepKey, 60),
      createdAt: now, updatedAt: now, exp: Date.now() + DRAFT_TTL_MS
    };
    await db.setJSON(draftKey(email), draft);
    await db.setJSON(tokenKey(token), { email });

    const fields = {};
    if (body.marketing === true) {
      fields.marketingOptIn = "yes";
      fields.marketingOptInAt = now;
      fields.marketingSource = "ring enquiry: save progress";
    }
    await upsertCustomer(db, email, fields);

    let emailed = false;
    if (await mayEmail(db, email, "start")) {
      try {
        const base = siteUrl(request);
        const resume = `${base}/design/your-ring?resume=${encodeURIComponent(token)}`;
        const link = await loginLink(db, request, email);
        await sendEmail({
          to: email,
          subject: "Your LADFOX ring design is saved",
          text: `Your ring design is saved, so you can finish it whenever you like.\n\nContinue your design: ${resume}\n\nOr sign in to your LADFOX account (this link works once and lasts 20 minutes): ${link}\n\nIf you did not ask for this, you can ignore this email.`,
          html: emailShell("Your ring design is saved",
            `<p style="margin:0">You can pick up your ring design exactly where you left off, any time in the next 30 days.</p><p style="margin:14px 0 0;font-size:13px;color:#555">Prefer to see everything in one place? <a href="${escapeHtml(link)}">Sign in to your LADFOX account</a> (the link works once and lasts 20 minutes).</p><p style="margin:14px 0 0;color:#777;font-size:13px">If you did not ask for this, you can safely ignore this email.</p>`,
            "Continue your design", resume)
        });
        emailed = true;
      } catch (error) {
        console.error("save-progress email failed", error.message);
      }
    }
    return json({ ok: true, token, emailed });
  }

  if (body.action === "save") {
    const draft = await loadDraft(db, body.token);
    if (!draft) return json({ error: "Saved design not found." }, 404);
    draft.answers = cleanAnswers(body.answers);
    draft.stepKey = clean(body.stepKey, 60);
    draft.updatedAt = new Date().toISOString();
    await db.setJSON(draftKey(draft.email), draft);
    return json({ ok: true });
  }

  if (body.action === "load") {
    const draft = await loadDraft(db, body.token);
    if (!draft) return json({ error: "This saved design has expired or could not be found." }, 404);
    return json({ ok: true, answers: draft.answers, stepKey: draft.stepKey, email: draft.email });
  }

  if (body.action === "complete") {
    const draft = body.token ? await loadDraft(db, body.token) : null;
    const answers = cleanAnswers(body.answers);
    const email = draft ? draft.email : normaliseEmail(body.email);
    if (!validEmail(email)) return json({ ok: true, skipped: true });
    if (draft && draft.projectId) return json({ ok: true, projectId: draft.projectId });

    const lines = summaryLines(answers);
    const style = answers.multi_stone_style || answers.setting_design || "";
    const project = await createProject(db, {
      email,
      name: clean(body.name, 80),
      type: "design-request",
      title: style ? `${style} ring` : "Ring enquiry",
      details: lines.length ? lines.join("\n") : "Ring enquiry from the website.",
      ringType: style,
      budget: answers.budget,
      firstUpdate: "We have received your enquiry and will be in touch with your complimentary sketch and quote shortly."
    });
    await upsertCustomer(db, email, { phone: answers.phone });

    if (draft) {
      draft.projectId = project.id;
      draft.updatedAt = new Date().toISOString();
      await db.setJSON(draftKey(email), draft);
    }

    if (await mayEmail(db, email, "complete")) {
      try {
        const link = await loginLink(db, request, email);
        await sendEmail({
          to: email,
          subject: "We have your LADFOX ring enquiry",
          text: `Thank you, we have your ring enquiry and will be in touch shortly with your complimentary sketch and quote.\n\nYou can follow its progress in your LADFOX account. Sign in here (works once, lasts 20 minutes): ${link}`,
          html: emailShell("We have your ring enquiry",
            "<p style=\"margin:0\">Thank you. We will be in touch shortly with your complimentary sketch and quote.</p><p style=\"margin:14px 0 0\">You can follow progress in your LADFOX account. The sign-in link works once and lasts 20 minutes.</p>",
            "Sign in to follow progress", link)
        });
      } catch (error) {
        console.error("enquiry email failed", error.message);
      }
    }
    return json({ ok: true, projectId: project.id });
  }

  return json({ error: "Unknown action." }, 400);
};
