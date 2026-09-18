import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pages = [
  "index.html", "consultation.html", "diamonds.html", "contact-us.html",
  "ringpage.html", "ring-gallery.html", "about-us.html", "bracelets.html",
  "faq.html", "floral-ring.html", "trilogy-ring.html", "tantalum-ring.html",
  "ring-form.html", "trusted-suppliers.html", "thank-you.html",
  "advice/where-to-buy-an-engagement-ring.html", "checkout-success.html", "cad-service.html", "price-match.html",
  "create-your-own-ring.html", "lab-emerald-ring.html", "jewellery-design.html",
  "green-diamond-trilogy.html", "reviews.html", "advice.html", "necklaces.html",
  "signature-collection.html", "LG772667488.html", "privacy-policy.html", "cookie-policy.html",
  "returns-cancellations.html", "company-information.html", "terms-and-conditions.html",
  "advice/how-much-to-spend-on-an-engagement-ring.html",
  "advice/how-to-choose-a-diamond.html", "advice/lab-grown-diamonds-guide.html",
  "advice/how-to-find-ring-size-secretly.html", "advice/bespoke-engagement-ring-process.html"
];
const errors = [];
const titles = new Map();
const descriptions = new Map();
const routeTargets = new Set(["/design/your-ring", "/cad-design", "/price-beater", "/thank-you/", "/consultation"]);

const count = (text, pattern) => [...text.matchAll(pattern)].length;
const capture = (text, pattern) => text.match(pattern)?.[1]?.trim() || "";
const addUnique = (map, value, file, label) => {
  if (!value) return;
  if (map.has(value)) errors.push(`${file}: duplicate ${label} also used by ${map.get(value)}`);
  else map.set(value, file);
};

for (const file of pages) {
  const absolute = join(root, file);
  if (!existsSync(absolute)) {
    errors.push(`${file}: file is missing`);
    continue;
  }
  const html = readFileSync(absolute, "utf8");
  if (!/<html\b[^>]*\blang=["']en-GB["']/i.test(html)) errors.push(`${file}: lang must be en-GB`);
  if (count(html, /<h1\b/gi) !== 1) errors.push(`${file}: expected exactly one h1`);
  if (count(html, /<main\b/gi) !== 1) errors.push(`${file}: expected exactly one main landmark`);
  if (!/site-skip-link/.test(html)) errors.push(`${file}: missing shared skip link`);
  if (!/assets\/site-common\.css/.test(html)) errors.push(`${file}: missing shared accessibility CSS`);
  if (/available 24\/7/i.test(html)) errors.push(`${file}: contains unsupported 24/7 claim`);
  if (/ipapi\.co|ipinfo\.io|api\.ipify\.org/i.test(html)) errors.push(`${file}: contains third-party IP geolocation`);

  const title = capture(html, /<title>([\s\S]*?)<\/title>/i);
  const description = capture(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)/i);
  const canonical = capture(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)/i);
  const ogImage = capture(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)/i);
  if (!title) errors.push(`${file}: missing title`);
  if (!description && !/^(thank-you|checkout-success)\.html$/.test(file)) errors.push(`${file}: missing meta description`);
  if (!canonical && !/^(thank-you|checkout-success)\.html$/.test(file)) errors.push(`${file}: missing canonical`);
  if (!ogImage && !/^(thank-you|checkout-success)\.html$/.test(file)) errors.push(`${file}: missing Open Graph image`);
  addUnique(titles, title, file, "title");
  addUnique(descriptions, description, file, "description");

  if (/^(thank-you|checkout-success)\.html$/.test(file) && !/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) {
    errors.push(`${file}: transactional page must be noindexed`);
  }

  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(match[1]); } catch (error) { errors.push(`${file}: invalid JSON-LD (${error.message})`); }
  }

  for (const match of html.matchAll(/(?:href|src|poster)=(["'])(.*?)\1/gi)) {
    const raw = match[2].trim();
    if (!raw || /^(?:https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i.test(raw)) continue;
    const withoutQuery = raw.split(/[?#]/, 1)[0];
    if (!withoutQuery) continue;
    const decoded = decodeURIComponent(withoutQuery);
    if (decoded.startsWith("/")) {
      if (routeTargets.has(decoded)) continue;
      const target = join(root, decoded.slice(1));
      if (!existsSync(target)) errors.push(`${file}: unresolved local reference ${raw}`);
    } else {
      const target = normalize(join(dirname(absolute), decoded));
      if (!existsSync(target)) errors.push(`${file}: unresolved local reference ${raw}`);
    }
  }
}

if (!readFileSync(join(root, "_redirects"), "utf8").includes("/design/your-ring  /ringpage.html  200")) {
  errors.push("_redirects: canonical ring designer rewrite is missing");
}
if (extname(join(root, "sitemap.xml")) !== ".xml" || !readFileSync(join(root, "sitemap.xml"), "utf8").includes("https://ladfox.com/design/your-ring")) {
  errors.push("sitemap.xml: canonical ring designer URL is missing");
}
if (!readFileSync(join(root, "_redirects"), "utf8").includes("/cad-design  /cad-service.html  200")) {
  errors.push("_redirects: canonical CAD service rewrite is missing");
}
if (!readFileSync(join(root, "sitemap.xml"), "utf8").includes("https://ladfox.com/cad-design")) {
  errors.push("sitemap.xml: canonical CAD service URL is missing");
}
if (!readFileSync(join(root, "_redirects"), "utf8").includes("/price-beater  /price-match.html  200")) {
  errors.push("_redirects: canonical price-beater rewrite is missing");
}
if (!readFileSync(join(root, "sitemap.xml"), "utf8").includes("https://ladfox.com/price-beater")) {
  errors.push("sitemap.xml: canonical price-beater URL is missing");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Site audit passed for ${pages.length} public pages.`);
}
