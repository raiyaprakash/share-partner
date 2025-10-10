export async function onRequestGet({ params, env }) {
  const shortKey = params.shortKey;
  if (!shortKey) return new Response("Short key missing", { status: 400 });

  let record;
  try {
    record = await env.URLS.get(shortKey, "text"); // always text
    if (!record) return new Response("Short URL not found", { status: 404 });
  } catch (err) {
    return new Response("Error reading KV: " + err.message, { status: 500 });
  }

  let data;
  try {
    data = JSON.parse(record); // record must be JSON string
  } catch (err) {
    return new Response("KV record is not valid JSON: " + err.message, { status: 500 });
  }

  const response = Response.redirect(data.originalUrl, 302);

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
