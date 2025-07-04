#!/usr/bin/env node

/**
 * Create SDP MCP Development project with rate limit monitoring
 */

import 'dotenv/config';
import { SDPClient } from './dist/api/client.js';
import { loadConfig } from './dist/utils/config.js';
import { EnhancedRateLimiter } from './dist/utils/enhancedRateLimit.js';
import { RateLimitMonitor } from './dist/utils/rateLimitMonitor.js';

const PROJECT_TITLE = "Service Desk Plus MCP Server Development";
const PROJECT_DESCRIPTION = `Development of Model Context Protocol (MCP) server for Service Desk Plus Cloud API integration.

Key Information:
- Repository: https://github.com/TenKTech/service-desk-plus-mcp
- Current Version: v0.3.0
- Target Release: v1.0.0 (June 2025)
- Language: TypeScript
- License: MIT

This project enables AI assistants to interact with Service Desk Plus Cloud, automating IT service management tasks and improving operational efficiency.

Current Features:
- Request Management (8 MCP tools)
- Project Management (11 MCP tools)
- User Management (2 MCP tools)
- Rate Limiting & Multi-user Support

Roadmap:
- v0.4.0: Asset Management
- v0.5.0: Change Management
- v0.6.0: Problem Management
- v1.0.0: Production Release`;

async function wait(ms) {
  console.log(`⏱️  Waiting ${ms/1000} seconds...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function monitoredOperation(name, operation, client) {
  console.log(`\n🔄 ${name}`);
  
  // Show rate limit status before operation
  const statsBefore = client.rateLimiter.getStats();
  console.log(`📊 Rate limit: ${statsBefore.current}/${statsBefore.max} (${Math.round((statsBefore.current/statsBefore.max)*100)}% used)`);
  
  try {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;
    
    console.log(`✅ Success in ${duration}ms`);
    
    // Show rate limit status after operation
    const statsAfter = client.rateLimiter.getStats();
    console.log(`📊 Rate limit: ${statsAfter.current}/${statsAfter.max} (${Math.round((statsAfter.current/statsAfter.max)*100)}% used)`);
    
    return result;
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    
    if (error.message.includes('too many requests')) {
      console.log('⚠️  Rate limit hit! Adjusting strategy...');
      // Wait longer before next operation
      await wait(30000);
    }
    
    throw error;
  }
}

async function main() {
  console.log('🚀 Service Desk Plus MCP - Project Creation with Monitoring\n');
  
  try {
    const config = loadConfig();
    console.log(`⚙️  Configuration:`);
    console.log(`   - Rate limit: ${config.rateLimitPerMinute} requests/minute`);
    console.log(`   - Instance: ${config.instanceName}`);
    console.log(`   - Base URL: ${config.baseUrl}\n`);
    
    const client = new SDPClient(config);
    
    // Step 1: Check existing projects
    const existingProject = await monitoredOperation(
      'Checking for existing project',
      async () => {
        const projects = await client.projects.list({ per_page: 50 });
        return projects.data?.find(p => p.title === PROJECT_TITLE);
      },
      client
    );
    
    let projectId;
    
    if (existingProject) {
      console.log(`\n📋 Project already exists!`);
      console.log(`   ID: ${existingProject.id}`);
      console.log(`   Status: ${existingProject.status?.name}`);
      projectId = existingProject.id;
      
      // Update the project
      await wait(3000); // Wait before next operation
      
      await monitoredOperation(
        'Updating project description',
        async () => {
          return await client.projects.update(projectId, {
            description: PROJECT_DESCRIPTION,
            percentage_completion: 30
          });
        },
        client
      );
    } else {
      // Create new project
      await wait(3000); // Wait to avoid rapid requests
      
      const project = await monitoredOperation(
        'Creating new project',
        async () => {
          return await client.projects.create({
            title: PROJECT_TITLE,
            description: PROJECT_DESCRIPTION
          });
        },
        client
      );
      
      projectId = project.id;
      console.log(`\n🎉 Project created!`);
      console.log(`   ID: ${projectId}`);
    }
    
    // Step 2: Create tasks (with careful pacing)
    console.log(`\n📌 Creating project tasks...`);
    
    const tasks = [
      {
        title: "Fix date formatting in API handlers",
        description: "Update all MCP handlers to use SDPDate format with epoch milliseconds",
        priority: "high"
      },
      {
        title: "Implement field ID lookup functionality", 
        description: "Create methods to lookup valid IDs for project_type, priority, status fields",
        priority: "high"
      },
      {
        title: "Research and fix worklog endpoint",
        description: "Investigate 404 error on /worklogs endpoint and implement correct API call",
        priority: "medium"
      },
      {
        title: "Complete Asset Management module (v0.4.0)",
        description: "Implement comprehensive asset management with 8-10 MCP tools",
        priority: "high"
      },
      {
        title: "Implement Change Management module (v0.5.0)",
        description: "Build change management system with 24 MCP tools as specified",
        priority: "medium"
      }
    ];
    
    let createdTasks = 0;
    
    for (const [index, taskData] of tasks.entries()) {
      // Wait between tasks to avoid rate limiting
      if (index > 0) {
        await wait(5000);
      }
      
      try {
        await monitoredOperation(
          `Creating task: ${taskData.title}`,
          async () => {
            return await client.projects.createTask({
              title: taskData.title,
              description: taskData.description,
              project: { id: projectId }
            });
          },
          client
        );
        createdTasks++;
      } catch (error) {
        console.log(`⏩ Skipping task due to error`);
      }
    }
    
    // Step 3: Summary
    await wait(3000);
    
    console.log(`\n📊 Final Summary:`);
    console.log(`   - Project ID: ${projectId}`);
    console.log(`   - Tasks created: ${createdTasks}/${tasks.length}`);
    
    // Show final rate limit status
    const finalStats = client.rateLimiter.getStats();
    console.log(`\n📈 Rate Limit Summary:`);
    console.log(`   - Total requests used: ${finalStats.current}`);
    console.log(`   - Rate limit: ${finalStats.max} per minute`);
    console.log(`   - Usage: ${Math.round((finalStats.current/finalStats.max)*100)}%`);
    console.log(`   - Resets in: ${finalStats.resetIn} seconds`);
    
    // Save project info
    const fs = await import('fs/promises');
    const projectInfo = {
      projectId,
      title: PROJECT_TITLE,
      createdAt: new Date().toISOString(),
      tasksCreated: createdTasks
    };
    await fs.writeFile('PROJECT_INFO.json', JSON.stringify(projectInfo, null, 2));
    console.log(`\n💾 Project info saved to PROJECT_INFO.json`);
    
  } catch (error) {
    console.error('\n💥 Unexpected error:', error);
  }
}

// Run with monitoring
console.log('Starting in 5 seconds to ensure clean rate limit window...\n');
setTimeout(main, 5000);