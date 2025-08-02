const AlphaServer = require('../server');
const AlphaBase = require('../alpha');
const http = require('http');
const path = require('path');
const fs = require('fs');

describe('AlphaServer Tests', () => {
  let server;
  let db;
  const testDbFile = path.join(__dirname, 'test-server.json');
  const port = 3001;

  beforeEach(() => {
    if (fs.existsSync(testDbFile)) {
      fs.unlinkSync(testDbFile);
    }
  });

  afterEach(async () => {
    if (server && server.server) {
      await new Promise(resolve => {
        server.server.close(resolve);
      });
    }
    
    if (db) {
      await db.close();
    }
    
    if (fs.existsSync(testDbFile)) {
      fs.unlinkSync(testDbFile);
    }
  });

  test('basic server test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should create server instance', () => {
    server = new AlphaServer({
      allowServerStart: true,
      port: port,
      database: testDbFile,
      auth: false
    });
    
    expect(server).toBeDefined();
    expect(server.port).toBe(port);
  });
});
