const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 靜態檔案服務
app.use(express.static(path.join(__dirname, 'public')));

// 根路徑重導向到使用者介面
app.get('/', (req, res) => {
  res.redirect('/client.html');
});

// ============ 遊戲狀態 (記憶體儲存) ============
const gameState = {
  isLocked: false,        // 是否鎖定房間（禁止新加入）
  isBuzzerActive: false,  // 搶答是否進行中
  startTime: null,        // 搶答開始時間
  winner: null,           // 獲勝者資訊
  participants: new Map() // 參賽者 Map: socketId -> { nickname, joinedAt }
};

// ============ API 路由 ============
app.get('/api/qrcode', async (req, res) => {
  try {
    const host = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const url = `${protocol}://${host}/client.html`;
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.json({ qrcode: qrDataUrl, url });
  } catch (err) {
    res.status(500).json({ error: 'QR Code 生成失敗' });
  }
});

// ============ Socket.io 事件處理 ============
io.on('connection', (socket) => {
  console.log(`[連線] ${socket.id}`);

  // 使用者加入
  socket.on('join', (nickname) => {
    // 檢查房間是否鎖定
    if (gameState.isLocked) {
      socket.emit('join-rejected', '房間已鎖定，無法加入');
      return;
    }

    // 儲存參賽者資訊
    gameState.participants.set(socket.id, {
      nickname: nickname || `玩家${gameState.participants.size + 1}`,
      joinedAt: Date.now()
    });

    socket.emit('join-success', {
      nickname: gameState.participants.get(socket.id).nickname,
      isBuzzerActive: gameState.isBuzzerActive,
      winner: gameState.winner
    });

    // 廣播更新參賽者列表
    broadcastParticipants();
    console.log(`[加入] ${nickname} (${socket.id})`);
  });

  // 管理員加入
  socket.on('admin-join', () => {
    socket.join('admin');
    socket.emit('state-update', getStateForAdmin());
    console.log(`[管理員連線] ${socket.id}`);
  });

  // 大螢幕加入
  socket.on('display-join', () => {
    socket.join('display');
    socket.emit('state-update', getStateForDisplay());
    console.log(`[大螢幕連線] ${socket.id}`);
  });

  // 鎖定/解鎖房間
  socket.on('toggle-lock', () => {
    gameState.isLocked = !gameState.isLocked;
    io.emit('lock-changed', gameState.isLocked);
    console.log(`[房間] ${gameState.isLocked ? '已鎖定' : '已解鎖'}`);
  });

  // 開始搶答
  socket.on('start-buzzer', () => {
    if (gameState.isBuzzerActive) return;

    gameState.isBuzzerActive = true;
    gameState.startTime = Date.now();
    gameState.winner = null;

    io.emit('buzzer-started', { startTime: gameState.startTime });
    console.log(`[搶答開始] ${new Date().toLocaleTimeString()}`);
  });

  // 使用者按下搶答
  socket.on('buzz', () => {
    // 檢查搶答是否進行中且尚無獲勝者
    if (!gameState.isBuzzerActive || gameState.winner) {
      return;
    }

    const participant = gameState.participants.get(socket.id);
    if (!participant) return;

    const reactionTime = Date.now() - gameState.startTime;

    // 設定獲勝者
    gameState.winner = {
      socketId: socket.id,
      nickname: participant.nickname,
      reactionTime: reactionTime
    };
    gameState.isBuzzerActive = false;

    // 廣播結果
    io.emit('buzzer-result', gameState.winner);
    console.log(`[獲勝] ${participant.nickname} - ${reactionTime}ms`);
  });

  // 重置搶答
  socket.on('reset-buzzer', () => {
    gameState.isBuzzerActive = false;
    gameState.startTime = null;
    gameState.winner = null;

    io.emit('buzzer-reset');
    console.log(`[重置] 搶答已重置`);
  });

  // 踢出使用者
  socket.on('kick-user', (targetSocketId) => {
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      const participant = gameState.participants.get(targetSocketId);
      targetSocket.emit('kicked', '您已被移出房間');
      targetSocket.disconnect(true);
      gameState.participants.delete(targetSocketId);
      broadcastParticipants();
      console.log(`[踢出] ${participant?.nickname || targetSocketId}`);
    }
  });

  // 斷線處理
  socket.on('disconnect', () => {
    if (gameState.participants.has(socket.id)) {
      const participant = gameState.participants.get(socket.id);
      gameState.participants.delete(socket.id);
      broadcastParticipants();
      console.log(`[離開] ${participant.nickname} (${socket.id})`);
    }
  });
});

// ============ 輔助函數 ============
function broadcastParticipants() {
  const participants = Array.from(gameState.participants.entries()).map(([id, data]) => ({
    id,
    nickname: data.nickname,
    joinedAt: data.joinedAt
  }));
  io.emit('participants-update', participants);
}

function getStateForAdmin() {
  return {
    isLocked: gameState.isLocked,
    isBuzzerActive: gameState.isBuzzerActive,
    winner: gameState.winner,
    participantCount: gameState.participants.size,
    participants: Array.from(gameState.participants.entries()).map(([id, data]) => ({
      id,
      nickname: data.nickname
    }))
  };
}

function getStateForDisplay() {
  return {
    isLocked: gameState.isLocked,
    isBuzzerActive: gameState.isBuzzerActive,
    winner: gameState.winner,
    participantCount: gameState.participants.size
  };
}

// ============ 啟動伺服器 ============
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║       線上搶答系統已啟動！                 ║
╠═══════════════════════════════════════════╣
║  控制台: http://localhost:${PORT}/admin.html   ║
║  大螢幕: http://localhost:${PORT}/display.html ║
║  使用者: http://localhost:${PORT}/client.html  ║
╚═══════════════════════════════════════════╝
  `);
});
