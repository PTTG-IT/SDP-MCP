# Service Desk Plus Requests API Reference

## Overview

The numerous help desk tickets raised in your organization are organized and tracked in the Requests module. The Requests module enables you to handle tickets promptly, assign tickets to technicians, merge similar requests and so on.

## Base URL

```
<service domain|custom domain>/app/<portal>/api/v3/requests
```

For custom domains:
```
https://helpdesk.yourdomain.com/app/instance_name/api/v3/requests
```

## Authentication

All requests require the following headers:
- `Accept: application/vnd.manageengine.sdp.v3+json`
- `Authorization: Zoho-oauthtoken <access_token>`
- `Content-Type: application/x-www-form-urlencoded` (for POST/PUT operations)

## Request Attributes

### Core Attributes

| Attribute | Type | Description | Max Length |
|-----------|------|-------------|------------|
| `id` | long | Unique identifier of the request | - |
| `subject` | string | Subject of the request | 250 chars |
| `description` | html | Description of the request | - |
| `impact_details` | string | Description about the impact | 250 chars |
| `email_ids_to_notify` | array | Email addresses to notify | - |
| `delete_pre_template_tasks` | boolean | Whether to delete pre-template tasks | - |

### System Attributes

| Attribute | Type | Description | Access |
|-----------|------|-------------|--------|
| `created_time` | datetime | When the request was created | Read-only |
| `due_by_time` | datetime | When the request is due | Read/Write |
| `first_response_due_by_time` | datetime | First response due time | Read/Write |
| `last_updated_time` | datetime | Last modification time | Read-only |
| `resolved_time` | datetime | When the request was resolved | Read-only |
| `completed_time` | datetime | When the request was completed | Read-only |
| `responded_time` | datetime | When first response was given | Read-only |
| `assigned_time` | datetime | When the request was assigned | Read-only |
| `deleted_time` | datetime | When the request was deleted | Read-only |

### Reference Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `status` | status | Current status of the request |
| `priority` | priority | Priority level of the request |
| `category` | category | Category classification |
| `subcategory` | subcategory | Subcategory classification |
| `urgency` | urgency | Urgency level |
| `impact` | impact | Impact level |
| `level` | level | Support level (Tier 1, Tier 2, etc.) |
| `mode` | mode | How the request was created |
| `request_type` | request_type | Type of request (Incident, Service Request) |
| `requester` | user | Person who submitted the request |
| `technician` | technician | Assigned technician |
| `group` | group | Assigned group |
| `site` | site | Associated site |
| `template` | request_template | Template used for creation |
| `sla` | sla | Service Level Agreement |
| `service_category` | service_category | Service category |

### Additional Attributes

| Attribute | Type | Description | Access |
|-----------|------|-------------|--------|
| `display_id` | long | Human-readable ID | Read-only |
| `time_elapsed` | long | Time spent on the request | Read-only |
| `is_overdue` | boolean | Whether the request is overdue | Read-only |
| `is_escalated` | boolean | Whether the request is escalated | Read-only |
| `is_first_response_overdue` | boolean | First response overdue flag | Read-only |
| `is_read` | boolean | Whether the request has been read | Read-only |
| `is_service_request` | boolean | Service request flag | Read-only |
| `is_fcr` | boolean | First Call Resolution flag | Read/Write |
| `is_reopened` | boolean | Whether the request was reopened | Read-only |
| `is_trashed` | boolean | Whether the request is in trash | Read-only |
| `has_attachments` | boolean | Whether request has attachments | Read-only |
| `has_notes` | boolean | Whether request has notes | Read-only |
| `has_linked_requests` | boolean | Whether request has linked requests | Read-only |
| `has_project` | boolean | Whether request is linked to a project | Read-only |
| `has_problem` | boolean | Whether request is linked to a problem | Read-only |
| `has_request_initiated_change` | boolean | Request initiated change flag | Read-only |
| `has_change_initiated_request` | boolean | Change initiated request flag | Read-only |
| `has_purchase_orders` | boolean | Whether request has purchase orders | Read-only |
| `has_draft` | boolean | Whether request has draft | Read-only |

### Complex Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `assets` | array | Associated assets |
| `configuration_items` | array | Configuration items |
| `udf_fields` | object | User-defined fields |
| `attachments` | array | File attachments |
| `resources` | object | Service catalog resources |
| `resolution` | object | Resolution details |
| `closure_info` | object | Closure information |
| `service_approvers` | object | Service approval configuration |
| `onhold_scheduler` | object | On-hold scheduling information |
| `linked_to_request` | object | Linked request details |

### Email Attributes (Read-only)

| Attribute | Type | Description |
|-----------|------|-------------|
| `email_cc` | array | CC email addresses |
| `email_to` | array | TO email addresses |
| `email_bcc` | array | BCC email addresses |

### User Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `created_by` | user | User who created the request |
| `on_behalf_of` | user | User on whose behalf request was created |
| `editor` | user | User who last edited the request |

### Cost Attributes (Read-only)

| Attribute | Type | Description |
|-----------|------|-------------|
| `service_cost` | double | Cost of the service |
| `total_cost` | double | Total cost of the request |

### Status and Approval Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `approval_status` | approval_status | Current approval status |
| `notification_status` | string | Notification status |
| `lifecycle` | lifecycle | Request lifecycle information |
| `cancellation_requested` | boolean | Cancellation request flag |
| `cancel_flag_comments` | action_comment | Cancellation comments |
| `completed_by_denial` | boolean | Completion by denial flag |
| `editor_status` | int | Editor status code |
| `unreplied_count` | long | Number of unreplied communications |

### Scheduling Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `scheduled_start_time` | datetime | Scheduled start time |
| `scheduled_end_time` | datetime | Scheduled end time |
| `status_change_comments` | string | Comments for status changes |
| `update_reason` | string | Reason for the update |

### Deleted Assets

| Attribute | Type | Description |
|-----------|------|-------------|
| `deleted_assets` | array | Assets that were deleted |

## API Operations

### 1. Create Request

Creates a new service desk request.

**URL**: `POST /requests`

**Mandatory Fields**: `subject`

**Request Format**:
```json
{
  "request": {
    "subject": "Need an External Monitor",
    "description": "Provide me an External Monitor",
    "requester": {
      "email_id": "lincoln@zmail.com"
    },
    "category": {
      "name": "Hardware"
    },
    "subcategory": {
      "name": "Monitor"
    },
    "priority": {
      "name": "High"
    },
    "technician": {
      "email_id": "charles@zmail.com"
    }
  }
}
```

**Common Create Fields**:
- `subject` (required): Request subject
- `description`: Detailed description
- `requester`: Requester information
- `category`: Request category
- `subcategory`: Request subcategory
- `priority`: Priority level
- `urgency`: Urgency level
- `impact`: Impact level
- `technician`: Assigned technician
- `group`: Assigned group
- `mode`: Creation mode
- `request_type`: Type of request
- `status`: Initial status
- `level`: Support level
- `site`: Associated site
- `template`: Template to use
- `due_by_time`: Due date
- `first_response_due_by_time`: First response due date
- `assets`: Associated assets
- `configuration_items`: Configuration items
- `udf_fields`: User-defined fields
- `email_ids_to_notify`: Notification emails
- `resources`: Service catalog resources
- `service_approvers`: Approval configuration

**Response**: Returns the created request object with all attributes populated.

### 2. Update Request

Updates an existing service desk request.

**URL**: `PUT /requests/{request_id}`

**Request Format**:
```json
{
  "request": {
    "subject": "Updated Subject",
    "status": {
      "name": "In Progress"
    },
    "priority": {
      "name": "High"
    },
    "technician": {
      "email_id": "new_technician@company.com"
    },
    "update_reason": "Escalating to higher priority"
  }
}
```

**Common Update Fields**:
- `subject`: Updated subject
- `description`: Updated description
- `status`: New status
- `priority`: New priority
- `technician`: New technician assignment
- `group`: New group assignment
- `category`: New category
- `subcategory`: New subcategory
- `urgency`: New urgency level
- `impact`: New impact level
- `due_by_time`: New due date
- `resolution`: Resolution details
- `closure_info`: Closure information
- `update_reason`: Reason for the update
- `status_change_comments`: Comments for status change

**Response**: Returns the updated request object.

### 3. Get Request

Retrieves detailed information about a specific request.

**URL**: `GET /requests/{request_id}`

**Response**: Returns the complete request object with all attributes.

### 4. List Requests

Retrieves a list of requests with optional filtering and pagination.

**URL**: `GET /requests`

**Query Parameters**:
```json
{
  "list_info": {
    "row_count": 100,
    "start_index": 1,
    "sort_field": "created_time",
    "sort_order": "desc",
    "get_total_count": true,
    "search_criteria": {
      "field": "status.name",
      "condition": "is",
      "value": "Open"
    }
  }
}
```

**List Parameters**:
- `row_count`: Number of records to return (max 100)
- `start_index`: Starting index for pagination
- `page`: Page number (alternative to start_index)
- `sort_field`: Field to sort by
- `sort_order`: Sort order (`asc` or `desc`)
- `get_total_count`: Whether to return total count
- `search_criteria`: Search filters
- `filter_by`: Simple single-field filter

**Search Criteria Format**:
```json
{
  "field": "status.name",
  "condition": "is",
  "value": "Open",
  "logical_operator": "AND"
}
```

**Supported Conditions**:
- `is`: Exact match
- `is not`: Not equal
- `contains`: Contains text
- `does not contain`: Does not contain text
- `starts with`: Starts with text
- `ends with`: Ends with text
- `greater than`: Greater than value
- `less than`: Less than value
- `greater than or equal`: Greater than or equal
- `less than or equal`: Less than or equal
- `is empty`: Field is empty
- `is not empty`: Field is not empty

**Response**: Returns array of request objects with pagination information.

### 5. Delete Request

Deletes a request that is no longer required.

**URL**: `DELETE /requests/{request_id}`

**Response**: Returns success status.

### 6. Add Attachment

Adds a file attachment to a request.

**URL**: `POST /requests/{request_id}/_uploads`

**Content-Type**: `multipart/form-data`

**Parameters**:
- `filename`: File to upload (with @ prefix for path)
- `addtoattachment`: Boolean flag to add as attachment

**Example**:
```bash
curl -X POST \
  -H "Authorization: Zoho-oauthtoken <token>" \
  -H "Accept: application/vnd.manageengine.sdp.v3+json" \
  -F "filename=@/path/to/file.txt" \
  -F "addtoattachment=true" \
  "https://helpdesk.company.com/app/instance/api/v3/requests/123456/_uploads"
```

**Response**: Returns file information including file_id and content_url.

## Common Field Formats

### Status Object
```json
{
  "name": "Open",
  "id": "status_id"
}
```

### Priority Object
```json
{
  "name": "High",
  "id": "priority_id"
}
```

### User Object
```json
{
  "name": "John Doe",
  "email_id": "john.doe@company.com",
  "id": "user_id"
}
```

### Category Object
```json
{
  "name": "Software",
  "id": "category_id"
}
```

### Time Object
```json
{
  "display_value": "Nov 10, 2016 11:44 AM",
  "value": "1478758440000"
}
```

### Closure Info Object
```json
{
  "closure_code": "Resolved",
  "closure_comments": "Issue resolved by restarting the service",
  "closure_time": {
    "display_value": "Nov 10, 2016 11:44 AM",
    "value": "1478758440000"
  }
}
```

## Best Practices

### 1. Field Validation
- Always validate required fields before sending requests
- Check field length limits (especially subject: 250 characters)
- Use proper object format for reference fields

### 2. Error Handling
- Handle HTTP status codes appropriately
- Parse `response_status` object for API-specific errors
- Check for field-specific validation errors in error messages

### 3. Performance
- Use pagination for large result sets
- Limit `row_count` to reasonable values (max 100)
- Use appropriate search criteria to filter results

### 4. Security
- Always use HTTPS in production
- Protect OAuth tokens and refresh them appropriately
- Validate user permissions before operations

### 5. Data Consistency
- Use exact field names and values from metadata
- Maintain referential integrity with related entities
- Update related fields when changing request status

## Example Workflows

### Create Hardware Request
```json
{
  "request": {
    "subject": "Laptop replacement needed",
    "description": "Current laptop is malfunctioning",
    "category": { "name": "Hardware" },
    "subcategory": { "name": "Laptop" },
    "priority": { "name": "High" },
    "requester": { "email_id": "user@company.com" },
    "technician": { "email_id": "tech@company.com" }
  }
}
```

### Update Request Status
```json
{
  "request": {
    "status": { "name": "In Progress" },
    "technician": { "email_id": "senior_tech@company.com" },
    "update_reason": "Escalated to senior technician"
  }
}
```

### Close Request
```json
{
  "request": {
    "status": { "name": "Closed" },
    "closure_info": {
      "closure_comments": "Issue resolved by replacing hardware"
    }
  }
}
```

### Search Open High Priority Requests
```json
{
  "list_info": {
    "row_count": 50,
    "search_criteria": [
      {
        "field": "status.name",
        "condition": "is",
        "value": "Open"
      },
      {
        "field": "priority.name",
        "condition": "is",
        "value": "High",
        "logical_operator": "AND"
      }
    ]
  }
}
```

## Error Codes

Common error codes you may encounter:

- `2000`: Success
- `4000`: General failure
- `4001`: Invalid input data
- `4002`: Unauthorized operation
- `4003`: Resource not found
- `4004`: Duplicate resource
- `4005`: Validation failed
- `4006`: Insufficient permissions
- `4007`: Resource not available
- `4008`: Operation not supported
- `4009`: Rate limit exceeded
- `4010`: Service unavailable
- `4011`: Authentication failed
- `4012`: Missing mandatory fields

## Notes

- All datetime values are in milliseconds since epoch
- Some fields may be instance-specific and require configuration
- User-defined fields (UDF) structure depends on instance configuration
- Attachment operations require multipart/form-data content type
- Search operations support complex criteria with logical operators
- Maximum row count per request is 100 for performance reasons