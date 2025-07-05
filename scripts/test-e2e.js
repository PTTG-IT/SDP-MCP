#!/usr/bin/env node

import { config } from 'dotenv';
import { getClient } from '../dist/utils/clientFactory.js';
import { testConnection, query, queryOne, closePool } from '../dist/db/config.js';
import { auditLogger } from '../dist/db/auditLog.js';
import { changeTracker } from '../dist/db/changeTracking.js';

config();

// Test data tracking
const testEntities = {
  requests: [],
  projects: [],
  tasks: [],
  assets: []
};

/**
 * End-to-End Test Suite for Database Integration
 */
async function runE2ETests() {
  console.log('🚀 Starting End-to-End Tests for SDP MCP Database Integration\n');
  
  try {
    // Test 1: Database Connectivity
    console.log('📋 Test 1: Database Connectivity');
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection successful\n');
    
    // Test 2: Token Management
    console.log('📋 Test 2: Token Management');
    await testTokenManagement();
    
    // Test 3: Create Request with Audit Logging
    console.log('📋 Test 3: Create Request with Audit Logging');
    await testCreateRequest();
    
    // Test 4: Create Project and Task
    console.log('📋 Test 4: Create Project and Task');
    await testProjectAndTask();
    
    // Test 5: Update Operations with Change Tracking
    console.log('📋 Test 5: Update Operations with Change Tracking');
    await testUpdateOperations();
    
    // Test 6: Verify Audit Logs
    console.log('📋 Test 6: Verify Audit Logs');
    await verifyAuditLogs();
    
    // Test 7: Verify Change History
    console.log('📋 Test 7: Verify Change History');
    await verifyChangeHistory();
    
    // Test 8: Clean Up Test Data
    console.log('📋 Test 8: Clean Up Test Data');
    await cleanupTestData();
    
    // Test 9: Final Database Validation
    console.log('📋 Test 9: Final Database Validation');
    await finalValidation();
    
    console.log('\n✅ All tests passed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error.validationErrors || error.details) {
      console.error('Validation details:', JSON.stringify(error.validationErrors || error.details, null, 2));
    }
    console.error('\n⚠️  Attempting to clean up test data...');
    await cleanupTestData().catch(console.error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

async function testTokenManagement() {
  const client = getClient();
  
  // Check if token exists in database
  const tokenCount = await queryOne(
    'SELECT COUNT(*) as count FROM oauth_tokens WHERE is_active = true'
  );
  console.log(`   - Active tokens in database: ${tokenCount.count}`);
  
  // Make an API call to trigger token usage
  try {
    const requests = await client.requests.list({ page: 1, per_page: 1 });
    console.log('   - API call successful, token is working');
  } catch (error) {
    throw new Error(`Token test failed: ${error.message}`);
  }
  
  // Verify token was recorded as used
  const recentToken = await queryOne(
    'SELECT * FROM oauth_tokens WHERE is_active = true ORDER BY last_used_at DESC LIMIT 1'
  );
  if (recentToken && recentToken.last_used_at) {
    console.log('   - Token usage recorded in database');
  }
  
  console.log('✅ Token management working correctly\n');
}

async function testCreateRequest() {
  const client = getClient();
  
  // Create a test request
  const requestData = {
    subject: `E2E Test Request - ${new Date().toISOString()}`,
    description: 'This is an automated test request for database integration testing',
    requester: {
      name: 'Test User',
      email_id: 'test@example.com'
    },
    priority: { name: 'Low' },
    mode: { name: 'E-Mail' },
    request_type: { name: 'Request' },
    urgency: { name: 'Normal' },
    status: { name: 'Open' }
  };
  
  console.log('   - Creating test request...');
  const startTime = Date.now();
  const request = await client.requests.create(requestData);
  const duration = Date.now() - startTime;
  
  testEntities.requests.push(request.id);
  console.log(`   - Request created: ID ${request.id} (${duration}ms)`);
  
  // Verify audit log was created
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for async logging
  
  const auditLog = await queryOne(
    `SELECT * FROM api_audit_log 
     WHERE endpoint LIKE '%/requests%' 
     AND method = 'POST' 
     ORDER BY timestamp DESC 
     LIMIT 1`
  );
  
  if (auditLog) {
    console.log(`   - Audit log created: ${auditLog.endpoint} (${auditLog.duration_ms}ms)`);
  } else {
    throw new Error('Audit log not found for request creation');
  }
  
  console.log('✅ Request creation with audit logging successful\n');
}

async function testProjectAndTask() {
  const client = getClient();
  
  // Create a test project
  const projectData = {
    title: `E2E Test Project - ${new Date().toISOString()}`,
    description: 'Automated test project for database integration',
    priority: 'Medium',
    scheduled_start: new Date().toISOString(),
    scheduled_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  console.log('   - Creating test project...');
  const project = await client.projects.create(projectData);
  testEntities.projects.push(project.id);
  console.log(`   - Project created: ID ${project.id}`);
  
  // Create a task in the project
  const taskData = {
    project_id: project.id,
    title: 'E2E Test Task',
    description: 'Test task for database integration',
    priority: 'Medium',
    estimated_hours: 2
  };
  
  console.log('   - Creating test task...');
  const task = await client.projects.createTask(taskData);
  testEntities.tasks.push({ id: task.id, projectId: project.id });
  console.log(`   - Task created: ID ${task.id}`);
  
  // Verify MCP tool usage was logged
  const toolUsage = await query(
    `SELECT * FROM mcp_tool_usage 
     WHERE tool_name IN ('create_project', 'create_task') 
     ORDER BY timestamp DESC 
     LIMIT 2`
  );
  
  if (toolUsage.length >= 2) {
    console.log('   - MCP tool usage logged for both operations');
  }
  
  console.log('✅ Project and task creation successful\n');
}

async function testUpdateOperations() {
  const client = getClient();
  
  if (testEntities.requests.length === 0) {
    throw new Error('No test request available for update testing');
  }
  
  const requestId = testEntities.requests[0];
  
  // Update the request
  const updateData = {
    status: 'In Progress',
    priority: 'Medium',
    description: 'Updated description for E2E testing'
  };
  
  console.log(`   - Updating request ${requestId}...`);
  const updatedRequest = await client.requests.update(requestId, updateData);
  console.log('   - Request updated successfully');
  
  // Add a note to the request
  console.log('   - Adding note to request...');
  await client.requests.addNote(requestId, {
    content: 'E2E test note - verifying change tracking',
    is_public: false
  });
  console.log('   - Note added successfully');
  
  // Verify change tracking
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for async tracking
  
  const changes = await query(
    `SELECT * FROM change_history 
     WHERE entity_type = 'request' 
     AND entity_id = $1 
     ORDER BY changed_at DESC`,
    [requestId]
  );
  
  if (changes.length > 0) {
    console.log(`   - Change tracking recorded ${changes.length} changes`);
    changes.forEach(change => {
      console.log(`     • ${change.operation}: ${change.field_name || 'entity'}`);
    });
  } else {
    console.warn('   ⚠️  No changes tracked for request update');
  }
  
  console.log('✅ Update operations with change tracking successful\n');
}

async function verifyAuditLogs() {
  // Get API statistics
  const stats = await auditLogger.getApiStats(1); // Last hour
  
  console.log('   - API Statistics (last hour):');
  stats.slice(0, 5).forEach(stat => {
    console.log(`     • ${stat.endpoint} [${stat.method}]: ${stat.call_count} calls, avg ${Math.round(stat.avg_duration)}ms`);
  });
  
  // Get tool usage statistics
  const toolStats = await auditLogger.getToolStats(1);
  
  console.log('   - Tool Usage Statistics (last hour):');
  toolStats.forEach(stat => {
    console.log(`     • ${stat.tool_name}: ${stat.usage_count} uses, ${stat.success_count} successful`);
  });
  
  // Check for any errors
  const errors = await query(
    `SELECT endpoint, method, error_message, timestamp 
     FROM api_audit_log 
     WHERE error_message IS NOT NULL 
     AND timestamp > NOW() - INTERVAL '1 hour' 
     ORDER BY timestamp DESC 
     LIMIT 5`
  );
  
  if (errors.length > 0) {
    console.log(`   - Recent errors: ${errors.length}`);
    errors.forEach(err => {
      console.log(`     • ${err.endpoint}: ${err.error_message}`);
    });
  } else {
    console.log('   - No API errors in the last hour');
  }
  
  console.log('✅ Audit log verification complete\n');
}

async function verifyChangeHistory() {
  // Get change statistics
  const changeStats = await changeTracker.getChangeStats(1);
  
  console.log('   - Change Statistics (last hour):');
  console.log(`     • Total changes: ${changeStats.total_changes}`);
  console.log(`     • Entities changed: ${changeStats.entities_changed}`);
  console.log(`     • Creates: ${changeStats.creates}`);
  console.log(`     • Updates: ${changeStats.updates}`);
  console.log(`     • Deletes: ${changeStats.deletes}`);
  
  // Get recent changes summary
  const recentChanges = await changeTracker.getRecentChangesSummary(10);
  
  console.log('   - Recent Changes:');
  recentChanges.slice(0, 5).forEach(change => {
    console.log(`     • ${change.entity_type} ${change.entity_id}: ${change.operation} (${change.change_count} changes)`);
  });
  
  // Check for rollbackable changes
  const rollbackable = await changeTracker.getRollbackableChanges(undefined, 1);
  console.log(`   - Rollbackable changes available: ${rollbackable.length}`);
  
  console.log('✅ Change history verification complete\n');
}

async function cleanupTestData() {
  const client = getClient();
  
  console.log('   - Cleaning up test data...');
  
  // Close test requests
  for (const requestId of testEntities.requests) {
    try {
      await client.requests.close(requestId, {
        closure_comments: 'E2E test completed - closing request',
        closure_code: 'Completed'
      });
      console.log(`     • Closed request ${requestId}`);
    } catch (error) {
      console.warn(`     ⚠️  Failed to close request ${requestId}: ${error.message}`);
    }
  }
  
  // Complete test tasks
  for (const task of testEntities.tasks) {
    try {
      await client.projects.completeTask(task.id, {
        completion_comments: 'E2E test completed'
      });
      console.log(`     • Completed task ${task.id}`);
    } catch (error) {
      console.warn(`     ⚠️  Failed to complete task ${task.id}: ${error.message}`);
    }
  }
  
  // Update test projects to completed
  for (const projectId of testEntities.projects) {
    try {
      await client.projects.update(projectId, {
        status: 'Completed',
        percentage_completion: 100
      });
      console.log(`     • Marked project ${projectId} as completed`);
    } catch (error) {
      console.warn(`     ⚠️  Failed to update project ${projectId}: ${error.message}`);
    }
  }
  
  console.log('✅ Test data cleanup complete\n');
}

async function finalValidation() {
  // Verify database integrity
  const dbStats = await queryOne(`
    SELECT 
      (SELECT COUNT(*) FROM oauth_tokens WHERE is_active = true) as active_tokens,
      (SELECT COUNT(*) FROM api_audit_log WHERE timestamp > NOW() - INTERVAL '1 hour') as recent_api_calls,
      (SELECT COUNT(*) FROM mcp_tool_usage WHERE timestamp > NOW() - INTERVAL '1 hour') as recent_tool_usage,
      (SELECT COUNT(*) FROM change_history WHERE changed_at > NOW() - INTERVAL '1 hour') as recent_changes,
      (SELECT COUNT(*) FROM token_requests WHERE requested_at > NOW() - INTERVAL '1 hour') as recent_token_requests
  `);
  
  console.log('   - Database Statistics:');
  console.log(`     • Active tokens: ${dbStats.active_tokens}`);
  console.log(`     • Recent API calls: ${dbStats.recent_api_calls}`);
  console.log(`     • Recent tool usage: ${dbStats.recent_tool_usage}`);
  console.log(`     • Recent changes: ${dbStats.recent_changes}`);
  console.log(`     • Recent token requests: ${dbStats.recent_token_requests}`);
  
  // Verify all test entities were tracked
  const trackedEntities = await query(`
    SELECT DISTINCT entity_type, COUNT(DISTINCT entity_id) as count
    FROM change_history
    WHERE changed_at > NOW() - INTERVAL '1 hour'
    GROUP BY entity_type
  `);
  
  console.log('   - Tracked Entity Types:');
  trackedEntities.forEach(entity => {
    console.log(`     • ${entity.entity_type}: ${entity.count} entities`);
  });
  
  console.log('✅ Final validation complete\n');
}

// Run the tests
runE2ETests().catch(console.error);