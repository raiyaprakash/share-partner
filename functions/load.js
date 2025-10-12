export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const db = env.DB;
  const ref = url.searchParams.get("ref");
  const type = url.searchParams.get("type");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 10;
  const offset = (page - 1) * limit;

  if (type === "admin") {
    const rows = await db.prepare(`
      SELECT partner_id, COUNT(*) as views,
      MAX(created_at) as last_view, GROUP_CONCAT(DISTINCT ip) as ips
      FROM clicks
      GROUP BY partner_id
      ORDER BY views DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    return new Response(JSON.stringify(rows.results), { headers: { "Content-Type": "application/json" } });
  }

  if (type === "partner" && ref) {
    const rows = await db.prepare(`
      SELECT post_url, COUNT(*) as views, GROUP_CONCAT(DISTINCT ip) as ips
      FROM clicks WHERE partner_id=?
      GROUP BY post_url
      ORDER BY views DESC
      LIMIT ? OFFSET ?
    `).bind(ref, limit, offset).all();

    return new Response(JSON.stringify(rows.results), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ status: "error" }), { headers: { "Content-Type": "application/json" } });
};
