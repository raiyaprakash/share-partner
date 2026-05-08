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
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${partner.name} - Dashboard</title>

<link href='/favicon.ico' rel='icon' type='image/x-icon'/>

<!-- Google Font -->
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">

<!-- Font Awesome -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"/>

<style>

:root{
  --bg:#f3f6fb;
  --card:#ffffffcc;
  --text:#111827;
  --sub:#6b7280;
  --primary:#2563eb;
  --secondary:#7c3aed;
  --border:#e5e7eb;
  --shadow:0 10px 35px rgba(0,0,0,.08);
}

body.dark{
  --bg:#0f172a;
  --card:#111827cc;
  --text:#f8fafc;
  --sub:#94a3b8;
  --primary:#3b82f6;
  --secondary:#8b5cf6;
  --border:#1e293b;
  --shadow:0 10px 35px rgba(0,0,0,.35);
}

*{
  margin:0;
  padding:0;
  box-sizing:border-box;
}

html{
  scroll-behavior:smooth;
}

body{
  font-family:'Roboto',sans-serif;
  background:var(--bg);
  color:var(--text);
  transition:.3s;
}

/* DASHBOARD */

.dashboard{
  display:flex;
  min-height:100vh;
}

/* SIDEBAR */

.sidebar{
  width:260px;
  background:linear-gradient(180deg,#2563eb,#7c3aed);
  position:fixed;
  height:100%;
  overflow:auto;
  padding:25px 18px;
  box-shadow:0 0 25px rgba(0,0,0,.15);
}

.logo{
  display:flex;
  align-items:center;
  gap:12px;
  color:#fff;
  font-size:25px;
  font-weight:800;
  margin-bottom:35px;
}

.menu{
  display:flex;
  flex-direction:column;
  gap:12px;
}

.menu a{
  color:#fff;
  text-decoration:none;
  padding:14px 18px;
  border-radius:18px;
  display:flex;
  align-items:center;
  gap:14px;
  font-weight:500;
  transition:.25s;
  font-size:15px;
}

.menu a:hover{
  background:rgba(255,255,255,.15);
  transform:translateX(5px);
}

.menu a i{
  width:20px;
  text-align:center;
}

/* MAIN */

.main{
  margin-left:260px;
  width:100%;
  padding:25px;
}

/* TOPBAR */

.topbar{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:25px;
  gap:20px;
}

.topbar h1{
  font-size:30px;
  font-weight:800;
}

.topbar p{
  color:var(--sub);
  margin-top:4px;
}

/* DARK TOGGLE */

.toggle{
  width:60px;
  height:32px;
  background:#d1d5db;
  border-radius:30px;
  position:relative;
  cursor:pointer;
  transition:.3s;
}

.toggle::before{
  content:'';
  position:absolute;
  width:26px;
  height:26px;
  border-radius:50%;
  background:#fff;
  top:3px;
  left:4px;
  transition:.3s;
}

body.dark .toggle{
  background:#374151;
}

body.dark .toggle::before{
  transform:translateX(28px);
}

/* ALERT */

.alert{
  background:#fff3cd;
  border:1px solid #ffe69c;
  padding:16px;
  border-radius:20px;
  margin-bottom:25px;
  color:#b45309;
  font-weight:500;
  box-shadow:var(--shadow);
}

body.dark .alert{
  background:#2b2111;
  border-color:#4b371c;
  color:#fbbf24;
}

/* STATS */

.stats{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
  gap:22px;
}

.card{
  background:var(--card);
  backdrop-filter:blur(15px);
  border:1px solid var(--border);
  border-radius:26px;
  padding:22px;
  box-shadow:var(--shadow);
  transition:.25s;
  position:relative;
  overflow:hidden;
}

.card:hover{
  transform:translateY(-6px);
}

.card::after{
  content:'';
  position:absolute;
  width:120px;
  height:120px;
  background:rgba(255,255,255,.08);
  border-radius:50%;
  top:-30px;
  right:-30px;
}

.card-top{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:18px;
}

.card h3{
  color:var(--sub);
  font-size:14px;
  margin-bottom:8px;
  font-weight:500;
}

.views{
  font-size:34px;
  font-weight:800;
  letter-spacing:-1px;
}

.earn{
  margin-top:12px;
  color:#22c55e;
  font-weight:700;
  font-size:15px;
}

/* ICONS */

.icon{
  width:60px;
  height:60px;
  border-radius:20px;
  display:flex;
  align-items:center;
  justify-content:center;
  color:#fff;
  font-size:22px;
  box-shadow:0 10px 20px rgba(0,0,0,.15);
}

.blue{
  background:linear-gradient(135deg,#3b82f6,#2563eb);
}

.green{
  background:linear-gradient(135deg,#22c55e,#16a34a);
}

.orange{
  background:linear-gradient(135deg,#f59e0b,#d97706);
}

.red{
  background:linear-gradient(135deg,#ef4444,#dc2626);
}

.purple{
  background:linear-gradient(135deg,#8b5cf6,#7c3aed);
}

.darkicon{
  background:linear-gradient(135deg,#111827,#374151);
}

/* BUTTON */

button{
  margin-top:30px;
  width:100%;
  border:none;
  padding:16px;
  border-radius:20px;
  background:linear-gradient(135deg,#22c55e,#16a34a);
  color:#fff;
  font-size:16px;
  font-weight:700;
  cursor:pointer;
  transition:.25s;
  box-shadow:0 10px 20px rgba(34,197,94,.25);
}

button:hover{
  transform:scale(1.02);
}

/* FOOTER */

footer{
  margin-top:35px;
  text-align:center;
  color:var(--sub);
  font-size:14px;
}

/* MOBILE */

.mobile-menu{
  display:none;
}

@media(max-width:900px){

  .sidebar{
    width:85px;
    padding:20px 10px;
  }

  .logo span,
  .menu a span{
    display:none;
  }

  .main{
    margin-left:85px;
    padding:18px;
  }

}

@media(max-width:650px){

  .sidebar{
    left:-100%;
    z-index:999;
    transition:.3s;
    width:260px;
  }

  .sidebar.active{
    left:0;
  }

  .logo span,
  .menu a span{
    display:block;
  }

  .main{
    margin-left:0;
    padding:15px;
  }

  .topbar{
    flex-wrap:wrap;
  }

  .mobile-menu{
    display:flex;
    width:48px;
    height:48px;
    border-radius:14px;
    align-items:center;
    justify-content:center;
    background:linear-gradient(135deg,#2563eb,#7c3aed);
    color:#fff;
    font-size:20px;
    cursor:pointer;
    box-shadow:var(--shadow);
  }

  .topbar h1{
    font-size:24px;
  }

  .stats{
    grid-template-columns:1fr;
  }

}

</style>
</head>

<body>

<div class="dashboard">

  <!-- SIDEBAR -->

  <aside class="sidebar" id="sidebar">

    <div class="logo">
      <i class="fa-solid fa-chart-line"></i>
      <span>Dashboard</span>
    </div>

    <div class="menu">

      <a href="/generate">
        <i class="fa-solid fa-link"></i>
        <span>Generate</span>
      </a>

      <a href="/payment-settings">
        <i class="fa-solid fa-gear"></i>
        <span>Settings</span>
      </a>

      <a href="/payment-history">
        <i class="fa-solid fa-wallet"></i>
        <span>Withdrawal</span>
      </a>

      <a href="/contact">
        <i class="fa-solid fa-headset"></i>
        <span>Support</span>
      </a>

      <a href="/privacy">
        <i class="fa-solid fa-shield-halved"></i>
        <span>Privacy</span>
      </a>

      <a href="/terms">
        <i class="fa-solid fa-file-lines"></i>
        <span>Terms</span>
      </a>

      <a href="/logout">
        <i class="fa-solid fa-right-from-bracket"></i>
        <span>Logout</span>
      </a>

    </div>

  </aside>

  <!-- MAIN -->

  <main class="main">

    <div class="topbar">

      <div style="display:flex;align-items:center;gap:15px;">

        <div class="mobile-menu" id="menuBtn">
          <i class="fa-solid fa-bars"></i>
        </div>

        <div>
          <h1>👋 Welcome, ${partner.name}</h1>
          <p>Partner Dashboard Overview</p>
        </div>

      </div>

      <div class="toggle" id="themeToggle"></div>

    </div>

    <!-- ALERT -->

    <div class="alert">
      <i class="fa-solid fa-triangle-exclamation"></i>
      Dashboard resets daily at <strong>05:30 AM IST</strong>
    </div>

    <!-- STATS -->

    <div class="stats">

      <!-- TODAY -->

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

        <div class="earn">
          $${calc(stats.today)}
        </div>
      </div>

      <!-- YESTERDAY -->

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

        <div class="earn">
          $${calc(stats.yesterday)}
        </div>
      </div>

      <!-- THIS MONTH -->

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

        <div class="earn">
          $${calc(stats.this_month)}
        </div>
      </div>

      <!-- LAST MONTH -->

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

        <div class="earn">
          $${calc(stats.last_month)}
        </div>
      </div>

      <!-- ALL TIME -->

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

        <div class="earn">
          $${calc(stats.all_time)}
        </div>
      </div>

      <!-- BALANCE -->

      <div class="card">
        <div class="card-top">
          <div>
            <h3>Balance</h3>
            <div class="views">
              $${currentBalance}
            </div>
          </div>

          <div class="icon darkicon">
            <i class="fa-solid fa-wallet"></i>
          </div>
        </div>

        <div class="earn">
          Available Balance
        </div>
      </div>

    </div>

    <!-- WITHDRAW -->

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
      <div class="alert" style="margin-top:25px;">
        <i class="fa-solid fa-circle-info"></i>
        Minimum $2 required for withdrawal
      </div>
      `
    }

    <!-- FOOTER -->

    <footer>
      © ${new Date().getFullYear()} ShareLinks Partner Network
    </footer>

  </main>

</div>

<!-- SCRIPT -->

<script>

/* REFER ID */

localStorage.setItem('refer_id', '${ref}');

/* DARK MODE */

const toggle = document.getElementById("themeToggle");

if(localStorage.getItem("theme") === "dark"){
  document.body.classList.add("dark");
}

toggle.onclick = () => {

  document.body.classList.toggle("dark");

  if(document.body.classList.contains("dark")){
    localStorage.setItem("theme","dark");
  }else{
    localStorage.setItem("theme","light");
  }

};

/* MOBILE MENU */

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");

menuBtn.onclick = () => {
  sidebar.classList.toggle("active");
};

</script>

</body>
</html>
`,
    { headers: { "Content-Type": "text/html; charset=UTF-8" } }
  );
};
