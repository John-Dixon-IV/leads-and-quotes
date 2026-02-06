import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_RETRIES = 1;

/**
 * Executive Insights Engine
 * Generates "Morning Briefing" style business intelligence for contractors
 * Uses Claude Haiku for fast, cheap, encouraging daily summaries
 */

interface InsightRequest {
  business_name: string;
  report_period: string; // "Past 24 Hours", "Past Week", etc.
  metrics: {
    total_leads: number;
    qualified_leads: number;
    recovered_leads: number; // Ghost Buster recoveries
    estimated_revenue_pipe: number;
    top_service: string | null;
    out_of_area_count: number;
    emergency_count: number;
    junk_count: number;
  };
  hot_leads: Array<{
    name: string | null;
    service: string;
    value: number;
    urgency: number;
  }>;
}

interface InsightResponse {
  dashboard_summary: {
    headline: string;
    briefing_text: string;
    action_items: string[];
    recovery_shoutout: string;
  };
}

const FALLBACK_INSIGHT: InsightResponse = {
  dashboard_summary: {
    headline: 'Your Business is Growing',
    briefing_text: "You've captured new leads. Check your dashboard for details.",
    action_items: ['Follow up with pending leads'],
    recovery_shoutout: 'Keep up the great work!',
  },
};

export class InsightService {
  /**
   * Generate daily briefing using Haiku
   */
  async generateDailyBriefing(request: InsightRequest): Promise<InsightResponse> {
    const systemPrompt = this.buildInsightSystemPrompt();
    const userPrompt = JSON.stringify(request, null, 2);

    try {
      const response = await this.callClaudeWithRetry(
        'claude-haiku-4-5-20251001',
        systemPrompt,
        userPrompt,
        this.getInsightSchema()
      );

      return response as InsightResponse;
    } catch (error) {
      console.error('[InsightService] Briefing generation failed:', error);
      return FALLBACK_INSIGHT;
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
          max_tokens: 512,
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
        console.error(`[InsightService] Attempt ${attempt + 1} failed:`, error);

        if (attempt === retries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  /**
   * Build system prompt for executive insights
   */
  private buildInsightSystemPrompt(): string {
    return `You are a "Senior Business Analyst" for a high-growth home services company.

Your goal is to provide a "Morning Briefing" to the business owner that is:
- Encouraging
- Data-driven
- Brief (2-3 sentences max)

STRATEGY:
1. Lead with the Money: Always mention the estimated_revenue_pipe first.
2. Highlight the Recovery: Explicitly mention how many leads the "Ghost Buster" system saved.
3. Prioritize Urgency: If there are hot_leads with urgency > 0.8, list them as the #1 action item.
4. Celebrate Wins: Use positive, energetic language.

TONE:
Professional, energetic, and concise. No fluff.

HEADLINE EXAMPLES:
- "Big Day for Decks: $4,500 in new opportunities"
- "Hot Lead Alert: 3 emergency jobs waiting"
- "Strong Monday: $6,200 pipeline + 2 recovered leads"

BRIEFING TEXT EXAMPLES:
- "You captured 8 qualified leads worth $4,500. Ghost Buster recovered 3 leads that would have been lost. Focus on Sarah's deck repair—she's ready to book."
- "Busy week! 15 new leads, $12,000 in potential revenue. Your AI assistant saved 5 ghosted leads. Two emergency jobs need immediate attention."

RECOVERY SHOUTOUT EXAMPLES:
- "Ghost Buster recovered $1,200 in business while you were asleep."
- "Your AI assistant saved 3 leads that started conversations but didn't finish."
- "Automated follow-ups recovered 25% of incomplete leads this week."

ACTION ITEMS:
- Be specific and actionable
- Prioritize by urgency and value
- Maximum 3-4 items
- Examples: "Call Sarah about $1,200 deck repair (urgent)", "Follow up with 2 pending quotes"

Remember: The contractor is busy. Make them feel like they have a sales manager watching their business 24/7.`;
  }

  /**
   * JSON schema for insight response
   */
  private getInsightSchema() {
    return {
      name: 'daily_briefing',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          dashboard_summary: {
            type: 'object',
            properties: {
              headline: { type: 'string' },
              briefing_text: { type: 'string' },
              action_items: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 5,
              },
              recovery_shoutout: { type: 'string' },
            },
            required: ['headline', 'briefing_text', 'action_items', 'recovery_shoutout'],
            additionalProperties: false,
          },
        },
        required: ['dashboard_summary'],
        additionalProperties: false,
      },
    };
  }
}

export default new InsightService();
