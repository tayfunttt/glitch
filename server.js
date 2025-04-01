const http = require('http');
const WebSocket = require('ws');

const clients = new Map(); // { username: ws }
const messageQueue = new Map(); // { username: [mesaj1, mesaj2, ...] }

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket sunucusu çalışıyor.");
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.userData = { username: null, room: null };

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
      clients.set(msg.username, ws); // Kullanıcı online

      // Kuyruktaki mesajları gönder
      const queued = messageQueue.get(msg.username) || [];
      queued.forEach(queuedMsg => {
        ws.send(JSON.stringify(queuedMsg));
      });
      messageQueue.delete(msg.username); // Mesajlar gösterildi, kuyruk temizlendi
      return;
    }

    if (msg.type === 'message') {
      // Aynı odadaki kullanıcılara mesajı gönder
      wss.clients.forEach(client => {
        if (
          client.readyState === WebSocket.OPEN &&
          client.userData.room === ws.userData.room &&
          client.userData.username !== msg.username
        ) {
          client.send(JSON.stringify({
            username: msg.username,
            room: msg.room,
            message: msg.message
          }));
        }
      });

      // Odaya bağlı olmayan kullanıcılar için mesajı kuyrukla
      clients.forEach((clientWS, otherUsername) => {
        if (
          otherUsername !== msg.username && // kendine gönderme
          (!clientWS || clientWS.readyState !== WebSocket.OPEN || clientWS.userData.room !== msg.room)
        ) {
          const pending = messageQueue.get(otherUsername) || [];
          pending.push({
            username: msg.username,
            room: msg.room,
            message: msg.message
          });
          messageQueue.set(otherUsername, pending);
        }
      });
    }
  });

  ws.on('close', () => {
    const username = ws.userData.username;
    if (username && clients.get(username) === ws) {
      clients.delete(username);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket sunucusu ${PORT} portunda çalışıyor`);
});
