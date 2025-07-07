#!/usr/bin/env node

import { config } from 'dotenv';
import { testConnection, closePool } from '../dist/db/config.js';
import { DatabaseTokenStore } from '../dist/db/tokenStore.js';
import { auditLogger } from '../dist/db/auditLog.js';
import { changeTracker } from '../dist/db/changeTracking.js';

config();

async function testDatabase() {
  console.log('🔍 Testing database connection...\n');
  
  try {
    // Test basic connection
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }
    
    console.log('✅ Database connection successful\n');
    
    // Test token storage
    console.log('📝 Testing token storage...');
    const tokenStore = new DatabaseTokenStore();
    
    // Store a test token
    await tokenStore.storeTokens({
      access_token: 'test_access_token_' + Date.now(),
      refresh_token: 'test_refresh_token_' + Date.now(),
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'SDPOnDemand.requests.ALL'
    });
    console.log('✅ Token stored successfully');
    
    // Retrieve the token
    const activeToken = await tokenStore.getActiveToken();
    if (activeToken) {
      console.log('✅ Token retrieved successfully');
      console.log(`   - Token ID: ${activeToken.tokenId}`);
      console.log(`   - Expires at: ${activeToken.tokenExpiry.toISOString()}`);
    } else {
      console.log('❌ Failed to retrieve token');
    }
    
    // Test audit logging
    console.log('\n📋 Testing audit logging...');
    await auditLogger.logApiCall({
      endpoint: '/api/v3/requests',
      method: 'GET',
      requestData: { page: 1 },
      responseData: { requests: [] },
      statusCode: 200,
      durationMs: 123
    });
    console.log('✅ API call logged successfully');
    
    await auditLogger.logToolUsage({
      toolName: 'create_request',
      arguments: { subject: 'Test Request' },
      result: { id: '12345' },
      success: true,
      executionTimeMs: 456
    });
    console.log('✅ Tool usage logged successfully');
    
    // Test change tracking
    console.log('\n🔄 Testing change tracking...');
    await changeTracker.trackChange({
      entityType: 'request',
      entityId: '12345',
      operation: 'create',
      newValue: { subject: 'Test Request', status: 'Open' },
      toolName: 'create_request'
    });
    console.log('✅ Change tracked successfully');
    
    // Get debug info
    console.log('\n🔍 Database debug info:');
    const debugInfo = await tokenStore.getDebugInfo();
    console.log(JSON.stringify(debugInfo, null, 2));
    
    // Get stats
    console.log('\n📊 API Stats (last 24 hours):');
    const apiStats = await auditLogger.getApiStats(24);
    console.log(`   - Total endpoints called: ${apiStats.length}`);
    
    console.log('\n📊 Tool Stats (last 24 hours):');
    const toolStats = await auditLogger.getToolStats(24);
    console.log(`   - Total tools used: ${toolStats.length}`);
    
    console.log('\n📊 Change Stats (last 24 hours):');
    const changeStats = await changeTracker.getChangeStats(24);
    console.log(`   - Total changes: ${changeStats.total_changes}`);
    console.log(`   - Entities changed: ${changeStats.entities_changed}`);
    
    console.log('\n✅ All database features working correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

testDatabase().catch(console.error);