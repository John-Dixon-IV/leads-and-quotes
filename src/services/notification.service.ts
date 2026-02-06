import Anthropic from '@anthropic-ai/sdk';
import db from '../db/client';
import * as dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_RETRIES = 1;

/**
 * Multi-Channel Notification Service
 * Sends real-time alerts for hot leads via SMS/Email
 * Uses Claude Haiku to generate ultra-concise 160-char messages
 */

interface HotLeadAlert {
  lead_id: string;
  customer_id: string;
  urgency_level: 'HOT' | 'URGENT' | 'EMERGENCY';
  service_type: string;
  visitor_name: string | null;
  estimated_value: number;
  urgency_score: number;
  notes?: string;
}

interface AlertMessage {
  sms: string; // Max 160 chars
  email_subject: string;
  email_body: string;
}

export class NotificationService {
  /**
   * Send hot lead alert via SMS and/or email
   */
  async sendHotLeadAlert(alert: HotLeadAlert): Promise<void> {
    try {
      // Get customer notification preferences
      const customer = await this.getCustomerNotificationPrefs(alert.customer_id);

      if (!customer || !customer.alert_on_hot_lead) {
        console.log(
          `[NotificationService] Hot lead alerts disabled for customer ${alert.customer_id}`
        );
        return;
      }

      // Generate alert message using Haiku
      const message = await this.generateAlertMessage(alert);

      // Send SMS if phone number configured
      if (customer.notification_phone) {
        await this.sendSMS(
          alert.customer_id,
          alert.lead_id,
          customer.notification_phone,
          message.sms
        );
      }

      // Send email if email configured
      if (customer.notification_email) {
        await this.sendEmail(
          alert.customer_id,
          alert.lead_id,
          customer.notification_email,
          message.email_subject,
          message.email_body
        );
      }

      console.log(`[NotificationService] Hot lead alert sent for lead ${alert.lead_id}`);
    } catch (error) {
      console.error('[NotificationService] Failed to send hot lead alert:', error);
    }
  }

  /**
   * Generate alert message using Haiku (160 char SMS + email)
   */
  private async generateAlertMessage(alert: HotLeadAlert): Promise<AlertMessage> {
    const systemPrompt = this.buildAlertSystemPrompt();
    const userPrompt = JSON.stringify(alert, null, 2);

    try {
      const response = await this.callClaudeWithRetry(
        'claude-haiku-4-5-20251001',
        systemPrompt,
        userPrompt,
        this.getAlertSchema()
      );

      // Validate SMS length
      if (response.sms.length > 160) {
        console.warn('[NotificationService] SMS too long, truncating');
        response.sms = response.sms.substring(0, 157) + '...';
      }

      return response as AlertMessage;
    } catch (error) {
      console.error('[NotificationService] Alert generation failed:', error);

      // Fallback message
      const name = alert.visitor_name || 'Customer';
      const value = alert.estimated_value > 0 ? `($${alert.estimated_value})` : '';
      return {
        sms: `🔥 ${alert.urgency_level}: ${alert.service_type} - ${name} ${value}. Check dashboard now.`,
        email_subject: `🔥 ${alert.urgency_level} Lead: ${alert.service_type}`,
        email_body: `New ${alert.urgency_level.toLowerCase()} lead: ${alert.service_type} for ${name}. Estimated value: $${alert.estimated_value}. Check your dashboard to respond.`,
      };
    }
  }

  /**
   * Send SMS (placeholder - integrate with Twilio/AWS SNS)
   */
  private async sendSMS(
    customerId: string,
    leadId: string,
    phoneNumber: string,
    message: string
  ): Promise<void> {
    try {
      // TODO: Integrate with Twilio or AWS SNS
      console.log(`[NotificationService] SMS to ${phoneNumber}: ${message}`);

      // Log notification in database
      await db.query(
        `INSERT INTO notifications (customer_id, lead_id, notification_type, channel, recipient, content, status)
         VALUES ($1, $2, 'hot_lead_sms', 'sms', $3, $4, 'sent')`,
        [customerId, leadId, phoneNumber, message]
      );

      // In production, uncomment and configure:
      /*
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      */
    } catch (error) {
      console.error('[NotificationService] SMS send failed:', error);
      await this.logFailedNotification(customerId, leadId, 'sms', phoneNumber, error);
    }
  }

  /**
   * Send Email (placeholder - integrate with SendGrid/AWS SES)
   */
  private async sendEmail(
    customerId: string,
    leadId: string,
    email: string,
    subject: string,
    body: string
  ): Promise<void> {
    try {
      // TODO: Integrate with SendGrid or AWS SES
      console.log(`[NotificationService] Email to ${email}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${body}`);

      // Log notification in database
      await db.query(
        `INSERT INTO notifications (customer_id, lead_id, notification_type, channel, recipient, subject, content, status)
         VALUES ($1, $2, 'hot_lead_email', 'email', $3, $4, $5, 'sent')`,
        [customerId, leadId, email, subject, body]
      );

      // In production, uncomment and configure:
      /*
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: subject,
        text: body,
        html: `<p>${body.replace(/\n/g, '<br>')}</p>`
      });
      */
    } catch (error) {
      console.error('[NotificationService] Email send failed:', error);
      await this.logFailedNotification(customerId, leadId, 'email', email, error);
    }
  }

  /**
   * Get customer notification preferences
   */
  private async getCustomerNotificationPrefs(customerId: string): Promise<any> {
    const result = await db.query(
      `SELECT notification_email, notification_phone, alert_on_hot_lead, weekly_digest_enabled
       FROM customers
       WHERE customer_id = $1 AND deleted_at IS NULL`,
      [customerId]
    );

    return result[0] || null;
  }

  /**
   * Log failed notification
   */
  private async logFailedNotification(
    customerId: string,
    leadId: string,
    channel: string,
    recipient: string,
    error: any
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO notifications (customer_id, lead_id, notification_type, channel, recipient, content, status, error_message)
         VALUES ($1, $2, $3, $4, $5, '', 'failed', $6)`,
        [customerId, leadId, `hot_lead_${channel}`, channel, recipient, error.message]
      );
    } catch (logError) {
      console.error('[NotificationService] Failed to log error:', logError);
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
        console.error(`[NotificationService] Attempt ${attempt + 1} failed:`, error);

        if (attempt === retries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  /**
   * Build system prompt for hot lead alerts
   */
  private buildAlertSystemPrompt(): string {
    return `You are an Emergency Dispatcher. Generate an ultra-concise SMS/Push notification for a contractor.

RULES:
- SMS: Limit to 160 characters (SMS compatible).
- Format: [Urgency Emoji + Level] Service Type - Name - Estimated Value.
- Include a 'Call to Action' (e.g., 'Check dashboard' or 'Call now').

URGENCY EMOJIS:
- EMERGENCY: 🚨
- URGENT: 🔥
- HOT: ⚡

EXAMPLES:

🚨 EMERGENCY: Roofing for Lisa ($1,500). Active leak! Call now: 512-555-1234

🔥 URGENT: Deck Repair for Sarah ($1,200). Safety issue. View in Dashboard now.

⚡ HOT: Fence Install for Mike ($2,000). Ready to book. Check dashboard.

EMAIL:
- Subject: Concise, includes urgency and service
- Body: 2-3 sentences with call to action

Remember: SMS MUST be ≤160 characters. Be ultra-concise but informative.`;
  }

  /**
   * JSON schema for alert response
   */
  private getAlertSchema() {
    return {
      name: 'hot_lead_alert',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          sms: { type: 'string', maxLength: 160 },
          email_subject: { type: 'string' },
          email_body: { type: 'string' },
        },
        required: ['sms', 'email_subject', 'email_body'],
        additionalProperties: false,
      },
    };
  }
}

export default new NotificationService();
