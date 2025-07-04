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

async function comprehensiveSearch() {
  try {
    console.log('Performing comprehensive ticket search in Service Desk Plus...\n');
    
    // Try to find tickets with different approaches
    console.log('1. Checking ticket statuses by fetching recent tickets...');
    const recentResults = await client.requests.list({
      page: 1,
      per_page: 100,
      sort_by: 'created_time',
      sort_order: 'desc'
    });
    
    // Check for various open status names
    const possibleOpenStatuses = [
      'open', 'new', 'in progress', 'in-progress', 'pending', 'on hold', 
      'on-hold', 'awaiting', 'assigned', 'unassigned', 'active', 
      'waiting', 'wip', 'work in progress', 'started', 'acknowledged'
    ];
    
    const openTickets = recentResults.data.filter(ticket => {
      const statusName = (ticket.status?.name || ticket.status?.internal_name || '').toLowerCase();
      const isInProgress = ticket.status?.in_progress === true;
      const isNotClosed = !statusName.includes('closed') && 
                         !statusName.includes('resolved') && 
                         !statusName.includes('completed') &&
                         !statusName.includes('cancelled');
      
      return isInProgress || 
             possibleOpenStatuses.some(s => statusName.includes(s)) ||
             (isNotClosed && statusName !== '');
    });
    
    console.log(`Found ${openTickets.length} potentially open tickets\n`);
    
    // Try the search endpoint if available
    console.log('2. Attempting to use search endpoint...');
    try {
      const searchResults = await client.requests.search('status:open OR status:"in progress"', {
        per_page: 20
      });
      console.log(`Search returned ${searchResults.data.length} results`);
    } catch (searchError) {
      console.log('Search endpoint not available or returned error:', searchError.message);
    }
    
    // Display results
    if (openTickets.length > 0) {
      console.log('\nOpen/Active Tickets:');
      console.log('===================');
      openTickets.forEach((ticket, index) => {
        console.log(`\n${index + 1}. Ticket #${ticket.display_id || ticket.id}`);
        console.log(`   Subject: ${ticket.subject}`);
        console.log(`   Status: ${ticket.status?.name} (in_progress: ${ticket.status?.in_progress})`);
        console.log(`   Priority: ${ticket.priority?.name || 'Not set'}`);
        console.log(`   Requester: ${ticket.requester?.name}`);
        console.log(`   Technician: ${ticket.technician?.name || 'Unassigned'}`);
        console.log(`   Created: ${ticket.created_time?.display_value || ticket.created_time}`);
      });
    }
    
    // Show all unique statuses found
    console.log('\n\nAll Unique Statuses in System:');
    console.log('==============================');
    const uniqueStatuses = new Map();
    recentResults.data.forEach(ticket => {
      if (ticket.status && !uniqueStatuses.has(ticket.status.id)) {
        uniqueStatuses.set(ticket.status.id, {
          name: ticket.status.name,
          internal_name: ticket.status.internal_name,
          in_progress: ticket.status.in_progress,
          id: ticket.status.id
        });
      }
    });
    
    uniqueStatuses.forEach(status => {
      console.log(`- ${status.name} (internal: ${status.internal_name}, in_progress: ${status.in_progress})`);
    });
    
    // Summary
    console.log('\n\nSUMMARY:');
    console.log('========');
    console.log(`Total tickets checked: ${recentResults.data.length}`);
    console.log(`Total tickets in system: ${recentResults.meta.total_count}`);
    console.log(`Open/Active tickets found: ${openTickets.length}`);
    console.log(`Closed tickets: ${recentResults.data.length - openTickets.length}`);
    
    if (openTickets.length === 0) {
      console.log('\nℹ️  No open tickets found. This could mean:');
      console.log('   1. All tickets are genuinely closed');
      console.log('   2. The system uses different status names than expected');
      console.log('   3. Access permissions may be limiting the results');
      console.log('\nThe system appears to only have tickets with "Closed" status.');
    }
    
  } catch (error) {
    console.error('Error performing search:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  }
}

// Run the comprehensive search
comprehensiveSearch();