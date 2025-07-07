# Test Scripts

This directory contains utility scripts for testing and managing the Service Desk Plus MCP Server.

## Scripts Overview

### Rate Limiting Scripts

#### `test-rate-limit.js`
Tests the current rate limit configuration and provides recommendations.
```bash
node tests/scripts/test-rate-limit.js
```

#### `find-optimal-rate.js`
Automatically tests different rate limits to find the optimal setting for your instance.
```bash
node tests/scripts/find-optimal-rate.js
```

### Project Management Scripts

#### `manage-sdp-project.js`
Complete project management script that:
- Creates/updates the SDP MCP Development project
- Adds project tasks
- Cleans up test projects
- Documents findings

```bash
node tests/scripts/manage-sdp-project.js
```

#### `create-project-simple-monitor.js`
Creates a project with simple rate limit monitoring.
```bash
node tests/scripts/create-project-simple-monitor.js
```

#### `create-project-monitored.js`
Advanced project creation with detailed monitoring and metrics.
```bash
node tests/scripts/create-project-monitored.js
```

#### `view-project.js`
Views project details and tests rate limiting.
```bash
node tests/scripts/view-project.js
```

### Feature Testing Scripts

#### `test-project-features.js`
Comprehensive test of all project management features including:
- Project CRUD operations
- Task management
- Milestone creation
- Worklog tracking

```bash
node tests/scripts/test-project-features.js
```

#### `test-project-basic.js`
Basic project functionality test with minimal features.
```bash
node tests/scripts/test-project-basic.js
```

## Usage Notes

1. **Prerequisites**: 
   - Build the project first: `npm run build`
   - Configure `.env` with your SDP credentials

2. **Rate Limiting**: 
   - Scripts respect the `SDP_RATE_LIMIT_PER_MINUTE` setting
   - Default is conservative to avoid API throttling
   - Use `find-optimal-rate.js` to find best setting

3. **Output Files**:
   - `PROJECT_ID.txt` - Stores created project ID
   - `PROJECT_INFO.json` - Detailed project information
   - `SDP_PROJECT_FINDINGS.md` - Testing findings and recommendations

4. **Best Practices**:
   - Run scripts one at a time
   - Wait between runs if rate limited
   - Start with `test-rate-limit.js` to verify configuration
   - Use monitoring scripts for production testing

## Common Issues

### Rate Limiting Errors
If you see "You have made too many requests continuously":
1. Wait 60-90 seconds
2. Reduce `SDP_RATE_LIMIT_PER_MINUTE` in `.env`
3. Run `find-optimal-rate.js` to find safe limit

### Authentication Errors
If authentication fails during script execution:
1. Token may have expired
2. Check credentials in `.env`
3. Manually refresh token if needed

### Project Creation Failures
Field validation errors usually mean:
1. Required fields missing
2. Field expects ID not name (e.g., priority, status)
3. Date format incorrect (use epoch milliseconds)

## Development

To add new test scripts:
1. Create script in this directory
2. Use ES modules (`import`/`export`)
3. Include rate limit monitoring
4. Add error handling
5. Document in this README

Example template:
```javascript
#!/usr/bin/env node

import 'dotenv/config';
import { SDPClient } from '../../dist/api/client.js';
import { loadConfig } from '../../dist/utils/config.js';

async function main() {
  const config = loadConfig();
  const client = new SDPClient(config);
  
  // Your test logic here
  
  // Always show rate limit stats
  const stats = client.rateLimiter.getStats();
  console.log(`Rate: ${stats.current}/${stats.max}`);
}

main().catch(console.error);
```