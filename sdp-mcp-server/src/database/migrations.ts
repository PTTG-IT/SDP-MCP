import { getDatabase } from './connection.js';
import { logger } from '../monitoring/logging.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  const db = await getDatabase();
  
  try {
    // Create migrations table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    // Get executed migrations
    const result = await db.query('SELECT filename FROM migrations');
    const executed = new Set(result.rows.map(r => r.filename));

    // Run pending migrations
    for (const file of sqlFiles) {
      if (!executed.has(file)) {
        logger.info(`Running migration: ${file}`);
        
        const sqlPath = path.join(migrationsDir, file);
        const sql = await fs.readFile(sqlPath, 'utf-8');
        
        // Run migration in transaction
        await db.query('BEGIN');
        try {
          await db.query(sql);
          await db.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [file]
          );
          await db.query('COMMIT');
          
          logger.info(`Migration completed: ${file}`);
        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }
      }
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error });
    throw error;
  }
}