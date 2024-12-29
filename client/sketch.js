import p5 from 'p5';
import { SocketManager } from './WebSocketManager';
import { Circle } from './Circle';

export function setupCanvas() {
  new p5((p) => {
    const socketManager = new SocketManager();
    let circles = [];

    p.setup = () => {
      const canvas = p.createCanvas(800, 600);
      canvas.parent('canvas-container');
      p.background(200);

      // 設定 WebSocket 訊息回調
      socketManager.setMessageCallback((data) => {
        if (data.type === 'init') {
          // 將接收到的數據轉換為 Circle 實例
          circles = data.circles.map(c => Circle.fromJSON(c));
        } else if (data.type === 'circle-added') {
          circles.push(Circle.fromJSON(data));
        }
      });

      // 連接 WebSocket
      socketManager.connect();
    };

    p.draw = () => {
      p.background(200);

      // 更新所有圓形的位置
      circles.forEach(circle => {
        circle.update(circles);
        circle.draw(p);
      });
    };

    p.mousePressed = () => {
      handleInteraction(p.mouseX, p.mouseY);
    };

    p.touchStarted = () => {
      handleInteraction(p.touches[0].x, p.touches[0].y);
      return false;
    };

    const handleInteraction = (x, y) => {
      if (x >= 0 && x <= p.width && y >= 0 && y <= p.height) {
        const circle = new Circle(
          x,
          y,
          `rgb(${p.random(255)},${p.random(255)},${p.random(255)})`,
          50  // minDist
        );

        // 先添加到本地
        circles.push(circle);
        // 再發送到伺服器
        socketManager.sendData(circle.toJSON());
      }
    };
  });
}
