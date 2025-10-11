export async function onRequestGet({ params, env }) {
  try {
    const LINKS = env.LINKS;
    const shortKey = params.shortKey;

    if (!shortKey) {
      return new Response("⚠️ Short key missing.", { status: 400 });
    }

    const value = await LINKS.get(shortKey);

    if (!value) {
      return new Response("❌ Link not found.", { status: 404 });
    }

    // Handle if value accidentally stored as JSON
    let target = value;
    try {
      const parsed = JSON.parse(value);
      if (parsed.url) target = parsed.url;
    } catch (_) {}

    // Ensure valid URL
    if (!/^https?:\/\//.test(target)) {
      return new Response("⚠️ Invalid URL format.", { status: 400 });
    }

    return Response.redirect(target, 302);
  } catch (err) {
    return new Response(`⚠️ Server Error: ${err.message}`, { status: 500 });
  }
}
