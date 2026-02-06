/**
 * Docker Deployment Verification
 * Tests Docker build, health checks, and deployment readiness
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

interface VerificationResult {
  check: string;
  passed: boolean;
  details: string;
}

class DockerVerifier {
  private results: VerificationResult[] = [];
  private baseUrl = 'http://localhost:3000';

  /**
   * Check if Docker is installed and running
   */
  async checkDockerRunning(): Promise<boolean> {
    console.log('\n🐳 Checking Docker availability...');

    try {
      const { stdout } = await execAsync('docker --version');
      console.log(`✓ Docker installed: ${stdout.trim()}`);

      // Check if Docker daemon is running
      const { stdout: psOutput } = await execAsync('docker ps');
      console.log('✓ Docker daemon is running');

      this.results.push({
        check: 'Docker Installation & Daemon',
        passed: true,
        details: 'Docker is installed and running',
      });

      return true;
    } catch (error: any) {
      console.error('❌ Docker check failed:', error.message);

      if (error.message.includes('docker: command not found')) {
        this.results.push({
          check: 'Docker Installation',
          passed: false,
          details: 'Docker is not installed',
        });
      } else {
        this.results.push({
          check: 'Docker Daemon',
          passed: false,
          details: 'Docker is installed but daemon is not running. Start Docker Desktop.',
        });
      }

      return false;
    }
  }

  /**
   * Build Docker image
   */
  async buildDockerImage(): Promise<boolean> {
    console.log('\n🔨 Building Docker image...');

    try {
      console.log('Running: docker-compose build --no-cache');
      const { stdout, stderr } = await execAsync(
        'docker-compose build --no-cache',
        {
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        }
      );

      if (stderr && !stderr.includes('warning')) {
        console.log('Build stderr:', stderr);
      }

      console.log('✓ Docker image built successfully');

      this.results.push({
        check: 'Docker Image Build',
        passed: true,
        details: 'Image built without errors',
      });

      return true;
    } catch (error: any) {
      console.error('❌ Docker build failed:', error.message);

      this.results.push({
        check: 'Docker Image Build',
        passed: false,
        details: `Build failed: ${error.message}`,
      });

      return false;
    }
  }

  /**
   * Start Docker containers
   */
  async startContainers(): Promise<boolean> {
    console.log('\n🚀 Starting Docker containers...');

    try {
      const { stdout } = await execAsync('docker-compose up -d');
      console.log(stdout);

      // Wait for containers to be ready (30 seconds)
      console.log('⏳ Waiting for containers to start (30s)...');
      await new Promise((resolve) => setTimeout(resolve, 30000));

      console.log('✓ Containers started');

      this.results.push({
        check: 'Container Startup',
        passed: true,
        details: 'Containers started successfully',
      });

      return true;
    } catch (error: any) {
      console.error('❌ Failed to start containers:', error.message);

      this.results.push({
        check: 'Container Startup',
        passed: false,
        details: `Startup failed: ${error.message}`,
      });

      return false;
    }
  }

  /**
   * Test health check endpoint
   */
  async testHealthEndpoint(): Promise<boolean> {
    console.log('\n🏥 Testing health check endpoint...');

    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/health`, {
        timeout: 10000,
      });

      console.log('✓ Health check response received');
      console.log(JSON.stringify(response.data, null, 2));

      const isHealthy = response.status === 200 && response.data.status === 'healthy';

      this.results.push({
        check: 'Health Check Endpoint',
        passed: isHealthy,
        details: isHealthy
          ? 'Health check passed'
          : `Health check returned status: ${response.data.status}`,
      });

      return isHealthy;
    } catch (error: any) {
      console.error('❌ Health check failed:', error.message);

      this.results.push({
        check: 'Health Check Endpoint',
        passed: false,
        details: `Health check failed: ${error.message}`,
      });

      return false;
    }
  }

  /**
   * Test readiness probe
   */
  async testReadinessProbe(): Promise<boolean> {
    console.log('\n📡 Testing readiness probe...');

    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/health/readiness`, {
        timeout: 5000,
      });

      console.log('✓ Readiness probe response:', response.data);

      const isReady = response.status === 200;

      this.results.push({
        check: 'Readiness Probe',
        passed: isReady,
        details: isReady ? 'Service is ready' : 'Service not ready',
      });

      return isReady;
    } catch (error: any) {
      console.error('❌ Readiness probe failed:', error.message);

      this.results.push({
        check: 'Readiness Probe',
        passed: false,
        details: `Readiness check failed: ${error.message}`,
      });

      return false;
    }
  }

  /**
   * Test liveness probe
   */
  async testLivenessProbe(): Promise<boolean> {
    console.log('\n💓 Testing liveness probe...');

    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/health/liveness`, {
        timeout: 5000,
      });

      console.log('✓ Liveness probe response:', response.data);

      const isAlive = response.status === 200;

      this.results.push({
        check: 'Liveness Probe',
        passed: isAlive,
        details: isAlive ? 'Service is alive' : 'Service not alive',
      });

      return isAlive;
    } catch (error: any) {
      console.error('❌ Liveness probe failed:', error.message);

      this.results.push({
        check: 'Liveness Probe',
        passed: false,
        details: `Liveness check failed: ${error.message}`,
      });

      return false;
    }
  }

  /**
   * Check container logs
   */
  async checkContainerLogs(): Promise<void> {
    console.log('\n📋 Checking container logs...');

    try {
      const { stdout } = await execAsync('docker-compose logs --tail=50 app');
      console.log('Last 50 lines of app logs:');
      console.log(stdout);
    } catch (error: any) {
      console.error('⚠️  Could not retrieve logs:', error.message);
    }
  }

  /**
   * Stop containers
   */
  async stopContainers(): Promise<void> {
    console.log('\n🛑 Stopping containers...');

    try {
      await execAsync('docker-compose down');
      console.log('✓ Containers stopped');
    } catch (error: any) {
      console.error('⚠️  Error stopping containers:', error.message);
    }
  }

  /**
   * Print final report
   */
  printReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Docker Deployment Verification Report');
    console.log('='.repeat(60) + '\n');

    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${index + 1}. ${result.check}`);
      console.log(`   Status: ${status}`);
      console.log(`   Details: ${result.details}\n`);
    });

    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.passed).length;

    console.log('─'.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${totalTests - passedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');

    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Docker deployment is production-ready.\n');
    } else {
      console.log('⚠️  Some tests failed. Review the results above.\n');
    }
  }
}

/**
 * Run Docker verification
 */
async function runVerification() {
  const verifier = new DockerVerifier();

  console.log('🚀 Starting Docker Deployment Verification...\n');
  console.log('This will:');
  console.log('1. Check Docker installation and daemon');
  console.log('2. Build the Docker image');
  console.log('3. Start containers');
  console.log('4. Test all health check endpoints');
  console.log('5. Stop containers\n');

  try {
    // Step 1: Check Docker
    const dockerRunning = await verifier.checkDockerRunning();
    if (!dockerRunning) {
      console.log('\n❌ ABORT: Docker is not running.');
      console.log('   Please start Docker Desktop and try again.\n');
      verifier.printReport();
      process.exit(1);
    }

    // Step 2: Build image
    const buildSuccess = await verifier.buildDockerImage();
    if (!buildSuccess) {
      console.log('\n❌ ABORT: Docker build failed.\n');
      verifier.printReport();
      process.exit(1);
    }

    // Step 3: Start containers
    const startSuccess = await verifier.startContainers();
    if (!startSuccess) {
      console.log('\n❌ ABORT: Failed to start containers.\n');
      verifier.printReport();
      await verifier.stopContainers();
      process.exit(1);
    }

    // Step 4: Test health endpoints
    await verifier.testHealthEndpoint();
    await verifier.testReadinessProbe();
    await verifier.testLivenessProbe();

    // Step 5: Check logs
    await verifier.checkContainerLogs();

    // Step 6: Stop containers
    await verifier.stopContainers();

    // Print final report
    verifier.printReport();

    const allPassed = verifier['results'].every((r) => r.passed);
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Verification failed with error:', error);
    await verifier.stopContainers();
    verifier.printReport();
    process.exit(1);
  }
}

// Run verification
runVerification();
