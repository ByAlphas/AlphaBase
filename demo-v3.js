const AlphaBase = require('./alpha');
const AlphaServer = require('./server');
const { JWTAuth, AuditLogger, DataIntegrity, RSAEncryption } = require('./security');

console.log('🚀 AlphaBase V3.0.0 Demo');
console.log('========================\n');

// 1. Basic Database with Security Features
console.log('1. Creating secure database...');
const db = new AlphaBase({
  filePath: './demo-db.json',
  password: 'demo-password',
  encryption: 'AES',
  jwtSecret: 'demo-jwt-secret',
  audit: { enabled: true, logFile: './demo-audit.log' },
  integrity: true,
  rsa: true
});

// 2. Basic Operations
console.log('2. Basic operations...');
db.setSync('user:1', { name: 'John Doe', email: 'john@example.com', role: 'admin' });
db.setSync('config:theme', 'dark');
db.setSync('temp:session', 'abc123', { ttl: 60 }); // 1 minute TTL

console.log('   User:', db.getSync('user:1'));
console.log('   Config:', db.getSync('config:theme'));
console.log('   Session:', db.getSync('temp:session'));

// 3. JWT Authentication Demo
console.log('\n3. JWT Authentication...');
const userPayload = { userId: 1, username: 'johndoe', role: 'admin' };
const token = db.createToken(userPayload, { expiresIn: '1h' });
console.log('   Token created:', token.substring(0, 50) + '...');

const verification = db.verifyToken(token);
console.log('   Token valid:', verification.valid);
console.log('   Payload:', verification.payload);

// 4. RSA Encryption Demo
console.log('\n4. RSA Encryption...');
const keyPair = db.generateRSAKeys();
console.log('   RSA keys generated');

const sensitiveData = 'This is sensitive information!';
const encrypted = db.rsaEncrypt(sensitiveData, keyPair.publicKey);
console.log('   Encrypted data:', encrypted.substring(0, 50) + '...');

const decrypted = db.rsaDecrypt(encrypted, keyPair.privateKey);
console.log('   Decrypted data:', decrypted);

// 5. Audit Logging Demo
console.log('\n5. Audit Logging...');
db.auditLog('user_login', 'user:1', 'johndoe', { ip: '192.168.1.100', userAgent: 'Demo-Client' });
db.auditLog('data_access', 'config:theme', 'johndoe', { action: 'read' });
db.auditLog('data_modify', 'user:1', 'johndoe', { action: 'update', field: 'email' });

const auditLogs = db.getAuditLogs({ limit: 5 });
console.log('   Recent audit logs:');
auditLogs.forEach(log => {
  console.log(`     ${log.timestamp}: ${log.operation} on ${log.key} by ${log.user}`);
});

// 6. Data Integrity Demo
console.log('\n6. Data Integrity...');
const testData = JSON.stringify({ test: 'data' });
const hash = db.dataIntegrity.generateHash(testData);
console.log('   Data hash:', hash);
console.log('   Verification:', db.dataIntegrity.verify(testData, hash));

// 7. Transaction Demo
console.log('\n7. Transactions...');
db.beginTransaction();
db.setSync('transaction:test1', 'value1');
db.setSync('transaction:test2', 'value2');
console.log('   Transaction data set (not committed)');
db.commit();
console.log('   Transaction committed');
console.log('   Value1:', db.getSync('transaction:test1'));
console.log('   Value2:', db.getSync('transaction:test2'));

// 8. Batch Operations Demo
console.log('\n8. Batch Operations...');
const batchOps = [
  { op: 'set', key: 'batch:1', value: 'First item' },
  { op: 'set', key: 'batch:2', value: 'Second item' },
  { op: 'set', key: 'batch:3', value: 'Third item' }
];
db.batchSync(batchOps);
console.log('   Batch operations completed');
console.log('   Batch items:', db.getSync('batch:1'), db.getSync('batch:2'), db.getSync('batch:3'));

// 9. Statistics
console.log('\n9. Database Statistics...');
const stats = db.statsSync();
console.log('   Total keys:', stats.totalKeys);
console.log('   File size:', stats.fileSize, 'bytes');
console.log('   Last modified:', stats.lastModified);
console.log('   Encryption:', stats.encryption);

// 10. HTTP Server Demo (commented out to avoid port conflicts)
console.log('\n10. HTTP Server Demo...');
console.log('   (Uncomment the code below to test the HTTP server)');

/*
const server = new AlphaServer({
  port: 3000,
  database: './demo-server-db.json',
  password: 'server-password',
  encryption: 'AES',
  jwtSecret: 'server-jwt-secret',
  auth: true,
  audit: true
});

server.start();
console.log('   Server started at http://localhost:3000');
console.log('   Available endpoints:');
console.log('     POST /auth/login - Login with {"username":"admin","password":"password123"}');
console.log('     GET  /api/{key} - Get value');
console.log('     POST /api/{key} - Set value with {"value":"..."}');
console.log('     GET  /health - Health check');
console.log('     GET  /stats - Database statistics');

// Stop server after 10 seconds
setTimeout(() => {
  server.stop();
  console.log('   Server stopped');
}, 10000);
*/

console.log('\n✅ AlphaBase V3.0.0 Demo completed!');
console.log('📁 Demo files created: demo-db.json, demo-audit.log');
console.log('🔧 Try the CLI: node cli.js -i');
console.log('🌐 Try the server: node cli.js server --port 3000');

// Cleanup (optional)
setTimeout(() => {
  const fs = require('fs');
  try {
    if (fs.existsSync('./demo-db.json')) fs.unlinkSync('./demo-db.json');
    if (fs.existsSync('./demo-audit.log')) fs.unlinkSync('./demo-audit.log');
    console.log('🧹 Demo files cleaned up');
  } catch (e) {
    console.log('Note: Demo files can be manually removed');
  }
}, 5000);
