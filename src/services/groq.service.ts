import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import {
  ClaudeClassificationRequest,
  ClaudeClassificationResponse,
} from '../types/claude.types';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MAX_RETRIES = 1;

/**
 * Groq Service - Free LLM alternative for lead classification
 * Uses Llama 3.3 70B (free tier: 500K tokens/day)
 * Cost savings: ~$0.005/message vs $0/message
 */
export class GroqService {
  /**
   * Classify lead and generate initial response using Llama 3.3 70B
   */
  async classifyLead(
    request: ClaudeClassificationRequest
  ): Promise<ClaudeClassificationResponse> {
    const systemPrompt = this.buildClassificationSystemPrompt(request.customerContext);
    const userPrompt = this.buildClassificationUserPrompt(request);

    try {
      const response = await this.callGroqWithRetry(
        'llama-3.3-70b-versatile',
        systemPrompt,
        userPrompt
      );

      return response as ClaudeClassificationResponse;
    } catch (error) {
      console.error('[GroqService] Classification failed:', error);
      throw error; // Throw to allow fallback to Claude
    }
  }

  /**
   * Call Groq API with retry logic
   */
  private async callGroqWithRetry(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    retries: number = MAX_RETRIES
  ): Promise<any> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await groq.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 800,
          response_format: { type: 'json_object' }, // Force JSON output
        });

        const content = response.choices[0]?.message?.content || '';

        // Parse JSON response
        let jsonText = content.trim();

        // Strip markdown code blocks if present
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```(?:json)?\n?/, '');
          jsonText = jsonText.replace(/\n?```$/, '');
          jsonText = jsonText.trim();
        }

        return JSON.parse(jsonText);
      } catch (error) {
        console.error(`[GroqService] Attempt ${attempt + 1} failed:`, error);

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
   * Reuses same logic as Claude service for consistency
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
- If the service requested is not in the available services list, set service_type to "other" and ask for clarification
- You MUST respond with valid JSON only, no additional text`;
  }

  /**
   * Build user prompt for classification
   * Reuses same logic as Claude service for consistency
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
}

export default new GroqService();
