import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createClient } from "redis";
import { config } from "dotenv";
import OpenAI from "openai";

config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const messages = new Map();
const roomMessages = new Map();

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

await redis.connect();

const loadMessages = async (room) => {
  const list = await redis.lRange(room, 0, -1);
  const parsed = list.map((str) => JSON.parse(str));
  roomMessages.set(room, parsed);
};

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
      await loadMessages(msg.room);
    }

    const lowerMsg = msg.message.toLowerCase();

    // ✅ Sunucunun kendi GPT çağrısı devre dışı bırakıldı
    if (isWakingTesla(lowerMsg) || isTeslaMessage(lowerMsg)) {
      console.log("⏹️ Server GPT cevabı iptal edildi. Client üzerinden çalışıyor.");
      return;

      /*
      // 🧠 Önceki GPT-3.5 cevabı - yorumda kaldı
      let prompt = msg.message.replace(/^(@tesla|tesla:|tesla)/i, "").trim();
      if (!prompt || prompt.length < 3) return;

      const history = roomMessages.get(msg.room) || [];
      const recent = history
        .filter((m) => m.username === "tesla" || m.username === msg.username)
        .slice(-6)
        .map((m) => ({
          role: m.username === "tesla" ? "assistant" : "user",
          content: m.message,
        }));

      recent.unshift({
        role: "system",
        content: "You are Tesla, a helpful assistant who speaks Turkish.",
      });

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: recent,
        });

        const teslaReply = {
          username: "tesla",
          room: msg.room,
          message: response.choices[0].message.content.trim(),
          timestamp: Date.now(),
        };

        roomMessages.get(msg.room).push(teslaReply);
        await redis.rPush(msg.room, JSON.stringify(teslaReply));
        broadcast(msg.room, teslaReply);
      } catch (err) {
        console.error("OpenAI error:", err.message);
      }
      */
    }

    msg.timestamp = Date.now();
    const history = roomMessages.get(msg.room);
    history.push(msg);
    await redis.rPush(msg.room, JSON.stringify(msg));
    broadcast(msg.room, msg);
  });

  ws.on("close", () => {
    messages.delete(ws);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("✅ Server ready http://localhost:3000");
});
