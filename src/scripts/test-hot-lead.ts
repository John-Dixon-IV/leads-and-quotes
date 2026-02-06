import notificationService from '../services/notification.service';
import db from '../db/client';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Test Hot Lead Alert System
 *
 * This script manually triggers a hot lead alert to test the notification system
 * without needing to go through the full widget flow.
 */

async function testHotLeadAlert() {
  try {
    console.log('[Test] Starting hot lead alert test...\n');

    // Get test customer
    const customers = await db.query(
      `SELECT customer_id, company_name, notification_email, notification_phone, alert_on_hot_lead
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
    console.log(`  Phone: ${customer.notification_phone || 'Not set'}`);
    console.log(`  Alerts Enabled: ${customer.alert_on_hot_lead}`);
    console.log('');

    if (!customer.alert_on_hot_lead) {
      console.warn('[Test] Hot lead alerts are disabled for this customer');
      console.warn('[Test] Enable with: UPDATE customers SET alert_on_hot_lead = true WHERE email = \'test@contractor.com\'');
      process.exit(1);
    }

    // Create a test lead
    const lead = await db.query(
      `INSERT INTO leads (
        customer_id,
        session_id,
        visitor_name,
        visitor_phone,
        classification,
        quote,
        is_qualified,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING lead_id`,
      [
        customer.customer_id,
        'test-hot-lead-session',
        'Sarah Johnson',
        '512-555-1234',
        JSON.stringify({
          service_type: 'deck_repair',
          urgency_score: 0.92,
          category: 'Service Request',
          confidence: 0.95,
        }),
        JSON.stringify({
          estimated_range: '$1,000-$1,200',
          breakdown: { base_fee: 100 },
        }),
        true,
        'qualified',
      ]
    );

    const leadId = lead[0].lead_id;
    console.log(`[Test] Created test lead: ${leadId}\n`);

    // Test different urgency levels
    const testCases = [
      {
        urgency_level: 'HOT' as const,
        urgency_score: 0.82,
        service_type: 'fence_repair',
        estimated_value: 800,
        visitor_name: 'Mike Davis',
      },
      {
        urgency_level: 'URGENT' as const,
        urgency_score: 0.90,
        service_type: 'deck_repair',
        estimated_value: 1200,
        visitor_name: 'Sarah Johnson',
      },
      {
        urgency_level: 'EMERGENCY' as const,
        urgency_score: 0.97,
        service_type: 'roofing',
        estimated_value: 2500,
        visitor_name: 'Lisa Anderson',
      },
    ];

    for (const testCase of testCases) {
      console.log(`[Test] Testing ${testCase.urgency_level} alert (urgency: ${testCase.urgency_score})...`);

      await notificationService.sendHotLeadAlert({
        customer_id: customer.customer_id,
        lead_id: leadId,
        visitor_name: testCase.visitor_name,
        service_type: testCase.service_type,
        urgency_level: testCase.urgency_level,
        estimated_value: testCase.estimated_value,
        urgency_score: testCase.urgency_score,
      });

      console.log(`[Test] ✓ ${testCase.urgency_level} alert sent\n`);

      // Wait 1 second between tests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Check notification log
    console.log('[Test] Checking notification log...');
    const notifications = await db.query(
      `SELECT notification_type, channel, recipient, content, status, sent_at
       FROM notifications
       WHERE customer_id = $1 AND notification_type = 'hot_lead_alert'
       ORDER BY created_at DESC
       LIMIT 6`,
      [customer.customer_id]
    );

    console.log(`[Test] Found ${notifications.length} notifications:\n`);
    notifications.forEach((n, i) => {
      console.log(`${i + 1}. [${n.channel.toUpperCase()}] to ${n.recipient}`);
      console.log(`   Status: ${n.status}`);
      console.log(`   Content: ${n.content.substring(0, 80)}...`);
      console.log('');
    });

    console.log('[Test] ✅ Hot lead alert test completed successfully!');
    console.log('[Test] Note: In development, SMS/Email are logged but not actually sent.');
    console.log('[Test] To send real notifications, integrate Twilio/SendGrid in notification.service.ts');

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('[Test] Failed:', error);
    await db.close();
    process.exit(1);
  }
}

testHotLeadAlert();
