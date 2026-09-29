// خريطة الوطن - سيرفر بدون مكتبات. التشغيل: node server.js
const http = require("http"), fs = require("fs"), path = require("path");
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "change-me";
const DB = path.join(__dirname, "pins.json");
let pins = [];
try { pins = JSON.parse(fs.readFileSync(DB, "utf8")); } catch (e) {}
const clients = new Set(), lastPost = new Map();
const save = () => fs.writeFile(DB, JSON.stringify(pins), () => {});
const broadcast = () => { const d = "data: " + JSON.stringify(pins) + "\n\n"; clients.forEach(c => c.write(d)); };
const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "Content-Type": type + "; charset=utf-8" }); res.end(body); };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.pathname === "/") return send(res, 200, fs.readFileSync(path.join(__dirname, "public/index.html")), "text/html");
  if (url.pathname === "/api/stream") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write("data: " + JSON.stringify(pins) + "\n\n");
    clients.add(res); req.on("close", () => clients.delete(res)); return;
  }
  if (url.pathname === "/api/pins") {
    if (req.method === "GET") return send(res, 200, JSON.stringify(pins));
    if (req.method === "DELETE") {
      if (url.searchParams.get("key") !== ADMIN_KEY) return send(res, 403, "{}");
      pins = []; save(); broadcast(); return send(res, 200, "{}");
    }
    if (req.method === "POST") {
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress, now = Date.now();
      if (now - (lastPost.get(ip) || 0) < 3000) return send(res, 429, "{}");
      lastPost.set(ip, now);
      let b = ""; req.on("data", c => { b += c; if (b.length > 2000) req.destroy(); });
      req.on("end", () => {
        try {
          const d = JSON.parse(b), name = String(d.name || "").replace(/[<>&"]/g, "").trim().slice(0, 20), region = Number(d.region);
          if (!name || !(region >= 0 && region <= 12)) return send(res, 400, "{}");
          pins.push({ id: now.toString(36) + Math.random().toString(36).slice(2, 6), name, region });
          save(); broadcast(); send(res, 200, "{}");
        } catch (e) { send(res, 400, "{}"); }
      });
      return;
    }
  }
  send(res, 404, "not found", "text/plain");
}).listen(PORT, () => console.log("http://localhost:" + PORT));
