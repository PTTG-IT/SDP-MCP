#!/usr/bin/env node

/**
 * Basic test script for Project Management features
 * This script tests core project operations
 */

import 'dotenv/config';
import { SDPClient } from './dist/api/client.js';
import { loadConfig } from './dist/utils/config.js';

async function runTests() {
  console.log('🧪 Testing Basic Project Features\n');
  
  try {
    // Initialize client
    const config = loadConfig();
    const client = new SDPClient(config);
    
    let createdProjectId = null;
    
    // Test 1: Create Project (minimal fields)
    console.log('1️⃣ Testing Project Creation...');
    try {
      const project = await client.projects.create({
        title: "Test Project - " + new Date().toISOString().substring(0, 19),
        description: "Basic test project for API validation",
      });
      
      createdProjectId = project.id;
      console.log('✅ Project created successfully');
      console.log(`   ID: ${project.id}`);
      console.log(`   Title: ${project.title}`);
      console.log(`   Created Time: ${project.created_time}`);
      console.log('');
    } catch (error) {
      console.error('❌ Failed to create project:', error.message);
      if (error.details) {
        console.error('   Details:', JSON.stringify(error.details, null, 2));
      }
      return;
    }
    
    // Test 2: Get Project Details
    console.log('2️⃣ Testing Get Project...');
    try {
      const project = await client.projects.get(createdProjectId);
      console.log('✅ Project retrieved successfully');
      console.log(`   Title: ${project.title}`);
      console.log(`   Status: ${project.status ? project.status.name : 'Unknown'}`);
      console.log(`   Owner: ${project.owner ? project.owner.name : 'Unassigned'}`);
      console.log('');
    } catch (error) {
      console.error('❌ Failed to get project:', error.message);
    }
    
    // Test 3: Update Project
    console.log('3️⃣ Testing Project Update...');
    try {
      const updatedProject = await client.projects.update(createdProjectId, {
        description: "Updated description - " + new Date().toISOString(),
        percentage_completion: 25,
      });
      
      console.log('✅ Project updated successfully');
      console.log(`   Completion: ${updatedProject.percentage_completion}%`);
      console.log('');
    } catch (error) {
      console.error('❌ Failed to update project:', error.message);
      if (error.details) {
        console.error('   Details:', JSON.stringify(error.details, null, 2));
      }
    }
    
    // Test 4: List Projects
    console.log('4️⃣ Testing List Projects...');
    try {
      const projects = await client.projects.list({
        per_page: 5,
        page: 1,
      });
      
      console.log('✅ Projects listed successfully');
      console.log(`   Total projects: ${projects.meta ? projects.meta.total_count : 'Unknown'}`);
      console.log(`   Retrieved: ${projects.data ? projects.data.length : 0} projects`);
      
      if (projects.data && projects.data.length > 0) {
        console.log('   First few projects:');
        projects.data.slice(0, 3).forEach(p => {
          console.log(`   - ${p.title} (${p.status ? p.status.name : 'Unknown'})`);
        });
      }
      console.log('');
    } catch (error) {
      console.error('❌ Failed to list projects:', error.message);
    }
    
    // Test 5: Create Task (simple)
    console.log('5️⃣ Testing Task Creation...');
    if (createdProjectId) {
      try {
        const task = await client.projects.createTask({
          title: "Test Task - " + Date.now(),
          description: "Basic task for testing",
          project: { id: createdProjectId },
        });
        
        console.log('✅ Task created successfully');
        console.log(`   ID: ${task.id}`);
        console.log(`   Title: ${task.title}`);
        console.log('');
      } catch (error) {
        console.error('❌ Failed to create task:', error.message);
        if (error.details) {
          console.error('   Details:', JSON.stringify(error.details, null, 2));
        }
      }
    }
    
    console.log('✨ Basic project tests completed!');
    console.log('\nNote: Created project ID:', createdProjectId);
    console.log('You may need to manually delete this test project.');
    
  } catch (error) {
    console.error('\n💥 Unexpected error:', error);
  }
}

// Run tests
console.log('Service Desk Plus MCP - Basic Project Test');
console.log('=========================================\n');

runTests().catch(console.error);