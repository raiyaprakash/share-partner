export const onRequest = async ({ request, env }) => {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow only POST
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ status: "error", msg: "Method not allowed" }),
      { headers: corsHeaders }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ status: "error", msg: "Invalid JSON" }),
      { headers: corsHeaders }
    );
  }

  const ref = body.ref?.trim();
  if (!ref) {
    return new Response(
      JSON.stringify({ status: "error", msg: "Missing partner_id" }),
      { headers: corsHeaders }
    );
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    // ✅ Increment today's view count for this partner
    await env.DB.prepare(`
      INSERT INTO partner_views (partner_id, view_date, views)
      VALUES (?, ?, 1)
      ON CONFLICT(partner_id, view_date)
      DO UPDATE SET views = views + 1, updated_at = CURRENT_TIMESTAMP
    `)
    .bind(ref, today)
    .run();

    return new Response(
      JSON.stringify({ status: "ok" }),
      { headers: corsHeaders }
    );

  } catch (err) {
    console.error("DB Error:", err);
    return new Response(
      JSON.stringify({ status: "error", msg: "Database error" }),
      { headers: corsHeaders }
    );
  }
};
