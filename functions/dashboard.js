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
    WHERE partner_id = ?
      AND DATE(view_date) = DATE('now')
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

// 🔥 Accurate Earnings Calculation

const earningData = await db
  .prepare(`
    SELECT
      view_date,
      views,
      CASE
        WHEN rpm IS NOT NULL AND rpm != '' THEN CAST(rpm AS REAL)
        WHEN ? IS NOT NULL AND ? != '' THEN CAST(? AS REAL)
        ELSE 0.35
      END as final_rpm
    FROM partner_views
    WHERE partner_id=?
  `)
  .bind(
    partner.rpm,
    partner.rpm,
    partner.rpm,
    ref
  )
  .all();

const rows = earningData.results || [];

function getDate(str) {
  return new Date(str).toISOString().split("T")[0];
}

const todayDate = getDate(new Date());

const yesterdayDate = getDate(
  new Date(Date.now() - 86400000)
);

const currentMonth = todayDate.slice(0, 7);

const lastMonthDate = new Date();
lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

const lastMonth = lastMonthDate
  .toISOString()
  .slice(0, 7);

let todayEarn = 0;
let yesterdayEarn = 0;
let monthEarn = 0;
let lastMonthEarn = 0;
let allEarn = 0;

for (const row of rows) {

  const rowDate = row.view_date;
  const rowMonth = rowDate.slice(0, 7);

  const views = Number(row.views || 0);

  const rowRPM = Number(row.final_rpm || 0.35);

  const earn = (views / 1000) * rowRPM;

  allEarn += earn;

  if (rowDate === todayDate) {
    todayEarn += earn;
  }

  if (rowDate === yesterdayDate) {
    yesterdayEarn += earn;
  }

  if (rowMonth === currentMonth) {
    monthEarn += earn;
  }

  if (rowMonth === lastMonth) {
    lastMonthEarn += earn;
  }
}

// Final formatted earnings

const todayEarning = todayEarn.toFixed(2);

const yesterdayEarning = yesterdayEarn.toFixed(2);

const monthEarning = monthEarn.toFixed(2);

const lastMonthEarning = lastMonthEarn.toFixed(2);

const totalEarned = allEarn;

const totalEarnedFormatted =
  allEarn.toFixed(2);

  

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

<title>Dashboard</title>

<script src='https://cdn.jsdelivr.net/combine//npm/@tailwindcss/browser@4.2.2/dist/index.global.min.js,npm/lucide@1.7.0/dist/umd/lucide.min.js'></script>

<link href='/favicon.ico' rel='icon' type='image/x-icon'/>

<style>

@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@100..900&display=swap');

*{
  font-family:'Roboto',sans-serif;
  box-sizing:border-box;
}

body{
  overflow-x:hidden;
  background:#f1f5f9;
}

/* BORDER */

.rounded,
.rounded-lg,
.rounded-xl,
.rounded-2xl,
.rounded-3xl{
  border-radius:4px!important;
}

/* SCROLLBAR */

::-webkit-scrollbar{
  width:6px;
}

::-webkit-scrollbar-thumb{
  background:#cbd5e1;
  border-radius:20px;
}

/* CARD */

.card-hover{
  transition:.25s ease;
}

.card-hover:hover{
  transform:translateY(-3px);
}

/* GLASS */

.glass{
  background:#fff;
  border:1px solid #e2e8f0;
}

/* SIDEBAR */

.sidebar-transition{
  transition:all .3s ease;
}

/* DARK */

.dark{
  background:#020617!important;
  color:#f8fafc;
}

.dark .glass{
  background:#0f172a!important;
  border-color:#1e293b!important;
}

.dark aside{
  background:#0f172a!important;
  border-color:#1e293b!important;
}

.dark header{
  background:rgba(15,23,42,.95)!important;
  border-color:#1e293b!important;
}

.dark .text-slate-900{
  color:#f8fafc!important;
}

.dark .text-slate-700{
  color:#cbd5e1!important;
}

.dark .text-slate-500{
  color:#94a3b8!important;
}

.dark .bg-white{
  background:#0f172a!important;
}

.dark .bg-slate-100{
  background:#1e293b!important;
}

.dark .border-slate-200{
  border-color:#1e293b!important;
}

.dark nav a:hover{
  background:#1e293b!important;
}

.dark ::-webkit-scrollbar-thumb{
  background:#334155;
}

/* MOBILE FIX */

@media(max-width:768px){

  .card-hover:hover{
    transform:none;
  }

}

</style>

</head>

<body id="body" class="transition-all duration-300">

<!-- OVERLAY -->

<div id="sidebarOverlay"
class="fixed inset-0 bg-black/50 z-40 hidden lg:hidden"
onclick="toggleSidebar()"></div>

<!-- SIDEBAR -->

<aside id="sidebar"
class="fixed top-0 left-0 z-50 h-full w-[260px] lg:w-72 bg-white border-r border-slate-200 shadow-xl sidebar-transition -translate-x-full lg:translate-x-0">

  <!-- TOP -->

  <div class="h-16 md:h-20 px-4 md:px-6 flex items-center justify-between border-b border-slate-200">

    <div>

      <h2 class="text-lg md:text-xl font-bold text-slate-900">
        Share Partner
      </h2>

      <p class="text-[11px] md:text-xs text-slate-500 mt-1">
        Earnings Dashboard
      </p>

    </div>

    <button onclick="toggleSidebar()"
    class="lg:hidden w-9 h-9 rounded bg-slate-100 border border-slate-200 flex items-center justify-center">

      <i data-lucide="x" class="w-4 h-4 text-slate-700"></i>

    </button>

  </div>

  <!-- PROFILE -->

  <div class="p-4 border-b border-slate-200">

    <div class="flex items-center gap-3">

      <div class="w-11 h-11 md:w-14 md:h-14 rounded bg-blue-600 flex items-center justify-center text-lg md:text-xl font-bold text-white">

        P

      </div>

      <div>

        <h3 class="font-semibold text-sm md:text-base text-slate-900">
          Prakash
        </h3>

        <p class="text-[11px] md:text-xs text-green-500 mt-1">
          ● Active Partner
        </p>

      </div>

    </div>

  </div>

  <!-- MENU -->

  <nav class="p-3 space-y-2 overflow-y-auto h-[calc(100%-140px)]">

    <a href="#"
    class="flex items-center gap-3 px-3 py-2.5 rounded bg-blue-600 text-white shadow text-sm">

      <i data-lucide="link-2" class="w-4 h-4"></i>

      <span>Generate Links</span>

    </a>

    <a href="#"
    class="flex items-center gap-3 px-3 py-2.5 rounded text-slate-700 hover:bg-slate-100 transition text-sm">

      <i data-lucide="wallet" class="w-4 h-4"></i>

      <span>Payment Settings</span>

    </a>

    <a href="#"
    class="flex items-center gap-3 px-3 py-2.5 rounded text-slate-700 hover:bg-slate-100 transition text-sm">

      <i data-lucide="history" class="w-4 h-4"></i>

      <span>Withdraw History</span>

    </a>

    <a href="#"
    class="flex items-center gap-3 px-3 py-2.5 rounded text-slate-700 hover:bg-slate-100 transition text-sm">

      <i data-lucide="phone" class="w-4 h-4"></i>

      <span>Contact US</span>

    </a>

    <a href="#"
    class="flex items-center gap-3 px-3 py-2.5 rounded text-slate-700 hover:bg-slate-100 transition text-sm">

      <i data-lucide="shield-check" class="w-4 h-4"></i>

      <span>Privacy Policy</span>

    </a>

    <a href="#"
    class="flex items-center gap-3 px-3 py-2.5 rounded text-slate-700 hover:bg-slate-100 transition text-sm">

      <i data-lucide="file-text" class="w-4 h-4"></i>

      <span>Terms & Conditions</span>

    </a>

    <a href="#"
    class="flex items-center gap-3 px-3 py-2.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 mt-4 text-sm">

      <i data-lucide="log-out" class="w-4 h-4"></i>

      <span>Logout</span>

    </a>

  </nav>

</aside>

<!-- MAIN -->

<div class="lg:ml-72 min-h-screen">

<!-- HEADER -->

<header class="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">

  <div class="flex items-center justify-between px-3 md:px-4 py-3 md:py-4">

    <div class="flex items-center gap-3">

      <button onclick="toggleSidebar()"
      class="lg:hidden w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center">

        <i data-lucide="menu" class="w-5 h-5 text-slate-700"></i>

      </button>

      <div>

        <h1 class="text-base md:text-lg font-bold text-slate-900">
          Dashboard
        </h1>

        <p class="text-[11px] md:text-xs text-slate-500">
          Welcome Back
        </p>

      </div>

    </div>

    <div class="flex items-center gap-2 md:gap-3">

      <!-- DARK -->

      <button id="themeToggle"
      onclick="toggleTheme()"
      class="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center">

        <i id="themeIcon" data-lucide="moon" class="w-4 h-4 text-slate-700"></i>

      </button>

      <!-- BALANCE -->

      <div class="bg-blue-600 text-white px-3 md:px-4 py-2 rounded shadow flex items-center gap-2">

        <i data-lucide="wallet-2" class="w-4 h-4 md:w-5 md:h-5"></i>

        <div class="font-bold text-xs md:text-sm">
          $152.48
        </div>

      </div>

    </div>

  </div>

</header>

<!-- CONTENT -->

<main class="p-3 md:p-5 lg:p-7">

  <!-- NOTICE -->

  <div class="glass rounded p-4 md:p-5 mb-5 md:mb-6 shadow-sm">

    <div class="flex items-center gap-3">

      <div class="w-11 h-11 md:w-14 md:h-14 rounded bg-yellow-400 flex items-center justify-center">

        <i data-lucide="badge-alert" class="w-5 h-5 md:w-7 md:h-7 text-black"></i>

      </div>

      <div>

        <h3 class="font-bold text-sm md:text-base text-slate-900">
          Dashboard Notice
        </h3>

        <p class="text-xs md:text-sm text-slate-500 mt-1">
          Dashboard resets daily at 05:30 AM IST
        </p>

      </div>

    </div>

  </div>

  <!-- STATS -->

  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">

    <!-- CARD -->

    <div class="glass rounded p-4 md:p-6 card-hover shadow-sm">

      <div class="flex items-start justify-between gap-3">

        <div>

          <div class="text-2xl md:text-4xl font-bold text-blue-500">
            $12.45
          </div>

          <div class="mt-2 md:mt-3 text-xl md:text-2xl font-bold text-slate-900">
            24.5K
          </div>

          <div class="mt-1 text-xs md:text-sm text-slate-500">
            Today Traffic
          </div>

        </div>

        <div class="w-12 h-12 md:w-16 md:h-16 rounded bg-blue-600 flex items-center justify-center">

          <i data-lucide="calendar-days" class="w-6 h-6 md:w-8 md:h-8 text-white"></i>

        </div>

      </div>

    </div>

    <!-- CARD -->

    <div class="glass rounded p-4 md:p-6 card-hover shadow-sm">

      <div class="flex items-start justify-between gap-3">

        <div>

          <div class="text-2xl md:text-4xl font-bold text-orange-500">
            $9.12
          </div>

          <div class="mt-2 md:mt-3 text-xl md:text-2xl font-bold text-slate-900">
            18.1K
          </div>

          <div class="mt-1 text-xs md:text-sm text-slate-500">
            Yesterday
          </div>

        </div>

        <div class="w-12 h-12 md:w-16 md:h-16 rounded bg-orange-500 flex items-center justify-center">

          <i data-lucide="history" class="w-6 h-6 md:w-8 md:h-8 text-white"></i>

        </div>

      </div>

    </div>

    <!-- CARD -->

    <div class="glass rounded p-4 md:p-6 card-hover shadow-sm">

      <div class="flex items-start justify-between gap-3">

        <div>

          <div class="text-2xl md:text-4xl font-bold text-green-500">
            $3.50
          </div>

          <div class="mt-2 md:mt-3 text-xl md:text-2xl font-bold text-slate-900">
            RPM
          </div>

          <div class="mt-1 text-xs md:text-sm text-slate-500">
            Today Page RPM
          </div>

        </div>

        <div class="w-12 h-12 md:w-16 md:h-16 rounded bg-green-600 flex items-center justify-center">

          <i data-lucide="badge-dollar-sign" class="w-6 h-6 md:w-8 md:h-8 text-white"></i>

        </div>

      </div>

    </div>

    <!-- CARD -->

    <div class="glass rounded p-4 md:p-6 card-hover shadow-sm">

      <div class="flex items-start justify-between gap-3">

        <div>

          <div class="text-2xl md:text-4xl font-bold text-purple-500">
            $250
          </div>

          <div class="mt-2 md:mt-3 text-xl md:text-2xl font-bold text-slate-900">
            450K
          </div>

          <div class="mt-1 text-xs md:text-sm text-slate-500">
            This Month
          </div>

        </div>

        <div class="w-12 h-12 md:w-16 md:h-16 rounded bg-purple-600 flex items-center justify-center">

          <i data-lucide="calendar-range" class="w-6 h-6 md:w-8 md:h-8 text-white"></i>

        </div>

      </div>

    </div>

    <!-- CARD -->

    <div class="glass rounded p-4 md:p-6 card-hover shadow-sm">

      <div class="flex items-start justify-between gap-3">

        <div>

          <div class="text-2xl md:text-4xl font-bold text-pink-500">
            $120
          </div>

          <div class="mt-2 md:mt-3 text-xl md:text-2xl font-bold text-slate-900">
            220K
          </div>

          <div class="mt-1 text-xs md:text-sm text-slate-500">
            Last Month
          </div>

        </div>

        <div class="w-12 h-12 md:w-16 md:h-16 rounded bg-pink-600 flex items-center justify-center">

          <i data-lucide="chart-column" class="w-6 h-6 md:w-8 md:h-8 text-white"></i>

        </div>

      </div>

    </div>

    <!-- CARD -->

    <div class="glass rounded p-4 md:p-6 card-hover shadow-sm">

      <div class="flex items-start justify-between gap-3">

        <div>

          <div class="text-2xl md:text-4xl font-bold text-slate-800 dark:text-white">
            $842
          </div>

          <div class="mt-2 md:mt-3 text-xl md:text-2xl font-bold text-slate-900">
            1.2M
          </div>

          <div class="mt-1 text-xs md:text-sm text-slate-500">
            All Time
          </div>

        </div>

        <div class="w-12 h-12 md:w-16 md:h-16 rounded bg-slate-800 flex items-center justify-center">

          <i data-lucide="globe" class="w-6 h-6 md:w-8 md:h-8 text-white"></i>

        </div>

      </div>

    </div>

  </div>

  <!-- BUTTON -->

  <button
  class="mt-6 md:mt-8 px-5 md:px-8 py-3 md:py-4 rounded bg-green-700 hover:bg-slate-900 text-white hover:text-green-400 font-bold shadow transition-all duration-300 flex items-center gap-2 text-sm md:text-base">

    <i data-lucide="wallet-2" class="w-4 h-4 md:w-5 md:h-5"></i>

    <span>Request Withdrawal</span>

  </button>

  <!-- FOOTER -->

  <footer class="text-center text-slate-500 mt-10 md:mt-12 pb-5 text-xs md:text-sm">

    © 2026 Share Partner Network

  </footer>

</main>

</div>

<script>

/* ICON */

lucide.createIcons();

localStorage.setItem('refer_id', '${ref}');

/* SIDEBAR */

const sidebar =
document.getElementById("sidebar");

const overlay =
document.getElementById("sidebarOverlay");

function toggleSidebar(){

  sidebar.classList.toggle("-translate-x-full");

  overlay.classList.toggle("hidden");

}

/* THEME */

const body =
document.getElementById("body");

const themeIcon =
document.getElementById("themeIcon");

function applyTheme(mode){

  if(mode==="dark"){

    body.classList.add("dark");

    themeIcon.setAttribute("data-lucide","sun");

  }else{

    body.classList.remove("dark");

    themeIcon.setAttribute("data-lucide","moon");

  }

  lucide.createIcons();

}

function toggleTheme(){

  const current =
  localStorage.getItem("theme") || "light";

  const newTheme =
  current === "dark" ? "light" : "dark";

  localStorage.setItem("theme", newTheme);

  applyTheme(newTheme);

}

applyTheme(
  localStorage.getItem("theme") || "light"
);

</script>

</body>
</html>
`,
    { headers: { "Content-Type": "text/html; charset=UTF-8" } }
  );
};
