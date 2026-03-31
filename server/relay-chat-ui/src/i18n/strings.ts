export type Locale = "en" | "zh";

export type Messages = {
  sidebarTag: string;
  newChat: string;
  connection: string;
  connectionFromUrl: string;
  connectionFromCookie: string;
  backend: string;
  backendOpenAI: string;
  backendGemini: string;
  backendGrok: string;
  history: string;
  deleteSession: string;
  deleteSessionAria: (title: string) => string;
  setupTitle: string;
  setupP1a: string;
  setupP1b: string;
  setupP1c: string;
  setupP1d: string;
  setupP2Before: string;
  setupP2After: string;
  switchToChinese: string;
  switchToEnglish: string;
  langToggleShowZh: string;
  langToggleShowEn: string;
  closeMenu: string;
  openMenu: string;
  expandSidebar: string;
  collapseSidebar: string;
  localNoticeStrong: string;
  localNoticeBody: string;
  closeNotice: string;
  emptyTitle: string;
  emptySub: string;
  /** Shown when there is no api_key (empty thread) */
  emptyNoKeyStatus: string;
  emptyNoKeyHow: string;
  you: string;
  ai: string;
  thinking: string;
  waitingResponse: string;
  replySource: string;
  platformOpenAI: string;
  platformGemini: string;
  platformGrok: string;
  composerSend: string;
  placeholderHasKey: string;
  placeholderNoKey: string;
};

const en: Messages = {
  sidebarTag: "Web relay",
  newChat: "+ New chat",
  connection: "Connection",
  connectionFromUrl: "api_key saved from URL to cookie.",
  connectionFromCookie: "Using saved api_key cookie.",
  backend: "Backend",
  backendOpenAI: "ChatGPT · OpenAI API",
  backendGemini: "Gemini · Google API",
  backendGrok: "Grok · OpenAI API",
  history: "History",
  deleteSession: "Delete",
  deleteSessionAria: (title) => `Delete ${title}`,
  setupTitle: "Set up",
  setupP1a: "Open this page from the ",
  setupP1b: " extension: Settings → ",
  setupP1c: "Open web chat",
  setupP1d: " (cookie stores api_key for this origin).",
  setupP2Before: "Or visit once with ",
  setupP2After:
    " — it will be saved and stripped from the URL.",
  switchToChinese: "Switch to Chinese",
  switchToEnglish: "Switch to English",
  langToggleShowZh: "中",
  langToggleShowEn: "EN",
  closeMenu: "Close menu",
  openMenu: "Open menu",
  expandSidebar: "Expand sidebar",
  collapseSidebar: "Collapse sidebar",
  localNoticeStrong: "Local only.",
  localNoticeBody:
    "Conversation history stays in this browser (Chrome local storage / Local Storage). This relay server does not persist your chats.",
  closeNotice: "Close notice",
  emptyTitle: "BridgeGPT",
  emptySub:
    "Messages relay to your signed-in ChatGPT, Gemini, or Grok tab.",
  emptyNoKeyStatus: "No api_key for this site — chat is unavailable.",
  emptyNoKeyHow:
    "Open the sidebar and follow the Set up card: BridgeGPT extension → Settings → Open web chat, or visit once with ?api_key=… in the URL.",
  you: "You",
  ai: "AI",
  thinking: "Thinking…",
  waitingResponse: "Waiting for response",
  replySource: "Reply source",
  platformOpenAI: "ChatGPT · OpenAI",
  platformGemini: "Gemini · Google",
  platformGrok: "Grok · xAI",
  composerSend: "Send",
  placeholderHasKey: "Message…",
  placeholderNoKey: "Open from BridgeGPT extension Settings…",
};

const zh: Messages = {
  sidebarTag: "网页中继",
  newChat: "+ 新对话",
  connection: "连接",
  connectionFromUrl: "已从 URL 将 api_key 写入 Cookie。",
  connectionFromCookie: "正在使用已保存的 api_key Cookie。",
  backend: "后端",
  backendOpenAI: "ChatGPT · OpenAI API",
  backendGemini: "Gemini · Google API",
  backendGrok: "Grok · OpenAI 兼容 API",
  history: "历史",
  deleteSession: "删除",
  deleteSessionAria: (title) => `删除 ${title}`,
  setupTitle: "设置",
  setupP1a: "请从 ",
  setupP1b: " 扩展打开本页：设置 → ",
  setupP1c: "打开网页对话",
  setupP1d: "（会将 api_key 保存为本站 Cookie）。",
  setupP2Before: "或首次使用带 ",
  setupP2After: " 的链接访问，保存后会从地址栏移除。",
  switchToChinese: "切换到中文",
  switchToEnglish: "切换到英文",
  langToggleShowZh: "中",
  langToggleShowEn: "EN",
  closeMenu: "关闭菜单",
  openMenu: "打开菜单",
  expandSidebar: "展开边栏",
  collapseSidebar: "收起边栏",
  localNoticeStrong: "仅本地存储。",
  localNoticeBody:
    "对话记录只保存在本浏览器（Chrome 本地存储 / Local Storage），中继服务器不会持久化你的聊天内容。",
  closeNotice: "关闭提示",
  emptyTitle: "BridgeGPT",
  emptySub: "消息将转发到你已登录的 ChatGPT、Gemini 或 Grok 网页标签页。",
  emptyNoKeyStatus: "没有 api_key，对话功能不可用。",
  emptyNoKeyHow:
    "请打开侧栏，按「设置」里的说明操作：从 BridgeGPT 扩展「设置」→「打开网页对话」打开本页，或使用带 ?api_key= 的链接访问一次。",
  you: "你",
  ai: "AI",
  thinking: "思考中…",
  waitingResponse: "等待回复",
  replySource: "回复来源",
  platformOpenAI: "ChatGPT · OpenAI",
  platformGemini: "Gemini · Google",
  platformGrok: "Grok · xAI",
  composerSend: "发送",
  placeholderHasKey: "输入消息…",
  placeholderNoKey: "请从 BridgeGPT 扩展「设置」打开本页…",
};

export const messages: Record<Locale, Messages> = { en, zh };
