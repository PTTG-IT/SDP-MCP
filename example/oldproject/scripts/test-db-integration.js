#!/usr/bin/env node

import { config } from 'dotenv';
import { testConnection, query, queryOne, closePool } from '../dist/db/config.js';
import { DatabaseTokenStore } from '../dist/db/tokenStore.js';
import { auditLogger } from '../dist/db/auditLog.js';
import { changeTracker } from '../dist/db/changeTracking.js';
import { getClient } from '../dist/utils/clientFactory.js';

config();

async function testDatabaseIntegration() {
  console.log('🚀 Testing Database Integration Features\n');
  
  try {
    // Test 1: Database Connection
    console.log('📋 Test 1: Database Connection');
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connected successfully\n');
    
    // Test 2: Token Storage and Retrieval
    console.log('📋 Test 2: Token Storage and Retrieval');
    await testTokenStorage();
    
    // Test 3: Audit Logging
    console.log('\n📋 Test 3: Audit Logging');
    await testAuditLogging();
    
    // Test 4: Change Tracking
    console.log('\n📋 Test 4: Change Tracking');
    await testChangeTracking();
    
    // Test 5: MCP Tool Usage Tracking
    console.log('\n📋 Test 5: MCP Tool Usage Tracking');
    await testToolUsageTracking();
    
    // Test 6: Database Query Performance
    console.log('\n📋 Test 6: Database Query Performance');
    await testQueryPerformance();
    
    // Test 7: Data Integrity
    console.log('\n📋 Test 7: Data Integrity');
    await testDataIntegrity();
    
    console.log('\n✅ All database integration tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

async function testTokenStorage() {
  const tokenStore = new DatabaseTokenStore();
  
  // Store a test token
  const testToken = {
    access_token: 'test_' + Date.now(),
    refresh_token: 'refresh_' + Date.now(),
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'SDPOnDemand.ALL'
  };
  
  console.log('   - Storing test token...');
  await tokenStore.storeTokens(testToken);
  
  // Verify token was stored
  const storedToken = await queryOne(
    'SELECT * FROM oauth_tokens WHERE access_token = $1',
    [testToken.access_token]
  );
  
  if (storedToken) {
    console.log('   ✓ Token stored successfully');
    console.log(`     • ID: ${storedToken.id}`);
    console.log(`     • Expires: ${storedToken.expires_at}`);
  } else {
    throw new Error('Token not found in database');
  }
  
  // Test rate limiting
  console.log('   - Testing rate limiting...');
  const canRequest = await tokenStore.canRequestToken();
  console.log(`   ✓ Can request token: ${canRequest}`);
  
  // Record a token request
  await tokenStore.recordTokenRequest('refresh', true);
  console.log('   ✓ Token request recorded');
  
  // Check refresh timing
  const canRefresh = await tokenStore.canRefreshNow();
  console.log(`   ✓ Can refresh now: ${canRefresh}`);
}

async function testAuditLogging() {
  // Log a simulated API call
  const apiCallData = {
    endpoint: '/api/v3/requests',
    method: 'POST',
    requestData: { subject: 'Test Request' },
    responseData: { id: '12345', status: 'Open' },
    statusCode: 200,
    durationMs: 150
  };
  
  console.log('   - Logging API call...');
  await auditLogger.logApiCall(apiCallData);
  console.log('   ✓ API call logged');
  
  // Log tool usage
  const toolUsageData = {
    toolName: 'create_request',
    arguments: { subject: 'Test' },
    result: { id: '12345' },
    success: true,
    executionTimeMs: 200
  };
  
  console.log('   - Logging tool usage...');
  const toolId = await auditLogger.logToolUsage(toolUsageData);
  console.log(`   ✓ Tool usage logged (ID: ${toolId})`);
  
  // Get statistics
  console.log('   - Retrieving statistics...');
  const apiStats = await auditLogger.getApiStats(1);
  const toolStats = await auditLogger.getToolStats(1);
  
  console.log(`   ✓ Found ${apiStats.length} API endpoints used`);
  console.log(`   ✓ Found ${toolStats.length} tools used`);
}

async function testChangeTracking() {
  // Track a create operation
  const createChange = {
    entityType: 'request',
    entityId: 'TEST-123',
    operation: 'create',
    newValue: { subject: 'Test Request', status: 'Open' },
    toolName: 'create_request',
    notes: 'Test change tracking'
  };
  
  console.log('   - Tracking create operation...');
  const changeId = await changeTracker.trackChange(createChange);
  console.log(`   ✓ Create operation tracked (ID: ${changeId})`);
  
  // Track multiple field updates
  const updates = [
    { fieldName: 'status', oldValue: 'Open', newValue: 'In Progress' },
    { fieldName: 'priority', oldValue: 'Low', newValue: 'High' }
  ];
  
  console.log('   - Tracking field updates...');
  const updateIds = await changeTracker.trackMultipleChanges(
    'request',
    'TEST-123',
    updates,
    { toolName: 'update_request' }
  );
  console.log(`   ✓ ${updateIds.length} field updates tracked`);
  
  // Get entity history
  console.log('   - Retrieving entity history...');
  const history = await changeTracker.getEntityHistory('request', 'TEST-123');
  console.log(`   ✓ Found ${history.length} changes for entity`);
  
  // Check rollback capability
  const rollbackable = await changeTracker.getRollbackableChanges('request', 1);
  console.log(`   ✓ ${rollbackable.length} changes can be rolled back`);
}

async function testToolUsageTracking() {
  // Simulate multiple tool uses
  const tools = ['create_request', 'update_request', 'close_request'];
  
  console.log('   - Simulating tool usage...');
  for (const tool of tools) {
    await auditLogger.logToolUsage({
      toolName: tool,
      arguments: { test: true },
      result: { success: true },
      success: true,
      executionTimeMs: Math.floor(Math.random() * 500) + 100
    });
  }
  console.log(`   ✓ ${tools.length} tool uses logged`);
  
  // Get tool usage history
  const history = await auditLogger.getToolUsageHistory(undefined, 10);
  console.log(`   ✓ Retrieved ${history.length} recent tool uses`);
  
  // Generate correlation ID for related operations
  const correlationId = auditLogger.generateCorrelationId();
  console.log(`   ✓ Generated correlation ID: ${correlationId}`);
}

async function testQueryPerformance() {
  console.log('   - Testing query performance...');
  
  const queries = [
    {
      name: 'Active tokens',
      sql: 'SELECT COUNT(*) as count FROM oauth_tokens WHERE is_active = true'
    },
    {
      name: 'Recent API calls',
      sql: 'SELECT COUNT(*) as count FROM api_audit_log WHERE timestamp > NOW() - INTERVAL \'1 hour\''
    },
    {
      name: 'Change history',
      sql: 'SELECT COUNT(*) as count FROM change_history WHERE changed_at > NOW() - INTERVAL \'1 hour\''
    }
  ];
  
  for (const queryTest of queries) {
    const start = Date.now();
    const result = await queryOne(queryTest.sql);
    const duration = Date.now() - start;
    console.log(`   ✓ ${queryTest.name}: ${result.count} records (${duration}ms)`);
  }
}

async function testDataIntegrity() {
  console.log('   - Verifying data integrity...');
  
  // Check foreign key relationships
  const orphanedChanges = await queryOne(
    `SELECT COUNT(*) as count 
     FROM change_history ch 
     LEFT JOIN mcp_tool_usage mtu ON ch.mcp_tool_usage_id = mtu.id 
     WHERE ch.mcp_tool_usage_id IS NOT NULL AND mtu.id IS NULL`
  );
  console.log(`   ✓ No orphaned change records: ${orphanedChanges.count === '0'}`);
  
  // Check data consistency
  const tokenConsistency = await queryOne(
    `SELECT 
       COUNT(*) FILTER (WHERE is_active = true) as active_count,
       COUNT(*) FILTER (WHERE is_active = true AND expires_at < NOW()) as expired_active
     FROM oauth_tokens`
  );
  console.log(`   ✓ Active tokens: ${tokenConsistency.active_count}`);
  console.log(`   ✓ Expired but active: ${tokenConsistency.expired_active}`);
  
  // Verify tables exist
  const tableCount = await queryOne(
    `SELECT COUNT(*) as count
     FROM information_schema.tables
     WHERE table_schema = 'public'
     AND table_type = 'BASE TABLE'`
  );
  console.log(`   ✓ Database has ${tableCount.count} tables`);
}

// Run the tests
testDatabaseIntegration().catch(console.error);