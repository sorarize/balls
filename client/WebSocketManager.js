import xx from '../src/xx';

export class WebSocketManager {
  constructor() {
    this.ws = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.onMessageCallback = null;
    this.circles = [];
  }

  connect() {
    const wsUrl = import.meta.env.DEV
      ? `ws://localhost:3000`
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

    xx('Connecting to WebSocket URL:', wsUrl);

    this.connectWebSocket(wsUrl);
  }

  connectWebSocket(wsUrl) {
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      xx('WebSocket connected');
      this.retryCount = 0;
    };

    this.ws.onerror = (error) => {
      xx('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      xx('WebSocket disconnected');
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        xx(`Retrying connection... (${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.connectWebSocket(wsUrl), 1000);
      }
    };

    this.ws.onmessage = (event) => {
      xx('onmessage', event);
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          this.circles = data.circles;
        } else {
          this.circles.push(data);
        }
        if (this.onMessageCallback) {
          this.onMessageCallback();
        }
      } catch (error) {
        xx('Error parsing message:', error);
      }
    };
  }

  sendData(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.circles.push(data);
      this.ws.send(JSON.stringify(data));
      if (this.onMessageCallback) {
        this.onMessageCallback();
      }
      return true;
    }
    return false;
  }

  setMessageCallback(callback) {
    this.onMessageCallback = callback;
  }

  getCircles() {
    return this.circles;
  }
}
