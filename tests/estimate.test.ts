/**
 * Test cases for Estimate Service
 * Run these manually to validate the estimate engine
 */

import estimateService from '../src/services/estimate.service';

async function testEstimateService() {
  console.log('🧪 Testing Estimate Service...\n');

  // Test Case 1: Valid deck staining estimate
  console.log('Test 1: Valid deck staining with dimensions');
  const test1 = await estimateService.generateEstimate({
    business_context: {
      pricing_rules: {
        deck_staining: {
          unit: 'sq_ft',
          min: 3.0,
          max: 5.0,
          base_fee: 100,
        },
      },
    },
    lead_data: {
      service: 'deck_staining',
      dimensions: {
        value: 200,
        unit: 'sq_ft',
      },
      notes: 'Wood is slightly weathered',
    },
  });
  console.log('Result:', JSON.stringify(test1, null, 2));
  console.log('\n---\n');

  // Test Case 2: Missing dimensions
  console.log('Test 2: Missing dimensions');
  const test2 = await estimateService.generateEstimate({
    business_context: {
      pricing_rules: {
        fence_repair: {
          unit: 'linear_ft',
          min: 15.0,
          max: 25.0,
          base_fee: 75,
        },
      },
    },
    lead_data: {
      service: 'fence_repair',
      notes: 'Several broken posts',
    },
  });
  console.log('Result:', JSON.stringify(test2, null, 2));
  console.log('\n---\n');

  // Test Case 3: Service not in pricing rules
  console.log('Test 3: Service not in pricing rules');
  const test3 = await estimateService.generateEstimate({
    business_context: {
      pricing_rules: {
        deck_staining: {
          unit: 'sq_ft',
          min: 3.0,
          max: 5.0,
          base_fee: 100,
        },
      },
    },
    lead_data: {
      service: 'pool_installation', // Not in rules
      dimensions: {
        value: 500,
        unit: 'sq_ft',
      },
    },
  });
  console.log('Result:', JSON.stringify(test3, null, 2));
  console.log('\n---\n');

  // Test Case 4: Large project (test rounding)
  console.log('Test 4: Large roofing project');
  const test4 = await estimateService.generateEstimate({
    business_context: {
      pricing_rules: {
        roofing: {
          unit: 'sq_ft',
          min: 5.0,
          max: 8.0,
          base_fee: 500,
          service_call_fee: 150,
        },
      },
    },
    lead_data: {
      service: 'roofing',
      dimensions: {
        value: 1500,
        unit: 'sq_ft',
      },
      notes: 'Full roof replacement',
    },
  });
  console.log('Result:', JSON.stringify(test4, null, 2));
  console.log('\n---\n');

  // Test Case 5: Small project with flat rate
  console.log('Test 5: Gutter cleaning (flat rate)');
  const test5 = await estimateService.generateEstimate({
    business_context: {
      pricing_rules: {
        gutter_cleaning: {
          unit: 'flat_rate',
          min: 150,
          max: 250,
        },
      },
    },
    lead_data: {
      service: 'gutter_cleaning',
      notes: 'Two-story house',
    },
  });
  console.log('Result:', JSON.stringify(test5, null, 2));
  console.log('\n---\n');

  console.log('✅ All tests completed!');
}

// Run tests
testEstimateService().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
