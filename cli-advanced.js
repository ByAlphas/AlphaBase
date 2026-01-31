#!/usr/bin/env node

const { AlphaBase } = require('./alpha');
const path = require('path');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// CLI Configuration
const cli = yargs(hideBin(process.argv))
  .scriptName('alphabase')
  .usage('$0 <command> [options]')
  .version('4.0.0')
  .demandCommand(1, 'You must specify a command')
  .help()
  .alias('h', 'help')
  .alias('v', 'version');

// Init Command - Initialize new database
cli.command(
  'init [file]',
  'Create a new AlphaBase database',
  (yargs) => {
    return yargs
      .positional('file', {
        describe: 'Database file name',
        default: 'alphabase.json',
        type: 'string'
      })
      .option('encrypt', {
        alias: 'e',
        describe: 'Enable encryption',
        type: 'boolean',
        default: false
      })
      .option('password', {
        alias: 'p',
        describe: 'Encryption password',
        type: 'string'
      })
      .option('ttl', {
        alias: 't',
        describe: 'Default TTL (ms)',
        type: 'number'
      });
  },
  (argv) => {
    const filePath = path.resolve(argv.file);
    
    if (fs.existsSync(filePath)) {
      console.error(`❌ Error: ${filePath} already exists!`);
      process.exit(1);
    }

    const options = {
      filePath,
      autoSave: true,
      encryption: argv.encrypt ? {
        enabled: true,
        key: argv.password
      } : undefined,
      ttl: argv.ttl ? { defaultTTL: argv.ttl } : undefined
    };

    try {
      const db = new AlphaBase(options);
      console.log(`✅ Database created: ${filePath}`);
      console.log(`   Encryption: ${argv.encrypt ? '✓ Enabled' : '✗ Disabled'}`);
      if (argv.ttl) {
        console.log(`   Default TTL: ${argv.ttl}ms`);
      }
    } catch (error) {
      console.error(`❌ Hata: ${error.message}`);
      process.exit(1);
    }
  }
);

// Backup Command - Create backup
cli.command(
  'backup <file>',
  'Create a backup from database',
  (yargs) => {
    return yargs
      .positional('file', {
        describe: 'Database file',
        type: 'string'
      })
      .option('output', {
        alias: 'o',
        describe: 'Backup file name',
        type: 'string'
      })
      .option('max-backups', {
        alias: 'm',
        describe: 'Maximum number of backups',
        type: 'number'
      })
      .option('compress', {
        alias: 'c',
        describe: 'Enable compression',
        type: 'boolean',
        default: false
      });
  },
  (argv) => {
    const filePath = path.resolve(argv.file);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Hata: ${filePath} bulunamadı!`);
      process.exit(1);
    }

    try {
      const db = new AlphaBase({ filePath, autoSave: false });
      const options = {
        compress: argv.compress,
        maxBackups: argv.maxBackups
      };
      
      if (argv.output) {
        options.filename = argv.output;
      }

      const backup = db.backup.create(options);
      console.log(`✅ Backup created:`);
      console.log(`   File: ${backup.filename}`);
      console.log(`   Size: ${(backup.size / 1024).toFixed(2)} KB`);
      console.log(`   Records: ${backup.keys} keys`);
      
      if (argv.maxBackups) {
        console.log(`   Max backups: ${argv.maxBackups}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
);

// Restore Command - Restore from backup
cli.command(
  'restore <file> <backup>',
  'Restore database from backup',
  (yargs) => {
    return yargs
      .positional('file', {
        describe: 'Database file',
        type: 'string'
      })
      .positional('backup', {
        describe: 'Backup file name',
        type: 'string'
      });
  },
  (argv) => {
    const filePath = path.resolve(argv.file);

    try {
      const db = new AlphaBase({ filePath, autoSave: false });
      db.backup.restore(argv.backup);
      db.saveSync();
      
      console.log(`✅ Restore completed`);
      console.log(`   Records: ${db.sizeSync()} keys`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
);

// List Backups Command
cli.command(
  'backups <file>',
  'List backups',
  (yargs) => {
    return yargs
      .positional('file', {
        describe: 'Veritabanı dosyası',
        type: 'string'
      });
  },
  (argv) => {
    const filePath = path.resolve(argv.file);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Hata: ${filePath} bulunamadı!`);
      process.exit(1);
    }

    try {
      const db = new AlphaBase({ filePath, autoSave: false });
      const backups = db.backup.list();

      if (backups.length === 0) {
        console.log('📦 No backups found');
        return;
      }

      console.log(`📦 ${backups.length} backups found:\n`);
      backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.filename}`);
        console.log(`   Date: ${backup.timestamp.toLocaleString('en-US')}`);
        console.log(`   Size: ${(backup.size / 1024).toFixed(2)} KB`);
        console.log(`   Records: ${backup.keys} keys\n`);
      });
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
);

// Query Command - Query database
cli.command(
  'query <file>',
  'Run query on database',
  (yargs) => {
    return yargs
      .positional('file', {
        describe: 'Database file',
        type: 'string'
      })
      .option('where', {
        alias: 'w',
        describe: 'Filter condition (JSON)',
        type: 'string'
      })
      .option('sort', {
        alias: 's',
        describe: 'Sort field',
        type: 'string'
      })
      .option('order', {
        describe: 'Sort direction (asc/desc)',
        type: 'string',
        default: 'asc',
        choices: ['asc', 'desc']
      })
      .option('limit', {
        alias: 'l',
        describe: 'Result limit',
        type: 'number'
      })
      .option('select', {
        describe: 'Fields to select (comma-separated)',
        type: 'string'
      });
  },
  (argv) => {
    const filePath = path.resolve(argv.file);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Hata: ${filePath} bulunamadı!`);
      process.exit(1);
    }

    try {
      const db = new AlphaBase({ filePath, autoSave: false });
      let query = db.query();

      // Apply filters
      if (argv.where) {
        const filters = JSON.parse(argv.where);
        Object.entries(filters).forEach(([key, value]) => {
          query = query.where(key).equals(value);
        });
      }

      // Apply sorting
      if (argv.sort) {
        query = query.sort(argv.sort, argv.order);
      }

      // Apply limit
      if (argv.limit) {
        query = query.limit(argv.limit);
      }

      // Apply field selection
      if (argv.select) {
        const fields = argv.select.split(',').map(f => f.trim());
        query = query.select(fields);
      }

      const results = query.build();

      console.log(`🔍 ${results.length} results found:\n`);
      console.log(JSON.stringify(results, null, 2));
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
);

// Stats Command - Show database statistics
cli.command(
  'stats <file>',
  'Show database statistics',
  (yargs) => {
    return yargs
      .positional('file', {
        describe: 'Database file',
        type: 'string'
      })
      .option('detailed', {
        alias: 'd',
        describe: 'Detailed statistics',
        type: 'boolean',
        default: false
      });
  },
  (argv) => {
    const filePath = path.resolve(argv.file);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Hata: ${filePath} bulunamadı!`);
      process.exit(1);
    }

    try {
      const db = new AlphaBase({ filePath, autoSave: false });
      const stats = db.stats();
      const fileStats = fs.statSync(filePath);

      console.log('📊 Database Statistics:\n');
      console.log(`Record Count: ${stats.size}`);
      console.log(`File Size: ${(fileStats.size / 1024).toFixed(2)} KB`);
      console.log(`Per Record: ${(fileStats.size / stats.size / 1024).toFixed(2)} KB`);

      if (argv.detailed) {
        console.log(`\n📈 Detailed Information:`);
        console.log(`Last Modified: ${fileStats.mtime.toLocaleString('en-US')}`);
        console.log(`Created: ${fileStats.birthtime.toLocaleString('en-US')}`);
        
        if (stats.operations) {
          console.log(`\n🔄 Operation Statistics:`);
          console.log(JSON.stringify(stats.operations, null, 2));
        }

        // Show top 5 largest keys
        const data = db.allSync();
        const sizes = Object.entries(data).map(([key, value]) => ({
          key,
          size: JSON.stringify(value).length
        })).sort((a, b) => b.size - a.size).slice(0, 5);

        console.log(`\n📦 Top 5 Largest Records:`);
        sizes.forEach((item, index) => {
          console.log(`${index + 1}. ${item.key}: ${(item.size / 1024).toFixed(2)} KB`);
        });
      }

      // Backups info
      const backups = db.backup.list();
      if (backups.length > 0) {
        console.log(`\n💾 Backups: ${backups.length} items`);
        const totalBackupSize = backups.reduce((sum, b) => sum + b.size, 0);
        console.log(`Total Backup Size: ${(totalBackupSize / 1024).toFixed(2)} KB`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
);

// Export Command
cli.command(
  'export <file> <output>',
  'Export database to JSON file',
  (yargs) => {
    return yargs
      .positional('file', {
        describe: 'Database file',
        type: 'string'
      })
      .positional('output', {
        describe: 'Output file',
        type: 'string'
      })
      .option('pretty', {
        alias: 'p',
        describe: 'Readable format',
        type: 'boolean',
        default: true
      });
  },
  (argv) => {
    const filePath = path.resolve(argv.file);
    const outputPath = path.resolve(argv.output);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Hata: ${filePath} bulunamadı!`);
      process.exit(1);
    }

    try {
      const db = new AlphaBase({ filePath, autoSave: false });
      const data = db.allSync();
      const content = JSON.stringify(data, null, argv.pretty ? 2 : 0);
      fs.writeFileSync(outputPath, content, 'utf8');

      console.log(`✅ Exported: ${outputPath}`);
      console.log(`   Records: ${Object.keys(data).length}`);
      console.log(`   Size: ${(content.length / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
);

// Import Command
cli.command(
  'import <file> <input>',
  'Import from JSON file to database',
  (yargs) => {
    return yargs
      .positional('file', {
        describe: 'Database file',
        type: 'string'
      })
      .positional('input', {
        describe: 'Input file',
        type: 'string'
      })
      .option('merge', {
        alias: 'm',
        describe: 'Merge with existing data',
        type: 'boolean',
        default: false
      });
  },
  (argv) => {
    const filePath = path.resolve(argv.file);
    const inputPath = path.resolve(argv.input);

    if (!fs.existsSync(inputPath)) {
      console.error(`❌ Error: ${inputPath} not found!`);
      process.exit(1);
    }

    try {
      const db = new AlphaBase({ filePath, autoSave: false });
      const importData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

      if (!argv.merge) {
        db.clearSync();
      }

      let imported = 0;
      for (const [key, value] of Object.entries(importData)) {
        db.setSync(key, value);
        imported++;
      }

      db.saveSync();

      console.log(`✅ Imported: ${imported} records`);
      console.log(`   Total: ${db.sizeSync()} records`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
);

// Compact Command - Optimize database file
cli.command(
  'compact <file>',
  'Optimize database file',
  (yargs) => {
    return yargs
      .positional('file', {
        describe: 'Veritabanı dosyası',
        type: 'string'
      });
  },
  (argv) => {
    const filePath = path.resolve(argv.file);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Hata: ${filePath} bulunamadı!`);
      process.exit(1);
    }

    try {
      const beforeSize = fs.statSync(filePath).size;
      const db = new AlphaBase({ filePath, autoSave: false });
      db.saveSync();
      const afterSize = fs.statSync(filePath).size;

      const saved = beforeSize - afterSize;
      const percent = ((saved / beforeSize) * 100).toFixed(2);

      console.log(`✅ Optimization completed`);
      console.log(`   Before: ${(beforeSize / 1024).toFixed(2)} KB`);
      console.log(`   After: ${(afterSize / 1024).toFixed(2)} KB`);
      console.log(`   Saved: ${(saved / 1024).toFixed(2)} KB (${percent}%)`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
);

// Parse and execute
cli.parse();
