import { json } from "./http.mjs";
import {
  getDb, getSession, loadProject, fileKey, normaliseEmail, clean, safeEqual
} from "./account-lib.mjs";

const isAdmin = (request) => {
  const expected = String(process.env.ADMIN_PASSWORD || "");
  const header = request.headers.get("authorization") || "";
  return expected.length >= 10 && header.startsWith("Bearer ") && safeEqual(header.slice(7), expected);
};

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, { Allow: "GET" });
  const db = await getDb();
  const url = new URL(request.url);
  const projectId = clean(url.searchParams.get("p"), 40);
  const fileId = clean(url.searchParams.get("f"), 40);

  let email = "";
  if (isAdmin(request)) {
    email = normaliseEmail(url.searchParams.get("e"));
  } else {
    const session = await getSession(db, request);
    if (!session) return json({ error: "signed_out" }, 401);
    email = session.email;
  }

  const project = email ? await loadProject(db, email, projectId) : null;
  const meta = project?.files?.find((f) => f.id === fileId);
  if (!meta) return json({ error: "Not found." }, 404);
  const data = await db.get(fileKey(email, projectId, fileId), { type: "arrayBuffer" });
  if (!data) return json({ error: "Not found." }, 404);

  const safeName = meta.name.replace(/[^\w .()-]/g, "_");
  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": meta.type,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
    }
  });
};
