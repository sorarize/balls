import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import xx from './xx.js';
import os from 'os';
import Config from './Config.js';

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
// 追蹤每個 IP 的連接數量
const connectionCounts = new Map(); // key: IP, value: number of connections
// 追蹤最早連接的 socket
let masterSocket = null;
let masterId = null;

// 生成隨機顏色
function generateRandomColor() {
  return {
    h: Math.random() * 360,
    s: Config.SATURATION,
    l: Config.LIGHTNESS,
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

// 獲取用戶識別符
function getUserIdentifier(socket) {
  if (Config.USER_ID_MODE === 'session') {
    // 在 session 模式下，每個連接都是新用戶
    xx('Using session as user identifier');
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  } else {
    xx('Using IP as user identifier');
    return getClientIP(socket);
  }
}

// Socket.IO 連接處理
io.on('connection', (socket) => {
  const userIdentifier = getUserIdentifier(socket);
  xx('Client connected with identifier:', userIdentifier);

  // 更新連接計數
  connectionCounts.set(userIdentifier, (connectionCounts.get(userIdentifier) || 0) + 1);
  xx('Connection count for', userIdentifier, ':', connectionCounts.get(userIdentifier));

  // 檢查是否是已存在的使用者
  if (!users.has(userIdentifier)) {
    const newUser = {
      id: generateUserId(),
      color: generateRandomColor(),
      circles: [],
      behaviorCode: null,
    };
    users.set(userIdentifier, newUser);
  }

  const user = users.get(userIdentifier);

  // master 選擇邏輯：如果沒有 master，將當前 socket 設為 master
  if (!masterSocket) {
    masterSocket = socket;
    masterId = user.id;
    xx('No master exists, setting current socket as master:', masterId);
  }

  // 發送初始資料，包括使用者資訊和 master 狀態
  const isMaster = socket === masterSocket;
  xx('Sending init data to client:', userIdentifier, 'isMaster:', isMaster);
  socket.emit('init', {
    circles: Array.from(users.values()).flatMap(u => u.circles),
    userColor: user.color,
    userId: user.id,
    userCircles: user.circles,
    behaviorCode: user.behaviorCode,
    isMaster: isMaster,
  });

  // 當用戶斷開連接時
  socket.on('disconnect', () => {
    xx('Client disconnected:', userIdentifier);
    const user = users.get(userIdentifier);

    // 更新連接計數
    const currentCount = connectionCounts.get(userIdentifier);
    const newCount = currentCount - 1;
    xx('Connection count for', userIdentifier, 'reduced to:', newCount);

    if (newCount <= 0) {
      // 沒有更多連接時，移除計數和用戶數據
      connectionCounts.delete(userIdentifier);
      io.emit('remove-user-circles', { userId: user.id });
      users.delete(userIdentifier);
    } else {
      // 還有其他連接存在，更新計數
      connectionCounts.set(userIdentifier, newCount);
      xx('User still has', newCount, 'connections, keeping circles');
    }

    // 如果是 master socket 斷開連接，選擇新的 master
    if (socket === masterSocket) {
      xx('Master disconnected, selecting new master');
      // 從所有連接中選擇最早的一個作為新的 master
      const sockets = Array.from(io.sockets.sockets.values());
      if (sockets.length > 0) {
        try {
          // 嘗試選擇新的 master
          const selectNewMaster = () => {
            // 在 session 模式下，直接使用第一個可用的 socket
            if (Config.USER_ID_MODE === 'session') {
              const newMasterSocket = sockets[0];
              // 遍歷所有用戶找到對應的用戶數據
              for (const userData of users.values()) {
                masterSocket = newMasterSocket;
                masterId = userData.id;
                xx('New master selected in session mode:', masterId);
                masterSocket.emit('you-are-master', { masterId });
                io.emit('new-master', { masterId });
                return true;
              }
            } else {
              // IP 模式下的原有邏輯
              for (const potentialMaster of sockets) {
                try {
                  const identifier = getUserIdentifier(potentialMaster);
                  const user = users.get(identifier);
                  if (user) {
                    masterSocket = potentialMaster;
                    masterId = user.id;
                    xx('New master selected:', masterId);
                    masterSocket.emit('you-are-master', { masterId });
                    io.emit('new-master', { masterId });
                    return true;
                  }
                } catch (error) {
                  xx('Error selecting potential master:', error);
                  continue;
                }
              }
            }
            return false;
          };

          if (!selectNewMaster()) {
            xx('Failed to select any master from available sockets');
            masterSocket = null;
            masterId = null;
            io.emit('master-selection-failed');
          }
        } catch (error) {
          xx('Error during master transition:', error);
          masterSocket = null;
          masterId = null;
          io.emit('master-selection-failed');
        }
      } else {
        xx('No available sockets for new master');
        masterSocket = null;
        masterId = null;
        io.emit('master-selection-failed');
      }
    }
  });

  // 添加位置更新事件
  socket.on('positions-update', (data) => {
    // 只接受來自 master 的位置更新
    if (user.id === masterId) {
      // xx('Received positions update from master:', userIdentifier);
      io.emit('positions-updated', data);
    } else {
      // xx('Ignored positions update from non-master client:', userIdentifier);
    }
  });

  // 處理新的圓形
  socket.on('new-circle', (data) => {
    const user = users.get(userIdentifier);

    // 添加使用者資訊（創建副本）
    data.color = { ...user.color };
    data.userId = user.id;

    // 計算球體半徑
    if (Config.RANDOM_RADIUS) {
      const randomFactor = Config.RANDOM_RADIUS_RANGE[0] +
        Math.random() * (Config.RANDOM_RADIUS_RANGE[1] - Config.RANDOM_RADIUS_RANGE[0]);
      data.radius = Config.CIRCLE_RADIUS * randomFactor;
    } else {
      data.radius = Config.CIRCLE_RADIUS;
    }

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

  // 處理移除單個球
  socket.on('remove-circle', (data) => {
    const user = users.get(userIdentifier);
    // 只允許 master 或球的擁有者移除球
    const circle = user.circles.find(c => c.id === data.id);
    if (user.id === masterId || (circle && circle.userId === user.id)) {
      // 從所有使用者的 circles 中找到並移除該球
      for (const userData of users.values()) {
        const index = userData.circles.findIndex(c => c.id === data.id);
        if (index !== -1) {
          userData.circles.splice(index, 1);
          break;
        }
      }
      io.emit('circle-removed', { id: data.id });
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

  // 處理設定更新
  socket.on('update-config', (newConfig) => {
    xx('Received config update:', newConfig);
    // 更新伺服器端的設定
    Object.assign(Config, newConfig);
    // 廣播給所有客戶端
    io.emit('config-updated', Config);
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
