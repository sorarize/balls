import p5 from 'p5';
import { socketManager } from './WebSocketManager';
import { Circle } from './Circle';
import xx from '@utils/xx';
import Config from '@config/index';
import { CodeEditor } from './components/CodeEditor';
import { PRESET_BEHAVIORS } from '@config/presetBehaviors';

// Set global p5
window.p5 = p5;

const DEFAULT_CODE = PRESET_BEHAVIORS['Default Repulsion'];

export function setupCanvas() {
  new p5((p) => {
    let circles = [];
    let userColor = null;
    let userId = null;
    let userCircles = [];
    let currentCode = DEFAULT_CODE;
    let applyButton;
    let isMaster = false;
    let user = {
      id: null,
    };
    let behaviorMap = new Map();
    let editor = null;

    p.setup = () => {
      const parent = document.getElementById('canvas-container');

      // 根據螢幕大小調整 canvas 尺寸
      let canvasWidth = 600;
      let canvasHeight = 800;

      const canvas = p.createCanvas(canvasWidth, canvasHeight);
      canvas.parent(parent);
      p.background(200);
      p.colorMode(p.HSL, 360, 100, 100);

      // Set debug info display state
      const debugInfo = document.getElementById('debug-info');
      if (debugInfo) {
        debugInfo.style.display = Config.DEBUG ? 'block' : 'none';
      }

      // Create container div
      const container = document.createElement('div');
      container.className = 'behavior-container';
      document.getElementById('canvas-container').appendChild(container);

      const isMobile = 'ontouchstart' in window;

      // Create editor container (desktop only)
      if (!isMobile) {
        const editorContainer = document.createElement('div');
        editorContainer.className = 'editor-container';
        container.appendChild(editorContainer);
      }

      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'button-container';
      container.appendChild(buttonContainer);

      // Create preset select
      const presetSelect = document.createElement('select');
      presetSelect.className = 'preset-select';
      Object.keys(PRESET_BEHAVIORS).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        presetSelect.appendChild(option);
      });
      presetSelect.addEventListener('change', () => {
        const selectedBehavior = PRESET_BEHAVIORS[presetSelect.value];
        if (!isMobile && editor) {
          editor.setValue(selectedBehavior);
        }
        currentCode = selectedBehavior;

        socketManager.setCustomBehavior(currentCode);
      });
      buttonContainer.appendChild(presetSelect);

      // Create editor instance (desktop only)
      if (!isMobile) {
        editor = new CodeEditor({
          value: currentCode,
          onChange: (value) => {
            currentCode = value;
          },
          onApply: () => {
            try {
              xx('Sending behavior to server:', currentCode);
              socketManager.setCustomBehavior(currentCode);
              // Apply behavior locally
              applyBehaviorToCircles(currentCode, circles);
            } catch (error) {
              xx('Error sending behavior:', error);
            }
          }
        });
        editor.mount(document.querySelector('.editor-container'));
      }

      // Create apply button
      const buttonText = isMobile ?
        'Apply Selected Behavior' :
        'Apply Custom Behavior (Ctrl/Cmd + Enter)';

      applyButton = p.createButton(buttonText);
      applyButton.class('behavior-button');
      applyButton.parent(buttonContainer);

      // 獲取按鈕的 DOM 元素
      const buttonElement = applyButton.elt;

      // 添加點擊和觸控事件
      const handleApply = () => {
        try {
          xx('Sending behavior to server:', currentCode);
          socketManager.setCustomBehavior(currentCode);
          // Apply behavior locally
          applyBehaviorToCircles(currentCode, circles);
        } catch (error) {
          xx('Error sending behavior:', error);
        }
      };

      buttonElement.addEventListener('click', handleApply);
      buttonElement.addEventListener('touchend', (e) => {
        e.preventDefault();  // 防止觸發點擊事件
        handleApply();
      });

      // Update debug info
      function updateDebugInfo() {
        if (!Config.DEBUG) return;

        const masterStatus = document.getElementById('master-status');
        const userId = document.getElementById('user-id');

        if (masterStatus) {
          masterStatus.textContent = isMaster ? 'Master' : 'Slave';
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
        } else if (data.type === 'behavior-updated') {
          // Only master needs to handle behavior updates
          if (isMaster && data.behaviors) {
            // Update behaviorMap
            behaviorMap = new Map(Object.entries(data.behaviors));

            Object.entries(data.behaviors).forEach(([userId, behaviorCode]) => {
              const userCircles = circles.filter(circle => circle.userId === userId);
              if (behaviorCode) {
                applyBehaviorToCircles(behaviorCode, userCircles);
              } else {
                // If no behavior, use default update
                userCircles.forEach(circle => {
                  circle.setCustomUpdateBehavior(null);
                });
              }
            });
          }
        } else if (data.type === 'positions-updated') {
          // Non-master receives position updates
          if (!isMaster) {
            data.positions.forEach(pos => {
              const circle = circles.find(c => c.id === pos.id);
              if (circle) {
                circle.pos.x = pos.x;
                circle.pos.y = pos.y;
                circle.vel.x = pos.velX;
                circle.vel.y = pos.velY;
                if (pos.radius !== undefined) {
                  circle.radius = pos.radius;
                }
                if (pos.color !== undefined) {
                  circle.color = pos.color;
                }
              }
            });
          }
        } else if (data.type === 'new-master') {
          isMaster = (data.masterId === userId);
          updateDebugInfo();
          xx('Master status changed to:', isMaster, 'userId:', userId);

          // If becoming new master, need to apply current behavior
          if (isMaster) {
            const currentBehavior = currentCode;
            if (currentBehavior) {
              xx('New master applying current behavior');
              applyBehaviorToCircles(currentBehavior, circles);
            }
          }
        } else if (data.type === 'circle-added') {
          xx('Adding circle with color:', data.color);
          const circle = Circle.fromJSON(data);
          circles.push(circle);

          // If it's own circle, also add to userCircles
          if (data.userId === userId) {
            if (userCircles.length >= Config.MAX_CIRCLES_PER_USER) {
              userCircles.shift();  // Remove oldest
            }
            userCircles.push(data);
          }

          // Master needs to apply the user's behavior if any
          if (isMaster) {
            const userBehavior = behaviorMap.get(data.userId);
            if (userBehavior) {
              xx('Master applying user behavior to new circle');
              applyBehaviorToCircles(userBehavior, [circle]);
            }
          }
        } else if (data.type === 'update-circle') {
          const circle = circles.find(c => c.id === data.id);
          if (circle) {
            circle.updatePosition(data.x, data.y);

            // If it's own circle, also update userCircles
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
          // Remove all circles for specified user
          circles = circles.filter(circle => circle.userId !== data.userId);

          // If own circles, also clear userCircles
          if (data.userId === userId) {
            userCircles = [];
          }
        } else if (data.type === 'circle-removed') {
          // Handle single circle removal
          xx('Removing circle:', data.id);
          const index = circles.findIndex(c => c.id === data.id);
          if (index !== -1) {
            circles.splice(index, 1);
            // If own circle, also remove from userCircles
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

          // If becoming new master, need to apply current behavior
          if (isMaster && currentCode) {
            xx('New master applying current behavior');
            applyBehaviorToCircles(currentCode, circles);
          }
        }
      });

      socketManager.connect();
    };

    p.draw = () => {
      p.background(200);

      if (isMaster) {
        // Master updates positions and sends updates
        circles.forEach((circle, index) => {
          circle.update(circles, p);

          // Check if circle is completely outside canvas (using circle's radius)
          if (circle.pos.x + circle.radius < 0 ||
              circle.pos.x - circle.radius > p.width ||
              circle.pos.y + circle.radius < 0 ||
              circle.pos.y - circle.radius > p.height) {
            xx('Circle out of bounds, removing:', circle.id);
            circles.splice(index, 1);
            socketManager.removeCircle(circle.id);
          }
        });

        // Send position updates to all clients
        const positions = circles.map(circle => ({
          id: circle.id,
          x: circle.pos.x,
          y: circle.pos.y,
          velX: circle.vel.x,
          velY: circle.vel.y,
          radius: circle.radius,
          color: circle.color
        }));

        if (positions.length > 0) {
          socketManager.sendPositions(positions);
        }
      }

      // All clients draw
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

        socketManager.addCircle(circleData);
      }
    };

    p.keyPressed = () => {
      // Check if any textarea or input is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'INPUT' ||
        activeElement.isContentEditable;

      // If input element is focused or not master, return directly
      if (isInputFocused || !isMaster) {
        return true;
      }

      // Check if Ctrl + C is pressed
      if (p.keyCode === 67 && p.keyIsDown(p.CONTROL)) {  // 67 is keyCode for 'C'
        xx('Master requesting clear all circles (Ctrl + C)');
        socketManager.clearAll();
        return false;  // Prevent default behavior
      }
    };

    // Create a shared behavior application function
    function applyBehaviorToCircles(code, circles) {
      try {
        const cleanCode = code
          .split('\n')
          .filter(line => !line.trim().startsWith('//'))
          .join('\n')
          .trim();

        const functionBody = cleanCode
          .replace(/^function\s*(?:\w+\s*)?\s*\([^)]*\)\s*{/, '')
          .replace(/}$/, '');

        const behaviorFunction = new Function('circle', 'others', 'p', functionBody);

        circles.forEach(circle => {
          xx('Setting behavior for circle:', circle.id);
          circle.setCustomUpdateBehavior((c, o, p) => behaviorFunction(c, o, p));
        });

        return true;
      } catch (error) {
        xx('Error applying behavior:', error);
        return false;
      }
    }
  });
}
