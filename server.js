﻿const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const openai = new OpenAI.OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const users = new Map();
const roomMessages = new Map();

wss.on("connection", (ws) => {
  ws.on("message", async (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      return;
    }

    if (msg.type === "join") {
      ws.username = msg.username;
      ws.room = msg.room;
      users.set(ws, { username: msg.username, room: msg.room });

      if (!roomMessages.has(msg.room)) {
        roomMessages.set(msg.room, []);
      }

      const alreadyExists = Array.from(users.values()).some(
        (u) => u.username === "tesla" && u.room === msg.room
      );
      if (!alreadyExists) {
        users.set(`bot-${msg.room}`, { username: "tesla", room: msg.room });
      }

      roomMessages.get(msg.room).forEach((m) =>
        ws.send(JSON.stringify(m))
      );
      updateUserList(msg.room);
    }

    if (msg.type === "message") {
      const lowerMsg = msg.message.toLowerCase();

      const messageObj = {
        username: msg.username,
        room: msg.room,
        message: msg.message,
        timestamp: Date.now(),
      };

      if (!roomMessages.has(msg.room)) {
        roomMessages.set(msg.room, []);
      }

      roomMessages.get(msg.room).push(messageObj);
      broadcast(msg.room, messageObj);

      if (isWakingTesla(lowerMsg) || isTeslaMessage(lowerMsg)) {
        const prompt = isWakingTesla(lowerMsg)
          ? "Salve! Quid agis?"
          : msg.message.replace(/^(@tesla|tesla:)/i, "").trim();

        try {
          const chatResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "Responde semper Latine. Sint responsa brevia et clara.",
              },
              { role: "user", content: prompt },
            ],
          });

          const teslaReply = {
            username: "tesla",
            room: msg.room,
            message: chatResponse.choices[0].message.content.trim(),
            timestamp: Date.now(),
          };

          roomMessages.get(msg.room).push(teslaReply);
          broadcast(msg.room, teslaReply);
        } catch (err) {
          console.error("OpenAI HATASI:", err.message);
        }
      }
    }

    if (msg.type === "deleteOwnMessages") {
      const filtered = (roomMessages.get(msg.room) || []).filter(
        (m) => m.username !== msg.username
      );
      roomMessages.set(msg.room, filtered);
      ws.send(JSON.stringify({ type: "cleared", room: msg.room }));
    }
  });

  ws.on("close", () => {
    users.delete(ws);
    if (ws.room) updateUserList(ws.room);
  });
});

function broadcast(room, data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.room === room) {
      client.send(JSON.stringify(data));
    }
  });
}

function updateUserList(room) {
  const userList = Array.from(users.values())
    .filter((u) => u.room === room)
    .map((u) => u.username);

  broadcast(room, { type: "userList", room, users: userList });
}

function isWakingTesla(text) {
  const lower = text.toLowerCase();
  const triggers = [
    "tesla", "@tesla", "tesla:",
    "tesla neredesin", "tesla naber", "tesla varmısın", "tesla oradamı",
    "tesla burda mısın", "tesla cevap ver", "tesla selam",
    "тесла", "テスラ", "tesla où es-tu", "tesla bist du da", "tesla estas ahí"
  ];
  return triggers.some((trigger) => lower.includes(trigger));
}

function isTeslaMessage(text) {
  const lower = text.toLowerCase();
  return (
    lower.includes("@tesla") ||
    lower.includes("tesla:") ||
    lower.startsWith("tesla ")
  );
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Tesla destekli Chat sunucusu ${PORT} portunda çalışıyor.`);
});
