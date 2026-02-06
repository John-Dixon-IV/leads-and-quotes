/**
 * Math Sanity Engine Verification
 * Tests dimension extraction and area calculation correction
 */

import db from '../src/db/client';
import aiService from '../src/services/ai.service';
import * as dotenv from 'dotenv';

dotenv.config();

interface MathTestCase {
  scenario: string;
  userInput: string;
  expectedDimensions: { length: number; width: number };
  incorrectArea: number;
  correctArea: number;
  expectedCorrection: boolean;
}

class MathSanityVerifier {
  private results: Array<{
    scenario: string;
    passed: boolean;
    details: string;
  }> = [];

  /**
   * Create a test customer for math verification
   */
  async createTestCustomer(): Promise<any> {
    const result = await db.query(
      `INSERT INTO customers (email, password_hash, api_key, company_name, timezone, business_info, ai_prompts)
       VALUES (
         'math-test@test.com',
         'test-hash',
         'test-key-' || gen_random_uuid(),
         'Math Test Co',
         'America/New_York',
         '{
           "services": ["deck_staining", "deck_repair"],
           "service_area": "Austin",
           "pricing": {
             "deck_staining": {
               "base_fee": 150,
               "rate_per_sqft": 2.50,
               "min_estimate": 500,
               "max_estimate": 5000
             }
           }
         }'::jsonb,
         '{
           "system_prompt": "You are a helpful assistant for a deck staining company.",
           "quote_instructions": "Always extract dimensions and calculate area. If the customer provides an incorrect area calculation, politely correct it."
         }'::jsonb
       )
       RETURNING *`,
      []
    );

    return result[0];
  }

  /**
   * Test a specific math scenario
   */
  async testMathScenario(testCase: MathTestCase, customer: any): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📐 Scenario: ${testCase.scenario}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Input: "${testCase.userInput}"`);
    console.log(`Expected Dimensions: ${testCase.expectedDimensions.length}x${testCase.expectedDimensions.width}`);
    console.log(`Incorrect Area Claimed: ${testCase.incorrectArea} sqft`);
    console.log(`Correct Area: ${testCase.correctArea} sqft`);
    console.log(`Should Correct: ${testCase.expectedCorrection ? 'YES' : 'NO'}`);

    try {
      // Create a session
      const sessionId = `math-test-${Date.now()}`;
      await db.query(
        `INSERT INTO sessions (session_id, customer_id, message_count)
         VALUES ($1, $2, 1)`,
        [sessionId, customer.customer_id]
      );

      // Extract dimensions using AI service
      const extractionPrompt = `
Extract the deck dimensions from this message: "${testCase.userInput}"

Return JSON with:
- length (number, in feet)
- width (number, in feet)
- claimed_area (number, in square feet, if mentioned)

If no dimensions are mentioned, return null.
`;

      const extractionResponse = await aiService.callAnthropic({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: extractionPrompt,
          },
        ],
      });

      const extractionText =
        extractionResponse.content[0].type === 'text'
          ? extractionResponse.content[0].text
          : '';

      console.log(`\n🤖 AI Extraction Response:`);
      console.log(extractionText);

      // Parse the extraction
      let dimensions: any = null;
      let claimedArea: number | null = null;

      try {
        const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extracted = JSON.parse(jsonMatch[0]);
          dimensions = {
            length: extracted.length,
            width: extracted.width,
          };
          claimedArea = extracted.claimed_area || null;
        }
      } catch (e) {
        console.log('⚠️  Failed to parse extraction JSON');
      }

      if (!dimensions) {
        console.log('❌ FAIL: Could not extract dimensions');
        this.results.push({
          scenario: testCase.scenario,
          passed: false,
          details: 'Failed to extract dimensions from user input',
        });
        return;
      }

      // Calculate actual area
      const actualArea = dimensions.length * dimensions.width;
      const areaMismatch =
        claimedArea !== null && Math.abs(actualArea - claimedArea) > 1;

      console.log(`\n📊 Math Analysis:`);
      console.log(`   Extracted Dimensions: ${dimensions.length}x${dimensions.width}`);
      console.log(`   Calculated Area: ${actualArea} sqft`);
      console.log(`   Claimed Area: ${claimedArea || 'N/A'} sqft`);
      console.log(`   Area Mismatch: ${areaMismatch ? 'YES ⚠️' : 'NO ✅'}`);

      // Generate quote with correction awareness
      const quotePrompt = `
You are helping a customer get a deck staining quote.

Customer said: "${testCase.userInput}"

Extracted dimensions: ${dimensions.length}ft x ${dimensions.width}ft
Calculated area: ${actualArea} sqft
${claimedArea ? `Customer claimed area: ${claimedArea} sqft` : ''}
${areaMismatch ? `⚠️ AREA MISMATCH DETECTED - Customer's math is incorrect!` : ''}

Pricing rules:
- Base fee: $150
- Rate: $2.50 per sqft
- Min estimate: $500
- Max estimate: $5,000

${
  areaMismatch
    ? `IMPORTANT: The customer said "${claimedArea} square feet" but ${dimensions.length} x ${dimensions.width} = ${actualArea} sqft. Politely correct them and use the CORRECT area (${actualArea} sqft) for the quote.`
    : ''
}

Provide a friendly quote response. If you corrected their math, acknowledge it politely.
`;

      const quoteResponse = await aiService.callAnthropic({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: quotePrompt,
          },
        ],
      });

      const quoteText =
        quoteResponse.content[0].type === 'text'
          ? quoteResponse.content[0].text
          : '';

      console.log(`\n💬 AI Quote Response:`);
      console.log(quoteText);

      // Verify the response
      const checks = {
        correctAreaUsed: quoteText.includes(actualArea.toString()),
        incorrectAreaNotUsed: claimedArea
          ? !quoteText.includes(claimedArea.toString()) ||
            quoteText.toLowerCase().includes('correct')
          : true,
        acknowledgmentOfCorrection:
          areaMismatch &&
          (quoteText.toLowerCase().includes('actually') ||
            quoteText.toLowerCase().includes('correct') ||
            quoteText.toLowerCase().includes('however') ||
            quoteText.match(/\d+\s*x\s*\d+\s*=\s*\d+/)),
      };

      console.log(`\n✅ Verification Checks:`);
      console.log(
        `   Correct Area Used (${actualArea} sqft): ${checks.correctAreaUsed ? '✅ PASS' : '❌ FAIL'}`
      );
      console.log(
        `   Incorrect Area Not Used (${claimedArea} sqft): ${checks.incorrectAreaNotUsed ? '✅ PASS' : '❌ FAIL'}`
      );
      if (areaMismatch) {
        console.log(
          `   Acknowledged Correction: ${checks.acknowledgmentOfCorrection ? '✅ PASS' : '❌ FAIL'}`
        );
      }

      const allChecksPassed = areaMismatch
        ? checks.correctAreaUsed &&
          checks.incorrectAreaNotUsed &&
          checks.acknowledgmentOfCorrection
        : checks.correctAreaUsed && checks.incorrectAreaNotUsed;

      console.log(`\n${allChecksPassed ? '✅ PASS' : '❌ FAIL'}: ${testCase.scenario}`);

      this.results.push({
        scenario: testCase.scenario,
        passed: allChecksPassed,
        details: allChecksPassed
          ? 'Math correction logic working correctly'
          : 'Failed one or more verification checks',
      });

      // Cleanup
      await db.query(`DELETE FROM sessions WHERE session_id = $1`, [sessionId]);
    } catch (error) {
      console.error(`❌ Test failed with error:`, error);
      this.results.push({
        scenario: testCase.scenario,
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Print final report
   */
  printReport(): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Math Sanity Engine Verification Report');
    console.log(`${'='.repeat(60)}\n`);

    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${index + 1}. ${result.scenario}`);
      console.log(`   Status: ${status}`);
      console.log(`   Details: ${result.details}\n`);
    });

    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.passed).length;

    console.log(`${'─'.repeat(60)}`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${totalTests - passedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`${'='.repeat(60)}\n`);

    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Math Sanity Engine is working correctly.\n');
    } else {
      console.log('⚠️  Some tests failed. Review the results above.\n');
    }
  }
}

/**
 * Run math sanity verification tests
 */
async function runVerification() {
  const verifier = new MathSanityVerifier();

  console.log('🚀 Starting Math Sanity Engine Verification...\n');

  try {
    // Create test customer
    const customer = await verifier.createTestCustomer();
    console.log(`✓ Created test customer (ID: ${customer.customer_id.substring(0, 8)}...)`);

    // Test Case 1: Classic 10x20 = 800 sqft error
    await verifier.testMathScenario(
      {
        scenario: 'Classic Math Error (10x20 claimed as 800 sqft)',
        userInput: 'I need a 10x20 deck stained. It\'s about 800 square feet.',
        expectedDimensions: { length: 10, width: 20 },
        incorrectArea: 800,
        correctArea: 200,
        expectedCorrection: true,
      },
      customer
    );

    // Test Case 2: 15x15 = 300 sqft error
    await verifier.testMathScenario(
      {
        scenario: 'Another Math Error (15x15 claimed as 300 sqft)',
        userInput: 'My deck is 15 feet by 15 feet, around 300 square feet total.',
        expectedDimensions: { length: 15, width: 15 },
        incorrectArea: 300,
        correctArea: 225,
        expectedCorrection: true,
      },
      customer
    );

    // Test Case 3: Correct math (no correction needed)
    await verifier.testMathScenario(
      {
        scenario: 'Correct Math (12x10 = 120 sqft)',
        userInput: 'I have a 12 by 10 deck, so 120 square feet.',
        expectedDimensions: { length: 12, width: 10 },
        incorrectArea: 120,
        correctArea: 120,
        expectedCorrection: false,
      },
      customer
    );

    // Test Case 4: No area mentioned
    await verifier.testMathScenario(
      {
        scenario: 'No Area Mentioned (20x25 deck)',
        userInput: 'I need to stain my 20 by 25 foot deck.',
        expectedDimensions: { length: 20, width: 25 },
        incorrectArea: 0,
        correctArea: 500,
        expectedCorrection: false,
      },
      customer
    );

    // Print final report
    verifier.printReport();

    // Cleanup test customer
    await db.query(`DELETE FROM customers WHERE customer_id = $1`, [
      customer.customer_id,
    ]);
    console.log('🧹 Cleaned up test data\n');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run verification
runVerification();
