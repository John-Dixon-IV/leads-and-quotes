import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_RETRIES = 1;

/**
 * Production-grade Claude Service with optimized prompts
 * Based on the production lead intake prompt specification
 */

interface LeadQualificationRequest {
  customerContext: {
    services: string[];
    serviceArea: string;
    companyName: string;
  };
  conversationHistory: Array<{
    sender: 'visitor' | 'ai';
    content: string;
  }>;
  currentMessage: string;
  visitorInfo: {
    name?: string;
    phone?: string;
    address?: string;
  };
}

interface LeadQualificationResponse {
  lead_metadata: {
    name: string | null;
    phone: string | null;
    address: string | null;
    service: string | null;
  };
  classification: {
    category: 'New Lead' | 'Junk';
    urgency_score: number;
    is_out_of_area: boolean;
  };
  response: {
    assistant_reply: string;
    next_action: 'ask_info' | 'emergency_handoff' | 'close' | 'generate_quote';
  };
}

interface QuoteGenerationRequest {
  customerContext: {
    pricingRules: any;
    serviceArea: string;
  };
  leadMetadata: {
    service: string;
    address?: string;
  };
  conversationHistory: Array<{
    sender: 'visitor' | 'ai';
    content: string;
  }>;
}

interface QuoteGenerationResponse {
  quote: {
    estimated_range: string | null;
    factors: string[];
    next_steps: string;
  };
  reply_message: string;
  confidence: number;
}

const FALLBACK_RESPONSE: LeadQualificationResponse = {
  lead_metadata: {
    name: null,
    phone: null,
    address: null,
    service: null,
  },
  classification: {
    category: 'New Lead',
    urgency_score: 0.5,
    is_out_of_area: false,
  },
  response: {
    assistant_reply:
      "Thanks for reaching out! We've received your message and will get back to you shortly.",
    next_action: 'close',
  },
};

export class ProductionClaudeService {
  /**
   * Qualify lead using production-optimized prompt (Haiku)
   */
  async qualifyLead(
    request: LeadQualificationRequest
  ): Promise<LeadQualificationResponse> {
    const systemPrompt = this.buildLeadQualificationSystemPrompt(request.customerContext);
    const userPrompt = this.buildLeadQualificationUserPrompt(request);

    try {
      const response = await this.callClaudeWithRetry(
        'claude-haiku-4-5-20251001',
        systemPrompt,
        userPrompt,
        this.getLeadQualificationSchema()
      );

      return response as LeadQualificationResponse;
    } catch (error) {
      console.error('[ProductionClaudeService] Lead qualification failed:', error);
      return FALLBACK_RESPONSE;
    }
  }

  /**
   * Generate quote estimate using Sonnet
   */
  async generateQuote(
    request: QuoteGenerationRequest
  ): Promise<QuoteGenerationResponse> {
    const systemPrompt = this.buildQuoteSystemPrompt(request.customerContext);
    const userPrompt = this.buildQuoteUserPrompt(request);

    try {
      const response = await this.callClaudeWithRetry(
        'claude-sonnet-4-5-20250929',
        systemPrompt,
        userPrompt,
        this.getQuoteSchema()
      );

      return response as QuoteGenerationResponse;
    } catch (error) {
      console.error('[ProductionClaudeService] Quote generation failed:', error);
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
    schema: any,
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
        console.error(`[ProductionClaudeService] Attempt ${attempt + 1} failed:`, error);

        if (attempt === retries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  /**
   * Build production lead qualification system prompt
   */
  private buildLeadQualificationSystemPrompt(context: {
    services: string[];
    serviceArea: string;
    companyName: string;
  }): string {
    return `You are a Lead Qualification engine for ${context.companyName}, a home services company.

Your goal is to extract lead data and generate a structured JSON response.

AVAILABLE SERVICES: ${context.services.join(', ')}
SERVICE AREA: ${context.serviceArea}

STRICT RULES:
1. Respond ONLY with valid JSON matching the exact schema provided.
2. If the user's location is not in '${context.serviceArea}', set 'is_out_of_area': true.
3. Priority for missing info: 1. Service Type, 2. Phone Number, 3. Address. Ask for ONLY ONE missing item at a time.
4. Set 'urgency_score' to 0.9+ for active leaks, sparks, electrical issues, or safety hazards.
5. Set 'urgency_score' to 0.5-0.7 for routine maintenance or non-urgent repairs.
6. If the user is clearly a bot, solicitor, spam, or unrelated inquiry, set 'category': "Junk".
7. Extract service type from the conversation. If unclear, ask a clarifying question.
8. Once you have service type + phone number + address, set next_action to 'generate_quote'.
9. For emergencies (urgency_score >= 0.9), set next_action to 'emergency_handoff'.
10. Be concise and professional. Keep replies under 2 sentences when asking for info.

NEXT ACTIONS:
- 'ask_info': Missing critical information (service, phone, or address)
- 'generate_quote': Have all info needed for estimate
- 'emergency_handoff': Urgent safety issue requiring immediate human contact
- 'close': Junk lead or out of area

DO NOT:
- Invent prices or make up service offerings
- Provide quotes in this step (that happens separately)
- Be verbose or chatty
- Ask multiple questions at once`;
  }

  /**
   * Build user prompt for lead qualification
   */
  private buildLeadQualificationUserPrompt(request: LeadQualificationRequest): string {
    let prompt = '';

    // Add conversation history
    if (request.conversationHistory.length > 0) {
      prompt += 'CONVERSATION HISTORY:\n';
      request.conversationHistory.forEach((msg) => {
        prompt += `${msg.sender === 'visitor' ? 'Visitor' : 'Assistant'}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    // Add known visitor info
    if (request.visitorInfo.name || request.visitorInfo.phone || request.visitorInfo.address) {
      prompt += 'KNOWN VISITOR INFO:\n';
      if (request.visitorInfo.name) prompt += `Name: ${request.visitorInfo.name}\n`;
      if (request.visitorInfo.phone) prompt += `Phone: ${request.visitorInfo.phone}\n`;
      if (request.visitorInfo.address) prompt += `Address: ${request.visitorInfo.address}\n`;
      prompt += '\n';
    }

    // Add current message
    prompt += `CURRENT MESSAGE:\n${request.currentMessage}\n\n`;
    prompt += 'Analyze this message, extract lead metadata, classify the lead, and provide the next appropriate response.';

    return prompt;
  }

  /**
   * Build quote system prompt
   */
  private buildQuoteSystemPrompt(context: {
    pricingRules: any;
    serviceArea: string;
  }): string {
    return `You are a Quote Estimation engine for a home services company.

PRICING RULES:
${JSON.stringify(context.pricingRules, null, 2)}

SERVICE AREA: ${context.serviceArea}

YOUR JOB:
1. Generate an estimated price range based on the conversation and pricing rules
2. List specific factors affecting the estimate
3. Provide clear next steps for the customer

STRICT RULES:
- ONLY use pricing rules provided above
- If insufficient information, provide a wider range and list what's unknown
- Always include a disclaimer that final pricing requires on-site inspection
- Be transparent about what factors affect pricing (size, materials, complexity, etc.)
- Never guarantee exact prices
- Keep the reply concise and professional`;
  }

  /**
   * Build quote user prompt
   */
  private buildQuoteUserPrompt(request: QuoteGenerationRequest): string {
    let prompt = 'CONVERSATION HISTORY:\n';
    request.conversationHistory.forEach((msg) => {
      prompt += `${msg.sender === 'visitor' ? 'Visitor' : 'Assistant'}: ${msg.content}\n`;
    });

    prompt += `\nSERVICE REQUESTED: ${request.leadMetadata.service}\n`;
    if (request.leadMetadata.address) {
      prompt += `ADDRESS: ${request.leadMetadata.address}\n`;
    }

    prompt += '\nGenerate a price estimate based on the pricing rules and conversation details.';

    return prompt;
  }

  /**
   * JSON schema for lead qualification response
   */
  private getLeadQualificationSchema() {
    return {
      name: 'lead_qualification',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          lead_metadata: {
            type: 'object',
            properties: {
              name: { type: ['string', 'null'] },
              phone: { type: ['string', 'null'] },
              address: { type: ['string', 'null'] },
              service: { type: ['string', 'null'] },
            },
            required: ['name', 'phone', 'address', 'service'],
            additionalProperties: false,
          },
          classification: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: ['New Lead', 'Junk'] },
              urgency_score: { type: 'number', minimum: 0, maximum: 1 },
              is_out_of_area: { type: 'boolean' },
            },
            required: ['category', 'urgency_score', 'is_out_of_area'],
            additionalProperties: false,
          },
          response: {
            type: 'object',
            properties: {
              assistant_reply: { type: 'string' },
              next_action: {
                type: 'string',
                enum: ['ask_info', 'emergency_handoff', 'close', 'generate_quote'],
              },
            },
            required: ['assistant_reply', 'next_action'],
            additionalProperties: false,
          },
        },
        required: ['lead_metadata', 'classification', 'response'],
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

export default new ProductionClaudeService();
