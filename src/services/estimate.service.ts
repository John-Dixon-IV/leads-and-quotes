import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_RETRIES = 1;

/**
 * Estimate & Quote Engine Service
 * Uses Claude 3.5 Sonnet for accurate pricing calculations
 * Triggered when classification returns next_action: 'generate_quote'
 */

interface PricingRule {
  unit: string; // 'sq_ft', 'linear_ft', 'flat_rate'
  min: number;
  max: number;
  base_fee?: number;
  service_call_fee?: number;
}

interface EstimateRequest {
  business_context: {
    pricing_rules: {
      [service_type: string]: PricingRule;
    };
  };
  lead_data: {
    service: string;
    dimensions?: {
      value: number;
      unit: string;
    };
    notes?: string;
  };
}

interface EstimateResponse {
  quote: {
    estimated_range: string;
    is_calculated: boolean;
    breakdown: {
      base_fee: number;
      estimated_labor_low: number;
      estimated_labor_high: number;
      buffer_applied: string;
    };
    assistant_reply: string;
    disclaimer: string;
  } | null;
  error: string | null;
}

const FALLBACK_ESTIMATE: EstimateResponse = {
  quote: null,
  error: 'Unable to generate estimate at this time. Please contact us directly for a quote.',
};

export class EstimateService {
  /**
   * Generate price estimate using Claude Sonnet
   */
  async generateEstimate(request: EstimateRequest): Promise<EstimateResponse> {
    const systemPrompt = this.buildEstimateSystemPrompt();
    const userPrompt = JSON.stringify(request, null, 2);

    try {
      const response = await this.callClaudeWithRetry(
        'claude-sonnet-4-5-20250929',
        systemPrompt,
        userPrompt,
        this.getEstimateSchema()
      );

      return response as EstimateResponse;
    } catch (error) {
      console.error('[EstimateService] Estimate generation failed:', error);
      return FALLBACK_ESTIMATE;
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
        console.error(`[EstimateService] Attempt ${attempt + 1} failed:`, error);

        if (attempt === retries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  /**
   * Build system prompt for estimate generation
   */
  private buildEstimateSystemPrompt(): string {
    return `You are a Senior Estimator for a home service business. Your goal is to provide a conservative, non-binding price range based ONLY on the provided pricing rules and lead data.

### ARITHMETIC RULES:
1. IDENTIFY: Match the 'service_type' to the 'pricing_rules'.
2. CALCULATE BASE: Multiply the 'unit_value' by the 'min_rate' and 'max_rate'.
3. ADD FEES: Add any 'base_fee' or 'service_call_fee' to both ends of the range.
4. BUFFER: Add a 15% 'complexity buffer' to the high-end of the range automatically.
5. ROUNDING: Round the final numbers to the nearest $5 or $10 for a professional look.

### STRICTURES:
- NEVER provide a single fixed number.
- ALWAYS use a range (e.g., "$450 - $575").
- REFUSE to provide a quote if the dimensions are missing or nonsensical (e.g., "0 sq ft").
- If dimensions are missing, set 'is_calculated' to false and provide a generic range from the pricing rules.
- MANDATORY DISCLAIMER: Include a footer stating that this is an estimate and a site visit is required for a final quote.

### OUTPUT FORMAT:
Respond ONLY with a JSON object. No prose.

### EXAMPLE CALCULATION:
Given:
- Service: deck_staining
- Dimensions: 200 sq_ft
- Pricing rule: min=$3.00/sq_ft, max=$5.00/sq_ft, base_fee=$100

Calculation:
1. Low estimate: (200 × $3.00) + $100 = $700
2. High estimate: (200 × $5.00) + $100 = $1,100
3. Apply 15% buffer to high end: $1,100 × 1.15 = $1,265
4. Round: $700 - $1,265
5. Result: "$700 - $1,265"

### ASSISTANT REPLY GUIDELINES:
- Start with "Based on [dimensions], my rough estimate for [service] is between [range]."
- Mention what's included (base fee, materials, labor).
- End with a clear Call to Action (CTA): "Would you like to schedule an on-site visit to finalize this?"
- Keep it conversational and professional.

### ERROR HANDLING:
If the service is not found in pricing_rules, return:
{
  "quote": null,
  "error": "We don't have pricing information for that service. Please contact us directly."
}

If dimensions are missing or invalid, return:
{
  "quote": null,
  "error": "I need more details about the project size to provide an estimate. Can you share the dimensions?"
}`;
  }

  /**
   * JSON schema for estimate response
   */
  private getEstimateSchema() {
    return {
      name: 'estimate_response',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          quote: {
            type: ['object', 'null'],
            properties: {
              estimated_range: { type: 'string' },
              is_calculated: { type: 'boolean' },
              breakdown: {
                type: 'object',
                properties: {
                  base_fee: { type: 'number' },
                  estimated_labor_low: { type: 'number' },
                  estimated_labor_high: { type: 'number' },
                  buffer_applied: { type: 'string' },
                },
                required: [
                  'base_fee',
                  'estimated_labor_low',
                  'estimated_labor_high',
                  'buffer_applied',
                ],
                additionalProperties: false,
              },
              assistant_reply: { type: 'string' },
              disclaimer: { type: 'string' },
            },
            required: [
              'estimated_range',
              'is_calculated',
              'breakdown',
              'assistant_reply',
              'disclaimer',
            ],
            additionalProperties: false,
          },
          error: { type: ['string', 'null'] },
        },
        required: ['quote', 'error'],
        additionalProperties: false,
      },
    };
  }
}

export default new EstimateService();
