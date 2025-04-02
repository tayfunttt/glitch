import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const messages = new Map();
const roomMessages = new Map();

// ❌ index.html sunumu kaldırıldı — frontend parpar.it'te zaten var
app.get("/", (_, res) => {
  res.send("✅ Parpar WebSocket sunucusu çalışıyor.");
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

    // ✅ Sunucu GPT cevabı üretmez, client (OpenRouter) kullanılır
    if (isWakingTesla(lowerMsg) || isTeslaMessage(lowerMsg)) {
      console.log("⏹️ Server GPT devre dışı, client üzerinden cevaplanıyor.");
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
