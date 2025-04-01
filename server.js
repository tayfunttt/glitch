function broadcastUserList(room) {
  const userList = [];

  clients.forEach(ws => {
    // Geçersiz bağlantı varsa temizle
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
