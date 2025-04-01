const http = require('http');
const WebSocket = require('ws');

const clients = new Set();
const roomMessages = new Map(); // { oda: [mesaj1, mesaj2, ...] }

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket sunucusu çalışıyor.");
});

const wss = new WebSocket.Server({ server });

function broadcastUserList(room) {
  const userList = [];

  clients.forEach(ws => {
    if (ws.readyState !== WebSocket.OPEN) {
      clients.delete(ws);
      return;
    }

    if (ws.userData.room === room) {
      userList.push(ws.userData.username);
    }
  });

  const message = JSON.stringify({
    type: 'userList',
    users: userList,
    room
  });

  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN && ws.userData.room === room) {
      ws.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  ws.userData = { username: null, room: null };
  clients.add(ws);

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    // Odaya katılma
    if (msg.type === 'join') {
      ws.userData.username = msg.username;
      ws.userData.room = msg.room;

      // Eski mesajları gönder
      const history = roomMessages.get(msg.room) || [];
      history.forEach(m => {
        ws.send(JSON.stringify(m));
      });

      broadcastUserList(msg.room);
      return;
    }

    // Yeni mesaj gönderme
    if (msg.type === 'message') {
      const messageObj = {
        username: msg.username,
        room: msg.room,
        message: msg.message
      };

      if (!roomMessages.has(msg.room)) {
        roomMessages.set(msg.room, []);
      }
      roomMessages.get(msg.room).push(messageObj);

      clients.forEach(client => {
        if (
          client.readyState === WebSocket.OPEN &&
          client.userData.room === msg.room
        ) {
          client.send(JSON.stringify(messageObj));
        }
      });
      return;
    }

    // Sadece kendi mesajlarını silme
    if (msg.type === 'deleteOwnMessages') {
      const room = msg.room;
      const username = msg.username;

      if (roomMessages.has(room)) {
        const filtered = roomMessages.get(room).filter(m => m.username !== username);
        roomMessages.set(room, filtered);
      }

      // Tüm kullanıcılara önce temizleme bildirimi
      clients.forEach(client => {
        if (
          client.readyState === WebSocket.OPEN &&
          client.userData.room === room
        ) {
          client.send(JSON.stringify({ type: 'cleared', room }));

          // Güncel mesajları yeniden gönder
          roomMessages.get(room).forEach(m => {
            client.send(JSON.stringify(m));
          });
        }
      });

      return;
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (ws.userData.room) {
      broadcastUserList(ws.userData.room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket sunucusu ${PORT} portunda çalışıyor`);
});
