#!/usr/bin/env node

/**
 * Manage SDP MCP project using the optimized client
 * This maximizes throughput while avoiding rate limits
 */

import 'dotenv/config';
import { OptimizedSDPClient } from '../../dist/api/optimizedClient.js';
import { loadConfig } from '../../dist/utils/config.js';
import fs from 'fs/promises';

const PROJECT_TITLE = "Service Desk Plus MCP Server Development";

const TASKS_TO_CREATE = [
  {
    title: "Implement TimeTrackedRateLimiter",
    description: "Advanced rate limiter with request history tracking and predictive throttling",
    priority: 9
  },
  {
    title: "Fix date formatting to use SDPDate",
    description: "Update all handlers to use { value: epochMs } format for dates",
    priority: 8
  },
  {
    title: "Add field ID lookup methods",
    description: "Create methods to get valid IDs for project_type, priority, status fields",
    priority: 7
  },
  {
    title: "Fix worklog endpoint 404",
    description: "Research correct endpoint for worklogs and implement",
    priority: 6
  },
  {
    title: "Complete Asset Management v0.4.0",
    description: "Implement comprehensive asset management with 8-10 MCP tools",
    priority: 8
  },
  {
    title: "Create integration tests",
    description: "Build Jest test suite with >80% coverage",
    priority: 5
  }
];

async function main() {
  console.log('🚀 SDP MCP Project Management (Optimized)\n');
  
  const config = loadConfig();
  const client = new OptimizedSDPClient(config, true);
  
  console.log(`Rate limit: ${config.rateLimitPerMinute} req/min`);
  console.log('Time tracking: ✅ Enabled');
  console.log('Auto-queuing: ✅ Enabled\n');
  
  try {
    // Step 1: Find or create project
    console.log('📋 Step 1: Finding project...\n');
    
    let projectId;
    let project;
    
    // Try to load saved project ID
    try {
      projectId = (await fs.readFile('PROJECT_ID.txt', 'utf-8')).trim();
      console.log(`Found saved project ID: ${projectId}`);
      
      // Verify it exists
      project = await client.projects.get(projectId);
      console.log(`✅ Project verified: ${project.title}\n`);
      
    } catch (error) {
      console.log('No saved project, searching...');
      
      // Search for project
      const projects = await client.projects.list({ per_page: 100 });
      project = projects.data?.find(p => p.title === PROJECT_TITLE);
      
      if (project) {
        projectId = project.id;
        console.log(`✅ Found existing project: ${projectId}\n`);
      } else {
        // Create new project
        console.log('Creating new project...');
        project = await client.projects.create({
          title: PROJECT_TITLE,
          description: "MCP server for Service Desk Plus Cloud API integration"
        });
        projectId = project.id;
        console.log(`✅ Created project: ${projectId}\n`);
      }
      
      // Save project ID
      await fs.writeFile('PROJECT_ID.txt', projectId);
    }
    
    // Show current stats
    client.logStatus();
    
    // Step 2: Check existing tasks
    console.log('📋 Step 2: Checking existing tasks...\n');
    
    const existingTasks = await client.projects.listProjectTasks(projectId);
    console.log(`Found ${existingTasks.data?.length || 0} existing tasks`);
    
    if (existingTasks.data && existingTasks.data.length > 0) {
      console.log('\nExisting tasks:');
      existingTasks.data.slice(0, 5).forEach(task => {
        console.log(`- ${task.title} (${task.status?.name || 'Unknown'})`);
      });
      console.log('');
    }
    
    // Step 3: Create new tasks efficiently
    console.log('📋 Step 3: Creating tasks (batch mode)...\n');
    
    const taskOperations = TASKS_TO_CREATE.map((taskData, index) => ({
      name: `Task: ${taskData.title}`,
      priority: taskData.priority,
      execute: () => client.projects.createTask({
        title: taskData.title,
        description: taskData.description,
        project: { id: projectId }
      })
    }));
    
    console.log(`Submitting ${taskOperations.length} tasks to queue...\n`);
    
    const results = await client.executeBatch(taskOperations);
    
    // Analyze results
    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);
    
    console.log(`\n✅ Created: ${successful.length} tasks`);
    if (failed.length > 0) {
      console.log(`❌ Failed: ${failed.length} tasks`);
      failed.forEach(f => {
        console.log(`   - ${f.name}: ${f.error?.message || 'Unknown error'}`);
      });
    }
    
    // Step 4: Update project
    console.log('\n📋 Step 4: Updating project status...\n');
    
    await client.executeHighPriority(
      'project-update',
      () => client.projects.update(projectId, {
        description: `MCP server for Service Desk Plus Cloud API integration.

Latest Updates:
- Implemented TimeTrackedRateLimiter for optimal throughput
- Added automatic request queuing with priorities
- Created ${successful.length} new tasks

Version: v0.3.0 → v1.0.0
Repository: https://github.com/TenKTech/service-desk-plus-mcp`,
        percentage_completion: 35
      })
    );
    
    console.log('✅ Project updated\n');
    
    // Wait for all operations to complete
    console.log('⏳ Waiting for queue to empty...');
    await client.waitForQueueEmpty();
    
    // Final statistics
    console.log('\n📊 Final Statistics:');
    client.logStatus();
    
    const stats = client.getDetailedStats();
    console.log('📈 Performance Metrics:');
    console.log(`├─ Total requests: ${stats.windows.medium.count}`);
    console.log(`├─ Success rate: ${(stats.performance.successRate * 100).toFixed(1)}%`);
    console.log(`├─ Avg duration: ${stats.performance.avgDuration.toFixed(0)}ms`);
    console.log(`├─ Throughput: ${stats.performance.throughput.toFixed(1)} req/min`);
    console.log(`└─ Max safe rate: ${stats.limits.effective} req/min`);
    
    // Save summary
    const summary = {
      projectId,
      title: PROJECT_TITLE,
      tasksCreated: successful.length,
      tasksFailed: failed.length,
      totalRequests: stats.windows.medium.count,
      successRate: stats.performance.successRate,
      throughput: stats.performance.throughput,
      timestamp: new Date().toISOString()
    };
    
    await fs.writeFile('PROJECT_SUMMARY.json', JSON.stringify(summary, null, 2));
    console.log('\n💾 Summary saved to PROJECT_SUMMARY.json');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    
    // Show queue status on error
    const stats = client.getDetailedStats();
    if (stats.queue.length > 0) {
      console.log(`\n⚠️  ${stats.queue.length} requests still in queue`);
    }
  }
}

// Run the script
console.log('Starting in 3 seconds...\n');
setTimeout(main, 3000);