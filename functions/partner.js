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

  // --- Stats
  const stats = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN DATE(created_at)=DATE('now','localtime') THEN 1 ELSE 0 END) AS today,
        SUM(CASE WHEN DATE(created_at)=DATE('now','-1 day','localtime') THEN 1 ELSE 0 END) AS yesterday,
        SUM(CASE WHEN strftime('%Y-%m', created_at)=strftime('%Y-%m','now','localtime') THEN 1 ELSE 0 END) AS this_month,
        SUM(CASE WHEN strftime('%Y-%m', created_at)=strftime('%Y-%m','now','-1 month','localtime') THEN 1 ELSE 0 END) AS last_month,
        COUNT(*) AS all_time
      FROM clicks WHERE partner_id=?`
    )
    .bind(ref)
    .first();

  const withdrawals = await db
    .prepare(
      `SELECT amount, created_at
       FROM withdrawals
       WHERE partner_id=?
       ORDER BY created_at DESC`
    )
    .bind(ref)
    .all();

  // --- Earnings
  const calc = (views) => ((views / 1000) * (partner.rpm || rpm)).toFixed(3);
  const totalEarned = (stats.all_time / 1000) * (partner.rpm || rpm);

  const withdrawalData = await db
    .prepare("SELECT SUM(amount) as withdrawn FROM withdrawals WHERE partner_id=?")
    .bind(ref)
    .first();

  const totalWithdrawn = withdrawalData.withdrawn || 0;
  const currentBalance = (totalEarned - totalWithdrawn).toFixed(3);

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
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding:20px; background:#eef2f7; color:#333; }
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
  <h2>👋 Welcome - ${partner.name}</h2>
  <div class="alert">⚠️ Note: Dashboard resets daily at <strong>05:30 AM IST</strong>.</div>

  <div class="stats">
    <div class="card">Today: ${stats.today} | 💰 $${calc(stats.today)}</div>
    <div class="card">Yesterday: ${stats.yesterday} | 💰 $${calc(stats.yesterday)}</div>
    <div class="card">This Month: ${stats.this_month} | 💰 $${calc(stats.this_month)}</div>
    <div class="card">Last Month: ${stats.last_month} | 💰 $${calc(stats.last_month)}</div>
    <div class="card">All Time: ${stats.all_time} | 💰 $${calc(stats.all_time)}</div>
    <div class="card">💵 Current Balance: $${currentBalance}</div>
    <div class="card">Total Withdrawn: $${totalWithdrawn.toFixed(2)}</div>
  </div>

  ${
    currentBalance >= 2
      ? `
    <button id="withdrawBtn">Request Withdrawal</button>
    <div id="withdrawMsg" style="margin-top:10px;color:green;"></div>`
      : `<div class="alert" style="color:red;">Minimum $2 required for withdrawal</div>`
  }

  <h3>💰 Withdrawal History</h3>
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

  <script>
    // --- Withdrawal
    const withdrawBtn = document.getElementById("withdrawBtn");
    if (withdrawBtn) {
      withdrawBtn.onclick = async () => {
        withdrawBtn.disabled = true;
        withdrawBtn.innerText = "Sending request...";
        try {
          const res = await fetch("/withdraw?ref=${ref}&amount=${currentBalance}");
          const data = await res.json();
          const msg = document.getElementById("withdrawMsg");
          if (data.status === "ok") {
            msg.innerText = data.msg;
            withdrawBtn.style.display = "none";
          } else {
            msg.innerText = "Error: " + data.msg;
            withdrawBtn.disabled = false;
            withdrawBtn.innerText = "Request Withdrawal";
          }
        } catch (err) {
          document.getElementById("withdrawMsg").innerText = "Error sending request";
          withdrawBtn.disabled = false;
          withdrawBtn.innerText = "Request Withdrawal";
        }
      };
    }
  </script>
</body>
</html>
    `,
    { headers: { "Content-Type": "text/html; charset=UTF-8" } }
  );
};
