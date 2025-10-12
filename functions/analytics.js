export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref");
  const postUrl = url.searchParams.get("url");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "";

  if (!ref || !postUrl) {
    return new Response(JSON.stringify({ status: "error", msg: "Missing params" }), { headers: { "Content-Type": "application/json" } });
  }

  await env.DB.prepare(
    `INSERT INTO clicks (partner_id, post_url, ip, user_agent) VALUES (?, ?, ?, ?)`
  ).bind(ref, postUrl, ip, ua).run();

  return new Response(JSON.stringify({ status: "ok" }), { headers: { "Content-Type": "application/json" } });
};
