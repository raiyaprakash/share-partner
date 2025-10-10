export async function onRequestGet({ params, env }) {
  const shortKey = params.shortKey; // undefined if /share/ is visited

  // Handle missing shortKey
  if (!shortKey) {
    return new Response("⚠️ Short key is missing. Please use a valid link.", { status: 400 });
  }

  // Get KV record as text
  let record;
  try {
    record = await env.URLS.get(shortKey, "text"); // always string
    if (!record) return new Response("❌ Short URL not found", { status: 404 });
  } catch (err) {
    return new Response("❌ Error reading KV: " + err.message, { status: 500 });
  }

  // Parse JSON safely
  let data;
  try {
    data = JSON.parse(record);
  } catch (err) {
    return new Response("❌ KV record is not valid JSON: " + err.message, { status: 500 });
  }

  // Redirect to original URL
  const response = Response.redirect(data.originalUrl, 302);

  // Set 5-minute cookies
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
