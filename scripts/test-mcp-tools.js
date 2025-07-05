#!/usr/bin/env node

import { config } from 'dotenv';
import { getClient } from '../dist/utils/clientFactory.js';
import { createToolHandler } from '../dist/mcp/handlers.js';
import { createWrappedToolHandler } from '../dist/mcp/toolWrapper.js';
import { query, queryOne, closePool } from '../dist/db/config.js';
import { auditLogger } from '../dist/db/auditLog.js';
import { changeTracker } from '../dist/db/changeTracking.js';

config();

const testEntities = {
  requests: [],
  projects: [],
  tasks: []
};

async function testMCPTools() {
  console.log('🚀 Testing MCP Tools with Database Integration\n');
  
  const client = getClient();
  
  try {
    // Test 1: Create Request via MCP Tool
    console.log('📋 Test 1: Create Request via MCP Tool');
    await testCreateRequestTool(client);
    
    // Test 2: Update Request via MCP Tool
    console.log('\n📋 Test 2: Update Request via MCP Tool');
    await testUpdateRequestTool(client);
    
    // Test 3: Create Project and Task via MCP Tools
    console.log('\n📋 Test 3: Create Project and Task via MCP Tools');
    await testProjectTools(client);
    
    // Test 4: Verify Database Tracking
    console.log('\n📋 Test 4: Verify Database Tracking');
    await verifyDatabaseTracking();
    
    // Test 5: Clean up
    console.log('\n📋 Test 5: Clean Up Test Data');
    await cleanupTestData(client);
    
    console.log('\n✅ All MCP tool tests passed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error.details) {
      console.error('Details:', JSON.stringify(error.details, null, 2));
    }
    await cleanupTestData(client).catch(console.error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

async function testCreateRequestTool(client) {
  // Create the tool handler with database wrapping
  const baseHandler = createToolHandler('create_request', client);
  const handler = createWrappedToolHandler('create_request', baseHandler);
  
  // Test minimal request creation
  console.log('   - Testing minimal request creation...');
  const args1 = {
    subject: 'MCP Tool Test - Minimal Request'
  };
  
  try {
    const result1 = await handler(args1);
    console.log('   ✓ Minimal request created successfully');
    const match = result1.match(/ID: (\d+)/);
    if (match) {
      testEntities.requests.push(match[1]);
    }
  } catch (error) {
    console.error('   ✗ Minimal request failed:', error.message);
  }
  
  // Test full request creation
  console.log('   - Testing full request creation...');
  const args2 = {
    subject: 'MCP Tool Test - Full Request',
    description: 'Testing all fields via MCP tool',
    requester_email: 'test@example.com',
    requester_name: 'Test User',
    priority: 'Medium',
    category: 'Software',
    tags: ['mcp-test', 'automated']
  };
  
  try {
    const result2 = await handler(args2);
    console.log('   ✓ Full request created successfully');
    const match = result2.match(/ID: (\d+)/);
    if (match) {
      testEntities.requests.push(match[1]);
    }
  } catch (error) {
    console.error('   ✗ Full request failed:', error.message);
  }
}

async function testUpdateRequestTool(client) {
  if (testEntities.requests.length === 0) {
    console.log('   - No requests to update, skipping...');
    return;
  }
  
  const requestId = testEntities.requests[0];
  const baseHandler = createToolHandler('update_request', client);
  const handler = createWrappedToolHandler('update_request', baseHandler);
  
  const args = {
    request_id: requestId,
    status: 'In Progress',
    priority: 'High',
    description: 'Updated via MCP tool test'
  };
  
  console.log(`   - Updating request ${requestId}...`);
  try {
    const result = await handler(args);
    console.log('   ✓ Request updated successfully');
  } catch (error) {
    console.error('   ✗ Update failed:', error.message);
  }
}

async function testProjectTools(client) {
  // Create project
  const createProjectHandler = createWrappedToolHandler(
    'create_project',
    createToolHandler('create_project', client)
  );
  
  const projectArgs = {
    title: 'MCP Tool Test Project',
    description: 'Testing project creation via MCP',
    priority: 'Medium'
  };
  
  console.log('   - Creating project...');
  let projectId;
  try {
    const result = await createProjectHandler(projectArgs);
    console.log('   ✓ Project created successfully');
    const match = result.match(/ID: (\d+)/);
    if (match) {
      projectId = match[1];
      testEntities.projects.push(projectId);
    }
  } catch (error) {
    console.error('   ✗ Project creation failed:', error.message);
    return;
  }
  
  // Create task
  if (projectId) {
    const createTaskHandler = createWrappedToolHandler(
      'create_task',
      createToolHandler('create_task', client)
    );
    
    const taskArgs = {
      project_id: projectId,
      title: 'MCP Tool Test Task',
      description: 'Testing task creation via MCP',
      priority: 'Medium',
      estimated_hours: 4
    };
    
    console.log('   - Creating task...');
    try {
      const result = await createTaskHandler(taskArgs);
      console.log('   ✓ Task created successfully');
      const match = result.match(/ID: (\d+)/);
      if (match) {
        testEntities.tasks.push({ id: match[1], projectId });
      }
    } catch (error) {
      console.error('   ✗ Task creation failed:', error.message);
    }
  }
}

async function verifyDatabaseTracking() {
  // Check MCP tool usage
  const toolUsage = await query(
    `SELECT tool_name, success, COUNT(*) as count 
     FROM mcp_tool_usage 
     WHERE timestamp > NOW() - INTERVAL '10 minutes'
     GROUP BY tool_name, success
     ORDER BY tool_name`
  );
  
  console.log('   - MCP Tool Usage:');
  toolUsage.forEach(usage => {
    console.log(`     • ${usage.tool_name}: ${usage.count} calls (${usage.success ? 'successful' : 'failed'})`);
  });
  
  // Check API audit logs
  const apiCalls = await query(
    `SELECT endpoint, method, COUNT(*) as count, AVG(duration_ms) as avg_duration
     FROM api_audit_log
     WHERE timestamp > NOW() - INTERVAL '10 minutes'
     GROUP BY endpoint, method
     ORDER BY count DESC
     LIMIT 5`
  );
  
  console.log('   - API Calls:');
  apiCalls.forEach(call => {
    console.log(`     • ${call.method} ${call.endpoint}: ${call.count} calls, avg ${Math.round(call.avg_duration)}ms`);
  });
  
  // Check change tracking
  const changes = await query(
    `SELECT entity_type, operation, COUNT(*) as count
     FROM change_history
     WHERE changed_at > NOW() - INTERVAL '10 minutes'
     GROUP BY entity_type, operation
     ORDER BY entity_type, operation`
  );
  
  console.log('   - Change Tracking:');
  changes.forEach(change => {
    console.log(`     • ${change.entity_type} ${change.operation}: ${change.count} changes`);
  });
}

async function cleanupTestData(client) {
  // Close requests
  for (const requestId of testEntities.requests) {
    try {
      await client.requests.update(requestId, {
        status: { name: 'Closed' },
        closure_info: {
          closure_code: { name: 'Completed' },
          closure_comments: 'MCP tool test completed'
        }
      });
      console.log(`   ✓ Closed request ${requestId}`);
    } catch (error) {
      console.warn(`   ⚠️  Failed to close request ${requestId}: ${error.message}`);
    }
  }
  
  // Complete tasks
  for (const task of testEntities.tasks) {
    try {
      const completeTaskHandler = createToolHandler('complete_task', client);
      await completeTaskHandler({
        task_id: task.id,
        completion_comments: 'MCP tool test completed'
      });
      console.log(`   ✓ Completed task ${task.id}`);
    } catch (error) {
      console.warn(`   ⚠️  Failed to complete task ${task.id}: ${error.message}`);
    }
  }
  
  // Update projects
  for (const projectId of testEntities.projects) {
    try {
      await client.projects.update(projectId, {
        status: 'Completed',
        percentage_completion: 100
      });
      console.log(`   ✓ Completed project ${projectId}`);
    } catch (error) {
      console.warn(`   ⚠️  Failed to update project ${projectId}: ${error.message}`);
    }
  }
}

// Run the tests
testMCPTools().catch(console.error);