const DEFAULT_API = "http://localhost:3847";

/** Адрес API: тот же хост при node server.mjs, иначе localhost:3847 (Live Server, file://). */
export function getApiBase() {
  const meta = document.querySelector('meta[name="api-base"]')?.content?.trim();
  if (meta) return meta.replace(/\/$/, "");
  if (location.protocol === "file:") return DEFAULT_API;
  if (location.port === "3847") return location.origin;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return DEFAULT_API;
  }
  return location.origin;
}

export function formatLoadError(err) {
  if (location.hostname.endsWith("github.io")) {
    return 'С GitHub Pages API не работает. Локально: <code>node server.mjs</code> → <a href="http://localhost:3847">http://localhost:3847</a>';
  }
  if (location.protocol === "file:") {
    return 'Не открывайте HTML-файл напрямую. Запустите <code>node server.mjs</code> и откройте <a href="http://localhost:3847">http://localhost:3847</a>';
  }
  const msg = err?.message || String(err);
  if (msg === "Failed to fetch" || err?.name === "TypeError") {
    const base = getApiBase();
    return `Сервер не отвечает. В папке проекта: <code>node server.mjs</code>, затем <a href="${base}">${base}</a>`;
  }
  if (/not found|не найден/i.test(msg)) {
    return `${escapeHtml(msg)}. <a href="/">На главную</a>`;
  }
  return escapeHtml(msg);
}

export function getAdminToken() {
  return localStorage.getItem("devwiki_session") || "";
}

export function setAdminToken(token) {
  if (token) localStorage.setItem("devwiki_session", token);
  else localStorage.removeItem("devwiki_session");
}

export function clearAdminSession() {
  setAdminToken("");
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  login: (login, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ login, password }),
    }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
  sections: () => request("/api/sections"),
  createSection: (body) => request("/api/sections", { method: "POST", body: JSON.stringify(body) }),
  updateSection: (slug, body) =>
    request(`/api/sections/${slug}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSection: (slug) => request(`/api/sections/${slug}`, { method: "DELETE" }),
  articles: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/articles${q ? `?${q}` : ""}`);
  },
  article: (slug) => request(`/api/articles/${slug}`),
  createArticle: (body) => request("/api/articles", { method: "POST", body: JSON.stringify(body) }),
  updateArticle: (slug, body) =>
    request(`/api/articles/${slug}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteArticle: (slug) => request(`/api/articles/${slug}`, { method: "DELETE" }),
};

export function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function highlightCode(code, language) {
  const keywords = {
    javascript:
      /\b(const|let|var|function|return|if|else|for|while|import|from|export|class|new|this|async|await|useState|useEffect)\b/g,
    python:
      /\b(def|return|if|elif|else|for|while|import|from|class|print|in|and|or|not|True|False|None)\b/g,
  };

  const MARKERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const slots = [];
  const slot = (cls, text) => {
    const id = slots.length;
    if (id >= MARKERS.length) return text;
    slots.push(`<span class="${cls}">${text}</span>`);
    return `<<${MARKERS[id]}>>`;
  };

  let html = escapeHtml(code);

  html = html.replace(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, (m) => slot("tok-str", m));

  if (language === "python") {
    html = html.replace(/(#.*)$/gm, (m) => slot("tok-com", m));
  } else {
    html = html.replace(/(\/\/.*)$/gm, (m) => slot("tok-com", m));
  }

  const kw = keywords[language] || keywords.javascript;
  html = html.replace(kw, (m) => slot("tok-kw", m));
  html = html.replace(/\b(\d+)\b/g, (m) => slot("tok-num", m));

  html = html.replace(/<<([a-zA-Z])>>/g, (_, ch) => slots[MARKERS.indexOf(ch)] ?? ch);
  return html;
}
