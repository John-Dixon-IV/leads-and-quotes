/**
 * Master Verification Suite
 * Runs all verification scripts and generates comprehensive report
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

interface TestResult {
  name: string;
  script: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration: number;
  output: string;
  error?: string;
}

class MasterVerifier {
  private results: TestResult[] = [
    {
      name: '1. Docker Deployment Verification',
      script: 'verify-docker.ts',
      status: 'pending',
      duration: 0,
      output: '',
    },
    {
      name: '2. Ghost Buster Time-Warp Simulator',
      script: 'simulate-ghost-buster.ts',
      status: 'pending',
      duration: 0,
      output: '',
    },
    {
      name: '3. Math Sanity Engine Stress Test',
      script: 'verify-math-sanity.ts',
      status: 'pending',
      duration: 0,
      output: '',
    },
    {
      name: '4. Admin Stats & Revenue Tracking',
      script: 'verify-admin-stats.ts',
      status: 'pending',
      duration: 0,
      output: '',
    },
  ];

  /**
   * Run a single verification script
   */
  async runVerification(index: number): Promise<void> {
    const test = this.results[index];
    test.status = 'running';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Running: ${test.name}`);
    console.log(`${'='.repeat(60)}\n`);

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(
        `npx tsx scripts/${test.script}`,
        {
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          env: { ...process.env },
        }
      );

      test.duration = Date.now() - startTime;
      test.output = stdout + stderr;
      test.status = 'passed';

      console.log(stdout);
      if (stderr) {
        console.log('[stderr]', stderr);
      }

      console.log(`\n✅ ${test.name} - PASSED (${(test.duration / 1000).toFixed(2)}s)`);
    } catch (error: any) {
      test.duration = Date.now() - startTime;
      test.status = 'failed';
      test.error = error.message;
      test.output = (error.stdout || '') + (error.stderr || '');

      console.log(error.stdout || '');
      console.log(error.stderr || '');
      console.error(`\n❌ ${test.name} - FAILED (${(test.duration / 1000).toFixed(2)}s)`);
      console.error(`Error: ${error.message}`);
    }
  }

  /**
   * Check prerequisites
   */
  async checkPrerequisites(): Promise<boolean> {
    console.log('🔍 Checking prerequisites...\n');

    const checks = [];

    // Check if .env exists
    try {
      const fs = require('fs');
      if (fs.existsSync('.env')) {
        console.log('✓ .env file found');
        checks.push(true);
      } else {
        console.log('❌ .env file not found');
        console.log('   Copy config/env.production.example to .env and configure it.');
        checks.push(false);
      }
    } catch (error) {
      console.log('❌ Error checking .env file');
      checks.push(false);
    }

    // Check if ANTHROPIC_API_KEY is set
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('✓ ANTHROPIC_API_KEY is set');
      checks.push(true);
    } else {
      console.log('❌ ANTHROPIC_API_KEY not set in .env');
      checks.push(false);
    }

    // Check if database is accessible (optional - tests will create their own DBs)
    try {
      const db = require('../src/db/client').default;
      await db.query('SELECT 1 as health_check');
      console.log('✓ Database connection successful');
      checks.push(true);
      await db.close();
    } catch (error: any) {
      console.log(`⚠️  Database connection failed: ${error.message}`);
      console.log('   Some tests may fail if database is not accessible.');
      checks.push(false);
    }

    console.log('');
    return checks.filter((c) => c).length >= 2; // At least .env and API key
  }

  /**
   * Print final report
   */
  printFinalReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION COMPLETE - Final Report');
    console.log('='.repeat(60) + '\n');

    this.results.forEach((test, index) => {
      const statusIcon =
        test.status === 'passed'
          ? '✅'
          : test.status === 'failed'
            ? '❌'
            : test.status === 'skipped'
              ? '⏭️'
              : '⏳';

      const statusText =
        test.status === 'passed'
          ? 'PASSED'
          : test.status === 'failed'
            ? 'FAILED'
            : test.status === 'skipped'
              ? 'SKIPPED'
              : 'PENDING';

      console.log(`${statusIcon} ${test.name}`);
      console.log(`   Status: ${statusText}`);
      console.log(`   Duration: ${(test.duration / 1000).toFixed(2)}s`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
      console.log('');
    });

    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.status === 'passed').length;
    const failedTests = this.results.filter((r) => r.status === 'failed').length;
    const skippedTests = this.results.filter((r) => r.status === 'skipped').length;

    console.log('─'.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Skipped: ${skippedTests} ⏭️`);
    console.log(
      `Success Rate: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%`
    );
    console.log('='.repeat(60) + '\n');

    if (passedTests === totalTests) {
      console.log('🎉 ALL VERIFICATIONS PASSED! 🎉');
      console.log('   Your production deployment is ready to go live.\n');
    } else if (failedTests > 0) {
      console.log('⚠️  SOME VERIFICATIONS FAILED');
      console.log('   Review the errors above and fix before deploying.\n');
    } else {
      console.log('⏸️  VERIFICATION INCOMPLETE');
      console.log('   Some tests were skipped or did not run.\n');
    }

    // Save report to file
    this.saveReportToFile();
  }

  /**
   * Save report to file
   */
  saveReportToFile(): void {
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const reportPath = `verification-report-${timestamp}.txt`;

    let report = '='.repeat(60) + '\n';
    report += 'VERIFICATION REPORT\n';
    report += `Generated: ${new Date().toISOString()}\n`;
    report += '='.repeat(60) + '\n\n';

    this.results.forEach((test) => {
      report += `${test.name}\n`;
      report += `Status: ${test.status.toUpperCase()}\n`;
      report += `Duration: ${(test.duration / 1000).toFixed(2)}s\n`;
      if (test.error) {
        report += `Error: ${test.error}\n`;
      }
      report += '\nOutput:\n';
      report += test.output + '\n';
      report += '-'.repeat(60) + '\n\n';
    });

    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.status === 'passed').length;

    report += '='.repeat(60) + '\n';
    report += `Summary: ${passedTests}/${totalTests} tests passed\n`;
    report += '='.repeat(60) + '\n';

    fs.writeFileSync(reportPath, report);
    console.log(`📄 Full report saved to: ${reportPath}\n`);
  }
}

/**
 * Run all verifications
 */
async function runAllVerifications() {
  const verifier = new MasterVerifier();

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║         LEADS & QUOTES SAAS - VERIFICATION SUITE          ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('This suite will verify:');
  console.log('  1. Docker deployment and health checks');
  console.log('  2. Ghost Buster timezone logic');
  console.log('  3. Math sanity engine (dimension validation)');
  console.log('  4. Admin stats and revenue tracking\n');

  // Check prerequisites
  const prerequisitesPassed = await verifier.checkPrerequisites();

  if (!prerequisitesPassed) {
    console.log('❌ Prerequisites not met. Please configure .env and try again.\n');
    process.exit(1);
  }

  console.log('✅ Prerequisites met. Starting verification suite...\n');

  try {
    // Run all verifications sequentially
    // Note: Docker verification includes building and starting containers,
    // so we might want to skip it if just testing the app logic

    const args = process.argv.slice(2);
    const skipDocker = args.includes('--skip-docker');

    if (skipDocker) {
      console.log('⏭️  Skipping Docker verification (--skip-docker flag set)\n');
      verifier['results'][0].status = 'skipped';
    } else {
      await verifier.runVerification(0); // Docker
    }

    await verifier.runVerification(1); // Ghost Buster
    await verifier.runVerification(2); // Math Sanity
    await verifier.runVerification(3); // Admin Stats

    // Print final report
    verifier.printFinalReport();

    const allPassed = verifier['results'].every(
      (r) => r.status === 'passed' || r.status === 'skipped'
    );

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Verification suite failed with error:', error);
    verifier.printFinalReport();
    process.exit(1);
  }
}

// Run all verifications
runAllVerifications();
