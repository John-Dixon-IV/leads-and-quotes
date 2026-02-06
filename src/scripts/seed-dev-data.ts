import db from '../db/client';
import * as crypto from 'crypto';

/**
 * Seed development data
 * Creates a test customer with sample configuration
 */
async function seedDevData() {
  try {
    console.log('[Seed] Starting database seed...');

    const apiKey = crypto.randomBytes(32).toString('hex');
    const passwordHash = '$2b$10$dummyhash'; // In production, use bcrypt

    // Create test customer
    const customer = await db.query(
      `INSERT INTO customers (
        email,
        password_hash,
        api_key,
        company_name,
        notification_email,
        notification_phone,
        alert_on_hot_lead,
        weekly_digest_enabled,
        timezone,
        business_info,
        pricing_rules,
        ai_prompts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (email) DO UPDATE
      SET api_key = EXCLUDED.api_key,
          notification_email = EXCLUDED.notification_email,
          notification_phone = EXCLUDED.notification_phone,
          alert_on_hot_lead = EXCLUDED.alert_on_hot_lead,
          weekly_digest_enabled = EXCLUDED.weekly_digest_enabled
      RETURNING customer_id, api_key`,
      [
        'test@contractor.com',
        passwordHash,
        apiKey,
        "Joe's Contracting & Home Services",
        'joe@contractor.com',
        '+15125550100',
        true,
        true,
        'America/Chicago',
        JSON.stringify({
          services: [
            'deck_repair',
            'deck_installation',
            'fence_repair',
            'fence_installation',
            'roofing',
            'siding',
            'gutter_cleaning',
          ],
          service_area: 'Austin, TX and surrounding areas',
          contact_info: {
            phone: '+1-512-555-0100',
            email: 'contact@joescontracting.com',
          },
        }),
        JSON.stringify({
          deck_repair: {
            base_rate_per_sqft: 4.5,
            min_charge: 500,
            estimated_range: '$500-$2,000',
          },
          deck_installation: {
            base_rate_per_sqft: 12,
            min_charge: 2000,
            estimated_range: '$2,000-$8,000',
          },
          fence_repair: {
            base_rate_per_sqft: 3,
            min_charge: 300,
            estimated_range: '$300-$1,500',
          },
          fence_installation: {
            base_rate_per_sqft: 8,
            min_charge: 1500,
            estimated_range: '$1,500-$5,000',
          },
          roofing: {
            base_rate_per_sqft: 5,
            min_charge: 3000,
            estimated_range: '$3,000-$15,000',
          },
        }),
        JSON.stringify({
          system_prompt: `You are a helpful assistant for Joe's Contracting & Home Services, a trusted contractor serving Austin, TX. You specialize in deck work, fencing, roofing, and siding. Be friendly, professional, and helpful. Ask clarifying questions when needed. Never provide exact quotes without on-site inspection.`,
          greeting: "Hi there! I'm here to help with your home improvement project. What can we help you with today?",
        }),
      ]
    );

    console.log('[Seed] Created test customer:');
    console.log(`  Customer ID: ${customer[0].customer_id}`);
    console.log(`  API Key: ${customer[0].api_key}`);
    console.log(`  Email: test@contractor.com`);
    console.log('\n[Seed] Use this API key in X-API-Key header for testing');

    // Create widget config
    await db.query(
      `INSERT INTO widget_configs (customer_id, appearance, behavior)
       VALUES ($1, $2, $3)
       ON CONFLICT (customer_id) DO UPDATE
       SET appearance = EXCLUDED.appearance, behavior = EXCLUDED.behavior`,
      [
        customer[0].customer_id,
        JSON.stringify({
          color: '#3B82F6',
          logo_url: null,
          company_name: "Joe's Contracting",
        }),
        JSON.stringify({
          greeting: "Hi there! I'm here to help with your home improvement project.",
          enable_quote_estimates: true,
        }),
      ]
    );

    console.log('[Seed] Created widget configuration');
    console.log('[Seed] Database seeding completed successfully');

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Failed to seed database:', error);
    await db.close();
    process.exit(1);
  }
}

seedDevData();
