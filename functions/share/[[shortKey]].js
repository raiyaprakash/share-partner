export async function onRequestGet(context) {
  const { params, env } = context;
  const { shortKey } = params;

  try {
    console.log("Short key:", shortKey);

    const record = await env.URLS.get(shortKey);
    console.log("KV record:", record);

    if (!record) return new Response("Short URL not found", { status: 404 });

    const data = JSON.parse(record);
    console.log("Parsed data:", data);

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
  } catch (err) {
    console.error("Error:", err);
    return new Response("Internal error: " + err.message, { status: 500 });
  }
}
