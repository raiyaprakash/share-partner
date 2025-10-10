export async function onRequestGet(context) {
  const { params, env } = context;

  try {
    const shortKey = params.shortKey;

    if (!shortKey) {
      return new Response("Short key missing", { status: 400 });
    }

    // Ensure KV binding exists
    if (!env.URLS) {
      return new Response("KV binding 'URLS' not found", { status: 500 });
    }

    const record = await env.URLS.get(shortKey);

    if (!record) {
      return new Response("Short URL not found", { status: 404 });
    }

    let data;
    try {
      data = JSON.parse(record);
    } catch (err) {
      return new Response("Corrupt data in KV for this key", { status: 500 });
    }

    // Build redirect response
    const response = Response.redirect(data.originalUrl, 302);

    // Set cookie (5 minutes)
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
  } catch (err) {
    return new Response("Internal error: " + err.message, { status: 500 });
  }
}
