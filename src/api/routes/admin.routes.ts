import express, { Request, Response } from 'express';
import db from '../../db/client';
import * as dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

/**
 * Admin authentication middleware
 * Protects admin routes with ADMIN_SECRET
 */
const requireAdminAuth = (req: Request, res: Response, next: any) => {
  const adminSecret = req.headers['x-admin-secret'] || req.query.admin_secret;

  if (!process.env.ADMIN_SECRET) {
    return res.status(500).json({
      error: 'Admin authentication not configured',
      code: 'ADMIN_AUTH_NOT_CONFIGURED',
    });
  }

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({
      error: 'Unauthorized - Invalid admin secret',
      code: 'INVALID_ADMIN_SECRET',
    });
  }

  next();
};

/**
 * GET /api/v1/admin/stats
 * Returns platform-wide statistics across all tenants
 */
router.get('/stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    // Total revenue recovered across ALL tenants
    const revenueQuery = await db.query(`
      SELECT
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE is_qualified = true) as qualified_leads,
        COUNT(*) FILTER (WHERE quote IS NOT NULL) as quoted_leads,
        COALESCE(SUM(estimated_revenue), 0) as total_estimated_revenue,
        COALESCE(SUM(actual_revenue), 0) as total_actual_revenue,
        COUNT(*) FILTER (WHERE referral_sent = true) as total_referrals,
        COUNT(*) FILTER (WHERE qbo_exported = true) as qbo_exports
      FROM leads
      WHERE deleted_at IS NULL
    `);

    const revenueStats = revenueQuery[0] || {};

    // Ghost Buster success rate
    const ghostBusterQuery = await db.query(`
      SELECT
        COUNT(*) as total_incomplete_leads,
        COUNT(*) FILTER (WHERE follow_up_sent = true) as follow_ups_sent,
        COUNT(*) FILTER (WHERE follow_up_sent = true AND is_complete = true) as recovered_leads,
        CASE
          WHEN COUNT(*) FILTER (WHERE follow_up_sent = true) > 0
          THEN ROUND(
            (COUNT(*) FILTER (WHERE follow_up_sent = true AND is_complete = true)::NUMERIC /
             COUNT(*) FILTER (WHERE follow_up_sent = true)::NUMERIC) * 100,
            2
          )
          ELSE 0
        END as success_rate_percent
      FROM leads
      WHERE is_complete = false
        AND deleted_at IS NULL
    `);

    const ghostBusterStats = ghostBusterQuery[0] || {};

    // AI spend vs. Revenue generated
    const aiSpendQuery = await db.query(`
      SELECT
        COALESCE(SUM(ai_cost_usd), 0) as total_ai_cost,
        COALESCE(SUM(estimated_revenue), 0) as total_revenue,
        COALESCE(SUM(ai_api_calls), 0) as total_api_calls
      FROM metrics
    `);

    const aiSpendStats = aiSpendQuery[0] || {};

    // Calculate ROI
    const totalAICost = parseFloat(aiSpendStats.total_ai_cost || '0');
    const totalRevenue = parseFloat(revenueStats.total_estimated_revenue || '0');
    const roi = totalAICost > 0 ? ((totalRevenue - totalAICost) / totalAICost) * 100 : 0;

    // Customer statistics
    const customerQuery = await db.query(`
      SELECT
        COUNT(*) as total_customers,
        COUNT(*) FILTER (WHERE is_active = true) as active_customers,
        COUNT(*) FILTER (WHERE weekly_digest_enabled = true) as digest_enabled,
        COUNT(*) FILTER (WHERE alert_on_hot_lead = true) as hot_lead_alerts_enabled
      FROM customers
      WHERE deleted_at IS NULL
    `);

    const customerStats = customerQuery[0] || {};

    // Top performing customers (by revenue)
    const topCustomersQuery = await db.query(`
      SELECT
        c.customer_id,
        c.company_name,
        COUNT(l.lead_id) as total_leads,
        COALESCE(SUM(l.estimated_revenue), 0) as estimated_revenue,
        COALESCE(SUM(l.actual_revenue), 0) as actual_revenue
      FROM customers c
      LEFT JOIN leads l ON l.customer_id = c.customer_id AND l.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.customer_id, c.company_name
      ORDER BY estimated_revenue DESC
      LIMIT 10
    `);

    // Recent activity (last 30 days)
    const recentActivityQuery = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as leads_captured,
        COUNT(*) FILTER (WHERE quote IS NOT NULL) as quotes_generated,
        COALESCE(SUM(estimated_revenue), 0) as daily_revenue
      FROM leads
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Build comprehensive stats response
    const stats = {
      summary: {
        total_revenue_recovered: parseFloat(revenueStats.total_estimated_revenue || '0'),
        actual_revenue_realized: parseFloat(revenueStats.total_actual_revenue || '0'),
        total_ai_cost: totalAICost,
        roi_percent: Math.round(roi * 100) / 100,
        net_revenue: totalRevenue - totalAICost,
      },
      leads: {
        total: parseInt(revenueStats.total_leads || '0', 10),
        qualified: parseInt(revenueStats.qualified_leads || '0', 10),
        quoted: parseInt(revenueStats.quoted_leads || '0', 10),
        qualification_rate: revenueStats.total_leads > 0
          ? Math.round((revenueStats.qualified_leads / revenueStats.total_leads) * 100)
          : 0,
        quote_rate: revenueStats.qualified_leads > 0
          ? Math.round((revenueStats.quoted_leads / revenueStats.qualified_leads) * 100)
          : 0,
      },
      ghost_buster: {
        total_incomplete: parseInt(ghostBusterStats.total_incomplete_leads || '0', 10),
        follow_ups_sent: parseInt(ghostBusterStats.follow_ups_sent || '0', 10),
        recovered: parseInt(ghostBusterStats.recovered_leads || '0', 10),
        success_rate_percent: parseFloat(ghostBusterStats.success_rate_percent || '0'),
      },
      ai_usage: {
        total_api_calls: parseInt(aiSpendStats.total_api_calls || '0', 10),
        total_cost_usd: totalAICost,
        average_cost_per_lead: revenueStats.total_leads > 0
          ? Math.round((totalAICost / revenueStats.total_leads) * 100) / 100
          : 0,
        cost_per_dollar_revenue: totalRevenue > 0
          ? Math.round((totalAICost / totalRevenue) * 10000) / 100
          : 0,
      },
      integrations: {
        total_referrals: parseInt(revenueStats.total_referrals || '0', 10),
        qbo_exports: parseInt(revenueStats.qbo_exports || '0', 10),
      },
      customers: {
        total: parseInt(customerStats.total_customers || '0', 10),
        active: parseInt(customerStats.active_customers || '0', 10),
        digest_enabled: parseInt(customerStats.digest_enabled || '0', 10),
        hot_lead_alerts_enabled: parseInt(customerStats.hot_lead_alerts_enabled || '0', 10),
      },
      top_customers: topCustomersQuery.map((row: any) => ({
        customer_id: row.customer_id,
        company_name: row.company_name,
        total_leads: parseInt(row.total_leads || '0', 10),
        estimated_revenue: parseFloat(row.estimated_revenue || '0'),
        actual_revenue: parseFloat(row.actual_revenue || '0'),
      })),
      recent_activity: recentActivityQuery.map((row: any) => ({
        date: row.date,
        leads_captured: parseInt(row.leads_captured || '0', 10),
        quotes_generated: parseInt(row.quotes_generated || '0', 10),
        daily_revenue: parseFloat(row.daily_revenue || '0'),
      })),
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('[AdminAPI] Failed to fetch stats:', error);
    res.status(500).json({
      error: 'Failed to fetch admin statistics',
      code: 'STATS_FETCH_FAILED',
    });
  }
});

/**
 * GET /api/v1/admin/customers
 * Returns list of all customers with summary stats
 */
router.get('/customers', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const customersQuery = await db.query(`
      SELECT
        c.customer_id,
        c.email,
        c.company_name,
        c.subscription_tier,
        c.is_active,
        c.created_at,
        COUNT(l.lead_id) as total_leads,
        COALESCE(SUM(l.estimated_revenue), 0) as estimated_revenue
      FROM customers c
      LEFT JOIN leads l ON l.customer_id = c.customer_id AND l.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.customer_id, c.email, c.company_name, c.subscription_tier, c.is_active, c.created_at
      ORDER BY c.created_at DESC
    `);

    res.status(200).json({
      customers: customersQuery,
      total: customersQuery.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AdminAPI] Failed to fetch customers:', error);
    res.status(500).json({
      error: 'Failed to fetch customers',
      code: 'CUSTOMERS_FETCH_FAILED',
    });
  }
});

/**
 * GET /api/v1/admin/metrics/:customer_id
 * Returns detailed metrics for a specific customer
 */
router.get('/metrics/:customer_id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { customer_id } = req.params;

    const metricsQuery = await db.query(
      `SELECT * FROM metrics
       WHERE customer_id = $1
       ORDER BY metric_date DESC
       LIMIT 90`,
      [customer_id]
    );

    res.status(200).json({
      customer_id,
      metrics: metricsQuery,
      total_days: metricsQuery.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AdminAPI] Failed to fetch customer metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch customer metrics',
      code: 'METRICS_FETCH_FAILED',
    });
  }
});

export default router;
