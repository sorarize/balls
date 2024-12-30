import p5 from 'p5';
import { SocketManager } from './WebSocketManager';
import { Circle } from './Circle';
import xx from './xx';
import { Config } from './Config';

// 設定全域 p5
window.p5 = p5;

export function setupCanvas() {
  new p5((p) => {
    const socketManager = new SocketManager();
    let circles = [];
    let userColor = null;
    let userId = null;
    let userCircles = [];
    let customBehaviorTextarea;
    let applyButton;
    let isMaster = false;  // 添加 master 狀態
    let user = {
      id: null,
    };

    p.setup = () => {
      const canvas = p.createCanvas(800, 600);
      canvas.parent('canvas-container');
      p.background(200);
      p.colorMode(p.HSL, 360, 100, 100);

      // 設定除錯資訊的顯示狀態
      const debugInfo = document.getElementById('debug-info');
      if (debugInfo) {
        debugInfo.style.display = Config.DEBUG ? 'block' : 'none';
      }

      // 只在桌面版添加 textarea
      if (!('ontouchstart' in window)) {
        // 創建容器 div
        const container = p.createElement('div');
        container.class('behavior-container');
        container.parent('canvas-container');

        // 創建 textarea
        customBehaviorTextarea = p.createElement('textarea');
        customBehaviorTextarea.class('behavior-textarea');
        customBehaviorTextarea.parent(container);
        customBehaviorTextarea.value(
          `// 這是一個範例自定義行為
// 預設行為是球之間互相排斥
// 你可以修改這段程式碼來創造新的行為
function update(circle, others) {
  // 這裡寫入你的自定義行為
  // 例如：讓球旋轉、跳動、追逐等等

  // 如果不修改，會使用預設的排斥行為
  circle.defaultUpdate(others);
}`,
        );

        // 創建應用按鈕
        applyButton = p.createButton('應用自定義行為');
        applyButton.class('behavior-button');
        applyButton.parent(container);
        applyButton.mousePressed(() => {
          try {
            const behaviorCode = customBehaviorTextarea.value();
            xx('Sending behavior to server:', behaviorCode);
            socketManager.setCustomBehavior(behaviorCode);
            // 直接在本地應用行為
            applyBehaviorToCircles(behaviorCode, circles);
          } catch (error) {
            xx('Error sending behavior:', error);
          }
        });
      }

      // 更新除錯資訊
      function updateDebugInfo() {
        if (!Config.DEBUG) return;

        const masterStatus = document.getElementById('master-status');
        const userId = document.getElementById('user-id');

        if (masterStatus) {
          masterStatus.textContent = isMaster ? '主控端' : '從屬端';
          masterStatus.style.color = isMaster ? '#00ff00' : '#ffff00';
        }

        if (userId && user.id) {
          userId.textContent = user.id.substring(0, 8) + '...';
        }
      }

      socketManager.setMessageCallback((data) => {
        if (data.type === 'init') {
          circles = data.circles.map(c => Circle.fromJSON(c));
          userColor = data.userColor;
          userId = data.userId;
          userCircles = data.userCircles;
          isMaster = data.isMaster;
          user = {
            id: userId,
          };
          updateDebugInfo();
          xx('Initialized as', isMaster ? 'master' : 'slave', 'userId:', userId);

          // 如果是 master 且有行為代碼，立即應用
          if (isMaster && data.behaviorCode) {
            xx('Master applying initial behavior');
            applyBehaviorToCircles(data.behaviorCode, circles);
          }
        } else if (data.type === 'behavior-updated') {
          if (customBehaviorTextarea) {
            customBehaviorTextarea.value(data.code);
          }
          // 移除 isMaster 檢查，讓所有使用者都能應用行為
          applyBehaviorToCircles(data.code, circles);
        } else if (data.type === 'positions-updated') {
          // 非 master 接收位置更新
          if (!isMaster) {
            data.positions.forEach(pos => {
              const circle = circles.find(c => c.id === pos.id);
              if (circle) {
                circle.pos.x = pos.x;
                circle.pos.y = pos.y;
                circle.vel.x = pos.velX;
                circle.vel.y = pos.velY;
              }
            });
          }
        } else if (data.type === 'new-master') {
          isMaster = (data.masterId === userId);
          updateDebugInfo();
          xx('Master status changed to:', isMaster, 'userId:', userId);

          // 如果成為新的 master，需要應用當前的行為
          if (isMaster) {
            const currentBehavior = customBehaviorTextarea ? customBehaviorTextarea.value() : null;
            if (currentBehavior) {
              xx('New master applying current behavior');
              applyBehaviorToCircles(currentBehavior, circles);
            }
          }
        } else if (data.type === 'circle-added') {
          xx('Adding circle with color:', data.color);
          const circle = Circle.fromJSON(data);
          circles.push(circle);

          // 如果是自己的球，也要加入到 userCircles 並套用當前行為
          if (data.userId === userId) {
            if (userCircles.length >= Config.MAX_CIRCLES_PER_USER) {
              userCircles.shift();  // 移除最舊的
            }
            userCircles.push(data);

            // 如果是 master 且有自定義行為，立即套用到新球上
            if (isMaster && customBehaviorTextarea) {
              const currentBehavior = customBehaviorTextarea.value();
              if (currentBehavior) {
                xx('Applying current behavior to new circle');
                applyBehaviorToCircles(currentBehavior, [circle]);
              }
            }
          }
        } else if (data.type === 'update-circle') {
          const circle = circles.find(c => c.id === data.id);
          if (circle) {
            circle.updatePosition(data.x, data.y);

            // 如果是自己的球，也要更新 userCircles
            if (data.color.h === userColor.h) {
              const userCircle = userCircles.find(c => c.id === data.id);
              if (userCircle) {
                userCircle.x = data.x;
                userCircle.y = data.y;
              }
            }
          }
        } else if (data.type === 'clear-all') {
          circles = [];
          userCircles = [];
        } else if (data.type === 'remove-user-circles') {
          xx('Removing circles for user:', data.userId);
          // 移除指定用戶的所有球
          circles = circles.filter(circle => circle.userId !== data.userId);

          // 如果是自己的球，也要清空 userCircles
          if (data.userId === userId) {
            userCircles = [];
          }
        } else if (data.type === 'circle-removed') {
          // 處理單個球被移除的情況
          xx('Removing circle:', data.id);
          const index = circles.findIndex(c => c.id === data.id);
          if (index !== -1) {
            circles.splice(index, 1);
            // 如果是自己的球，也要從 userCircles 中移除
            const userCircleIndex = userCircles.findIndex(c => c.id === data.id);
            if (userCircleIndex !== -1) {
              userCircles.splice(userCircleIndex, 1);
            }
          }
        } else if (data.type === 'master-selection-failed') {
          xx('Master selection failed, waiting for new master selection');
          isMaster = false;
          updateDebugInfo();
        } else if (data.type === 'you-are-master') {
          xx('Received direct master confirmation');
          isMaster = (data.masterId === userId);
          updateDebugInfo();

          // 如果成為新的 master，需要應用當前的行為
          if (isMaster && customBehaviorTextarea) {
            const currentBehavior = customBehaviorTextarea.value();
            if (currentBehavior) {
              xx('New master applying current behavior');
              applyBehaviorToCircles(currentBehavior, circles);
            }
          }
        }
      });

      socketManager.connect();
    };

    p.draw = () => {
      p.background(200);

      if (isMaster) {
        // xx('Master updating positions');
        // master 進行計算並發送位置更新
        circles.forEach((circle, index) => {
          circle.update(circles, p);

          // 檢查球是否完全離開畫布（使用球的半徑）
          if (circle.pos.x + circle.radius < 0 ||
              circle.pos.x - circle.radius > p.width ||
              circle.pos.y + circle.radius < 0 ||
              circle.pos.y - circle.radius > p.height) {
            xx('Circle out of bounds, removing:', circle.id);
            circles.splice(index, 1);
            socketManager.sendData({
              type: 'remove-circle',
              id: circle.id,
            });
          }
        });

        // 發送位置更新給所有客戶端
        const positions = circles.map(circle => ({
          id: circle.id,
          x: circle.pos.x,
          y: circle.pos.y,
          velX: circle.vel.x,
          velY: circle.vel.y,
        }));

        if (positions.length > 0) {
          // xx('Master sending positions update for', positions.length, 'circles');
          socketManager.sendPositions(positions);
        }
      } else {
        // xx('Not master, waiting for updates');
      }

      // 所有客戶端都繪製
      circles.forEach(circle => {
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
        xx('Creating circle with color:', userColor);
        const circleData = {
          x,
          y,
          color: { ...userColor },
          minDist: Config.CIRCLE_MIN_DIST,
          id: Date.now() + Math.random(),
        };

        socketManager.sendData(circleData);
      }
    };

    p.keyPressed = () => {
      // 檢查是否有任何 textarea 或 input 被 focus
      const activeElement = document.activeElement;
      const isInputFocused = activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'INPUT' ||
        activeElement.isContentEditable;

      // 如果輸入元素被 focus 或不是 master，直接返回
      if (isInputFocused || !isMaster) {
        return true;
      }

      // 檢查是否按下 Ctrl + C
      if (p.keyCode === 67 && p.keyIsDown(p.CONTROL)) {  // 67 是 'C' 的 keyCode
        xx('Master requesting clear all circles (Ctrl + C)');
        socketManager.clearAll();
        return false;  // 防止默認行為
      }
    };

    // 創建一個共用的行為應用函數
    function applyBehaviorToCircles(code, circles) {
      try {
        const cleanCode = code
          .split('\n')
          .filter(line => !line.trim().startsWith('//'))
          .join('\n')
          .trim();

        const functionBody = cleanCode
          .replace(/^function\s+update\s*\([^)]*\)\s*{/, '')
          .replace(/}$/, '');

        const behaviorFunction = new Function('circle', 'others', 'p', functionBody);

        circles.forEach(circle => {
          if (circle.userId === userId) {
            xx('Setting behavior for circle:', circle.id);
            circle.setCustomUpdateBehavior((c, o, p) => behaviorFunction(c, o, p));
          }
        });

        return true;
      } catch (error) {
        xx('Error applying behavior:', error);
        return false;
      }
    }
  });
}
