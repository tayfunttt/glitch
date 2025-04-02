require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
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

      // ChatGPT kullanıcı olarak odaya katılsın (sessiz)
      const botId = 'bot-' + msg.room;
      const alreadyExists = Object.values(users).some(u => u.username === 'chatgpt' && u.room === msg.room);
      if (!alreadyExists) {
        users[botId] = { username: 'chatgpt', room: msg.room };
      }

      // Önceki mesajları gönder
      roomMessages.get(msg.room).forEach(m => ws.send(JSON.stringify(m)));

      updateUserList(msg.room);
    }

    if (msg.type === 'message') {
      const lowerMsg = msg.message.toLowerCase();

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

      if (isWakingGPT(lowerMsg) || isGPTMessage(lowerMsg)) {
        const prompt = isWakingGPT(lowerMsg)
          ? "Kısa ve samimi bir şekilde 'buradayım' şeklinde cevap ver."
          : msg.message.replace(/^(@chatgpt|chatgpt:)/i, '').trim();

        try {
          const completion = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: prompt,
            max_tokens: 100,
            temperature: 0.7
          });

          const gptMessage = {
            username: 'chatgpt',
            room: msg.room,
            message: completion.data.choices[0].text.trim(),
            timestamp: Date.now()
          };

          roomMessages.get(msg.room).push(gptMessage);
          broadcast(msg.room, gptMessage);
        } catch (err) {
          console.error("OpenAI API hatası:", err.message);
        }
      }
    }

    if (msg.type === 'deleteOwnMessages') {
      const filtered = (roomMessages.get(msg.room) || []).filter(m => m.username !== msg.username);
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

  broadcast(room, { type: 'userList', room, users: userList });
}

// 🔁 ChatGPT’yi uyandıran varyasyonları yakalayan fonksiyon
function isWakingGPT(text) {
  const lower = text.toLowerCase();
  const triggers = [
    "chatgpt oradamı",
    "chatgpt oradamısın",
    "chatgpt orodamısın",
    "chatgpt neredesin",
    "chatgpt varmısın",
    "chatgpt burda",
    "chatgpt duydun mu",
    "chatgpt ses ver",
    "chatgpt orda"
  ];
  return triggers.some(trigger => lower.includes(trigger));
}

// 🧠 GPT soru yakalama
function isGPTMessage(text) {
  return (
    text.includes('@chatgpt') ||
    text.includes('chatgpt:') ||
    text.startsWith('chatgpt ')
  );
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ ChatGPT sunucu ${PORT} portunda aktif.`);
});
