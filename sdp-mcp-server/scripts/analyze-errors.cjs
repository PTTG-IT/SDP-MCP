#!/usr/bin/env node

/**
 * Analyze API errors and provide insights
 */

const fs = require('fs').promises;
const path = require('path');

async function analyzeErrors() {
  try {
    const logFile = path.join(__dirname, '..', 'api-errors.log');
    
    try {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line);
      const errors = lines.map(line => JSON.parse(line));
      
      console.log('\n📊 API Error Analysis Report');
      console.log('============================\n');
      
      // Overall stats
      console.log(`Total Errors: ${errors.length}`);
      console.log(`Time Range: ${errors[0]?.timestamp} to ${errors[errors.length-1]?.timestamp}\n`);
      
      // Group by status code
      const byStatusCode = {};
      errors.forEach(error => {
        const code = error.apiStatusCode || 'UNKNOWN';
        if (!byStatusCode[code]) {
          byStatusCode[code] = {
            count: 0,
            messages: new Set(),
            endpoints: new Set(),
            missingFields: new Set()
          };
        }
        
        byStatusCode[code].count++;
        byStatusCode[code].messages.add(error.message);
        byStatusCode[code].endpoints.add(error.endpoint);
        
        if (error.fields && error.fields.length > 0) {
          error.fields.forEach(field => byStatusCode[code].missingFields.add(field));
        }
      });
      
      // Status code breakdown
      console.log('📈 Errors by Status Code:');
      console.log('-------------------------');
      
      Object.entries(byStatusCode)
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([code, data]) => {
          console.log(`\n[${code}] - ${data.count} occurrences`);
          console.log(`  Messages: ${Array.from(data.messages).join('; ')}`);
          console.log(`  Endpoints: ${Array.from(data.endpoints).join(', ')}`);
          
          if (data.missingFields.size > 0) {
            console.log(`  Missing Fields: ${Array.from(data.missingFields).join(', ')}`);
          }
          
          // Provide specific guidance
          const guidance = getGuidanceForCode(code);
          if (guidance) {
            console.log(`  💡 Solution: ${guidance}`);
          }
        });
      
      // Endpoint analysis
      console.log('\n\n📍 Errors by Endpoint:');
      console.log('----------------------');
      
      const byEndpoint = {};
      errors.forEach(error => {
        const endpoint = error.endpoint || 'UNKNOWN';
        if (!byEndpoint[endpoint]) {
          byEndpoint[endpoint] = {
            count: 0,
            statusCodes: new Set()
          };
        }
        
        byEndpoint[endpoint].count++;
        byEndpoint[endpoint].statusCodes.add(error.apiStatusCode);
      });
      
      Object.entries(byEndpoint)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10) // Top 10
        .forEach(([endpoint, data]) => {
          console.log(`${endpoint}: ${data.count} errors (codes: ${Array.from(data.statusCodes).join(', ')})`);
        });
      
      // Recent errors
      console.log('\n\n🕐 Recent Errors (last 5):');
      console.log('-------------------------');
      
      errors.slice(-5).reverse().forEach(error => {
        console.log(`${error.timestamp} - [${error.apiStatusCode}] ${error.message} @ ${error.endpoint}`);
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No error log file found. Errors will be logged as they occur.');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('Error analyzing logs:', error);
  }
}

function getGuidanceForCode(code) {
  const codeNum = parseInt(code);
  
  const guidance = {
    4001: 'Use valid email addresses that exist in SDP. Get from existing tickets.',
    4002: 'Check business rules. Some fields may be read-only after creation.',
    4007: 'Verify endpoint exists. May need different OAuth scope.',
    4012: 'Add missing mandatory fields. Check web UI for required fields.',
    4022: 'OAuth token issue. New token with all scopes should fix this.',
    4015: 'Rate limit. Wait 5-10 minutes before retrying.'
  };
  
  return guidance[codeNum] || null;
}

// Run analysis
analyzeErrors();