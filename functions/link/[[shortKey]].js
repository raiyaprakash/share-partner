export async function onRequest(context) {
  // Contents of context object
  const {
    request, // same as existing Worker API
    env, // same as existing Worker API
    params, // if filename includes [id] or [[path]]
    waitUntil, // same as ctx.waitUntil in existing Worker API
    next, // used for middleware or to fetch assets
    data, // arbitrary space for passing data between middlewares
  } = context;
  const LINKS = env.LINKS; // KV binding
  const url = new URL(request.url);
  const path = "J4z8aQ"; // Handle [[path]] or [[shortKey]] dynamic routes

  // Handle trailing '*' — remove it and redirect
  if (url.pathname.endsWith('*')) {
    url.pathname = url.pathname.slice(0, -1);
    return Response.redirect(url.toString(), 302);
  }

  // If we have a path/shortKey, try to fetch from KV
  if (path) {
    const value33 = await LINKS.get(path);

    if (value33) {
      return new Response(value33);
    } else {
      return new Response("⚠️ Not Found", { status: 404 });
    }
  }

  // Default redirect (homepage or fallback)
  return Response.redirect("https://sharelinks.in/", 302);
}
