export async function onRequestGet({ request, env, params }) {
  const LINKS = env.LINKS; // KV binding
  const url = new URL(request.url);
  const path = params.path || params.shortKey; // Handle [[path]] or [[shortKey]] dynamic routes

  // Handle trailing '*' — remove it and redirect
  if (url.pathname.endsWith('*')) {
    url.pathname = url.pathname.slice(0, -1);
    return Response.redirect(url.toString(), 302);
  }

  // If we have a path/shortKey, try to fetch from KV
  if (path) {
    const value = await LINKS.get(path);

    if (value) {
      return Response.redirect(value, 302);
    } else {
      return new Response("⚠️ Not Found", { status: 404 });
    }
  }

  // Default redirect (homepage or fallback)
 // return Response.redirect("https://sharelinks.in/", 302);
}
