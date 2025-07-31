const AlphaBase = require('./alpha');
const AlphaBaseManager = require('./alpha').AlphaBaseManager || null;
const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
const boxen = require('boxen');
const chalk = require('chalk');
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
        console.log(chalk.red('Geçersiz JSON!'));
        continue;
      }
      await db.set(key, value);
      result = chalk.green('Set: ' + key);
    } else if (op === 'get') {
      result = db.getSync(key);
    } else if (op === 'delete') {
      await db.delete(key);
      result = chalk.yellow('Deleted: ' + key);
    } else if (op === 'has') {
      result = db.hasSync(key);
    } else if (op === 'clear') {
      await db.clear();
      result = chalk.red('Database cleared');
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
        console.log(chalk.red('Geçersiz JSON!'));
        continue;
      }
      db.importSync(value);
      result = chalk.green('Import successful');
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
        result = chalk.green('Encrypted export successful');
      } catch (e) {
        result = chalk.red('Export failed: ' + e.message);
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
        result = chalk.green('Encrypted import successful');
      } catch (e) {
        result = chalk.red('Import failed: ' + e.message);
      }
    } else if (op === 'begin') {
      db.beginTransaction();
      result = chalk.green('Transaction started');
    } else if (op === 'commit') {
      db.commit();
      result = chalk.green('Transaction committed');
    } else if (op === 'rollback') {
      db.rollback();
      result = chalk.yellow('Transaction rolled back');
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
        result = chalk.green('Batch transaction successful');
      } catch (e) {
        result = chalk.red('Transaction failed: ' + e.message);
      }
    } else if (op === 'start-cleanup') {
      const ans = await inquirer.prompt({
        type: 'input',
        name: 'interval',
        message: 'Cleanup interval (ms):',
        default: 60000
      });
      db.startScheduledCleanup(Number(ans.interval));
      result = chalk.green('Scheduled cleanup started');
    } else if (op === 'stop-cleanup') {
      db.stopScheduledCleanup();
      result = chalk.yellow('Scheduled cleanup stopped');
    } else if (op === 'db-list') {
      if (dbManager) {
        result = dbManager.list();
      } else {
        result = chalk.red('Multi-DB manager not available');
      }
    } else if (op === 'db-open') {
      if (dbManager) {
        const ans = await inquirer.prompt({
          type: 'input',
          name: 'file',
          message: 'DB file to open:'
        });
        dbManager.open(ans.file, { password: argv.password });
        result = chalk.green('DB opened: ' + ans.file);
      } else {
        result = chalk.red('Multi-DB manager not available');
      }
    } else if (op === 'db-close') {
      if (dbManager) {
        const ans = await inquirer.prompt({
          type: 'input',
          name: 'file',
          message: 'DB file to close:'
        });
        dbManager.close(ans.file);
        result = chalk.yellow('DB closed: ' + ans.file);
      } else {
        result = chalk.red('Multi-DB manager not available');
      }
    } else if (op === 'switch') {
      if (dbManager) {
        const ans = await inquirer.prompt({
          type: 'input',
          name: 'file',
          message: 'Switch to DB file:'
        });
        db = dbManager.get(ans.file) || new AlphaBase({ filePath: path.resolve(ans.file), password: argv.password });
        result = chalk.green('Switched to: ' + ans.file);
      } else {
        result = chalk.red('Multi-DB manager not available');
      }
      result = db.exportSync();
    } else if (op === 'backup') {
      const backupPath = await db.backup();
      result = chalk.green('Backup created: ' + backupPath);
    }
    if (result !== undefined) {
      let out;
      if (typeof result === 'object') {
        out = boxen(chalk.cyan(JSON.stringify(result, null, 2)), { padding: 1, borderColor: 'blue' });
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
    } else {
      yargs.showHelp();
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
