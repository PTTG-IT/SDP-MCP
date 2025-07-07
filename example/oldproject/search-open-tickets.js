#!/usr/bin/env node
import dotenv from 'dotenv';
import { SDPClient } from './dist/api/client.js';

// Load environment variables
dotenv.config();

// Initialize API client
const client = new SDPClient({
  clientId: process.env.SDP_CLIENT_ID,
  clientSecret: process.env.SDP_CLIENT_SECRET,
  baseUrl: process.env.SDP_BASE_URL,
  instanceName: process.env.SDP_INSTANCE_NAME,
});

async function searchOpenTickets() {
  try {
    console.log('Searching for open tickets in Service Desk Plus...\n');
    
    // Get requests with pagination
    const results = await client.requests.list({
      page: 1,
      per_page: 100  // Get up to 100 tickets
    });
    
    // Filter for open tickets (non-closed statuses)
    const openStatuses = ['Open', 'In Progress', 'Pending', 'On Hold', 'Awaiting Customer', 'Awaiting Third Party'];
    const openTickets = results.data.filter(ticket => {
      const status = ticket.status?.name || ticket.status?.internal_name || '';
      return openStatuses.some(s => 
        status.toLowerCase().includes(s.toLowerCase()) ||
        s.toLowerCase().includes(status.toLowerCase())
      ) || !status.toLowerCase().includes('closed');
    });
    
    console.log(`Found ${openTickets.length} open tickets out of ${results.data.length} total tickets\n`);
    
    // Display the open tickets
    if (openTickets.length > 0) {
      console.log('Open Tickets:');
      console.log('=============\n');
      
      openTickets.forEach((ticket, index) => {
        console.log(`${index + 1}. Ticket #${ticket.display_id || ticket.id}`);
        console.log(`   Subject: ${ticket.subject}`);
        console.log(`   Status: ${ticket.status?.name || 'Unknown'}`);
        console.log(`   Priority: ${ticket.priority?.name || 'Not set'}`);
        console.log(`   Requester: ${ticket.requester?.name || 'Unknown'} (${ticket.requester?.email || 'No email'})`);
        console.log(`   Technician: ${ticket.technician?.name || 'Unassigned'}`);
        console.log(`   Created: ${ticket.created_time?.display_value || ticket.created_time || 'Unknown'}`);
        if (ticket.due_by_time) {
          console.log(`   Due: ${ticket.due_by_time.display_value || ticket.due_by_time}`);
          if (ticket.is_overdue) {
            console.log(`   ⚠️  OVERDUE`);
          }
        }
        console.log('');
      });
      
      // Summary by status
      console.log('\nSummary by Status:');
      console.log('==================');
      const statusCounts = {};
      openTickets.forEach(ticket => {
        const status = ticket.status?.name || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([status, count]) => {
          console.log(`${status}: ${count}`);
        });
        
      // Summary by priority
      console.log('\nSummary by Priority:');
      console.log('====================');
      const priorityCounts = {};
      openTickets.forEach(ticket => {
        const priority = ticket.priority?.name || 'Not set';
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
      });
      
      Object.entries(priorityCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([priority, count]) => {
          console.log(`${priority}: ${count}`);
        });
        
      // Overdue tickets
      const overdueTickets = openTickets.filter(t => t.is_overdue);
      if (overdueTickets.length > 0) {
        console.log(`\n⚠️  ${overdueTickets.length} tickets are overdue!`);
      }
      
    } else {
      console.log('No open tickets found!');
    }
    
    console.log(`\nTotal tickets in system: ${results.meta.total_count}`);
    
  } catch (error) {
    console.error('Error searching for tickets:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  }
}

// Run the search
searchOpenTickets();