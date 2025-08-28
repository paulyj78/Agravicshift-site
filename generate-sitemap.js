/**
 * Dynamic sitemap generator for Agravic Shift
 * - Recursively finds all .html files
 * - Builds canonical URLs
 * - Uses file mtime for <lastmod> (fallback to today)
 * - Skips non-public folders (assets, node_modules, .git, etc.)
 */

const fs = require("fs");
const path = require("path");

const BASE_URL = "https://www.agravicshift.com";

// Folders to skip when walking
const SKIP_DIRS = new Set([
  ".git", ".github", "node_modules", "assets", ".vercel", "scripts"
]);

// Files to skip by exact name (add any drafts if needed)
const SKIP_FILES = new Set([
  "404.html" // example
]);

function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(full, acc);
    } else if (e.isFile()) {
      if (e.name.endsWith(".html") && !SKIP_FILES.has(e.name)) {
        acc.push(full);
      }
    }
  }
  return acc;
}

function toUrl(filePath) {
  // Convert local path to a web path
  let rel = path.relative(process.cwd(), filePath).replace(/\\/g, "/");

  // Handle index.html as directory URL
  if (rel === "index.html") return `${BASE_URL}/`;
  if (rel.endsWith("/index.html")) {
    return `${BASE_URL}/${rel.slice(0, -"/index.html".length)}/`;
  }
  return `${BASE_URL}/${rel}`;
}

function isoDate(d) {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function getLastMod(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return isoDate(stat.mtime);
  } catch {
    return isoDate(new Date());
  }
}

function priorityFor(url) {
  // Simple priority heuristic
  if (url === `${BASE_URL}/`) return "1.0";
  if (url.endsWith("/toolkit.html") || url.endsWith("/pricing.html")) return "0.8";
  if (url.includes("/insights/")) return "0.6";
  return "0.7";
}

function build() {
  const files = walk(process.cwd());
  const urls = files
    // Only include files you actually publish to the web root
    .filter(p => !p.startsWith(path.join(process.cwd(), "insights", "drafts")))
    .map(p => ({
      loc: toUrl(p),
      lastmod: getLastMod(p),
      priority: priorityFor(toUrl(p))
    }))
    // Stable sort for cleaner diffs
    .sort((a, b) => a.loc.localeCompare(b.loc));

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n`;
  for (const u of urls) {
    xml += `  <url>\n`;
    xml += `    <loc>${u.loc}</loc>\n`;
    xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
    xml += `    <priority>${u.priority}</priority>\n`;
    xml += `  </url>\n`;
  }
  xml += `\n</urlset>\n`;

  fs.writeFileSync(path.join(process.cwd(), "sitemap.xml"), xml, "utf8");
  console.log(`✅ Generated sitemap.xml with ${urls.length} URLs`);
}

build();
