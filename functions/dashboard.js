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

  // 🔹 Get custom RPM from partner_views if exists
const rpmData = await db
  .prepare(`
    SELECT rpm 
    FROM partner_views 
    WHERE partner_id=? 
      AND rpm IS NOT NULL 
      AND rpm != ''
    ORDER BY id DESC 
    LIMIT 1
  `)
  .bind(ref)
  .first();

// partner_views rpm -> partner rpm -> default 0.35
const rpm = Number(rpmData?.rpm || partner.rpm || 0.35);

  // 🔹 Stats
const stats = await db
  .prepare(`
    SELECT
      SUM(CASE WHEN view_date = DATE('now','localtime') THEN views ELSE 0 END) AS today,
      SUM(CASE WHEN view_date = DATE('now','-1 day','localtime') THEN views ELSE 0 END) AS yesterday,
      SUM(CASE WHEN strftime('%Y-%m', view_date) = strftime('%Y-%m','now','localtime') THEN views ELSE 0 END) AS this_month,
      SUM(CASE WHEN strftime('%Y-%m', view_date) = strftime('%Y-%m','now','-1 month','localtime') THEN views ELSE 0 END) AS last_month,
      SUM(views) AS all_time
    FROM partner_views WHERE partner_id=?
  `)
  .bind(ref)
  .first();

  const calc = (views) => ((views / 1000) * rpm).toFixed(2);
  const totalEarned = (stats.all_time / 1000) * rpm;

  const withdrawalData = await db
    .prepare("SELECT SUM(amount) AS withdrawn FROM withdrawals WHERE partner_id=?")
    .bind(ref)
    .first();

  const totalWithdrawn = withdrawalData.withdrawn || 0;
  const currentBalance = (totalEarned - totalWithdrawn).toFixed(2);
// Format Views Function
function formatViews(num) {
  num = Number(num || 0);

  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace('.0','') + 'M';
  }

  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace('.0','') + 'K';
  }

  return num.toString();
}

  // 🔹 Render Dashboard HTML
  return new Response(
    `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${partner.name} - Partner Dashboard</title>

<link href='/favicon.ico' rel='icon' type='image/x-icon'/>

<!-- Google Font -->
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">

<!-- Font Awesome -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"/>

<style>
*{
  margin:0;
  padding:0;
  box-sizing:border-box;
}

body{
  font-family:'Roboto',sans-serif;
  background:#f1f3f4;
  color:#202124;
  max-width:900px;
  margin:auto;
  font-size:14px;
}

header{
  background:#fff;
  padding:15px 20px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  border-bottom:1px solid #dadce0;
  position:sticky;
  top:0;
  z-index:99;
}

header h1{
  font-size:22px;
  color:#1a73e8;
  font-weight:700;
}

header a{
  color:#ea4335;
  text-decoration:none;
  font-weight:500;
}

nav{
  background:#fff;
  padding:12px;
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  justify-content:center;
  border-bottom:1px solid #dadce0;
}

nav a{
  text-decoration:none;
  color:#1a73e8;
  background:#f8f9fa;
  padding:10px 14px;
  border-radius:10px;
  font-weight:500;
  transition:.2s;
  display:flex;
  align-items:center;
  gap:8px;
}

nav a:hover{
  background:#1a73e8;
  color:#fff;
}

.container{
  padding:20px;
}

.welcome{
  margin-bottom:20px;
}

.welcome h2{
  font-size:24px;
  font-weight:700;
  color:#202124;
}

.alert{
  background:#fff3cd;
  color:#856404;
  border:1px solid #ffeeba;
  padding:14px;
  border-radius:12px;
  margin-top:15px;
}

.stats{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
  gap:16px;
  margin-top:20px;
}

.card{
  background:#fff;
  border-radius:18px;
  padding:18px;
  box-shadow:0 2px 8px rgba(0,0,0,0.06);
  transition:.2s;
}

.card:hover{
  transform:translateY(-3px);
}

.card-top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:12px;
}

.icon{
  width:50px;
  height:50px;
  border-radius:14px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:20px;
  color:#fff;
}

.blue{background:#1a73e8;}
.green{background:#34a853;}
.orange{background:#fbbc05;}
.red{background:#ea4335;}
.purple{background:#9334e6;}
.dark{background:#202124;}

.card h3{
  font-size:14px;
  color:#5f6368;
  margin-bottom:5px;
  font-weight:500;
}

.card .views{
  font-size:22px;
  font-weight:700;
}

.earn{
  margin-top:8px;
  color:#34a853;
  font-weight:600;
  font-size:15px;
}

button{
  margin-top:25px;
  width:100%;
  padding:14px;
  border:none;
  border-radius:12px;
  background:#34a853;
  color:#fff;
  font-size:16px;
  font-weight:600;
  cursor:pointer;
  transition:.2s;
}

button:hover{
  background:#2d9249;
}

footer{
  text-align:center;
  padding:20px;
  color:#5f6368;
  font-size:13px;
}
</style>
</head>

<body>

<header>
  <h1><i class="fa-solid fa-chart-line"></i> Dashboard</h1>
  <a href="/logout">
    <i class="fa-solid fa-right-from-bracket"></i> Logout
  </a>
</header>

<nav>
  <a href="/generate"><i class="fa-solid fa-link"></i> Generate</a>
  <a href="/payment-settings"><i class="fa-solid fa-building-columns"></i> Settings</a>
  <a href="/payment-history"><i class="fa-solid fa-money-bill-wave"></i> Withdrawal</a>
  <a href="/contact"><i class="fa-solid fa-headset"></i> Contact</a>
  <a href="/privacy"><i class="fa-solid fa-shield-halved"></i> Privacy</a>
  <a href="/terms"><i class="fa-solid fa-file-lines"></i> Terms</a>
</nav>

<div class="container">

  <div class="welcome">
    <h2>👋 Welcome, ${partner.name}</h2>

    <div class="alert">
      <i class="fa-solid fa-triangle-exclamation"></i>
      Dashboard resets daily at <strong>05:30 AM IST</strong>
    </div>
  </div>

  <div class="stats">

    <div class="card">
      <div class="card-top">
        <div>
          <h3>Today</h3>
          <div class="views">${formatViews(stats.today)}</div>
        </div>
        <div class="icon blue">
          <i class="fa-solid fa-calendar-day"></i>
        </div>
      </div>
      <div class="earn">$${calc(stats.today)}</div>
    </div>

    <div class="card">
      <div class="card-top">
        <div>
          <h3>Yesterday</h3>
          <div class="views">${formatViews(stats.yesterday)}</div>
        </div>
        <div class="icon orange">
          <i class="fa-solid fa-clock-rotate-left"></i>
        </div>
      </div>
      <div class="earn">$${calc(stats.yesterday)}</div>
    </div>

    <div class="card">
      <div class="card-top">
        <div>
          <h3>This Month</h3>
          <div class="views">${formatViews(stats.this_month)}</div>
        </div>
        <div class="icon green">
          <i class="fa-solid fa-calendar-days"></i>
        </div>
      </div>
      <div class="earn">$${calc(stats.this_month)}</div>
    </div>

    <div class="card">
      <div class="card-top">
        <div>
          <h3>Last Month</h3>
          <div class="views">${formatViews(stats.last_month)}</div>
        </div>
        <div class="icon red">
          <i class="fa-solid fa-chart-column"></i>
        </div>
      </div>
      <div class="earn">$${calc(stats.last_month)}</div>
    </div>

    <div class="card">
      <div class="card-top">
        <div>
          <h3>All Time</h3>
          <div class="views">${formatViews(stats.all_time)}</div>
        </div>
        <div class="icon purple">
          <i class="fa-solid fa-earth-americas"></i>
        </div>
      </div>
      <div class="earn">$${calc(stats.all_time)}</div>
    </div>

    <div class="card">
      <div class="card-top">
        <div>
          <h3>Balance</h3>
          <div class="views">$${currentBalance}</div>
        </div>
        <div class="icon dark">
          <i class="fa-solid fa-wallet"></i>
        </div>
      </div>
      <div class="earn">Available Balance</div>
    </div>

  </div>

  ${
    currentBalance >= 2
      ? `
      <button id="withdrawBtn">
        <i class="fa-solid fa-money-check-dollar"></i>
        Request Withdrawal
      </button>

      <div id="withdrawMsg" style="margin-top:15px;font-weight:600;"></div>
      `
      : `
      <div class="alert" style="margin-top:20px;color:#d93025;">
        <i class="fa-solid fa-circle-info"></i>
        Minimum $2 required for withdrawal
      </div>
      `
  }

</div>

<footer>
  © ${new Date().getFullYear()} ShareLinks Partner Network
</footer>
<script>
localStorage.setItem('refer_id', '${ref}');
</script>
</body>
</html>
`,
    { headers: { "Content-Type": "text/html; charset=UTF-8" } }
  );
};
