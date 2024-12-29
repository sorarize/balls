import { io } from 'socket.io-client';
import xx from '../src/xx';

export class SocketManager {
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
        this.onMessageCallback({ type: 'init', circles: data.circles });
      }
    });

    this.socket.on('circle-added', (data) => {
      xx('Received new circle:', data);
      if (this.onMessageCallback) {
        this.onMessageCallback({ type: 'circle-added', ...data });
      }
    });
  }

  sendData(data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('new-circle', data);
      return true;
    }
    return false;
  }

  setMessageCallback(callback) {
    this.onMessageCallback = callback;
  }
}
