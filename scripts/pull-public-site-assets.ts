/**
 * Read-only pull of public pages and images from www.sconeteaparty.co.uk.
 * GET requests only. Never calls a Wix write, create, update, or delete API.
 * Saves pictures under public/wix-clone-assets and a manifest at data/public-site-assets.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const HOME = "https://www.sconeteaparty.co.uk/";
const PAGE_HOSTS = new Set(["www.sconeteaparty.co.uk", "sconeteaparty.co.uk"]);
const IMAGE_HOST_PATTERN =
  /(?:^|\.)(?:sconeteaparty\.co\.uk|wixstatic\.com|parastorage\.com|wixmp\.com)$/i;
const ROUTE_HINT = /menu|gallery|order|catering|afternoon|scone|shop|food|cake|platter|grazing/i;
const SKIP_IMAGE = /favicon|sprite|pixel|spacer|blank|icon|facebook|instagram|pinterest|tiktok|youtube|whatsapp|tripadvisor|twitter|google|star|payment|visa|mastercard|logo-wix|wix-logo/i;
const MAX_PAGES = 8;
const MAX_IMAGES = 100;
const MAX_HTML_BYTES = 3_000_000;
const MAX_IMAGE_BYTES = 5_000_000;
const MIN_IMAGE_BYTES = 8_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface PageRecord {
  url: string;
  headings: string[];
}

interface ImageRecord {
  sourceUrl: string;
  localPath: string;
  alt: string;
  heading: string;
  pageUrl: string;
  role: "logo" | "og" | "content";
}

interface Manifest {
  pulledAt: string;
  source: string;
  pages: PageRecord[];
  images: ImageRecord[];
  logo?: { sourceUrl: string; localPath: string };
}

function decode(value: string): string {
  return value
    .replace(/\\u0026/gi, "&")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value: string): string {
  return decode(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsolute(raw: string, base: string): string | null {
  const cleaned = decode(raw).trim().replace(/^['"]|['"]$/g, "");
  if (!cleaned || cleaned.startsWith("data:") || cleaned.startsWith("javascript:") || cleaned.startsWith("#")) {
    return null;
  }
  try {
    const url = new URL(cleaned, base);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function hostnameOf(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function isPageUrl(value: string): boolean {
  const host = hostnameOf(value);
  return Boolean(host && PAGE_HOSTS.has(host));
}

function isImageHost(value: string): boolean {
  const host = hostnameOf(value);
  return Boolean(host && IMAGE_HOST_PATTERN.test(host));
}

function largestSrcset(srcset: string, base: string): string | null {
  let bestUrl: string | null = null;
  let bestWidth = -1;
  for (const part of srcset.split(",")) {
    const bits = part.trim().split(/\s+/);
    const url = bits[0] ? toAbsolute(bits[0], base) : null;
    if (!url) continue;
    const width = Number((bits[1] ?? "").replace(/[^\d.]/g, "")) || 0;
    if (width >= bestWidth) {
      bestWidth = width;
      bestUrl = url;
    }
  }
  return bestUrl;
}

function collectPageLinks(html: string, pageUrl: string): string[] {
  const links = new Set<string>();
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const absolute = toAbsolute(match[1], pageUrl);
    if (!absolute || !isPageUrl(absolute)) continue;
    const text = stripTags(match[2]);
    const path = new URL(absolute).pathname;
    if (/\.pdf($|\?)/i.test(path)) continue;
    if (ROUTE_HINT.test(path) || ROUTE_HINT.test(text) || ROUTE_HINT.test(absolute)) {
      links.add(absolute.split("#")[0]);
    }
  }
  return [...links];
}

function collectHeadings(html: string): string[] {
  const headings: string[] = [];
  const pattern = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const text = stripTags(match[1]);
    if (text && text.length < 120 && !headings.includes(text)) headings.push(text);
  }
  return headings;
}

interface FoundImage {
  sourceUrl: string;
  alt: string;
  heading: string;
  role: ImageRecord["role"];
}

function collectImages(html: string, pageUrl: string): FoundImage[] {
  const found = new Map<string, FoundImage>();
  const remember = (raw: string | null, alt: string, heading: string, role: ImageRecord["role"]) => {
    if (!raw) return;
    const sourceUrl = toAbsolute(raw, pageUrl);
    if (!sourceUrl || !isImageHost(sourceUrl)) return;
    if (SKIP_IMAGE.test(sourceUrl) || SKIP_IMAGE.test(alt)) return;
    const existing = found.get(mediaKey(sourceUrl));
    if (!existing) {
      found.set(mediaKey(sourceUrl), { sourceUrl, alt, heading, role });
      return;
    }
    if (!existing.alt && alt) existing.alt = alt;
    if (!existing.heading && heading) existing.heading = heading;
    if (existing.role === "content" && role !== "content") existing.role = role;
  };

  const og = html.match(/<meta\b[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<meta\b[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:image["'][^>]*>/i);
  if (og?.[1]) remember(og[1], "og:image", "", "og");

  let heading = "";
  const token = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>|<img\b[^>]*>|<source\b[^>]*>|url\(\s*['"]?([^'")]+)['"]?\s*\)|https?:\\?\/\\?\/static\.wixstatic\.com\\?\/media\\?\/[^\s"'<>\\]+/gi;
  let match: RegExpExecArray | null;
  while ((match = token.exec(html))) {
    const chunk = match[0];
    if (/^<h[1-3]/i.test(chunk)) {
      heading = stripTags(chunk);
      continue;
    }
    if (/^<img\b/i.test(chunk)) {
      const alt = stripTags(attr(chunk, "alt") ?? "");
      const role: ImageRecord["role"] = /logo|brand/i.test(`${alt} ${chunk}`) ? "logo" : "content";
      remember(attr(chunk, "src"), alt, heading, role);
      remember(attr(chunk, "data-src"), alt, heading, role);
      const srcset = attr(chunk, "srcset") ?? attr(chunk, "data-srcset");
      if (srcset) remember(largestSrcset(srcset, pageUrl), alt, heading, role);
      continue;
    }
    if (/^<source\b/i.test(chunk)) {
      const srcset = attr(chunk, "srcset") ?? attr(chunk, "data-srcset");
      if (srcset) remember(largestSrcset(srcset, pageUrl), "", heading, "content");
      continue;
    }
    if (chunk.startsWith("url(") && match[2] && /\.(?:jpe?g|png|webp|gif|avif)|wixstatic\.com\/media\//i.test(match[2])) {
      remember(match[2], "", heading, "content");
      continue;
    }
    if (/wixstatic\.com\/media\//i.test(chunk)) {
      remember(chunk.replace(/\\\//g, "/"), "", heading, "content");
    }
  }

  return [...found.values()];
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decode(match[1]) : null;
}

async function fetchBuffer(url: string, accept: string): Promise<{ bytes: Buffer; type: string } | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: accept, "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      console.log(`Skip ${response.status} ${url}`);
      return null;
    }
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > MAX_IMAGE_BYTES) {
      console.log(`Skip oversized ${url}`);
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > (accept.startsWith("text") ? MAX_HTML_BYTES : MAX_IMAGE_BYTES)) {
      console.log(`Skip oversized body ${url}`);
      return null;
    }
    return { bytes, type: (response.headers.get("content-type") ?? "").toLowerCase() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    console.log(`Skip ${url} (${message})`);
    return null;
  }
}

function imageKind(bytes: Buffer, contentType: string): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF89a") return "gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") return "avif";
  const head = bytes.subarray(0, 200).toString("utf8").trimStart().toLowerCase();
  if ((contentType.includes("svg") || head.startsWith("<svg") || head.startsWith("<?xml")) && head.includes("<svg")) return "svg";
  if (contentType.startsWith("image/jpeg")) return "jpg";
  if (contentType.startsWith("image/png")) return "png";
  if (contentType.startsWith("image/webp")) return "webp";
  if (contentType.startsWith("image/gif")) return "gif";
  return null;
}

function mediaKey(sourceUrl: string): string {
  try {
    const path = new URL(sourceUrl).pathname;
    const media = path.split("/media/")[1]?.split("/")[0];
    if (media) return decodeURIComponent(media).replace(/~.*$/, "").toLowerCase();
  } catch {
    return sourceUrl;
  }
  return sourceUrl;
}

function largerWixUrl(sourceUrl: string): string {
  return sourceUrl.replace(/\/v1\/fill\/w_\d+,h_\d+[^/]*/i, "/v1/fill/w_960,h_720,al_c,q_80,usm_0.66_1.00_0.01");
}

function fileSlug(sourceUrl: string, extension: string, used: Set<string>): string {
  let leaf = "image";
  try {
    const path = new URL(sourceUrl).pathname;
    const media = path.split("/media/")[1]?.split("/")[0] ?? path.split("/").filter(Boolean).pop() ?? "image";
    leaf = decodeURIComponent(media).replace(/\.[a-z0-9]+$/i, "");
  } catch {
    leaf = "image";
  }
  const safe = leaf.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "image";
  let name = `${safe}.${extension}`;
  let count = 2;
  while (used.has(name)) {
    name = `${safe}-${count}.${extension}`;
    count += 1;
  }
  used.add(name);
  return name;
}

async function main(): Promise<void> {
  const pages: PageRecord[] = [];
  const images: ImageRecord[] = [];
  const seenPages = new Set<string>();
  const seenImages = new Set<string>();
  const seenMedia = new Set<string>();
  const usedNames = new Set<string>();
  const queue = [HOME];
  const assetDir = resolve(process.cwd(), "public", "wix-clone-assets");
  mkdirSync(assetDir, { recursive: true });

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const pageUrl = queue.shift();
    if (!pageUrl || seenPages.has(pageUrl)) continue;
    seenPages.add(pageUrl);
    console.log(`Page ${pageUrl}`);
    const result = await fetchBuffer(pageUrl, "text/html,application/xhtml+xml");
    if (!result || !/html|xml|text/.test(result.type)) {
      console.log(`Skip non-HTML page ${pageUrl}`);
      continue;
    }
    const html = result.bytes.toString("utf8");
    const headings = collectHeadings(html);
    pages.push({ url: pageUrl, headings });
    for (const link of collectPageLinks(html, pageUrl)) {
      if (!seenPages.has(link)) queue.push(link);
    }

    for (const image of collectImages(html, pageUrl)) {
      if (images.length >= MAX_IMAGES || seenImages.has(image.sourceUrl)) continue;
      const key = mediaKey(image.sourceUrl);
      if (seenMedia.has(key)) continue;
      seenImages.add(image.sourceUrl);
      const upgraded = largerWixUrl(image.sourceUrl);
      let savedUrl = image.sourceUrl;
      let downloaded = upgraded === image.sourceUrl ? null : await fetchBuffer(upgraded, "image/*,*/*;q=0.8");
      if (downloaded) savedUrl = upgraded;
      if (!downloaded) downloaded = await fetchBuffer(image.sourceUrl, "image/*,*/*;q=0.8");
      if (!downloaded) continue;
      seenMedia.add(key);
      if (downloaded.bytes.byteLength < MIN_IMAGE_BYTES && image.role !== "logo") {
        console.log(`Skip tiny ${image.sourceUrl}`);
        continue;
      }
      const extension = imageKind(downloaded.bytes, downloaded.type);
      if (!extension) {
        console.log(`Skip non-image ${image.sourceUrl}`);
        continue;
      }
      const filename = fileSlug(image.sourceUrl, extension, usedNames);
      writeFileSync(resolve(assetDir, filename), downloaded.bytes);
      images.push({
        sourceUrl: savedUrl,
        localPath: `/wix-clone-assets/${filename}`,
        alt: image.alt,
        heading: image.heading,
        pageUrl,
        role: image.role,
      });
      console.log(`Saved ${filename}`);
    }
  }

  const logo = images.find((image) => image.role === "logo") ?? images.find((image) => image.role === "og");
  const manifest: Manifest = {
    pulledAt: new Date().toISOString(),
    source: HOME,
    pages,
    images,
    logo: logo ? { sourceUrl: logo.sourceUrl, localPath: logo.localPath } : undefined,
  };
  const outputPath = resolve(process.cwd(), "data", "public-site-assets.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote data/public-site-assets.json (${pages.length} pages, ${images.length} images).`);
  if (pages.length === 0) {
    console.error("No public HTML could be read. No Wix write was attempted.");
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Public asset pull failed.";
  console.error(message);
  process.exit(1);
});
