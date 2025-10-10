export async function onRequestPost(context) {
  const { env, request } = context;

  // Ensure it's a POST request
  if (request.method !== "POST") {
    return jsonResponse({ error: "Only POST method allowed" }, 405);
  }

  let data;
  try {
    // Try parsing JSON safely
    data = await request.json();
  } catch (err) {
    return jsonResponse({ error: "Invalid JSON format" }, 400);
  }

  const originalUrl = data?.url;
  const userId = data?.userId;

  // Validate fields
  if (!userId) return jsonResponse({ error: "userId is required" }, 400);
  if (!originalUrl) return jsonResponse({ error: "url is required" }, 400);

  // Generate a short key
  const shortKey = Math.random().toString(36).substring(2, 8);

  // Save in Cloudflare KV
  try {
    await env.URLS.put(
      shortKey,
      JSON.stringify({
        originalUrl,
        userId,
        createdAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    return jsonResponse({ error: "Failed to save to KV" }, 500);
  }

  // Build final short URL
  const shortUrl = `https://a.sharelinks.in/share/${shortKey}`;

  return jsonResponse({ shortUrl, userId });
}

// Helper for JSON responses
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
