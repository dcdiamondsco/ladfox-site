export const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  }
});

export const readJsonBody = async (request, maxBytes = 20_000) => {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Request must use JSON.");
  }

  const contentLength = Number.parseInt(request.headers.get("content-length") || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("Request is too large.");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > maxBytes) {
    throw new Error("Request is too large.");
  }

  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new Error("Invalid JSON request.");
  }
};

export const cleanMetadata = (value, maxLength = 450) => String(value ?? "").trim().slice(0, maxLength);

export const getSiteUrl = (request) => {
  const configured = String(process.env.SITE_URL || "").trim();
  const candidate = configured || new URL(request.url).origin;
  const url = new URL(candidate);
  if (!/^https?:$/.test(url.protocol)) throw new Error("SITE_URL is invalid.");
  return url.origin;
};
