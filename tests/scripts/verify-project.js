#!/usr/bin/env node

/**
 * Verify SDP MCP project and optimize rate limiting
 */

import 'dotenv/config';
import { SDPClient } from '../../dist/api/client.js';
import { loadConfig } from '../../dist/utils/config.js';
import fs from 'fs/promises';

const EXPECTED_PROJECT_TITLE = "Service Desk Plus MCP Server Development";

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeApiCall(operation, client) {
  const stats = client.rateLimiter.getStats();
  
  // If we're close to limit, wait
  if (stats.current >= stats.max * 0.8) {
    console.log(`   ⏳ Approaching rate limit (${stats.current}/${stats.max}), waiting...`);
    await wait(stats.resetIn * 1000 + 1000);
  }
  
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    if (error.message.includes('too many requests')) {
      console.log(`   ⚠️  Rate limited. Waiting 60s...`);
      await wait(60000);
      // Try once more
      try {
        const result = await operation();
        return { success: true, data: result };
      } catch (retryError) {
        return { success: false, error: retryError };
      }
    }
    return { success: false, error };
  }
}

async function main() {
  console.log('🔍 Service Desk Plus MCP - Project Verification\n');
  
  try {
    const config = loadConfig();
    const client = new SDPClient(config);
    
    console.log('Configuration:');
    console.log(`├─ Instance: ${config.instanceName}`);
    console.log(`├─ Rate Limit: ${config.rateLimitPerMinute} req/min`);
    console.log(`└─ Base URL: ${config.baseUrl}\n`);
    
    // Step 1: Find our project
    console.log('1️⃣ Finding SDP MCP Development project...');
    
    const listResult = await safeApiCall(
      () => client.projects.list({ per_page: 100 }),
      client
    );
    
    if (!listResult.success) {
      console.error(`❌ Failed to list projects: ${listResult.error.message}`);
      return;
    }
    
    const projects = listResult.data;
    const ourProject = projects.data?.find(p => p.title === EXPECTED_PROJECT_TITLE);
    
    if (!ourProject) {
      console.log('❌ Project not found. Run create-project-simple-monitor.js first.');
      return;
    }
    
    console.log(`✅ Found project: ${ourProject.id}`);
    console.log(`   Status: ${ourProject.status?.name || 'Unknown'}`);
    console.log(`   Completion: ${ourProject.percentage_completion || 0}%\n`);
    
    // Save project ID for other scripts
    await fs.writeFile('PROJECT_ID.txt', ourProject.id);
    
    // Step 2: Get detailed project info
    console.log('2️⃣ Getting project details...');
    
    const projectResult = await safeApiCall(
      () => client.projects.get(ourProject.id),
      client
    );
    
    if (projectResult.success) {
      const project = projectResult.data;
      console.log('✅ Project details retrieved');
      console.log(`   Created: ${project.created_time?.display_value || 'Unknown'}`);
      console.log(`   Owner: ${project.owner?.name || 'Unassigned'}`);
      console.log(`   Description: ${project.description?.substring(0, 50)}...`);
    } else {
      console.log(`⚠️  Could not get details: ${projectResult.error.message}`);
    }
    
    // Step 3: Check tasks
    console.log('\n3️⃣ Checking project tasks...');
    await wait(2000); // Space out requests
    
    const tasksResult = await safeApiCall(
      () => client.projects.listProjectTasks(ourProject.id),
      client
    );
    
    if (tasksResult.success && tasksResult.data.data) {
      const tasks = tasksResult.data.data;
      console.log(`✅ Found ${tasks.length} tasks`);
      
      if (tasks.length > 0) {
        console.log('   Recent tasks:');
        tasks.slice(0, 3).forEach(task => {
          console.log(`   - ${task.title} (${task.status?.name || 'Unknown'})`);
        });
      }
    } else {
      console.log('⚠️  Could not retrieve tasks');
    }
    
    // Step 4: Rate limit analysis
    console.log('\n4️⃣ Rate Limit Analysis...');
    
    const finalStats = client.rateLimiter.getStats();
    const usagePercent = (finalStats.current / finalStats.max) * 100;
    
    console.log(`📊 Rate Limit Usage:`);
    console.log(`   Current: ${finalStats.current}/${finalStats.max} (${usagePercent.toFixed(1)}%)`);
    console.log(`   Resets in: ${finalStats.resetIn}s`);
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    
    if (usagePercent < 30) {
      console.log(`   ✅ Rate limit (${config.rateLimitPerMinute}) seems conservative`);
      console.log(`   Consider increasing to ${Math.min(30, config.rateLimitPerMinute + 5)}`);
    } else if (usagePercent > 80) {
      console.log(`   ⚠️  Rate limit (${config.rateLimitPerMinute}) may be too high`);
      console.log(`   Consider reducing to ${Math.max(10, config.rateLimitPerMinute - 5)}`);
    } else {
      console.log(`   ✅ Rate limit (${config.rateLimitPerMinute}) is well-balanced`);
    }
    
    // Save project info
    const projectInfo = {
      id: ourProject.id,
      title: ourProject.title,
      status: ourProject.status?.name,
      completion: ourProject.percentage_completion,
      verifiedAt: new Date().toISOString(),
      rateLimit: config.rateLimitPerMinute,
      taskCount: tasksResult.success ? tasksResult.data.data?.length || 0 : 'unknown'
    };
    
    await fs.writeFile('PROJECT_INFO.json', JSON.stringify(projectInfo, null, 2));
    console.log('\n💾 Project info saved to PROJECT_INFO.json');
    
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

// Add delay before starting
console.log('Starting verification in 3 seconds...\n');
setTimeout(main, 3000);