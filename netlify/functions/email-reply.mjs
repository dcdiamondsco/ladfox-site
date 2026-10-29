import { json, readJsonBody } from "./http.mjs";
import { getDb, listProjects, saveProject, normaliseEmail, validEmail, safeEqual } from "./account-lib.mjs";

/* Called by the Google Apps Script that watches the LADFOX inbox. When a customer emails us,
   their open enquiry is marked "replied" automatically (no more ticking it by hand, and no nudge).
   Uses the same secret as the sheet logging (GOOGLE_SHEET_SECRET). */
export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  let body;
  try { body = await readJsonBody(request, 60_000); } catch (e) { return json({ error: e.message }, 400); }
  const expected = String(process.env.GOOGLE_SHEET_SECRET || "");
  if (expected.length < 10 || !safeEqual(String(body.secret || ""), expected)) return json({ error: "Not allowed." }, 401);

  const emails = [...new Set((Array.isArray(body.emails) ? body.emails : []).slice(0, 100).map(normaliseEmail).filter(validEmail))];
  const db = await getDb();
  const sentTo = [...new Set((Array.isArray(body.sent) ? body.sent : []).slice(0, 100).map(normaliseEmail).filter(validEmail))];
  const marked = [];
  // Emails YOU sent to a customer from Gmail: mark their enquiry as responded (unless they wrote back after, which resets it).
  for (const email of sentTo) {
    const projects = await listProjects(db, email);
    for (const p of projects) {
      if (p.type !== "design-request" || p.responded) continue;
      p.responded = true; p.respondedBy = "gmail"; p.respondedAt = new Date().toISOString();
      await saveProject(db, p);
      marked.push(`sent:${email}/${p.id}`);
    }
  }
  for (const email of emails) {
    const projects = await listProjects(db, email);
    for (const p of projects) {
      if (p.type !== "design-request") continue;
      if (p.replied && !p.responded) continue;
      p.replied = true;
      p.responded = false; p.respondedBy = ""; // they wrote to us, so it needs an answer again
      p.repliedAt = new Date().toISOString();
      p.repliedBy = "email";
      await saveProject(db, p);
      marked.push(`${email}/${p.id}`);
    }
  }
  return json({ ok: true, marked: marked.length });
};
