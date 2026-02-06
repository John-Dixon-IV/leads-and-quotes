// Domain entity types

export interface Customer {
  customer_id: string;
  email: string;
  password_hash: string;
  api_key: string;
  company_name: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  business_info: BusinessInfo;
  pricing_rules: PricingRules;
  ai_prompts: AIPrompts;
  subscription_tier: string;
  is_active: boolean;
  rate_limit_messages_per_session: number;
  rate_limit_leads_per_day: number;
}

export interface BusinessInfo {
  services?: string[];
  service_area?: string;
  contact_info?: {
    phone?: string;
    email?: string;
  };
}

export interface PricingRules {
  [serviceType: string]: {
    base_rate_per_sqft?: number;
    min_charge?: number;
    estimated_range?: string;
  };
}

export interface AIPrompts {
  system_prompt?: string;
  greeting?: string;
}

export interface Lead {
  lead_id: string;
  customer_id: string;
  session_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  classification: Classification | null;
  quote: Quote | null;
  status: LeadStatus;
  needs_review: boolean;
  is_qualified: boolean;
  message_count: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  expires_at: Date;
}

export type LeadStatus = 'new' | 'qualified' | 'contacted' | 'quoted' | 'won' | 'lost';

export interface Classification {
  service_type: string;
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface Quote {
  estimated_range: string | null;
  factors: string[];
  next_steps: string;
}

export interface Message {
  message_id: string;
  lead_id: string;
  sender: 'visitor' | 'ai';
  content: string;
  claude_model: string | null;
  confidence: number | null;
  created_at: Date;
  deleted_at: Date | null;
  expires_at: Date;
}

export interface Session {
  session_id: string;
  customer_id: string;
  message_count: number;
  created_at: Date;
  last_activity_at: Date;
  expires_at: Date;
}

export interface Followup {
  followup_id: string;
  lead_id: string;
  scheduled_at: Date;
  status: 'pending' | 'sent' | 'failed';
  content: string | null;
  channel: 'email' | 'sms';
  trigger_type: 'inactivity' | 'missing_info' | null;
  sent_at: Date | null;
  created_at: Date;
  deleted_at: Date | null;
}

export interface WidgetConfig {
  config_id: string;
  customer_id: string;
  appearance: WidgetAppearance;
  behavior: WidgetBehavior;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface WidgetAppearance {
  color?: string;
  logo_url?: string;
  company_name?: string;
}

export interface WidgetBehavior {
  greeting?: string;
  enable_quote_estimates?: boolean;
}
