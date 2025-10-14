export const onRequestPost = async ({ request, env }) => {
  const formData = await request.formData();
  const referid = formData.get("referid");
  const password = formData.get("password");
  const db = env.DB;

  if (!referid || !password) {
    return new Response("Missing credentials", { status: 400 });
  }

  // Verify partner
  const partner = await db
    .prepare("SELECT * FROM partners WHERE partner_id=? AND password=?")
    .bind(referid, password)
    .first();

  if (partner) {
    const cookieOptions = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400";

    const headers = new Headers();
    headers.append("Set-Cookie", `referid=${partner.partner_id}; ${cookieOptions}`);
    headers.append("Set-Cookie", `partner_name=${encodeURIComponent(partner.name)}; ${cookieOptions}`);
    headers.append("Set-Cookie", `partner_pass=${encodeURIComponent(partner.password)}; ${cookieOptions}`);
    headers.append("Location", "/dashboard");

    return new Response(null, {
      status: 302,
      headers,
    });
  } else {
    return new Response("Invalid login", { status: 401 });
  }
};
