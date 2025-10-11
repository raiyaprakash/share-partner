export async function onRequest(context) {
  const { request, env, params } = context;
  const LINKS = env.LINKS; // KV binding
  const url = new URL(request.url);
  const shortKey = params.shortKey; // Dynamic path param

  // --- Handle trailing '*' ---
  if (url.pathname.endsWith('*')) {
    url.pathname = url.pathname.slice(0, -1);
    return Response.redirect(url.toString(), 302);
  }

  // --- If shortKey is provided, fetch from KV ---
  if (shortKey) {
    try {
      const value = await LINKS.get(shortKey);

      if (value) {
        // Optional: validate that the stored value is a valid URL
        try {
          new URL(value);
          return Response.redirect(value, 302);
        } catch {
          return new Response("⚠️ Invalid URL format in KV", { status: 400 });
        }
      } else {
        return new Response("⚠️ Not Found", { status: 404 });
      }
    } catch (err) {
      return new Response("⚠️ Server Error: " + err.message, { status: 500 });
    }
  }

  // --- Default redirect (fallback homepage) ---
  return Response.redirect("https://sharelinks.in/", 302);
}
