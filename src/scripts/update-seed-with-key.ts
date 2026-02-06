import db from '../db/client';

/**
 * Helper script to retrieve the API key for testing the widget
 */
async function getApiKey() {
  try {
    console.log('[Get API Key] Fetching test customer API key...\n');

    const customers = await db.query(
      `SELECT customer_id, email, api_key, company_name
       FROM customers
       WHERE email = 'test@contractor.com'
       LIMIT 1`
    );

    if (customers.length === 0) {
      console.log('❌ No test customer found. Run: npm run db:seed\n');
      process.exit(1);
    }

    const customer = customers[0];

    console.log('✅ Test Customer Found:\n');
    console.log(`   Company: ${customer.company_name}`);
    console.log(`   Email: ${customer.email}`);
    console.log(`   Customer ID: ${customer.customer_id}`);
    console.log(`   API Key: ${customer.api_key}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Widget Embed Code:\n');
    console.log(`   <script src="http://localhost:3000/widget.js?key=${customer.api_key}"></script>\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🌐 Test URLs:\n');
    console.log(`   Demo Page: http://localhost:3000/demo?key=${customer.api_key}`);
    console.log(`   Health Check: http://localhost:3000/health\n`);

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('[Get API Key] Error:', error);
    await db.close();
    process.exit(1);
  }
}

getApiKey();
