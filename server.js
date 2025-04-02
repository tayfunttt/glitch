import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const messages = new Map();
const roomMessages = new Map();

app.get("/", async (_, res) => {
  const html = await readFile("./index.html", "utf-8");
  res.setHeader("content-type", "text/html").send(html);
});

const broadcast = (room, data) => {
  messages.forEach((wsRoom, ws) => {
    if (wsRoom === room && ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  });
};

const isWakingTesla = (text) => /^(@tesla|tesla:)/i.test(text);
const isTeslaMessage = (text) => text.toLowerCase().startsWith("tesla ");

wss.on("connection", (ws) => {
  ws.on("message", async (msgStr) => {
    let msg;
    try {
      msg = JSON.parse(msgStr);
    } catch {
      return;
    }

    if (!msg.room || !msg.username || !msg.message) return;

    messages.set(ws, msg.room);

    if (!roomMessages.has(msg.room)) {
      roomMessages.set(msg.room, []);
    }

    const lowerMsg = msg.message.toLowerCase();

    // ✅ Server GPT yanıtı vermiyor, client (OpenRouter) çalışıyor
    if (isWakingTesla(lowerMsg) || isTeslaMessage(lowerMsg)) {
      console.log("⏹️ Server GPT cevabı iptal. Cevap client tarafından gönderilecek.");
      return;
    }

    msg.timestamp = Date.now();

    const history = roomMessages.get(msg.room);
    history.push(msg);

    broadcast(msg.room, msg);
  });

  ws.on("close", () => {
    messages.delete(ws);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("✅ Server ready http://localhost:3000");
});
