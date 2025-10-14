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

  if (!ref) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login" },
    });
  }

  // Handle form submission
  if (request.method === "POST") {
    const formData = await request.formData();
    const method = formData.get("method") || "upi";
    const bank_name = formData.get("bank_name")?.trim() || "";
    const account_number = formData.get("account_number")?.trim() || "";
    const ifsc_code = formData.get("ifsc_code")?.trim() || "";
    const upi_id = formData.get("upi_id")?.trim() || "";

    await db
      .prepare(`
        INSERT INTO payment_info (partner_id, method, bank_name, account_number, ifsc_code, upi_id, last_modified)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(partner_id)
        DO UPDATE SET
          method = excluded.method,
          bank_name = excluded.bank_name,
          account_number = excluded.account_number,
          ifsc_code = excluded.ifsc_code,
          upi_id = excluded.upi_id,
          last_modified = CURRENT_TIMESTAMP
      `)
      .bind(ref, method, bank_name, account_number, ifsc_code, upi_id)
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
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Payment Settings</title>
<style>
body {
  font-family: 'Mukta', sans-serif;
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
form {
  background:white;
  padding:20px;
  border-radius:8px;
  box-shadow:0 2px 6px rgba(0,0,0,0.1);
  margin:20px;
}
label {
  display:block;
  font-weight:600;
  margin-top:12px;
}
input, select {
  width:100%;
  padding:8px;
  margin-top:4px;
  border:1px solid #ccc;
  border-radius:4px;
}
button {
  margin-top:20px;
  padding:10px 18px;
  background:#28a745;
  color:white;
  border:none;
  border-radius:4px;
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
</style>
</head>
<body>
<header>
  <h1>Payment Settings</h1>
  <a href="/dashboard" style="color:white;text-decoration:none;">⬅ Back</a>
</header>

<form method="POST">
  <label>Payment Method</label>
  <select name="method" id="method" onchange="toggleFields()">
    <option value="bank" ${data?.method === "bank" ? "selected" : ""}>Bank Transfer</option>
    <option value="upi" ${data?.method === "upi" ? "selected" : ""}>UPI Transfer</option>
  </select>

  <div id="bankFields" style="display:none;">
    <label>Bank Name</label>
    <input name="bank_name" value="${data?.bank_name || ""}" />

    <label>Account Number</label>
    <input name="account_number" value="${data?.account_number || ""}" />

    <label>IFSC Code</label>
    <input name="ifsc_code" value="${data?.ifsc_code || ""}" />
  </div>

  <div id="upiFields" style="display:none;">
    <label>UPI ID</label>
    <input name="upi_id" value="${data?.upi_id || ""}" />
  </div>

  <button type="submit">Save Changes</button>

  ${
    data?.last_modified
      ? `<p style="margin-top:15px;font-size:14px;color:#666;">
          Last Modified: ${new Date(data.last_modified).toLocaleString("en-IN")}
        </p>`
      : ""
  }
</form>

<script>
function toggleFields() {
  const method = document.getElementById('method').value;
  document.getElementById('bankFields').style.display = method === 'bank' ? 'block' : 'none';
  document.getElementById('upiFields').style.display = method === 'upi' ? 'block' : 'none';
}
// Initialize display
toggleFields();
</script>

<footer>
  © ${new Date().getFullYear()} ShareLinks Partner Network
</footer>
</body>
</html>
`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
};
