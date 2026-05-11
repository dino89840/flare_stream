// =============================================================
// Streamtape Link Keeper — Cloudflare Worker
// Cron: 12 နာရီတစ်ခါ auto ping
// Web UI: link add/delete/list လုပ်လို့ရတယ်
// KV: link list သိမ်းတယ်
// =============================================================

const KV_KEY = "streamtape_links";

// ── HTML Page (Admin UI) ──
function renderPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Streamtape Keeper</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:1rem}
  .wrap{max-width:720px;margin:0 auto}
  h1{font-size:1.4rem;margin-bottom:1rem;text-align:center}
  .card{background:#1e293b;padding:1.2rem;border-radius:12px;margin-bottom:1rem;box-shadow:0 4px 12px rgba(0,0,0,.3)}
  input,textarea,button{font-family:inherit;font-size:1rem;width:100%;padding:.7rem;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;margin-bottom:.6rem}
  textarea{min-height:100px;resize:vertical}
  button{background:#3b82f6;color:#fff;border:none;cursor:pointer;font-weight:600}
  button:hover{background:#2563eb}
  button.danger{background:#dc2626}
  button.danger:hover{background:#b91c1c}
  button.small{width:auto;padding:.4rem .8rem;font-size:.85rem;margin:0}
  .link-item{background:#0f172a;padding:.7rem;border-radius:6px;margin-bottom:.5rem;display:flex;justify-content:space-between;align-items:center;gap:.5rem;word-break:break-all;font-size:.85rem}
  .link-url{flex:1;overflow:hidden;text-overflow:ellipsis}
  .status{font-size:.75rem;color:#94a3b8;margin-top:.2rem}
  .ok{color:#22c55e}
  .err{color:#ef4444}
  .muted{color:#94a3b8;font-size:.85rem;margin-bottom:.5rem}
  .row{display:flex;gap:.5rem;align-items:center}
  .row input{flex:1;margin:0}
  #log{font-family:monospace;font-size:.75rem;background:#020617;padding:.7rem;border-radius:6px;max-height:200px;overflow:auto;white-space:pre-wrap}
</style>
</head>
<body>
<div class="wrap">
  <h1>🎬 Streamtape Keeper</h1>

  <div class="card">
    <div class="muted">Admin password ထည့်ပါ</div>
    <input type="password" id="pw" placeholder="password" autocomplete="current-password">
    <button onclick="loadLinks()">Login / Refresh</button>
  </div>

  <div class="card">
    <div class="muted">Link အသစ်ထည့်ရန် (တစ်ခုစီ line တစ်ကြောင်း)</div>
    <textarea id="newLinks" placeholder="https://streamtape.com/v/XXXXX/title.mp4&#10;https://streamtape.com/e/YYYYY"></textarea>
    <button onclick="addLinks()">Add Links</button>
  </div>

  <div class="card">
    <div class="row" style="margin-bottom:.7rem">
      <strong style="flex:1">Saved Links (<span id="count">0</span>)</strong>
      <button class="small" onclick="pingNow()">Ping Now</button>
    </div>
    <div id="list"></div>
  </div>

  <div class="card">
    <div class="muted">Last run log</div>
    <div id="log">No log yet.</div>
  </div>
</div>

<script>
let PW = "";

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {"Content-Type":"application/json","X-Admin-Password":PW},
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadLinks() {
  PW = document.getElementById("pw").value;
  if (!PW) { alert("Password ထည့်ပါ"); return; }
  try {
    const data = await api("/api/list");
    renderList(data.links || []);
    document.getElementById("log").textContent = data.lastLog || "No log yet.";
  } catch (e) {
    alert("Error: " + e.message);
  }
}

function renderList(links) {
  document.getElementById("count").textContent = links.length;
  const list = document.getElementById("list");
  if (links.length === 0) {
    list.innerHTML = '<div class="muted">No links yet.</div>';
    return;
  }
  list.innerHTML = links.map((l,i) => \`
    <div class="link-item">
      <div>
        <div class="link-url">\${escapeHtml(l.url)}</div>
        <div class="status">Last: \${l.lastPing || "never"} — \${l.lastStatus === "ok" ? '<span class="ok">OK</span>' : l.lastStatus === "err" ? '<span class="err">FAIL</span>' : "—"}</div>
      </div>
      <button class="small danger" onclick="delLink(\${i})">✕</button>
    </div>
  \`).join("");
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function addLinks() {
  if (!PW) { alert("Login ဦးပါ"); return; }
  const text = document.getElementById("newLinks").value.trim();
  if (!text) return;
  const urls = text.split("\\n").map(s=>s.trim()).filter(Boolean);
  try {
    await api("/api/add", { urls });
    document.getElementById("newLinks").value = "";
    await loadLinks();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function delLink(idx) {
  if (!confirm("ဖျက်မှာ သေချာလား?")) return;
  try {
    await api("/api/delete", { index: idx });
    await loadLinks();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function pingNow() {
  if (!PW) { alert("Login ဦးပါ"); return; }
  if (!confirm("အခု ping လုပ်မှာလား?")) return;
  try {
    const r = await api("/api/ping", {});
    alert("Done: " + r.ok + " ok, " + r.fail + " failed");
    await loadLinks();
  } catch (e) {
    alert("Error: " + e.message);
  }
}
</script>
</body>
</html>`;
}

// ── KV Helpers ──
async function getLinks(env) {
  const raw = await env.LINKS_KV.get(KV_KEY);
  if (!raw) return { links: [], lastLog: "" };
  try { return JSON.parse(raw); }
  catch { return { links: [], lastLog: "" }; }
}

async function saveLinks(env, data) {
  await env.LINKS_KV.put(KV_KEY, JSON.stringify(data));
}

// ── Auth ──
function checkAuth(request, env) {
  const pw = request.headers.get("X-Admin-Password");
  return pw && pw === env.ADMIN_PASSWORD;
}

// ── Ping လုပ်တဲ့ logic ──
// Streamtape ရဲ့ video page ကို fetch လုပ်ပြီး၊ inside က video stream URL ကို
// extract လုပ်ပြီး၊ range request တစ်ခု ပို့ကြည့်တယ်။
// (View ရ/မရက Streamtape ဘက်ကသာ ဆုံးဖြတ်တယ်။ ဒါက best-effort ပဲ။)
async function pingOne(url) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://streamtape.com/",
  };

  try {
    // Step 1: video page ကို fetch
    const pageRes = await fetch(url, { headers, redirect: "follow" });
    if (!pageRes.ok) return { ok: false, msg: "page " + pageRes.status };
    const html = await pageRes.text();

    // Step 2: HTML ထဲက video stream URL ကို ရှာ
    // Streamtape က ikxxxxxx token ကို JS ထဲမှာ ထည့်ပေးတယ်
    // pattern: document.getElementById('xxx').innerHTML = "...token..."
    const m = html.match(/id="(?:botlink|norobotlink)"[^>]*>([^<]+)/i)
            || html.match(/getElementById\(['"](?:botlink|norobotlink)['"]\)[^=]*=\s*['"]([^'"]+)/i);

    let streamUrl = null;
    if (m) {
      let token = m[1].trim();
      // tail substring (Streamtape က token နောက်ဆုံး အပိုင်းကို JS နဲ့ ဖြတ်ပေါင်းတယ်)
      const tailMatch = html.match(/substring\((\d+)\)/);
      if (tailMatch) {
        const cut = parseInt(tailMatch[1], 10);
        token = token.substring(cut);
      }
      if (token.startsWith("//")) token = "https:" + token;
      else if (token.startsWith("/")) token = "https://streamtape.com" + token;
      if (token.includes("get_video")) {
        streamUrl = token + (token.includes("?") ? "&" : "?") + "stream=1";
      }
    }

    if (!streamUrl) {
      // fallback: page fetch လုပ်ပြီးပြီဆိုတော့ "page hit" တော့ ဖြစ်တယ်လို့ ယူဆ
      return { ok: true, msg: "page-only" };
    }

    // Step 3: stream URL ကို range request (first 256KB) ပို့
    const rangeRes = await fetch(streamUrl, {
      headers: {
        ...headers,
        "Range": "bytes=0-262143",
      },
      redirect: "follow",
    });

    if (rangeRes.status === 200 || rangeRes.status === 206) {
      // body ကို တကယ်ဖတ်ပြီးမှ Streamtape က view ရေတွက်တယ်
      const reader = rangeRes.body.getReader();
      let total = 0;
      while (total < 262144) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
      }
      try { await reader.cancel(); } catch {}
      return { ok: true, msg: "streamed " + total + "B" };
    }
    return { ok: false, msg: "stream " + rangeRes.status };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

async function pingAll(env) {
  const data = await getLinks(env);
  if (!data.links.length) {
    data.lastLog = new Date().toISOString() + " — No links.";
    await saveLinks(env, data);
    return { ok: 0, fail: 0 };
  }

  const logs = [new Date().toISOString() + " — Ping start (" + data.links.length + " links)"];
  let okCount = 0, failCount = 0;

  // တစ်ခုပြီး တစ်ခု (parallel ဖြစ်ရင် Streamtape က rate-limit လုပ်နိုင်တယ်)
  for (let i = 0; i < data.links.length; i++) {
    const link = data.links[i];
    const result = await pingOne(link.url);
    link.lastPing = new Date().toISOString().replace("T"," ").substring(0,19);
    link.lastStatus = result.ok ? "ok" : "err";
    link.lastMsg = result.msg;
    logs.push((result.ok ? "✓" : "✗") + " " + link.url.substring(0, 60) + " — " + result.msg);
    if (result.ok) okCount++; else failCount++;
    // small delay
    await new Promise(r => setTimeout(r, 1500));
  }

  logs.push("Done: " + okCount + " ok, " + failCount + " failed");
  data.lastLog = logs.join("\n");
  await saveLinks(env, data);
  return { ok: okCount, fail: failCount };
}

// =============================================================
// Main Handler
// =============================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Landing / UI
    if (path === "/" || path === "") {
      return new Response(renderPage(), {
        headers: { "Content-Type": "text/html;charset=utf-8" }
      });
    }

    // API endpoints — auth required
    if (path.startsWith("/api/")) {
      if (!checkAuth(request, env)) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (path === "/api/list") {
        const data = await getLinks(env);
        return Response.json(data);
      }

      if (path === "/api/add" && request.method === "POST") {
        const body = await request.json();
        const urls = (body.urls || []).filter(u => /^https?:\/\//i.test(u));
        const data = await getLinks(env);
        const existing = new Set(data.links.map(l => l.url));
        for (const u of urls) {
          if (!existing.has(u)) {
            data.links.push({ url: u, lastPing: null, lastStatus: null });
          }
        }
        await saveLinks(env, data);
        return Response.json({ added: urls.length });
      }

      if (path === "/api/delete" && request.method === "POST") {
        const body = await request.json();
        const data = await getLinks(env);
        if (typeof body.index === "number" && body.index >= 0 && body.index < data.links.length) {
          data.links.splice(body.index, 1);
          await saveLinks(env, data);
        }
        return Response.json({ ok: true });
      }

      if (path === "/api/ping" && request.method === "POST") {
        // ctx.waitUntil မသုံးဘဲ တိုက်ရိုက်စောင့်တယ် (response မှာ result ပြန်ပြဖို့)
        const result = await pingAll(env);
        return Response.json(result);
      }

      return new Response("Not Found", { status: 404 });
    }

    return new Response("Not Found", { status: 404 });
  },

  // Cron Trigger — 12 နာရီတစ်ခါ auto run
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pingAll(env));
  }
};
