#!/usr/bin/env node

/**
 * Create SDP MCP Development project with simple monitoring
 */

import 'dotenv/config';
import { SDPClient } from './dist/api/client.js';
import { loadConfig } from './dist/utils/config.js';

const PROJECT_TITLE = "Service Desk Plus MCP Server Development";
const PROJECT_DESCRIPTION = `Development of Model Context Protocol (MCP) server for Service Desk Plus Cloud API.

Repository: https://github.com/TenKTech/service-desk-plus-mcp
Version: v0.3.0 → v1.0.0
Tech Stack: TypeScript, Node.js, MCP SDK

Features implemented:
- Request Management (8 tools)
- Project Management (11 tools)  
- Rate Limiting & Multi-user Support

Next milestones:
- v0.4.0: Asset Management
- v0.5.0: Change Management
- v1.0.0: Production Release`;

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Creating SDP MCP Development Project\n');
  
  try {
    const config = loadConfig();
    const client = new SDPClient(config);
    
    console.log(`Rate limit: ${config.rateLimitPerMinute} req/min\n`);
    
    // Step 1: List projects to check if exists
    console.log('1️⃣ Checking existing projects...');
    let stats = client.rateLimiter.getStats();
    console.log(`   Rate: ${stats.current}/${stats.max}`);
    
    const projects = await client.projects.list({ per_page: 50 });
    const existing = projects.data?.find(p => p.title === PROJECT_TITLE);
    
    let projectId;
    
    if (existing) {
      console.log(`✅ Project exists: ${existing.id}\n`);
      projectId = existing.id;
      
      // Update it
      console.log('2️⃣ Updating project...');
      await wait(3000); // Space out requests
      
      stats = client.rateLimiter.getStats();
      console.log(`   Rate: ${stats.current}/${stats.max}`);
      
      await client.projects.update(projectId, {
        description: PROJECT_DESCRIPTION,
        percentage_completion: 30
      });
      console.log('✅ Updated\n');
      
    } else {
      // Create new
      console.log('2️⃣ Creating project...');
      await wait(3000);
      
      stats = client.rateLimiter.getStats();
      console.log(`   Rate: ${stats.current}/${stats.max}`);
      
      const project = await client.projects.create({
        title: PROJECT_TITLE,
        description: PROJECT_DESCRIPTION
      });
      
      projectId = project.id;
      console.log(`✅ Created: ${projectId}\n`);
    }
    
    // Step 3: Create a few key tasks
    const tasks = [
      "Fix date formatting (SDPDate with epoch ms)",
      "Add field ID lookup methods",
      "Fix worklog endpoint 404 error"
    ];
    
    console.log('3️⃣ Creating tasks...');
    
    for (let i = 0; i < tasks.length; i++) {
      if (i > 0) await wait(5000); // 5 seconds between tasks
      
      stats = client.rateLimiter.getStats();
      console.log(`\n   Task ${i+1}/${tasks.length} - Rate: ${stats.current}/${stats.max}`);
      
      try {
        await client.projects.createTask({
          title: tasks[i],
          project: { id: projectId }
        });
        console.log(`   ✅ ${tasks[i]}`);
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        if (error.message.includes('rate')) {
          console.log('   ⚠️  Rate limited - waiting 30s...');
          await wait(30000);
        }
      }
    }
    
    // Final stats
    stats = client.rateLimiter.getStats();
    console.log(`\n📊 Final rate limit: ${stats.current}/${stats.max}`);
    console.log(`   Resets in: ${stats.resetIn}s`);
    
    // Save info
    const fs = await import('fs/promises');
    await fs.writeFile('PROJECT_ID.txt', projectId);
    console.log(`\n💾 Project ID saved: ${projectId}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.details) {
      console.error('Details:', JSON.stringify(error.details, null, 2));
    }
  }
}

main();