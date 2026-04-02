export type SettingsUiLocale = "en" | "zh";

const en = {
  langSwitcherAria: "Interface language",
  headerTagline: "Bridge Your ChatGPT Account to Your Apps",
  githubTitle: "BridgeGPT on GitHub",
  connOptionsTitle: "Connection options",
  keepAliveTitle: "Keep alive",
  keepAliveDesc:
    "When enabled, the setting is stored locally and every 30 seconds the extension checks the relay WebSocket. If disconnected, it tries to reconnect (alarms can wake the MV3 service worker; you do not need to keep the settings tab open).",
  howTitle: "How BridgeGPT Works",
  howIntro:
    "BridgeGPT acts as a middleware between your ChatGPT account and your client applications. Here's the flow:",
  flowClientTitle: "Your Client App",
  flowClientSub: "Using library",
  flowRelayTitle: "Relay server",
  flowRelaySub: "Middleware",
  flowExtTitle: "Chrome Extension",
  flowExtSub: "On your computer",
  stepsBlock:
    "Step 1: Pass BridgeGPT relay base URL to your library → Step 2: Request reaches our server → Step 3: Server sends command to Chrome extension → Step 4: Extension forwards to your ChatGPT account → Step 5: Response travels back through the same chain",
  footerNote:
    "If you work with sensitive content, consider self-hosting the relay so traffic stays on infrastructure you control.",
  fmtCalculating: "Calculating...",
  statusConn: "Connected",
  statusConnecting: "Connecting...",
  statusDisc: "Disconnected",
  descConn: "Your BridgeGPT connection is active and ready",
  descConnecting: "Establishing connection to relay server",
  descDisc: "Click connect to start using BridgeGPT",
  btnDisconnect: "Disconnect",
  btnConnect: "Connect",
  btnConnecting: "Connecting...",
  detStatus: "Status",
  detOnline: "Online",
  detServer: "Server",
  detNetSpeed: "Network Speed",
  relayTitle: "Relay server URL",
  relayIntro:
    "WebSocket and HTTP requests use this base URL. Change it if you self-host the relay.",
  relayLabel: "Relay base URL",
  relayErrUrl: "Enter a valid http(s) URL (e.g. https://relay.example.com/).",
  relaySaved: "Saved",
  relaySave: "Save",
  relayBuiltIn: "Built-in / production default:",
  relayResetTitle: "Use official relay ($1)",
  akTitle: "API key",
  akIntro:
    "This secret identifies your browser session to the relay. Use it as Authorization: Bearer …, ?key= (Gemini-style), or x-goog-api-key. Stored only in this browser.",
  akLabel: "api_key",
  akHint:
    "Looks like an OpenAI key (sk-bridgegpt-…). Regenerate if it may have leaked.",
  akLoading: "Loading…",
  akRegenTitle: "Generate a new random api_key",
  akRegenerate: "Regenerate",
  akCopy: "Copy",
  akCopied: "Copied",
  akOpenWebChat:
    "Open web chat (first visit saves a cookie; the key is removed from the URL)",
  akTestUrlEmpty: "(shown when api_key is ready)",
  akConfirmRegenerate:
    "Generate a new api_key?\n\nUpdate every client (OpenAI SDK, Gemini / Grok HTTP, curl, web chat cookie). Open web chat again from here or use ?api_key= once. The old key will stop working for this extension.",
  akRegenFail: "Could not regenerate api_key.",
  verTitle: "Extension version",
  verHighlight:
    "Toolbar ! badge and the amber dot next to Open settings in the popup both mean: your relay reports a newer extension than this install. This block is where that is explained.",
  verCheck: "Check",
  verChecking: "Checking…",
  verUnchanged: "Version unchanged — relay does not recommend a newer build.",
  verUpdateBefore:
    "Update available. Relay recommends v$1. Install the latest Chrome extension from ",
  verUpdateAfter: ".",
  verGhReleases: "GitHub Releases",
  verExtMsgFail: "Extension message failed",
  verNoResponse: "No response from extension",
  popupTagline: "Bridge Your ChatGPT Account to Your Apps",
  popupOpenSettings: "Open settings",
  popupUpdateHint:
    "Dot = Extension version in Settings — we scroll there when you open.",
  api_heading: "Client API",
  api_tablist_aria: "API flavor",
  api_tab_openai: "OpenAI-compatible",
  api_tab_gemini: "Gemini API",
  api_tab_grok: "Grok (OpenAI route)",
  api_openai_intro:
    "Set base_url to the relay's /v1. Use the same api_key from the section above.",
  api_baseUrl_label: "base_url (OpenAI client)",
  api_steps: "Steps",
  api_openai_s1: "Click Connect and stay signed in on chatgpt.com",
  api_openai_s2:
    "Python / curl below embed your api_key—copy and run (no placeholders)",
  api_python: "Python",
  api_curl: "curl",
  api_curl_bearer_note:
    "Authorization: Bearer with the same api_key as above.",
  api_openai_sdk: "OpenAI Python SDK",
  api_docs: "Docs",
  api_loading_key: "Loading api_key…",
  api_copy_aria: "Copy code as shown",
  api_gemini_intro:
    "Same relay host as your OpenAI base_url, but use Google-style paths under /v1beta/models/…. The extension drives gemini.google.com when you call these endpoints.",
  api_gemini_li_auth:
    "Auth: Authorization: Bearer <api_key>, or ?key=, or x-goog-api-key",
  api_gemini_li_gen:
    "Non-stream: POST …/v1beta/models/<model>:generateContent",
  api_gemini_li_stream:
    "Stream (SSE): POST …/v1beta/models/<model>:streamGenerateContent",
  api_gemini_li_list: "List models: GET …/v1beta/models",
  api_gemini_s1: "Click Connect and stay signed in on gemini.google.com",
  api_gemini_s2: "Call the endpoints below with your api_key (examples use Bearer)",
  api_example_urls: "Example URLs ($1)",
  api_gemini_curl_gen: "curl (generateContent)",
  api_gemini_stream_h: "streamGenerateContent (SSE)",
  api_gemini_py_rq: "Python (requests)",
  api_gemini_footer:
    "Alternative: POST /v1/chat/completions with header X-Bridge-Provider: gemini still routes to the Gemini tab.",
  api_grok_intro:
    "Same base_url and POST …/v1/chat/completions as the OpenAI-compatible tab, but add the header X-Bridge-Provider: grok so the extension uses grok.com instead of ChatGPT.",
  api_grok_li1:
    "Model names like grok-4.2 are labels; the live Grok session picks the real model.",
  api_grok_li2:
    'Streaming ("stream": true) works the same as ChatGPT.',
  api_grok_s1: "Click Connect and stay signed in on grok.com",
  api_grok_s2:
    "Python / curl below embed your api_key—copy and run (no placeholders)",
  api_grok_python: "Python (OpenAI SDK)",
  api_grok_curl_note:
    "Requires X-Bridge-Provider: grok in addition to Authorization: Bearer.",
} as const;

const zh: Record<keyof typeof en, string> = {
  langSwitcherAria: "界面语言",
  headerTagline: "将你的 ChatGPT 账号桥接到你的应用",
  githubTitle: "BridgeGPT 在 GitHub 上",
  connOptionsTitle: "连接选项",
  keepAliveTitle: "保持连接",
  keepAliveDesc:
    "开启后，设置会保存在本地；每 30 秒扩展会检查中继 WebSocket，若断开则尝试重连（定时器可唤醒 MV3 后台，无需一直打开设置页）。",
  howTitle: "BridgeGPT 如何工作",
  howIntro:
    "BridgeGPT 在你的 ChatGPT 账号与客户端应用之间充当中间层。流程如下：",
  flowClientTitle: "你的客户端",
  flowClientSub: "使用库调用",
  flowRelayTitle: "中继服务器",
  flowRelaySub: "中间层",
  flowExtTitle: "Chrome 扩展",
  flowExtSub: "在你的电脑上",
  stepsBlock:
    "步骤 1：把 BridgeGPT 中继 base URL 传给库 → 步骤 2：请求到达我们的服务器 → 步骤 3：服务器向 Chrome 扩展发指令 → 步骤 4：扩展转发到你的 ChatGPT 账号 → 步骤 5：响应沿原路返回",
  footerNote:
    "若内容敏感，建议自托管中继，让流量走你可控的基础设施。",
  fmtCalculating: "计算中…",
  statusConn: "已连接",
  statusConnecting: "连接中…",
  statusDisc: "未连接",
  descConn: "BridgeGPT 已连接并就绪",
  descConnecting: "正在连接到中继服务器",
  descDisc: "点击连接以开始使用 BridgeGPT",
  btnDisconnect: "断开",
  btnConnect: "连接",
  btnConnecting: "连接中…",
  detStatus: "状态",
  detOnline: "在线",
  detServer: "服务器",
  detNetSpeed: "网络速度",
  relayTitle: "中继服务器 URL",
  relayIntro: "WebSocket 与 HTTP 请求都使用该基址。若自托管中继，请在此修改。",
  relayLabel: "中继 base URL",
  relayErrUrl: "请输入有效的 http(s) URL（例如 https://relay.example.com/）。",
  relaySaved: "已保存",
  relaySave: "保存",
  relayBuiltIn: "内置 / 生产默认：",
  relayResetTitle: "使用官方中继（$1）",
  akTitle: "API key",
  akIntro:
    "该密钥用于向中继标识你的浏览器会话。可用作 Authorization: Bearer …、?key=（Gemini 风格）或 x-goog-api-key。仅保存在本浏览器。",
  akLabel: "api_key",
  akHint: "形如 OpenAI 密钥（sk-bridgegpt-…）。若可能泄露请重新生成。",
  akLoading: "加载中…",
  akRegenTitle: "生成新的随机 api_key",
  akRegenerate: "重新生成",
  akCopy: "复制",
  akCopied: "已复制",
  akOpenWebChat:
    "打开网页聊天（首次访问会写入 cookie；URL 中的 key 会被去掉）",
  akTestUrlEmpty: "（api_key 就绪后显示）",
  akConfirmRegenerate:
    "生成新的 api_key？\n\n请在所有客户端（OpenAI SDK、Gemini/Grok HTTP、curl、网页聊天 cookie）中更新。请从此处再次打开网页聊天，或临时使用 ?api_key=。旧密钥对本扩展将失效。",
  akRegenFail: "无法重新生成 api_key。",
  verTitle: "扩展版本",
  verHighlight:
    "工具栏上的 ! 角标，以及弹出窗口里「打开设置」旁的黄点，都表示：中继报告有比当前安装更新的扩展版本。本区块用于说明该提示。",
  verCheck: "检查",
  verChecking: "检查中…",
  verUnchanged: "版本无变化 — 中继未推荐更新的构建。",
  verUpdateBefore: "有可用更新。中继推荐 v$1。请从 ",
  verUpdateAfter: "安装最新的 Chrome 扩展。",
  verGhReleases: "GitHub Releases",
  verExtMsgFail: "扩展消息失败",
  verNoResponse: "扩展无响应",
  popupTagline: "将你的 ChatGPT 账号桥接到你的应用",
  popupOpenSettings: "打开设置",
  popupUpdateHint:
    "黄点表示「设置」中的扩展版本 — 打开设置时会自动滚动到该区块。",
  api_heading: "客户端 API",
  api_tablist_aria: "API 类型",
  api_tab_openai: "OpenAI 兼容",
  api_tab_gemini: "Gemini API",
  api_tab_grok: "Grok（OpenAI 路由）",
  api_openai_intro:
    "将 base_url 设为中继的 /v1，并使用上方「API key」段落中的同一 api_key。",
  api_baseUrl_label: "base_url（OpenAI 客户端）",
  api_steps: "步骤",
  api_openai_s1: "点击连接并在 chatgpt.com 保持登录",
  api_openai_s2: "下方 Python / curl 已嵌入你的 api_key，可直接复制运行（无占位符）",
  api_python: "Python",
  api_curl: "curl",
  api_curl_bearer_note: "使用与上文相同的 api_key，通过 Authorization: Bearer 传递。",
  api_openai_sdk: "OpenAI Python SDK",
  api_docs: "文档",
  api_loading_key: "正在加载 api_key…",
  api_copy_aria: "按所示复制代码",
  api_gemini_intro:
    "与 OpenAI base_url 使用同一中继主机，但路径采用 Google 风格 /v1beta/models/…。调用这些接口时，扩展会操作 gemini.google.com。",
  api_gemini_li_auth:
    "鉴权：Authorization: Bearer <api_key>，或 ?key=，或 x-goog-api-key",
  api_gemini_li_gen: "非流式：POST …/v1beta/models/<model>:generateContent",
  api_gemini_li_stream: "流式（SSE）：POST …/v1beta/models/<model>:streamGenerateContent",
  api_gemini_li_list: "列出模型：GET …/v1beta/models",
  api_gemini_s1: "点击连接并在 gemini.google.com 保持登录",
  api_gemini_s2: "使用你的 api_key 调用下方接口（示例使用 Bearer）",
  api_example_urls: "示例 URL（$1）",
  api_gemini_curl_gen: "curl（generateContent）",
  api_gemini_stream_h: "streamGenerateContent（SSE）",
  api_gemini_py_rq: "Python（requests）",
  api_gemini_footer:
    "备选：POST /v1/chat/completions 并加请求头 X-Bridge-Provider: gemini，仍会路由到 Gemini 标签页。",
  api_grok_intro:
    "与 OpenAI 兼容页相同的 base_url 与 POST …/v1/chat/completions，但需加请求头 X-Bridge-Provider: grok，扩展会使用 grok.com 而非 ChatGPT。",
  api_grok_li1:
    "诸如 grok-4.2 的模型名是标签；实际模型由当前 Grok 会话决定。",
  api_grok_li2: "流式（\"stream\": true）与 ChatGPT 相同。",
  api_grok_s1: "点击连接并在 grok.com 保持登录",
  api_grok_s2: "下方 Python / curl 已嵌入你的 api_key，可直接复制运行（无占位符）",
  api_grok_python: "Python（OpenAI SDK）",
  api_grok_curl_note: "除 Authorization: Bearer 外还需要 X-Bridge-Provider: grok。",
};

export type SettingsUiKey = keyof typeof en;

export const SETTINGS_UI_STRINGS: Record<
  SettingsUiLocale,
  Record<SettingsUiKey, string>
> = { en: en as Record<SettingsUiKey, string>, zh };
