export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const db = env.DB;
  const ref = url.searchParams.get("ref");
  const amount = parseFloat(url.searchParams.get("amount"));

  if (!ref || !amount) return new Response(JSON.stringify({ status: "error", msg: "Missing params" }), { headers: { "Content-Type": "application/json" } });
  if (amount < 2) return new Response(JSON.stringify({ status: "error", msg: "Minimum $2 required" }), { headers: { "Content-Type": "application/json" } });

  // Telegram notification
  const TELEGRAM_BOT = "6170013080:AAGFwN-44dz21EMnR6jaXQnrBKnvclkXGes";
  const TELEGRAM_CHAT_ID = "-1001774121896";

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `💰 Withdrawal Request\nPartner ID: ${ref}\nAmount: $${amount}\n✅ Note: Amount will be transferred to account within 24h.`
      })
    });
    const data = await response.json();
    if (!data.ok) return new Response(JSON.stringify({ status: "error", msg: `Telegram error: ${data.description}` }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ status: "error", msg: "Failed to send Telegram notification" }), { headers: { "Content-Type": "application/json" } });
  }

  await db.prepare("INSERT INTO withdrawals (partner_id, amount) VALUES (?, ?)").bind(ref, amount).run();
  return new Response(JSON.stringify({ status: "ok", msg: "Withdrawal request sent! Amount will be transferred within 24h." }), { headers: { "Content-Type": "application/json" } });
};
