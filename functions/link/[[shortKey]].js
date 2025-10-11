export async function onRequestGet({ params, env }) {
  const LINKS = env.LINKS; // KV binding
  const shortKey = params.shortKey;

  // Check if shortKey is provided
  if (!shortKey) {
    return new Response("⚠️ Short key is missing. Please use a valid link.", { status: 400 });
  }

  // --- Get the value from KV ---
  const value = await LINKS.get(shortKey);

  if (value) {
    // Redirect to the stored URL
    const data = JSON.parse(value); // Parse JSON
    return new Response("Not Found"+data);;
  }

  // --- 404 Not Found ---
  return new Response("Not Found", { status: 404 });
}
