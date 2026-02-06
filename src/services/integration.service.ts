/**
 * Integration Service
 * Handles external integrations like QuickBooks Online, Zapier, etc.
 */

interface QBOCustomer {
  DisplayName: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  Notes?: string;
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
}

interface QBOEstimate {
  CustomerRef: {
    value: string; // Will be populated after customer creation
    name: string;
  };
  TxnDate: string; // YYYY-MM-DD
  Line: Array<{
    DetailType: 'SalesItemLineDetail';
    Amount: number;
    Description: string;
    SalesItemLineDetail: {
      Qty: number;
      UnitPrice: number;
      ItemRef?: {
        value: string;
        name: string;
      };
    };
  }>;
  TotalAmt: number;
  PrivateNote?: string;
}

interface QBOPayload {
  customer: QBOCustomer;
  estimate: QBOEstimate;
  metadata: {
    lead_id: string;
    customer_id: string;
    service_type: string;
    urgency_score: number;
    confidence: number;
    estimated_range: string;
    created_at: string;
  };
}

export class IntegrationService {
  /**
   * Generate QuickBooks Online payload for lead and quote
   * Ready for webhook or direct API integration
   */
  generateQBOPayload(lead: any, quote: any, customer: any): QBOPayload {
    // Validate required fields
    if (!lead || !quote) {
      throw new Error('Lead and quote are required for QBO payload generation');
    }

    // Extract lead metadata
    const visitorName = lead.visitor_name || 'Unknown Customer';
    const visitorEmail = lead.visitor_email;
    const visitorPhone = lead.visitor_phone;
    const visitorAddress = lead.visitor_address;
    const serviceType = lead.classification?.service_type || 'general_service';
    const estimatedRange = quote.estimated_range || '$0-$0';

    // Parse estimated range to get high-end value
    const highEndMatch = estimatedRange.match(/\$?[\d,]+(?:\.\d{2})?$/);
    const highEndValue = highEndMatch
      ? parseFloat(highEndMatch[0].replace(/[$,]/g, ''))
      : 0;

    // Parse breakdown for line items
    const breakdown = quote.breakdown || {};
    const baseFee = breakdown.base_fee || 0;
    const laborLow = breakdown.estimated_labor_low || 0;
    const laborHigh = breakdown.estimated_labor_high || 0;

    // Build QBO Customer
    const qboCustomer: QBOCustomer = {
      DisplayName: visitorName,
      Notes: `Lead captured via AI chat widget on ${new Date(lead.created_at).toLocaleDateString()}`,
    };

    if (visitorEmail) {
      qboCustomer.PrimaryEmailAddr = {
        Address: visitorEmail,
      };
    }

    if (visitorPhone) {
      qboCustomer.PrimaryPhone = {
        FreeFormNumber: visitorPhone,
      };
    }

    // Parse address if available (format: "123 Main St, Austin")
    if (visitorAddress) {
      const addressParts = visitorAddress.split(',').map((s) => s.trim());
      qboCustomer.BillAddr = {
        Line1: addressParts[0] || '',
        City: addressParts[1] || '',
      };
    }

    // Build QBO Estimate
    const qboEstimate: QBOEstimate = {
      CustomerRef: {
        value: '', // Will be populated after customer creation in QBO
        name: visitorName,
      },
      TxnDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      Line: [],
      TotalAmt: highEndValue,
      PrivateNote: [
        `Service: ${serviceType.replace(/_/g, ' ')}`,
        `Urgency: ${lead.classification?.urgency || 'N/A'}`,
        `Confidence: ${lead.classification?.confidence || 'N/A'}`,
        `Lead ID: ${lead.lead_id}`,
        quote.assistant_reply ? `Notes: ${quote.assistant_reply}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };

    // Add line items
    if (baseFee > 0) {
      qboEstimate.Line.push({
        DetailType: 'SalesItemLineDetail',
        Amount: baseFee,
        Description: 'Base Service Fee',
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: baseFee,
          ItemRef: {
            value: '1', // Default service item ID
            name: 'Service Fee',
          },
        },
      });
    }

    // Add labor line item (using high-end estimate)
    if (laborHigh > 0) {
      qboEstimate.Line.push({
        DetailType: 'SalesItemLineDetail',
        Amount: laborHigh,
        Description: `${serviceType.replace(/_/g, ' ')} - Labor & Materials`,
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: laborHigh,
          ItemRef: {
            value: '2', // Default labor item ID
            name: 'Labor & Materials',
          },
        },
      });
    }

    // If no line items, add a single line for the total
    if (qboEstimate.Line.length === 0) {
      qboEstimate.Line.push({
        DetailType: 'SalesItemLineDetail',
        Amount: highEndValue,
        Description: `${serviceType.replace(/_/g, ' ')} - Estimate`,
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: highEndValue,
          ItemRef: {
            value: '1',
            name: 'Service',
          },
        },
      });
    }

    // Build complete payload
    const payload: QBOPayload = {
      customer: qboCustomer,
      estimate: qboEstimate,
      metadata: {
        lead_id: lead.lead_id,
        customer_id: customer.customer_id || lead.customer_id,
        service_type: serviceType,
        urgency_score: lead.classification?.urgency_score || 0,
        confidence: lead.classification?.confidence || 0,
        estimated_range: estimatedRange,
        created_at: lead.created_at,
      },
    };

    return payload;
  }

  /**
   * Validate QBO payload structure
   */
  validateQBOPayload(payload: QBOPayload): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate customer
    if (!payload.customer.DisplayName) {
      errors.push('Customer DisplayName is required');
    }

    // Validate estimate
    if (!payload.estimate.CustomerRef.name) {
      errors.push('Estimate CustomerRef.name is required');
    }

    if (!payload.estimate.TxnDate) {
      errors.push('Estimate TxnDate is required');
    }

    if (!payload.estimate.Line || payload.estimate.Line.length === 0) {
      errors.push('Estimate must have at least one line item');
    }

    if (payload.estimate.TotalAmt <= 0) {
      errors.push('Estimate TotalAmt must be greater than 0');
    }

    // Validate metadata
    if (!payload.metadata.lead_id) {
      errors.push('Metadata lead_id is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Mark lead as exported to QuickBooks
   */
  async markAsQBOExported(leadId: string, customerId: string): Promise<void> {
    const db = require('../db/client').default;

    await db.query(
      `UPDATE leads
       SET qbo_exported = true,
           qbo_exported_at = NOW()
       WHERE lead_id = $1 AND customer_id = $2`,
      [leadId, customerId]
    );

    console.log(`[IntegrationService] Lead ${leadId} marked as QBO exported`);
  }

  /**
   * Generate Zapier webhook payload (simplified format)
   */
  generateZapierPayload(lead: any, quote: any): any {
    return {
      lead_id: lead.lead_id,
      customer_id: lead.customer_id,
      visitor_name: lead.visitor_name,
      visitor_email: lead.visitor_email,
      visitor_phone: lead.visitor_phone,
      visitor_address: lead.visitor_address,
      service_type: lead.classification?.service_type,
      urgency: lead.classification?.urgency,
      urgency_score: lead.classification?.urgency_score,
      confidence: lead.classification?.confidence,
      estimated_range: quote?.estimated_range,
      estimated_high: quote?.breakdown?.estimated_labor_high || 0,
      base_fee: quote?.breakdown?.base_fee || 0,
      created_at: lead.created_at,
      notes: quote?.assistant_reply,
    };
  }
}

export default new IntegrationService();
