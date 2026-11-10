// 资源百宝库 Telegram Bot —— 纯 Node.js，无第三方依赖
// 运行方式：
// Webhook（Cloady 上用这个）：BOT_TOKEN=... ADMIN_ID=... WEBHOOK_URL=https://<你的Cloady域名> node index.js
// 长轮询（本地测试）：BOT_TOKEN=... ADMIN_ID=... POLLING=true node index.js
// 资源只存在本地 data/library.json，由管理员自己添加，机器人不从任何平台抓取、不存成人内容。

const http = require('http');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_ID = String(process.env.ADMIN_ID || '');
const PORT = parseInt(process.env.PORT || '3000', 10);
const WEBHOOK_URL = (process.env.WEBHOOK_URL || '').replace(/\/$/, '');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const POLLING = process.env.POLLING === 'true';
const NEWS_RSS = process.env.NEWS_RSS || 'https://www.animenewsnetwork.com/news/rss.xml';
const NEWS_RSS_FALLBACK = 'https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans';

const DATA_FILE = path.join(__dirname, 'data', 'library.json');
const CATEGORIES = { galgame: 'Galgame', anime: '二次元', news: '新闻资讯'};
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

function loadLibrary() {
try {
const raw = fs.readFileSync(DATA_FILE, 'utf8');
const data = JSON.parse(raw);
if (Array.isArray(data)) return data;
} catch (e) { /* 文件不存在或损坏时从空库开始 */}
return [];
}

function saveLibrary(list) {
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true});
fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

let library = loadLibrary();
let nextId = library.reduce((m, e) => Math.max(m, e.id || 0), 0) + 1;

async function tg(method, payload) {
if (!BOT_TOKEN) { console.error('[tg] BOT_TOKEN 未设置'); return null;}
try {
const res = await fetch(`${API}/${method}`, {
method: 'POST',
headers: { 'Content-Type': 'application/json'},
body: JSON.stringify(payload),
signal: AbortSignal.timeout(15000),
});
const data = await res.json().catch(() => ({}));
if (!data.ok) console.error(`[tg] ${method} 失败:`, data.description || res.status);
return data;
} catch (e) {
console.error(`[tg] ${method} 网络错误:`, e.message);
return null;
}
}

function sendMessage(chatId, text) {
return tg('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true});
}

function escapeMd(s) { return String(s || '');}

function fmtEntry(e) {
return `#${e.id}${e.title}\n${e.link}`;
}

function isAdmin(userId) {
return ADMIN_ID!== '' && String(userId) === ADMIN_ID;
}

async function fetchNews() {
const sources = [NEWS_RSS, NEWS_RSS_FALLBACK];
let lastError = '';
for (const src of sources) {
try {
const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0'}, signal: AbortSignal.timeout(10000)});
if (!res.ok) { lastError = `RSS 源返回 HTTP ${res.status}`; continue; }
const xml = await res.text();
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
if (items.length === 0) { lastError = 'RSS 源没有可读的新闻条目'; continue; }
const out = items.map((m) => {
const title = (m[1].match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '（无标题）';
const link = (m[1].match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
return `• ${title.trim()}\n${link.trim()}`;
});
return { items: out};
} catch (e) {
lastError = `拉取新闻失败：${e.message}`;
}
}
return { error: lastError || '新闻拉取失败'};
}

async function handleMessage(msg) {
const chatId = msg.chat && msg.chat.id;
const fromId = msg.from && msg.from.id;
const text = (msg.text || '').trim();
if (!chatId ||!text.startsWith('/')) return;

const [cmdRaw,...rest] = text.split(/\s+/);
const cmd = cmdRaw.split('@')[0].toLowerCase();
const argStr = rest.join(' ').trim();

if (cmd === '/start' || cmd === '/help') {
return sendMessage(chatId,
'📦 资源百宝库\n\n' +
'这是你自己的资源库机器人，只搜你亲手存进来的链接。\n\n' +
'🔍 /search <关键词> —— 按名字/标签搜资源\n' +
'📰 /news —— 最新二次元新闻（自动更新，不用手动加）\n' +
'📋 /list [分类] —— 最近 10 条（分类：galgame / anime / news）\n\n' +
'管理员命令：\n' +
'➕ /add <分类> <标题> | <链接> —— 添加资源\n' +
' 例：/add anime 哔哩哔哩 | https://www.bilibili.com\n' +
'🗑 /del <编号> —— 删除一条资源\n\n' +
'分类只有三种：galgame、anime（二次元）、news（新闻资讯）。');
}

if (cmd === '/search') {
if (!argStr) return sendMessage(chatId, '用法：/search <关键词>\n例：/search CLANNAD');
const kw = argStr.toLowerCase();
const hits = library.filter((e) =>
(e.title || '').toLowerCase().includes(kw) ||
(e.tags || []).some((t) => String(t).toLowerCase().includes(kw)) ||
(e.category || '').toLowerCase().includes(kw)
).slice(0, 10);
if (hits.length === 0) return sendMessage(chatId, `没有找到「${argStr}」相关的资源。换个关键词试试，或让管理员用 /add 添加。`);
return sendMessage(chatId, `🔍 找到 ${hits.length} 条「${argStr}」：\n\n` + hits.map(fmtEntry).join('\n\n'));
}

if (cmd === '/list') {
const cat = argStr.toLowerCase();
let rows = [...library].sort((a, b) => (b.added_at || '').localeCompare(a.added_at || ''));
if (cat) {
if (!CATEGORIES[cat]) return sendMessage(chatId, '分类不对，只有：galgame、anime、news');
rows = rows.filter((e) => e.category === cat);
}
rows = rows.slice(0, 10);
if (rows.length === 0) return sendMessage(chatId, '库里暂时没有资源，让管理员用 /add 添加。');
return sendMessage(chatId, `📋 最近 ${rows.length} 条：\n\n` + rows.map(fmtEntry).join('\n\n'));
}

if (cmd === '/news') {
const r = await fetchNews();
if (r.error) return sendMessage(chatId, `📰 新闻拉取失败：${r.error}\n请稍后再试。`);
return sendMessage(chatId, '📰 最新二次元新闻：\n\n' + r.items.join('\n\n'));
}

if (cmd === '/add') {
if (!isAdmin(fromId)) return sendMessage(chatId, '只有管理员可以添加资源。');
const m = argStr.match(/^(\S+)\s+(.+?)\s*\|\s*(\S+)\s*$/);
if (!m) return sendMessage(chatId, '用法：/add <分类> <标题> | <链接>\n例：/add anime 哔哩哔哩 | https://www.bilibili.com');
const [, category, title, link] = m;
if (!CATEGORIES[category.toLowerCase()]) return sendMessage(chatId, '分类不对，只有：galgame、anime、news');
if (!/^https?:\/\//i.test(link)) return sendMessage(chatId, '链接必须以 http:// 或 https:// 开头。');
const entry = {
id: nextId++, category: category.toLowerCase(), title: title.trim(),
tags: [], link, added_by: fromId, added_at: new Date().toISOString(),
};
library.push(entry);
saveLibrary(library);
return sendMessage(chatId, `✅ 已添加：\n${fmtEntry(entry)}`);
}

if (cmd === '/del') {
if (!isAdmin(fromId)) return sendMessage(chatId, '只有管理员可以删除资源。');
const id = parseInt(argStr, 10);
if (!id) return sendMessage(chatId, '用法：/del <编号>\n例：/del 3');
const idx = library.findIndex((e) => e.id === id);
if (idx === -1) return sendMessage(chatId, `没有找到编号为 ${id} 的资源。`);
const [removed] = library.splice(idx, 1);
saveLibrary(library);
return sendMessage(chatId, `🗑 已删除 #${id}：${removed.title}`);
}

// 未知命令不回复，避免刷屏
}

async function handleUpdate(update) {
if (update.message) await handleMessage(update.message);
}

// ---- HTTP 服务器（Webhook 入口 + 健康检查）----
const server = http.createServer(async (req, res) => {
const url = new URL(req.url, `http://localhost:${PORT}`);
if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
res.writeHead(200, { 'Content-Type': 'application/json'});
res.end(JSON.stringify({ status: 'ok', entries: library.length, mode: POLLING? 'polling': 'webhook'}));
return;
}
if (req.method === 'POST' && (url.pathname === '/webhook' || url.pathname === `/webhook/${BOT_TOKEN}`)) {
if (WEBHOOK_SECRET) {
const secret = req.headers['x-telegram-bot-api-secret-token'];
if (secret!== WEBHOOK_SECRET) { res.writeHead(403); res.end('forbidden'); return;}
}
let body = '';
req.on('data', (c) => { body += c;});
req.on('end', async () => {
res.writeHead(200); res.end('ok');
try { await handleUpdate(JSON.parse(body));} catch (e) { console.error('[webhook] 处理失败:', e.message);}
});
return;
}
res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
console.log(`[bot] HTTP 服务已启动，端口 ${PORT}，库中有 ${library.length} 条资源`);
if (POLLING) {
console.log('[bot] 长轮询模式');
startPolling();
} else if (WEBHOOK_URL && BOT_TOKEN && BOT_TOKEN!== 'DUMMY') {
const webhookUrl = `${WEBHOOK_URL}/webhook/${BOT_TOKEN}`;
tg('setWebhook', { url: webhookUrl,...(WEBHOOK_SECRET? { secret_token: WEBHOOK_SECRET}: {})})
.then((r) => { if (r && r.ok) console.log('[bot] Webhook 已设置：', webhookUrl);});
} else {
console.log('[bot] Webhook 模式：请设置 WEBHOOK_URL 环境变量后重启（或用 POLLING=true 本地测试）');
}
});

let offset = 0;
async function startPolling() {
for (;;) {
try {
const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=30`, { signal: AbortSignal.timeout(40000)});
const data = await res.json().catch(() => ({}));
if (data.ok && Array.isArray(data.result)) {
for (const u of data.result) {
offset = Math.max(offset, (u.update_id || 0) + 1);
await handleUpdate(u);
}
} else if (data && data.description) {
console.error('[polling] getUpdates 失败:', data.description);
await new Promise((r) => setTimeout(r, 5000));
}
} catch (e) {
console.error('[polling] 网络错误:', e.message);
await new Promise((r) => setTimeout(r, 5000));
}
}
}
