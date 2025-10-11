export async function onRequestGet({ params, env }) {
  const LINKS = env.LINKS; // Your KV binding
  const shortKey = params.shortKey;

  // Check if shortKey is provided
  if (!shortKey) {
    return new Response("⚠️ Short key is missing. Please use a valid link.", { status: 400 });
  }

  try {
    // Fetch value from KV
    let value = await LINKS.get(shortKey);

    if (!value) {
      return new Response("❌ Short link not found.", { status: 404 });
    }

    // Attempt to parse JSON if stored as JSON
    try {
      value = JSON.parse(value);
    } catch (e) {
      // Not JSON, keep as string
    }

    // Validate that it's a proper URL string
    if (typeof value !== "string" || !value.startsWith("http")) {
      return new Response("❌ Stored value is not a valid URL string.", { status: 500 });
    }

    // Redirect to the actual URL
    return Response.redirect(value, 302);

  } catch (err) {
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
