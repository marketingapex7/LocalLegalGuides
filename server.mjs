import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { brotliCompress, gzip } from "node:zlib";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";

const root = path.join(process.cwd(), "dist");
const port = Number(process.env.PORT ?? 4173);
const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self'",
  "img-src 'self' data:",
  "frame-src https://maps.google.com https://www.google.com",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const requested = decoded.endsWith("/") ? `${decoded}index.html` : decoded;
  const resolved = path.resolve(root, `.${requested}`);
  const relative = path.relative(root, resolved);
  const isInsideRoot = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  return isInsideRoot ? resolved : null;
}

function cacheControl(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".html") {
    return "no-cache";
  }

  if (ext === ".css" || ext === ".js") {
    return "public, max-age=3600, must-revalidate";
  }

  return "public, max-age=300";
}

function isCompressible(filePath) {
  return [".html", ".css", ".js", ".xml", ".txt"].includes(path.extname(filePath));
}

async function encodeBody(req, filePath, body) {
  if (!isCompressible(filePath) || body.length < 1024) {
    return { body };
  }

  const accepted = req.headers["accept-encoding"] ?? "";

  if (accepted.includes("br")) {
    return { body: await brotliAsync(body), encoding: "br" };
  }

  if (accepted.includes("gzip")) {
    return { body: await gzipAsync(body), encoding: "gzip" };
  }

  return { body };
}

createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Content-Security-Policy", contentSecurityPolicy);

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method not allowed");
    return;
  }

  try {
    let filePath = safePath(new URL(req.url, `http://localhost:${port}`).pathname);
    if (!filePath) {
      throw new Error("Invalid path");
    }
    const fileStat = await stat(filePath).catch(() => null);

    if (fileStat?.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const body = await readFile(filePath);
    const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;

    res.setHeader("Cache-Control", cacheControl(filePath));
    res.setHeader("Content-Type", types[path.extname(filePath)] ?? "application/octet-stream");
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) {
      res.statusCode = 304;
      res.end();
      return;
    }

    if (req.method === "HEAD") {
      res.setHeader("Content-Length", body.length);
      res.end();
      return;
    }

    const encoded = await encodeBody(req, filePath, body);
    if (encoded.encoding) {
      res.setHeader("Content-Encoding", encoded.encoding);
      res.setHeader("Vary", "Accept-Encoding");
    }
    res.end(encoded.body);
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
  }
}).listen(port, () => {
  console.log(`Local Legal Guides running at http://localhost:${port}`);
});
