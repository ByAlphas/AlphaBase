#!/usr/bin/env node
const AlphaBase = require('./index');
const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
const boxen = require('boxen');
const chalk = require('chalk');
const yargs = require('yargs');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

function getDbFiles() {
  return fs.readdirSync(process.cwd()).filter(f => f.endsWith('.json'));
}

const argv = yargs
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
  .help().argv;

let db = new AlphaBase({ filePath: path.resolve(argv.file), password: argv.password });

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
      choices: ['get', 'set', 'delete', 'has', 'clear', 'all', 'stats', 'import', 'export', 'backup', 'exit']
    });
    if (op === 'exit') break;
    let key = '';
    let value = '';
    let result;
    if (['get', 'set', 'delete', 'has'].includes(op)) {
      const keys = Object.keys(db.allSync());
      if (op !== 'set') {
        const ans = await inquirer.prompt({
          type: 'autocomplete',
          name: 'key',
          message: 'Anahtar:',
          source: (answersSoFar, input) => {
            input = input || '';
            return Promise.resolve(keys.filter(k => k.includes(input)));
          }
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
