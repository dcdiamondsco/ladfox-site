import { json, readJsonBody } from "./http.mjs";
import {
  getDb, listProjects, loadProject, saveProject, createProject, normaliseEmail, validEmail, clean,
  safeEqual, sheetEvent, sendEmail, emailShell, escapeHtml, siteUrl, upsertCustomer, STAGES, publicProject,
  FILE_TYPES, MAX_FILE_BYTES, MAX_FILES_PER_PROJECT, fileKey, sniffType, newToken, emailCustomerNote,
  PAYMENT_MIN_PENCE, PAYMENT_MAX_PENCE, projectPrefix
} from "./account-lib.mjs";
import { listDesigns, publicDesign } from "./design-lib.mjs";

const authorised = (request) => {
  const expected = String(process.env.ADMIN_PASSWORD || "");
  if (expected.length < 10) return false;
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") && safeEqual(header.slice(7), expected);
};

const emailCustomer = async (request, project, note) => {
  const stage = STAGES[project.stage];
  const body = `<p style="margin:0 0 10px">Your ring "<strong>${escapeHtml(project.title)}</strong>" is now: <strong>${escapeHtml(stage)}</strong>.</p>` +
    (project.estimate ? `<p style="margin:0 0 10px">Estimated date: ${escapeHtml(project.estimate)} (this is an estimate, not a guarantee).</p>` : "") +
    (note ? `<p style="margin:0 0 10px;padding:12px;background:#f4f2ee;border-radius:8px">${escapeHtml(note)}</p>` : "");
  await sendEmail({
    to: project.email,
    subject: `Update on your LADFOX ring: ${stage}`,
    text: `Your ring "${project.title}" is now: ${stage}.${project.estimate ? `\nEstimated date: ${project.estimate}` : ""}${note ? `\n\n${note}` : ""}\n\n${siteUrl(request)}/account`,
    html: emailShell("An update on your ring", body, "View progress", `${siteUrl(request)}/account`)
  });
};

export default async (request) => {
  if (!authorised(request)) {
    await new Promise((r) => setTimeout(r, 600));
    return json({ error: "Not authorised." }, 401);
  }
  const db = await getDb();

  if (request.method === "GET") {
    const projects = await listProjects(db);
    const designs = (await listDesigns(db)).slice(0, 100).map((d) => ({
      ...publicDesign(d), email: d.email, name: d.name || "", marketing: Boolean(d.marketing), selections: d.selections
    }));
    return json({ stages: STAGES, projects, designs });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let body;
  try { body = await readJsonBody(request, 6_500_000); } catch (e) { return json({ error: e.message }, 400); }

  if (body.action === "update") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    if (!project) return json({ error: "Project not found." }, 404);
    const now = new Date().toISOString();
    const stage = Number.parseInt(body.stage, 10);
    const note = clean(body.note, 2000);
    const stageChanged = Number.isInteger(stage) && stage >= 0 && stage < STAGES.length && stage !== project.stage;
    if (Number.isInteger(stage) && stage >= 0 && stage < STAGES.length) project.stage = stage;
    if (typeof body.estimate === "string") project.estimate = clean(body.estimate, 80);
    if (stageChanged || note) project.updates.push({ at: now, by: "ladfox", text: note || `Status updated to "${STAGES[project.stage]}".`, stage: project.stage });
    project.updatedAt = now;
    project.customerUnread = false;
    const price = body.price === "" || body.price == null ? "" : Number(body.price);
    const priceChanged = Number.isFinite(price) && price > 0 && String(price) !== String(project.price || "");
    if (priceChanged) project.price = String(price);
    const progress = Number.isInteger(body.progress) && body.progress >= 0 && body.progress <= 8 ? body.progress : null;
    if (progress !== null) project.progress = progress;
    await saveProject(db, project);
    if (priceChanged || progress !== null) {
      await sheetEvent({ type: "progress", email: project.email, title: project.title, price: priceChanged ? price : undefined, progress: progress === null ? undefined : progress });
    }
    let emailed = false;
    if (body.notify && (stageChanged || note)) {
      try { await emailCustomer(request, project, note); emailed = true; } catch (e) { console.error("customer email failed", e.message); }
    }
    return json({ ok: true, emailed, project });
  }

  if (body.action === "create") {
    const email = normaliseEmail(body.email);
    if (!validEmail(email)) return json({ error: "Valid customer email required." }, 400);
    const title = clean(body.title, 140);
    if (!title) return json({ error: "Title required." }, 400);
    const name = clean(body.name, 80);
    await upsertCustomer(db, email, { name });
    const stage = Number.parseInt(body.stage, 10);
    const project = await createProject(db, {
      email, name, title, type: "order", details: body.details, orderReference: body.orderReference,
      stage: Number.isInteger(stage) && stage >= 0 && stage < STAGES.length ? stage : 0,
      firstUpdate: "Your ring has been added to your LADFOX account. You can follow its progress here."
    });
    if (body.notify) {
      try { await emailCustomer(request, project, "You can now follow your ring online, and message us from your account."); } catch (e) { console.error(e.message); }
    }
    return json({ ok: true, project: publicProject(project) });
  }

  if (body.action === "upload") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    if (!project) return json({ error: "Project not found." }, 404);
    if ((project.files || []).length >= MAX_FILES_PER_PROJECT) return json({ error: "Too many files on this project." }, 400);
    let buf;
    try { buf = Buffer.from(String(body.data || ""), "base64"); } catch { return json({ error: "Invalid file." }, 400); }
    if (!buf.length || buf.length > MAX_FILE_BYTES) return json({ error: "The file must be under 4 MB." }, 400);
    const type = sniffType(buf);
    if (!FILE_TYPES[type]) return json({ error: "Only JPG, PNG, WebP or PDF files are allowed." }, 400);
    const fileId = newToken(9);
    const name = clean(body.name, 100).replace(/[^\w .()-]/g, "_") || `design.${FILE_TYPES[type]}`;
    await db.set(fileKey(email, project.id, fileId), buf);
    const now = new Date().toISOString();
    const note = clean(body.note, 1000);
    project.files = [...(project.files || []), { id: fileId, name, type, size: buf.length, at: now, note }];
    project.updates.push({ at: now, by: "ladfox", text: note ? `New design uploaded: ${note}` : "A new design has been uploaded for you to view.", stage: project.stage });
    project.updatedAt = now;
    await saveProject(db, project);
    let emailed = false;
    if (body.notify) {
      try {
        await emailCustomerNote(request, project, "A design is ready to view",
          "Your design is ready to view",
          `<p style="margin:0 0 10px">We have uploaded a design for "<strong>${escapeHtml(project.title)}</strong>".</p>${note ? `<p style="margin:0 0 10px;padding:12px;background:#f4f2ee;border-radius:8px">${escapeHtml(note)}</p>` : ""}<p style="margin:0">Sign in to your account to view it and approve it, or message us with any changes.</p>`,
          `We have uploaded a design for "${project.title}". Sign in to view and approve it.`);
        emailed = true;
      } catch (e) { console.error("design email failed", e.message); }
    }
    return json({ ok: true, emailed, project });
  }

  if (body.action === "delete-file") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    const fileId = clean(body.fileId, 40);
    if (!project || !(project.files || []).some((f) => f.id === fileId)) return json({ error: "File not found." }, 404);
    await db.delete(fileKey(email, project.id, fileId));
    project.files = project.files.filter((f) => f.id !== fileId);
    project.updatedAt = new Date().toISOString();
    await saveProject(db, project);
    return json({ ok: true, project });
  }

  if (body.action === "request-payment") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    if (!project) return json({ error: "Project not found." }, 404);
    const pence = Math.round(Number(body.amount) * 100);
    if (!Number.isFinite(pence) || pence < PAYMENT_MIN_PENCE || pence > PAYMENT_MAX_PENCE) return json({ error: "Enter an amount between £1 and £50,000." }, 400);
    if ((project.payments || []).some((p) => p.status === "requested")) return json({ error: "There is already an unpaid payment request. Cancel it first." }, 400);
    const label = clean(body.label, 80) || "Full payment";
    const now = new Date().toISOString();
    project.payments = [...(project.payments || []), { id: newToken(9), label, amountPence: pence, status: "requested", createdAt: now }];
    project.updates.push({ at: now, by: "ladfox", text: `Payment requested: ${label}, £${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}.`, stage: project.stage });
    project.updatedAt = now;
    await saveProject(db, project);
    let emailed = false;
    if (body.notify) {
      try {
        await emailCustomerNote(request, project, "Your LADFOX payment is ready",
          "Your payment is ready",
          `<p style="margin:0 0 10px">Your payment of <strong>£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</strong> for "<strong>${escapeHtml(project.title)}</strong>" is ready.</p><p style="margin:0">Sign in to your account and choose Pay securely. Payment is handled by Stripe.</p>`,
          `Your payment of £${(pence / 100).toFixed(2)} for "${project.title}" is ready. Sign in to pay securely.`);
        emailed = true;
      } catch (e) { console.error("payment email failed", e.message); }
    }
    return json({ ok: true, emailed, project });
  }

  if (body.action === "cancel-payment") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    const payment = project?.payments?.find((p) => p.id === clean(body.paymentId, 40));
    if (!payment) return json({ error: "Payment not found." }, 404);
    if (payment.status !== "requested") return json({ error: "Only unpaid requests can be cancelled." }, 400);
    project.payments = project.payments.filter((p) => p.id !== payment.id);
    project.updatedAt = new Date().toISOString();
    await saveProject(db, project);
    return json({ ok: true, project });
  }

  if (body.action === "mark-paid") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    const payment = project?.payments?.find((p) => p.id === clean(body.paymentId, 40));
    if (!payment) return json({ error: "Payment not found." }, 404);
    if (payment.status === "paid") return json({ ok: true, project });
    payment.status = "paid";
    payment.paidAt = new Date().toISOString();
    payment.method = "manual";
    project.updates.push({ at: payment.paidAt, by: "ladfox", text: `Payment received: ${payment.label}.`, stage: project.stage });
    if (project.stage < 2) project.stage = 2;
    project.progress = 8;
    project.updatedAt = payment.paidAt;
    await saveProject(db, project);
    await sheetEvent({ type: "progress", email: project.email, title: project.title, progress: 8 });
    return json({ ok: true, project });
  }

  if (body.action === "delete-project") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    if (!project) return json({ error: "Project not found." }, 404);
    for (const f of project.files || []) { try { await db.delete(fileKey(email, project.id, f.id)); } catch (e) { console.error("file delete failed", e.message); } }
    await db.delete(`${projectPrefix(email)}${project.id}`);
    return json({ ok: true });
  }

  return json({ error: "Unknown action." }, 400);
};
