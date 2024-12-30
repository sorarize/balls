import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import xx from './xx.js';
import os from 'os';
import { Config } from './Config.js';

// 設定 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 載入環境變數
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? [
        process.env.RAILWAY_STATIC_URL
          ? `https://${process.env.RAILWAY_STATIC_URL}`
          : true,
      ]
      : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        `http://${getLocalIPs()[0]}:5173`,
      ],
    methods: ['GET', 'POST'],
    credentials: false,
    transports: ['polling', 'websocket'],
  },
});

// 儲存使用者資訊
const users = new Map(); // key: IP, value: { id, color, circles: [], behaviorCode: null }

// 生成隨機顏色
function generateRandomColor() {
  return {
    h: Math.random() * 360,  // 色相 0-360
    s: 70,                   // 飽和度固定在 70%
    l: 50,                    // 亮度固定在 50%
  };
}

// 獲取客戶端 IP
function getClientIP(socket) {
  return socket.handshake.headers['x-forwarded-for'] ||
         socket.handshake.address;
}

// 在用戶連接時生成唯一 ID
function generateUserId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 添加 master 追蹤
let masterId = null;

// 獲取用戶識別符
function getUserIdentifier(socket) {
  if (Config.USER_ID_MODE === 'session') {
    // 在 session 模式下，每個連接都是新用戶
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  } else {
    return getClientIP(socket);
  }
}

// Socket.IO 連接處理
io.on('connection', (socket) => {
  const userIdentifier = getUserIdentifier(socket);
  xx('Client connected with identifier:', userIdentifier);

  // 檢查是否是已存在的使用者
  if (!users.has(userIdentifier)) {
    users.set(userIdentifier, {
      id: generateUserId(),
      color: generateRandomColor(),
      circles: [],
      behaviorCode: null,
    });
  }

  const user = users.get(userIdentifier);

  // 如果還沒有 master，設定這個連接為 master
  if (masterId === null) {
    masterId = user.id;
    xx('Set new master:', masterId, 'for client:', userIdentifier);
  }

  // 發送初始資料，包括使用者資訊和 master 狀態
  const isMaster = user.id === masterId;
  xx('Sending init data to client:', userIdentifier, 'isMaster:', isMaster);
  socket.emit('init', {
    circles: Array.from(users.values()).flatMap(u => u.circles),
    userColor: user.color,
    userId: user.id,
    userCircles: user.circles,
    behaviorCode: user.behaviorCode,
    isMaster: isMaster,
  });

  // 當 master 斷開連接時，選擇新的 master
  socket.on('disconnect', () => {
    xx('Client disconnected:', userIdentifier);
    const user = users.get(userIdentifier);

    if (user.id === masterId) {
      // 如果是 master 斷開連接
      // 1. 移除該用戶的所有球
      io.emit('remove-user-circles', { userId: user.id });

      // 2. 從 users Map 中移除該用戶
      users.delete(userIdentifier);

      // 3. 從剩餘的用戶中選擇新的 master
      const remainingUsers = Array.from(users.values());
      if (remainingUsers.length > 0) {
        masterId = remainingUsers[0].id;
        xx('New master selected:', masterId);
        io.emit('new-master', { masterId });
      } else {
        masterId = null;
      }
    } else {
      // 如果是普通用戶斷開連接
      // 1. 移除該用戶的所有球
      io.emit('remove-user-circles', { userId: user.id });

      // 2. 從 users Map 中移除該用戶
      users.delete(userIdentifier);
    }
  });

  // 添加位置更新事件
  socket.on('positions-update', (data) => {
    // 只接受來自 master 的位置更新
    if (user.id === masterId) {
      xx('Received positions update from master:', userIdentifier);
      io.emit('positions-updated', data);
    } else {
      xx('Ignored positions update from non-master client:', userIdentifier);
    }
  });

  // 處理新的圓形
  socket.on('new-circle', (data) => {
    const user = users.get(userIdentifier);

    // 添加使用者資訊（創建副本）
    data.color = { ...user.color };
    data.userId = user.id;

    if (user.circles.length >= Config.MAX_CIRCLES_PER_USER) {
      const oldCircle = user.circles.shift();
      data.id = oldCircle.id;
      user.circles.push(data);
      io.emit('update-circle', data);
    } else {
      data.id = Date.now() + Math.random();
      user.circles.push(data);
      io.emit('circle-added', data);
    }
  });

  // 添加清除處理
  socket.on('clear-all', () => {
    // 只接受來自 master 的清除指令
    if (user.id === masterId) {
      xx('Clearing all circles from server (master request)');
      // 清除所有使用者的圓形
      for (const user of users.values()) {
        user.circles = [];
      }
      // 廣播清除事件給所有客戶端
      io.emit('clear-all');
    } else {
      xx('Ignored clear-all request from non-master client');
    }
  });

  socket.on('set-behavior', (data) => {
    xx('Received behavior update from client:', userIdentifier);
    const user = users.get(userIdentifier);
    user.behaviorCode = data.code;
    // 改成發送給所有客戶端，包括發送者
    io.emit('behavior-updated', { code: data.code });
  });
});

// 在檔案開頭附近加入這行來檢查部署環境
xx('Current environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL,
});

// 生產環境中提供靜態檔案
if (process.env.NODE_ENV === 'production') {
  // 提供靜態檔案
  app.use(express.static(join(__dirname, '../dist')));

  // 所有的路由都返回 index.html
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
} else {
  // 開發環境的路由
  app.get('/', (req, res) => {
    res.send('Socket.IO 伺服器運行中');
  });
}

// 獲取本機 IP 地址的函數
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

// 開發環境固定使用 3001 端口
const PORT = process.env.NODE_ENV === 'production'
  ? (process.env.PORT || 3001)
  : 3001;

server.listen(PORT, () => {
  xx(`Server running on port ${PORT}`);
  xx('Environment:', process.env.NODE_ENV);

  // 顯示所有可用的 IP 地址
  const ips = getLocalIPs();
  xx('Available on:');
  xx(`  > Local:    http://localhost:${PORT}`);
  ips.forEach(ip => {
    xx(`  > Network:  http://${ip}:${PORT}`);
    xx(`  > WebSocket: ws://${ip}:${PORT}`);
  });
});
