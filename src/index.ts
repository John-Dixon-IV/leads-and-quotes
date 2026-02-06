import app from './api/server';
import db from './db/client';
import followUpWorker from './workers/followup.worker';
import digestWorker from './workers/digest.worker';
import * as dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    console.log('[Database] Connected successfully');

    // Start follow-up worker
    if (process.env.ENABLE_FOLLOWUP_WORKER !== 'false') {
      followUpWorker.start();
      console.log('[FollowUpWorker] Ghost Buster activated');
    }

    // Start weekly digest worker
    if (process.env.ENABLE_DIGEST_WORKER !== 'false') {
      digestWorker.start();
      console.log('[DigestWorker] Monday Morning Report scheduled');
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, closing gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, closing gracefully...');
  await db.close();
  process.exit(0);
});

startServer();
