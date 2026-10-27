import { json } from "./http.mjs";
import { getDb, getSession, loadProject, videoPrefix, videosOf, VIDEO_CHUNK, normaliseEmail, clean, safeEqual } from "./account-lib.mjs";

const isAdmin = (request) => {
  const expected = String(process.env.ADMIN_PASSWORD || "");
  const header = request.headers.get("authorization") || "";
  return expected.length >= 10 && header.startsWith("Bearer ") && safeEqual(header.slice(7), expected);
};

// Serves an uploaded diamond video one stored piece at a time (206 partial content), so large videos stream
// without hitting the function response size limit.
export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, { Allow: "GET" });
  const db = await getDb();
  const url = new URL(request.url);
  const projectId = clean(url.searchParams.get("p"), 40);
  let email = "";
  if (isAdmin(request)) email = normaliseEmail(url.searchParams.get("e"));
  else {
    const session = await getSession(db, request);
    if (!session) return json({ error: "signed_out" }, 401);
    email = session.email;
  }
  const project = email ? await loadProject(db, email, projectId) : null;
  const vids = project ? videosOf(project) : [];
  const want = clean(url.searchParams.get("v"), 24);
  const v = vids.find((x) => x.id === want) || (want ? null : vids[0]);
  if (!v) return json({ error: "Not found." }, 404);
  const total = v.size;

  let start = 0, end = total - 1;
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  if (m) {
    if (m[1] === "" && m[2] !== "") { start = Math.max(0, total - Number(m[2])); }
    else if (m[1] !== "") { start = Number(m[1]); if (m[2] !== "") end = Math.min(end, Number(m[2])); }
    if (start > end || start >= total) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
  }
  const idx = Math.floor(start / VIDEO_CHUNK);
  end = Math.min(end, (idx + 1) * VIDEO_CHUNK - 1); // one stored piece per response; the player asks for the next
  const data = await db.get(`${videoPrefix(email, projectId, v.id)}${idx}`, { type: "arrayBuffer" });
  if (!data) return json({ error: "Not found." }, 404);
  const body = data.slice(start - idx * VIDEO_CHUNK, end - idx * VIDEO_CHUNK + 1);
  return new Response(body, {
    status: 206,
    headers: {
      "Content-Type": v.type,
      "Content-Length": String(body.byteLength),
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
};
