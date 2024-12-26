import p5 from 'p5';
import xx from '../src/xx';

export function setupCanvas() {
  new p5((p) => {
    let ws;
    let circles = [];

    p.setup = () => {
      const canvas = p.createCanvas(800, 600);
      canvas.parent('canvas-container');
      p.background(255);
      p.noLoop();

      // 建立 WebSocket 連接
      const wsUrl = import.meta.env.DEV
        ? `ws://${window.location.hostname}:3001`  // 開發環境
        : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;  // 生產環境

      xx('Connecting to WebSocket URL:', wsUrl); // 添加日誌來檢查 URL

      // 添加更多的錯誤處理和重試邏輯
      let retryCount = 0;
      const maxRetries = 5;

      const connectWebSocket = () => {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          xx('WebSocket connected');
          retryCount = 0;
        };

        ws.onerror = (error) => {
          xx('WebSocket error:', error);
        };

        ws.onclose = () => {
          xx('WebSocket disconnected');
          if (retryCount < maxRetries) {
            retryCount++;
            xx(`Retrying connection... (${retryCount}/${maxRetries})`);
            setTimeout(connectWebSocket, 1000);
          }
        };

        ws.onmessage = (event) => {
          xx('onmessage', event);
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'init') {
              circles = data.circles;
            } else {
              circles.push(data);
            }
            p.redraw();
          } catch (error) {
            xx('Error parsing message:', error);
          }
        };
      };

      connectWebSocket();
    };

    p.draw = () => {
      p.background(200);
      circles.forEach(circle => {
        p.fill(circle.color);
        p.noStroke();
        p.ellipse(circle.x, circle.y, 20, 20);
      });
    };

    p.mousePressed = () => {
      handleInteraction(p.mouseX, p.mouseY);
    };

    p.touchStarted = () => {
      handleInteraction(p.touches[0].x, p.touches[0].y);
      return false; // 防止預設的觸控行為（如滾動）
    };

    // 抽取共用的互動處理邏輯
    const handleInteraction = (x, y) => {
      if (ws && ws.readyState === WebSocket.OPEN &&
          x >= 0 && x <= p.width &&
          y >= 0 && y <= p.height) {
        const data = {
          x: x,
          y: y,
          color: `rgb(${p.random(255)},${p.random(255)},${p.random(255)})`
        };
        // 先更新自己的畫面
        circles.push(data);
        p.redraw();

        // 再發送給其他客戶端
        ws.send(JSON.stringify(data));
      }
    };
  });
}
