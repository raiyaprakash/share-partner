export const onRequest = async ({ request, env }) => {
  const db = env.DB;
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref");
  const password = url.searchParams.get("password");
  const rpm = 0.35; // default RPM if not in DB

  if (!ref || !password)
    return new Response("Missing credentials", { status: 400 });

  // Verify partner
  const partner = await db
    .prepare("SELECT * FROM partners WHERE partner_id=? AND password=?")
    .bind(ref, password)
    .first();

  if (!partner)
    return new Response("<h3>Unauthorized</h3>", { status: 401 });
  
  const withdrawals = await db
    .prepare(
      `SELECT amount, created_at
       FROM withdrawals
       WHERE partner_id=?
       ORDER BY created_at DESC`
    )
    .bind(ref)
    .all();
  // --- HTML Dashboard
  return new Response(
    `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${partner.name} - Partner Dashboard</title>
  <style>
  @import url('https://fonts.googleapis.com/css2?family=Mukta:wght@200;300;400;500;600;700;800&display=swap');
    body { font-family: "Mukta", 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding:20px; background:#eef2f7; color:#333; max-width: 600px;
    margin: 0 auto; }
    h2 { color:#007BFF; }
    .stats { display:flex; flex-wrap:wrap; gap:15px; margin-bottom:20px; }
    .card { background:white; padding:15px 20px; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.1); flex:1 1 180px; }
    table { border-collapse:collapse; width:100%; background:white; margin-top:15px; box-shadow:0 2px 6px rgba(0,0,0,0.1); }
    th, td { border:1px solid #ccc; padding:10px; text-align:left; }
    th { background:#007BFF; color:white; }
    button { padding:10px 18px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer; }
    button:hover { background:#218838; }
    .responsive { overflow:auto; }
    .alert {
      background-color:#fff3cd; color:#856404; border:1px solid #ffeeba;
      padding:12px 18px; border-radius:8px; margin-bottom:20px;
      font-size:14px; box-shadow:0 2px 4px rgba(0,0,0,0.1);
    }
    .alert strong { color:#704214; }
  </style>
</head>
<body>
  <h2>💰 Withdrawal History</h2>
  <div class="responsive">
    <table><tr><th>Amount Paid</th><th>Date</th></tr>
    ${withdrawals.results
      .map(
        (w) => `
        <tr>
          <td>$${w.amount.toFixed(2)}</td>
          <td>${new Date(new Date(w.created_at).getTime() + 5.5*60*60*1000).toLocaleString('en-IN')}</td>
        </tr>`
      )
      .join("")}
    </table>
  </div>
</body>
</html>
    `,
    { headers: { "Content-Type": "text/html; charset=UTF-8" } }
  );
};
