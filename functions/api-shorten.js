export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const data = await request.json();
    const originalUrl = data.url;
    const userId = data.userId;

    // Validate required fields
    if (!userId) {
      return jsonResponse({ error: "userId is required" }, 400);
    }
    if (!originalUrl) {
      return jsonResponse({ error: "url is required" }, 400);
    }

    // Generate a short key
    const shortKey = Math.random().toString(36).substring(2, 8);

    // Save in KV
    await env.URLS.put(
      shortKey,
      JSON.stringify({
        originalUrl,
        userId,
        createdAt: new Date().toISOString(),
      })
    );

    // Build final short URL
    const shortUrl = `https://a.sharelinks.in/share/${shortKey}`;

    return jsonResponse({ shortUrl, userId });
  } catch (err) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
}

// Helper for JSON responses
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
