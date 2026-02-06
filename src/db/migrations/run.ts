import * as fs from 'fs';
import * as path from 'path';
import db from '../client';

async function runMigrations() {
  try {
    console.log('[Migration] Starting database migrations...');

    // Read migration file
    const migrationPath = path.join(__dirname, '001_initial_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute migration
    await db.query(migrationSQL);

    console.log('[Migration] Successfully applied: 001_initial_schema.sql');
    console.log('[Migration] Database schema is ready');

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('[Migration] Failed to run migrations:', error);
    await db.close();
    process.exit(1);
  }
}

runMigrations();
