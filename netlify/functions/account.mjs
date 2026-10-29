import { json, readJsonBody } from "./http.mjs";
import {
  getDb, getSession, getCustomer, upsertCustomer, listProjects, createProject, loadProject, saveProject,
  publicProject, paymentPricing, followUpQuestions, clean, sheetEvent, customerKey, followKey, recordVisit, sendEmail, emailShell, escapeHtml, siteUrl, getStripe, draftKey, plainShell, newToken, sha, LOGIN_TTL_MS
} from "./account-lib.mjs";

const notifyOwner = async (request, subject, lines) => {
  try {
    const to = String(process.env.ADMIN_NOTIFY_EMAIL || "hello@ladfox.com").trim();
    const rows = lines.flatMap((l) => String(l).split("\n")).map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^([A-Za-z][A-Za-z ]{0,24}):\s*(.+)$/);
      return m
        ? `<tr><td style="padding:7px 14px 7px 0;color:#8b9099;font-size:14px;white-space:nowrap;vertical-align:top">${escapeHtml(m[1])}</td><td style="padding:7px 0;color:#ffffff;font-size:16px;font-weight:600">${escapeHtml(m[2])}</td></tr>`
        : `<tr><td colspan="2" style="padding:9px 0;color:#d6d9df;font-size:15px">${escapeHtml(l)}</td></tr>`;
    }).join("");
    const body = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;text-align:left;max-width:100%">${rows}</table>`;
    await sendEmail({
      to, subject, text: lines.join("\n"),
      html: emailShell(subject, body, "Open admin", `${siteUrl(request)}/ladfox-admin`)
    });
  } catch (error) {
    console.error("owner notification failed", error.message);
  }
};

export default async (request) => {
  const db = await getDb();
  const session = await getSession(db, request);
  if (!session) return json({ error: "signed_out" }, 401);
  const email = session.email;

  if (request.method === "GET") {
    await recordVisit(db, email, "seen");
    const customer = (await getCustomer(db, email)) || { email };
    const projects = (await listProjects(db, email)).map(publicProject);
    const pend = await db.get(followKey(email), { type: "json" }).catch(() => null);
    if (pend && Date.now() - (pend.seen || 0) > 60_000) await db.setJSON(followKey(email), { ...pend, seen: Date.now() }).catch(() => {});
    const draft = await db.get(draftKey(email), { type: "json" });
    const openDraft = draft && !draft.projectId && draft.exp > Date.now()
      ? { resumeUrl: `/design/your-ring?resume=${encodeURIComponent(draft.token)}`, updatedAt: draft.updatedAt }
      : null;
    return json({ customer: { email, name: customer.name || "", phone: customer.phone || "", ringFor: customer.ringFor || "", ringName: customer.ringName || "" }, projects, draft: openDraft });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST" });

  let body;
  try { body = await readJsonBody(request, 12_000); } catch (e) { return json({ error: e.message }, 400); }

  if (body.action === "ring-for") {
    const ringFor = body.ringFor === "Myself" || body.ringFor === "A loved one" ? body.ringFor : "";
    if (!ringFor) return json({ error: "Invalid choice." }, 400);
    const existing = (await getCustomer(db, email)) || { email, createdAt: new Date().toISOString() };
    await db.setJSON(customerKey(email), { ...existing, email, ringFor, ringName: ringFor === "Myself" ? "" : clean(body.ringName, 40) });
    return json({ ok: true });
  }

  if (body.action === "profile") {
    const name = clean(body.name, 80);
    const phone = clean(body.phone, 30);
    await upsertCustomer(db, email, { name, phone });
    return json({ ok: true });
  }

  if (body.action === "request") {
    const customer = (await getCustomer(db, email)) || { email };
    const title = clean(body.title, 140);
    const details = clean(body.details, 3000);
    if (!title || details.length < 10) return json({ error: "Please give your design a name and describe what you have in mind." }, 400);

    const existing = await listProjects(db, email);
    // An identical request in the last 10 minutes is a repeat (the customer pressed send again after a slow reply):
    // hand back the one we already have instead of creating and emailing a second copy.
    const repeat = existing.find((p) => p.type === "design-request" && p.title === title && p.details === details && Date.now() - Date.parse(p.createdAt) < 10 * 60_000);
    if (repeat) return json({ ok: true, project: publicProject(repeat) });
    if (existing.filter((p) => p.type === "design-request" && Date.now() - Date.parse(p.createdAt) < 24 * 3600_000).length >= 5) {
      return json({ error: "You have sent several requests today. We will reply to those first." }, 429);
    }

    await db.delete(followKey(email)).catch(() => {});
    const project = await createProject(db, {
      email, name: customer.name, type: "design-request", title, details,
      ringType: body.ringType, budget: body.budget
    });
    // The sheet log and both emails run side by side (not one after another) so a slow mail server can't push the reply past Netlify's time limit.
    const sheetJob = sheetEvent({ type: "request", email, name: customer.name || "", title: project.title, ringType: project.ringType || "", budget: project.budget || "", details: project.details, ringFor: customer.ringFor || "", ringName: customer.ringName || "" });
    const detailLines = String(project.details || "").split("\n").filter((l) => l.trim() && !/^\[.*\]$/.test(l.trim()));
    const ownerJob = notifyOwner(request, `New design request: ${customer.name || email}`, [
      ...(customer.name ? [`Name: ${customer.name}`] : []), `Email: ${email}`,
      ...(project.budget ? [`Budget: ${project.budget}`] : []),
      ...detailLines,
      ...(Number(body.photos) > 0 ? [`Photos: ${Math.min(Number(body.photos), 3)} attached (see admin)`] : [])
    ]);
    const welcomeJob = (async () => {
    try {
      const first = String(customer.name || "").trim().split(/\s+/)[0];
      const hi = first ? `Welcome to LADFOX ${first}` : "Welcome to LADFOX";
      const token = newToken();
      await db.setJSON(`logins/${sha(token)}`, { email, exp: Date.now() + 10 * LOGIN_TTL_MS, reusable: true });
      const link = `${siteUrl(request)}/account?token=${encodeURIComponent(token)}`;
      const WA = "https://wa.me/447853362904", CALL = "tel:+447853362904";
      const pill = (href, label, solid) => `<a href="${href}" style="display:inline-block;margin:5px 4px;padding:13px 26px;border-radius:999px;font-size:15px;font-weight:700;text-decoration:none;${solid ? "background:#dfe3ea;color:#0a0a0a" : "background:#26272b;color:#ffffff"}">${label}</a>`;
      const gaps = followUpQuestions(project.details);
      // Only ask about timing when they filled everything in: one clear question gets more replies than three.
      const questions = [...gaps, ...(gaps.length || /^Timeframe:/mi.test(project.details || "") ? [] : ["Is there a date you are hoping to have it by, or are you just starting to look? A one-line reply is plenty, and it helps us plan around you."])];
      const qHtml = questions.length ? `<p style="margin:16px 0 0">So that we can get your design exactly right, ${questions.length > 1 ? "we have a couple of quick questions" : "we have a quick question"}:</p>${questions.map((q) => `<p style="margin:12px 0 0;padding:12px 14px;border-radius:12px;background:#17181b;color:#e8eaee">${escapeHtml(q)}</p>`).join("")}<p style="margin:12px 0 0">Just reply to this email, or message us from your dashboard.</p>` : "";
      const qText = questions.length ? `\n\nSo that we can get your design exactly right, ${questions.length > 1 ? "we have a couple of quick questions" : "we have a quick question"}:\n\n${questions.join("\n\n")}\n\nJust reply to this email, or message us from your dashboard.` : "";
      const bodyHtml = `<p style="margin:0">Thank you for your design request: <strong style="color:#fff">${escapeHtml(project.title)}</strong>.</p><p style="margin:16px 0 0">We will create your complimentary initial design and be in touch shortly. Your personal design dashboard is open whenever you want to check progress, add details or message us.</p>${qHtml}`;
      const buttons = `${pill(link, "Go to my dashboard", true)}<p style="margin:30px 0 8px;font-size:14px;color:#8b9099">Prefer to talk it through?</p>${pill(WA, "WhatsApp us")}${pill(CALL, "Call us")}`;
      await sendEmail({
        to: email,
        subject: "Welcome to LADFOX: we have your design request",
        text: `${hi}\n\nThank you for your design request: ${project.title}.\n\nWe will create your complimentary initial design and be in touch shortly.${qText}\n\nGo to your dashboard:\n${link}\n\nPrefer to talk it through? WhatsApp us: ${WA}\nOr call us: ${CALL}`,
        html: plainShell(hi, bodyHtml, buttons)
      });
    } catch (error) {
      console.error("request confirmation email failed", error.message);
    }
    })();
    let timer;
    await Promise.race([Promise.allSettled([sheetJob, ownerJob, welcomeJob]), new Promise((resolve) => { timer = setTimeout(resolve, 8000); })]);
    clearTimeout(timer);
    return json({ ok: true, project: publicProject(project) });
  }

  if (body.action === "message") {
    const project = await loadProject(db, email, clean(body.id, 40));
    const text = clean(body.text, 2000);
    if (!project) return json({ error: "Order not found." }, 404);
    if (!text) return json({ error: "Please write a message." }, 400);
    if (project.updates.length > 200) return json({ error: "This thread is full. Please email hello@ladfox.com." }, 400);
    const now = new Date().toISOString();
    project.updates.push({ at: now, by: "customer", text });
    project.updatedAt = now;
    project.customerUnread = true;
    await saveProject(db, project);
    await notifyOwner(request, `Message about "${project.title}"`, [`${project.name || email} (${email})`, text]);
    return json({ ok: true, project: publicProject(project) });
  }

  if (body.action === "approve") {
    const project = await loadProject(db, email, clean(body.id, 40));
    if (!project) return json({ error: "Order not found." }, 404);
    if (!(project.files || []).some((f) => f.by !== "customer")) return json({ error: "There is no design to approve yet." }, 400);
    if (project.stage !== 3) return json({ error: "This design is not waiting for approval." }, 400);
    const now = new Date().toISOString();
    project.stage = 4;
    project.updatedAt = now;
    project.updates.push({ at: now, by: "customer", text: "I approve the design.", stage: 4 });
    await saveProject(db, project);
    await notifyOwner(request, `CAD approved: "${project.title}"`, [`${project.name || email} (${email})`, "The customer approved the CAD."]);
    return json({ ok: true, project: publicProject(project) });
  }

  if (body.action === "pay") {
    const project = await loadProject(db, email, clean(body.id, 40));
    const payment = project?.payments?.find((p) => p.id === clean(body.paymentId, 40));
    if (!project || !payment) return json({ error: "Payment not found." }, 404);
    if (payment.status === "paid") return json({ error: "This has already been paid." }, 400);
    const stripe = await getStripe();
    if (!stripe) return json({ error: "Payments are temporarily unavailable. Please contact hello@ladfox.com." }, 503);
    const origin = siteUrl(request);
    const price = paymentPricing(payment);
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        client_reference_id: `acct-${project.id}-${payment.id}`,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: price.payPence,
            product_data: { name: `LADFOX: ${project.title}`, description: payment.label }
          }
        }],
        metadata: { account_payment: "1", project_id: project.id, payment_id: payment.id, customer_email: email, product: project.title, pay_pence: String(price.payPence) },
        payment_intent_data: { metadata: { account_payment: "1", project_id: project.id, payment_id: payment.id } },
        success_url: `${origin}/account?paid=1`,
        cancel_url: `${origin}/account`
      });
      return json({ ok: true, url: session.url });
    } catch (error) {
      console.error("account checkout failed", error.message);
      return json({ error: "We could not start the payment. Please try again or contact hello@ladfox.com." }, 502);
    }
  }

  return json({ error: "Unknown action." }, 400);
};
