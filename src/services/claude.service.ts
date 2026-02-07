import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import {
  ClaudeClassificationRequest,
  ClaudeClassificationResponse,
  ClaudeQuoteRequest,
  ClaudeQuoteResponse,
  FALLBACK_RESPONSE,
} from '../types/claude.types';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_RETRIES = 1;

export class ClaudeService {
  /**
   * Classify lead and generate initial response using Haiku
   */
  async classifyLead(
    request: ClaudeClassificationRequest
  ): Promise<ClaudeClassificationResponse> {
    const systemPrompt = this.buildClassificationSystemPrompt(request.customerContext);
    const userPrompt = this.buildClassificationUserPrompt(request);

    try {
      const response = await this.callClaudeWithRetry(
        'claude-haiku-4-5-20251001',
        systemPrompt,
        userPrompt,
        this.getClassificationSchema()
      );

      return response as ClaudeClassificationResponse;
    } catch (error) {
      console.error('[ClaudeService] Classification failed:', error);
      return FALLBACK_RESPONSE;
    }
  }

  /**
   * Generate quote estimate using Sonnet (only if confidence >= 0.6)
   */
  async generateQuote(
    request: ClaudeQuoteRequest
  ): Promise<ClaudeQuoteResponse> {
    const systemPrompt = this.buildQuoteSystemPrompt(request.customerContext);
    const userPrompt = this.buildQuoteUserPrompt(request);

    try {
      const response = await this.callClaudeWithRetry(
        'claude-sonnet-4-5-20250929',
        systemPrompt,
        userPrompt,
        this.getQuoteSchema()
      );

      return response as ClaudeQuoteResponse;
    } catch (error) {
      console.error('[ClaudeService] Quote generation failed:', error);
      throw error;
    }
  }

  /**
   * Call Claude API with retry logic
   */
  private async callClaudeWithRetry(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    _schema: any,
    retries: number = MAX_RETRIES
  ): Promise<any> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        });

        const content = response.content[0];
        if (content.type === 'text') {
          // Strip markdown code blocks if present
          let jsonText = content.text.trim();
          if (jsonText.startsWith('```')) {
            // Remove ```json or ``` at start
            jsonText = jsonText.replace(/^```(?:json)?\n?/, '');
            // Remove ``` at end
            jsonText = jsonText.replace(/\n?```$/, '');
            jsonText = jsonText.trim();
          }
          return JSON.parse(jsonText);
        }

        throw new Error('Unexpected response format from Claude');
      } catch (error) {
        console.error(`[ClaudeService] Attempt ${attempt + 1} failed:`, error);

        if (attempt === retries) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  /**
   * Build system prompt for classification
   */
  private buildClassificationSystemPrompt(context: {
    services: string[];
    serviceArea: string;
    systemPrompt: string;
  }): string {
    const basePrompt = context.systemPrompt || `You are a helpful assistant for a contracting company that specializes in home services.`;

    return `${basePrompt}

Available services: ${context.services.join(', ')}
Service area: ${context.serviceArea}

Your job is to:
1. Classify the visitor's service request
2. Determine urgency (low, medium, high)
3. Assess your confidence in the classification (0.0 to 1.0)
4. Determine if the lead is qualified (has enough info for a quote)
5. Identify any missing information needed
6. Provide a helpful reply

CRITICAL RULES:
- NEVER invent prices or services not listed above
- If confidence < 0.6, ask clarifying questions instead of guessing
- Be concise and professional
- If the service requested is not in the available services list, set service_type to "other" and ask for clarification`;
  }

  /**
   * Build user prompt for classification
   */
  private buildClassificationUserPrompt(request: ClaudeClassificationRequest): string {
    let prompt = '';

    // Add conversation history
    if (request.conversationHistory.length > 0) {
      prompt += 'Previous conversation:\n';
      request.conversationHistory.forEach((msg) => {
        prompt += `${msg.sender === 'visitor' ? 'Visitor' : 'You'}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    // Add visitor info if available
    if (request.visitorInfo.name || request.visitorInfo.email || request.visitorInfo.phone) {
      prompt += 'Visitor information:\n';
      if (request.visitorInfo.name) prompt += `Name: ${request.visitorInfo.name}\n`;
      if (request.visitorInfo.email) prompt += `Email: ${request.visitorInfo.email}\n`;
      if (request.visitorInfo.phone) prompt += `Phone: ${request.visitorInfo.phone}\n`;
      prompt += '\n';
    }

    // Add current message
    prompt += `Current visitor message: ${request.currentMessage}\n\n`;
    prompt += `Respond with a JSON object in this exact structure:
{
  "classification": {
    "service_type": "string",
    "urgency": "low" | "medium" | "high",
    "confidence": 0.0 to 1.0
  },
  "reply_message": "string",
  "is_qualified": boolean,
  "missing_info": ["string"]
}`;

    return prompt;
  }

  /**
   * Build system prompt for quote generation
   */
  private buildQuoteSystemPrompt(context: {
    services: string[];
    pricingRules: any;
    systemPrompt: string;
  }): string {
    const basePrompt = context.systemPrompt || `You are a helpful assistant for a contracting company.`;

    return `${basePrompt}

Pricing rules (use these to estimate):
${JSON.stringify(context.pricingRules, null, 2)}

Your job is to:
1. Generate an estimated price range based on the conversation
2. List factors affecting the estimate
3. Provide clear next steps

CRITICAL RULES:
- ONLY use pricing rules provided above
- If insufficient information, provide a wider range and explain what's needed
- Always be transparent about what factors affect pricing
- Never guarantee exact prices without an on-site inspection`;
  }

  /**
   * Build user prompt for quote generation
   */
  private buildQuoteUserPrompt(request: ClaudeQuoteRequest): string {
    let prompt = 'Conversation history:\n';
    request.conversationHistory.forEach((msg) => {
      prompt += `${msg.sender === 'visitor' ? 'Visitor' : 'You'}: ${msg.content}\n`;
    });

    prompt += `\nClassified service: ${request.classification.service_type}\n`;
    prompt += `Urgency: ${request.classification.urgency}\n\n`;
    prompt += `Respond with a JSON object in this exact structure:
{
  "quote": {
    "estimate_low": number,
    "estimate_high": number,
    "factors": ["string"],
    "next_steps": "string"
  }
}`;

    return prompt;
  }

  /**
   * JSON schema for classification response
   */
  private getClassificationSchema() {
    return {
      name: 'lead_classification',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          classification: {
            type: 'object',
            properties: {
              service_type: { type: 'string' },
              urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['service_type', 'urgency', 'confidence'],
            additionalProperties: false,
          },
          reply_message: { type: 'string' },
          is_qualified: { type: 'boolean' },
          missing_info: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['classification', 'reply_message', 'is_qualified', 'missing_info'],
        additionalProperties: false,
      },
    };
  }

  /**
   * JSON schema for quote response
   */
  private getQuoteSchema() {
    return {
      name: 'quote_estimate',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          quote: {
            type: 'object',
            properties: {
              estimated_range: { type: ['string', 'null'] },
              factors: {
                type: 'array',
                items: { type: 'string' },
              },
              next_steps: { type: 'string' },
            },
            required: ['estimated_range', 'factors', 'next_steps'],
            additionalProperties: false,
          },
          reply_message: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['quote', 'reply_message', 'confidence'],
        additionalProperties: false,
      },
    };
  }
}

export default new ClaudeService();
