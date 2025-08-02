const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const AlphaBase = require('./alpha');
const { JWTAuth, AuditLogger } = require('./security');

/**
 * AlphaServer - Lightweight HTTP server for remote AlphaBase access
 * Simple REST API without heavy dependencies
 */
class AlphaServer {
  constructor(options = {}) {
    // Security: Require explicit permission to start server
    if (!options.allowServerStart) {
      throw new Error('Server start must be explicitly allowed with { allowServerStart: true } option for security.');
    }
    
    this.port = options.port || 3000;
    this.host = options.host || 'localhost';
    this.database = options.database || './alphabase-server.json';
    this.password = options.password || null;
    this.encryption = options.encryption || 'AES';
    
    // Initialize components
    this.db = new AlphaBase({
      filePath: this.database,
      password: this.password,
      encryption: this.encryption
    });
    
    this.jwtAuth = new JWTAuth(options.jwtSecret);
    this.auditLogger = new AuditLogger({
      enabled: options.audit !== false,
      logFile: options.auditFile || './alphabase-server-audit.log'
    });
    
    this.server = null;
    this.requireAuth = options.auth !== false; // Default: auth required
  }

  // Start the server
  start() {
    this.server = http.createServer((req, res) => {
      this._handleRequest(req, res);
    });

    this.server.listen(this.port, this.host, () => {
      console.log(`AlphaBase Server running at http://${this.host}:${this.port}`);
    });

    return this;
  }

  // Stop the server
  stop() {
    if (this.server) {
      this.server.close();
      console.log('AlphaBase Server stopped');
    }
  }

  // Handle HTTP requests
  async _handleRequest(req, res) {
    try {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;
      const query = parsedUrl.query;
      const method = req.method;

      // Get request body for POST/PUT
      const body = await this._getRequestBody(req);
      let bodyData = null;
      if (body) {
        try {
          bodyData = JSON.parse(body);
        } catch (e) {
          this._sendResponse(res, 400, { error: 'Invalid JSON' });
          return;
        }
      }

      // Authentication check
      const user = await this._authenticateRequest(req);
      if (this.requireAuth && !user) {
        this._sendResponse(res, 401, { error: 'Authentication required' });
        return;
      }

      // Route handling
      await this._routeRequest(req, res, {
        pathname,
        query,
        method,
        body: bodyData,
        user: user || 'anonymous'
      });

    } catch (error) {
      console.error('Server error:', error);
      this._sendResponse(res, 500, { error: 'Internal server error' });
    }
  }

  // Route requests to appropriate handlers
  async _routeRequest(req, res, context) {
    const { pathname, method, body, user, query } = context;

    // API routes
    if (pathname.startsWith('/api/')) {
      await this._handleApiRequest(req, res, context);
      return;
    }

    // Auth routes
    if (pathname === '/auth/login' && method === 'POST') {
      await this._handleLogin(res, body);
      return;
    }

    if (pathname === '/auth/verify' && method === 'POST') {
      await this._handleVerifyToken(res, body);
      return;
    }

    // Health check
    if (pathname === '/health') {
      this._sendResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    // Stats endpoint
    if (pathname === '/stats' && method === 'GET') {
      const stats = await this.db.stats();
      this._sendResponse(res, 200, stats);
      return;
    }

    // 404
    this._sendResponse(res, 404, { error: 'Not found' });
  }

  // Handle API requests (CRUD operations)
  async _handleApiRequest(req, res, context) {
    const { pathname, method, body, user, query } = context;
    const key = pathname.replace('/api/', '');

    try {
      switch (method) {
        case 'GET':
          if (!key) {
            // Get all keys
            const all = await this.db.all();
            this.auditLogger.log('get_all', '*', user, { ip: req.connection.remoteAddress });
            this._sendResponse(res, 200, all);
          } else {
            // Get specific key
            const value = await this.db.get(key);
            this.auditLogger.log('get', key, user, { ip: req.connection.remoteAddress });
            this._sendResponse(res, 200, { key, value });
          }
          break;

        case 'POST':
        case 'PUT':
          if (!key || !body || body.value === undefined) {
            this._sendResponse(res, 400, { error: 'Key and value required' });
            return;
          }
          
          const options = {};
          if (body.ttl) options.ttl = body.ttl;
          
          await this.db.set(key, body.value, options);
          this.auditLogger.log('set', key, user, { 
            ip: req.connection.remoteAddress,
            ttl: body.ttl 
          });
          this._sendResponse(res, 200, { success: true, key });
          break;

        case 'DELETE':
          if (!key) {
            this._sendResponse(res, 400, { error: 'Key required' });
            return;
          }
          
          await this.db.delete(key);
          this.auditLogger.log('delete', key, user, { ip: req.connection.remoteAddress });
          this._sendResponse(res, 200, { success: true, key });
          break;

        default:
          this._sendResponse(res, 405, { error: 'Method not allowed' });
      }
    } catch (error) {
      this.auditLogger.log('error', key || '*', user, { 
        ip: req.connection.remoteAddress,
        error: error.message 
      });
      this._sendResponse(res, 500, { error: error.message });
    }
  }

  // Handle login
  async _handleLogin(res, body) {
    if (!body || !body.username || !body.password) {
      this._sendResponse(res, 400, { error: 'Username and password required' });
      return;
    }

    // Simple authentication (in production, use proper user management)
    const validUsers = {
      admin: 'password123',  // Change this!
      user: 'userpass'
    };

    if (validUsers[body.username] === body.password) {
      const token = this.jwtAuth.createToken({ 
        username: body.username,
        role: body.username === 'admin' ? 'admin' : 'user'
      });
      
      this.auditLogger.log('login', body.username, body.username);
      this._sendResponse(res, 200, { token, username: body.username });
    } else {
      this.auditLogger.log('login_failed', body.username, 'anonymous');
      this._sendResponse(res, 401, { error: 'Invalid credentials' });
    }
  }

  // Handle token verification
  async _handleVerifyToken(res, body) {
    if (!body || !body.token) {
      this._sendResponse(res, 400, { error: 'Token required' });
      return;
    }

    const result = this.jwtAuth.verifyToken(body.token);
    this._sendResponse(res, result.valid ? 200 : 401, result);
  }

  // Authenticate request
  async _authenticateRequest(req) {
    if (!this.requireAuth) return { username: 'anonymous' };

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const result = this.jwtAuth.verifyToken(token);
    
    return result.valid ? result.payload : null;
  }

  // Get request body
  _getRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  // Send JSON response
  _sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }
}

module.exports = AlphaServer;
