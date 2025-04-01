const http = require('http');
const WebSocket = require('ws');

const clients = new Set();
const roomMessages = new Map(); // { oda: [mesaj1, mesaj2, ...] }

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket sunucusu çalışıyor.");
});

const wss = new WebSocket.Server({ server });

function getUsersInRoom(room) {
  const users = [];
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN && ws.userData.room === room) {
      users.push(ws.userData.username);
    }
  });
  return users;
}

function broadcastUserList(room) {
  const userList = getUsersInRoom(room);
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
    }
  });

  ws.on('close', () => {
    const room = ws.userData.room;
    clients.delete(ws);
    if (room) {
      broadcastUserList(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket sunucusu ${PORT} portunda çalışıyor`);
});
