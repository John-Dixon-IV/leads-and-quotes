/**
 * Admin Stats Verification
 * Tests platform-wide statistics and revenue tracking
 */

import db from '../src/db/client';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

interface TestMetrics {
  totalLeads: number;
  qualifiedLeads: number;
  quotedLeads: number;
  totalRevenue: number;
  actualRevenue: number;
  ghostBusterSent: number;
  ghostBusterRecovered: number;
  aiCost: number;
  referrals: number;
  qboExports: number;
}

class AdminStatsVerifier {
  private expectedMetrics: TestMetrics = {
    totalLeads: 0,
    qualifiedLeads: 0,
    quotedLeads: 0,
    totalRevenue: 0,
    actualRevenue: 0,
    ghostBusterSent: 0,
    ghostBusterRecovered: 0,
    aiCost: 0,
    referrals: 0,
    qboExports: 0,
  };

  /**
   * Create test customers with different configurations
   */
  async createTestCustomers(): Promise<string[]> {
    console.log('📦 Creating test customers...');

    const customers: string[] = [];

    // Customer 1: Active contractor with partner referrals
    const customer1 = await db.query(
      `INSERT INTO customers (email, password_hash, api_key, company_name, timezone, subscription_tier, is_active, business_info, ai_prompts)
       VALUES (
         'admin-test-1@test.com',
         'test-hash',
         'test-key-admin-1',
         'Premium Decks LLC',
         'America/New_York',
         'professional',
         true,
         '{
           "services": ["deck_repair", "deck_staining"],
           "service_area": "Austin",
           "partner_referral_info": {
             "partner_name": "Partner Contractor",
             "partner_phone": "512-555-9999",
             "partner_email": "partner@example.com",
             "referral_fee_percent": 10
           }
         }'::jsonb,
         '{
           "system_prompt": "You are a helpful assistant."
         }'::jsonb
       )
       RETURNING customer_id`,
      []
    );
    customers.push(customer1[0].customer_id);

    // Customer 2: Starter tier
    const customer2 = await db.query(
      `INSERT INTO customers (email, password_hash, api_key, company_name, timezone, subscription_tier, is_active, business_info, ai_prompts)
       VALUES (
         'admin-test-2@test.com',
         'test-hash',
         'test-key-admin-2',
         'Budget Repairs Inc',
         'America/Los_Angeles',
         'starter',
         true,
         '{
           "services": ["fence_repair"],
           "service_area": "San Francisco"
         }'::jsonb,
         '{
           "system_prompt": "You are a helpful assistant."
         }'::jsonb
       )
       RETURNING customer_id`,
      []
    );
    customers.push(customer2[0].customer_id);

    console.log(`✓ Created ${customers.length} test customers`);
    return customers;
  }

  /**
   * Populate test leads with various scenarios
   */
  async populateTestLeads(customerIds: string[]): Promise<void> {
    console.log('\n📊 Populating test leads...');

    const scenarios = [
      // Customer 1 leads
      {
        customerId: customerIds[0],
        visitorName: 'John Smith',
        visitorEmail: 'john@example.com',
        visitorPhone: '512-555-1234',
        isQualified: true,
        hasQuote: true,
        isComplete: true,
        estimatedRevenue: 2500,
        actualRevenue: 2200,
        followUpSent: false,
        referralSent: false,
        qboExported: true,
        aiCost: 0.32,
      },
      {
        customerId: customerIds[0],
        visitorName: 'Sarah Johnson',
        visitorEmail: 'sarah@example.com',
        visitorPhone: '512-555-5678',
        isQualified: true,
        hasQuote: true,
        isComplete: false,
        estimatedRevenue: 1800,
        actualRevenue: 0,
        followUpSent: true,
        referralSent: false,
        qboExported: false,
        aiCost: 0.28,
      },
      {
        customerId: customerIds[0],
        visitorName: 'Mike Davis',
        visitorEmail: 'mike@example.com',
        visitorPhone: '512-555-9999',
        isQualified: true,
        hasQuote: true,
        isComplete: true,
        estimatedRevenue: 3200,
        actualRevenue: 3200,
        followUpSent: true,
        referralSent: false,
        qboExported: true,
        aiCost: 0.35,
      },
      {
        customerId: customerIds[0],
        visitorName: 'Lisa Brown (Out of Area)',
        visitorEmail: 'lisa@example.com',
        visitorPhone: '713-555-1111',
        isQualified: true,
        hasQuote: false,
        isComplete: false,
        estimatedRevenue: 0,
        actualRevenue: 0,
        followUpSent: false,
        referralSent: true,
        qboExported: false,
        aiCost: 0.18,
      },
      // Customer 2 leads
      {
        customerId: customerIds[1],
        visitorName: 'Tom Wilson',
        visitorEmail: 'tom@example.com',
        visitorPhone: '415-555-2222',
        isQualified: true,
        hasQuote: true,
        isComplete: true,
        estimatedRevenue: 1200,
        actualRevenue: 1100,
        followUpSent: false,
        referralSent: false,
        qboExported: false,
        aiCost: 0.22,
      },
      {
        customerId: customerIds[1],
        visitorName: 'Jane Doe',
        visitorEmail: 'jane@example.com',
        visitorPhone: '415-555-3333',
        isQualified: false,
        hasQuote: false,
        isComplete: false,
        estimatedRevenue: 0,
        actualRevenue: 0,
        followUpSent: false,
        referralSent: false,
        qboExported: false,
        aiCost: 0.15,
      },
      {
        customerId: customerIds[1],
        visitorName: 'Bob Anderson',
        visitorEmail: 'bob@example.com',
        visitorPhone: '415-555-4444',
        isQualified: true,
        hasQuote: true,
        isComplete: false,
        estimatedRevenue: 1600,
        actualRevenue: 0,
        followUpSent: true,
        referralSent: false,
        qboExported: false,
        aiCost: 0.26,
      },
    ];

    for (const scenario of scenarios) {
      // Create session
      const sessionId = `admin-test-${Date.now()}-${Math.random()}`;
      await db.query(
        `INSERT INTO sessions (session_id, customer_id, message_count)
         VALUES ($1, $2, 5)`,
        [sessionId, scenario.customerId]
      );

      // Create lead
      const quote = scenario.hasQuote
        ? {
            estimated_range: `$${scenario.estimatedRevenue - 500}-$${scenario.estimatedRevenue}`,
            breakdown: {
              base_fee: 150,
              estimated_labor_low: scenario.estimatedRevenue - 500,
              estimated_labor_high: scenario.estimatedRevenue,
            },
          }
        : null;

      await db.query(
        `INSERT INTO leads (
          customer_id,
          session_id,
          visitor_name,
          visitor_email,
          visitor_phone,
          classification,
          is_qualified,
          is_complete,
          quote,
          estimated_revenue,
          actual_revenue,
          follow_up_sent,
          referral_sent,
          is_out_of_area,
          qbo_exported,
          message_count,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          '{"service_type": "deck_repair", "urgency": "medium", "urgency_score": 0.6, "confidence": 0.85}'::jsonb,
          $6, $7, $8, $9, $10, $11, $12, $13, $14, 5,
          NOW() - INTERVAL '1 day',
          NOW()
        )`,
        [
          scenario.customerId,
          sessionId,
          scenario.visitorName,
          scenario.visitorEmail,
          scenario.visitorPhone,
          scenario.isQualified,
          scenario.isComplete,
          quote ? JSON.stringify(quote) : null,
          scenario.estimatedRevenue,
          scenario.actualRevenue,
          scenario.followUpSent,
          scenario.referralSent,
          scenario.referralSent,
          scenario.qboExported,
        ]
      );

      // Update expected metrics
      this.expectedMetrics.totalLeads++;
      if (scenario.isQualified) this.expectedMetrics.qualifiedLeads++;
      if (scenario.hasQuote) this.expectedMetrics.quotedLeads++;
      this.expectedMetrics.totalRevenue += scenario.estimatedRevenue;
      this.expectedMetrics.actualRevenue += scenario.actualRevenue;
      if (scenario.followUpSent) this.expectedMetrics.ghostBusterSent++;
      if (scenario.followUpSent && scenario.isComplete)
        this.expectedMetrics.ghostBusterRecovered++;
      this.expectedMetrics.aiCost += scenario.aiCost;
      if (scenario.referralSent) this.expectedMetrics.referrals++;
      if (scenario.qboExported) this.expectedMetrics.qboExports++;
    }

    console.log(`✓ Created ${scenarios.length} test leads`);
  }

  /**
   * Populate metrics table for revenue tracking
   */
  async populateMetrics(customerIds: string[]): Promise<void> {
    console.log('\n📈 Populating metrics table...');

    for (const customerId of customerIds) {
      await db.query(
        `INSERT INTO metrics (
          customer_id,
          metric_date,
          leads_captured,
          leads_qualified,
          quotes_generated,
          estimated_revenue,
          actual_revenue,
          ai_api_calls,
          ai_cost_usd
        )
        VALUES
          ($1, CURRENT_DATE - INTERVAL '2 days', 2, 2, 2, 1500, 1200, 10, 0.30),
          ($1, CURRENT_DATE - INTERVAL '1 day', 3, 2, 1, 2200, 800, 12, 0.35),
          ($1, CURRENT_DATE, 2, 1, 1, 1000, 0, 8, 0.25)`,
        [customerId]
      );
    }

    console.log(`✓ Populated metrics for ${customerIds.length} customers`);
  }

  /**
   * Print expected metrics
   */
  printExpectedMetrics(): void {
    console.log('\n📊 Expected Metrics:');
    console.log(`   Total Leads: ${this.expectedMetrics.totalLeads}`);
    console.log(`   Qualified Leads: ${this.expectedMetrics.qualifiedLeads}`);
    console.log(`   Quoted Leads: ${this.expectedMetrics.quotedLeads}`);
    console.log(
      `   Total Revenue: $${this.expectedMetrics.totalRevenue.toLocaleString()}`
    );
    console.log(
      `   Actual Revenue: $${this.expectedMetrics.actualRevenue.toLocaleString()}`
    );
    console.log(`   Ghost Buster Sent: ${this.expectedMetrics.ghostBusterSent}`);
    console.log(`   Ghost Buster Recovered: ${this.expectedMetrics.ghostBusterRecovered}`);
    console.log(
      `   Ghost Buster Success Rate: ${this.expectedMetrics.ghostBusterSent > 0 ? ((this.expectedMetrics.ghostBusterRecovered / this.expectedMetrics.ghostBusterSent) * 100).toFixed(2) : 0}%`
    );
    console.log(`   Total AI Cost: $${this.expectedMetrics.aiCost.toFixed(2)}`);
    console.log(
      `   ROI: ${this.expectedMetrics.aiCost > 0 ? (((this.expectedMetrics.totalRevenue - this.expectedMetrics.aiCost) / this.expectedMetrics.aiCost) * 100).toFixed(2) : 0}%`
    );
    console.log(`   Referrals Sent: ${this.expectedMetrics.referrals}`);
    console.log(`   QBO Exports: ${this.expectedMetrics.qboExports}`);
  }

  /**
   * Verify admin stats endpoint
   */
  async verifyAdminStats(): Promise<boolean> {
    console.log('\n🔍 Verifying Admin Stats Endpoint...');

    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error('❌ ADMIN_SECRET not configured in .env');
      return false;
    }

    try {
      const response = await axios.get('http://localhost:3000/api/v1/admin/stats', {
        headers: {
          'x-admin-secret': adminSecret,
        },
      });

      const stats = response.data;

      console.log('\n📊 Actual API Response:');
      console.log(JSON.stringify(stats, null, 2));

      // Verify key metrics
      const checks = {
        totalLeads:
          stats.leads.total === this.expectedMetrics.totalLeads
            ? '✅'
            : `❌ (Expected: ${this.expectedMetrics.totalLeads}, Got: ${stats.leads.total})`,
        qualifiedLeads:
          stats.leads.qualified === this.expectedMetrics.qualifiedLeads
            ? '✅'
            : `❌ (Expected: ${this.expectedMetrics.qualifiedLeads}, Got: ${stats.leads.qualified})`,
        quotedLeads:
          stats.leads.quoted === this.expectedMetrics.quotedLeads
            ? '✅'
            : `❌ (Expected: ${this.expectedMetrics.quotedLeads}, Got: ${stats.leads.quoted})`,
        totalRevenue:
          Math.abs(stats.summary.total_revenue_recovered - this.expectedMetrics.totalRevenue) <
          1
            ? '✅'
            : `❌ (Expected: ${this.expectedMetrics.totalRevenue}, Got: ${stats.summary.total_revenue_recovered})`,
        actualRevenue:
          Math.abs(stats.summary.actual_revenue_realized - this.expectedMetrics.actualRevenue) <
          1
            ? '✅'
            : `❌ (Expected: ${this.expectedMetrics.actualRevenue}, Got: ${stats.summary.actual_revenue_realized})`,
        ghostBusterSent:
          stats.ghost_buster.follow_ups_sent === this.expectedMetrics.ghostBusterSent
            ? '✅'
            : `❌ (Expected: ${this.expectedMetrics.ghostBusterSent}, Got: ${stats.ghost_buster.follow_ups_sent})`,
        ghostBusterRecovered:
          stats.ghost_buster.recovered === this.expectedMetrics.ghostBusterRecovered
            ? '✅'
            : `❌ (Expected: ${this.expectedMetrics.ghostBusterRecovered}, Got: ${stats.ghost_buster.recovered})`,
        referrals:
          stats.integrations.total_referrals === this.expectedMetrics.referrals
            ? '✅'
            : `❌ (Expected: ${this.expectedMetrics.referrals}, Got: ${stats.integrations.total_referrals})`,
        qboExports:
          stats.integrations.qbo_exports === this.expectedMetrics.qboExports
            ? '✅'
            : `❌ (Expected: ${this.expectedMetrics.qboExports}, Got: ${stats.integrations.qbo_exports})`,
      };

      console.log('\n✅ Verification Results:');
      console.log(`   Total Leads: ${checks.totalLeads}`);
      console.log(`   Qualified Leads: ${checks.qualifiedLeads}`);
      console.log(`   Quoted Leads: ${checks.quotedLeads}`);
      console.log(`   Total Revenue: ${checks.totalRevenue}`);
      console.log(`   Actual Revenue: ${checks.actualRevenue}`);
      console.log(`   Ghost Buster Sent: ${checks.ghostBusterSent}`);
      console.log(`   Ghost Buster Recovered: ${checks.ghostBusterRecovered}`);
      console.log(`   Referrals: ${checks.referrals}`);
      console.log(`   QBO Exports: ${checks.qboExports}`);

      const allPassed = Object.values(checks).every((check) => check === '✅');

      if (allPassed) {
        console.log('\n🎉 All admin stats checks PASSED!');
      } else {
        console.log('\n⚠️  Some admin stats checks FAILED!');
      }

      return allPassed;
    } catch (error: any) {
      if (error.response) {
        console.error(
          `❌ API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        );
      } else if (error.code === 'ECONNREFUSED') {
        console.error('❌ Server not running! Start the server with: npm run dev');
      } else {
        console.error('❌ Request failed:', error.message);
      }
      return false;
    }
  }

  /**
   * Cleanup test data
   */
  async cleanup(customerIds: string[]): Promise<void> {
    console.log('\n🧹 Cleaning up test data...');

    for (const customerId of customerIds) {
      await db.query(`DELETE FROM leads WHERE customer_id = $1`, [customerId]);
      await db.query(`DELETE FROM sessions WHERE customer_id = $1`, [customerId]);
      await db.query(`DELETE FROM metrics WHERE customer_id = $1`, [customerId]);
      await db.query(`DELETE FROM customers WHERE customer_id = $1`, [customerId]);
    }

    console.log('✓ Test data cleaned up');
  }
}

/**
 * Run admin stats verification
 */
async function runVerification() {
  const verifier = new AdminStatsVerifier();

  console.log('🚀 Starting Admin Stats Verification...\n');

  let customerIds: string[] = [];

  try {
    // Create test data
    customerIds = await verifier.createTestCustomers();
    await verifier.populateTestLeads(customerIds);
    await verifier.populateMetrics(customerIds);

    // Print expected metrics
    verifier.printExpectedMetrics();

    // Verify admin stats endpoint
    const success = await verifier.verifyAdminStats();

    console.log('\n' + '='.repeat(60));
    if (success) {
      console.log('✅ VERIFICATION PASSED: Admin Stats API working correctly!');
    } else {
      console.log('❌ VERIFICATION FAILED: Review errors above.');
    }
    console.log('='.repeat(60) + '\n');

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await verifier.cleanup(customerIds);
    await db.close();
  }
}

// Run verification
runVerification();
