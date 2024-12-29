import p5 from 'p5';
import { SocketManager } from './WebSocketManager';
import { Circle } from './Circle';

export function setupCanvas() {
  new p5((p) => {
    const socketManager = new SocketManager();
    let circles = [];
    let userColor = null;
    let userCircles = [];

    p.setup = () => {
      const canvas = p.createCanvas(800, 600);
      canvas.parent('canvas-container');
      p.background(200);
      p.colorMode(p.HSL, 360, 100, 100);

      socketManager.setMessageCallback((data) => {
        if (data.type === 'init') {
          circles = data.circles.map(c => Circle.fromJSON(c));
          userColor = data.userColor;
          userCircles = data.userCircles;
          console.log('Received user color:', data.userColor);
        } else if (data.type === 'circle-added') {
          console.log('Adding circle with color:', data.color);
          circles.push(Circle.fromJSON(data));
        } else if (data.type === 'update-circle') {
          const circle = circles.find(c => c.id === data.id);
          if (circle) {
            circle.updatePosition(data.x, data.y);
          }
        }
      });

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
      if (x >= 0 && x <= p.width && y >= 0 && y <= p.height && userColor) {
        console.log('Creating circle with color:', userColor);
        const circle = new Circle(
          x,
          y,
          { ...userColor },
          50
        );

        // 在本地也處理 10 個球的限制
        if (userCircles.length >= 10) {
          // 找到並更新最舊的圓形
          const oldCircle = userCircles[0];
          const existingCircle = circles.find(c => c.id === oldCircle.id);
          if (existingCircle) {
            existingCircle.updatePosition(x, y);
            // 更新 userCircles 中的位置
            oldCircle.x = x;
            oldCircle.y = y;
          }
        } else {
          circles.push(circle);
          userCircles.push(circle.toJSON());
        }

        socketManager.sendData(circle.toJSON());
      }
    };
  });
}
