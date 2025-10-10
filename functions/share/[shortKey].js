export async function onRequestGet(context) {
  const { params, env } = context;
  const shortKey = params.shortKey;

  if (!shortKey) return new Response("Short key missing", { status: 400 });

  // Always get KV as string
  const record = await env.URLS.get(shortKey, "text");
  if (!record) return new Response("Short URL not found", { status: 404 });

  let data;
  try {
    data = JSON.parse(record); // record must be string JSON
  } catch {
    return new Response("KV record is not valid JSON", { status: 500 });
  }

  const response = Response.redirect(data.originalUrl, 302);

  // Set cookies for 5 minutes
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
