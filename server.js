const http = require('http');
const WebSocket = require('ws');

const clients = new Set();

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

    if (msg.type === 'join') {
      ws.userData.username = msg.username;
      ws.userData.room = msg.room;
      return;
    }

    if (msg.type === 'message') {
      clients.forEach(client => {
        if (
          client.readyState === WebSocket.OPEN &&
          client.userData.room === ws.userData.room
        ) {
          client.send(JSON.stringify({
            username: ws.userData.username,
            room: ws.userData.room,
            message: msg.message
          }));
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
