export async function onRequestGet(context) {
  const { params, env } = context;
  const { shortKey } = params;

  if (!shortKey) return new Response("Short key missing", { status: 400 });

  // Get the KV record (force text)
  let record = await env.URLS.get(shortKey, "text");

  if (!record) return new Response("Short URL not found", { status: 404 });

  // Handle both string and object (some KV bindings auto-convert to Map)
  let data;
  if (typeof record === "string") {
    try {
      data = JSON.parse(record);
    } catch {
      return new Response("KV record is not valid JSON", { status: 500 });
    }
  } else if (record instanceof Map || typeof record === "object") {
    // Convert Map/object to JSON safely
    data = Object.fromEntries(record instanceof Map ? record.entries() : Object.entries(record));
  } else {
    return new Response("KV record is in an unknown format", { status: 500 });
  }

  // Redirect response
  const response = Response.redirect(data.originalUrl, 302);

  // Set 5-min cookies
  const expires = new Date(Date.now() + 5 * 60 * 1000).toUTCString();
  response.headers.append(
    "Set-Cookie",
    `userId=${encodeURIComponent(data.userId)}; Path=/; Max-Age=300; Expires=${expires}; SameSite=None; Secure`
  );
  response.headers.append(
    "Set-Cookie",
    `shortKey=${encodeURIComponent(shortKey)}; Path=/; Max-Age=300; Expires=${expires}; SameSite=None; Secure`
  );

  return response;
}
