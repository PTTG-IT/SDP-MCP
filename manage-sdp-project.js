#!/usr/bin/env node

/**
 * Script to manage the SDP MCP Development project in Service Desk Plus
 * This creates and maintains a real project for tracking our development work
 */

import 'dotenv/config';
import { SDPClient } from './dist/api/client.js';
import { loadConfig } from './dist/utils/config.js';

const PROJECT_TITLE = "Service Desk Plus MCP Server Development";
const PROJECT_DESCRIPTION = `Development of a Model Context Protocol (MCP) server for Service Desk Plus Cloud API integration.

Repository: https://github.com/TenKTech/service-desk-plus-mcp
Current Version: v0.3.0
Target Release: v1.0.0 (June 2025)

This project tracks the development of a comprehensive MCP server that enables AI assistants to interact with Service Desk Plus Cloud, automating IT service management tasks.`;

async function findExistingProject(client, title) {
  try {
    const projects = await client.projects.list({ per_page: 100 });
    if (projects.data) {
      return projects.data.find(p => p.title === title);
    }
  } catch (error) {
    console.error('Error listing projects:', error.message);
  }
  return null;
}

async function deleteTestProjects(client) {
  console.log('🧹 Looking for test projects to clean up...\n');
  
  try {
    const projects = await client.projects.list({ per_page: 100 });
    const testProjects = projects.data.filter(p => 
      p.title.includes('Test Project') || 
      p.title.includes('SDP MCP Development Project - Test')
    );
    
    if (testProjects.length === 0) {
      console.log('No test projects found.\n');
      return;
    }
    
    console.log(`Found ${testProjects.length} test projects:`);
    testProjects.forEach(p => {
      console.log(`- ${p.title} (ID: ${p.id})`);
    });
    
    // Note: Delete might not work due to permissions
    console.log('\nNote: Project deletion may require admin permissions.');
    console.log('If deletion fails, please delete these projects manually.\n');
    
  } catch (error) {
    console.error('Error during cleanup:', error.message);
  }
}

async function createOrUpdateProject(client) {
  console.log('📋 Managing SDP MCP Development Project...\n');
  
  // Check if project already exists
  const existingProject = await findExistingProject(client, PROJECT_TITLE);
  
  if (existingProject) {
    console.log('✅ Project already exists!');
    console.log(`   ID: ${existingProject.id}`);
    console.log(`   Status: ${existingProject.status?.name || 'Unknown'}`);
    console.log(`   Completion: ${existingProject.percentage_completion || 0}%\n`);
    
    // Update the project
    console.log('📝 Updating project details...');
    try {
      const updated = await client.projects.update(existingProject.id, {
        description: PROJECT_DESCRIPTION,
        percentage_completion: 30, // We're at v0.3.0 targeting v1.0.0
      });
      console.log('✅ Project updated successfully!\n');
      return existingProject.id;
    } catch (error) {
      console.error('❌ Failed to update project:', error.message);
      return existingProject.id;
    }
  } else {
    // Create new project
    console.log('🆕 Creating new project...');
    try {
      const project = await client.projects.create({
        title: PROJECT_TITLE,
        description: PROJECT_DESCRIPTION,
      });
      
      console.log('✅ Project created successfully!');
      console.log(`   ID: ${project.id}`);
      console.log(`   Title: ${project.title}\n`);
      return project.id;
    } catch (error) {
      console.error('❌ Failed to create project:', error.message);
      if (error.details) {
        console.error('Details:', JSON.stringify(error.details, null, 2));
      }
      return null;
    }
  }
}

async function createProjectTasks(client, projectId) {
  console.log('📌 Creating/Updating Project Tasks...\n');
  
  const tasks = [
    {
      title: "Fix date formatting in Project API",
      description: "Update all date fields to use SDPDate format with epoch milliseconds",
      priority: "High",
      status: "Open",
    },
    {
      title: "Implement field validation for projects",
      description: "Add proper validation for project_type, priority, and status fields that require IDs",
      priority: "High",
      status: "Open",
    },
    {
      title: "Fix worklog endpoint 404 error",
      description: "Research and implement correct endpoint for project worklogs",
      priority: "Medium",
      status: "Open",
    },
    {
      title: "Complete Asset Management module",
      description: "Implement full asset management API with 8-10 MCP tools (v0.4.0)",
      priority: "High",
      status: "Open",
    },
    {
      title: "Implement Change Management module",
      description: "Build change management with 24 MCP tools as specified (v0.5.0)",
      priority: "Medium",
      status: "Open",
    },
    {
      title: "Create comprehensive test suite",
      description: "Build Jest test suite with >80% code coverage",
      priority: "Medium",
      status: "Open",
    }
  ];
  
  // Check existing tasks
  try {
    const existingTasks = await client.projects.listProjectTasks(projectId);
    console.log(`Found ${existingTasks.data?.length || 0} existing tasks.\n`);
  } catch (error) {
    console.log('Unable to list existing tasks.\n');
  }
  
  // Create tasks
  for (const taskData of tasks) {
    console.log(`Creating task: ${taskData.title}`);
    try {
      const task = await client.projects.createTask({
        title: taskData.title,
        description: taskData.description,
        project: { id: projectId },
      });
      console.log(`✅ Created task ID: ${task.id}`);
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
      if (error.details && error.details.response_status?.messages) {
        error.details.response_status.messages.forEach(msg => {
          console.error(`   - ${msg.message || msg}`);
        });
      }
    }
  }
  console.log('');
}

async function documentFindings(projectId) {
  console.log('📄 Documenting Findings...\n');
  
  const findings = `# SDP MCP Development - Project Setup Findings

## Project ID: ${projectId}

## Key Discoveries

### 1. Project Creation
- Projects can be created with minimal fields (title, description)
- Default status is assigned automatically ("New")
- No project_type or priority required for basic creation

### 2. Field Requirements
- **project_type**: Requires valid ID, not name
- **priority**: Requires valid ID, not name  
- **status**: Requires valid ID for updates
- **dates**: Must use SDPDate format with epoch milliseconds

### 3. Task Creation Issues
- Tasks require proper project association
- May have "EXTRA_KEY_FOUND_IN_JSON" errors with certain fields
- Milestone creation has similar issues

### 4. API Endpoints
- Project endpoints work correctly: /projects
- Task endpoint: /tasks (not /projects/{id}/tasks for creation)
- Worklog endpoint returns 404 (needs investigation)

### 5. Permissions
- Project deletion requires admin permissions (403 Forbidden)
- Most other operations work with standard API access

## Next Steps
1. Update API implementation to handle field IDs properly
2. Fix date formatting in all handlers
3. Research correct worklog endpoints
4. Implement field lookup functionality
5. Add comprehensive error handling

Last Updated: ${new Date().toISOString()}
`;

  return findings;
}

async function main() {
  console.log('Service Desk Plus MCP - Project Management');
  console.log('==========================================\n');
  
  try {
    // Initialize client
    const config = loadConfig();
    const client = new SDPClient(config);
    
    // Clean up test projects
    await deleteTestProjects(client);
    
    // Create or update main project
    const projectId = await createOrUpdateProject(client);
    
    if (projectId) {
      // Create tasks
      await createProjectTasks(client, projectId);
      
      // Document findings
      const findings = await documentFindings(projectId);
      
      // Save findings to file
      const fs = await import('fs/promises');
      await fs.writeFile('SDP_PROJECT_FINDINGS.md', findings);
      console.log('📝 Findings saved to SDP_PROJECT_FINDINGS.md\n');
      
      console.log('✨ Project setup complete!');
      console.log(`\nProject ID: ${projectId}`);
      console.log('You can now track development progress in Service Desk Plus.\n');
    }
    
  } catch (error) {
    console.error('\n💥 Unexpected error:', error);
  }
}

// Run the script
main().catch(console.error);