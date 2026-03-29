/**
 * Browser-only relay chat UI (GET /). api_key comes from URL once, then cookie; never embedded by the server.
 */

export const RELAY_API_KEY_COOKIE = "bridgegpt_api_key";

export type RelayChatBoot = {
  initialUserMessage: string;
  model: string;
};

export function relayChatShellHtml(boot: RelayChatBoot): string {
  const bootJson = JSON.stringify(boot);
  const sseBlockSep = JSON.stringify("\n\n");
  const sseLineSep = JSON.stringify("\n");
  const cookieName = JSON.stringify(RELAY_API_KEY_COOKIE);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>BridgeGPT</title>
  <style>
    :root {
      --bg: #343541;
      --surface: #444654;
      --user: #343541;
      --assistant: #444654;
      --text: #ececf1;
      --muted: #8e8ea0;
      --accent: #10a37f;
      --error: #f56565;
      --warn-bg: rgba(234, 179, 8, 0.12);
      --warn-border: rgba(234, 179, 8, 0.35);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, sans-serif;
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,.08);
      font-size: 0.875rem;
      color: var(--muted);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    header .title { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
    header strong { color: var(--text); }
    #setup-banner {
      margin: 0 1rem;
      padding: 0.85rem 1rem;
      background: var(--warn-bg);
      border: 1px solid var(--warn-border);
      border-radius: 0.5rem;
      font-size: 0.875rem;
      line-height: 1.5;
      color: var(--text);
    }
    #setup-banner code { background: rgba(0,0,0,.25); padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.85em; }
    #setup-banner[hidden] { display: none !important; }
    #thread {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      max-width: 48rem;
      width: 100%;
      margin: 0 auto;
    }
    .msg {
      display: flex;
      gap: 0.75rem;
      padding: 1rem 0;
      border-bottom: 1px solid rgba(255,255,255,.06);
      align-items: flex-start;
    }
    .msg.user { flex-direction: row-reverse; }
    .msg-inner {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      max-width: 100%;
    }
    .msg.user .msg-inner { align-items: flex-end; }
    .msg.assistant .msg-inner { align-items: flex-start; }
    .bubble {
      max-width: 85%;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .msg.user .bubble { background: var(--user); border: 1px solid rgba(255,255,255,.1); }
    .msg.assistant .bubble { background: var(--assistant); }
    .bubble.bubble-md {
      white-space: normal;
    }
    .bubble-md > :first-child { margin-top: 0; }
    .bubble-md > :last-child { margin-bottom: 0; }
    .bubble-md p { margin: 0.55em 0; line-height: 1.55; }
    .bubble-md ul, .bubble-md ol { margin: 0.5em 0; padding-left: 1.35rem; }
    .bubble-md li { margin: 0.2em 0; }
    .bubble-md h1, .bubble-md h2, .bubble-md h3, .bubble-md h4 {
      margin: 0.75em 0 0.4em;
      font-size: 1.05em;
      font-weight: 600;
      line-height: 1.35;
    }
    .bubble-md h1:first-child, .bubble-md h2:first-child, .bubble-md h3:first-child { margin-top: 0; }
    .bubble-md a { color: #7dd3fc; text-decoration: underline; }
    .bubble-md a:hover { color: #bae6fd; }
    .bubble-md code {
      font-family: ui-monospace, monospace;
      font-size: 0.9em;
      background: rgba(0,0,0,.35);
      padding: 0.12em 0.35em;
      border-radius: 4px;
    }
    .bubble-md pre {
      margin: 0.65em 0;
      padding: 0.75rem 1rem;
      background: rgba(0,0,0,.4);
      border-radius: 0.5rem;
      overflow-x: auto;
      line-height: 1.45;
    }
    .bubble-md pre code {
      background: none;
      padding: 0;
      font-size: 0.82rem;
    }
    .bubble-md blockquote {
      margin: 0.5em 0;
      padding-left: 0.85rem;
      border-left: 3px solid rgba(255,255,255,.2);
      color: var(--muted);
    }
    .bubble-md table { border-collapse: collapse; margin: 0.5em 0; font-size: 0.9em; }
    .bubble-md th, .bubble-md td {
      border: 1px solid rgba(255,255,255,.12);
      padding: 0.35em 0.6em;
    }
    .bubble-md th { background: rgba(0,0,0,.25); }
    .bubble-md hr { border: none; border-top: 1px solid rgba(255,255,255,.12); margin: 0.85em 0; }
    .role {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--muted);
      margin-bottom: 0.25rem;
    }
    .composer {
      padding: 1rem;
      border-top: 1px solid rgba(255,255,255,.08);
      max-width: 48rem;
      width: 100%;
      margin: 0 auto;
    }
    .composer-inner {
      display: flex;
      gap: 0.5rem;
      align-items: flex-end;
      background: var(--surface);
      border-radius: 0.75rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid rgba(255,255,255,.1);
    }
    .composer-inner.disabled { opacity: 0.55; }
    textarea {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text);
      font: inherit;
      resize: none;
      min-height: 2.5rem;
      max-height: 8rem;
      padding: 0.35rem 0;
    }
    textarea:focus { outline: none; }
    textarea:disabled { cursor: not-allowed; }
    button#send {
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 0.5rem;
      padding: 0.5rem 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    button#send:disabled { opacity: .45; cursor: not-allowed; }
    .err { color: var(--error); font-size: 0.875rem; padding: 0 1rem 1rem; max-width: 48rem; margin: 0 auto; width: 100%; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.1.7/dist/purify.min.js" crossorigin="anonymous"></script>
</head>
<body>
  <header>
    <div class="title">
      <span>BridgeGPT <strong>web chat</strong> (relay → ChatGPT tab)</span>
      <span id="header-hint"></span>
    </div>
    <div id="setup-banner" hidden>
      <p>
        To chat here, open this page from the <strong>BridgeGPT</strong> Chrome extension:
        go to <strong>Settings</strong> and use <strong>Open web chat</strong> (your <code>api_key</code> is stored in a browser cookie for this relay origin).
      </p>
      <p style="margin:0.5rem 0 0;">
        Or visit once with <code>?api_key=&lt;your room id&gt;</code> (or <code>?apikey=</code>) in the URL; it will be saved and removed from the address bar.
      </p>
    </div>
  </header>
  <div id="thread"></div>
  <p id="err" class="err" hidden></p>
  <div class="composer">
    <div class="composer-inner" id="composer-box">
      <textarea id="input" rows="1" placeholder="Message…" autocomplete="off"></textarea>
      <button type="button" id="send">Send</button>
    </div>
  </div>
  <script>
  (function () {
    var COOKIE = ${cookieName};
    var BOOT = ${bootJson};
    var sseBlockSep = ${sseBlockSep};
    var sseLineSep = ${sseLineSep};
    var MAX_AGE = 7776000;

    function getCookie(name) {
      var parts = ("; " + document.cookie).split("; " + name + "=");
      if (parts.length < 2) return "";
      return decodeURIComponent(parts.pop().split(";").shift() || "");
    }

    function setCookie(name, val) {
      var secure = location.protocol === "https:" ? "; Secure" : "";
      document.cookie = name + "=" + encodeURIComponent(val) + "; Path=/; Max-Age=" + MAX_AGE + "; SameSite=Lax" + secure;
    }

    var params = new URLSearchParams(location.search);
    var fromUrl = (params.get("api_key") || params.get("apikey") || "").trim();
    if (fromUrl) {
      setCookie(COOKIE, fromUrl);
      params.delete("api_key");
      params.delete("apikey");
      var qs = params.toString();
      history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
    }

    var apiKey = (fromUrl || getCookie(COOKIE) || "").trim();

    var thread = document.getElementById("thread");
    var input = document.getElementById("input");
    var sendBtn = document.getElementById("send");
    var errEl = document.getElementById("err");
    var banner = document.getElementById("setup-banner");
    var headerHint = document.getElementById("header-hint");
    var composerBox = document.getElementById("composer-box");

    function showErr(t) {
      errEl.textContent = t || "";
      errEl.hidden = !t;
    }

    if (!apiKey) {
      banner.hidden = false;
      input.disabled = true;
      sendBtn.disabled = true;
      composerBox.classList.add("disabled");
      input.placeholder = "Open from BridgeGPT extension Settings…";
      headerHint.textContent = "";
      return;
    }

    banner.hidden = true;
    headerHint.textContent = fromUrl
      ? "api_key saved to cookie; URL was cleaned."
      : "Using saved api_key cookie for this origin.";

    if (BOOT.initialUserMessage) {
      input.value = BOOT.initialUserMessage;
    }
    var paramsAfterKey = new URLSearchParams(location.search);
    if (paramsAfterKey.has("message")) {
      paramsAfterKey.delete("message");
      var qsMsg = paramsAfterKey.toString();
      history.replaceState(
        null,
        "",
        location.pathname + (qsMsg ? "?" + qsMsg : "") + location.hash
      );
    }

    if (typeof marked !== "undefined" && marked.setOptions) {
      marked.setOptions({ breaks: true, gfm: true });
    }

    function renderAssistantMarkdown(el, md) {
      if (!el) return;
      var raw = (md || "").trim();
      if (!raw) {
        el.textContent = "";
        el.classList.remove("bubble-md");
        return;
      }
      if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
        try {
          el.innerHTML = DOMPurify.sanitize(marked.parse(raw));
          el.classList.add("bubble-md");
          return;
        } catch (eMd) {}
      }
      el.textContent = raw;
      el.classList.remove("bubble-md");
    }

    function appendMessage(role, text) {
      var wrap = document.createElement("div");
      wrap.className = "msg " + role;
      var inner = document.createElement("div");
      inner.className = "msg-inner";
      var lab = document.createElement("div");
      lab.className = "role";
      lab.textContent = role === "user" ? "You" : "Assistant";
      var bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = text;
      inner.appendChild(lab);
      inner.appendChild(bubble);
      wrap.appendChild(inner);
      thread.appendChild(wrap);
      thread.scrollTop = thread.scrollHeight;
      return bubble;
    }

    function setLoading(on) {
      sendBtn.disabled = on;
      input.disabled = on;
    }

    async function streamCompletion(userText) {
      var ut = (userText || "").trim();
      if (!ut) return;
      showErr("");
      setLoading(true);
      var bubble = appendMessage("assistant", "");
      var assistantEl = bubble;
      var full = "";

      try {
        var res = await fetch("/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey,
          },
          body: JSON.stringify({
            model: BOOT.model,
            messages: [{ role: "user", content: ut }],
            stream: true,
          }),
        });

        if (!res.ok) {
          var errText = await res.text();
          try {
            var j = JSON.parse(errText);
            errText = (j.error && j.error.message) || errText;
          } catch (e1) {}
          assistantEl.textContent = "";
          showErr("Request failed (" + res.status + "): " + errText);
          thread.removeChild(assistantEl.closest(".msg"));
          setLoading(false);
          return;
        }

        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var buf = "";

        function parseSseBlocks(text) {
          var lines = text.split(sseLineSep);
          for (var li = 0; li < lines.length; li++) {
            var line = lines[li].replace(/\\r$/, "");
            if (line.indexOf("data:") !== 0) continue;
            var data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              var obj = JSON.parse(data);
              var ch = obj.choices && obj.choices[0];
              if (ch && ch.delta && typeof ch.delta.content === "string") {
                full += ch.delta.content;
                assistantEl.textContent = full;
                thread.scrollTop = thread.scrollHeight;
              }
            } catch (e2) {}
          }
        }

        while (true) {
          var part = await reader.read();
          if (part.done) break;
          buf += dec.decode(part.value, { stream: true });
          for (;;) {
            var ix = buf.indexOf(sseBlockSep);
            if (ix === -1) break;
            var block = buf.slice(0, ix).trim();
            buf = buf.slice(ix + 2);
            if (block) parseSseBlocks(block);
          }
        }
        if (buf.trim()) parseSseBlocks(buf.trim());
        renderAssistantMarkdown(assistantEl, full);
      } catch (e) {
        showErr(String((e && e.message) || e));
        var row = assistantEl && assistantEl.closest(".msg");
        var stillEmpty = !String(full || "").trim();
        if (row && stillEmpty) thread.removeChild(row);
      }
      setLoading(false);
    }

    async function sendUser(text) {
      var t = (text || "").trim();
      if (!t) return;
      appendMessage("user", t);
      input.value = "";
      await streamCompletion(t);
    }

    sendBtn.addEventListener("click", function () { sendUser(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendUser(input.value);
      }
    });
  })();
  </script>
</body>
</html>`;
}
