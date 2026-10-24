import { json, readJsonBody } from "./http.mjs";
import {
  getDb, getSession, getCustomer, loadProject, saveProject, clean, fileKey, newToken,
  FILE_TYPES, MAX_FILE_BYTES, sniffType, sendEmail, emailShell, escapeHtml, siteUrl
} from "./account-lib.mjs";

const MAX_CUSTOMER_FILES = 6;

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
  const db = await getDb();
  const session = await getSession(db, request);
  if (!session) return json({ error: "signed_out" }, 401);
  const email = session.email;

  let body;
  try { body = await readJsonBody(request, 6_000_000); } catch (e) { return json({ error: e.message }, 400); }

  const project = await loadProject(db, email, clean(body.id, 40));
  if (!project) return json({ error: "Request not found." }, 404);
  const mine = (project.files || []).filter((f) => f.by === "customer").length;
  if (mine >= MAX_CUSTOMER_FILES) return json({ error: "You have added the maximum number of photos." }, 400);

  let buf;
  try { buf = Buffer.from(String(body.data || ""), "base64"); } catch { return json({ error: "Invalid file." }, 400); }
  if (!buf.length || buf.length > MAX_FILE_BYTES) return json({ error: "Each photo must be under 4 MB." }, 400);
  const type = sniffType(buf);
  if (!FILE_TYPES[type] || type === "application/pdf") return json({ error: "Please upload a JPG, PNG or WebP image." }, 400);

  const fileId = newToken(9);
  const name = clean(body.name, 100).replace(/[^\w .()-]/g, "_") || `photo.${FILE_TYPES[type]}`;
  await db.set(fileKey(email, project.id, fileId), buf);
  const now = new Date().toISOString();
  project.files = [...(project.files || []), { id: fileId, name, type, size: buf.length, at: now, note: "Added by you", by: "customer" }];
  project.updatedAt = now;
  await saveProject(db, project);

  return json({ ok: true });
};
