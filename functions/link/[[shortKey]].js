export async function onRequestGet({ params, env }) {
  const LINKS = env.LINKS; // Your KV binding
  const shortKey = params.shortKey;

  // Check if shortKey is provided
  if (!shortKey) {
    return new Response("⚠️ Short key is missing. Please use a valid link.", { status: 400 });
  }

  // --- Redirect if key exists ---
  const value = await LINKS.get(path);
  if (value) {
    return new Response("Not Found"+value);;
  }

  // --- 404 ---
  return new Response("Not Found", { status: 404 });
}
