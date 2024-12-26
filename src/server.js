import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
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
const wss = new WebSocketServer({ server });

// 儲存所有圓形的陣列
const circles = [];

// WebSocket 連接處理
wss.on('connection', (ws) => {
  xx('Client connected');

  // 發送現有的圓形數據
  ws.send(JSON.stringify({
    type: 'init',
    circles: circles
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      xx('message', data);
      circles.push(data);

      // 廣播給其他客戶端
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    xx('Client disconnected');
  });
});

// 在生產環境中提供靜態檔案
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
    res.send('WebSocket 伺服器運行中');
  });
}

// 使用 Railway 提供的 PORT 環境變數
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  xx(`Server running on port ${PORT}`);
});
