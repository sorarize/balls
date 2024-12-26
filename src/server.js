const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dotenv = require('dotenv');

// 載入環境變數
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 添加靜態檔案服務
app.use(express.static('public'));

// 儲存所有圓形的陣列
const allCircles = [];

// WebSocket 連接處理
wss.on('connection', (ws) => {
    // 立即發送初始化數據
    ws.send(JSON.stringify({
        type: 'init',
        circles: allCircles
    }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        allCircles.push(data);

        // 使用更高效的廣播方式
        const updateMessage = JSON.stringify({
            type: 'update',
            circle: data
        });

        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(updateMessage);
            }
        });
    });

    ws.on('close', () => {
        console.log('客戶端斷開連接');
    });
});

// 基本的 HTTP 路由
app.get('/', (req, res) => {
    res.send('WebSocket 伺服器運行中');
});

// 使用 Railway 提供的 PORT 環境變數，如果沒有則使用 3000
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`WebSocket server is running on port ${port}`);
});
