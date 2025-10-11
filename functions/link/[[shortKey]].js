export async function onRequestGet({ params, env }) {
  const LINKS = env.LINKS;
  const shortKey = params.shortKey;

  if (!shortKey) {
    return new Response("⚠️ Short key is missing. Please use a valid link.", { status: 400 });
  }

  try {
    // Fetch value from KV as plain string
    const value = await LINKS.get(shortKey);

    if (!value) {
      return new Response("❌ Short link not found.", { status: 404 });
    }

    // Make sure it's a string (just in case)
    const url = String(value);

    // Redirect
    return Response.redirect(url, 302);
  } catch (err) {
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
