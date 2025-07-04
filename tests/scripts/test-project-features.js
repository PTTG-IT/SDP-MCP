#!/usr/bin/env node

/**
 * Test script for Project Management features
 * This script tests all project-related MCP tools
 */

import 'dotenv/config';
import { SDPClient } from './dist/api/client.js';
import { loadConfig } from './dist/utils/config.js';

// Test data
const TEST_PROJECT = {
  title: "SDP MCP Development Project - Test",
  description: "Test project for verifying project management features",
  project_type: "Development",
  priority: "High",
  scheduled_start: Date.now().toString(), // epoch milliseconds as string
  scheduled_end: (Date.now() + 90 * 24 * 60 * 60 * 1000).toString(), // 90 days from now
};

const TEST_TASK = {
  title: "Test Task - Implement Authentication",
  description: "Implement OAuth authentication for the API",
  priority: "High",
  estimated_hours: 16,
};

const TEST_MILESTONE = {
  title: "Phase 1 - Core Features",
  description: "Complete core feature implementation",
};

async function runTests() {
  console.log('🧪 Testing Project Management Features\n');
  
  try {
    // Initialize client
    const config = loadConfig();
    const client = new SDPClient(config);
    
    let createdProjectId = null;
    let createdTaskId = null;
    let createdMilestoneId = null;
    
    // Test 1: Create Project
    console.log('1️⃣ Testing Project Creation...');
    try {
      const project = await client.projects.create({
        title: TEST_PROJECT.title,
        description: TEST_PROJECT.description,
        // Removed project_type and priority as they might need valid IDs
        scheduled_start_time: {
          value: TEST_PROJECT.scheduled_start
        },
        scheduled_end_time: {
          value: TEST_PROJECT.scheduled_end
        },
        status: { name: "Open" },
      });
      
      createdProjectId = project.id;
      console.log('✅ Project created successfully');
      console.log(`   ID: ${project.id}`);
      console.log(`   Title: ${project.title}`);
      console.log(`   Status: ${project.status.name}\n`);
    } catch (error) {
      console.error('❌ Failed to create project:', error.message);
      if (error.details && error.details.response_status && error.details.response_status.messages) {
        console.error('   API Error Messages:');
        error.details.response_status.messages.forEach((msg) => {
          console.error('   -', msg.message || msg);
        });
      } else {
        console.error('   Details:', JSON.stringify(error.details, null, 2) || 'No additional details');
      }
      return;
    }
    
    // Test 2: Get Project
    console.log('2️⃣ Testing Get Project...');
    try {
      const project = await client.projects.get(createdProjectId);
      console.log('✅ Project retrieved successfully');
      console.log(`   Title: ${project.title}`);
      console.log(`   Completion: ${project.percentage_completion || 0}%\n`);
    } catch (error) {
      console.error('❌ Failed to get project:', error.message);
    }
    
    // Test 3: Create Milestone
    console.log('3️⃣ Testing Milestone Creation...');
    try {
      const milestone = await client.projects.createMilestone(createdProjectId, {
        title: TEST_MILESTONE.title,
        description: TEST_MILESTONE.description,
        status: { name: "Open" },
        scheduled_start_time: {
          value: TEST_PROJECT.scheduled_start
        },
        scheduled_end_time: {
          value: (Date.now() + 30 * 24 * 60 * 60 * 1000).toString()
        },
      });
      
      createdMilestoneId = milestone.id;
      console.log('✅ Milestone created successfully');
      console.log(`   ID: ${milestone.id}`);
      console.log(`   Title: ${milestone.title}\n`);
    } catch (error) {
      console.error('❌ Failed to create milestone:', error.message);
      if (error.details && error.details.response_status && error.details.response_status.messages) {
        console.error('   API Error Messages:');
        error.details.response_status.messages.forEach((msg) => {
          console.error('   -', msg.message || msg);
        });
      } else {
        console.error('   Details:', JSON.stringify(error.details, null, 2) || 'No additional details');
      }
    }
    
    // Test 4: Create Task
    console.log('4️⃣ Testing Task Creation...');
    try {
      const taskData = {
        title: TEST_TASK.title,
        description: TEST_TASK.description,
        project: { id: createdProjectId },
        priority: { name: TEST_TASK.priority },
        estimated_hours: TEST_TASK.estimated_hours,
        status: { name: "Open" },
      };
      
      if (createdMilestoneId) {
        taskData.milestone = { id: createdMilestoneId };
      }
      
      const task = await client.projects.createTask(taskData);
      
      createdTaskId = task.id;
      console.log('✅ Task created successfully');
      console.log(`   ID: ${task.id}`);
      console.log(`   Title: ${task.title}`);
      console.log(`   Project: ${task.project.id}\n`);
    } catch (error) {
      console.error('❌ Failed to create task:', error.message);
      if (error.details && error.details.response_status && error.details.response_status.messages) {
        console.error('   API Error Messages:');
        error.details.response_status.messages.forEach((msg) => {
          console.error('   -', msg.message || msg);
        });
      } else {
        console.error('   Details:', JSON.stringify(error.details, null, 2) || 'No additional details');
      }
    }
    
    // Test 5: Update Project
    console.log('5️⃣ Testing Project Update...');
    try {
      const updatedProject = await client.projects.update(createdProjectId, {
        status: { name: "In Progress" },
        percentage_completion: 25,
      });
      
      console.log('✅ Project updated successfully');
      console.log(`   Status: ${updatedProject.status.name}`);
      console.log(`   Completion: ${updatedProject.percentage_completion}%\n`);
    } catch (error) {
      console.error('❌ Failed to update project:', error.message);
      if (error.details && error.details.response_status && error.details.response_status.messages) {
        console.error('   API Error Messages:');
        error.details.response_status.messages.forEach((msg) => {
          console.error('   -', msg.message || msg);
        });
      } else {
        console.error('   Details:', JSON.stringify(error.details, null, 2) || 'No additional details');
      }
    }
    
    // Test 6: Add Worklog
    console.log('6️⃣ Testing Worklog Addition...');
    try {
      const startTime = Date.now();
      const endTime = startTime + 2 * 60 * 60 * 1000; // 2 hours later
      
      const worklog = await client.projects.addWorklog({
        project: { id: createdProjectId },
        task: createdTaskId ? { id: createdTaskId } : undefined,
        description: "Initial project setup and configuration",
        start_time: {
          value: startTime.toString()
        },
        end_time: {
          value: endTime.toString()
        },
        is_billable: true,
      });
      
      console.log('✅ Worklog added successfully');
      console.log(`   Time logged: 2 hours`);
      console.log(`   Billable: ${worklog.is_billable ? 'Yes' : 'No'}\n`);
    } catch (error) {
      console.error('❌ Failed to add worklog:', error.message);
      if (error.details && error.details.response_status && error.details.response_status.messages) {
        console.error('   API Error Messages:');
        error.details.response_status.messages.forEach((msg) => {
          console.error('   -', msg.message || msg);
        });
      } else {
        console.error('   Details:', JSON.stringify(error.details, null, 2) || 'No additional details');
      }
    }
    
    // Test 7: List Project Tasks
    console.log('7️⃣ Testing List Project Tasks...');
    try {
      const tasks = await client.projects.listProjectTasks(createdProjectId);
      console.log('✅ Tasks retrieved successfully');
      console.log(`   Total tasks: ${tasks.data ? tasks.data.length : 0}`);
      if (tasks.data) {
        tasks.data.forEach(task => {
          console.log(`   - ${task.title} (${task.status.name})`);
        });
      }
      console.log('');
    } catch (error) {
      console.error('❌ Failed to list tasks:', error.message);
    }
    
    // Test 8: Update Task
    if (createdTaskId) {
      console.log('8️⃣ Testing Task Update...');
      try {
        const updatedTask = await client.projects.updateTask(createdTaskId, {
          status: { name: "In Progress" },
          percentage_completion: 50,
          actual_hours: 8,
        });
        
        console.log('✅ Task updated successfully');
        console.log(`   Status: ${updatedTask.status.name}`);
        console.log(`   Completion: ${updatedTask.percentage_completion}%\n`);
      } catch (error) {
        console.error('❌ Failed to update task:', error.message);
      }
    }
    
    // Test 9: List Projects
    console.log('9️⃣ Testing List Projects...');
    try {
      const projects = await client.projects.list({
        per_page: 10,
        page: 1,
      });
      
      console.log('✅ Projects listed successfully');
      console.log(`   Total projects: ${projects.meta.total_count}`);
      console.log(`   Showing ${projects.data.length} projects\n`);
    } catch (error) {
      console.error('❌ Failed to list projects:', error.message);
    }
    
    // Test 10: Clean up - Delete test project
    console.log('🧹 Cleaning up...');
    if (createdProjectId) {
      try {
        await client.projects.delete(createdProjectId);
        console.log('✅ Test project deleted successfully\n');
      } catch (error) {
        console.error('❌ Failed to delete test project:', error.message);
        console.log('   You may need to delete it manually\n');
      }
    }
    
    console.log('✨ Project Management tests completed!');
    
  } catch (error) {
    console.error('\n💥 Unexpected error:', error);
  }
}

// Run tests
console.log('Service Desk Plus MCP - Project Management Test Suite');
console.log('====================================================\n');

runTests().catch(console.error);