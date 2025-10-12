export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref");
  const postUrl = url.searchParams.get("url");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "";

  // CORS headers
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // allow all origins
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!ref || !postUrl) {
    return new Response(
      JSON.stringify({ status: "error", msg: "Missing params" }),
      { headers: corsHeaders }
    );
  }

  await env.DB.prepare(
    `INSERT INTO clicks (partner_id, post_url, ip, user_agent) VALUES (?, ?, ?, ?)`
  ).bind(ref, postUrl, ip, ua).run();

  return new Response(JSON.stringify({ status: "ok" }), { headers: corsHeaders });
};
