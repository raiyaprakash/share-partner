export default {
  async fetch(request,env) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/")[1];
    const LINKS = env.LINKS; // KV binding
    if (url.pathname.endsWith('*')) {
      // Remove the trailing *
      url.pathname = url.pathname.slice(0, -1);
  
      // Redirect with 302
      return Response.redirect(url.toString(), 302);
    }
    if (pathParts) {
      const value = await LINKS.get(pathParts);
  if(value) {
return Response.redirect(value, 302);
  } else {
return new Response("Not Found");
  }
    }

  //  return Response.redirect("https://sharelinks.in/", 302);
  }
}
