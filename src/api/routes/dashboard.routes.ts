import { Router, Request, Response } from 'express';
import metricsService from '../../services/metrics.service';
import insightService from '../../services/insight.service';
import db from '../../db/client';

const router = Router();

/**
 * Dashboard API Routes
 * Provides business intelligence and metrics for contractors
 *
 * Auth: Will be protected by session auth (Step 6)
 * For now, requires customer_id query parameter for testing
 */

/**
 * GET /api/v1/dashboard/summary
 * Get daily executive briefing with AI-generated insights
 */
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Get customer_id from authenticated session (Step 6)
    // For now, require it as query parameter for testing
    const customerId = req.query.customer_id as string;

    if (!customerId) {
      res.status(400).json({
        error: 'Missing customer_id query parameter',
        code: 'MISSING_CUSTOMER_ID',
      });
      return;
    }

    // Get customer details
    const customerResult = await db.query(
      `SELECT company_name FROM customers WHERE customer_id = $1`,
      [customerId]
    );

    if (customerResult.length === 0) {
      res.status(404).json({
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND',
      });
      return;
    }

    const businessName = customerResult[0].company_name || 'Your Business';

    // Get metrics
    const metrics = await metricsService.getDailyMetrics(customerId);
    const hotLeads = await metricsService.getHotLeads(customerId, 5);

    // Generate AI insights
    const insights = await insightService.generateDailyBriefing({
      business_name: businessName,
      report_period: 'Past 24 Hours',
      metrics: {
        total_leads: metrics.total_leads,
        qualified_leads: metrics.qualified_leads,
        recovered_leads: metrics.recovered_leads,
        estimated_revenue_pipe: metrics.estimated_revenue_pipe,
        top_service: metrics.top_service,
        out_of_area_count: metrics.out_of_area_count,
        emergency_count: metrics.emergency_count,
        junk_count: metrics.junk_count,
      },
      hot_leads: hotLeads.map((lead) => ({
        name: lead.name || 'Anonymous',
        service: lead.service,
        value: lead.value,
        urgency: lead.urgency,
      })),
    });

    // Combine metrics and insights
    res.status(200).json({
      period: 'Past 24 Hours',
      insights: insights.dashboard_summary,
      metrics: {
        total_leads: metrics.total_leads,
        qualified_leads: metrics.qualified_leads,
        recovered_leads: metrics.recovered_leads,
        estimated_revenue: metrics.estimated_revenue_pipe,
        recovered_revenue: metrics.recovered_revenue,
        top_service: metrics.top_service,
        out_of_area: metrics.out_of_area_count,
        emergencies: metrics.emergency_count,
        junk_filtered: metrics.junk_count,
        ai_cost: metrics.ai_cost,
        roi: metrics.roi,
      },
      hot_leads: hotLeads,
    });
  } catch (error) {
    console.error('[Dashboard] Summary generation error:', error);
    res.status(500).json({
      error: 'Failed to generate dashboard summary',
      code: 'SUMMARY_ERROR',
    });
  }
});

/**
 * GET /api/v1/dashboard/metrics
 * Get raw metrics without AI insights (faster, cheaper)
 */
router.get('/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.query.customer_id as string;

    if (!customerId) {
      res.status(400).json({
        error: 'Missing customer_id query parameter',
        code: 'MISSING_CUSTOMER_ID',
      });
      return;
    }

    const metrics = await metricsService.getDailyMetrics(customerId);

    res.status(200).json({
      period: 'Past 24 Hours',
      metrics,
    });
  } catch (error) {
    console.error('[Dashboard] Metrics fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch metrics',
      code: 'METRICS_ERROR',
    });
  }
});

/**
 * GET /api/v1/dashboard/hot-leads
 * Get list of high-priority leads
 */
router.get('/hot-leads', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.query.customer_id as string;
    const limit = parseInt((req.query.limit as string) || '10', 10);

    if (!customerId) {
      res.status(400).json({
        error: 'Missing customer_id query parameter',
        code: 'MISSING_CUSTOMER_ID',
      });
      return;
    }

    const hotLeads = await metricsService.getHotLeads(customerId, limit);

    res.status(200).json({
      hot_leads: hotLeads,
      count: hotLeads.length,
    });
  } catch (error) {
    console.error('[Dashboard] Hot leads fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch hot leads',
      code: 'HOT_LEADS_ERROR',
    });
  }
});

export default router;
