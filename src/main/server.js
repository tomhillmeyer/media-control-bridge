const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const config = require('./utils/config');

class HTTPServer {
  constructor(mediaInterface) {
    this.mediaInterface = mediaInterface;
    this.app = express();
    this.server = null;
    this.port = config.get('server.httpPort') || 6262;

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // GET /status - Get current media status
    this.app.get('/status', (req, res) => {
      try {
        const status = this.mediaInterface.getFullStatus();
        res.json(status);
      } catch (error) {
        logger.error('Error getting status:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // GET /track - Get current track info
    this.app.get('/track', (req, res) => {
      try {
        const trackInfo = this.mediaInterface.getTrackInfo();
        if (!trackInfo) {
          res.status(404).json({ error: 'No track currently playing' });
          return;
        }
        res.json(trackInfo);
      } catch (error) {
        logger.error('Error getting track:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // POST /play - Play
    this.app.post('/play', async (req, res) => {
      try {
        const result = await this.mediaInterface.play();
        res.json(result);
      } catch (error) {
        logger.error('Error playing:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // POST /pause - Pause
    this.app.post('/pause', async (req, res) => {
      try {
        const result = await this.mediaInterface.pause();
        res.json(result);
      } catch (error) {
        logger.error('Error pausing:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // POST /toggle - Toggle play/pause
    this.app.post('/toggle', async (req, res) => {
      try {
        const result = await this.mediaInterface.toggle();
        res.json(result);
      } catch (error) {
        logger.error('Error toggling:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // POST /next - Next track
    this.app.post('/next', async (req, res) => {
      try {
        const result = await this.mediaInterface.next();
        res.json(result);
      } catch (error) {
        logger.error('Error going to next track:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // POST /previous - Previous track
    this.app.post('/previous', async (req, res) => {
      try {
        const result = await this.mediaInterface.previous();
        res.json(result);
      } catch (error) {
        logger.error('Error going to previous track:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.info(`HTTP server listening on port ${this.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`Port ${this.port} is already in use`);
            reject(new Error(`Port ${this.port} is already in use`));
          } else {
            logger.error('Server error:', error);
            reject(error);
          }
        });
      } catch (error) {
        logger.error('Error starting HTTP server:', error);
        reject(error);
      }
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getPort() {
    return this.port;
  }
}

module.exports = HTTPServer;
