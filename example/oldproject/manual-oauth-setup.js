#!/usr/bin/env node

import { config } from 'dotenv';
import { createHash } from 'crypto';
import { encryptData } from './dist/utils/encryption.js';
import { getPool } from './dist/db/config.js';

config();

async function manualOAuthSetup() {
  console.log('🔧 Manual OAuth Setup for Testing\n');
  
  const clientId = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
  const clientSecret = '5752f7060c587171f81b21d58c5b8d0019587ca999';
  const refreshToken = '1000.230f6615807edcbeb20dbe397b50e836.635ca41b7d8dd576174f07ea1232ef7d';
  
  // Hash client ID
  const clientIdHash = createHash('sha256').update(clientId).digest('hex');
  console.log('Client ID Hash:', clientIdHash);
  
  // Create token data
  const tokenData = {
    accessToken: '',
    refreshToken: refreshToken,
    expiresAt: new Date(Date.now() - 10 * 60 * 1000) // Expired 10 minutes ago to force refresh
  };
  
  // Encrypt token data
  const encryptedTokens = encryptData(JSON.stringify(tokenData));
  console.log('Encrypted tokens:', encryptedTokens.substring(0, 50) + '...');
  
  // Get database pool
  const pool = getPool();
  if (!pool) {
    console.error('❌ Database pool not available');
    process.exit(1);
  }
  
  try {
    // Delete existing tokens for this client
    await pool.query('DELETE FROM oauth_tokens WHERE client_id_hash = $1', [clientIdHash]);
    
    // Insert new tokens
    const result = await pool.query(`
      INSERT INTO oauth_tokens (client_id, client_id_hash, encrypted_tokens, last_refreshed_at, refresh_count)
      VALUES ($1, $2, $3, NOW(), 0)
      RETURNING id
    `, [clientId, clientIdHash, encryptedTokens]);
    
    console.log('✅ OAuth tokens stored successfully! ID:', result.rows[0].id);
    console.log('\nYou can now test the MCP tools with this client.');
    
  } catch (error) {
    console.error('❌ Error storing tokens:', error);
  } finally {
    await pool.end();
  }
}

manualOAuthSetup().catch(console.error);