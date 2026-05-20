const API_BASE = window.location.origin;

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

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
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
  articles: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/articles${q ? `?${q}` : ""}`);
  },
  article: (slug) => request(`/api/articles/${slug}`),
  createArticle: (body) => request("/api/articles", { method: "POST", body: JSON.stringify(body) }),
  updateArticle: (slug, body) =>
    request(`/api/articles/${slug}`, { method: "PATCH", body: JSON.stringify(body) }),
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
    javascript: /\b(const|let|var|function|return|if|else|for|while|import|from|export|class|new|this|async|await|useState|useEffect)\b/g,
    python: /\b(def|return|if|elif|else|for|while|import|from|class|print|in|and|or|not|True|False|None)\b/g,
  };
  let html = escapeHtml(code);
  const kw = keywords[language] || keywords.javascript;
  html = html.replace(kw, '<span style="color:#ff7b72">$&</span>');
  html = html.replace(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, '<span style="color:#a5d6ff">$&</span>');
  html = html.replace(/\b(\d+)\b/g, '<span style="color:#79c0ff">$1</span>');
  html = html.replace(/(\/\/.*$|#.*$)/gm, '<span style="color:#8b949e">$&</span>');
  return html;
}
