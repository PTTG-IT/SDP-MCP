# Service Desk Plus MCP Tools Documentation

This document describes all available MCP tools for Service Desk Plus integration.

## Request Management Tools

### create_request

Create a new service request.

**Parameters:**
- `subject` (required): Subject or title of the request
- `description`: Detailed description of the request
- `requester_email`: Email of the requester (uses email_id field internally)
- `requester_name`: Name of the requester
- `category`: Category of the request (e.g., "Hardware", "Software", "General")
- `subcategory`: Subcategory of the request (e.g., "Computer", "General")
- `priority`: Priority level (Low, Normal, High, Urgent)
- `urgency`: Urgency level (e.g., "3 - Have Workaround")
- `impact`: Impact level (e.g., "1 - Affects User")
- `technician_email`: Email of the technician to assign
- `due_date`: Due date in ISO format
- `tags`: Array of tags to add to the request

**Default Values:**
The tool automatically sets these required fields if not provided:
- `mode`: "E-Mail"
- `request_type`: "Request"
- `urgency`: "3 - Have Workaround"
- `level`: "1 - Frontline"
- `impact`: "1 - Affects User"
- `category`: "General"
- `subcategory`: "General"
- `status`: "Open"

**Example:**
```
Create a request with subject "New laptop needed" and description "Current laptop is 5 years old and very slow" for requester john.doe@company.com with high priority
```

### update_request

Update an existing service request.

**Parameters:**
- `request_id` (required): ID of the request to update
- `subject`: New subject for the request
- `description`: New description
- `priority`: New priority level
- `status`: New status
- `technician_email`: Email of technician to assign
- `category`: New category
- `subcategory`: New subcategory

**Example:**
```
Update request 12345 to set priority to Urgent and assign to tech@company.com
```

### get_request

Get details of a specific service request.

**Parameters:**
- `request_id` (required): ID of the request to retrieve

**Example:**
```
Get details of request 12345
```

### search_requests

Search for service requests using keywords or filters.

**Parameters:**
- `query` (required): Search query string
- `status`: Filter by status
- `priority`: Filter by priority
- `technician`: Filter by technician name or email
- `requester`: Filter by requester name or email
- `limit`: Maximum number of results (default: 20)

**Example:**
```
Search for requests containing "laptop" with status "Open" and high priority
```

### list_requests

List service requests with optional filters.

**Parameters:**
- `status`: Filter by status (e.g., Open, Closed)
- `priority`: Filter by priority
- `page`: Page number (default: 1)
- `per_page`: Results per page (default: 20)
- `sort_by`: Field to sort by
- `sort_order`: Sort order (asc or desc)

**Example:**
```
List open requests sorted by created time in descending order
```

### close_request

Close a service request with resolution details.

**Parameters:**
- `request_id` (required): ID of the request to close
- `closure_comments` (required): Resolution or closure comments
- `closure_code`: Closure code (e.g., "Completed", "Cancelled", "Solved")
- `technician_email`: Email of technician to assign before closing (if not already assigned)
- `notify_requester`: Whether to notify the requester (default: true)

**Important Notes:**
- Request must have a technician assigned before closing
- If no technician is assigned, provide `technician_email` parameter
- Common closure codes: "Completed", "Cancelled", "Solved", "Not Solved"

**Example:**
```
Close request 12345 with comment "Replaced laptop with new Dell XPS 15" and closure code "Completed"
```

### add_note_to_request

Add a note or comment to a service request.

**Parameters:**
- `request_id` (required): ID of the request
- `content` (required): Note content
- `is_public`: Whether the note is visible to requester (default: true)
- `notify_technician`: Whether to notify the technician (default: false)

**Example:**
```
Add note "Ordered replacement laptop, ETA 3 days" to request 12345
```

### assign_request

Assign a request to a technician.

**Parameters:**
- `request_id` (required): ID of the request to assign
- `technician_email` (required): Email of the technician
- `group_name`: Name of the support group

**Example:**
```
Assign request 12345 to john.tech@company.com
```

## Asset Management Tools

### create_asset

Create a new asset in the asset management system.

**Parameters:**
- `name` (required): Asset name
- `asset_tag`: Asset tag or serial number
- `product` (required): Product name or model
- `vendor`: Vendor or manufacturer
- `location`: Asset location
- `user_email`: Email of the asset user
- `purchase_date`: Purchase date in ISO format
- `cost`: Asset cost
- `description`: Additional description

**Example:**
```
Create asset "Dell XPS 15 - 2024" with asset tag "DELL-001" assigned to user@company.com
```

### update_asset

Update an existing asset's information.

**Parameters:**
- `asset_id` (required): ID of the asset to update
- `name`: New asset name
- `location`: New location
- `user_email`: New user email
- `status`: Asset status
- `description`: Updated description

**Example:**
```
Update asset 54321 to change location to "Building B - Floor 2"
```

### search_assets

Search for assets using various criteria.

**Parameters:**
- `query` (required): Search query
- `asset_type`: Filter by asset type
- `location`: Filter by location
- `user`: Filter by user name or email
- `limit`: Maximum number of results (default: 20)

**Example:**
```
Search for assets with "laptop" in Building A
```

## User Management Tools

### get_user

Get information about a user.

**Parameters:**
- `user_id`: User ID (either user_id or email required)
- `email`: User email (either user_id or email required)

**Example:**
```
Get user information for email john.doe@company.com
```

### search_users

Search for users in the system.

**Parameters:**
- `query` (required): Search query for user name or email
- `department`: Filter by department
- `site`: Filter by site/location
- `limit`: Maximum number of results (default: 20)

**Example:**
```
Search for users with "john" in IT department
```

## Problem Management Tools

### create_problem

Create a new problem record.

**Parameters:**
- `title` (required): Problem title
- `description` (required): Problem description
- `impact`: Impact level
- `urgency`: Urgency level
- `category`: Problem category
- `requester_email`: Email of the problem reporter

**Example:**
```
Create problem "Recurring email server downtime" with high impact and urgency
```

## Change Management Tools

### create_change

Create a new change request.

**Parameters:**
- `title` (required): Change request title
- `description` (required): Change description
- `reason_for_change` (required): Reason for the change
- `change_type`: Type of change (e.g., Standard, Emergency)
- `impact`: Expected impact
- `risk`: Risk level
- `scheduled_start`: Scheduled start time in ISO format
- `scheduled_end`: Scheduled end time in ISO format

**Example:**
```
Create change "Email server upgrade" scheduled for 2024-01-15 with medium risk
```

## Lookup Tools

These tools help you discover valid IDs and options for use in other operations.

### get_priorities

Get all available priority options with their IDs.

**Parameters:** None

**Returns:**
- `total`: Number of priorities
- `priorities`: Array of priority objects with:
  - `id`: Priority ID
  - `name`: Priority name (e.g., "High", "Medium", "Low")
  - `color`: Priority color code

**Example:**
```
Get all priorities
```

### get_categories

Get all available category options with their IDs.

**Parameters:** None

**Returns:**
- `total`: Number of categories
- `categories`: Array of category objects with:
  - `id`: Category ID
  - `name`: Category name
  - `description`: Category description
  - `parent_category`: Parent category name (if applicable)

**Example:**
```
Get all categories
```

### get_statuses

Get all available status options with their IDs.

**Parameters:** None

**Returns:**
- `total`: Number of statuses
- `statuses`: Array of status objects with:
  - `id`: Status ID
  - `name`: Status name
  - `stage`: Status stage
  - `color`: Status color code

**Example:**
```
Get all statuses
```

### get_technicians

Get all available technicians with their IDs and emails.

**Parameters:** None

**Returns:**
- `total`: Number of technicians
- `technicians`: Array of technician objects with:
  - `id`: Technician ID
  - `name`: Technician name
  - `email`: Technician email address
  - `department`: Department name
  - `designation`: Job title/designation

**Example:**
```
Get all technicians
```

### get_request_types

Get all available request type options with their IDs.

**Parameters:** None

**Returns:**
- `total`: Number of request types
- `request_types`: Array of request type objects with:
  - `id`: Request type ID
  - `name`: Request type name
  - `description`: Request type description

**Example:**
```
Get all request types
```

### get_subcategories

Get subcategories for a specific category.

**Parameters:**
- `category_name` (required): Name of the parent category

**Returns:**
- `category`: Parent category name
- `total`: Number of subcategories
- `subcategories`: Array of subcategory objects with:
  - `id`: Subcategory ID
  - `name`: Subcategory name
  - `description`: Subcategory description

**Example:**
```
Get subcategories for category "Hardware"
```

## Project Management Tools

### create_project

Create a new project in Service Desk Plus.

**Parameters:**
- `title` (required): Project title
- `description`: Project description
- `project_type`: Type of project (e.g., Development, Implementation, Maintenance)
- `priority`: Priority level (e.g., Low, Medium, High, Critical)
- `owner_email`: Email of the project owner
- `scheduled_start`: Scheduled start date in ISO format
- `scheduled_end`: Scheduled end date in ISO format
- `site`: Site/location name
- `group`: Group responsible for the project

**Example:**
```
Create project "Service Desk Plus MCP Integration" with description "Build comprehensive MCP server for SDP Cloud API" type Development priority High owner developer@company.com scheduled from 2024-01-01 to 2024-03-31
```

### update_project

Update an existing project.

**Parameters:**
- `project_id` (required): ID of the project to update
- `title`: New project title
- `description`: New project description
- `status`: Project status (e.g., Open, In Progress, On Hold, Completed, Cancelled)
- `priority`: New priority level
- `owner_email`: New owner email
- `percentage_completion`: Completion percentage (0-100)
- `actual_start`: Actual start date in ISO format
- `actual_end`: Actual end date in ISO format

**Example:**
```
Update project 123456 to status "In Progress" with 25% completion
```

### get_project

Get details of a specific project.

**Parameters:**
- `project_id` (required): ID of the project to retrieve

**Example:**
```
Get details of project 123456
```

### list_projects

List all projects with optional filters.

**Parameters:**
- `status`: Filter by status
- `owner`: Filter by owner name or email
- `page`: Page number (default: 1)
- `per_page`: Results per page (default: 20)
- `sort_by`: Field to sort by (e.g., created_time, title)
- `sort_order`: Sort order (asc or desc)

**Example:**
```
List all projects with status "In Progress" owned by john@company.com
```

### create_task

Create a new task in a project.

**Parameters:**
- `title` (required): Task title
- `description`: Task description
- `project_id` (required): ID of the project this task belongs to
- `milestone_id`: ID of the milestone this task belongs to
- `owner_email`: Email of the task owner
- `group`: Group responsible for the task
- `priority`: Priority level (e.g., Low, Medium, High, Critical)
- `task_type`: Type of task
- `scheduled_start`: Scheduled start date in ISO format
- `scheduled_end`: Scheduled end date in ISO format
- `estimated_hours`: Estimated hours to complete
- `parent_task_id`: ID of the parent task (for subtasks)

**Example:**
```
Create task "Implement authentication module" for project 123456 with owner developer@company.com priority High estimated 16 hours
```

### update_task

Update an existing task.

**Parameters:**
- `task_id` (required): ID of the task to update
- `title`: New task title
- `description`: New task description
- `status`: Task status (e.g., Open, In Progress, On Hold, Completed, Cancelled)
- `priority`: New priority level
- `owner_email`: New owner email
- `percentage_completion`: Completion percentage (0-100)
- `actual_start`: Actual start date in ISO format
- `actual_end`: Actual end date in ISO format
- `actual_hours`: Actual hours spent

**Example:**
```
Update task 456789 to status "In Progress" with 50% completion and 8 actual hours
```

### complete_task

Mark a task as completed.

**Parameters:**
- `task_id` (required): ID of the task to complete
- `completion_comments`: Comments about task completion
- `actual_hours`: Total hours spent on the task

**Example:**
```
Complete task 456789 with comment "Authentication module fully tested and deployed" actual hours 18
```

### list_project_tasks

List all tasks for a specific project.

**Parameters:**
- `project_id` (required): ID of the project
- `milestone_id`: Filter by milestone ID
- `status`: Filter by status
- `owner`: Filter by owner name or email
- `page`: Page number (default: 1)
- `per_page`: Results per page (default: 20)

**Example:**
```
List all tasks for project 123456 with status "Open"
```

### add_worklog

Log time spent on a task or project.

**Parameters:**
- `task_id`: ID of the task (either task_id or project_id required)
- `project_id`: ID of the project (either task_id or project_id required)
- `description` (required): Description of work performed
- `start_time` (required): Start time in ISO format
- `end_time` (required): End time in ISO format
- `owner_email`: Email of the person who did the work
- `is_billable`: Whether this time is billable (default: true)
- `worklog_type`: Type of work (e.g., Development, Testing, Documentation)

**Example:**
```
Add worklog to task 456789 "Implemented user authentication" from 2024-01-15T09:00:00Z to 2024-01-15T12:30:00Z billable type Development
```

### create_milestone

Create a new milestone for a project.

**Parameters:**
- `project_id` (required): ID of the project
- `title` (required): Milestone title
- `description`: Milestone description
- `owner_email`: Email of the milestone owner
- `scheduled_start`: Scheduled start date in ISO format
- `scheduled_end`: Scheduled end date in ISO format

**Example:**
```
Create milestone "Phase 1 - Core Features" for project 123456 scheduled from 2024-01-01 to 2024-01-31
```

### get_project_summary

Get a comprehensive summary of a project including tasks, milestones, and time tracking.

**Parameters:**
- `project_id` (required): ID of the project
- `include_tasks`: Include task summary (default: true)
- `include_milestones`: Include milestone summary (default: true)
- `include_worklogs`: Include time tracking summary (default: true)

**Example:**
```
Get summary of project 123456 including all details
```

## Common Usage Patterns

### Creating and Tracking Requests

1. Create a request for a user issue
2. Add notes as you work on it
3. Assign to appropriate technician
4. Close when resolved

**Example Workflow:**
```
# Create request
Create a request with subject "Laptop not booting" for requester user@company.com with category "Hardware" and subcategory "Computer"

# Add progress note
Add note "Diagnostics show hard drive failure" to request 123456

# Assign to technician
Assign request 123456 to tech@company.com

# Close when resolved
Close request 123456 with comment "Replaced failed hard drive, system restored from backup" and closure code "Completed"
```

### Asset Lifecycle Management

1. Create asset when purchased
2. Assign to user
3. Update location/status as needed
4. Track through retirement

### Problem to Change Workflow

1. Create problem for recurring issue
2. Analyze root cause
3. Create change request for permanent fix
4. Link change to problem

## Error Handling

All tools will return descriptive error messages if something goes wrong:
- Authentication errors
- Validation errors (missing required fields, invalid formats)
- Not found errors (invalid IDs)
- Rate limit errors
- Permission errors

### Common Validation Errors

**"EXTRA_KEY_FOUND_IN_JSON" Error**
- Cause: Using incorrect field names
- Solution: Use `email_id` instead of `email` for user objects

**Missing Required Fields**
- Service Desk Plus requires several fields for new requests
- The tool provides sensible defaults for these fields
- Override defaults by providing specific values

**Request Won't Close**
- Ensure request has a technician assigned
- Use the `technician_email` parameter if needed
- Provide both `closure_comments` and `closure_code`

## Best Practices

1. Always provide clear, descriptive subjects/titles
2. Include relevant details in descriptions
3. Use appropriate priority levels
4. Keep notes concise but informative
5. Close requests promptly with resolution details
6. Maintain accurate asset information
7. Link related items (problems to incidents, changes to problems)

### Field Naming Conventions
- Use `requester_email` in tool parameters (converted to `email_id` internally)
- Priority values: "Low", "Normal", "High", "Urgent" (mapped to system values)
- Status values: "Open", "In Progress", "On Hold", "Resolved", "Closed"
- Closure codes: "Completed", "Cancelled", "Solved", "Not Solved"

### Instance-Specific Values
Some values may be specific to your Service Desk Plus instance:
- Category names (e.g., "Hardwre" vs "Hardware")
- Custom fields and their IDs
- Technician groups and departments

Always verify the exact values used in your instance if you encounter validation errors.