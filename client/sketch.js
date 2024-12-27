import p5 from 'p5';
import { SocketManager } from './WebSocketManager';

export function setupCanvas() {
  new p5((p) => {
    const socketManager = new SocketManager();

    p.setup = () => {
      const canvas = p.createCanvas(800, 600);
      canvas.parent('canvas-container');
      p.background(200);
      p.noLoop();

      // 設定 WebSocket 訊息回調
      socketManager.setMessageCallback(() => {
        p.redraw();
      });

      // 連接 WebSocket
      socketManager.connect();
    };

    p.draw = () => {
      p.background(200);
      socketManager.getCircles().forEach(circle => {
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
      return false; // 防止預設的觸控行為
    };

    // 抽取共用的互動處理邏輯
    const handleInteraction = (x, y) => {
      if (x >= 0 && x <= p.width && y >= 0 && y <= p.height) {
        const data = {
          x: x,
          y: y,
          color: `rgb(${p.random(255)},${p.random(255)},${p.random(255)})`
        };
        socketManager.sendData(data);
      }
    };
  });
}
