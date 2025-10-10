export async function onRequestGet(context) {
  const { params, env } = context;
  const { shortKey } = params;

  try {
    if (!shortKey) return new Response("Short key missing", { status: 400 });

    // Read KV
    const record = await env.URLS.get(shortKey);
    if (!record) return new Response("Short URL not found", { status: 404 });

    // Parse JSON safely
    let data;
    try {
      data = JSON.parse(record);
    } catch (err) {
      return new Response("KV record is not valid JSON", { status: 500 });
    }

    // Redirect response
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
  } catch (err) {
    return new Response("Internal error: " + err.message, { status: 500 });
  }
}
