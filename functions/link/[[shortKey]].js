export async function onRequestGet({ params, env }) {
  const LINKS = env.LINKS; // ✅ Get KV binding
  const shortKey = params.shortKey;

  // Handle missing shortKey
  if (!shortKey) {
    return new Response("⚠️ Short key is missing. Please use a valid link.", { status: 400 });
  }

  try {
    // --- Try fetching from KV ---
    const value = await LINKS.get(shortKey);

    if (value) {
return new Response(shortKey+" "+value, { status: 404 });
    }

    // --- Not found in KV ---
    return new Response("❌ Short link not found.", { status: 404 });
  } catch (err) {
    // --- Handle unexpected errors ---
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
