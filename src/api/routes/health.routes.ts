import express, { Request, Response } from 'express';
import db from '../../db/client';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
      error?: string;
    };
    anthropic: {
      status: 'up' | 'down';
      responseTime?: number;
      error?: string;
    };
  };
}

/**
 * GET /api/v1/health
 * Comprehensive health check for production monitoring
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: { status: 'down' },
      anthropic: { status: 'down' },
    },
  };

  // Check Database Connection
  try {
    const dbStart = Date.now();
    await db.query('SELECT 1 as health_check');
    const dbDuration = Date.now() - dbStart;

    result.checks.database = {
      status: 'up',
      responseTime: dbDuration,
    };
  } catch (error: any) {
    result.checks.database = {
      status: 'down',
      error: error.message || 'Database connection failed',
    };
    result.status = 'unhealthy';
  }

  // Check Anthropic API
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const apiStart = Date.now();

    // Minimal API call to verify connectivity
    await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'ping',
        },
      ],
    });

    const apiDuration = Date.now() - apiStart;

    result.checks.anthropic = {
      status: 'up',
      responseTime: apiDuration,
    };
  } catch (error: any) {
    result.checks.anthropic = {
      status: 'down',
      error: error.message || 'Anthropic API connection failed',
    };
    result.status = result.status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  // Determine overall status
  if (result.checks.database.status === 'down') {
    result.status = 'unhealthy';
  } else if (result.checks.anthropic.status === 'down') {
    result.status = 'degraded';
  }

  // Return appropriate HTTP status code
  const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(result);
});

/**
 * GET /api/v1/health/readiness
 * Kubernetes readiness probe - checks if service is ready to accept traffic
 */
router.get('/readiness', async (req: Request, res: Response) => {
  try {
    // Check database connectivity
    await db.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready' });
  }
});

/**
 * GET /api/v1/health/liveness
 * Kubernetes liveness probe - checks if service is alive
 */
router.get('/liveness', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

export default router;
