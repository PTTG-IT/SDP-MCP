# Change Management Implementation Specification

## Overview

This document outlines the implementation plan for Change Management functionality in the Service Desk Plus MCP Server. Change Management is a critical ITIL process that ensures changes to IT infrastructure are implemented in a controlled and coordinated manner.

## API Research Summary

Based on Service Desk Plus Cloud API v3 documentation:
- Base endpoint: `/api/v3/changes`
- Authentication: OAuth 2.0 with Zoho
- Data format: URL-encoded with `input_data` parameter containing JSON

## Change Management Data Model

### Core Change Entity

```typescript
interface Change {
  // Required Fields
  id: string;
  title: string;
  change_type: {
    id: string;
    name: "Normal" | "Standard" | "Emergency" | "Major";
  };
  scheduled_start_time: {
    display_value: string;
    value: string; // epoch milliseconds
  };
  scheduled_end_time: {
    display_value: string;
    value: string; // epoch milliseconds
  };
  status: {
    id: string;
    name: string;
  };
  
  // Recommended Fields
  description?: string;
  reason_for_change?: string;
  impact?: {
    id: string;
    name: "Low" | "Medium" | "High" | "Affects Business";
  };
  risk?: {
    id: string;
    name: "Low" | "Medium" | "High" | "Very High";
  };
  priority?: {
    id: string;
    name: "Low" | "Normal" | "High" | "Urgent";
  };
  
  // Planning Fields
  rollout_plan?: string;
  backout_plan?: string;
  impact_details?: string;
  checklist?: string[];
  
  // Assignment Fields
  change_requester?: User;
  change_manager?: User;
  change_owner?: User;
  change_advisory_board?: User[];
  
  // Approval Fields
  approval_status?: {
    id: string;
    name: "Pending" | "Approved" | "Rejected" | "Not Required";
  };
  approvals?: ChangeApproval[];
  
  // Implementation Fields
  actual_start_time?: SDPDate;
  actual_end_time?: SDPDate;
  implementation_status?: string;
  downtime_details?: string;
  
  // Closure Fields
  review_details?: string;
  closure_details?: string;
  closure_code?: {
    id: string;
    name: "Successful" | "Successful with Issues" | "Failed" | "Cancelled";
  };
  
  // Relationships
  associated_problems?: string[];
  associated_requests?: string[];
  affected_assets?: string[];
  change_tasks?: ChangeTask[];
  notes?: ChangeNote[];
  worklogs?: ChangeWorklog[];
}
```

### Change Task Entity

```typescript
interface ChangeTask {
  id: string;
  title: string;
  description?: string;
  change: { id: string };
  owner?: User;
  group?: { id: string; name: string };
  status: { id: string; name: string };
  priority?: { id: string; name: string };
  scheduled_start_time?: SDPDate;
  scheduled_end_time?: SDPDate;
  actual_start_time?: SDPDate;
  actual_end_time?: SDPDate;
  percentage_completion?: number;
}
```

### Change Approval Entity

```typescript
interface ChangeApproval {
  id: string;
  level: number;
  status: "Pending" | "Approved" | "Rejected";
  approver: User;
  comments?: string;
  approved_date?: SDPDate;
  sent_date?: SDPDate;
}
```

## Proposed MCP Tools

### Phase 1: Core Change Operations (6 tools)

#### 1. create_change
Create a new change request with validation for required fields.

**Parameters:**
- `title` (required): Change title
- `change_type` (required): Type of change
- `scheduled_start` (required): ISO format datetime
- `scheduled_end` (required): ISO format datetime
- `reason_for_change` (required): Justification
- `description`: Detailed description
- `impact`: Impact level
- `risk`: Risk level
- `priority`: Priority level
- `rollout_plan`: Implementation plan
- `backout_plan`: Rollback plan
- `change_manager_email`: Manager's email

**Example:**
```
Create change "Upgrade Email Server to Exchange 2023" type Normal scheduled from 2024-02-01T22:00:00Z to 2024-02-02T02:00:00Z with reason "Current version reaching end of support"
```

#### 2. update_change
Update existing change details.

**Parameters:**
- `change_id` (required): Change ID
- All create parameters as optional

#### 3. get_change
Retrieve detailed change information.

**Parameters:**
- `change_id` (required): Change ID

#### 4. list_changes
List changes with filtering options.

**Parameters:**
- `status`: Filter by status
- `change_type`: Filter by type
- `scheduled_after`: Changes scheduled after date
- `scheduled_before`: Changes scheduled before date
- `page`: Page number
- `per_page`: Results per page

#### 5. get_change_summary
Get comprehensive change summary with tasks and approvals.

**Parameters:**
- `change_id` (required): Change ID
- `include_tasks`: Include change tasks
- `include_approvals`: Include approval details
- `include_notes`: Include notes
- `include_worklogs`: Include worklogs

#### 6. validate_change_window
Check if proposed change window conflicts with other changes.

**Parameters:**
- `scheduled_start` (required): Proposed start time
- `scheduled_end` (required): Proposed end time
- `exclude_change_id`: Exclude specific change from check

### Phase 2: Change Workflow Tools (7 tools)

#### 7. submit_change_for_approval
Submit change for approval process.

**Parameters:**
- `change_id` (required): Change ID
- `comments`: Submission comments

#### 8. approve_change
Approve a change request.

**Parameters:**
- `change_id` (required): Change ID
- `approval_comments`: Approval comments
- `conditions`: Any conditions for approval

#### 9. reject_change
Reject a change request.

**Parameters:**
- `change_id` (required): Change ID
- `rejection_reason` (required): Reason for rejection
- `suggestions`: Suggestions for resubmission

#### 10. schedule_change
Confirm and lock in change schedule.

**Parameters:**
- `change_id` (required): Change ID
- `send_notifications`: Notify stakeholders

#### 11. start_change_implementation
Mark change as in progress.

**Parameters:**
- `change_id` (required): Change ID
- `actual_start`: Actual start time (defaults to now)
- `implementation_notes`: Initial notes

#### 12. complete_change_implementation
Mark change implementation as complete.

**Parameters:**
- `change_id` (required): Change ID
- `actual_end`: Actual end time (defaults to now)
- `implementation_status`: Success/Failed/Partial
- `completion_notes`: Implementation notes

#### 13. close_change
Close change with review details.

**Parameters:**
- `change_id` (required): Change ID
- `closure_code` (required): Closure code
- `review_details` (required): Post-implementation review
- `lessons_learned`: Lessons learned
- `follow_up_actions`: Any follow-up needed

### Phase 3: Change Task Management (5 tools)

#### 14. create_change_task
Add task to change implementation plan.

**Parameters:**
- `change_id` (required): Parent change ID
- `title` (required): Task title
- `description`: Task description
- `owner_email`: Task owner
- `scheduled_start`: Task start time
- `scheduled_end`: Task end time
- `priority`: Task priority

#### 15. update_change_task
Update change task details.

**Parameters:**
- `task_id` (required): Task ID
- All create parameters as optional
- `percentage_completion`: Progress percentage
- `status`: Task status

#### 16. list_change_tasks
List all tasks for a change.

**Parameters:**
- `change_id` (required): Change ID
- `status`: Filter by status
- `owner`: Filter by owner

#### 17. complete_change_task
Mark change task as complete.

**Parameters:**
- `task_id` (required): Task ID
- `completion_notes`: Completion notes

#### 18. get_change_task_summary
Get summary of all tasks for a change.

**Parameters:**
- `change_id` (required): Change ID

### Phase 4: Advanced Features (6 tools)

#### 19. add_change_note
Add note to change record.

**Parameters:**
- `change_id` (required): Change ID
- `content` (required): Note content
- `is_public`: Public visibility

#### 20. add_change_worklog
Log work time on change.

**Parameters:**
- `change_id` (required): Change ID
- `description` (required): Work description
- `start_time` (required): Start time
- `end_time` (required): End time
- `technician_email`: Who did the work

#### 21. link_change_to_problem
Associate change with problem record.

**Parameters:**
- `change_id` (required): Change ID
- `problem_id` (required): Problem ID
- `relationship_type`: Resolution/Workaround

#### 22. link_change_to_assets
Associate change with affected assets.

**Parameters:**
- `change_id` (required): Change ID
- `asset_ids` (required): Array of asset IDs
- `impact_type`: Type of impact

#### 23. get_change_impact_analysis
Analyze potential impact of change.

**Parameters:**
- `change_id` (required): Change ID
- `include_dependencies`: Include dependent services
- `include_users`: Include affected users

#### 24. create_change_from_template
Create change from predefined template.

**Parameters:**
- `template_name` (required): Template to use
- `title` (required): Change title
- `scheduled_start` (required): Start time
- `scheduled_end` (required): End time
- `custom_fields`: Override template fields

## Implementation Considerations

### 1. Status Workflow

```
Requested → Planning → Awaiting Approval → Approved → 
Scheduled → In Progress → Completed → Under Review → Closed

Alternative paths:
- Rejected (from Awaiting Approval)
- Cancelled (from any status before In Progress)
- Failed (from In Progress)
```

### 2. Change Types and Approval Requirements

- **Standard Change**: Pre-approved, low risk, repeatable
  - Auto-approval
  - Simplified workflow
  - Template-based

- **Normal Change**: Standard approval process
  - Manager approval
  - CAB review for high impact
  - Full documentation required

- **Emergency Change**: Expedited approval
  - Immediate manager approval
  - Post-implementation CAB review
  - Shortened lead time

- **Major Change**: Full CAB approval
  - Multiple approval levels
  - Detailed impact analysis
  - Extended planning phase

### 3. Validation Rules

1. **Schedule Validation**:
   - End time must be after start time
   - Start time must be in future (except Emergency)
   - No conflicts with existing changes (warning)

2. **Approval Rules**:
   - Based on change type
   - Based on risk/impact matrix
   - Escalation for high-risk changes

3. **Closure Rules**:
   - All tasks must be complete
   - Review details required
   - Actual times must be recorded

### 4. Integration Points

- **Problems**: Changes often implement permanent fixes
- **Requests**: Changes may fulfill service requests
- **Assets**: Track configuration items affected
- **Projects**: Major changes may be managed as projects
- **Incidents**: Emergency changes may resolve major incidents

### 5. Example Use Cases

#### Standard Change
```
Create change "Add new user account" type Standard scheduled from 2024-02-01T09:00:00Z to 2024-02-01T09:30:00Z
```

#### Emergency Change
```
Create change "Emergency patch for critical security vulnerability" type Emergency scheduled from 2024-02-01T00:00:00Z to 2024-02-01T02:00:00Z with risk High priority Urgent
```

#### Normal Change with Tasks
```
Create change "Database server migration" type Normal scheduled from 2024-02-15T22:00:00Z to 2024-02-16T06:00:00Z

Create change task "Backup existing database" for change 123456
Create change task "Install new database server" for change 123456
Create change task "Migrate data" for change 123456
Create change task "Verify data integrity" for change 123456
Create change task "Update connection strings" for change 123456
```

## Testing Strategy

1. **Unit Tests**:
   - Field validation
   - Status transitions
   - Date/time calculations

2. **Integration Tests**:
   - Full change lifecycle
   - Approval workflows
   - Task dependencies

3. **Scenario Tests**:
   - Emergency change process
   - Failed change with rollback
   - Multi-task implementation
   - CAB approval process

## Security Considerations

1. **Authorization**:
   - Only authorized users can create changes
   - Approval rights based on role
   - Change manager assignment

2. **Audit Trail**:
   - All actions logged
   - Approval history maintained
   - Status change tracking

3. **Data Protection**:
   - Sensitive data in private notes
   - Approval comments confidential
   - Implementation details secured

## Performance Considerations

1. **Pagination**: Required for large change lists
2. **Caching**: Change templates, approval workflows
3. **Bulk Operations**: Multiple task updates
4. **Conflict Detection**: Efficient schedule checking

## Future Enhancements

1. **Change Calendar View**: Visual change schedule
2. **Automated Approvals**: Rule-based approval
3. **Change Analytics**: Success rates, trends
4. **Integration with CI/CD**: Automated deployments
5. **Mobile Approvals**: Approve on the go
6. **Change Freeze Periods**: Blackout windows
7. **Dependency Mapping**: Visual impact analysis

---

This specification provides a comprehensive blueprint for implementing Change Management in the Service Desk Plus MCP Server. The phased approach allows for incremental development while ensuring core functionality is delivered first.