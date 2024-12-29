import { io } from 'socket.io-client';
import xx from '../src/xx';

export class SocketManager {
  constructor() {
    this.socket = null;
    this.onMessageCallback = null;
    this.circles = [];
  }

  connect() {
    const serverUrl = import.meta.env.DEV
      ? 'http://localhost:3001'
      : window.location.origin;

    xx('Connecting to Socket.IO server:', serverUrl);

    this.socket = io(serverUrl, {
      withCredentials: false,
      transports: ['polling', 'websocket'],
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
      this.circles = data.circles;
      this.triggerCallback();
    });

    this.socket.on('circle-added', (data) => {
      xx('Received new circle:', data);
      this.circles.push(data);
      this.triggerCallback();
    });
  }

  sendData(data) {
    if (this.socket && this.socket.connected) {
      this.circles.push(data);
      this.socket.emit('new-circle', data);
      this.triggerCallback();
      return true;
    }
    return false;
  }

  triggerCallback() {
    if (this.onMessageCallback) {
      this.onMessageCallback();
    }
  }

  setMessageCallback(callback) {
    this.onMessageCallback = callback;
  }

  getCircles() {
    return this.circles;
  }
}
