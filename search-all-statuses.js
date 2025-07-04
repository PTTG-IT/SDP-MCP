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

async function searchAllStatuses() {
  try {
    console.log('Analyzing all tickets in Service Desk Plus...\n');
    
    // Get all tickets by fetching multiple pages if needed
    let allTickets = [];
    let page = 1;
    let hasMore = true;
    const perPage = 100;
    
    while (hasMore && page <= 5) { // Limit to 5 pages for safety
      const results = await client.requests.list({
        page: page,
        per_page: perPage
      });
      
      allTickets = allTickets.concat(results.data);
      hasMore = results.data.length === perPage && allTickets.length < results.meta.total_count;
      page++;
    }
    
    console.log(`Fetched ${allTickets.length} tickets\n`);
    
    // Analyze statuses
    const statusCounts = {};
    const statusDetails = new Map();
    
    allTickets.forEach(ticket => {
      if (ticket.status) {
        const statusName = ticket.status.name || ticket.status.internal_name || 'Unknown';
        statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
        
        // Store full status details
        if (!statusDetails.has(statusName)) {
          statusDetails.set(statusName, ticket.status);
        }
      }
    });
    
    console.log('Status Distribution:');
    console.log('===================');
    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        const percentage = ((count / allTickets.length) * 100).toFixed(1);
        console.log(`${status}: ${count} tickets (${percentage}%)`);
        const details = statusDetails.get(status);
        if (details) {
          console.log(`  - Internal name: ${details.internal_name}`);
          console.log(`  - In progress: ${details.in_progress}`);
          console.log(`  - Color: ${details.color}`);
        }
        console.log('');
      });
    
    // Check for any non-closed tickets
    const nonClosedTickets = allTickets.filter(ticket => {
      const status = ticket.status?.name || ticket.status?.internal_name || '';
      return !status.toLowerCase().includes('closed') && 
             !status.toLowerCase().includes('resolved') &&
             !status.toLowerCase().includes('completed');
    });
    
    if (nonClosedTickets.length > 0) {
      console.log('\nNon-Closed Tickets Found:');
      console.log('========================');
      nonClosedTickets.slice(0, 10).forEach((ticket, index) => {
        console.log(`${index + 1}. Ticket #${ticket.display_id || ticket.id}`);
        console.log(`   Subject: ${ticket.subject}`);
        console.log(`   Status: ${ticket.status?.name}`);
        console.log(`   Created: ${ticket.created_time?.display_value || ticket.created_time}`);
        console.log('');
      });
      
      if (nonClosedTickets.length > 10) {
        console.log(`... and ${nonClosedTickets.length - 10} more non-closed tickets`);
      }
    } else {
      console.log('\nNo open/active tickets found. All tickets appear to be closed.');
    }
    
    // Recent tickets
    console.log('\nMost Recent Tickets:');
    console.log('===================');
    allTickets.slice(0, 5).forEach((ticket, index) => {
      console.log(`${index + 1}. Ticket #${ticket.display_id || ticket.id} - ${ticket.subject}`);
      console.log(`   Status: ${ticket.status?.name}`);
      console.log(`   Created: ${ticket.created_time?.display_value || ticket.created_time}`);
    });
    
  } catch (error) {
    console.error('Error analyzing tickets:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  }
}

// Run the analysis
searchAllStatuses();