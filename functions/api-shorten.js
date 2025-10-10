export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const originalUrl = data.url;
  const userId = data.userId;

  if (!originalUrl) return new Response(JSON.stringify({ error: "url is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  if (!userId) return new Response(JSON.stringify({ error: "userId is required" }), { status: 400, headers: { "Content-Type": "application/json" } });

  // Generate 6-char short key
  const shortKey = Math.random().toString(36).substring(2, 8);

  // Store in KV (as JSON string)
  await env.URLS.put(shortKey, JSON.stringify({
    originalUrl,
    userId,
    createdAt: new Date().toISOString()
  }));

  return new Response(JSON.stringify({
    shortUrl: `${request.url.replace(/\/api-shorten$/, "")}/share/${shortKey}`,
    userId
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}
