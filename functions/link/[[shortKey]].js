export async function onRequestGet({ params, env }) {
  const LINKS = env.LINKS;
  const shortKey = params.shortKey;

  if (!shortKey) {
    return new Response("⚠️ Short key is missing. Please use a valid link.", { status: 400 });
  }

  try {
    // Fetch value from KV as plain string
    const value = await LINKS.get(shortKey); // <-- make sure this is a plain string

    if (!value) {
      return new Response("❌ Short link not found.", { status: 404 });
    }

    // Ensure value is a string
    if (typeof value !== "string") {
      return new Response("❌ Stored value is not a valid URL string.", { status: 500 });
    }

    // Redirect
    return Response.redirect(value, 302);
  } catch (err) {
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
