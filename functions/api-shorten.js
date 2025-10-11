export const config = {
  unique_link: true,
};

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

function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function save_url(URL, LINKS) {
  const random_key = await randomString();
  const is_exist = await LINKS.get(random_key);
  if (is_exist) {
    // Try again if collision
    return await save_url(URL, LINKS);
  } else {
    await LINKS.put(random_key, URL);
    return random_key;
  }
}

async function is_url_exist(url_sha512, LINKS) {
  return await LINKS.get(url_sha512);
}

export async function onRequest(context) {
  const { request, env } = context;
  const LINKS = env.LINKS;

  // Handle only POST requests
  if (request.method !== "POST") {
    return new Response("Not Found", { status: 404 });
  }

  let req;
  try {
    req = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { url: longURL, userId } = req;

  if (!longURL)
    return new Response(JSON.stringify({ error: "url is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

  if (!userId)
    return new Response(JSON.stringify({ error: "userId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

  if (!isValidURL(longURL)) {
    return new Response(JSON.stringify({ error: "Invalid URL format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
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

  // Build short URL correctly for Cloudflare Pages
  const baseUrl = new URL(request.url);
  const shortUrl = `${baseUrl.origin}/link/${random_key}`;

  return new Response(
    JSON.stringify({ shortUrl, userId }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
