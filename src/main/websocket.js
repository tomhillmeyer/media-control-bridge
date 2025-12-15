const WebSocket = require('ws');
const logger = require('./utils/logger');

class WebSocketServer {
  constructor(mediaInterface, httpServer) {
    this.mediaInterface = mediaInterface;
    this.httpServer = httpServer;
    this.wss = null;
    this.clients = new Set();
  }

  start() {
    // Create WebSocket server that shares the HTTP server
    this.wss = new WebSocket.Server({
      server: this.httpServer.server,
      path: '/ws'
    });

    this.wss.on('connection', (ws) => {
      logger.info('New WebSocket client connected');
      this.clients.add(ws);

      // Send current state to newly connected client
      const status = this.mediaInterface.getFullStatus();
      this.sendToClient(ws, {
        event: 'connection_status',
        data: {
          connected: status.connected,
          appName: status.appName
        }
      });

      if (status.track) {
        this.sendToClient(ws, {
          event: 'track_changed',
          data: status.track
        });
      }

      if (status.connected) {
        this.sendToClient(ws, {
          event: 'playback_state_changed',
          data: {
            isPlaying: status.isPlaying,
            position: status.position
          }
        });
      }

      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket client error:', error);
        this.clients.delete(ws);
      });

      // Handle incoming messages (if needed in the future)
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          logger.debug('Received WebSocket message:', data);
          // Could handle commands here if needed
        } catch (error) {
          logger.error('Error parsing WebSocket message:', error);
        }
      });
    });

    // Subscribe to media events and broadcast to all clients
    this.setupMediaEventHandlers();

    logger.info('WebSocket server started on /ws');
  }

  setupMediaEventHandlers() {
    this.mediaInterface.on('track_changed', (data) => {
      this.broadcast({
        event: 'track_changed',
        data: data
      });
    });

    this.mediaInterface.on('playback_state_changed', (data) => {
      this.broadcast({
        event: 'playback_state_changed',
        data: data
      });
    });

    this.mediaInterface.on('media_connected', (data) => {
      this.broadcast({
        event: 'connection_status',
        data: {
          connected: true,
          appName: data.appName
        }
      });
    });

    this.mediaInterface.on('media_disconnected', (data) => {
      this.broadcast({
        event: 'connection_status',
        data: {
          connected: false
        }
      });
    });
  }

  broadcast(message) {
    const messageStr = JSON.stringify(message);
    let successCount = 0;
    let failCount = 0;

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
          successCount++;
        } catch (error) {
          logger.error('Error sending to WebSocket client:', error);
          failCount++;
        }
      }
    });

    if (successCount > 0) {
      logger.debug(`Broadcast to ${successCount} clients:`, message.event);
    }
  }

  sendToClient(client, message) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Error sending to WebSocket client:', error);
      }
    }
  }

  stop() {
    if (this.wss) {
      // Close all client connections
      this.clients.forEach((client) => {
        client.close();
      });
      this.clients.clear();

      // Close the server
      this.wss.close(() => {
        logger.info('WebSocket server stopped');
      });
    }
  }

  getClientCount() {
    return this.clients.size;
  }
}

module.exports = WebSocketServer;
