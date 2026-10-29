import { json, readJsonBody } from "./http.mjs";
import {
  getDb, listProjects, loadProject, saveProject, createProject, normaliseEmail, validEmail, clean,
  safeEqual, sendEmail, emailShell, escapeHtml, siteUrl, upsertCustomer, STAGES, publicProject,
  FILE_TYPES, MAX_FILE_BYTES, VIDEO_CHUNK, VIDEO_MAX_CHUNKS, videoPrefix, sniffVideo, dropVideo, withPricing, paymentPricing, videosOf, VIDEOS_MAX, MAX_FILES_PER_PROJECT, fileKey, projectPrefix, customerKey, sniffType, newToken, emailCustomerNote,
  PAYMENT_MIN_PENCE, PAYMENT_MAX_PENCE, followKey, sheetEvent
} from "./account-lib.mjs";
import { listDesigns, publicDesign } from "./design-lib.mjs";

const authorised = (request) => {
  const expected = String(process.env.ADMIN_PASSWORD || "");
  if (expected.length < 10) return false;
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") && safeEqual(header.slice(7), expected);
};

// Removes a customer completely so they have to sign up again: record, follow-up, sessions and login links.
const wipeCustomer = async (db, email) => {
  await db.delete(customerKey(email)).catch(() => {});
  await db.delete(followKey(email)).catch(() => {});
  for (const prefix of ["sessions/", "logins/"]) {
    try {
      const { blobs } = await db.list({ prefix });
      for (const b of blobs) {
        const rec = await db.get(b.key, { type: "json" }).catch(() => null);
        if (rec && normaliseEmail(rec.email) === email) await db.delete(b.key).catch(() => {});
      }
    } catch {}
  }
};

const emailCustomer = async (request, project, note) => {
  const stage = STAGES[project.stage];
  const body = `<p style="margin:0 0 10px">Your ring "<strong>${escapeHtml(project.title)}</strong>" is now: <strong>${escapeHtml(stage)}</strong>.</p>` +
    (project.estimate ? `<p style="margin:0 0 10px">Estimated date: ${escapeHtml(project.estimate)} (this is an estimate, not a guarantee).</p>` : "") +
    (project.stage === 7 && project.trackingUrl ? `<p style="margin:0 0 10px"><a href="${escapeHtml(project.trackingUrl)}" style="color:#dfe3ea">Track your parcel</a></p>` : "") +
    (note ? `<p style="margin:0 0 10px;padding:12px 14px;background:#17181b;color:#e8eaee;border-radius:12px">${escapeHtml(note)}</p>` : "");
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
    const projects = (await listProjects(db)).map((p) => ({ ...p, payments: (p.payments || []).map(withPricing) }));
    const designs = (await listDesigns(db)).slice(0, 100).map((d) => ({
      ...publicDesign(d), email: d.email, name: d.name || "", marketing: Boolean(d.marketing), selections: d.selections
    }));
    const { blobs: cb } = await db.list({ prefix: "customers/" });
    const customers = (await Promise.all(cb.map((x) => db.get(x.key, { type: "json" }).catch(() => null)))).filter(Boolean).map((c) => ({
      email: c.email, name: c.name || "", createdAt: c.createdAt || "", lastSeenAt: c.lastSeenAt || "", lastLoginAt: c.lastLoginAt || "",
      loginCount: c.loginCount || 0, logins: (c.logins || []).slice(-5), ringFor: c.ringFor || "", ringName: c.ringName || ""
    }));
    return json({ stages: STAGES, projects, designs, customers });
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
    if (body.removeVideo === true) await dropVideo(db, email, project);
    if (typeof body.videoUrl === "string") {
      const v = clean(body.videoUrl, 500);
      project.videoUrl = /^https:\/\/[^\s"'<>]{4,480}$/.test(v) ? v : "";
    }
    if (typeof body.trackingUrl === "string") {
      const u = clean(body.trackingUrl, 500);
      project.trackingUrl = /^https:\/\/[^\s"'<>]{4,480}$/.test(u) ? u : "";
    }
    // Choosing "Payment received" from the stage list also marks any open payment request as paid.
    if (stageChanged && project.stage === 2) {
      for (const pay of project.payments || []) {
        if (pay.status !== "requested") continue;
        pay.status = "paid"; pay.paidAt = now; pay.method = "manual";
        project.updates.push({ at: now, by: "ladfox", text: `Payment received: ${pay.label}.`, stage: 2 });
      }
    }
    if (stageChanged || note) project.updates.push({ at: now, by: "ladfox", text: note || `Status updated to "${STAGES[project.stage]}".`, stage: project.stage });
    project.updatedAt = now;
    project.customerUnread = false;
    await saveProject(db, project);
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
          `<p style="margin:0 0 10px">We have uploaded a design for "<strong>${escapeHtml(project.title)}</strong>".</p>${note ? `<p style="margin:0 0 10px;padding:12px 14px;background:#17181b;color:#e8eaee;border-radius:12px">${escapeHtml(note)}</p>` : ""}<p style="margin:0">Sign in to your account to view it and approve it, or message us with any changes.</p>`,
          `We have uploaded a design for "${project.title}". Sign in to view and approve it.`);
        emailed = true;
      } catch (e) { console.error("design email failed", e.message); }
    }
    return json({ ok: true, emailed, project });
  }

  if (body.action === "message") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    if (!project) return json({ error: "Project not found." }, 404);
    const text = clean(body.text, 2000);
    if (!text) return json({ error: "Write a message first." }, 400);
    if ((project.updates || []).length > 200) return json({ error: "This thread is full." }, 400);
    const now = new Date().toISOString();
    project.updates.push({ at: now, by: "ladfox", kind: "msg", text, stage: project.stage });
    project.updatedAt = now;
    project.customerUnread = false;
    await saveProject(db, project);
    let emailed = false;
    if (body.notify) {
      try { await emailCustomer(request, project, text); emailed = true; } catch (e) { console.error("customer email failed", e.message); }
    }
    return json({ ok: true, emailed, project });
  }

  if (body.action === "video-chunk") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    if (!project) return json({ error: "Project not found." }, 404);
    const vid = clean(body.vid, 24);
    const index = Number.parseInt(body.index, 10), total = Number.parseInt(body.total, 10);
    if (!/^[\w-]{6,24}$/.test(vid) || !(total >= 1 && total <= VIDEO_MAX_CHUNKS) || !(index >= 0 && index < total)) return json({ error: "Invalid video upload (maximum 60 MB)." }, 400);
    let buf;
    try { buf = Buffer.from(String(body.data || ""), "base64"); } catch { return json({ error: "Invalid video." }, 400); }
    if (!buf.length || buf.length > VIDEO_CHUNK) return json({ error: "Invalid video chunk." }, 400);
    if (index === 0 && !sniffVideo(buf)) return json({ error: "Only MP4, MOV or WebM videos are allowed." }, 400);
    const prefix = videoPrefix(email, project.id, vid);
    if (index === 0 && videosOf(project).length >= VIDEOS_MAX) return json({ error: `You can add up to ${VIDEOS_MAX} videos. Remove one first.` }, 400);
    await db.set(`${prefix}${index}`, buf);
    if (index < total - 1) return json({ ok: true });
    // last chunk: check every piece arrived, then publish
    const { blobs } = await db.list({ prefix });
    if (blobs.length !== total) return json({ error: "Some parts of the video did not arrive. Please upload it again." }, 400);
    const first = await db.get(`${prefix}0`, { type: "arrayBuffer" });
    const type = sniffVideo(Buffer.from(first));
    const size = Number.parseInt(body.size, 10);
    if (!type || !(size > (total - 1) * VIDEO_CHUNK && size <= total * VIDEO_CHUNK)) return json({ error: "Video upload failed. Please try again." }, 400);
    const list = videosOf(project);
    if (list.length >= VIDEOS_MAX) return json({ error: `You can add up to ${VIDEOS_MAX} videos. Remove one first.` }, 400);
    project.videos = [...list, { id: vid, name: clean(body.name, 100).replace(/[^\w .()-]/g, "_") || "diamond-video", type, size, chunks: total, at: new Date().toISOString() }];
    project.video = null;
    project.updatedAt = new Date().toISOString();
    await saveProject(db, project);
    return json({ ok: true, project: publicProject(project) });
  }

  if (body.action === "set-replied") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    if (!project) return json({ error: "Project not found." }, 404);
    project.replied = body.value === true;
    await saveProject(db, project);
    return json({ ok: true, project });
  }

  if (body.action === "video-delete") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    const vid = clean(body.videoId, 24);
    if (!project || !videosOf(project).some((v) => v.id === vid)) return json({ error: "Video not found." }, 404);
    await dropVideo(db, email, project, vid);
    project.updatedAt = new Date().toISOString();
    await saveProject(db, project);
    return json({ ok: true, project: publicProject(project) });
  }

  if (body.action === "delete-project") {
    const email = normaliseEmail(body.email);
    const project = await loadProject(db, email, clean(body.id, 40));
    if (!project) return json({ error: "Project not found." }, 404);
    for (const f of project.files || []) await db.delete(fileKey(email, project.id, f.id)).catch(() => {});
    await dropVideo(db, email, project).catch(() => {});
    await db.delete(`${projectPrefix(email)}${project.id}`);
    if (!(await listProjects(db, email)).length) await wipeCustomer(db, email);
    return json({ ok: true });
  }

  if (body.action === "delete-customer") {
    const email = normaliseEmail(body.email);
    if ((await listProjects(db, email)).length) return json({ error: "This customer still has a project." }, 400);
    await wipeCustomer(db, email);
    return json({ ok: true });
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
    await sheetEvent({ type: "price", email, title: project.title, amount: pence / 100 });
    project.updatedAt = now;
    await saveProject(db, project);
    let emailed = false;
    const pr = paymentPricing(project.payments[project.payments.length - 1]);
    const endDay = new Date(Date.parse(pr.saleEndsAt) - 60000).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
    const was = pr.wasPence / 100;
    if (body.notify) {
      try {
        await emailCustomerNote(request, project, "Your LADFOX payment is ready",
          "Your payment is ready",
          `<p style="margin:0 0 10px">Your payment of <strong>£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</strong> for "<strong>${escapeHtml(project.title)}</strong>" is ready.</p><p style="margin:0 0 10px">This price is held until midnight on ${endDay}. After that it is £${was.toLocaleString("en-GB")}.</p><p style="margin:0">Sign in to your account and choose Pay securely. Payment is handled by Stripe.</p>`,
          `Your payment of £${(pence / 100).toFixed(2)} for "${project.title}" is ready. This price is held until midnight on ${endDay}; after that it is £${was.toLocaleString("en-GB")}. Sign in to pay securely.`);
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
    project.updatedAt = payment.paidAt;
    await saveProject(db, project);
    return json({ ok: true, project });
  }

  return json({ error: "Unknown action." }, 400);
};
