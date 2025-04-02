const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const users = {};
const roomMessages = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      return;
    }

    if (msg.type === 'join') {
      ws.username = msg.username;
      ws.room = msg.room;

      if (!roomMessages.has(msg.room)) roomMessages.set(msg.room, []);
      users[ws] = { username: msg.username, room: msg.room };

      // Önceki mesajları gönder
      roomMessages.get(msg.room).forEach(m => ws.send(JSON.stringify(m)));

      // Kullanıcı listesini yayınla
      const userList = Object.values(users)
        .filter(u => u.room === msg.room)
        .map(u => u.username);
      broadcast(msg.room, { type: 'userList', room: msg.room, users: userList });
    }

    if (msg.type === 'message') {
      const messageObj = {
        username: msg.username,
        room: msg.room,
        message: msg.message,
        timestamp: Date.now()
      };
      if (!roomMessages.has(msg.room)) roomMessages.set(msg.room, []);
      roomMessages.get(msg.room).push(messageObj);
      broadcast(msg.room, messageObj);
    }

    if (msg.type === 'deleteOwnMessages') {
      const msgs = roomMessages.get(msg.room) || [];
      roomMessages.set(msg.room, msgs.filter(m => m.username !== msg.username));
      ws.send(JSON.stringify({ type: 'cleared', room: msg.room }));
    }
  });

  ws.on('close', () => {
    delete users[ws];
    if (ws.room) {
      const userList = Object.values(users)
        .filter(u => u.room === ws.room)
        .map(u => u.username);
      broadcast(ws.room, { type: 'userList', room: ws.room, users: userList });
    }
  });
});

function broadcast(room, data) {
  wss.clients.forEach(client => {
    if (client.readyState === 1 && users[client]?.room === room) {
      client.send(JSON.stringify(data));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
