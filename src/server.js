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
    // 當新客戶端連接時，發送所有現有的圓形資料
    ws.send(JSON.stringify({
        type: 'init',
        circles: allCircles
    }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        // 將新的圓形加入儲存陣列
        allCircles.push(data);

        // 廣播給所有客戶端
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'update',
                    circle: data
                }));
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器運行在 port ${PORT}`);
});
