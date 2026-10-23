import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", "tmp", "ladfox-stripe-checkout-starter"]);
const ignoredFiles = new Set(["Images/gallery.html"]);
const findPages = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  if (entry.isDirectory()) {
    if (ignoredDirectories.has(entry.name) || entry.name.startsWith("backup-before-")) return [];
    return findPages(join(directory, entry.name));
  }
  if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".html") return [];
  const file = relative(root, join(directory, entry.name)).split(sep).join("/");
  return ignoredFiles.has(file) ? [] : [file];
});
const pages = findPages(root).sort();
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
  if (/(?:available|open|support)[^<\n]{0,40}24\s*(?:\/\s*7|hours?)/i.test(html)) errors.push(`${file}: contains unsupported round-the-clock availability claim`);
  if (/\b(?:16416135|info@ladfox\.com)\b/i.test(html)) errors.push(`${file}: contains inconsistent company or contact details`);
  if (/ipapi\.co|ipinfo\.io|api\.ipify\.org/i.test(html)) errors.push(`${file}: contains third-party IP geolocation`);
  if (/\b(?:href|src|poster)=["']\s*["']/i.test(html)) errors.push(`${file}: contains an empty link or asset reference`);

  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    const attributes = match[1];
    if (/\btarget=["']_blank["']/i.test(attributes) && !/\brel=["'][^"']*\bnoopener\b/i.test(attributes)) {
      errors.push(`${file}: target=_blank link is missing rel=noopener`);
    }
  }

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
    if (!raw || /^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(raw)) continue;
    if (raw.startsWith("#")) {
      const anchor = decodeURIComponent(raw.slice(1));
      if (anchor && !new RegExp(`\\b(?:id|name)=["']${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i").test(html)) {
        errors.push(`${file}: unresolved page anchor ${raw}`);
      }
      continue;
    }
    const withoutQuery = raw.split(/[?#]/, 1)[0];
    if (!withoutQuery) continue;
    const decoded = decodeURIComponent(withoutQuery);
    if (decoded.startsWith("/")) {
      if (routeTargets.has(decoded)) continue;
      const target = join(root, decoded.slice(1));
      if (!existsSync(target) && !existsSync(`${target}.html`)) errors.push(`${file}: unresolved local reference ${raw}`);
    } else {
      const target = normalize(join(dirname(absolute), decoded));
      if (!existsSync(target) && !existsSync(`${target}.html`)) errors.push(`${file}: unresolved local reference ${raw}`);
    }
  }
}

if (!readFileSync(join(root, "_redirects"), "utf8").includes("/design/your-ring  /ringpage.html  200")) {
  errors.push("_redirects: canonical ring designer rewrite is missing");
}
if (!/<base\s+href=["']\/["']/i.test(readFileSync(join(root, "ringpage.html"), "utf8"))) {
  errors.push("ringpage.html: clean nested route requires a root base URL for relative assets");
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
if (!readFileSync(join(root, "_redirects"), "utf8").includes("/signature-collection.html  /classic-collection.html  301!")) {
  errors.push("_redirects: legacy Signature Collection redirect is missing");
}
if (!readFileSync(join(root, "sitemap.xml"), "utf8").includes("https://ladfox.com/classic-collection.html")) {
  errors.push("sitemap.xml: canonical Ring Collection URL is missing");
}
if (!readFileSync(join(root, "sitemap.xml"), "utf8").includes("https://ladfox.com/classic-solitaire.html")) {
  errors.push("sitemap.xml: Classic Solitaire URL is missing");
}
if (existsSync(join(root, "signature-collection.html"))) {
  errors.push("signature-collection.html: legacy page should remain a redirect, not a duplicate document");
}
for (const configurator of ["classic-solitaire.html", "trilogy-ring.html"]) {
  const html = readFileSync(join(root, configurator), "utf8");
  if (!/data-option-value=["']9k["'][^>]*>9kt</i.test(html)) {
    errors.push(`${configurator}: 9kt gold purity option is missing`);
  }
}

const netlifyIgnore = readFileSync(join(root, ".netlifyignore"), "utf8");
for (const excluded of ["Customers/", "1234/", "backup-before-seo-update-*/", ".env.example", "Images/gallery.html"]) {
  if (!netlifyIgnore.includes(excluded)) errors.push(`.netlifyignore: sensitive or unused path is not excluded: ${excluded}`);
}

const privacyControls = readFileSync(join(root, "assets/privacy-controls.js"), "utf8");
if (/cookie-consent|data-cookie-(?:accept|reject)|ladfox_cookie_choice/.test(privacyControls)) {
  errors.push("assets/privacy-controls.js: cookie or tracking popup code must remain disabled");
}

const classicCheckout = readFileSync(join(root, "netlify/functions/create-checkout-session.mjs"), "utf8");
if (!classicCheckout.includes('shipping_address_collection: { allowed_countries: ["GB"] }')) {
  errors.push("create-checkout-session.mjs: immediate-purchase shipping must remain UK-only");
}
if (!classicCheckout.includes('/checkout-success.html?session_id={CHECKOUT_SESSION_ID}')) {
  errors.push("create-checkout-session.mjs: success return URL is missing");
}
if (!classicCheckout.includes('returnPage = ["classic-solitaire.html", "signature-solitaire.html", "lab-gemstone-signature.html"]') ||
    !classicCheckout.includes('`${siteUrl}/${returnPage}?checkout=cancelled`')) {
  errors.push("create-checkout-session.mjs: Classic Solitaire cancellation URL is missing");
}

const cadCheckout = readFileSync(join(root, "netlify/functions/create-cad-checkout-session.mjs"), "utf8");
if (!cadCheckout.includes('/checkout-success.html?session_id={CHECKOUT_SESSION_ID}')) {
  errors.push("create-cad-checkout-session.mjs: success return URL is missing");
}
if (!cadCheckout.includes('/cad-design?checkout=cancelled')) {
  errors.push("create-cad-checkout-session.mjs: CAD cancellation URL is missing");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Site audit passed for ${pages.length} public pages.`);
}
