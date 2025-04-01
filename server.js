const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');

// Kullanıcı bağlantıları ve veri saklama
const clients = new Set();
const roomMessages = new Map(); // { oda: [mesaj1, mesaj2, ...] }
const oneSignalUsers = new Map(); // { username: oneSignalId }

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

function sendPushNotification(oneSignalId, message) {
  axios.post('https://onesignal.com/api/v1/notifications', {
    app_id: 'd903d460-20d2-40d4-bd5e-68af89c9a8a5',
    include_player_ids: [oneSignalId],
    contents: { tr: message, en: message }
  }, {
    headers: {
      'Authorization': 'os_v2_app_3eb5iyba2janjpk6ncxytsniuxgctctafseueknsfomt446yarpwwughtqjf5ncrnydvuxpkk5jv3u5bvt47sb45qqevyoihpg2ielq', // 👈 REST API KEY’ini buraya yaz
      'Content-Type': 'application/json'
    }
  }).then(() => {
    console.log('🔔 Push bildirimi gönderildi:', message);
  }).catch(err => {
    console.error('❌ Push gönderim hatası:', err.message);
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

    // OneSignal ID kaydı
    if (msg.type === 'registerPush') {
      oneSignalUsers.set(msg.username, msg.oneSignalId);
      console.log(`🟢 OneSignal ID kaydedildi: ${msg.username} = ${msg.oneSignalId}`);
      return;
    }

    // Odaya katılma
    if (msg.type === 'join') {
      ws.userData.username = msg.username;
      ws.userData.room = msg.room;

      const history = roomMessages.get(msg.room) || [];
      history.forEach(m => {
        ws.send(JSON.stringify(m));
      });

      broadcastUserList(msg.room);
      return;
    }

    // Yeni mesaj gönderildi
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

      let delivered = false;

      clients.forEach(client => {
        if (
          client.readyState === WebSocket.OPEN &&
          client.userData.room === msg.room
        ) {
          client.send(JSON.stringify(messageObj));
          delivered = true;
        }
      });

      // Eğer mesaj kimseye ulaşmadıysa → push bildirimi gönder
      if (!delivered) {
        oneSignalUsers.forEach((oneSignalId, username) => {
          if (username !== msg.username) {
            sendPushNotification(oneSignalId, `${msg.username} size mesaj gönderdi`);
          }
        });
      }

      return;
    }

    // Kendi mesajlarını silme
    if (msg.type === 'deleteOwnMessages') {
      const room = msg.room;
      const username = msg.username;

      if (roomMessages.has(room)) {
        const filtered = roomMessages.get(room).filter(m => m.username !== username);
        roomMessages.set(room, filtered);
      }

      clients.forEach(client => {
        if (
          client.readyState === WebSocket.OPEN &&
          client.userData.room === room
        ) {
          client.send(JSON.stringify({ type: 'cleared', room }));
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
  console.log(`✅ WebSocket sunucusu ${PORT} portunda çalışıyor`);
});
