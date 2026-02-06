import { z } from 'zod';

// Widget API request/response types

export const WidgetMessageRequestSchema = z.object({
  session_id: z.string().uuid(),
  visitor: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }).optional(),
  message: z.string().min(1).max(2000),
});

export type WidgetMessageRequest = z.infer<typeof WidgetMessageRequestSchema>;

export interface WidgetMessageResponse {
  lead_id: string;
  classification: {
    service_type: string;
    urgency: 'low' | 'medium' | 'high';
    confidence: number;
  } | null;
  quote: {
    estimated_range: string | null;
    factors: string[];
    next_steps: string;
  } | null;
  requires_followup: boolean;
  reply_message: string;
  conversation_ended: boolean;
}

export interface WidgetConfigResponse {
  brand: {
    color: string;
    logo_url: string | null;
    company_name: string;
  };
  behavior: {
    greeting: string;
    enable_quote_estimates: boolean;
  };
}

// Error response
export interface ErrorResponse {
  error: string;
  code: string;
  details?: any;
}
