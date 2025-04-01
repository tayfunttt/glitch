﻿const WebSocket = require('ws');
const http = require('http');

// HTTP yanıtı verecek şekilde server tanımı
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket signaling server is running.');
});

const wss = new WebSocket.Server({ server });

const rooms = {}; // roomId -> [clients]

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.error('Invalid JSON:', err);
      return;
    }

    const { type, roomId, payload } = data;

    switch (type) {
      case 'join':
        if (!rooms[roomId]) {
          rooms[roomId] = [];
        }
        rooms[roomId].push(ws);
        ws.roomId = roomId;
        console.log(`Client joined room ${roomId}`);
        break;

      case 'signal':
        const roomClients = rooms[roomId] || [];
        roomClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'signal',
              payload
            }));
          }
        });
        break;

      default:
        console.log('Unknown message type:', type);
    }
  });

  ws.on('close', () => {
    const room = rooms[ws.roomId];
    if (room) {
      rooms[ws.roomId] = room.filter(client => client !== ws);
    }
  });
});

// Render sunucularında mutlaka 0.0.0.0 IP'si dinlenmeli
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server is running on port ${PORT}`);
});
