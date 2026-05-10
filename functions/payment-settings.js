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
  const password = getCookie(request, "partner_pass");

  // Verify partner
  const partner = await db
    .prepare("SELECT * FROM partners WHERE partner_id=? AND password=?")
    .bind(ref, password)
    .first();

  if (!partner) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login" },
    });
  }

  // Handle form submission
  if (request.method === "POST") {
    const formData = await request.formData();
    const name = formData.get("name")?.trim();
    const phone = formData.get("phone")?.trim();
    const method = formData.get("method") || "upi";
    const bank_name = formData.get("bank_name")?.trim() || "";
    const account_number = formData.get("account_number")?.trim() || "";
    const ifsc_code = formData.get("ifsc_code")?.trim() || "";
    const upi_id = formData.get("upi_id")?.trim() || "";

    // Validate required fields
    if (!name || !phone) {
      return new Response(
        JSON.stringify({ status: "error", msg: "Name and Phone are required" }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      );
    }

    await db
      .prepare(`
        INSERT INTO payment_info 
          (partner_id, name, phone, method, bank_name, account_number, ifsc_code, upi_id, last_modified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(partner_id)
        DO UPDATE SET
          name = excluded.name,
          phone = excluded.phone,
          method = excluded.method,
          bank_name = excluded.bank_name,
          account_number = excluded.account_number,
          ifsc_code = excluded.ifsc_code,
          upi_id = excluded.upi_id,
          last_modified = CURRENT_TIMESTAMP
      `)
      .bind(ref, name, phone, method, bank_name, account_number, ifsc_code, upi_id)
      .run();

    return new Response(null, {
      status: 302,
      headers: { Location: "/payment-settings" },
    });
  }

  // Fetch existing details
  const data = await db
    .prepare("SELECT * FROM payment_info WHERE partner_id=?")
    .bind(ref)
    .first();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Settings</title>

  <link href="/favicon.ico" rel="icon" type="image/x-icon"/>

<script src='https://cdn.jsdelivr.net/combine//npm/@tailwindcss/browser@4.2.2/dist/index.global.min.js,npm/lucide@1.7.0/dist/umd/lucide.min.js'></script>

  <!-- Font -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    body{
      font-family:'Inter',sans-serif;
    }
  </style>
</head>

<body class="bg-slate-100 min-h-screen">

  <!-- Header -->
  <header class="bg-white border-b border-slate-200">
    <div class="max-w-2xl mx-auto px-3 py-3 flex items-center justify-between">

      <div class="flex items-center gap-2">
        <div class="w-10 h-10 rounded bg-blue-100 flex items-center justify-center">
          <i data-lucide="wallet" class="w-4 h-4 text-blue-600"></i>
        </div>

        <div>
          <h1 class="text-base md:text-lg font-semibold text-slate-800">
            Payment Settings
          </h1>

          <p class="text-xs text-slate-500">
            Manage payout details
          </p>
        </div>
      </div>

      <a
        href="/dashboard"
        class="h-10 px-3 rounded bg-slate-100 hover:bg-slate-200 transition flex items-center gap-2 text-sm text-slate-700"
      >
        <i data-lucide="arrow-left" class="w-4 h-4"></i>
        Back
      </a>

    </div>
  </header>

  <!-- Main -->
  <main class="max-w-2xl mx-auto p-3 md:p-4">

    <form method="POST" class="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">

      <!-- Top Banner -->
      <div class="bg-blue-600 p-4 text-white">

        <div class="flex items-center gap-3">

          <div class="w-10 h-10 rounded bg-white/20 flex items-center justify-center">
            <i data-lucide="credit-card" class="w-5 h-5"></i>
          </div>

          <div>
            <h2 class="text-base font-semibold">
              Update Payment Information
            </h2>

            <p class="text-xs text-blue-100 mt-1">
              Add your bank or UPI details securely.
            </p>
          </div>

        </div>

      </div>

      <!-- Form Body -->
      <div class="p-4 md:p-5 space-y-4">

        <!-- Name -->
        <div>
          <label class="text-sm font-medium text-slate-700 flex items-center gap-2 mb-1">
            <i data-lucide="user" class="w-4 h-4"></i>
            Full Name
          </label>

          <input
            type="text"
            name="name"
            value="${data?.name || ""}"
            required
            placeholder="Enter your full name"
            class="w-full h-10 rounded border border-slate-300 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <!-- Phone -->
        <div>
          <label class="text-sm font-medium text-slate-700 flex items-center gap-2 mb-1">
            <i data-lucide="phone" class="w-4 h-4"></i>
            Phone Number
          </label>

          <input
            type="tel"
            name="phone"
            value="${data?.phone || ""}"
            required
            placeholder="Enter phone number"
            class="w-full h-10 rounded border border-slate-300 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <!-- Payment Method -->
        <div>
          <label class="text-sm font-medium text-slate-700 flex items-center gap-2 mb-1">
            <i data-lucide="circle-dollar-sign" class="w-4 h-4"></i>
            Payment Method
          </label>

          <select
            name="method"
            id="method"
            onchange="toggleFields()"
            class="w-full h-10 rounded border border-slate-300 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="bank" ${data?.method === "bank" ? "selected" : ""}>
              Bank Transfer
            </option>

            <option value="upi" ${data?.method === "upi" ? "selected" : ""}>
              UPI Transfer
            </option>
          </select>
        </div>

        <!-- Bank Fields -->
        <div
          id="bankFields"
          class="rounded border border-slate-200 p-4 bg-slate-50 space-y-4"
        >

          <div class="flex items-center gap-2 text-sm font-medium text-slate-700">
            <i data-lucide="building-2" class="w-4 h-4"></i>
            Bank Details
          </div>

          <div>
            <label class="text-sm font-medium text-slate-600 mb-1 block">
              Bank Name
            </label>

            <input
              type="text"
              name="bank_name"
              value="${data?.bank_name || ""}"
              placeholder="State Bank of India"
              class="w-full h-10 rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label class="text-sm font-medium text-slate-600 mb-1 block">
              Account Number
            </label>

            <input
              type="text"
              name="account_number"
              value="${data?.account_number || ""}"
              placeholder="XXXXXXXXXXXX"
              class="w-full h-10 rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label class="text-sm font-medium text-slate-600 mb-1 block">
              IFSC Code
            </label>

            <input
              type="text"
              name="ifsc_code"
              value="${data?.ifsc_code || ""}"
              placeholder="SBIN0001234"
              class="w-full h-10 rounded border border-slate-300 bg-white px-3 text-sm uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

        </div>

        <!-- UPI Fields -->
        <div
          id="upiFields"
          class="rounded border border-slate-200 p-4 bg-slate-50 space-y-4"
        >

          <div class="flex items-center gap-2 text-sm font-medium text-slate-700">
            <i data-lucide="smartphone" class="w-4 h-4"></i>
            UPI Details
          </div>

          <div>
            <label class="text-sm font-medium text-slate-600 mb-1 block">
              UPI ID
            </label>

            <input
              type="text"
              name="upi_id"
              value="${data?.upi_id || ""}"
              placeholder="example@upi"
              class="w-full h-10 rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

        </div>

        <!-- Last Modified -->
        ${
          data?.last_modified
            ? `
            <div class="rounded border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">

              <i data-lucide="clock-3" class="w-4 h-4 text-amber-600 mt-0.5"></i>

              <div>
                <p class="text-sm font-medium text-amber-800">
                  Last Modified
                </p>

                <p class="text-xs text-amber-700 mt-1">
                  ${new Date(data.last_modified).toLocaleString("en-IN")}
                </p>
              </div>

            </div>
            `
            : ""
        }

        <!-- Save Button -->
        <button
          type="submit"
          class="w-full h-11 rounded bg-blue-600 hover:bg-blue-700 transition text-white text-sm font-medium flex items-center justify-center gap-2"
        >
          <i data-lucide="save" class="w-4 h-4"></i>
          Save Changes
        </button>

      </div>

    </form>

  </main>

  <!-- Footer -->
  <footer class="text-center text-xs text-slate-500 py-6">
    © ${new Date().getFullYear()} ShareLinks Partner Network
  </footer>

  <script>

    function toggleFields() {

      const method = document.getElementById('method').value;

      document.getElementById('bankFields').style.display =
        method === 'bank' ? 'block' : 'none';

      document.getElementById('upiFields').style.display =
        method === 'upi' ? 'block' : 'none';
    }

    toggleFields();

    lucide.createIcons();

  </script>

</body>
</html>
`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
};
