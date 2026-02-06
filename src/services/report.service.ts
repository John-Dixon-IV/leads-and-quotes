import Anthropic from '@anthropic-ai/sdk';
import db from '../db/client';
import metricsService from './metrics.service';
import * as dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_RETRIES = 1;

/**
 * Weekly Performance Digest Service
 * Generates Monday Morning reports showing AI's value
 * Uses Claude Sonnet for comprehensive, celebratory summaries
 */

interface WeeklyDigestRequest {
  business_name: string;
  week_start: string; // ISO date
  week_end: string; // ISO date
  metrics: {
    total_leads: number;
    qualified_leads: number;
    recovered_leads: number;
    estimated_revenue: number;
    recovered_revenue: number;
    hours_saved: number; // total_messages / 4
    top_service: string | null;
    emergencies_handled: number;
    junk_filtered: number;
    ai_cost: number;
    roi: number;
  };
  pending_hot_leads: number;
}

interface WeeklyDigestResponse {
  subject_line: string;
  email_body: string;
  html_body: string;
}

export class ReportService {
  /**
   * Generate weekly performance digest
   */
  async generateWeeklyDigest(customerId: string): Promise<WeeklyDigestResponse> {
    try {
      // Get customer details
      const customer = await this.getCustomerDetails(customerId);

      // Calculate week range (last 7 days)
      const weekEnd = new Date();
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);

      // Get weekly metrics
      const metrics = await this.getWeeklyMetrics(customerId);

      // Calculate hours saved (assume 4 minutes per message)
      const hoursSaved = Math.round((metrics.total_messages || 0) / 15);

      // Count pending hot leads
      const pendingHotLeads = await this.getPendingHotLeads(customerId);

      // Generate digest using Sonnet
      const digest = await this.generateDigestContent({
        business_name: customer.company_name || 'Your Business',
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        metrics: {
          total_leads: metrics.total_leads,
          qualified_leads: metrics.qualified_leads,
          recovered_leads: metrics.recovered_leads,
          estimated_revenue: metrics.estimated_revenue_pipe,
          recovered_revenue: metrics.recovered_revenue,
          hours_saved: hoursSaved,
          top_service: metrics.top_service,
          emergencies_handled: metrics.emergency_count,
          junk_filtered: metrics.junk_count,
          ai_cost: metrics.ai_cost,
          roi: metrics.roi,
        },
        pending_hot_leads: pendingHotLeads,
      });

      // Update last digest timestamp
      await db.query(
        `UPDATE customers SET last_digest_sent_at = NOW() WHERE customer_id = $1`,
        [customerId]
      );

      return digest;
    } catch (error) {
      console.error('[ReportService] Digest generation failed:', error);

      // Fallback digest
      return {
        subject_line: 'Your Weekly Performance Report',
        email_body: 'Check your dashboard for this week\'s performance metrics.',
        html_body: '<p>Check your dashboard for this week\'s performance metrics.</p>',
      };
    }
  }

  /**
   * Send weekly digest via email
   */
  async sendWeeklyDigest(customerId: string): Promise<void> {
    try {
      const customer = await this.getCustomerDetails(customerId);

      if (!customer.weekly_digest_enabled || !customer.notification_email) {
        console.log(`[ReportService] Weekly digest disabled for customer ${customerId}`);
        return;
      }

      const digest = await this.generateWeeklyDigest(customerId);

      // Send email (placeholder - integrate with SendGrid/AWS SES)
      await this.sendEmail(
        customerId,
        customer.notification_email,
        digest.subject_line,
        digest.email_body,
        digest.html_body
      );

      console.log(`[ReportService] Weekly digest sent to ${customer.notification_email}`);
    } catch (error) {
      console.error('[ReportService] Failed to send weekly digest:', error);
    }
  }

  /**
   * Generate digest content using Sonnet
   */
  private async generateDigestContent(
    request: WeeklyDigestRequest
  ): Promise<WeeklyDigestResponse> {
    const systemPrompt = this.buildDigestSystemPrompt();
    const userPrompt = JSON.stringify(request, null, 2);

    try {
      const response = await this.callClaudeWithRetry(
        'claude-sonnet-4-5-20250929',
        systemPrompt,
        userPrompt,
        this.getDigestSchema()
      );

      return response as WeeklyDigestResponse;
    } catch (error) {
      console.error('[ReportService] Digest content generation failed:', error);
      throw error;
    }
  }

  /**
   * Get customer details
   */
  private async getCustomerDetails(customerId: string): Promise<any> {
    const result = await db.query(
      `SELECT company_name, notification_email, weekly_digest_enabled
       FROM customers
       WHERE customer_id = $1 AND deleted_at IS NULL`,
      [customerId]
    );

    return result[0] || { company_name: 'Your Business', weekly_digest_enabled: false };
  }

  /**
   * Get weekly metrics (last 7 days)
   */
  private async getWeeklyMetrics(customerId: string): Promise<any> {
    const result = await db.query<any>(
      `SELECT
         COUNT(*) as total_leads,
         COUNT(*) FILTER (WHERE is_complete = true) as qualified_leads,
         COUNT(*) FILTER (WHERE follow_up_sent = true AND is_complete = true) as recovered_leads,
         SUM(COALESCE(CAST(SPLIT_PART(SPLIT_PART(quote->>'estimated_range', '-', 2), '$', 2) AS NUMERIC), 0)) as estimated_revenue_pipe,
         SUM(COALESCE(CAST(SPLIT_PART(SPLIT_PART(quote->>'estimated_range', '-', 2), '$', 2) AS NUMERIC), 0)) FILTER (WHERE follow_up_sent = true AND is_complete = true) as recovered_revenue,
         COUNT(*) FILTER (WHERE (classification->>'urgency_score')::NUMERIC >= 0.9) as emergency_count,
         COUNT(*) FILTER (WHERE (classification->>'category') = 'Junk') as junk_count,
         (SELECT classification->>'service_type' FROM leads WHERE customer_id = $1 AND created_at > NOW() - INTERVAL '7 days' GROUP BY classification->>'service_type' ORDER BY COUNT(*) DESC LIMIT 1) as top_service,
         (SELECT SUM(message_count) FROM leads WHERE customer_id = $1 AND created_at > NOW() - INTERVAL '7 days') as total_messages
       FROM leads
       WHERE customer_id = $1
         AND created_at > NOW() - INTERVAL '7 days'
         AND deleted_at IS NULL`,
      [customerId]
    );

    const row = result[0] || {};
    return {
      total_leads: parseInt(row.total_leads || '0', 10),
      qualified_leads: parseInt(row.qualified_leads || '0', 10),
      recovered_leads: parseInt(row.recovered_leads || '0', 10),
      estimated_revenue_pipe: Math.round(parseFloat(row.estimated_revenue_pipe || '0')),
      recovered_revenue: Math.round(parseFloat(row.recovered_revenue || '0')),
      emergency_count: parseInt(row.emergency_count || '0', 10),
      junk_count: parseInt(row.junk_count || '0', 10),
      top_service: row.top_service || null,
      total_messages: parseInt(row.total_messages || '0', 10),
      ai_cost: 0.2, // Rough estimate
      roi: 0,
    };
  }

  /**
   * Count pending hot leads
   */
  private async getPendingHotLeads(customerId: string): Promise<number> {
    const result = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM leads
       WHERE customer_id = $1
         AND is_complete = true
         AND status IN ('new', 'qualified')
         AND (classification->>'urgency_score')::NUMERIC >= 0.8
         AND deleted_at IS NULL`,
      [customerId]
    );

    return parseInt(result[0]?.count?.toString() || '0', 10);
  }

  /**
   * Send email (placeholder - integrate with SendGrid/AWS SES)
   */
  private async sendEmail(
    customerId: string,
    email: string,
    subject: string,
    textBody: string,
    htmlBody: string
  ): Promise<void> {
    try {
      console.log(`[ReportService] Email to ${email}`);
      console.log(`Subject: ${subject}`);

      // Log notification
      await db.query(
        `INSERT INTO notifications (customer_id, notification_type, channel, recipient, subject, content, status)
         VALUES ($1, 'weekly_digest', 'email', $2, $3, $4, 'sent')`,
        [customerId, email, subject, htmlBody]
      );

      // In production: integrate with SendGrid or AWS SES
    } catch (error) {
      console.error('[ReportService] Email send failed:', error);
    }
  }

  /**
   * Call Claude API with retry logic
   */
  private async callClaudeWithRetry(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    schema: any,
    retries: number = MAX_RETRIES
  ): Promise<any> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: schema,
          },
        });

        const content = response.content[0];
        if (content.type === 'text') {
          return JSON.parse(content.text);
        }

        throw new Error('Unexpected response format from Claude');
      } catch (error) {
        console.error(`[ReportService] Attempt ${attempt + 1} failed:`, error);

        if (attempt === retries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  /**
   * Build system prompt for weekly digest
   */
  private buildDigestSystemPrompt(): string {
    return `You are a Senior SaaS Performance Analyst. Your goal is to write a weekly email report that justifies the subscription cost and celebrates wins.

DATA INPUT:
- Total Leads processed last week
- Total Estimated Revenue Pipeline
- 'Ghost Buster' Recoveries (number and value)
- Churn/Noise filtered (Spam/Out-of-Area)
- Hours saved (based on message count)

STRICT RULES:
1. Subject Line: Must be dynamic and compelling
   - Examples: "Last week: You recovered $3,200 with AI"
   - "Great Week: 45 leads captured, $12K pipeline"
   - "Your AI saved 8 hours of work this week"

2. Email Body Structure:
   - Section 1: "The Big Wins" (Revenue and Recoveries first)
   - Section 2: "Time Saved" (Hours saved from automation)
   - Section 3: "The Week Ahead" (Pending high-priority leads)
   - Section 4: "ROI Proof" (Show the math)

3. Tone: Celebratory, data-driven, personal

4. Format:
   - Use clear section headings
   - Include specific numbers (not ranges)
   - End with encouragement

HTML FORMATTING:
- Use simple HTML tags: <h2>, <p>, <ul>, <li>, <strong>
- Keep it clean and readable
- No complex CSS or images

EXAMPLES:

Subject: "Last week: You recovered $3,200 with AI"

Body:
Hi Joe,

Great week! Here's what your AI assistant accomplished:

## The Big Wins 💰

• 45 leads captured
• 28 qualified ($12,500 pipeline)
• 12 recovered by Ghost Buster ($3,200 saved)
• Top service: Deck Repair (18 requests)

## Time Saved ⏰

Your AI handled 180 messages this week.
That's 12 hours of work you didn't have to do.
($240 value at $20/hour)

## The Week Ahead 🎯

You have 3 hot leads waiting:
• Sarah - $1,500 deck repair (emergency)
• Mike - $2,000 roofing job
• Lisa - $1,200 fence install

## The ROI Math 📊

AI Cost: $5.00
Recovered Revenue: $3,200
ROI: 64,000%

Your AI assistant is paying for itself 640x over!

Keep up the great work,
- Your AI Assistant

Remember: The contractor should feel PROUD of their week and EXCITED about the AI's value.`;
  }

  /**
   * JSON schema for digest response
   */
  private getDigestSchema() {
    return {
      name: 'weekly_digest',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          subject_line: { type: 'string' },
          email_body: { type: 'string' },
          html_body: { type: 'string' },
        },
        required: ['subject_line', 'email_body', 'html_body'],
        additionalProperties: false,
      },
    };
  }
}

export default new ReportService();
