import cron from 'node-cron';
import db from '../db/client';
import followUpService from '../services/followup.service';
import { Lead, Customer } from '../types/domain.types';

/**
 * Ghost Buster Follow-Up Worker
 *
 * Runs every 5 minutes to find incomplete leads and send automated nudges
 *
 * RULES:
 * 1. One-and-Done: Only one automated nudge per lead
 * 2. Office Hours: Only send between 7 AM - 9 PM local time
 * 3. Stop Command: Never send if user said "nevermind"
 * 4. Time Window: 15-30 minutes after last activity
 */

const FOLLOWUP_DELAY_MIN = 15; // minutes
const FOLLOWUP_DELAY_MAX = 30; // minutes

export class FollowUpWorker {
  /**
   * Start the cron job
   */
  start(): void {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.processIncompleteLeads();
    });

    console.log('[FollowUpWorker] Started - running every 5 minutes');
  }

  /**
   * Process incomplete leads and send nudges
   */
  async processIncompleteLeads(): Promise<void> {
    try {
      console.log('[FollowUpWorker] Checking for incomplete leads...');

      // Query leads that need follow-up
      const leads = await db.query<Lead & { customer_id: string }>(
        `SELECT l.*, c.customer_id, c.timezone, c.company_name
         FROM leads l
         JOIN customers c ON l.customer_id = c.customer_id
         WHERE l.is_complete = false
           AND l.follow_up_sent = false
           AND l.stopped = false
           AND l.deleted_at IS NULL
           AND l.updated_at > NOW() - INTERVAL '${FOLLOWUP_DELAY_MAX} minutes'
           AND l.updated_at < NOW() - INTERVAL '${FOLLOWUP_DELAY_MIN} minutes'
         ORDER BY l.updated_at ASC
         LIMIT 50`
      );

      console.log(`[FollowUpWorker] Found ${leads.length} leads to process`);

      for (const lead of leads) {
        await this.processLead(lead);
      }

      console.log('[FollowUpWorker] Processing complete');
    } catch (error) {
      console.error('[FollowUpWorker] Error processing leads:', error);
    }
  }

  /**
   * Process a single lead
   */
  private async processLead(lead: any): Promise<void> {
    try {
      // Check office hours (using customer's timezone)
      const timezone = lead.timezone || 'America/Chicago';
      if (!followUpService.isOfficeHours(timezone)) {
        console.log(
          `[FollowUpWorker] Skipping lead ${lead.lead_id} - outside office hours`
        );
        return;
      }

      // Get last message to check for stop command
      const lastMessage = await this.getLastMessage(lead.lead_id);
      if (lastMessage && followUpService.isStopCommand(lastMessage.content)) {
        console.log(
          `[FollowUpWorker] Marking lead ${lead.lead_id} as stopped (user said nevermind)`
        );
        await this.markLeadStopped(lead.lead_id);
        return;
      }

      // Determine missing field
      const missingField = this.getMissingField(lead);
      if (!missingField) {
        // Lead is actually complete, mark it
        await this.markLeadComplete(lead.lead_id);
        return;
      }

      // Get service name from classification
      const service = lead.classification?.service_type || 'your project';

      // Generate follow-up message
      const followUp = await followUpService.generateFollowUp({
        lead_details: {
          name: lead.visitor_name,
          service_requested: service,
          missing_field: missingField,
          last_message_timestamp: lead.updated_at.toISOString(),
        },
        business_info: {
          name: lead.company_name || 'Our Company',
        },
      });

      console.log(
        `[FollowUpWorker] Sending follow-up to lead ${lead.lead_id}: "${followUp.follow_up_message}"`
      );

      // Store follow-up message
      await db.query(
        `INSERT INTO messages (lead_id, sender, content, claude_model)
         VALUES ($1, 'ai', $2, 'claude-haiku-4-5-20251001')`,
        [lead.lead_id, followUp.follow_up_message]
      );

      // Mark follow-up as sent
      await db.query(
        `UPDATE leads SET follow_up_sent = true WHERE lead_id = $1`,
        [lead.lead_id]
      );

      // Schedule future follow-up if needed (store in followups table)
      await db.query(
        `INSERT INTO followups (lead_id, scheduled_at, content, trigger_type)
         VALUES ($1, NOW() + INTERVAL '${followUp.scheduled_delay_minutes} minutes', $2, 'inactivity')`,
        [lead.lead_id, followUp.follow_up_message]
      );

      console.log(`[FollowUpWorker] Successfully sent follow-up to lead ${lead.lead_id}`);
    } catch (error) {
      console.error(`[FollowUpWorker] Error processing lead ${lead.lead_id}:`, error);
    }
  }

  /**
   * Get last message from conversation
   */
  private async getLastMessage(leadId: string): Promise<any> {
    const messages = await db.query(
      `SELECT * FROM messages
       WHERE lead_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [leadId]
    );

    return messages[0] || null;
  }

  /**
   * Determine which field is missing
   */
  private getMissingField(lead: any): 'phone' | 'address' | 'dimensions' | null {
    const hasService = lead.classification?.service_type;
    const hasPhone = lead.visitor_phone;
    const hasAddress = lead.visitor_address;

    if (!hasService) return null; // Can't help without knowing the service

    if (!hasPhone) return 'phone';
    if (!hasAddress) return 'address';

    // Check if service needs dimensions (e.g., deck repair, fencing)
    const dimensionalServices = ['deck_repair', 'fence_install', 'roofing', 'flooring'];
    const needsDimensions = dimensionalServices.includes(lead.classification?.service_type);

    if (needsDimensions && !this.hasDimensions(lead)) {
      return 'dimensions';
    }

    return null; // Lead is complete
  }

  /**
   * Check if lead has dimensions in conversation
   */
  private hasDimensions(lead: any): boolean {
    // Check quote for dimensions
    if (lead.quote?.breakdown) {
      return true;
    }

    // Could also check messages for dimension keywords (sq ft, linear ft, etc.)
    // For MVP, assume if quote exists, dimensions were provided
    return false;
  }

  /**
   * Mark lead as complete
   */
  private async markLeadComplete(leadId: string): Promise<void> {
    await db.query(`UPDATE leads SET is_complete = true WHERE lead_id = $1`, [leadId]);
  }

  /**
   * Mark lead as stopped (user said "nevermind")
   */
  private async markLeadStopped(leadId: string): Promise<void> {
    await db.query(`UPDATE leads SET stopped = true WHERE lead_id = $1`, [leadId]);
  }
}

export default new FollowUpWorker();
