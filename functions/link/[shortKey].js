export async function onRequest(context) {
  const { request, env, params } = context;
  const LINKS = env.LINKS; // KV binding
  const url = new URL(request.url);
  const shortKey = params.shortKey; // Dynamic path param
  const { searchParams } = url;
  const ref = searchParams.get("ref");

  // --- Handle trailing '*' ---
  if (url.pathname.endsWith("*")) {
    url.pathname = url.pathname.slice(0, -1);
    return Response.redirect(url.toString(), 302);
  }

  // --- Cookie helper ---
  function setCookie(name, value, options = {}) {
    let cookie = `${name}=${encodeURIComponent(value)}`;
    if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
    if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
    if (options.path) cookie += `; Path=${options.path}`;
    if (options.domain) cookie += `; Domain=${options.domain}`;
    if (options.httpOnly) cookie += `; HttpOnly`;
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
    if (options.secure) cookie += `; Secure`;
    return cookie;
  }

  // --- If shortKey is provided, fetch from KV ---
  if (shortKey) {
    try {
      const value = await LINKS.get(shortKey);

      if (value) {
        try {
          // Validate stored value is a valid URL
          new URL(value);

          const headers = new Headers();
          headers.set("Referrer-Policy", "no-referrer");

          // If ref param is present, set cookies
          if (ref) {
            headers.append(
              "Set-Cookie",
              setCookie("ref_id", ref, {
                path: "/",
                maxAge: 300,
                secure: true,
                sameSite: "None",
              })
            );
            headers.append(
              "Set-Cookie",
              setCookie("page_id", shortKey, {
                path: "/",
                maxAge: 300,
                secure: true,
                sameSite: "None",
              })
            );
          }

          // Redirect to the stored value
          headers.set("Location", value);
          return new Response(null, {
            status: 302,
            headers,
          });
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
  return Response.redirect("https://a.sharelinks.in/", 302);
}
