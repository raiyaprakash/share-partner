export const onRequestGet = async () => {
  const cookieOptions = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

  const headers = new Headers();
  headers.append("Set-Cookie", `referid=; ${cookieOptions}`);
  headers.append("Set-Cookie", `partner_name=; ${cookieOptions}`);
  headers.append("Set-Cookie", `partner_pass=; ${cookieOptions}`);
  headers.append("Location", "/login");

  return new Response(null, { status: 302, headers });
};
