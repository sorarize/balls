import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import xx from './xx.js';
import os from 'os';

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
const users = new Map(); // key: IP, value: { color, circles: [] }

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

// Socket.IO 連接處理
io.on('connection', (socket) => {
  const clientIP = getClientIP(socket);
  xx('Client connected from:', clientIP);

  // 檢查是否是已存在的使用者
  if (!users.has(clientIP)) {
    users.set(clientIP, {
      color: generateRandomColor(),
      circles: [],
    });
  }

  const user = users.get(clientIP);

  // 發送初始資料，包括使用者資訊
  socket.emit('init', {
    circles: Array.from(users.values()).flatMap(u => u.circles),
    userColor: user.color,
    userCircles: user.circles,
  });

  // 處理新的圓形
  socket.on('new-circle', (data) => {
    const user = users.get(clientIP);

    // 添加使用者顏色（創建副本）
    data.color = { ...user.color };

    if (user.circles.length >= 10) {
      const oldCircle = user.circles.shift(); // 移除最舊的
      data.id = oldCircle.id;
      user.circles.push(data);  // 將更新後的圓形放到末端
      io.emit('update-circle', data);
    } else {
      data.id = Date.now() + Math.random();
      user.circles.push(data);
      socket.broadcast.emit('circle-added', data);
    }
  });

  socket.on('disconnect', () => {
    xx('Client disconnected:', clientIP);
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
