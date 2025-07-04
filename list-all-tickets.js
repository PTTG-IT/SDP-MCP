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

async function listAllTickets() {
  try {
    console.log('Fetching tickets from Service Desk Plus...\n');
    
    // Get requests with pagination
    const results = await client.requests.list({
      page: 1,
      per_page: 20  // Get first 20 tickets
    });
    
    console.log(`Showing ${results.data.length} tickets out of ${results.meta.total_count} total\n`);
    
    // Display all tickets with their statuses
    if (results.data.length > 0) {
      console.log('Tickets:');
      console.log('========\n');
      
      results.data.forEach((ticket, index) => {
        console.log(`${index + 1}. Ticket #${ticket.display_id || ticket.id}`);
        console.log(`   Subject: ${ticket.subject}`);
        console.log(`   Status: ${JSON.stringify(ticket.status)}`);
        console.log(`   Priority: ${ticket.priority?.name || 'Not set'}`);
        console.log(`   Requester: ${ticket.requester?.name || 'Unknown'}`);
        console.log(`   Created: ${ticket.created_time?.display_value || ticket.created_time || 'Unknown'}`);
        console.log('');
      });
      
      // Show unique statuses
      console.log('\nUnique Statuses Found:');
      console.log('======================');
      const uniqueStatuses = new Set();
      results.data.forEach(ticket => {
        if (ticket.status) {
          uniqueStatuses.add(JSON.stringify(ticket.status));
        }
      });
      
      uniqueStatuses.forEach(status => {
        console.log(status);
      });
      
    } else {
      console.log('No tickets found!');
    }
    
  } catch (error) {
    console.error('Error fetching tickets:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  }
}

// Run the listing
listAllTickets();