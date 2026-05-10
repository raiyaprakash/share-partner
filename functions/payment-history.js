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

<!-- TailwindCSS + Lucide -->
<script src="https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4.2.2/dist/index.global.min.js,npm/lucide@1.7.0/dist/umd/lucide.min.js"></script>

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

<body class="bg-slate-100 text-slate-700">

<!-- Header -->
<div class="sticky top-0 z-50 bg-white border-b border-slate-200">

    <div class="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">

        <!-- Back Button -->
        <button
            onclick="history.back()"
            class="w-9 h-9 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition"
        >
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
        </button>

        <div>
            <h1 class="text-base md:text-lg font-bold text-slate-800">
                Withdrawal History
            </h1>

            <p class="text-[11px] md:text-xs text-slate-500">
                View all your completed withdrawal payments
            </p>
        </div>

    </div>

</div>

<!-- Main -->
<div class="max-w-4xl mx-auto p-3 md:p-6">

    <!-- Main Card -->
    <div class="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">

        <!-- Hero -->
        <div class="bg-gradient-to-r from-green-600 to-emerald-500 px-4 py-7 md:px-6 md:py-8 text-center text-white">

            <div class="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-4">
                <i data-lucide="wallet" class="w-7 h-7 md:w-8 md:h-8"></i>
            </div>

            <h2 class="text-xl md:text-3xl font-extrabold">
                Payment History
            </h2>

            <p class="mt-2 text-[13px] md:text-base text-green-50">
                Track all your completed withdrawal transactions.
            </p>

        </div>

        ${
          hasWithdrawals
            ? `
            <!-- Content -->
            <div class="p-4 md:p-6">

                <!-- Top -->
                <div class="flex items-center justify-between mb-4">

                    <div class="flex items-center gap-2">
                        <i data-lucide="history" class="w-4 h-4 text-slate-500"></i>

                        <span class="text-[13px] md:text-sm font-semibold text-slate-700">
                            Payment Records
                        </span>
                    </div>

                    <div class="text-[11px] md:text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-md font-semibold">
                        ${withdrawals.results.length} Records
                    </div>

                </div>

                <!-- Table -->
                <div class="overflow-x-auto border border-slate-200 rounded-md">

                    <table class="w-full min-w-[500px]">

                        <thead class="bg-slate-50">

                            <tr>

                                <th class="w-[35%] text-left px-4 py-3 text-[11px] md:text-xs font-bold text-slate-600 uppercase tracking-wide">
                                    Amount
                                </th>

                                <th class="w-[65%] text-left px-4 py-3 text-[11px] md:text-xs font-bold text-slate-600 uppercase tracking-wide">
                                    Date & Time
                                </th>

                            </tr>

                        </thead>

                        <tbody class="divide-y divide-slate-100">

                            ${withdrawals.results
                              .map(
                                (w) => `
                                <tr class="hover:bg-slate-50 transition">

                                    <!-- Amount -->
                                    <td class="px-4 py-3">

                                        <div class="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-md text-[12px] md:text-sm font-bold">

                                            <i data-lucide="badge-dollar-sign" class="w-4 h-4"></i>

                                            $${w.amount.toFixed(2)}

                                        </div>

                                    </td>

                                    <!-- Date -->
                                    <td class="px-4 py-3">

                                        <div class="flex items-center gap-2 text-[12px] md:text-sm text-slate-600 font-medium">

                                            <i data-lucide="calendar-days" class="w-4 h-4 text-slate-400 shrink-0"></i>

                                            <span>
                                                ${new Date(
                                                  new Date(w.created_at).getTime() + 5.5 * 60 * 60 * 1000
                                                ).toLocaleString("en-IN")}
                                            </span>

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
            <div class="p-5 md:p-8 text-center">

                <div class="w-16 h-16 mx-auto rounded-full bg-yellow-100 flex items-center justify-center mb-4">
                    <i data-lucide="circle-alert" class="w-8 h-8 text-yellow-600"></i>
                </div>

                <h3 class="text-base md:text-lg font-bold text-slate-800 mb-1">
                    No Withdrawal History
                </h3>

                <p class="text-[13px] md:text-sm text-slate-500 leading-6 max-w-sm mx-auto">
                    Your withdrawal records will appear here once you make a successful payment request.
                </p>

            </div>
            `
        }

    </div>

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
