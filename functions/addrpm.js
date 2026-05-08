export const onRequest = async ({ request, env }) => {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // OPTIONS
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ✅ Only GET allowed
  if (request.method !== "GET") {
    return new Response(
      JSON.stringify({
        status: "error",
        msg: "Only GET method allowed"
      }),
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  try {

    // 🔥 Find blank RPM rows
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

      // Skip if partner rpm not found
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
