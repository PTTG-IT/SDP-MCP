# Service Desk Plus Cloud API Reference

This document provides a comprehensive reference for the Service Desk Plus Cloud API client.

## Table of Contents

1. [Authentication](#authentication)
2. [Requests API](#requests-api)
3. [Assets API](#assets-api)
4. [Users API](#users-api)
5. [Problems API](#problems-api)
6. [Changes API](#changes-api)
7. [Projects API](#projects-api)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)

## Authentication

The API client uses OAuth 2.0 for authentication. The authentication is handled automatically by the client.

```typescript
import { SDPClient } from 'service-desk-plus-cloud-api';

const client = new SDPClient({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  baseUrl: 'https://your-domain.com',  // Your SDP portal URL
  instanceName: 'your_instance'  // From Admin > Instance Settings
});
```

**Important Notes:**
- Authentication is done via Zoho's OAuth server (`https://accounts.zoho.com`)
- The API uses the Accept header: `application/vnd.manageengine.sdp.v3+json`
- API endpoints follow the pattern: `{baseUrl}/app/{instanceName}/api/v3/{resource}`
- All POST/PUT data must be sent as URL-encoded with `input_data` parameter containing JSON
- Field names differ from documentation: use `email_id` instead of `email` for user objects

## Requests API

### Create Request

**Required Fields:** Service Desk Plus requires several fields for new requests:
- `mode`: How request was submitted (e.g., "E-Mail", "Web Form")
- `request_type`: Type of request (e.g., "Request", "Incident")
- `urgency`: Urgency level (e.g., "3 - Have Workaround")
- `level`: Support level (e.g., "1 - Frontline")
- `impact`: Impact level (e.g., "1 - Affects User")
- `category`: Request category
- `subcategory`: Request subcategory
- `status`: Initial status (typically "Open")

```typescript
const request = await client.requests.create({
  subject: 'Need new laptop',
  description: 'My current laptop is not working properly',
  requester: {
    email_id: 'user@example.com',  // Note: use email_id, not email
    name: 'John Doe'  // Optional: requester name
  },
  // Required fields with defaults
  mode: { name: 'E-Mail' },
  request_type: { name: 'Request' },
  urgency: { name: '3 - Have Workaround' },
  level: { name: '1 - Frontline' },
  impact: { name: '1 - Affects User' },
  category: { name: 'Hardwre' },  // Note the spelling in your instance
  subcategory: { name: 'Computer' },
  priority: { name: '2 - Normal' },
  status: { name: 'Open' }
});
```

### Get Request

```typescript
const request = await client.requests.get('123456');
```

### Update Request

```typescript
const updatedRequest = await client.requests.update('123456', {
  status: { name: 'In Progress' },
  technician: { email_id: 'tech@example.com' }  // Note: use email_id, not email
});
```

### Search Requests

```typescript
const results = await client.requests.search('laptop', {
  per_page: 20,
  page: 1
});
```

### List Requests

```typescript
const requests = await client.requests.list({
  page: 1,
  per_page: 50,
  sort_by: 'created_time',
  sort_order: 'desc'
});
```

### Add Note to Request

```typescript
const note = await client.requests.addNote('123456', {
  content: 'Working on this issue',
  is_public: false
});
```

### Close Request

**Important:** To close a request in Service Desk Plus:
1. The request must have a technician assigned
2. Use the update endpoint with status "Closed" and closure_info
3. The close endpoint may not work as expected

```typescript
// Method 1: Update with closure info (Recommended)
const closedRequest = await client.requests.update('123456', {
  status: { name: 'Closed' },
  technician: { email_id: 'tech@example.com' },  // Required if not already assigned
  closure_info: {
    closure_comments: 'Issue resolved by replacing the laptop',
    closure_code: { name: 'Completed' }  // Common values: Completed, Cancelled, Solved
  }
});

// Method 2: Using close endpoint (may not work)
const closedRequest = await client.requests.close('123456', {
  closure_comments: 'Issue resolved by replacing the laptop',
  closure_code: { name: 'Resolved' }
});
```

## Assets API

### Create Asset

```typescript
const asset = await client.assets.create({
  name: 'Dell Laptop - XPS 15',
  asset_tag: 'ASSET-001',
  product: { name: 'Dell XPS 15' },
  vendor: { name: 'Dell' },
  location: { name: 'Building A - Floor 2' },
  assigned_to: { email: 'user@example.com' }
});
```

### Get Asset

```typescript
const asset = await client.assets.get('789012');
```

### Update Asset

```typescript
const updatedAsset = await client.assets.update('789012', {
  location: { name: 'Building B - Floor 1' },
  assigned_to: { email: 'newuser@example.com' }
});
```

### Search Assets

```typescript
const assets = await client.assets.search('laptop', {
  per_page: 20
});
```

## Users API

### Get User

```typescript
const user = await client.users.get('345678');
```

### Search Users

```typescript
const users = await client.users.search('john', {
  per_page: 10
});
```

### List Users

```typescript
const users = await client.users.list({
  page: 1,
  per_page: 100
});
```

## Problems API

### Create Problem

```typescript
const problem = await client.problems.create({
  title: 'Email server downtime',
  description: 'Multiple users reporting email access issues',
  impact: 'High',
  urgency: 'High',
  category: { name: 'Email' }
});
```

### Get Problem

```typescript
const problem = await client.problems.get('234567');
```

## Changes API

### Create Change

```typescript
const change = await client.changes.create({
  title: 'Upgrade email server',
  description: 'Upgrade to resolve recurring issues',
  change_type: 'Standard',
  risk: 'Medium',
  scheduled_start_time: '2024-01-15T10:00:00Z',
  scheduled_end_time: '2024-01-15T14:00:00Z',
  reason_for_change: 'Prevent future downtime'
});
```

## Projects API

### Create Project

```typescript
const project = await client.projects.create({
  title: 'Office 365 Migration',
  description: 'Migrate all users to Office 365',
  project_type: { name: 'Implementation' },
  priority: { name: 'High' },
  owner: { email_id: 'project.manager@company.com' },
  scheduled_start_time: '2024-02-01T00:00:00Z',
  scheduled_end_time: '2024-03-31T23:59:59Z',
  site: { name: 'Main Office' },
  group: { name: 'IT Projects' }
});
```

### Update Project

```typescript
const updatedProject = await client.projects.update('123456', {
  status: { name: 'In Progress' },
  percentage_completion: 45,
  actual_start_time: '2024-02-05T09:00:00Z'
});
```

### Get Project

```typescript
const project = await client.projects.get('123456');
```

### List Projects

```typescript
const projects = await client.projects.list({
  page: 1,
  per_page: 20,
  sort_by: 'created_time',
  sort_order: 'desc'
});
```

## Tasks API

### Create Task

```typescript
const task = await client.projects.createTask({
  title: 'Configure Email Migration',
  description: 'Set up email migration rules and test',
  project: { id: '123456' },
  milestone: { id: '789' },
  owner: { email_id: 'tech@company.com' },
  priority: { name: 'High' },
  scheduled_start_time: '2024-02-10T09:00:00Z',
  scheduled_end_time: '2024-02-15T17:00:00Z',
  estimated_hours: 16
});
```

### Update Task

```typescript
const updatedTask = await client.projects.updateTask('456789', {
  status: { name: 'In Progress' },
  percentage_completion: 75,
  actual_hours: 12
});
```

### Get Task

```typescript
const task = await client.projects.getTask('456789');
```

### List Project Tasks

```typescript
const tasks = await client.projects.listProjectTasks('123456', {
  page: 1,
  per_page: 50
});
```

## Milestones API

### Create Milestone

```typescript
const milestone = await client.projects.createMilestone('123456', {
  title: 'Phase 1 - User Migration',
  description: 'Migrate first batch of users',
  owner: { email_id: 'lead@company.com' },
  scheduled_start_time: '2024-02-01T00:00:00Z',
  scheduled_end_time: '2024-02-28T23:59:59Z'
});
```

### List Project Milestones

```typescript
const milestones = await client.projects.listMilestones('123456');
```

## Worklog API

### Add Worklog

```typescript
// Log time on a task
const worklog = await client.projects.addWorklog({
  task: { id: '456789' },
  description: 'Configured email migration rules',
  start_time: '2024-02-10T09:00:00Z',
  end_time: '2024-02-10T12:30:00Z',
  owner: { email_id: 'tech@company.com' },
  is_billable: true,
  worklog_type: { name: 'Development' }
});

// Log time on a project (without specific task)
const projectWorklog = await client.projects.addWorklog({
  project: { id: '123456' },
  description: 'Project planning meeting',
  start_time: '2024-02-01T14:00:00Z',
  end_time: '2024-02-01T15:30:00Z',
  is_billable: false,
  worklog_type: { name: 'Meeting' }
});
```

### List Worklogs

```typescript
// List worklogs for a project
const projectWorklogs = await client.projects.listProjectWorklogs('123456');

// List worklogs for a task
const taskWorklogs = await client.projects.listTaskWorklogs('456789');
```

## Error Handling

The API client provides specific error types for different scenarios:

```typescript
import { SDPError, SDPAuthError, SDPRateLimitError } from 'service-desk-plus-cloud-api';

try {
  await client.requests.create(data);
} catch (error) {
  if (error instanceof SDPAuthError) {
    // Handle authentication error
    console.error('Authentication failed:', error.message);
  } else if (error instanceof SDPRateLimitError) {
    // Handle rate limit
    console.error(`Rate limit hit. Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof SDPError) {
    // Handle other SDP errors
    console.error('SDP Error:', error.message, error.code);
  }
}
```

## Rate Limiting

The client automatically handles rate limiting with built-in retry logic. You can configure the rate limit:

```typescript
const client = new SDPClient({
  // ... other config
  rateLimitPerMinute: 60 // Default is 60
});
```

## Pagination

Most list endpoints support pagination. The API uses a specific format for pagination parameters:

```typescript
const response = await client.requests.list({
  page: 2,
  per_page: 50
});

console.log(`Page ${response.meta.page} of ${response.meta.total_pages}`);
console.log(`Total items: ${response.meta.total_count}`);
```

**Note:** The API internally converts these parameters to SDP's `input_data` format with `list_info.row_count` and `list_info.start_index`.

## Common Field Values

### Request Fields
- **Mode**: "E-Mail", "Web Form", "Phone", "Chat"
- **Request Type**: "Request", "Incident", "Service Request"
- **Urgency**: "1 - Critical", "2 - High", "3 - Have Workaround", "4 - Low"
- **Level**: "1 - Frontline", "2 - Escalation", "3 - Management"
- **Impact**: "1 - Affects User", "2 - Affects Department", "3 - Affects Business"
- **Priority**: "1 - High", "2 - Normal", "3 - Low"
- **Status**: "Open", "In Progress", "On Hold", "Resolved", "Closed"
- **Closure Code**: "Completed", "Cancelled", "Solved", "Not Solved"

**Note:** Some instances may have custom values or different spelling (e.g., "Hardwre" instead of "Hardware").

## Custom Fields

When working with custom fields:

```typescript
const request = await client.requests.create({
  subject: 'Custom field example',
  custom_fields: [
    {
      field_id: 'udf_char_001',
      value: 'Custom value'
    },
    {
      field_id: 'udf_date_001',
      value: '2024-01-15'
    }
  ]
});
```

## Attachments

To add attachments to requests:

```typescript
const attachment = await client.requests.addAttachment(
  '123456',
  Buffer.from('file content'),
  'document.pdf'
);
```