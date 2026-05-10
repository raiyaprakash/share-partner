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
  const url = new URL(request.url);
  const ref = getCookie(request, "referid");
  const rpm = 0.35; // default RPM if not in DB

  // 🔹 Redirect if not logged in
  if (!ref) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login" },
    });
  }

  const withdrawals = await db
    .prepare(
      `SELECT amount, created_at
       FROM withdrawals
       WHERE partner_id=?
       ORDER BY created_at DESC`
    )
    .bind(ref)
    .all();

  const hasWithdrawals = withdrawals.results.length > 0;

  // --- HTML Dashboard
  return new Response(
    `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment History</title>

  <link href="/favicon.ico" rel="icon" type="image/x-icon"/>

<script src='https://cdn.jsdelivr.net/combine//npm/@tailwindcss/browser@4.2.2/dist/index.global.min.js,npm/lucide@1.7.0/dist/umd/lucide.min.js'></script>

  <!-- Font -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Mukta:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

  <style>
    body{
      font-family: "Mukta", sans-serif;
    }

    ::-webkit-scrollbar{
      width:6px;
      height:6px;
    }

    ::-webkit-scrollbar-thumb{
      background:#cbd5e1;
      border-radius:10px;
    }
  </style>
</head>
<body class="bg-slate-100 min-h-screen p-3 sm:p-5">

  <div class="max-w-3xl mx-auto">
    <!-- Back Button -->
    <button
      onclick="history.back()"
      class="mb-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all"
    >
      <i data-lucide="arrow-left" class="w-4 h-4"></i>
      Back to Previous Page
    </button>
    
    <!-- Header -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 mb-4">

      <div class="flex items-center gap-3">

        <div class="w-11 h-11 rounded-lg bg-green-100 flex items-center justify-center">
          <i data-lucide="wallet" class="w-5 h-5 text-green-600"></i>
        </div>

        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">
            Withdrawal History
          </h2>

          <p class="text-sm text-slate-500 mt-0.5">
            View all your completed withdrawal payments
          </p>
        </div>

      </div>

    </div>

    ${
      hasWithdrawals
        ? `
        <!-- Table Card -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

          <!-- Top -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">

            <div class="flex items-center gap-2">
              <i data-lucide="history" class="w-4 h-4 text-slate-500"></i>
              <span class="text-sm font-semibold text-slate-700">
                Payment Records
              </span>
            </div>

            <div class="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-md font-medium">
              ${withdrawals.results.length} Records
            </div>

          </div>

          <!-- Responsive Table -->
          <div class="overflow-x-auto">

            <table class="w-full">

              <thead class="bg-slate-50">
                <tr>
                  <th class="w-1/2 text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Amount
                  </th>

                  <th class="w-1/2 text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Date & Time
                  </th>
                </tr>
              </thead>

              <tbody class="divide-y divide-slate-100">

                ${withdrawals.results
                  .map(
                    (w) => `
                    <tr class="hover:bg-slate-50 transition">

                      <td class="w-1/2 px-4 py-3">

                        <div class="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-sm font-bold">

                          <!--i data-lucide="dollar-sign" class="w-4 h-4"></i-->

                          $${w.amount.toFixed(2)}

                        </div>

                      </td>

                      <td class="w-1/2 px-4 py-3 text-sm text-slate-600 font-medium">

                        <div class="flex items-center gap-2">

                          <i data-lucide="calendar-days" class="w-4 h-4 text-slate-400"></i>

                          ${new Date(
                            new Date(w.created_at).getTime() + 5.5 * 60 * 60 * 1000
                          ).toLocaleString("en-IN")}

                        </div>

                      </td>

                    </tr>
                  `
                  )
                  .join("")}

              </tbody>

            </table>

          </div>

        </div>
        `
        : `
        <!-- Empty State -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">

          <div class="w-16 h-16 mx-auto rounded-full bg-yellow-100 flex items-center justify-center mb-4">
            <i data-lucide="circle-alert" class="w-8 h-8 text-yellow-600"></i>
          </div>

          <h3 class="text-lg font-bold text-slate-800 mb-1">
            No Withdrawal History
          </h3>

          <p class="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
            Your withdrawal records will appear here once you make a successful payment request.
          </p>

        </div>
        `
    }

  </div>

  <script>
    lucide.createIcons();
  </script>

</body>
</html>
    `,
    { headers: { "Content-Type": "text/html; charset=UTF-8" } }
  );
};
