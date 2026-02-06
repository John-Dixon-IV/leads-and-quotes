import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err: Error) => {
  console.error('Unexpected database pool error:', err);
  process.exit(-1);
});

export const db = {
  query: async <T>(text: string, params?: any[]): Promise<T[]> => {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('[DB Query]', { text, duration, rows: result.rowCount });
    }

    return result.rows as T[];
  },

  getClient: async (): Promise<PoolClient> => {
    return await pool.connect();
  },

  close: async (): Promise<void> => {
    await pool.end();
  },
};

export default db;
