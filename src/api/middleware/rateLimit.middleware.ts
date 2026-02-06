import { Request, Response, NextFunction } from 'express';
import db from '../../db/client';

/**
 * Rate limit per customer_id
 * Enforces max messages per session (tracked in database)
 */
export async function rateLimitByCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.customer) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const customerId = req.customer.customer_id;
  const sessionId = (req.body as any).session_id;

  if (!sessionId) {
    // Will be caught by validation later
    next();
    return;
  }

  try {
    // Check session message count
    const sessions = await db.query<{ message_count: number }>(
      `SELECT message_count FROM sessions
       WHERE session_id = $1 AND customer_id = $2
       AND expires_at > NOW()
       LIMIT 1`,
      [sessionId, customerId]
    );

    let messageCount = 0;

    if (sessions.length > 0) {
      messageCount = sessions[0].message_count;
    } else {
      // Create new session tracking
      await db.query(
        `INSERT INTO sessions (session_id, customer_id, message_count)
         VALUES ($1, $2, 0)
         ON CONFLICT (session_id) DO NOTHING`,
        [sessionId, customerId]
      );
    }

    // Check against customer's rate limit
    const maxMessages = req.customer.rate_limit_messages_per_session || 10;

    if (messageCount >= maxMessages * 2) {
      // *2 because each exchange is 2 messages (visitor + ai)
      res.status(429).json({
        error: 'Rate limit exceeded for this session',
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    // Update session activity
    await db.query(
      `UPDATE sessions
       SET last_activity_at = NOW(), message_count = message_count + 1
       WHERE session_id = $1`,
      [sessionId]
    );

    next();
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // Don't block on rate limit errors
    next();
  }
}
