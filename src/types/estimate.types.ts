// Estimate service types

export interface PricingRule {
  unit: string; // 'sq_ft', 'linear_ft', 'flat_rate', 'hourly'
  min: number;
  max: number;
  base_fee?: number;
  service_call_fee?: number;
}

export interface EstimateRequest {
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

export interface EstimateBreakdown {
  base_fee: number;
  estimated_labor_low: number;
  estimated_labor_high: number;
  buffer_applied: string;
}

export interface Quote {
  estimated_range: string;
  is_calculated: boolean;
  breakdown: EstimateBreakdown;
  assistant_reply: string;
  disclaimer: string;
}

export interface EstimateResponse {
  quote: Quote | null;
  error: string | null;
}
