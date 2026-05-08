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
<link href='/favicon.ico' rel='icon' type='image/x-icon'/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">

<link rel="stylesheet"
href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"/>

<style>

*{
  box-sizing:border-box;
}

body{
  margin:0;
  background:#f1f3f4;
  font-family:'Roboto',sans-serif;
  color:#202124;
}

/* ===== HEADER ===== */

header{
  background:#1a73e8;
  color:#fff;
  padding:16px 20px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  box-shadow:0 2px 6px rgba(0,0,0,.1);
}

header h1{
  margin:0;
  font-size:22px;
  font-weight:500;
}

header a{
  color:#fff;
  text-decoration:none;
  font-size:14px;
}

/* ===== NAV ===== */

nav{
  background:#fff;
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  padding:14px;
  border-bottom:1px solid #e0e0e0;
}

nav a{
  text-decoration:none;
  color:#1a73e8;
  padding:10px 14px;
  border-radius:8px;
  font-size:14px;
  font-weight:500;
  transition:.2s;
}

nav a:hover{
  background:#e8f0fe;
}

/* ===== CONTAINER ===== */

.container{
  padding:20px;
}

/* ===== ADSENSE STYLE CARDS ===== */

.stats-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
  gap:18px;
  margin-top:20px;
}

.earning-card{
  background:#1a73e8;
  color:#fff;
  border-radius:18px;
  padding:22px;
  position:relative;
  overflow:hidden;
  box-shadow:0 4px 12px rgba(0,0,0,.12);
  transition:0.25s ease;
}

.earning-card:hover{
  transform:translateY(-3px);
}

.earning-card .icon{
  position:absolute;
  top:18px;
  right:18px;
  font-size:20px;
  opacity:.9;
}

.card-title{
  font-size:15px;
  opacity:.95;
  margin-bottom:12px;
  font-weight:400;
}

.card-value{
  font-size:38px;
  font-weight:500;
  line-height:1;
  margin-bottom:10px;
}

.card-sub{
  font-size:14px;
  opacity:.9;
}

.card-views{
  margin-top:12px;
  font-size:13px;
  opacity:.85;
}

/* ===== BALANCE CARD ===== */

.balance-card{
  background:#fff;
  color:#202124;
}

.balance-card .card-value{
  color:#188038;
}

.balance-card .icon{
  color:#188038;
}

/* ===== ALERT ===== */

.alert{
  background:#fff8e1;
  border-left:4px solid #fbbc04;
  padding:14px 16px;
  border-radius:10px;
  margin-top:20px;
  color:#5f4339;
}

/* ===== BUTTON ===== */

button{
  margin-top:20px;
  background:#188038;
  color:#fff;
  border:none;
  padding:14px 20px;
  border-radius:10px;
  cursor:pointer;
  font-size:15px;
  font-weight:500;
}

button:hover{
  opacity:.95;
}

footer{
  text-align:center;
  padding:25px;
  color:#5f6368;
  font-size:14px;
}

</style>
</head>
<body>

<header>
  <h1>Partner Dashboard</h1>
  <span> <a href="/logout">Logout</a></span>
</header>

<nav>
  <a href="/generate">🔗 Generate</a>
  <a href="/payment-settings">🏦 Settings</a>
  <a href="/payment-history">💵 Withdrawal</a>
  <a href="/contact">📞 Contact</a>
  <a href="/privacy">🔒 Privacy</a>
  <a href="/terms">📄 Terms</a>
  <!--a href="/notice">📢 Notice</a-->
</nav>


<div class="container">
  <h2>👋 Welcome - ${partner.name}</h2>
  <div class="alert">⚠️ Dashboard resets daily at <strong>05:30 AM IST</strong>.</div>

<div class="stats-grid">

  <div class="earning-card">
    <i class="fa-solid fa-chart-line icon"></i>

    <div class="card-title">Today's Earnings</div>

    <div class="card-value">
      $${calc(stats.today)}
    </div>

    <div class="card-sub">
      ${stats.today} Views
    </div>

    <div class="card-views">
      Revenue generated today
    </div>
  </div>

  <div class="earning-card">
    <i class="fa-solid fa-calendar-day icon"></i>

    <div class="card-title">Yesterday</div>

    <div class="card-value">
      $${calc(stats.yesterday)}
    </div>

    <div class="card-sub">
      ${stats.yesterday} Views
    </div>

    <div class="card-views">
      Previous day performance
    </div>
  </div>

  <div class="earning-card">
    <i class="fa-solid fa-calendar-check icon"></i>

    <div class="card-title">This Month</div>

    <div class="card-value">
      $${calc(stats.this_month)}
    </div>

    <div class="card-sub">
      ${stats.this_month} Views
    </div>

    <div class="card-views">
      Monthly estimated revenue
    </div>
  </div>

  <div class="earning-card">
    <i class="fa-solid fa-clock-rotate-left icon"></i>

    <div class="card-title">Last Month</div>

    <div class="card-value">
      $${calc(stats.last_month)}
    </div>

    <div class="card-sub">
      ${stats.last_month} Views
    </div>

    <div class="card-views">
      Previous month earnings
    </div>
  </div>

  <div class="earning-card">
    <i class="fa-solid fa-globe icon"></i>

    <div class="card-title">All Time Earnings</div>

    <div class="card-value">
      $${calc(stats.all_time)}
    </div>

    <div class="card-sub">
      ${stats.all_time} Total Views
    </div>

    <div class="card-views">
      Lifetime revenue stats
    </div>
  </div>

  <div class="earning-card balance-card">
    <i class="fa-solid fa-wallet icon"></i>

    <div class="card-title">Available Balance</div>

    <div class="card-value">
      $${currentBalance}
    </div>

    <div class="card-sub">
      Withdrawn: $${totalWithdrawn.toFixed(2)}
    </div>

    <div class="card-views">
      Ready for withdrawal
    </div>
  </div>

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
            const res=await fetch("/withdraw?amount=${currentBalance}");
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
<script>
localStorage.setItem('refer_id', '${ref}');
</script>

<footer>
  © ${new Date().getFullYear()} ShareLinks Partner Network. All rights reserved.
</footer>

</body>
</html>
`,
    { headers: { "Content-Type": "text/html; charset=UTF-8" } }
  );
};
