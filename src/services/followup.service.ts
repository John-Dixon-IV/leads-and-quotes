import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_RETRIES = 1;

/**
 * Ghost Buster Follow-Up Service
 * Uses Claude Haiku to generate one-sentence nudges for incomplete leads
 * MAX 15 WORDS, low-pressure, helpful tone
 */

interface FollowUpRequest {
  lead_details: {
    name: string | null;
    service_requested: string;
    missing_field: 'phone' | 'address' | 'dimensions';
    last_message_timestamp: string; // ISO8601
  };
  business_info: {
    name: string;
  };
}

interface FollowUpResponse {
  follow_up_message: string;
  strategy: 'address_nudge' | 'phone_nudge' | 'dimension_request';
  scheduled_delay_minutes: number;
}

const FALLBACK_NUDGE: FollowUpResponse = {
  follow_up_message: 'Still interested? Let me know!',
  strategy: 'phone_nudge',
  scheduled_delay_minutes: 15,
};

export class FollowUpService {
  /**
   * Generate follow-up nudge using Haiku
   */
  async generateFollowUp(request: FollowUpRequest): Promise<FollowUpResponse> {
    const systemPrompt = this.buildFollowUpSystemPrompt();
    const userPrompt = JSON.stringify(request, null, 2);

    try {
      const response = await this.callClaudeWithRetry(
        'claude-haiku-4-5-20251001',
        systemPrompt,
        userPrompt,
        this.getFollowUpSchema()
      );

      // Validate word count
      const wordCount = response.follow_up_message.split(/\s+/).length;
      if (wordCount > 15) {
        console.warn(
          `[FollowUpService] Message too long (${wordCount} words), using fallback`
        );
        return FALLBACK_NUDGE;
      }

      return response as FollowUpResponse;
    } catch (error) {
      console.error('[FollowUpService] Follow-up generation failed:', error);
      return FALLBACK_NUDGE;
    }
  }

  /**
   * Check if message indicates user wants to stop
   */
  isStopCommand(message: string): boolean {
    const stopPhrases = [
      'nevermind',
      'never mind',
      'no thanks',
      'not interested',
      'stop',
      'cancel',
      'forget it',
      'don\'t call',
      'don\'t contact',
      'leave me alone',
      'unsubscribe',
    ];

    const normalized = message.toLowerCase().trim();
    return stopPhrases.some((phrase) => normalized.includes(phrase));
  }

  /**
   * Check if current time is within office hours (7 AM - 9 PM local time)
   */
  isOfficeHours(timezone: string = 'America/Chicago'): boolean {
    try {
      const now = new Date();
      const localTime = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }).format(now);

      const hour = parseInt(localTime, 10);
      return hour >= 7 && hour < 21; // 7 AM to 9 PM
    } catch (error) {
      console.error('[FollowUpService] Timezone error:', error);
      return true; // Default to allowing if timezone check fails
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
          max_tokens: 256,
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
        console.error(`[FollowUpService] Attempt ${attempt + 1} failed:`, error);

        if (attempt === retries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  /**
   * Build system prompt for follow-up nudge
   */
  private buildFollowUpSystemPrompt(): string {
    return `You are a proactive, helpful assistant for a local home service business.

CONTEXT:
The user was in the middle of a chat but stopped responding. You have their name (if provided) and the service they were interested in.

GOAL:
Send a one-sentence "nudge" to get the missing information needed to provide a quote.

STRICT RULES:
1. MAX 15 WORDS.
2. No "salesy" language (e.g., avoid "Limited time offer" or "Act now").
3. Reference the specific service they mentioned (e.g., "deck repair").
4. If you have their name, use it.
5. Focus on the ONE missing field (Phone or Address or Dimensions).

TONE:
Helpful, local, and low-pressure.

EXAMPLES:

Missing Phone:
- "Hi John! Still interested in that deck repair? What's your phone number?"
- "Quick question about your fence project—what's the best number to reach you?"

Missing Address:
- "Hey Sarah! Need your address to estimate that roofing job."
- "Where's the deck located? I can get you a quick estimate."

Missing Dimensions:
- "How big is the deck you need repaired?"
- "What's the size of the fence you're looking to install?"

Remember: MAXIMUM 15 WORDS. Be friendly and helpful, not pushy.`;
  }

  /**
   * JSON schema for follow-up response
   */
  private getFollowUpSchema() {
    return {
      name: 'follow_up_nudge',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          follow_up_message: { type: 'string' },
          strategy: {
            type: 'string',
            enum: ['address_nudge', 'phone_nudge', 'dimension_request'],
          },
          scheduled_delay_minutes: { type: 'number', minimum: 15, maximum: 1440 },
        },
        required: ['follow_up_message', 'strategy', 'scheduled_delay_minutes'],
        additionalProperties: false,
      },
    };
  }
}

export default new FollowUpService();
