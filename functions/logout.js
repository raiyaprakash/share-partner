export const onRequestPost = async ({ request, env }) => {
  const cookieOptions = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

  const headers = new Headers();
  headers.append("Set-Cookie", `referid=0; ${cookieOptions}`);
  headers.append("Set-Cookie", `partner_name=a; ${cookieOptions}`);
  headers.append("Location", "/login");

  return new Response(null, {
    status: 302,
    headers,
  });
};
