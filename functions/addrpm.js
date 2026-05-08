export const onRequest = async ({ request, env }) => {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // OPTIONS
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only POST
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        status: "error",
        msg: "Method not allowed"
      }),
      { headers: corsHeaders }
    );
  }

  try {
    // 🔥 Find all partner_views rows where rpm is blank/null/0
    const rows = await env.DB.prepare(`
      SELECT pv.id, pv.partner_id
      FROM partner_views pv
      WHERE
        pv.rpm IS NULL
        OR pv.rpm = ''
        OR pv.rpm = 0
    `).all();

    if (!rows.results.length) {
      return new Response(
        JSON.stringify({
          status: "ok",
          msg: "No blank RPM rows found"
        }),
        { headers: corsHeaders }
      );
    }

    let updated = 0;

    for (const row of rows.results) {

      // 🔥 Get RPM from partners table
      const partner = await env.DB.prepare(`
        SELECT rpm
        FROM partners
        WHERE partner_id = ?
        LIMIT 1
      `)
      .bind(row.partner_id)
      .first();

      // Skip if no rpm found
      if (!partner || partner.rpm == null || partner.rpm === '') {
        continue;
      }

      // 🔥 Update partner_views rpm
      await env.DB.prepare(`
        UPDATE partner_views
        SET rpm = ?
        WHERE id = ?
      `)
      .bind(partner.rpm, row.id)
      .run();

      updated++;
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        updated
      }),
      { headers: corsHeaders }
    );

  } catch (err) {
    console.error(err);

    return new Response(
      JSON.stringify({
        status: "error",
        msg: err.message
      }),
      { headers: corsHeaders }
    );
  }
};
