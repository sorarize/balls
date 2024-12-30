import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import xx from './utils/xx.js';
import os from 'os';
import Config from './config/index.js';

// Set up __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? [
        process.env.RAILWAY_STATIC_URL
          ? `https://${process.env.RAILWAY_STATIC_URL}`
          : true,
      ]
      : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        `http://${getLocalIPs()[0]}:5173`,
      ],
    methods: ['GET', 'POST'],
    credentials: false,
    transports: ['polling', 'websocket'],
  },
});

// Store user information
const users = new Map(); // key: IP, value: { id, color, circles: [], behaviorCode: null }
// Track number of connections per IP
const connectionCounts = new Map(); // key: IP, value: number of connections
// Track the earliest connected socket
let masterSocket = null;
let masterId = null;
// Store all users' behaviors
const userBehaviorMap = new Map(); // key: userId, value: behaviorCode

// Generate random color
function generateRandomColor() {
  return {
    h: Math.random() * 360,
    s: Config.SATURATION,
    l: Config.LIGHTNESS,
  };
}

// Get client IP
function getClientIP(socket) {
  return socket.handshake.headers['x-forwarded-for'] ||
         socket.handshake.address;
}

// Generate unique ID when user connects
function generateUserId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Get user identifier
function getUserIdentifier(socket) {
  if (Config.USER_ID_MODE === 'session') {
    // In session mode, each connection is a new user
    xx('Using session as user identifier');
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  } else {
    xx('Using IP as user identifier');
    return getClientIP(socket);
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  const userIdentifier = getUserIdentifier(socket);
  xx('Client connected with identifier:', userIdentifier);

  // Update connection count
  connectionCounts.set(userIdentifier, (connectionCounts.get(userIdentifier) || 0) + 1);
  xx('Connection count for', userIdentifier, ':', connectionCounts.get(userIdentifier));

  // Check if user already exists
  if (!users.has(userIdentifier)) {
    const newUser = {
      id: generateUserId(),
      color: generateRandomColor(),
      circles: [],
      behaviorCode: null,
    };
    users.set(userIdentifier, newUser);
  }

  const user = users.get(userIdentifier);

  // Master selection logic: if no master exists, set current socket as master
  if (!masterSocket) {
    masterSocket = socket;
    masterId = user.id;
    xx('No master exists, setting current socket as master:', masterId);
  }

  // Send initial data, including user info and master status
  const isMaster = socket === masterSocket;
  xx('Sending init data to client:', userIdentifier, 'isMaster:', isMaster);

  // 如果是 master，將 behavior map 轉換為普通物件
  const userBehaviors = {};
  if (isMaster) {
    userBehaviorMap.forEach((code, userId) => {
      userBehaviors[userId] = code;
    });
  }

  socket.emit('init', {
    circles: Array.from(users.values()).flatMap(u => u.circles),
    userColor: user.color,
    userId: user.id,
    userCircles: user.circles,
    isMaster: isMaster,
    userBehaviors: isMaster ? userBehaviors : null,
  });

  // When user disconnects
  socket.on('disconnect', () => {
    xx('Client disconnected:', userIdentifier);
    const user = users.get(userIdentifier);

    // Update connection count
    const currentCount = connectionCounts.get(userIdentifier);
    const newCount = currentCount - 1;
    xx('Connection count for', userIdentifier, 'reduced to:', newCount);

    if (newCount <= 0) {
      // When no more connections, remove count and user data
      connectionCounts.delete(userIdentifier);
      io.emit('remove-user-circles', { userId: user.id });
      users.delete(userIdentifier);
    } else {
      // Other connections exist, update count
      connectionCounts.set(userIdentifier, newCount);
      xx('User still has', newCount, 'connections, keeping circles');
    }

    // If master socket disconnects, select new master
    if (socket === masterSocket) {
      xx('Master disconnected, selecting new master');
      // Select the earliest connection as new master
      const sockets = Array.from(io.sockets.sockets.values());
      if (sockets.length > 0) {
        try {
          // Try to select new master
          const selectNewMaster = () => {
            // In session mode, use the first available socket
            if (Config.USER_ID_MODE === 'session') {
              const newMasterSocket = sockets[0];
              // Iterate through all users to find corresponding user data
              for (const userData of users.values()) {
                masterSocket = newMasterSocket;
                masterId = userData.id;
                xx('New master selected in session mode:', masterId);
                masterSocket.emit('you-are-master', { masterId });
                io.emit('new-master', { masterId });
                return true;
              }
            } else {
              // Original logic for IP mode
              for (const potentialMaster of sockets) {
                try {
                  const identifier = getUserIdentifier(potentialMaster);
                  const user = users.get(identifier);
                  if (user) {
                    masterSocket = potentialMaster;
                    masterId = user.id;
                    xx('New master selected:', masterId);
                    masterSocket.emit('you-are-master', { masterId });
                    io.emit('new-master', { masterId });
                    return true;
                  }
                } catch (error) {
                  xx('Error selecting potential master:', error);
                  continue;
                }
              }
            }
            return false;
          };

          if (!selectNewMaster()) {
            xx('Failed to select any master from available sockets');
            masterSocket = null;
            masterId = null;
            io.emit('master-selection-failed');
          }
        } catch (error) {
          xx('Error during master transition:', error);
          masterSocket = null;
          masterId = null;
          io.emit('master-selection-failed');
        }
      } else {
        xx('No available sockets for new master');
        masterSocket = null;
        masterId = null;
        io.emit('master-selection-failed');
      }
    }
  });

  // Add position update event
  socket.on('positions-update', (data) => {
    // Only accept position updates from master
    if (user.id === masterId) {
      // xx('Received positions update from master:', userIdentifier);
      io.emit('positions-updated', data);
    } else {
      // xx('Ignored positions update from non-master client:', userIdentifier);
    }
  });

  // Handle new circle
  socket.on('new-circle', (data) => {
    const user = users.get(userIdentifier);

    // Add user information (create copy)
    data.color = { ...user.color };
    data.userId = user.id;

    // Calculate circle radius
    if (Config.RANDOM_RADIUS) {
      const randomFactor = Config.RANDOM_RADIUS_RANGE[0] +
        Math.random() * (Config.RANDOM_RADIUS_RANGE[1] - Config.RANDOM_RADIUS_RANGE[0]);
      data.radius = Config.CIRCLE_RADIUS * randomFactor;
    } else {
      data.radius = Config.CIRCLE_RADIUS;
    }

    if (user.circles.length >= Config.MAX_CIRCLES_PER_USER) {
      const oldCircle = user.circles.shift();
      data.id = oldCircle.id;
      user.circles.push(data);
      io.emit('update-circle', data);
    } else {
      data.id = Date.now() + Math.random();
      user.circles.push(data);
      io.emit('circle-added', data);
    }
  });

  // Handle circle removal
  socket.on('remove-circle', (data) => {
    const user = users.get(userIdentifier);
    // Only allow master or circle owner to remove circle
    const circle = user.circles.find(c => c.id === data.id);
    if (user.id === masterId || (circle && circle.userId === user.id)) {
      // Find and remove the circle from all users' circles
      for (const userData of users.values()) {
        const index = userData.circles.findIndex(c => c.id === data.id);
        if (index !== -1) {
          userData.circles.splice(index, 1);
          break;
        }
      }
      io.emit('circle-removed', { id: data.id });
    }
  });

  // Add clear handling
  socket.on('clear-all', () => {
    // Only accept clear command from master
    if (user.id === masterId) {
      xx('Clearing all circles from server (master request)');
      // Clear all users' circles
      for (const user of users.values()) {
        user.circles = [];
      }
      // Broadcast clear event to all clients
      io.emit('clear-all');
    } else {
      xx('Ignored clear-all request from non-master client');
    }
  });

  socket.on('set-behavior', (data) => {
    xx('Received behavior update from client:', userIdentifier);
    const user = users.get(userIdentifier);

    // Store in behavior map
    userBehaviorMap.set(user.id, data.code);

    // If master exists, send all behaviors to master
    if (masterSocket) {
      xx(userBehaviorMap);
      // 將 Map 轉換為普通物件
      const behaviorsObj = {};
      userBehaviorMap.forEach((code, userId) => {
        behaviorsObj[userId] = code;
      });

      masterSocket.emit('behavior-updated', {
        behaviors: behaviorsObj,
      });
    }
  });

  // Handle config updates
  socket.on('update-config', (newConfig) => {
    xx('Received config update:', newConfig);
    // Update server-side config
    Object.assign(Config, newConfig);
    // Broadcast to all clients
    io.emit('config-updated', Config);
  });
});

// Add this line near the beginning of the file to check deployment environment
xx('Current environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL,
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files
  app.use(express.static(join(__dirname, '../dist')));

  // Return index.html for all routes
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
} else {
  // Development route
  app.get('/', (req, res) => {
    res.send('Socket.IO Server Running');
  });
}

// Function to get local IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

// Development environment uses fixed port 3001
const PORT = process.env.NODE_ENV === 'production'
  ? (process.env.PORT || 3001)
  : 3001;

server.listen(PORT, () => {
  xx(`Server running on port ${PORT}`);
  xx('Environment:', process.env.NODE_ENV);

  // Display all available IP addresses
  const ips = getLocalIPs();
  xx('Available on:');
  xx(`  > Local:    http://localhost:${PORT}`);
  ips.forEach(ip => {
    xx(`  > Network:  http://${ip}:${PORT}`);
    xx(`  > WebSocket: ws://${ip}:${PORT}`);
  });
});
