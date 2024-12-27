import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import xx from './xx.js';

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
      ? true  // 或者改為你的 Railway 域名，例如 "https://your-app.up.railway.app"
      : ["http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: false,
    transports: ['polling', 'websocket']
  }
});

// 儲存所有圓形的陣列
const circles = [];

// Socket.IO 連接處理
io.on('connection', (socket) => {
  xx('Client connected');

  // 發送現有的圓形數據
  socket.emit('init', { circles });

  // 處理新的圓形
  socket.on('new-circle', (data) => {
    xx('New circle:', data);
    circles.push(data);
    // 廣播給其他客戶端
    socket.broadcast.emit('circle-added', data);
  });

  socket.on('disconnect', () => {
    xx('Client disconnected');
  });
});

// 在檔案開頭附近加入這行來檢查部署環境
xx('Current environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL
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

// 使用固定的端口
const PORT = 3001;  // 改為固定使用 3001
server.listen(PORT, () => {
  xx(`Server running on port ${PORT}`);
});

xx('NODE_ENV:', process.env.NODE_ENV);
