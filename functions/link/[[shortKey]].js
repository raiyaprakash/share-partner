
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
  const LINKS = env.LINKS;
  const value33 = await LINKS.get("64QWB6");

  return new Response(value33);
}


/*

export async function onRequestGet({ params, env }) {
  try {
    const LINKS = env.LINKS;
    const shortKey = params.shortKey;

    if (!shortKey) {
      return new Response("⚠️ Short key missing.", { status: 400 });
    }

    const value = await LINKS.get(shortKey);

    if (!value) {
      return new Response("❌ Link not found.", { status: 404 });
    }

    // Handle if value accidentally stored as JSON
    let target = value;
    try {
      const parsed = JSON.parse(value);
      if (parsed.url) target = parsed.url;
    } catch (_) {}

    // Ensure valid URL
    if (!/^https?:\/\//.test(target)) {
      return new Response("⚠️ Invalid URL format.", { status: 400 });
    }

    return Response.redirect(target, 302);
  } catch (err) {
    return new Response(`⚠️ Server Error: ${err.message}`, { status: 500 });
  }
}*/
