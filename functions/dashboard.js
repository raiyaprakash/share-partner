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
<html lang="en" class="dark">

<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<title>${partner.name} - Share Partner</title>

<!-- ROBOTO -->

<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">

<!-- TAILWIND -->

<script src="https://cdn.tailwindcss.com"></script>

<!-- LUCIDE -->

<script src="https://unpkg.com/lucide@latest"></script>

<style>

*{
  font-family:'Roboto',sans-serif;
  box-sizing:border-box;
}

/* BODY */

body{
  overflow-x:hidden;
}

/* RADIUS */

.rounded,
.rounded-lg,
.rounded-xl,
.rounded-2xl,
.rounded-3xl,
.rounded-\[28px\]{
  border-radius:4px !important;
}

/* SCROLLBAR */

::-webkit-scrollbar{
  width:6px;
}

::-webkit-scrollbar-thumb{
  background:#475569;
  border-radius:20px;
}

/* GLASS */

.glass{
  background:rgba(15,23,42,.75);
  backdrop-filter:blur(18px);
  border:1px solid rgba(255,255,255,.05);
}

/* CARD */

.card-hover{
  transition:.25s ease;
}

.card-hover:hover{
  transform:translateY(-4px);
}

/* SIDEBAR */

.sidebar-transition{
  transition:all .3s ease;
}

</style>

</head>

<body class="bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-all duration-300">

<!-- OVERLAY -->

<div id="sidebarOverlay"
class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 hidden lg:hidden"
onclick="toggleSidebar()"></div>

<!-- SIDEBAR -->

<aside id="sidebar"
class="fixed top-0 left-0 z-50 h-full w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-2xl sidebar-transition -translate-x-full lg:translate-x-0">

  <!-- TOP -->

  <div class="h-20 px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">

    <div>

      <h2 class="text-2xl font-black tracking-wide text-slate-900 dark:text-white">
        Share Partner
      </h2>

      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Earnings Dashboard
      </p>

    </div>

    <button onclick="toggleSidebar()"
    class="lg:hidden w-10 h-10 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center">

      <i data-lucide="x" class="w-5 h-5"></i>

    </button>

  </div>

  <!-- PROFILE -->

  <div class="p-5 border-b border-slate-200 dark:border-slate-800">

    <div class="flex items-center gap-3">

      <div class="w-14 h-14 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white">

        ${partner.name.charAt(0)}

      </div>

      <div>

        <h3 class="font-semibold text-slate-900 dark:text-white">
          ${partner.name}
        </h3>

        <p class="text-xs text-green-500">
          ● Active Partner
        </p>

      </div>

    </div>

  </div>

  <!-- MENU -->

  <nav class="p-4 space-y-2 overflow-y-auto h-[calc(100%-160px)]">

    <!-- ITEM -->

    <a href="/generate"
    class="flex items-center gap-4 px-4 py-3 rounded bg-blue-600 text-white shadow">

      <i data-lucide="link-2" class="w-5 h-5"></i>

      <span class="font-medium">
        Generate Links
      </span>

    </a>

    <a href="/analytics"
    class="flex items-center gap-4 px-4 py-3 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">

      <i data-lucide="bar-chart-3" class="w-5 h-5"></i>

      <span>
        Analytics
      </span>

    </a>

    <a href="/payment-settings"
    class="flex items-center gap-4 px-4 py-3 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">

      <i data-lucide="wallet" class="w-5 h-5"></i>

      <span>
        Payment Settings
      </span>

    </a>

    <a href="/payment-history"
    class="flex items-center gap-4 px-4 py-3 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">

      <i data-lucide="history" class="w-5 h-5"></i>

      <span>
        Withdraw History
      </span>

    </a>

    <a href="/support"
    class="flex items-center gap-4 px-4 py-3 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">

      <i data-lucide="headphones" class="w-5 h-5"></i>

      <span>
        Support
      </span>

    </a>

    <a href="/privacy"
    class="flex items-center gap-4 px-4 py-3 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">

      <i data-lucide="shield-check" class="w-5 h-5"></i>

      <span>
        Privacy Policy
      </span>

    </a>

    <a href="/logout"
    class="flex items-center gap-4 px-4 py-3 rounded bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition mt-5">

      <i data-lucide="log-out" class="w-5 h-5"></i>

      <span>
        Logout
      </span>

    </a>

  </nav>

</aside>

<!-- MAIN -->

<div class="lg:ml-72 min-h-screen">

  <!-- HEADER -->

  <header class="sticky top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">

    <div class="flex items-center justify-between px-4 py-4">

      <!-- LEFT -->

      <div class="flex items-center gap-3">

        <!-- MENU -->

        <button onclick="toggleSidebar()"
        class="lg:hidden w-11 h-11 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center">

          <i data-lucide="menu" class="w-5 h-5"></i>

        </button>

        <!-- TITLE -->

        <div>

          <h1 class="text-lg font-bold text-slate-900 dark:text-white">
            Share Partner
          </h1>

          <p class="text-xs text-slate-500 dark:text-slate-400">
            ${partner.name}
          </p>

        </div>

      </div>

      <!-- RIGHT -->

      <div class="flex items-center gap-3">

        <!-- DARK MODE -->

        <button id="themeToggle"
        class="w-11 h-11 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center">

          <i id="themeIcon"
          data-lucide="sun"
          class="w-5 h-5 text-yellow-500"></i>

        </button>

      </div>

    </div>

  </header>

  <!-- CONTENT -->

  <main class="p-4 md:p-7">

    <!-- ALERT -->

    <div class="glass rounded p-5 mb-6">

      <div class="flex items-center gap-4">

        <div class="w-14 h-14 rounded bg-yellow-500 flex items-center justify-center">

          <i data-lucide="badge-alert" class="w-7 h-7 text-black"></i>

        </div>

        <div>

          <h3 class="font-bold">
            Dashboard Notice
          </h3>

          <p class="text-sm text-slate-400 mt-1">
            Dashboard resets daily at 05:30 AM IST
          </p>

        </div>

      </div>

    </div>

    <!-- STATS -->

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">

      <!-- CARD -->

      <div class="glass rounded p-6 card-hover">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-black text-green-400">
              $${calc(stats.today)}
            </div>

            <div class="mt-3 text-2xl font-bold">
              ${formatViews(stats.today)}
            </div>

            <div class="mt-1 text-sm text-slate-400">
              Today Traffic
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">

            <i data-lucide="calendar-days" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

      <!-- YESTERDAY -->

      <div class="glass rounded p-6 card-hover">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-black text-green-400">
              $${calc(stats.yesterday)}
            </div>

            <div class="mt-3 text-2xl font-bold">
              ${formatViews(stats.yesterday)}
            </div>

            <div class="mt-1 text-sm text-slate-400">
              Yesterday Traffic
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">

            <i data-lucide="history" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

      <!-- MONTH -->

      <div class="glass rounded p-6 card-hover">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-black text-green-400">
              $${calc(stats.this_month)}
            </div>

            <div class="mt-3 text-2xl font-bold">
              ${formatViews(stats.this_month)}
            </div>

            <div class="mt-1 text-sm text-slate-400">
              This Month
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">

            <i data-lucide="calendar-range" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

      <!-- LAST MONTH -->

      <div class="glass rounded p-6 card-hover">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-black text-green-400">
              $${calc(stats.last_month)}
            </div>

            <div class="mt-3 text-2xl font-bold">
              ${formatViews(stats.last_month)}
            </div>

            <div class="mt-1 text-sm text-slate-400">
              Last Month
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">

            <i data-lucide="chart-column" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

      <!-- ALL TIME -->

      <div class="glass rounded p-6 card-hover">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-black text-green-400">
              $${calc(stats.all_time)}
            </div>

            <div class="mt-3 text-2xl font-bold">
              ${formatViews(stats.all_time)}
            </div>

            <div class="mt-1 text-sm text-slate-400">
              All Time Traffic
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">

            <i data-lucide="globe" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

      <!-- BALANCE -->

      <div class="glass rounded p-6 card-hover">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-black text-green-400">
              $${currentBalance}
            </div>

            <div class="mt-3 text-2xl font-bold">
              Wallet Balance
            </div>

            <div class="mt-1 text-sm text-slate-400">
              Available Amount
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-slate-700 to-black flex items-center justify-center">

            <i data-lucide="wallet-cards" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

    </div>

    <!-- WITHDRAW -->

    ${
      currentBalance >= 2
      ? `
      <button class="mt-8 px-8 py-4 rounded bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow hover:scale-105 transition">

        Request Withdrawal

      </button>
      `
      : `
      <div class="glass rounded p-5 mt-8 text-red-400 font-semibold">

        Minimum $2 required for withdrawal

      </div>
      `
    }

    <!-- FOOTER -->

    <footer class="text-center text-slate-500 mt-12 pb-6 text-sm">

      © ${new Date().getFullYear()} Share Partner Network

    </footer>

  </main>

</div>

<script>

/* REFER */

localStorage.setItem('refer_id', '${ref}');

/* LUCIDE */

lucide.createIcons();

/* SIDEBAR */

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("sidebarOverlay");

function toggleSidebar(){

  sidebar.classList.toggle("-translate-x-full");

  overlay.classList.toggle("hidden");

}

/* DARK MODE */

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

/* LOAD SAVED THEME */

if(localStorage.getItem("theme") === "light"){

  document.documentElement.classList.remove("dark");

}else{

  document.documentElement.classList.add("dark");

}

/* ICON */

function updateThemeIcon(){

  if(document.documentElement.classList.contains("dark")){

    themeIcon.setAttribute("data-lucide","sun");

  }else{

    themeIcon.setAttribute("data-lucide","moon");

  }

  lucide.createIcons();

}

updateThemeIcon();

/* TOGGLE */

themeToggle.addEventListener("click", () => {

  document.documentElement.classList.toggle("dark");

  if(document.documentElement.classList.contains("dark")){

    localStorage.setItem("theme","dark");

  }else{

    localStorage.setItem("theme","light");

  }

  updateThemeIcon();

});

</script>

</body>
</html>
`,
    { headers: { "Content-Type": "text/html; charset=UTF-8" } }
  );
};
