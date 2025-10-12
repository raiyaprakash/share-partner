function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map(c => c.trim());
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=");
    if (key === name) return decodeURIComponent(value);
  }
  return null;
}

export const onRequest = async ({ request, env }) => {
  const db = env.DB;
  const ref = getCookie(request, "referid");

  // 🔹 Redirect if not logged in
  if (!ref) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login" },
    });
  }

  // 🔹 Partner Lookup
  const partner = await db
    .prepare("SELECT * FROM partners WHERE partner_id=?")
    .bind(ref)
    .first();

  if (!partner) {
    return new Response("Invalid partner", {
      status: 302,
      headers: {
        "Set-Cookie": "referid=; Path=/; Max-Age=0",
        Location: "/login",
      },
    });
  }

  const rpm = partner.rpm || 0.35;

  // 🔹 Stats
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

  const calc = (views) => ((views / 1000) * rpm).toFixed(3);
  const totalEarned = (stats.all_time / 1000) * rpm;

  const withdrawalData = await db
    .prepare("SELECT SUM(amount) AS withdrawn FROM withdrawals WHERE partner_id=?")
    .bind(ref)
    .first();

  const totalWithdrawn = withdrawalData.withdrawn || 0;
  const currentBalance = (totalEarned - totalWithdrawn).toFixed(3);

  // 🔹 Render Dashboard HTML
  return new Response(
    `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${partner.name} - Partner Dashboard</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Mukta:wght@300;500;700&display=swap');
body {
  font-family: "Mukta", sans-serif;
  background:#eef2f7;
  color:#333;
  margin:0 auto;
  padding:0;
  max-width:850px;
}
header {
  background:#007BFF;
  color:white;
  padding:15px 20px;
  border-bottom:4px solid #0056b3;
  display:flex;
  justify-content:space-between;
  align-items:center;
}
header h1 { font-size:20px; margin:0; }
nav {
  background:white;
  display:flex;
  flex-wrap:wrap;
  justify-content:center;
  padding:10px;
  gap:8px;
  border-bottom:1px solid #ddd;
}
nav a {
  color:#007BFF;
  text-decoration:none;
  font-weight:500;
  padding:6px 10px;
  border-radius:4px;
  transition:all 0.2s;
}
nav a:hover {
  background:#007BFF;
  color:white;
}
.container { padding:20px; }
h2 { color:#007BFF; margin-top:0; }
.stats { display:flex; flex-wrap:wrap; gap:15px; margin-bottom:20px; }
.card {
  background:white; padding:15px 20px; border-radius:8px;
  box-shadow:0 2px 6px rgba(0,0,0,0.1); flex:1 1 180px;
}
.alert {
  background-color:#fff3cd; color:#856404;
  border:1px solid #ffeeba; padding:12px 18px;
  border-radius:8px; margin-bottom:20px;
}
button {
  padding:10px 18px; background:#28a745;
  color:white; border:none; border-radius:4px;
  cursor:pointer;
}
button:hover { background:#218838; }
footer {
  background:#f8f9fa;
  text-align:center;
  font-size:14px;
  padding:10px;
  margin-top:30px;
  border-top:1px solid #ddd;
  color:#555;
}
    h2 { color:#007BFF; }

</style>
</head>
<body>

<header>
  <h1>Partner Dashboard</h1>
  <span>${partner.name}</span>
</header>

<nav>
  <a href="/analytics">📊 Analytics</a>
  <a href="/payments">💵 Payments</a>
  <a href="/contact">📞 Contact</a>
  <a href="/privacy">🔒 Privacy</a>
  <a href="/notice">📢 Notice</a>
  <a href="/logout">🚪 Logout</a>
</nav>

<div class="container">
  <h2>👋 Welcome - ${partner.name}</h2>
  <div class="alert">⚠️ Dashboard resets daily at <strong>05:30 AM IST</strong>.</div>

  <div class="stats">
    <div class="card">Today: ${stats.today} | 💰 $${calc(stats.today)}</div>
    <div class="card">Yesterday: ${stats.yesterday} | 💰 $${calc(stats.yesterday)}</div>
    <div class="card">This Month: ${stats.this_month} | 💰 $${calc(stats.this_month)}</div>
    <div class="card">Last Month: ${stats.last_month} | 💰 $${calc(stats.last_month)}</div>
    <div class="card">All Time: ${stats.all_time} | 💰 $${calc(stats.all_time)}</div>
    <div class="card">💵 Balance: $${currentBalance}</div>
    <div class="card">Withdrawn: $${totalWithdrawn.toFixed(2)}</div>
  </div>

  ${
    currentBalance >= 2
      ? `
      <button id="withdrawBtn">Request Withdrawal</button>
      <div id="withdrawMsg" style="margin-top:10px;color:green;"></div>
      <script>
        const btn=document.getElementById("withdrawBtn");
        btn.onclick=async()=>{
          btn.disabled=true;btn.innerText="Sending...";
          try{
            const res=await fetch("/withdraw");
            const data=await res.json();
            const msg=document.getElementById("withdrawMsg");
            if(data.status==="ok"){
              msg.innerText=data.msg;
              btn.style.display="none";
            }else{
              msg.innerText="Error: "+data.msg;
              btn.disabled=false;btn.innerText="Request Withdrawal";
            }
          }catch{
            document.getElementById("withdrawMsg").innerText="Network error";
            btn.disabled=false;btn.innerText="Request Withdrawal";
          }
        };
      </script>`
      : `<div class="alert" style="color:red;">Minimum $2 required for withdrawal</div>`
  }
</div>

<footer>
  © ${new Date().getFullYear()} ShareLinks Partner Network. All rights reserved.
</footer>

</body>
</html>
`,
    { headers: { "Content-Type": "text/html; charset=UTF-8" } }
  );
};
