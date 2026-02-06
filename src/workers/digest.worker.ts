import cron from 'node-cron';
import db from '../db/client';
import reportService from '../services/report.service';
import followUpService from '../services/followup.service';

/**
 * Weekly Digest Worker
 *
 * Sends Monday Morning Performance Digests to all customers
 * Runs every Monday at 8:00 AM (configurable per customer)
 *
 * Cron Schedule: '0 8 * * 1' (8 AM every Monday)
 */

export class DigestWorker {
  /**
   * Start the cron job
   */
  start(): void {
    // Run every Monday at 8:00 AM
    cron.schedule('0 8 * * 1', async () => {
      await this.sendWeeklyDigests();
    });

    console.log('[DigestWorker] Started - sending weekly digests every Monday at 8 AM');
  }

  /**
   * Send weekly digests to all eligible customers
   */
  async sendWeeklyDigests(): Promise<void> {
    try {
      console.log('[DigestWorker] Sending weekly digests...');

      // Get all customers with weekly digest enabled
      const customers = await db.query<any>(
        `SELECT customer_id, company_name, notification_email, timezone
         FROM customers
         WHERE weekly_digest_enabled = true
           AND notification_email IS NOT NULL
           AND deleted_at IS NULL
         ORDER BY company_name`
      );

      console.log(`[DigestWorker] Found ${customers.length} customers eligible for digest`);

      for (const customer of customers) {
        await this.sendDigestToCustomer(customer);
      }

      console.log('[DigestWorker] All weekly digests sent');
    } catch (error) {
      console.error('[DigestWorker] Error sending weekly digests:', error);
    }
  }

  /**
   * Send digest to a single customer
   */
  private async sendDigestToCustomer(customer: any): Promise<void> {
    try {
      // Check office hours (8 AM - 8 PM in customer's timezone)
      const timezone = customer.timezone || 'America/Chicago';
      if (!followUpService.isOfficeHours(timezone)) {
        console.log(
          `[DigestWorker] Skipping ${customer.company_name} - outside office hours in ${timezone}`
        );
        return;
      }

      // Check if digest was already sent this week
      const lastSent = await this.getLastDigestSent(customer.customer_id);
      if (lastSent && this.isThisWeek(lastSent)) {
        console.log(
          `[DigestWorker] Digest already sent this week for ${customer.company_name}`
        );
        return;
      }

      console.log(`[DigestWorker] Sending digest to ${customer.company_name}...`);

      // Generate and send digest
      await reportService.sendWeeklyDigest(customer.customer_id);

      console.log(
        `[DigestWorker] Successfully sent digest to ${customer.notification_email}`
      );
    } catch (error) {
      console.error(
        `[DigestWorker] Failed to send digest to ${customer.company_name}:`,
        error
      );
    }
  }

  /**
   * Get last digest sent timestamp
   */
  private async getLastDigestSent(customerId: string): Promise<Date | null> {
    const result = await db.query<{ last_digest_sent_at: Date }>(
      `SELECT last_digest_sent_at FROM customers WHERE customer_id = $1`,
      [customerId]
    );

    return result[0]?.last_digest_sent_at || null;
  }

  /**
   * Check if date is within this week (Monday-Sunday)
   */
  private isThisWeek(date: Date): boolean {
    const now = new Date();
    const weekStart = new Date(now);

    // Get Monday of this week
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // If Sunday (0), go back 6 days; otherwise go to Monday
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    return date >= weekStart;
  }
}

export default new DigestWorker();
