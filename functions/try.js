export const config = {
  theme: "", // Homepage theme, leave empty for default
  cors: "on",
  unique_link: true,
  custom_link: false
}

const html404 = `<!DOCTYPE html>
<body>
  <h1>404 Not Found.</h1>
  <p>The url you visit is not found.</p>
  <a href="https://github.com/xyTom/Url-Shorten-Worker/" target="_self">Fork me on GitHub</a>
</body>`

let response_header = {
  "content-type": "text/html;charset=UTF-8",
}

if (config.cors === "on") {
  response_header = {
    "content-type": "text/html;charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST",
  }
}

async function randomString(len = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function sha512(url) {
  const data = new TextEncoder().encode(url);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkURL(URL) {
  const regex = /^https?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/;
  return regex.test(URL);
}

async function save_url(URL, LINKS) {
  const random_key = await randomString();
  const is_exist = await LINKS.get(random_key);
  if (!is_exist) {
    await LINKS.put(random_key, URL);
    return random_key;
  } else {
    return save_url(URL, LINKS);
  }
}

async function is_url_exist(url_sha512, LINKS) {
  return await LINKS.get(url_sha512);
}

// **Main function**
export async function onRequest(context) {
  const { request, env } = context;
  const LINKS = env.LINKS; // KV binding
  const urlObj = new URL(request.url);
  const path = urlObj.pathname.slice(1); // Remove leading "/"
  const params = urlObj.search;

  // --- Handle POST request ---
  if (request.method === "POST") {
    const req = await request.json();
    const longURL = req.url;

    if (!await checkURL(longURL)) {
      return new Response(`{"status":500,"key":": Error: Url illegal."}`, { headers: response_header });
    }

    let random_key;

    if (config.unique_link) {
      const url_hash = await sha512(longURL);
      const exist_key = await is_url_exist(url_hash, LINKS);
      if (exist_key) {
        random_key = exist_key;
      } else {
        random_key = await save_url(longURL, LINKS);
        await LINKS.put(url_hash, random_key);
      }
    } else {
      random_key = await save_url(longURL, LINKS);
    }

    return new Response(`{"status":200,"key":"/${random_key}"}`, { headers: response_header });
  }

  // --- Handle OPTIONS ---
  if (request.method === "OPTIONS") {
    return new Response("", { headers: response_header });
  }

  // --- Serve homepage if root path ---
  if (!path) {
    const html = await fetch(`https://xytom.github.io/Url-Shorten-Worker/${config.theme}/index.html`);
    return new Response(await html.text(), { headers: { "content-type": "text/html;charset=UTF-8" } });
  }

  // --- Redirect if key exists ---
  const value = await LINKS.get(path);
  if (value) {
    return Response.redirect(value + params, 302);
  }

  // --- 404 ---
  return new Response(html404, { headers: { "content-type": "text/html;charset=UTF-8" }, status: 404 });
}
