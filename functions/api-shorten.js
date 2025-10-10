export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // POST /shorten → create short URL
    if (url.pathname === "/shorten" && request.method === "POST") {
      let data;
      try {
        data = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }

      const originalUrl = data.url;
      const userId = data.userId;

      // Validate required fields
      if (!userId) return jsonResponse({ error: "userId is required" }, 400);
      if (!originalUrl) return jsonResponse({ error: "url is required" }, 400);

      // Generate short key (6 characters)
      const shortKey = Math.random().toString(36).substring(2, 8);

      // Save in KV
      await env.URLS.put(
        shortKey,
        JSON.stringify({
          originalUrl,
          userId,
          createdAt: new Date().toISOString()
        })
      );

      return jsonResponse({
        shortUrl: `${url.origin}/${shortKey}`,
        userId
      });
    }

    // GET /<shortKey> → redirect to original URL
    const shortKey = url.pathname.slice(1);
    if (shortKey) {
      const record = await env.URLS.get(shortKey);
      if (record) {
        const data = JSON.parse(record);
        return Response.redirect(data.originalUrl, 302);
      } else {
        return new Response("Short URL not found", { status: 404 });
      }
    }

    // Default home route
    return new Response("🔗 Cloudflare KV URL Shortener", { status: 200 });
  }
};

// Helper for JSON responses
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
