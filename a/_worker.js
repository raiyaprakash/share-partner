export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const LINKS = env.LINKS; // KV binding

    // Extract path part after first slash (e.g., /abc → "abc")
    const pathPart = url.pathname.split("/")[1];

    // Handle wildcard paths ending with '*'
    if (url.pathname.endsWith("*")) {
      url.pathname = url.pathname.slice(0, -1);
      return Response.redirect(url.toString(), 302);
    }

    // If a short key is present (e.g., /abc)
    if (pathPart) {
      const value = await LINKS.get(pathPart);
      if (value) {
        return Response.redirect(value, 302);
      } else {
        return new Response("⚠️ Invalid short link or not found.", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
    }

    // If no path provided, redirect to homepage
    return Response.redirect("https://partner.sharelinks.in/", 302);
  },
};
