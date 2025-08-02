const AlphaBase = require('./alpha');
const AlphaServer = require('./server');
const { JWTAuth, AuditLogger, RSAEncryption } = require('./security');
const AlphaBaseManager = require('./alpha').AlphaBaseManager || null;
const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
const boxen = require('boxen');
const yargs = require('yargs/yargs');


function getDbFiles() {
  return fs.readdirSync(process.cwd()).filter(f => f.endsWith('.json'));
}

const argv = yargs(process.argv.slice(2))
  .option('file', {
    alias: 'f',
    describe: 'Veritabanı dosya yolu',
    type: 'string',
    default: 'alphabase.json'
  })
  .option('password', {
    alias: 'p',
    describe: 'Veritabanı şifresi (şifreleme için)',
    type: 'string'
  })
  .option('interactive', {
    alias: 'i',
    describe: 'Etkileşimli mod',
    type: 'boolean',
    default: false
  })
  .help()
  .parse();

let db = new AlphaBase({ filePath: path.resolve(argv.file), password: argv.password });
let dbManager = AlphaBaseManager ? new AlphaBaseManager() : null;

async function runInteractive() {
  let dbFile = argv.file;
  let password = argv.password;
  while (true) {
    const files = getDbFiles();
    const { selectedFile } = await inquirer.prompt({
      type: 'list',
      name: 'selectedFile',
      message: 'Veritabanı dosyasını seçin:',
      choices: files,
      default: dbFile
    });
    dbFile = selectedFile;
    db = new AlphaBase({ filePath: path.resolve(dbFile), password });
    const { op } = await inquirer.prompt({
      type: 'list',
      name: 'op',
      message: 'İşlem seçin:',
      choices: [
        'get', 'set', 'delete', 'has', 'clear', 'all', 'stats', 'import', 'export', 'export-enc', 'import-enc',
        'backup', 'begin', 'commit', 'rollback', 'transaction', 'start-cleanup', 'stop-cleanup',
        'db-list', 'db-open', 'db-close', 'switch', 'exit']
    });
    if (op === 'exit') break;
    let key = '';
    let value = '';
    let result;
    if (['get', 'set', 'delete', 'has'].includes(op)) {
      const keys = Object.keys(db.allSync());
      if (op !== 'set') {
        const ans = await inquirer.prompt({
          type: 'list',
          name: 'key',
          message: 'Anahtar:',
          choices: keys
        });
        key = ans.key;
      } else {
        const ans = await inquirer.prompt({
          type: 'input',
          name: 'key',
          message: 'Anahtar (yeni veya mevcut):'
        });
        key = ans.key;
      }
    }
    if (op === 'set') {
      const ans = await inquirer.prompt({
        type: 'editor',
        name: 'value',
        message: 'Değer (JSON):'
      });
      try {
        value = JSON.parse(ans.value);
      } catch {
        console.log('Geçersiz JSON!');
        continue;
      }
      await db.set(key, value);
      result = 'Set: ' + key;
    } else if (op === 'get') {
      result = db.getSync(key);
    } else if (op === 'delete') {
      await db.delete(key);
      result = 'Deleted: ' + key;
    } else if (op === 'has') {
      result = db.hasSync(key);
    } else if (op === 'clear') {
      await db.clear();
      result = 'Database cleared';
    } else if (op === 'all') {
      result = db.allSync();
    } else if (op === 'stats') {
      result = db.statsSync();
    } else if (op === 'import') {
      const ans = await inquirer.prompt({
        type: 'editor',
        name: 'value',
        message: 'Import JSON:'
      });
      try {
        value = JSON.parse(ans.value);
      } catch {
        console.log('Geçersiz JSON!');
        continue;
      }
      db.importSync(value);
      result = 'Import successful';
    } else if (op === 'export') {
    } else if (op === 'export-enc') {
      // Export with encryption
      const ans = await inquirer.prompt({
        type: 'input',
        name: 'collection',
        message: 'Collection name:'
      });
      const fileAns = await inquirer.prompt({
        type: 'input',
        name: 'file',
        message: 'Output file path:'
      });
      try {
        db.exportCollection(ans.collection, fileAns.file, { encrypt: true });
        result = 'Encrypted export successful';
      } catch (e) {
        result = 'Export failed: ' + e.message;
      }
    } else if (op === 'import-enc') {
      // Import with auto-decrypt
      const ans = await inquirer.prompt({
        type: 'input',
        name: 'collection',
        message: 'Collection name:'
      });
      const fileAns = await inquirer.prompt({
        type: 'input',
        name: 'file',
        message: 'Input file path:'
      });
      try {
        db.importCollection(ans.collection, fileAns.file);
        result = 'Encrypted import successful';
      } catch (e) {
        result = 'Import failed: ' + e.message;
      }
    } else if (op === 'begin') {
      db.beginTransaction();
      result = 'Transaction started';
    } else if (op === 'commit') {
      db.commit();
      result = 'Transaction committed';
    } else if (op === 'rollback') {
      db.rollback();
      result = 'Transaction rolled back';
    } else if (op === 'transaction') {
      // Batch transaction
      const ans = await inquirer.prompt({
        type: 'editor',
        name: 'ops',
        message: 'Batch ops (JSON array):'
      });
      try {
        const ops = JSON.parse(ans.ops);
        db.transactionSync(ops);
        result = 'Batch transaction successful';
      } catch (e) {
        result = 'Transaction failed: ' + e.message;
      }
    } else if (op === 'start-cleanup') {
      const ans = await inquirer.prompt({
        type: 'input',
        name: 'interval',
        message: 'Cleanup interval (ms):',
        default: 60000
      });
      db.startScheduledCleanup(Number(ans.interval));
      result = 'Scheduled cleanup started';
    } else if (op === 'stop-cleanup') {
      db.stopScheduledCleanup();
      result = 'Scheduled cleanup stopped';
    } else if (op === 'db-list') {
      if (dbManager) {
        result = dbManager.list();
      } else {
        result = 'Multi-DB manager not available';
      }
    } else if (op === 'db-open') {
      if (dbManager) {
        const ans = await inquirer.prompt({
          type: 'input',
          name: 'file',
          message: 'DB file to open:'
        });
        dbManager.open(ans.file, { password: argv.password });
        result = 'DB opened: ' + ans.file;
      } else {
        result = 'Multi-DB manager not available';
      }
    } else if (op === 'db-close') {
      if (dbManager) {
        const ans = await inquirer.prompt({
          type: 'input',
          name: 'file',
          message: 'DB file to close:'
        });
        dbManager.close(ans.file);
        result = 'DB closed: ' + ans.file;
      } else {
        result = 'Multi-DB manager not available';
      }
    } else if (op === 'switch') {
      if (dbManager) {
        const ans = await inquirer.prompt({
          type: 'input',
          name: 'file',
          message: 'Switch to DB file:'
        });
        db = dbManager.get(ans.file) || new AlphaBase({ filePath: path.resolve(ans.file), password: argv.password });
        result = 'Switched to: ' + ans.file;
      } else {
        result = 'Multi-DB manager not available';
      }
      result = db.exportSync();
    } else if (op === 'backup') {
      const backupPath = await db.backup();
      result = 'Backup created: ' + backupPath;
    }
    if (result !== undefined) {
      let out;
      if (typeof result === 'object') {
        out = boxen(JSON.stringify(result, null, 2), { padding: 1, borderColor: 'blue' });
      } else {
        out = boxen(result.toString(), { padding: 1, borderColor: 'green' });
      }
      console.log(out);
    }
  }
}

(async () => {
  if (argv.interactive) {
    await runInteractive();
    return;
  }
  // ...eski non-interactive mod...
  const cmd = argv._[0];
  try {
    if (cmd === 'set') {
      await db.set(argv.key, JSON.parse(argv.value));
      console.log('Set:', argv.key);
    } else if (cmd === 'get') {
      console.log(await db.get(argv.key));
    } else if (cmd === 'delete') {
      await db.delete(argv.key);
      console.log('Deleted:', argv.key);
    } else if (cmd === 'has') {
      console.log(await db.has(argv.key));
    } else if (cmd === 'clear') {
      await db.clear();
      console.log('Database cleared');
    } else if (cmd === 'all') {
      console.log(await db.all());
    } else if (cmd === 'stats') {
      console.log(await db.stats());
    } else if (cmd === 'backup') {
      console.log('Backup:', await db.backup());
    } else if (cmd === 'export') {
      console.log(await db.export());
    } else if (cmd === 'list-files') {
      console.log(getDbFiles());
    } else if (cmd === 'switch') {
      db = new AlphaBase({ filePath: path.resolve(argv.file), password: argv.password });
      console.log('Switched to file:', argv.file);
    } else if (cmd === 'server') {
      // Security check: Require explicit --allow-server flag
      if (!argv.allowServer && !argv['allow-server']) {
        console.log('❌ Security: Server start requires explicit permission');
        console.log('💡 Add --allow-server flag to start the server:');
        console.log('   node cli.js server --allow-server --port 3000');
        console.log('   This prevents accidental server exposure.');
        return;
      }
      
      // Start HTTP server
      const serverOptions = {
        allowServerStart: true, // Internal permission flag
        port: argv.port || 3000,
        host: argv.host || 'localhost',
        database: argv.file,
        password: argv.password,
        encryption: argv.encryption || 'AES',
        jwtSecret: argv.jwtSecret || 'alphabase-secret',
        auth: argv.auth !== false,
        audit: argv.audit !== false
      };
      
      console.log('🔐 Starting AlphaBase Server with authentication...');
      console.log(`   Database: ${serverOptions.database}`);
      console.log(`   Auth: ${serverOptions.auth ? 'Enabled' : 'Disabled'}`);
      console.log(`   Audit: ${serverOptions.audit ? 'Enabled' : 'Disabled'}`);
      
      const server = new AlphaServer(serverOptions);
      server.start();
      console.log(`✅ AlphaBase Server started at http://${serverOptions.host}:${serverOptions.port}`);
      console.log('🛑 Press Ctrl+C to stop the server');
    } else if (cmd === 'token') {
      // JWT token operations
      if (argv.create) {
        const payload = JSON.parse(argv.payload || '{"user":"default"}');
        const token = db.createToken(payload);
        console.log('Token:', token);
      } else if (argv.verify && argv.token) {
        const result = db.verifyToken(argv.token);
        console.log('Verification result:', result);
      } else {
        console.log('Usage: --create --payload \'{"user":"name"}\' or --verify --token <token>');
      }
    } else if (cmd === 'rsa') {
      // RSA operations
      if (argv.generate) {
        const keys = db.generateRSAKeys();
        console.log('RSA Keys generated:');
        console.log('Public Key:', keys.publicKey);
        console.log('Private Key:', keys.privateKey);
      } else if (argv.encrypt && argv.data && argv.publicKey) {
        const encrypted = db.rsaEncrypt(argv.data, argv.publicKey);
        console.log('Encrypted:', encrypted);
      } else if (argv.decrypt && argv.data && argv.privateKey) {
        const decrypted = db.rsaDecrypt(argv.data, argv.privateKey);
        console.log('Decrypted:', decrypted);
      } else {
        console.log('Usage: --generate or --encrypt --data <data> --publicKey <key> or --decrypt --data <data> --privateKey <key>');
      }
    } else if (cmd === 'audit') {
      // Audit log operations
      if (argv.view) {
        const logs = db.getAuditLogs();
        console.log('Audit Logs:');
        logs.forEach(log => {
          console.log(`${log.timestamp} - ${log.operation} - ${log.key} - ${log.user}`);
        });
      } else {
        console.log('Usage: --view to show audit logs');
      }
    } else {
      yargs.showHelp();
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
