import { io } from 'socket.io-client';
import xx from '@utils/xx';

class SocketManager {
  constructor() {
    this.socket = null;
    this.onMessageCallback = null;
  }

  connect() {
    const serverUrl = import.meta.env.DEV
      ? `ws://${window.location.hostname}:3001`
      : window.location.origin;

    xx('Connecting to Socket.IO server:', serverUrl);

    this.socket = io(serverUrl, {
      withCredentials: false,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      forceNew: true,
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      xx('Socket.IO connected');
    });

    this.socket.on('disconnect', () => {
      xx('Socket.IO disconnected');
    });

    this.socket.on('connect_error', (error) => {
      xx('Connection error:', error);
    });

    this.socket.on('init', (data) => {
      xx('Received initial data:', data);
      if (this.onMessageCallback) {
        this.onMessageCallback({
          type: 'init',
          circles: data.circles,
          userColor: data.userColor,
          userId: data.userId,
          userCircles: data.userCircles,
          behaviorCode: data.behaviorCode,
          isMaster: data.isMaster,
        });
      }
    });

    this.socket.on('circle-added', (data) => {
      xx('Received new circle:', data);
      if (this.onMessageCallback) {
        this.onMessageCallback({ type: 'circle-added', ...data });
      }
    });

    this.socket.on('remove-circle', (data) => {
      xx('Circle removed:', data);
      if (this.onMessageCallback) {
        this.onMessageCallback({ type: 'remove-circle', ...data });
      }
    });

    this.socket.on('update-circle', (data) => {
      xx('Circle updated:', data);
      if (this.onMessageCallback) {
        this.onMessageCallback({
          type: 'update-circle',
          ...data,
        });
      }
    });

    this.socket.on('clear-all', () => {
      xx('Clearing all circles');
      if (this.onMessageCallback) {
        this.onMessageCallback({ type: 'clear-all' });
      }
    });

    this.socket.on('behavior-updated', (data) => {
      xx('Received behavior update:', data);
      if (this.onMessageCallback) {
        this.onMessageCallback({ type: 'behavior-updated', behaviors: data.behaviors });
      }
    });

    this.socket.on('positions-updated', (data) => {
      // xx('Received positions update for', data.positions.length, 'circles');
      if (this.onMessageCallback) {
        this.onMessageCallback({ type: 'positions-updated', ...data });
      }
    });

    this.socket.on('new-master', (data) => {
      if (this.onMessageCallback) {
        this.onMessageCallback({ type: 'new-master', ...data });
      }
    });

    this.socket.on('remove-user-circles', (data) => {
      xx('Removing circles for user:', data.userId);
      if (this.onMessageCallback) {
        this.onMessageCallback({ type: 'remove-user-circles', userId: data.userId });
      }
    });

    this.socket.on('master-selection-failed', () => {
      xx('Master selection failed');
      if (this.onMessageCallback) {
        this.onMessageCallback({ type: 'master-selection-failed' });
      }
    });

    this.socket.on('you-are-master', (data) => {
      xx('Received you-are-master event:', data);
      if (this.onMessageCallback) {
        this.onMessageCallback({ type: 'you-are-master', masterId: data.masterId });
      }
    });

    this.socket.on('config-updated', (config) => {
      xx('Received config update from server:', config);
      if (this.onMessageCallback) {
        this.onMessageCallback({ type: 'config-updated', config });
      }
    });
  }

  addCircle(circleData) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('new-circle', circleData);
      return true;
    }
    return false;
  }

  setMessageCallback(callback) {
    this.onMessageCallback = callback;
  }

  clearAll() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('clear-all');
      return true;
    }
    return false;
  }

  setCustomBehavior(behaviorCode) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('set-behavior', { code: behaviorCode });
      return true;
    }
    return false;
  }

  sendPositions(positions) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('positions-update', { positions });
      return true;
    }
    return false;
  }

  updateConfig(config) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('update-config', config );
      return true;
    }
    return false;
  }

  removeCircle(circleId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('remove-circle', { id: circleId });
      return true;
    }
    return false;
  }
}

// 創建並導出單一實例
export const socketManager = new SocketManager();
