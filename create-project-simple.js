#!/usr/bin/env node

/**
 * Simple script to create the SDP MCP project
 */

import 'dotenv/config';
import { SDPClient } from './dist/api/client.js';
import { loadConfig } from './dist/utils/config.js';

async function main() {
  console.log('Creating SDP MCP Development Project...\n');
  
  try {
    const config = loadConfig();
    const client = new SDPClient(config);
    
    // Create project
    const project = await client.projects.create({
      title: "Service Desk Plus MCP Server Development",
      description: "Development of MCP server for SDP Cloud API. Repository: https://github.com/TenKTech/service-desk-plus-mcp",
    });
    
    console.log('✅ Project created successfully!');
    console.log(`ID: ${project.id}`);
    console.log(`Title: ${project.title}`);
    console.log(`Status: ${project.status?.name || 'Unknown'}`);
    
    // Save project ID
    const fs = await import('fs/promises');
    await fs.writeFile('PROJECT_ID.txt', project.id);
    console.log('\nProject ID saved to PROJECT_ID.txt');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();