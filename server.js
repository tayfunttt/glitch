﻿require('dotenv').config(); // .env dosyasından API anahtarı okunur

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const users = {};
const roomMessages = new Map();

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      return;
    }

    if (msg.type === 'join') {
      ws.username = msg.username;
      ws.room = msg.room;

      users[ws] = { username: msg.username, room: msg.room };

      if (!roomMessages.has(msg.room)) {
        roomMessages.set(msg.room, []);
      }

      const previousMessages = roomMessages.get(msg.room);
      previousMessages.forEach(m => ws.send(JSON.stringify(m)));

      updateUserList(ws.room);
    }

    if (msg.type === 'message') {
      const messageObj = {
        username: msg.username,
        room: msg.room,
        message: msg.message,
        timestamp: Date.now()
      };

      if (!roomMessages.has(msg.room)) {
        roomMessages.set(msg.room, []);
      }
      roomMessages.get(msg.room).push(messageObj);
      broadcast(msg.room, messageObj);

      // @chatgpt mesajı ise GPT'den cevap al
      if (isGPTMessage(msg.message)) {
        const cleanPrompt = msg.message.replace(/^(@chatgpt|chatgpt:)/i, '').trim();

        try {
          const response = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [
              { role: "system", content: "Kısa ve açıklayıcı cevap ver." },
              { role: "user", content: cleanPrompt }
            ],
            temperature: 0.7
          });

          const gptReply = response.data.choices[0].message.content;

          const gptMessage = {
            username: 'chatgpt',
            room: msg.room,
            message: gptReply,
            timestamp: Date.now()
          };

          roomMessages.get(msg.room).push(gptMessage);
          broadcast(msg.room, gptMessage);
        } catch (err) {
          console.error("GPT API Hatası:", err.message);
        }
      }
    }

    if (msg.type === 'deleteOwnMessages') {
      const all = roomMessages.get(msg.room) || [];
      const filtered = all.filter(m => m.username !== msg.username);
      roomMessages.set(msg.room, filtered);
      ws.send(JSON.stringify({ type: 'cleared', room: msg.room }));
    }
  });

  ws.on('close', () => {
    delete users[ws];
    if (ws.room) updateUserList(ws.room);
  });
});

function broadcast(room, data) {
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.room === room) {
      client.send(JSON.stringify(data));
    }
  });
}

function updateUserList(room) {
  const userList = Object.values(users)
    .filter(u => u.room === room)
    .map(u => u.username);

  broadcast(room, {
    type: 'userList',
    room,
    users: userList
  });
}

function isGPTMessage(text) {
  return text.toLowerCase().startsWith('@chatgpt') || text.toLowerCase().startsWith('chatgpt:');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ GPT destekli sunucu ${PORT} portunda çalışıyor.`);
});
