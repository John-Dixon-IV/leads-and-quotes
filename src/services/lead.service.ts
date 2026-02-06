import db from '../db/client';
import claudeService from './claude.service';
import notificationService from './notification.service';
import { Customer, Lead, Message } from '../types/domain.types';
import { WidgetMessageRequest, WidgetMessageResponse } from '../types/api.types';

const MAX_MESSAGES_PER_SESSION = 10;
const CONFIDENCE_THRESHOLD = 0.6;
const HOT_LEAD_URGENCY_THRESHOLD = 0.8;

export class LeadService {
  /**
   * Process incoming widget message
   */
  async processMessage(
    customer: Customer,
    request: WidgetMessageRequest
  ): Promise<WidgetMessageResponse> {
    // 1. Get or create lead for this session
    const lead = await this.getOrCreateLead(customer, request);

    // 2. Check message count limit
    if (lead.message_count >= MAX_MESSAGES_PER_SESSION) {
      return this.buildMaxMessagesResponse(lead);
    }

    // 3. Check if lead is already qualified (stop AI)
    if (lead.is_qualified) {
      return this.buildAlreadyQualifiedResponse(lead);
    }

    // 4. Store visitor message
    await this.storeMessage(lead.lead_id, 'visitor', request.message, null, null);

    // 5. Increment message count
    await this.incrementMessageCount(lead.lead_id);

    // 6. Get conversation history
    const conversationHistory = await this.getConversationHistory(lead.lead_id);

    // 7. Call Claude for classification
    const classificationResult = await claudeService.classifyLead({
      customerContext: {
        services: customer.business_info.services || [],
        serviceArea: customer.business_info.service_area || 'Not specified',
        systemPrompt: customer.ai_prompts.system_prompt || '',
      },
      conversationHistory,
      currentMessage: request.message,
      visitorInfo: {
        name: request.visitor?.name || lead.visitor_name || undefined,
        email: request.visitor?.email || lead.visitor_email || undefined,
        phone: request.visitor?.phone || lead.visitor_phone || undefined,
      },
    });

    // 8. Check if Claude failed (confidence = 0.0)
    const claudeFailed = classificationResult.classification.confidence === 0.0;
    if (claudeFailed) {
      await this.flagLeadNeedsReview(lead.lead_id);
    }

    // 9. Check confidence threshold
    const shouldGenerateQuote =
      classificationResult.classification.confidence >= CONFIDENCE_THRESHOLD &&
      classificationResult.is_qualified &&
      !claudeFailed;

    let quoteResult = null;
    let finalReplyMessage = classificationResult.reply_message;
    let conversationEnded = false;

    if (shouldGenerateQuote) {
      // 10. Generate quote using Sonnet
      try {
        quoteResult = await claudeService.generateQuote({
          customerContext: {
            services: customer.business_info.services || [],
            pricingRules: customer.pricing_rules,
            systemPrompt: customer.ai_prompts.system_prompt || '',
          },
          classification: {
            service_type: classificationResult.classification.service_type,
            urgency: classificationResult.classification.urgency,
          },
          conversationHistory,
          visitorInfo: {
            name: request.visitor?.name || lead.visitor_name || undefined,
            email: request.visitor?.email || lead.visitor_email || undefined,
            phone: request.visitor?.phone || lead.visitor_phone || undefined,
          },
        });

        finalReplyMessage = quoteResult.reply_message;
        conversationEnded = true;

        // Update lead with quote
        await this.updateLeadWithQuote(
          lead.lead_id,
          classificationResult.classification,
          quoteResult.quote,
          true
        );

        // Check if this is a hot lead and send alert
        await this.checkAndSendHotLeadAlert(
          customer.customer_id,
          lead.lead_id,
          classificationResult.classification,
          quoteResult.quote,
          request.visitor?.name || lead.visitor_name || 'Someone'
        );
      } catch (error) {
        console.error('[LeadService] Quote generation failed:', error);
        await this.flagLeadNeedsReview(lead.lead_id);
        quoteResult = null;
      }
    } else {
      // Just update classification
      await this.updateLeadClassification(
        lead.lead_id,
        classificationResult.classification,
        classificationResult.is_qualified
      );
    }

    // 11. Update visitor info if provided
    if (request.visitor) {
      await this.updateVisitorInfo(lead.lead_id, request.visitor);
    }

    // 12. Store AI response message
    await this.storeMessage(
      lead.lead_id,
      'ai',
      finalReplyMessage,
      shouldGenerateQuote ? 'claude-sonnet-4-5-20250929' : 'claude-haiku-4-5-20251001',
      classificationResult.classification.confidence
    );

    // 13. Increment message count for AI response
    await this.incrementMessageCount(lead.lead_id);

    // 14. Build response
    return {
      lead_id: lead.lead_id,
      classification: classificationResult.classification,
      quote: quoteResult?.quote || null,
      requires_followup: classificationResult.missing_info.length > 0,
      reply_message: finalReplyMessage,
      conversation_ended: conversationEnded,
    };
  }

  /**
   * Get or create lead for session
   */
  private async getOrCreateLead(
    customer: Customer,
    request: WidgetMessageRequest
  ): Promise<Lead> {
    // Try to find existing lead for this session
    const existing = await db.query<Lead>(
      `SELECT * FROM leads
       WHERE session_id = $1
       AND customer_id = $2
       AND deleted_at IS NULL
       LIMIT 1`,
      [request.session_id, customer.customer_id]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new lead
    const newLead = await db.query<Lead>(
      `INSERT INTO leads (customer_id, session_id, visitor_name, visitor_email, visitor_phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        customer.customer_id,
        request.session_id,
        request.visitor?.name || null,
        request.visitor?.email || null,
        request.visitor?.phone || null,
      ]
    );

    return newLead[0];
  }

  /**
   * Store message in database
   */
  private async storeMessage(
    leadId: string,
    sender: 'visitor' | 'ai',
    content: string,
    claudeModel: string | null,
    confidence: number | null
  ): Promise<void> {
    await db.query(
      `INSERT INTO messages (lead_id, sender, content, claude_model, confidence)
       VALUES ($1, $2, $3, $4, $5)`,
      [leadId, sender, content, claudeModel, confidence]
    );
  }

  /**
   * Increment message count
   */
  private async incrementMessageCount(leadId: string): Promise<void> {
    await db.query(
      `UPDATE leads SET message_count = message_count + 1 WHERE lead_id = $1`,
      [leadId]
    );
  }

  /**
   * Get conversation history
   */
  private async getConversationHistory(leadId: string): Promise<
    Array<{
      sender: 'visitor' | 'ai';
      content: string;
    }>
  > {
    const messages = await db.query<Message>(
      `SELECT sender, content FROM messages
       WHERE lead_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [leadId]
    );

    return messages.map((msg) => ({
      sender: msg.sender,
      content: msg.content,
    }));
  }

  /**
   * Update lead classification
   */
  private async updateLeadClassification(
    leadId: string,
    classification: any,
    isQualified: boolean
  ): Promise<void> {
    await db.query(
      `UPDATE leads
       SET classification = $1, is_qualified = $2
       WHERE lead_id = $3`,
      [JSON.stringify(classification), isQualified, leadId]
    );
  }

  /**
   * Update lead with quote
   */
  private async updateLeadWithQuote(
    leadId: string,
    classification: any,
    quote: any,
    isQualified: boolean
  ): Promise<void> {
    await db.query(
      `UPDATE leads
       SET classification = $1, quote = $2, is_qualified = $3, status = 'qualified'
       WHERE lead_id = $4`,
      [JSON.stringify(classification), JSON.stringify(quote), isQualified, leadId]
    );
  }

  /**
   * Update visitor info
   */
  private async updateVisitorInfo(
    leadId: string,
    visitor: { name?: string; email?: string; phone?: string }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (visitor.name) {
      updates.push(`visitor_name = $${paramIndex++}`);
      values.push(visitor.name);
    }
    if (visitor.email) {
      updates.push(`visitor_email = $${paramIndex++}`);
      values.push(visitor.email);
    }
    if (visitor.phone) {
      updates.push(`visitor_phone = $${paramIndex++}`);
      values.push(visitor.phone);
    }

    if (updates.length > 0) {
      values.push(leadId);
      await db.query(
        `UPDATE leads SET ${updates.join(', ')} WHERE lead_id = $${paramIndex}`,
        values
      );
    }
  }

  /**
   * Flag lead as needs review
   */
  private async flagLeadNeedsReview(leadId: string): Promise<void> {
    await db.query(`UPDATE leads SET needs_review = true WHERE lead_id = $1`, [leadId]);
  }

  /**
   * Build response when max messages reached
   */
  private buildMaxMessagesResponse(lead: Lead): WidgetMessageResponse {
    return {
      lead_id: lead.lead_id,
      classification: lead.classification as any,
      quote: lead.quote as any,
      requires_followup: true,
      reply_message:
        "Thanks for the detailed conversation! We've gathered all the information we need. One of our team members will reach out to you shortly to finalize the details.",
      conversation_ended: true,
    };
  }

  /**
   * Build response when lead already qualified
   */
  private buildAlreadyQualifiedResponse(lead: Lead): WidgetMessageResponse {
    return {
      lead_id: lead.lead_id,
      classification: lead.classification as any,
      quote: lead.quote as any,
      requires_followup: false,
      reply_message:
        "We've already captured your request! Our team will be in touch soon.",
      conversation_ended: true,
    };
  }

  /**
   * Check if lead is hot and send alert notification
   */
  private async checkAndSendHotLeadAlert(
    customerId: string,
    leadId: string,
    classification: any,
    quote: any,
    visitorName: string
  ): Promise<void> {
    try {
      const urgencyScore = parseFloat(classification.urgency_score || '0');

      if (urgencyScore >= HOT_LEAD_URGENCY_THRESHOLD) {
        // Extract estimated value from quote
        const estimatedRange = quote?.estimated_range || '$0';
        const highEnd = estimatedRange.split('-')[1]?.trim() || estimatedRange;
        const estimatedValue = parseInt(highEnd.replace(/[^0-9]/g, ''), 10) || 0;

        // Determine urgency level
        let urgencyLevel: 'EMERGENCY' | 'URGENT' | 'HOT' = 'HOT';
        if (urgencyScore >= 0.95) {
          urgencyLevel = 'EMERGENCY';
        } else if (urgencyScore >= 0.88) {
          urgencyLevel = 'URGENT';
        }

        // Send hot lead alert
        await notificationService.sendHotLeadAlert({
          customer_id: customerId,
          lead_id: leadId,
          visitor_name: visitorName,
          service_type: classification.service_type || 'service request',
          urgency_level: urgencyLevel,
          estimated_value: estimatedValue,
          urgency_score: urgencyScore,
        });

        console.log(`[LeadService] Hot lead alert sent for ${visitorName} (urgency: ${urgencyScore})`);
      }
    } catch (error) {
      // Don't fail the main flow if notification fails
      console.error('[LeadService] Failed to send hot lead alert:', error);
    }
  }
}

export default new LeadService();
