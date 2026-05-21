import http from "http";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { scryptSync, timingSafeEqual, randomBytes } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const DATA = path.join(__dirname, "data");
const SEED = path.join(DATA, "seed");
const BACKUPS = path.join(DATA, "backups");
const RUNTIME_DATA = ["sections.json", "articles.json"];
const PORT = process.env.PORT || 3847;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const sessions = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function ensureDataFiles() {
  await fs.mkdir(SEED, { recursive: true });
  await fs.mkdir(BACKUPS, { recursive: true });

  for (const name of RUNTIME_DATA) {
    const dest = path.join(DATA, name);
    const seedFile = path.join(SEED, name);
    try {
      await fs.access(dest);
    } catch {
      try {
        await fs.copyFile(seedFile, dest);
        console.log(`[data] Создан ${name} из шаблона seed/`);
      } catch {
        await fs.writeFile(dest, "[]\n", "utf-8");
        console.log(`[data] Создан пустой ${name}`);
      }
    }
  }

  const dataPath = path.resolve(DATA);
  console.log(`[data] Рабочие данные: ${dataPath}`);
  if (/OneDrive|Desktop/i.test(dataPath)) {
    console.warn(
      "[data] Папка на Рабочем столе или OneDrive — облачная синхронизация может откатывать изменения. Лучше перенести проект в C:\\Projects\\"
    );
  }
}

async function readJson(name) {
  const raw = await fs.readFile(path.join(DATA, name), "utf-8");
  return JSON.parse(raw);
}

async function writeJson(name, data) {
  if (!RUNTIME_DATA.includes(name)) {
    await fs.writeFile(path.join(DATA, name), JSON.stringify(data, null, 2), "utf-8");
    return;
  }

  const filePath = path.join(DATA, name);
  const tmpPath = `${filePath}.tmp`;
  const content = JSON.stringify(data, null, 2);

  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUPS, `${name}.${stamp}.bak`);
  await fs.copyFile(filePath, backupPath).catch(() => {});

  const backups = (await fs.readdir(BACKUPS))
    .filter((f) => f.startsWith(name))
    .sort()
    .reverse();
  for (const old of backups.slice(8)) {
    await fs.unlink(path.join(BACKUPS, old)).catch(() => {});
  }
}

function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const hash = scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, "hex");
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

function getSession(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function isAdmin(req) {
  return Boolean(getSession(req));
}

function createSession(username) {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function serveStatic(urlPath, res) {
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC, safe === "/" ? "index.html" : safe);
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  let target = filePath;
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) target = path.join(target, "index.html");
  } catch {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  try {
    const body = await fs.readFile(target);
    const ext = path.extname(target);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (url.pathname === "/api/auth/login" && req.method === "POST") {
      const body = await parseBody(req);
      const login = (body?.login || "").trim();
      const password = body?.password || "";
      if (!login || !password) {
        json(res, 400, { error: "Введите логин и пароль" });
        return;
      }
      const admins = await readJson("admins.json");
      const admin = admins.find((a) => a.login === login);
      if (!admin || !verifyPassword(password, admin.passwordHash)) {
        json(res, 401, { error: "Неверный логин или пароль" });
        return;
      }
      const token = createSession(admin.login);
      json(res, 200, { token, login: admin.login });
      return;
    }

    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      const token = getBearerToken(req);
      if (token) sessions.delete(token);
      json(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/auth/me" && req.method === "GET") {
      const session = getSession(req);
      if (!session) {
        json(res, 401, { error: "Unauthorized" });
        return;
      }
      json(res, 200, { login: session.username });
      return;
    }

    if (url.pathname === "/api/sections" && req.method === "GET") {
      const sections = await readJson("sections.json");
      json(res, 200, sections);
      return;
    }

    if (url.pathname === "/api/sections" && req.method === "POST") {
      if (!isAdmin(req)) {
        json(res, 401, { error: "Требуется вход в админ-панель" });
        return;
      }
      const body = await parseBody(req);
      const sections = await readJson("sections.json");
      const slug =
        body.slug ||
        body.title
          .toLowerCase()
          .replace(/[^a-z0-9а-яё]+/gi, "-")
          .replace(/^-|-$/g, "");
      if (sections.some((s) => s.slug === slug)) {
        json(res, 409, { error: "Раздел уже существует" });
        return;
      }
      const section = {
        id: crypto.randomUUID(),
        slug,
        title: body.title,
        description: body.description || "",
        icon: body.icon || "📦",
        createdAt: new Date().toISOString(),
      };
      sections.push(section);
      await writeJson("sections.json", sections);
      json(res, 201, section);
      return;
    }

    const sectionMatch = url.pathname.match(/^\/api\/sections\/([^/]+)$/);
    if (sectionMatch && req.method === "PATCH") {
      if (!isAdmin(req)) {
        json(res, 401, { error: "Требуется вход в админ-панель" });
        return;
      }
      const body = await parseBody(req);
      const sections = await readJson("sections.json");
      const idx = sections.findIndex((s) => s.slug === sectionMatch[1] || s.id === sectionMatch[1]);
      if (idx === -1) {
        json(res, 404, { error: "Раздел не найден" });
        return;
      }
      const oldSlug = sections[idx].slug;
      const newSlug =
        body.slug ||
        (body.title
          ? body.title
              .toLowerCase()
              .replace(/[^a-z0-9а-яё]+/gi, "-")
              .replace(/^-|-$/g, "")
          : oldSlug);
      if (newSlug !== oldSlug && sections.some((s) => s.slug === newSlug)) {
        json(res, 409, { error: "Раздел с таким slug уже существует" });
        return;
      }
      sections[idx] = {
        ...sections[idx],
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.icon !== undefined && { icon: body.icon }),
        slug: newSlug,
      };
      await writeJson("sections.json", sections);
      if (newSlug !== oldSlug) {
        const articles = await readJson("articles.json");
        let changed = false;
        for (const a of articles) {
          if (a.sectionSlug === oldSlug) {
            a.sectionSlug = newSlug;
            a.updatedAt = new Date().toISOString();
            changed = true;
          }
        }
        if (changed) await writeJson("articles.json", articles);
      }
      json(res, 200, sections[idx]);
      return;
    }

    if (sectionMatch && req.method === "DELETE") {
      if (!isAdmin(req)) {
        json(res, 401, { error: "Требуется вход в админ-панель" });
        return;
      }
      const sections = await readJson("sections.json");
      const idx = sections.findIndex((s) => s.slug === sectionMatch[1] || s.id === sectionMatch[1]);
      if (idx === -1) {
        json(res, 404, { error: "Раздел не найден" });
        return;
      }
      const removedSlug = sections[idx].slug;
      sections.splice(idx, 1);
      await writeJson("sections.json", sections);
      const articles = await readJson("articles.json");
      const remaining = articles.filter((a) => a.sectionSlug !== removedSlug);
      if (remaining.length !== articles.length) {
        await writeJson("articles.json", remaining);
      }
      json(res, 200, { ok: true, deletedSlug: removedSlug });
      return;
    }

    if (url.pathname === "/api/articles" && req.method === "GET") {
      const status = url.searchParams.get("status");
      if (status === "pending" && !isAdmin(req)) {
        json(res, 401, { error: "Требуется вход в админ-панель" });
        return;
      }
      const articles = await readJson("articles.json");
      const section = url.searchParams.get("section");
      let list = articles;
      if (section) list = list.filter((a) => a.sectionSlug === section);
      if (status) list = list.filter((a) => a.status === status);
      json(res, 200, list);
      return;
    }

    if (url.pathname === "/api/articles" && req.method === "POST") {
      const body = await parseBody(req);
      const admin = isAdmin(req);
      const articles = await readJson("articles.json");
      const slug =
        body.slug ||
        body.title
          .toLowerCase()
          .replace(/[^a-z0-9а-яё]+/gi, "-")
          .replace(/^-|-$/g, "");
      const article = {
        id: crypto.randomUUID(),
        slug,
        sectionSlug: body.sectionSlug,
        title: body.title,
        summary: body.summary || "",
        language: body.language || "javascript",
        tags: body.tags || [],
        blocks: body.blocks || [],
        author: body.author || "Аноним",
        status: admin ? body.status || "published" : "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      articles.push(article);
      await writeJson("articles.json", articles);
      json(res, 201, article);
      return;
    }

    const articleMatch = url.pathname.match(/^\/api\/articles\/([^/]+)$/);
    if (articleMatch && req.method === "GET") {
      const articles = await readJson("articles.json");
      const article = articles.find((a) => a.slug === articleMatch[1] || a.id === articleMatch[1]);
      if (!article) {
        json(res, 404, { error: "Not found" });
        return;
      }
      if (article.status !== "published" && !isAdmin(req)) {
        json(res, 403, { error: "Статья недоступна" });
        return;
      }
      json(res, 200, article);
      return;
    }

    if (articleMatch && req.method === "PATCH") {
      if (!isAdmin(req)) {
        json(res, 401, { error: "Требуется вход в админ-панель" });
        return;
      }
      const body = await parseBody(req);
      const articles = await readJson("articles.json");
      const idx = articles.findIndex((a) => a.slug === articleMatch[1] || a.id === articleMatch[1]);
      if (idx === -1) {
        json(res, 404, { error: "Статья не найдена" });
        return;
      }
      const oldSlug = articles[idx].slug;
      if (body.slug && body.slug !== oldSlug && articles.some((a) => a.slug === body.slug)) {
        json(res, 409, { error: "Статья с таким slug уже существует" });
        return;
      }
      const { id, createdAt, ...updates } = body;
      articles[idx] = { ...articles[idx], ...updates, updatedAt: new Date().toISOString() };
      await writeJson("articles.json", articles);
      json(res, 200, articles[idx]);
      return;
    }

    if (articleMatch && req.method === "DELETE") {
      if (!isAdmin(req)) {
        json(res, 401, { error: "Требуется вход в админ-панель" });
        return;
      }
      const articles = await readJson("articles.json");
      const idx = articles.findIndex((a) => a.slug === articleMatch[1] || a.id === articleMatch[1]);
      if (idx === -1) {
        json(res, 404, { error: "Статья не найдена" });
        return;
      }
      const removed = articles.splice(idx, 1)[0];
      await writeJson("articles.json", articles);
      json(res, 200, { ok: true, deletedSlug: removed.slug });
      return;
    }

    if (url.pathname === "/api/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/favicon.ico") {
      const icon = await fs.readFile(path.join(PUBLIC, "favicon.svg"));
      res.writeHead(200, { "Content-Type": "image/svg+xml" });
      res.end(icon);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (err) {
    console.error(err);
    json(res, 500, { error: "Internal error" });
  }
});

await ensureDataFiles();

server.listen(PORT, () => {
  console.log(`VVFWiki → http://localhost:${PORT}`);
  console.log(`Администратор: http://localhost:${PORT}/admin.html`);
});
