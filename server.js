const http = require('http');
const WebSocket = require('ws');

const clients = new Set();
const roomMessages = new Map(); // { oda_adi: [mesaj1, mesaj2, ...] }

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket sunucusu çalışıyor.");
});

const wss = new WebSocket.Server({ server });

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

    // Kullanıcı odaya katıldıysa
    if (msg.type === 'join') {
      ws.userData.username = msg.username;
      ws.userData.room = msg.room;

      // Odanın geçmişini gönder
      const history = roomMessages.get(msg.room) || [];
      history.forEach((oldMsg) => {
        ws.send(JSON.stringify(oldMsg));
      });

      return;
    }

    // Mesaj gönderildiyse
    if (msg.type === 'message') {
      const messageObj = {
        username: msg.username,
        room: msg.room,
        message: msg.message
      };

      // Oda geçmişine ekle
      if (!roomMessages.has(msg.room)) {
        roomMessages.set(msg.room, []);
      }
      roomMessages.get(msg.room).push(messageObj);

      // O odadaki herkese gönder
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
    clients.delete(ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket sunucusu ${PORT} portunda çalışıyor`);
});
