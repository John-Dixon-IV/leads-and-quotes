#!/usr/bin/env node
/**
 * Customer Onboarding CLI
 * Interactive tool for onboarding new customers in seconds
 */

import * as readline from 'readline';
import { randomUUID } from 'crypto';
import db from '../src/db/client';
import * as dotenv from 'dotenv';

dotenv.config();

interface OnboardingData {
  businessName: string;
  phone: string;
  email: string;
  timezone: string;
  zipCodes: string;
  services: any;
  pricingRules: any;
}

class CustomerOnboardingCLI {
  private rl: readline.Interface;
  private data: Partial<OnboardingData> = {};

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Prompt user for input
   */
  private async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate timezone
   */
  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Generate secure API key
   */
  private generateApiKey(): string {
    return `lnq_${randomUUID().replace(/-/g, '')}`;
  }

  /**
   * Print welcome banner
   */
  private printBanner(): void {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║        LEADS & QUOTES - CUSTOMER ONBOARDING CLI           ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('Welcome! Let\'s get your new customer set up in 60 seconds.\n');
  }

  /**
   * Collect customer information
   */
  private async collectCustomerInfo(): Promise<void> {
    console.log('━'.repeat(60));
    console.log('📋 STEP 1: Basic Information');
    console.log('━'.repeat(60) + '\n');

    // Business Name
    while (!this.data.businessName) {
      const businessName = await this.prompt('Business Name: ');
      if (businessName.length >= 2) {
        this.data.businessName = businessName;
      } else {
        console.log('⚠️  Business name must be at least 2 characters.\n');
      }
    }

    // Email
    while (!this.data.email) {
      const email = await this.prompt('Email: ');
      if (this.isValidEmail(email)) {
        // Check if email already exists
        const existing = await db.query(
          'SELECT customer_id FROM customers WHERE email = $1',
          [email]
        );
        if (existing.length > 0) {
          console.log('⚠️  Email already exists in database. Please use a different email.\n');
        } else {
          this.data.email = email;
        }
      } else {
        console.log('⚠️  Invalid email format.\n');
      }
    }

    // Phone
    while (!this.data.phone) {
      const phone = await this.prompt('Phone (e.g., 512-555-1234): ');
      if (phone.length >= 10) {
        this.data.phone = phone;
      } else {
        console.log('⚠️  Phone must be at least 10 characters.\n');
      }
    }

    // Timezone
    console.log('\n💡 Tip: Common timezones: America/New_York, America/Chicago, America/Denver, America/Los_Angeles');
    while (!this.data.timezone) {
      const timezone = await this.prompt('Timezone (e.g., America/New_York): ');
      if (this.isValidTimezone(timezone)) {
        this.data.timezone = timezone;
      } else {
        console.log('⚠️  Invalid timezone. Use format: America/New_York\n');
      }
    }

    // Zip Codes (Service Area)
    while (!this.data.zipCodes) {
      const zipCodes = await this.prompt('Service Area Zip Codes (comma-separated, e.g., 78701,78702): ');
      if (zipCodes.length >= 5) {
        this.data.zipCodes = zipCodes;
      } else {
        console.log('⚠️  Please enter at least one zip code.\n');
      }
    }

    console.log('\n✅ Basic information collected!\n');
  }

  /**
   * Collect services and pricing
   */
  private async collectServicesAndPricing(): Promise<void> {
    console.log('━'.repeat(60));
    console.log('💰 STEP 2: Services & Pricing Rules');
    console.log('━'.repeat(60) + '\n');

    console.log('Available services:');
    console.log('  - deck_repair, deck_staining, deck_cleaning');
    console.log('  - fence_repair, fence_staining, fence_installation');
    console.log('  - patio_repair, patio_installation, patio_cleaning');
    console.log('  - gutter_cleaning, gutter_repair, gutter_installation');
    console.log('  - pressure_washing, window_cleaning, roof_repair\n');

    console.log('Example service list:');
    console.log('  deck_repair,deck_staining,fence_repair\n');

    while (!this.data.services) {
      const services = await this.prompt('Services (comma-separated): ');
      if (services.length > 0) {
        this.data.services = services.split(',').map((s) => s.trim());
      } else {
        console.log('⚠️  Please enter at least one service.\n');
      }
    }

    console.log('\n📊 Pricing Rules (JSON format)');
    console.log('Example:');
    console.log(JSON.stringify({
      deck_repair: {
        base_fee: 150,
        rate_per_sqft: 3.5,
        min_estimate: 500,
        max_estimate: 5000
      },
      deck_staining: {
        base_fee: 200,
        rate_per_sqft: 2.5,
        min_estimate: 600,
        max_estimate: 4000
      }
    }, null, 2));
    console.log('');

    while (!this.data.pricingRules) {
      const pricingInput = await this.prompt('Pricing Rules (paste JSON or press Enter for defaults): ');

      if (pricingInput === '') {
        // Generate default pricing for all services
        const defaultPricing: any = {};
        this.data.services.forEach((service: string) => {
          defaultPricing[service] = {
            base_fee: 150,
            rate_per_sqft: 3.0,
            min_estimate: 500,
            max_estimate: 5000
          };
        });
        this.data.pricingRules = defaultPricing;
        console.log('✅ Using default pricing for all services.\n');
      } else {
        try {
          const pricing = JSON.parse(pricingInput);
          this.data.pricingRules = pricing;
        } catch (e) {
          console.log('⚠️  Invalid JSON format. Please try again.\n');
        }
      }
    }

    console.log('✅ Services and pricing configured!\n');
  }

  /**
   * Create customer in database
   */
  private async createCustomer(): Promise<{ customerId: string; apiKey: string }> {
    console.log('━'.repeat(60));
    console.log('💾 STEP 3: Creating Customer Account');
    console.log('━'.repeat(60) + '\n');

    const apiKey = this.generateApiKey();
    const passwordHash = randomUUID(); // Placeholder - replace with actual auth system

    const businessInfo = {
      services: this.data.services,
      service_area: this.data.zipCodes,
      zip_codes: this.data.zipCodes!.split(',').map((z) => z.trim()),
    };

    const aiPrompts = {
      system_prompt: `You are a helpful assistant for ${this.data.businessName}, a professional contractor specializing in ${this.data.services!.join(', ')}.`,
      quote_instructions: `Always extract dimensions and calculate area. Provide accurate quotes based on the pricing rules. Be professional and friendly.`,
    };

    try {
      const result = await db.query(
        `INSERT INTO customers (
          email,
          password_hash,
          api_key,
          company_name,
          phone,
          timezone,
          subscription_tier,
          is_active,
          weekly_digest_enabled,
          alert_on_hot_lead,
          business_info,
          ai_prompts,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
        )
        RETURNING customer_id`,
        [
          this.data.email,
          passwordHash,
          apiKey,
          this.data.businessName,
          this.data.phone,
          this.data.timezone,
          'professional', // Default tier
          true, // Active
          true, // Weekly digest enabled
          true, // Hot lead alerts enabled
          JSON.stringify(businessInfo),
          JSON.stringify(aiPrompts),
        ]
      );

      const customerId = result[0].customer_id;

      // Update pricing rules in business_info
      await db.query(
        `UPDATE customers
         SET business_info = business_info || $1
         WHERE customer_id = $2`,
        [JSON.stringify({ pricing: this.data.pricingRules }), customerId]
      );

      console.log(`✅ Customer created successfully!`);
      console.log(`   Customer ID: ${customerId}`);
      console.log(`   API Key: ${apiKey}\n`);

      return { customerId, apiKey };
    } catch (error: any) {
      console.error('❌ Failed to create customer:', error.message);
      throw error;
    }
  }

  /**
   * Print welcome package
   */
  private printWelcomePackage(customerId: string, apiKey: string): void {
    const widgetUrl = process.env.WIDGET_URL || 'http://localhost:3000/widget.js';
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 WELCOME PACKAGE - ' + this.data.businessName?.toUpperCase());
    console.log('═'.repeat(60) + '\n');

    console.log('📋 CUSTOMER DETAILS');
    console.log('─'.repeat(60));
    console.log(`Business Name:     ${this.data.businessName}`);
    console.log(`Email:             ${this.data.email}`);
    console.log(`Phone:             ${this.data.phone}`);
    console.log(`Timezone:          ${this.data.timezone}`);
    console.log(`Service Area:      ${this.data.zipCodes}`);
    console.log(`Services:          ${this.data.services!.join(', ')}`);
    console.log(`Customer ID:       ${customerId}`);
    console.log(`API Key:           ${apiKey}`);
    console.log(`Subscription Tier: Professional`);
    console.log(`Created:           ${new Date().toLocaleString()}`);
    console.log('');

    console.log('💰 PRICING RULES');
    console.log('─'.repeat(60));
    Object.entries(this.data.pricingRules!).forEach(([service, rules]: [string, any]) => {
      console.log(`${service.replace(/_/g, ' ').toUpperCase()}:`);
      console.log(`  Base Fee: $${rules.base_fee}`);
      console.log(`  Rate: $${rules.rate_per_sqft}/sqft`);
      console.log(`  Range: $${rules.min_estimate} - $${rules.max_estimate}`);
    });
    console.log('');

    console.log('📦 WIDGET EMBED CODE');
    console.log('─'.repeat(60));
    console.log('Copy and paste this code into your website (before </body>):');
    console.log('');
    console.log('```html');
    console.log(`<!-- Leads & Quotes AI Chat Widget -->`);
    console.log(`<script src="${widgetUrl}"></script>`);
    console.log(`<script>`);
    console.log(`  window.initLeadsWidget({`);
    console.log(`    apiKey: '${apiKey}',`);
    console.log(`    apiBaseUrl: '${apiBaseUrl}',`);
    console.log(`    position: 'bottom-right',  // or 'bottom-left'`);
    console.log(`    primaryColor: '#2563eb',   // Your brand color`);
    console.log(`    greeting: 'Hi! Need help with ${this.data.services![0].replace(/_/g, ' ')}?'`);
    console.log(`  });`);
    console.log(`</script>`);
    console.log('```');
    console.log('');

    console.log('🔧 API ENDPOINTS');
    console.log('─'.repeat(60));
    console.log(`Widget API:        ${apiBaseUrl}/api/v1/widget/chat`);
    console.log(`Dashboard:         ${apiBaseUrl}/api/v1/dashboard/leads`);
    console.log(`Health Check:      ${apiBaseUrl}/api/v1/health`);
    console.log('');

    console.log('📊 FEATURES ENABLED');
    console.log('─'.repeat(60));
    console.log('✅ AI-Powered Lead Classification');
    console.log('✅ Smart Quote Generation');
    console.log('✅ Ghost Buster (Automated Follow-Up)');
    console.log('✅ Hot Lead Alerts (SMS/Email)');
    console.log('✅ Weekly Performance Digest');
    console.log('✅ Math Sanity Engine (Dimension Validation)');
    console.log('✅ Timezone-Aware Office Hours');
    console.log('');

    console.log('📧 NEXT STEPS');
    console.log('─'.repeat(60));
    console.log('1. Add the widget embed code to your website');
    console.log('2. Configure SMS alerts (optional):');
    console.log(`   - Set TWILIO_PHONE_FROM in .env`);
    console.log(`   - Add recipient phone to customer profile`);
    console.log('3. Test the widget by visiting your website');
    console.log('4. Monitor leads in your dashboard');
    console.log('5. Review weekly digest emails every Monday');
    console.log('');

    console.log('🎯 TESTING THE WIDGET');
    console.log('─'.repeat(60));
    console.log('Send a test message like:');
    console.log(`  "Hi, I need ${this.data.services![0].replace(/_/g, ' ')} for my 10x20 deck"`);
    console.log('');
    console.log('The AI will:');
    console.log('  1. Classify the lead');
    console.log('  2. Extract dimensions (10ft x 20ft = 200 sqft)');
    console.log('  3. Generate a quote');
    console.log('  4. Send you a hot lead alert');
    console.log('');

    console.log('═'.repeat(60));
    console.log('🚀 CUSTOMER ONBOARDED SUCCESSFULLY!');
    console.log('═'.repeat(60) + '\n');

    // Save welcome package to file
    this.saveWelcomePackage(customerId, apiKey);
  }

  /**
   * Save welcome package to file
   */
  private saveWelcomePackage(customerId: string, apiKey: string): void {
    const fs = require('fs');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `welcome-package-${this.data.businessName!.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.txt`;

    const widgetUrl = process.env.WIDGET_URL || 'http://localhost:3000/widget.js';
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

    let content = '═'.repeat(60) + '\n';
    content += `WELCOME PACKAGE - ${this.data.businessName?.toUpperCase()}\n`;
    content += '═'.repeat(60) + '\n\n';

    content += 'CUSTOMER DETAILS\n';
    content += '─'.repeat(60) + '\n';
    content += `Business Name:     ${this.data.businessName}\n`;
    content += `Email:             ${this.data.email}\n`;
    content += `Phone:             ${this.data.phone}\n`;
    content += `Timezone:          ${this.data.timezone}\n`;
    content += `Service Area:      ${this.data.zipCodes}\n`;
    content += `Services:          ${this.data.services!.join(', ')}\n`;
    content += `Customer ID:       ${customerId}\n`;
    content += `API Key:           ${apiKey}\n`;
    content += `Created:           ${new Date().toLocaleString()}\n\n`;

    content += 'WIDGET EMBED CODE\n';
    content += '─'.repeat(60) + '\n';
    content += `<script src="${widgetUrl}"></script>\n`;
    content += `<script>\n`;
    content += `  window.initLeadsWidget({\n`;
    content += `    apiKey: '${apiKey}',\n`;
    content += `    apiBaseUrl: '${apiBaseUrl}',\n`;
    content += `    position: 'bottom-right',\n`;
    content += `    primaryColor: '#2563eb',\n`;
    content += `    greeting: 'Hi! Need help with ${this.data.services![0].replace(/_/g, ' ')}?'\n`;
    content += `  });\n`;
    content += `</script>\n\n`;

    content += '═'.repeat(60) + '\n';

    fs.writeFileSync(filename, content);
    console.log(`💾 Welcome package saved to: ${filename}\n`);
  }

  /**
   * Run the onboarding process
   */
  async run(): Promise<void> {
    this.printBanner();

    try {
      await this.collectCustomerInfo();
      await this.collectServicesAndPricing();

      const { customerId, apiKey } = await this.createCustomer();
      this.printWelcomePackage(customerId, apiKey);

      console.log('✅ Onboarding complete! Customer is ready to go.\n');
    } catch (error: any) {
      console.error('\n❌ Onboarding failed:', error.message);
      console.error('Please try again or contact support.\n');
      process.exit(1);
    } finally {
      this.rl.close();
      await db.close();
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  const cli = new CustomerOnboardingCLI();
  await cli.run();
}

// Run the CLI
main();
