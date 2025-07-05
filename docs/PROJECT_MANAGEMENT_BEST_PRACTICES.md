# Service Desk Plus Project Management Best Practices

## Preventing Duplicate Projects

### Before Creating Any Project

1. **Search Comprehensively**
   ```javascript
   // Search by title keywords
   await client.projects.list({ 
     per_page: 50,
     search: "MCP" // or relevant keywords
   });
   
   // Check all statuses
   const statuses = ['Open', 'In Progress', 'On Hold', 'New', 'Completed', 'Cancelled'];
   for (const status of statuses) {
     await client.projects.list({ status, per_page: 20 });
   }
   ```

2. **Check Multiple Sources**
   - Search by title keywords
   - Search by owner
   - Check recent projects (sort by created_time)
   - Review completed projects
   - Ask team members about existing projects

3. **Use Naming Conventions**
   - Include unique identifiers: `[DEPT] Project Name - YYYY`
   - Example: `[IT] Service Desk Plus MCP Server Development - 2025`
   - Add version or iteration: `Project Name v2`

### Project Search Checklist

Before creating a new project, complete this checklist:

- [ ] Search projects with main keywords
- [ ] Search projects with abbreviated keywords (MCP, SDP, etc.)
- [ ] Check projects assigned to your team
- [ ] Review projects created in last 30 days
- [ ] Check completed/cancelled projects for similar work
- [ ] Verify project doesn't exist under different name

### Handling Potential Duplicates

If you find a similar project:

1. **Assess if it's the same work**
   - Compare descriptions
   - Check project scope
   - Review tasks and milestones

2. **If duplicate:**
   - Use existing project
   - Update description if needed
   - Add new tasks/milestones
   - Update status and completion

3. **If different but related:**
   - Link projects together
   - Add cross-references in descriptions
   - Consider merging if appropriate

### MCP Tool Implementation

```typescript
// Enhanced project creation with duplicate check
async function createProjectSafely(projectData) {
  // 1. Search for existing projects
  const searchTerms = extractKeywords(projectData.title);
  
  for (const term of searchTerms) {
    const existing = await sdpClient.projects.list({
      search: term,
      per_page: 50
    });
    
    if (existing.data.length > 0) {
      // Check each for similarity
      for (const project of existing.data) {
        const similarity = calculateSimilarity(
          project.title, 
          projectData.title
        );
        
        if (similarity > 0.8) {
          throw new Error(
            `Similar project exists: ${project.title} (ID: ${project.id})`
          );
        }
      }
    }
  }
  
  // 2. If no duplicates, create project
  return await sdpClient.projects.create(projectData);
}
```

### Project Metadata Standards

Always include in project description:
- Purpose and objectives
- Related projects (if any)
- Repository/documentation links
- Key stakeholders
- Success criteria

Example:
```
## Purpose
Development of MCP server for Service Desk Plus integration

## Related Projects
- Links to: ServiceDesk Plus Cloud Implementation (ID: xxx)
- Replaces: Legacy API Integration (ID: yyy)

## Repository
https://github.com/org/repo

## Stakeholders
- Owner: Team Lead
- Contributors: Dev Team

## Success Criteria
- OAuth implementation complete
- All API modules integrated
- Documentation published
```

### Regular Maintenance

1. **Weekly Review**
   - Check for duplicate projects
   - Merge similar projects
   - Update project statuses

2. **Monthly Cleanup**
   - Archive completed projects
   - Consolidate related work
   - Update naming conventions

3. **Quarterly Audit**
   - Review all active projects
   - Ensure no duplicates exist
   - Update project taxonomy

## Automation Opportunities

Consider implementing:
- Duplicate detection webhooks
- Automated project naming
- Project similarity scoring
- Merge suggestions
- Cross-project dependency tracking

## Lessons Learned

From our experience:
- Always search before creating
- Use multiple search strategies
- Include unique identifiers in titles
- Document relationships between projects
- Regular cleanup prevents accumulation