export async function onRequestGet({ params, env }) {
  const LINKS = env.LINKS; // ✅ Get KV binding
  const shortKey = params.shortKey;

  // Handle missing shortKey
  if (!shortKey) {
    return new Response("⚠️ Short key is missing. Please use a valid link.", { status: 400 });
  }

  try {
    // --- Try fetching from KV ---
    const value2 = await env.LINKS.get(shortKey);

    if (value2) {
return new Response(shortKey+" ty "+value2);
    }

    // --- Not found in KV ---
    return new Response("❌ Short link not found.", { status: 404 });
  } catch (err) {
    // --- Handle unexpected errors ---
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}
