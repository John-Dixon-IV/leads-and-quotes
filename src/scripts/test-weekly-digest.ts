import reportService from '../services/report.service';
import db from '../db/client';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Test Weekly Digest System
 *
 * This script manually triggers a weekly digest to test the report generation
 * without waiting for Monday morning.
 */

async function testWeeklyDigest() {
  try {
    console.log('[Test] Starting weekly digest test...\n');

    // Get test customer
    const customers = await db.query(
      `SELECT customer_id, company_name, notification_email, weekly_digest_enabled
       FROM customers
       WHERE email = 'test@contractor.com'
       LIMIT 1`
    );

    if (customers.length === 0) {
      console.error('[Test] No test customer found. Run: npm run seed');
      process.exit(1);
    }

    const customer = customers[0];
    console.log('[Test] Found test customer:');
    console.log(`  Company: ${customer.company_name}`);
    console.log(`  Email: ${customer.notification_email || 'Not set'}`);
    console.log(`  Digest Enabled: ${customer.weekly_digest_enabled}`);
    console.log('');

    if (!customer.weekly_digest_enabled) {
      console.warn('[Test] Weekly digest is disabled for this customer');
      console.warn('[Test] Enable with: UPDATE customers SET weekly_digest_enabled = true WHERE email = \'test@contractor.com\'');
      process.exit(1);
    }

    // Create some test leads for better digest content
    console.log('[Test] Creating test leads for digest...');

    const leadData = [
      {
        name: 'Sarah Johnson',
        phone: '512-555-1234',
        service: 'deck_repair',
        value: 1200,
        urgency: 0.9,
        recovered: false,
      },
      {
        name: 'Mike Davis',
        phone: '512-555-5678',
        service: 'fence_install',
        value: 800,
        urgency: 0.6,
        recovered: true,
      },
      {
        name: 'Lisa Anderson',
        phone: '512-555-9012',
        service: 'roofing',
        value: 2500,
        urgency: 0.95,
        recovered: false,
      },
      {
        name: 'Tom Wilson',
        phone: '512-555-3456',
        service: 'deck_repair',
        value: 1500,
        urgency: 0.85,
        recovered: true,
      },
    ];

    for (const lead of leadData) {
      await db.query(
        `INSERT INTO leads (
          customer_id,
          session_id,
          visitor_name,
          visitor_phone,
          classification,
          quote,
          is_qualified,
          is_complete,
          follow_up_sent,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() - INTERVAL '2 days')`,
        [
          customer.customer_id,
          `test-digest-${lead.name.replace(/\s/g, '-')}`,
          lead.name,
          lead.phone,
          JSON.stringify({
            service_type: lead.service,
            urgency_score: lead.urgency,
            category: 'Service Request',
            confidence: 0.95,
          }),
          JSON.stringify({
            estimated_range: `$${Math.round(lead.value * 0.8)}-$${lead.value}`,
            breakdown: { base_fee: 100 },
          }),
          true,
          true,
          lead.recovered,
          'qualified',
        ]
      );
    }

    console.log(`[Test] Created ${leadData.length} test leads\n`);

    // Generate and send digest
    console.log('[Test] Generating weekly digest...');
    console.log('[Test] This may take 10-15 seconds (using Claude Sonnet)...\n');

    const digest = await reportService.generateWeeklyDigest(customer.customer_id);

    console.log('[Test] ✓ Digest generated!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Subject: ${digest.subject_line}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(digest.email_body);
    console.log('\n═══════════════════════════════════════════════════════════');

    // Send digest
    console.log('\n[Test] Sending digest...');
    await reportService.sendWeeklyDigest(customer.customer_id);
    console.log('[Test] ✓ Digest sent!\n');

    // Check notification log
    console.log('[Test] Checking notification log...');
    const notifications = await db.query(
      `SELECT notification_type, channel, recipient, subject, status, sent_at
       FROM notifications
       WHERE customer_id = $1 AND notification_type = 'weekly_digest'
       ORDER BY created_at DESC
       LIMIT 1`,
      [customer.customer_id]
    );

    if (notifications.length > 0) {
      const n = notifications[0];
      console.log(`[Test] Latest digest notification:`);
      console.log(`  Channel: ${n.channel}`);
      console.log(`  Recipient: ${n.recipient}`);
      console.log(`  Subject: ${n.subject}`);
      console.log(`  Status: ${n.status}`);
      console.log(`  Sent: ${n.sent_at || 'Not sent yet'}`);
      console.log('');
    }

    console.log('[Test] ✅ Weekly digest test completed successfully!');
    console.log('[Test] Note: In development, emails are logged but not actually sent.');
    console.log('[Test] To send real emails, integrate SendGrid/SES in report.service.ts');

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('[Test] Failed:', error);
    await db.close();
    process.exit(1);
  }
}

testWeeklyDigest();
