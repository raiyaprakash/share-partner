export async function onRequestGet({ params, env }) {
  const LINKS = env.LINKS; // KV binding
  const shortKey = params.shortKey; // dynamic key from [[shortKey]]

  // Handle missing shortKey
  if (!shortKey) {
    return new Response("⚠️ Short key is missing. Please use a valid link.", {
      status: 400,
    });
  }

  // --- Get value from KV ---
  let value;
  try {
    value = await LINKS.get(shortKey);
  } catch (err) {
    return new Response("⚠️ Server Error: Unable to fetch from KV.", {
      status: 500,
    });
  }

  // --- Redirect or return 404 ---
  if (value) {
    return Response.redirect(value, 302);
  } else {
    return new Response("❌ Link Not Found.", { status: 404 });
  }
}
