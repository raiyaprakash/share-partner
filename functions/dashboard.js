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

<script src='https://cdn.jsdelivr.net/combine//npm/@tailwindcss/browser@4.2.2/dist/index.global.min.js,npm/lucide@1.7.0/dist/umd/lucide.min.js'></script>
<link href='/favicon.ico' rel='icon' type='image/x-icon'/>

<style>
@import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');

*{
  font-family:'Roboto',sans-serif;
  box-sizing:border-box;
}

body{
  overflow-x:hidden;
  background:#f1f5f9;
}

/* BORDER RADIUS */

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
  background:#ffffff;
  border:1px solid #e2e8f0;
}

/* SIDEBAR */

.sidebar-transition{
  transition:all .3s ease;
}

</style>

</head>

<body>

<!-- OVERLAY -->

<div id="sidebarOverlay"
class="fixed inset-0 bg-black/50 z-40 hidden lg:hidden"
onclick="toggleSidebar()"></div>

<!-- SIDEBAR -->

<aside id="sidebar"
class="fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-slate-200 shadow-xl sidebar-transition -translate-x-full lg:translate-x-0">

  <!-- TOP -->

  <div class="h-20 px-6 flex items-center justify-between border-b border-slate-200">

    <div>

      <h2 class="text-xl font-bold text-slate-900">
        Share Partner
      </h2>

      <p class="text-xs text-slate-500 mt-1">
        Earnings Dashboard
      </p>

    </div>

    <!-- CLOSE -->

    <button onclick="toggleSidebar()"
    class="lg:hidden w-10 h-10 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center">

      <i data-lucide="x" class="w-5 h-5 text-slate-700"></i>

    </button>

  </div>

  <!-- PROFILE -->

  <div class="p-5 border-b border-slate-200">

    <div class="flex items-center gap-3">

      <div class="w-14 h-14 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow">

        ${partner.name.charAt(0)}

      </div>

      <div>

        <h3 class="font-semibold text-slate-900">
          ${partner.name}
        </h3>

        <p class="text-xs text-green-500 mt-1">
          ● Active Partner
        </p>

      </div>

    </div>

  </div>

  <!-- MENU -->
<!-- MENU -->

<nav class="p-4 space-y-2 overflow-y-auto h-[calc(100%-160px)]">

  <!-- GENERATE -->

  <a href="/generate"
  class="flex items-center gap-4 px-4 py-3 rounded bg-blue-600 text-white shadow">

    <i data-lucide="link-2" class="w-5 h-5"></i>

    <span class="font-medium">
      Generate
    </span>

  </a>

  <!-- SETTINGS -->

  <a href="/payment-settings"
  class="flex items-center gap-4 px-4 py-3 rounded text-slate-700 hover:bg-slate-100 transition">

    <i data-lucide="building-2" class="w-5 h-5"></i>

    <span>
      Settings
    </span>

  </a>

  <!-- WITHDRAWAL -->

  <a href="/payment-history"
  class="flex items-center gap-4 px-4 py-3 rounded text-slate-700 hover:bg-slate-100 transition">

    <i data-lucide="wallet" class="w-5 h-5"></i>

    <span>
      Withdrawal
    </span>

  </a>

  <!-- CONTACT -->

  <a href="/contact"
  class="flex items-center gap-4 px-4 py-3 rounded text-slate-700 hover:bg-slate-100 transition">

    <i data-lucide="phone" class="w-5 h-5"></i>

    <span>
      Contact
    </span>

  </a>

  <!-- PRIVACY -->

  <a href="/privacy"
  class="flex items-center gap-4 px-4 py-3 rounded text-slate-700 hover:bg-slate-100 transition">

    <i data-lucide="shield-check" class="w-5 h-5"></i>

    <span>
      Privacy
    </span>

  </a>

  <!-- TERMS -->

  <a href="/terms"
  class="flex items-center gap-4 px-4 py-3 rounded text-slate-700 hover:bg-slate-100 transition">

    <i data-lucide="file-text" class="w-5 h-5"></i>

    <span>
      Terms
    </span>

  </a>

<!-- BALANCE HEADER -->

<div class="flex items-center gap-3">

  <div class="bg-green-500 text-white px-4 py-2 rounded shadow flex items-center gap-2">

    <i data-lucide="wallet-2" class="w-5 h-5"></i>

    <div class="leading-tight">

      <div class="text-[11px] opacity-80">
        Balance
      </div>

      <div class="font-bold text-sm">
        $${currentBalance}
      </div>

    </div>

  </div>

</div>
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

<header class="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">

  <div class="flex items-center justify-between px-4 py-4">

    <!-- LEFT -->

    <div class="flex items-center gap-3">

      <!-- MENU -->

      <button onclick="toggleSidebar()"
      class="lg:hidden w-11 h-11 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center">

        <i data-lucide="menu" class="w-5 h-5 text-slate-700"></i>

      </button>

      <!-- TITLE -->

      <div>

        <h1 class="text-lg font-bold text-slate-900">
          Dashboard
        </h1>

        <p class="text-xs text-slate-500">
          Welcome Back
        </p>

      </div>

    </div>

    <!-- BALANCE HEADER -->

    <div class="flex items-center gap-3">

      <div class="bg-green-500 text-white px-4 py-2 rounded shadow flex items-center gap-2">

        <i data-lucide="wallet-2" class="w-5 h-5"></i>

        <div class="leading-tight">

          <div class="text-[11px] opacity-80">
            Balance
          </div>

          <div class="font-bold text-sm">
            $${currentBalance}
          </div>

        </div>

      </div>

    </div>

  </div>

</header>

  <!-- CONTENT -->

  <main class="p-4 md:p-7">

    <!-- NOTICE -->

    <div class="glass rounded p-5 mb-6 shadow-sm">

      <div class="flex items-center gap-4">

        <div class="w-14 h-14 rounded bg-yellow-400 flex items-center justify-center">

          <i data-lucide="badge-alert" class="w-7 h-7 text-black"></i>

        </div>

        <div>

          <h3 class="font-bold text-slate-900">
            Dashboard Notice
          </h3>

          <p class="text-sm text-slate-500 mt-1">
            Dashboard resets daily at 05:30 AM IST
          </p>

        </div>

      </div>

    </div>

    <!-- STATS -->

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">

<!-- TODAY RPM -->

<div class="glass rounded p-6 card-hover shadow-sm">

  <div class="flex items-start justify-between">

    <div>

      <div class="text-4xl font-black text-blue-500">
        $${rpm}
      </div>

      <div class="mt-3 text-2xl font-bold text-slate-900">
        RPM
      </div>

      <div class="mt-1 text-sm text-slate-500">
        Today Page RPM
      </div>

    </div>

    <div class="w-16 h-16 rounded bg-blue-500 flex items-center justify-center shadow">

      <i data-lucide="badge-dollar-sign" class="w-8 h-8 text-white"></i>

    </div>

  </div>

</div>

      <!-- TODAY -->

      <div class="glass rounded p-6 card-hover shadow-sm">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-bold text-blue-500">
              $${calc(stats.today)}
            </div>

            <div class="mt-3 text-2xl font-bold text-slate-900">
              ${formatViews(stats.today)}
            </div>

            <div class="mt-1 text-sm text-slate-500">
              Today Traffic
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">

            <i data-lucide="calendar-days" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

      <!-- YESTERDAY -->

      <div class="glass rounded p-6 card-hover shadow-sm">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-bold text-blue-500">
              $${calc(stats.yesterday)}
            </div>

            <div class="mt-3 text-2xl font-bold text-slate-900">
              ${formatViews(stats.yesterday)}
            </div>

            <div class="mt-1 text-sm text-slate-500">
              Yesterday Traffic
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow">

            <i data-lucide="history" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

      <!-- THIS MONTH -->

      <div class="glass rounded p-6 card-hover shadow-sm">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-bold text-blue-500">
              $${calc(stats.this_month)}
            </div>

            <div class="mt-3 text-2xl font-bold text-slate-900">
              ${formatViews(stats.this_month)}
            </div>

            <div class="mt-1 text-sm text-slate-500">
              This Month
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow">

            <i data-lucide="calendar-range" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

      <!-- LAST MONTH -->

      <div class="glass rounded p-6 card-hover shadow-sm">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-bold text-blue-500">
              $${calc(stats.last_month)}
            </div>

            <div class="mt-3 text-2xl font-bold text-slate-900">
              ${formatViews(stats.last_month)}
            </div>

            <div class="mt-1 text-sm text-slate-500">
              Last Month
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow">

            <i data-lucide="chart-column" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

      <!-- ALL TIME -->

      <div class="glass rounded p-6 card-hover shadow-sm">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-bold text-blue-500">
              $${calc(stats.all_time)}
            </div>

            <div class="mt-3 text-2xl font-bold text-slate-900">
              ${formatViews(stats.all_time)}
            </div>

            <div class="mt-1 text-sm text-slate-500">
              All Time Traffic
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow">

            <i data-lucide="globe" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

      <!-- BALANCE -->

      <div class="glass rounded p-6 card-hover shadow-sm">

        <div class="flex items-start justify-between">

          <div>

            <div class="text-4xl font-bold text-blue-500">
              $${currentBalance}
            </div>

            <div class="mt-3 text-2xl font-bold text-slate-900">
              Wallet Balance
            </div>

            <div class="mt-1 text-sm text-slate-500">
              Available Amount
            </div>

          </div>

          <div class="w-16 h-16 rounded bg-gradient-to-br from-slate-700 to-black flex items-center justify-center shadow">

            <i data-lucide="wallet-cards" class="w-8 h-8 text-white"></i>

          </div>

        </div>

      </div>

    </div>

    <!-- WITHDRAW -->

    ${
      currentBalance >= 2
      ? `
<button
class="mt-8 px-8 py-4 rounded bg-green-700 hover:bg-slate-900 text-white hover:text-green-400 font-bold shadow transition-all duration-300 flex items-center gap-2">
<i data-lucide="wallet-2" class="w-5 h-5"></i><span>Request Withdrawal</span></button>
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
      </script>
      `
      : `
      <div class="glass rounded p-5 mt-8 text-red-500 font-semibold shadow-sm">

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

/* ICONS */

lucide.createIcons();

/* REFER */

localStorage.setItem('refer_id', '${ref}');

/* SIDEBAR */

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("sidebarOverlay");

function toggleSidebar(){

  sidebar.classList.toggle("-translate-x-full");

  overlay.classList.toggle("hidden");

}

</script>

</body>
</html>
`,
    { headers: { "Content-Type": "text/html; charset=UTF-8" } }
  );
};
