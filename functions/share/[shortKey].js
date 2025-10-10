export async function onRequestGet(context) {
  const { params, env } = context;
  const { shortKey } = params;

  if (!shortKey) {
    return new Response("Short key missing", { status: 400 });
  }

  const record = await env.URLS.get(shortKey);
  if (!record) {
    return new Response("Short URL not found", { status: 404 });
  }

  const data = JSON.parse(record);

  // Prepare redirect response
  const response = Response.redirect(data.originalUrl, 302);

  // Create cookie value
  const cookieValue = `userId=${encodeURIComponent(data.userId)}; shortKey=${encodeURIComponent(shortKey)}`;

  // Set cookie for 5 minutes (300 seconds)
  const expires = new Date(Date.now() + 5 * 60 * 1000).toUTCString();
  response.headers.append(
    "Set-Cookie",
    `share_info=${encodeURIComponent(cookieValue)}; Path=/; Max-Age=300; Expires=${expires}; SameSite=None; Secure`
  );

  return response;
}
