import { Request, Response, NextFunction } from 'express';
import db from '../../db/client';
import { Customer } from '../../types/domain.types';

// Extend Express Request to include customer
declare global {
  namespace Express {
    interface Request {
      customer?: Customer;
    }
  }
}

/**
 * Validate widget API key from X-API-Key header
 */
export async function validateWidgetApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      error: 'Missing API key',
      code: 'MISSING_API_KEY',
    });
    return;
  }

  try {
    const customers = await db.query<Customer>(
      `SELECT * FROM customers
       WHERE api_key = $1
       AND is_active = true
       AND deleted_at IS NULL
       LIMIT 1`,
      [apiKey]
    );

    if (customers.length === 0) {
      res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
      return;
    }

    // Attach customer to request
    req.customer = customers[0];
    next();
  } catch (error) {
    console.error('[Auth] API key validation error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
}
