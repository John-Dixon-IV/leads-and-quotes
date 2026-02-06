import db from '../db/client';

/**
 * Metrics Aggregation Service
 * Calculates business intelligence metrics from lead data
 */

interface DailyMetrics {
  total_leads: number;
  qualified_leads: number;
  recovered_leads: number;
  estimated_revenue_pipe: number;
  recovered_revenue: number;
  top_service: string | null;
  out_of_area_count: number;
  emergency_count: number;
  junk_count: number;
  ai_cost: number;
  roi: number;
}

interface HotLead {
  name: string | null;
  service: string;
  value: number;
  urgency: number;
  created_at: Date;
}

export class MetricsService {
  /**
   * Get metrics for the last 24 hours
   */
  async getDailyMetrics(customerId: string): Promise<DailyMetrics> {
    const period = '24 hours';

    // Total leads
    const totalLeads = await this.getTotalLeads(customerId, period);

    // Qualified leads (is_complete = true)
    const qualifiedLeads = await this.getQualifiedLeads(customerId, period);

    // Recovered leads (follow_up_sent = true AND is_complete = true)
    const recoveredLeads = await this.getRecoveredLeads(customerId, period);

    // Estimated revenue pipeline
    const estimatedRevenue = await this.getEstimatedRevenue(customerId, period);

    // Recovered revenue (from recovered leads only)
    const recoveredRevenue = await this.getRecoveredRevenue(customerId, period);

    // Top service
    const topService = await this.getTopService(customerId, period);

    // Out of area count
    const outOfAreaCount = await this.getOutOfAreaCount(customerId, period);

    // Emergency count (urgency >= 0.9)
    const emergencyCount = await this.getEmergencyCount(customerId, period);

    // Junk count
    const junkCount = await this.getJunkCount(customerId, period);

    // AI cost estimate
    const aiCost = await this.estimateAICost(customerId, period);

    // Calculate ROI
    const roi = recoveredRevenue > 0 ? ((recoveredRevenue - aiCost) / aiCost) * 100 : 0;

    return {
      total_leads: totalLeads,
      qualified_leads: qualifiedLeads,
      recovered_leads: recoveredLeads,
      estimated_revenue_pipe: estimatedRevenue,
      recovered_revenue: recoveredRevenue,
      top_service: topService,
      out_of_area_count: outOfAreaCount,
      emergency_count: emergencyCount,
      junk_count: junkCount,
      ai_cost: aiCost,
      roi: Math.round(roi),
    };
  }

  /**
   * Get hot leads (high urgency or high value)
   */
  async getHotLeads(customerId: string, limit: number = 5): Promise<HotLead[]> {
    const leads = await db.query<any>(
      `SELECT
        visitor_name as name,
        (classification->>'service_type') as service,
        COALESCE(
          CAST(SPLIT_PART(SPLIT_PART(quote->>'estimated_range', '-', 2), '$', 2) AS NUMERIC),
          0
        ) as value,
        COALESCE((classification->>'urgency_score')::NUMERIC, 0.5) as urgency,
        created_at
       FROM leads
       WHERE customer_id = $1
         AND created_at > NOW() - INTERVAL '24 hours'
         AND deleted_at IS NULL
         AND is_complete = true
         AND (
           (classification->>'urgency_score')::NUMERIC >= 0.8
           OR quote IS NOT NULL
         )
       ORDER BY
         (classification->>'urgency_score')::NUMERIC DESC,
         created_at DESC
       LIMIT $2`,
      [customerId, limit]
    );

    return leads.map((lead) => ({
      name: lead.name,
      service: lead.service || 'Unknown Service',
      value: Math.round(lead.value || 0),
      urgency: parseFloat(lead.urgency) || 0.5,
      created_at: lead.created_at,
    }));
  }

  /**
   * Get weekly metrics for email report
   */
  async getWeeklyMetrics(customerId: string): Promise<DailyMetrics> {
    // Same as daily metrics but with '7 days' period
    // Implementation similar to getDailyMetrics but with different time window
    // For now, return daily metrics as placeholder
    return this.getDailyMetrics(customerId);
  }

  // Private helper methods

  private async getTotalLeads(customerId: string, period: string): Promise<number> {
    const result = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM leads
       WHERE customer_id = $1
         AND created_at > NOW() - INTERVAL '${period}'
         AND deleted_at IS NULL`,
      [customerId]
    );
    return parseInt(result[0]?.count?.toString() || '0', 10);
  }

  private async getQualifiedLeads(customerId: string, period: string): Promise<number> {
    const result = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM leads
       WHERE customer_id = $1
         AND created_at > NOW() - INTERVAL '${period}'
         AND is_complete = true
         AND deleted_at IS NULL`,
      [customerId]
    );
    return parseInt(result[0]?.count?.toString() || '0', 10);
  }

  private async getRecoveredLeads(customerId: string, period: string): Promise<number> {
    const result = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM leads
       WHERE customer_id = $1
         AND created_at > NOW() - INTERVAL '${period}'
         AND follow_up_sent = true
         AND is_complete = true
         AND deleted_at IS NULL`,
      [customerId]
    );
    return parseInt(result[0]?.count?.toString() || '0', 10);
  }

  private async getEstimatedRevenue(customerId: string, period: string): Promise<number> {
    const result = await db.query<{ total: number }>(
      `SELECT SUM(
         COALESCE(
           CAST(SPLIT_PART(SPLIT_PART(quote->>'estimated_range', '-', 2), '$', 2) AS NUMERIC),
           0
         )
       ) as total
       FROM leads
       WHERE customer_id = $1
         AND created_at > NOW() - INTERVAL '${period}'
         AND quote IS NOT NULL
         AND deleted_at IS NULL`,
      [customerId]
    );
    return Math.round(parseFloat(result[0]?.total?.toString() || '0'));
  }

  private async getRecoveredRevenue(customerId: string, period: string): Promise<number> {
    const result = await db.query<{ total: number }>(
      `SELECT SUM(
         COALESCE(
           CAST(SPLIT_PART(SPLIT_PART(quote->>'estimated_range', '-', 2), '$', 2) AS NUMERIC),
           0
         )
       ) as total
       FROM leads
       WHERE customer_id = $1
         AND created_at > NOW() - INTERVAL '${period}'
         AND follow_up_sent = true
         AND is_complete = true
         AND quote IS NOT NULL
         AND deleted_at IS NULL`,
      [customerId]
    );
    return Math.round(parseFloat(result[0]?.total?.toString() || '0'));
  }

  private async getTopService(customerId: string, period: string): Promise<string | null> {
    const result = await db.query<{ service: string }>(
      `SELECT classification->>'service_type' as service, COUNT(*) as count
       FROM leads
       WHERE customer_id = $1
         AND created_at > NOW() - INTERVAL '${period}'
         AND classification IS NOT NULL
         AND deleted_at IS NULL
       GROUP BY classification->>'service_type'
       ORDER BY count DESC
       LIMIT 1`,
      [customerId]
    );
    return result[0]?.service || null;
  }

  private async getOutOfAreaCount(customerId: string, period: string): Promise<number> {
    const result = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM leads
       WHERE customer_id = $1
         AND created_at > NOW() - INTERVAL '${period}'
         AND (classification->>'is_out_of_area')::BOOLEAN = true
         AND deleted_at IS NULL`,
      [customerId]
    );
    return parseInt(result[0]?.count?.toString() || '0', 10);
  }

  private async getEmergencyCount(customerId: string, period: string): Promise<number> {
    const result = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM leads
       WHERE customer_id = $1
         AND created_at > NOW() - INTERVAL '${period}'
         AND (classification->>'urgency_score')::NUMERIC >= 0.9
         AND deleted_at IS NULL`,
      [customerId]
    );
    return parseInt(result[0]?.count?.toString() || '0', 10);
  }

  private async getJunkCount(customerId: string, period: string): Promise<number> {
    const result = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM leads
       WHERE customer_id = $1
         AND created_at > NOW() - INTERVAL '${period}'
         AND (classification->>'category') = 'Junk'
         AND deleted_at IS NULL`,
      [customerId]
    );
    return parseInt(result[0]?.count?.toString() || '0', 10);
  }

  private async estimateAICost(customerId: string, period: string): Promise<number> {
    const result = await db.query<{ message_count: number; quote_count: number }>(
      `SELECT
         COUNT(m.message_id) as message_count,
         COUNT(l.quote) as quote_count
       FROM leads l
       LEFT JOIN messages m ON m.lead_id = l.lead_id AND m.sender = 'ai'
       WHERE l.customer_id = $1
         AND l.created_at > NOW() - INTERVAL '${period}'
         AND l.deleted_at IS NULL`,
      [customerId]
    );

    const messageCount = parseInt(result[0]?.message_count?.toString() || '0', 10);
    const quoteCount = parseInt(result[0]?.quote_count?.toString() || '0', 10);

    // Rough cost estimate:
    // - Haiku classification: $0.001 per message
    // - Sonnet quote: $0.002 per quote
    // - Haiku follow-up: $0.0005 per nudge (assume 20% of leads)
    const classificationCost = messageCount * 0.001;
    const quoteCost = quoteCount * 0.002;
    const followUpCost = messageCount * 0.2 * 0.0005;

    return parseFloat((classificationCost + quoteCost + followUpCost).toFixed(2));
  }
}

export default new MetricsService();
