// Claude API types

export interface ClaudeClassificationRequest {
  customerContext: {
    services: string[];
    serviceArea: string;
    systemPrompt: string;
  };
  conversationHistory: Array<{
    sender: 'visitor' | 'ai';
    content: string;
  }>;
  currentMessage: string;
  visitorInfo: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface ClaudeClassificationResponse {
  classification: {
    service_type: string;
    urgency: 'low' | 'medium' | 'high';
    confidence: number;
  };
  reply_message: string;
  is_qualified: boolean;
  missing_info: string[];
}

export interface ClaudeQuoteRequest {
  customerContext: {
    services: string[];
    pricingRules: any;
    systemPrompt: string;
  };
  classification: {
    service_type: string;
    urgency: string;
  };
  conversationHistory: Array<{
    sender: 'visitor' | 'ai';
    content: string;
  }>;
  visitorInfo: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface ClaudeQuoteResponse {
  quote: {
    estimated_range: string | null;
    factors: string[];
    next_steps: string;
  };
  reply_message: string;
  confidence: number;
}

// Generic fallback response when Claude fails
export const FALLBACK_RESPONSE = {
  classification: {
    service_type: 'unknown',
    urgency: 'medium' as const,
    confidence: 0.0,
  },
  reply_message: "Thanks for reaching out! We've received your message and will get back to you shortly.",
  is_qualified: false,
  missing_info: [],
};
