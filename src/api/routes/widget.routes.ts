import { Router, Request, Response } from 'express';
import { validateWidgetApiKey } from '../middleware/auth.middleware';
import { rateLimitByCustomer } from '../middleware/rateLimit.middleware';
import leadService from '../../services/lead.service';
import { WidgetMessageRequestSchema } from '../../types/api.types';
import { ZodError } from 'zod';

const router = Router();

/**
 * POST /api/v1/widget/message
 * Submit visitor message and get AI response
 */
router.post(
  '/message',
  validateWidgetApiKey,
  rateLimitByCustomer,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const validatedData = WidgetMessageRequestSchema.parse(req.body);

      // Process message
      const response = await leadService.processMessage(req.customer!, validatedData);

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
        return;
      }

      console.error('[Widget] Message processing error:', error);
      res.status(500).json({
        error: 'Failed to process message',
        code: 'PROCESSING_ERROR',
      });
    }
  }
);

/**
 * GET /api/v1/widget/config
 * Get widget appearance and behavior configuration
 */
router.get(
  '/config',
  validateWidgetApiKey,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customer = req.customer!;

      res.status(200).json({
        brand: {
          color: customer.business_info.color || '#3B82F6',
          logo_url: customer.business_info.logo_url || null,
          company_name: customer.company_name || 'Our Company',
        },
        behavior: {
          greeting: customer.ai_prompts.greeting || 'Hi! How can we help with your project?',
          enable_quote_estimates: true,
        },
      });
    } catch (error) {
      console.error('[Widget] Config fetch error:', error);
      res.status(500).json({
        error: 'Failed to fetch configuration',
        code: 'CONFIG_ERROR',
      });
    }
  }
);

export default router;
