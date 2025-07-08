#!/usr/bin/env node

/**
 * Mock Service Desk Plus API Server
 * Simulates the real SDP API behavior for testing
 * 
 * Features:
 * - Mimics exact error responses from the real API
 * - Maintains state for created/updated tickets
 * - Enforces same business rules (can't update closed tickets)
 * - Returns mock data with special identifier
 */

const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Mock data store
const mockData = {
  requests: new Map(),
  priorities: [
    { id: '216826000000006799', name: '1 - Low', color: '#666666' },
    { id: '216826000000006801', name: '2 - Normal', color: '#006600' },
    { id: '216826000000006805', name: '3 - High', color: '#ffff00' },
    { id: '216826000000288214', name: '4 - Critical', color: '#ff0000' },
    { id: '216826000000006803', name: 'z - Medium', color: '#ff6600' }
  ],
  statuses: ['Open', 'On Hold', 'In Progress', 'Resolved', 'Closed', 'Cancelled'],
  categories: [
    { id: '216826000000006689', name: 'Software', description: 'Software Problems' },
    { id: '216826000000288100', name: 'Hardware', description: 'Hardware related issues' },
    { id: '216826000000459711', name: 'Access', description: 'Access or Permissions to files and Company Resources' }
  ],
  impacts: [
    { id: '216826000000008042', name: '1 - Affects User', deleted: false },
    { id: '216826000000008036', name: '2 - Affects Group', deleted: false },
    { id: '216826000000008039', name: '3 - Affects Department', deleted: false },
    { id: '216826000000008033', name: '4 - Affects Business', deleted: false }
  ],
  modes: [
    { id: '216826000000006665', name: 'E-Mail', internal_name: 'E-Mail', deleted: false },
    { id: '216826000000006667', name: 'Web Form', internal_name: 'Web Form', deleted: false },
    { id: '216826000000006669', name: 'Phone Call', internal_name: 'Phone Call', deleted: false }
  ],
  request_types: [
    { id: '216826000000008391', name: 'Incident', deleted: false },
    { id: '216826000000008393', name: 'Request', deleted: false }
  ],
  urgencies: [
    { id: '216826000000007923', name: '1 - Suggestion', deleted: false },
    { id: '216826000000007921', name: '2 - General Concern', deleted: false },
    { id: '216826000000007919', name: '3 - Have Workaround', deleted: false },
    { id: '216826000000007917', name: '4 - Dead in the Water', deleted: false }
  ],
  levels: [
    { id: '216826000000006671', name: '1 - Frontline', deleted: false },
    { id: '216826000000006673', name: '2 - Technician', deleted: false }
  ]
};

// Initialize with some mock tickets
function initializeMockData() {
  // Add a few mock tickets
  const mockTickets = [
    {
      id: 'MOCK-216826000006430001',
      subject: '[MOCK] Test ticket - Open status',
      description: 'This is a mock ticket for testing',
      status: { name: 'Open', color: '#00FF00' },
      priority: { id: '216826000000006801', name: '2 - Normal' },
      requester: { email_id: 'test@example.com', name: 'Test User' },
      created_time: { value: Date.now() - 86400000, display_value: 'Yesterday' },
      mode: { name: 'Web Form' },
      request_type: { name: 'Incident' },
      impact: { name: '1 - Affects User' },
      urgency: { name: '2 - General Concern' },
      level: { name: '1 - Frontline' },
      category: { name: 'Software' },
      has_notes: false,
      is_mock: true
    },
    {
      id: 'MOCK-216826000006430002',
      subject: '[MOCK] Test ticket - Closed status',
      description: 'This is a closed mock ticket',
      status: { name: 'Closed', color: '#FF0000' },
      priority: { id: '216826000000006805', name: '3 - High' },
      requester: { email_id: 'test@example.com', name: 'Test User' },
      created_time: { value: Date.now() - 172800000, display_value: '2 days ago' },
      closure_info: {
        closure_code: { name: 'Resolved' },
        closure_comments: 'Issue resolved'
      },
      completed_time: { value: Date.now() - 3600000, display_value: '1 hour ago' },
      mode: { name: 'E-Mail' },
      request_type: { name: 'Incident' },
      impact: { name: '1 - Affects User' },
      urgency: { name: '3 - Have Workaround' },
      level: { name: '1 - Frontline' },
      category: { name: 'Hardware' },
      has_notes: true,
      is_mock: true
    }
  ];
  
  mockTickets.forEach(ticket => {
    mockData.requests.set(ticket.id, ticket);
  });
}

// Middleware to check auth header
function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      response_status: {
        status_code: 4002,
        messages: [{ message: 'UNAUTHORISED' }],
        status: 'failed'
      }
    });
  }
  next();
}

// Middleware to parse input_data
function parseInputData(req, res, next) {
  if (req.query.input_data) {
    try {
      req.inputData = JSON.parse(req.query.input_data);
    } catch (e) {
      return res.status(400).json({
        response_status: {
          status_code: 4000,
          messages: [{ message: 'Invalid input_data format' }],
          status: 'failed'
        }
      });
    }
  }
  next();
}

// Apply middleware
app.use(checkAuth);
app.use(parseInputData);

// Helper to check mandatory fields
function checkMandatoryFields(request) {
  const mandatoryFields = ['mode', 'request_type', 'urgency', 'level', 'impact', 'category', 'status'];
  const missingFields = [];
  
  mandatoryFields.forEach(field => {
    if (!request[field]) {
      missingFields.push(field);
    }
  });
  
  // Special check for priority field issues
  if (request.priority && typeof request.priority === 'object') {
    // Check if it has valid structure
    if (!request.priority.id && !request.priority.name) {
      return { error: true, field: 'priority', code: 4001 };
    }
  }
  
  if (missingFields.length > 0) {
    return { error: true, fields: missingFields, code: 4012 };
  }
  
  return { error: false };
}

// Routes

// GET /api/v3/requests - List requests
app.get('/app/:instance/api/v3/requests', (req, res) => {
  const listInfo = req.inputData?.list_info || {};
  const limit = listInfo.row_count || 10;
  const offset = listInfo.start_index || 0;
  
  let requests = Array.from(mockData.requests.values());
  
  // Apply filters
  if (listInfo.search_fields?.status) {
    const statusName = listInfo.search_fields.status.name || listInfo.search_fields.status.id;
    requests = requests.filter(r => r.status.name.toLowerCase() === statusName.toLowerCase());
  }
  
  // Sort by created_time desc by default
  requests.sort((a, b) => b.created_time.value - a.created_time.value);
  
  // Paginate
  const paginatedRequests = requests.slice(offset, offset + limit);
  
  res.json({
    requests: paginatedRequests,
    list_info: {
      has_more_rows: requests.length > offset + limit,
      start_index: offset,
      row_count: paginatedRequests.length,
      total_count: requests.length
    },
    response_status: []
  });
});

// GET /api/v3/requests/:id - Get request details
app.get('/app/:instance/api/v3/requests/:id', (req, res) => {
  const request = mockData.requests.get(req.params.id);
  
  if (!request) {
    return res.status(404).json({
      response_status: {
        status_code: 4007,
        messages: [{ message: 'Resource not found' }],
        status: 'failed'
      }
    });
  }
  
  res.json({ request });
});

// POST /api/v3/requests - Create request
app.post('/app/:instance/api/v3/requests', (req, res) => {
  const requestData = req.inputData?.request;
  
  if (!requestData) {
    return res.status(400).json({
      response_status: {
        status_code: 4000,
        messages: [{ message: 'request data is required' }],
        status: 'failed'
      }
    });
  }
  
  // Check mandatory fields
  const validation = checkMandatoryFields(requestData);
  if (validation.error) {
    if (validation.code === 4012) {
      return res.status(400).json({
        response_status: {
          status_code: 4000,
          messages: [{
            status_code: 4012,
            type: 'failed',
            fields: validation.fields
          }],
          status: 'failed'
        }
      });
    } else {
      return res.status(400).json({
        response_status: {
          status_code: 4000,
          messages: [{
            status_code: validation.code,
            field: validation.field,
            type: 'failed'
          }],
          status: 'failed'
        }
      });
    }
  }
  
  // Create the request
  const newRequest = {
    id: `MOCK-${Date.now()}`,
    ...requestData,
    created_time: {
      value: Date.now(),
      display_value: new Date().toLocaleString()
    },
    has_notes: false,
    is_mock: true
  };
  
  mockData.requests.set(newRequest.id, newRequest);
  
  res.json({
    request: newRequest,
    response_status: {
      status_code: 2000,
      status: 'success'
    }
  });
});

// PUT /api/v3/requests/:id - Update request
app.put('/app/:instance/api/v3/requests/:id', (req, res) => {
  const requestId = req.params.id;
  const updates = req.inputData?.request;
  
  if (!updates) {
    return res.status(400).json({
      response_status: {
        status_code: 4000,
        messages: [{ message: 'request data is required' }],
        status: 'failed'
      }
    });
  }
  
  const existingRequest = mockData.requests.get(requestId);
  if (!existingRequest) {
    return res.status(404).json({
      response_status: {
        status_code: 4007,
        messages: [{ message: 'Resource not found' }],
        status: 'failed'
      }
    });
  }
  
  // Check if trying to update closed ticket
  if (existingRequest.status.name === 'Closed' && (updates.priority || updates.category)) {
    return res.status(403).json({
      response_status: {
        status_code: 4000,
        messages: [{
          status_code: 4001,
          field: Object.keys(updates)[0],
          message: `Cannot give value for ${Object.keys(updates)[0]}`,
          type: 'failed'
        }],
        status: 'failed'
      }
    });
  }
  
  // Check for status ID issues
  if (updates.status && updates.status.id && !updates.status.name) {
    return res.status(400).json({
      response_status: {
        status_code: 4000,
        messages: [{
          status_code: 4001,
          field: 'id',
          message: 'Unable to parse the given data for id',
          type: 'failed'
        }],
        status: 'failed'
      }
    });
  }
  
  // Handle closure
  if (updates.closure_info || updates.status?.name === 'Closed') {
    existingRequest.status = { name: 'Closed' };
    existingRequest.closure_info = updates.closure_info || {
      closure_code: { name: 'Resolved' },
      closure_comments: 'Closed via API'
    };
    existingRequest.completed_time = {
      value: Date.now(),
      display_value: new Date().toLocaleString()
    };
  }
  
  // Apply other updates
  Object.assign(existingRequest, updates);
  
  res.json({
    request: existingRequest,
    response_status: {
      status_code: 2000,
      status: 'success'
    }
  });
});

// POST /api/v3/requests/:id/notes - Add note
app.post('/app/:instance/api/v3/requests/:id/notes', (req, res) => {
  const requestId = req.params.id;
  const noteData = req.inputData?.request_note;
  
  if (!noteData || !noteData.description) {
    return res.status(400).json({
      response_status: {
        status_code: 4000,
        messages: [{ message: 'note description is required' }],
        status: 'failed'
      }
    });
  }
  
  const request = mockData.requests.get(requestId);
  if (!request) {
    return res.status(404).json({
      response_status: {
        status_code: 4007,
        messages: [{ message: 'Resource not found' }],
        status: 'failed'
      }
    });
  }
  
  const newNote = {
    id: `MOCK-NOTE-${Date.now()}`,
    description: noteData.description,
    created_time: {
      value: Date.now(),
      display_value: new Date().toLocaleString()
    },
    show_to_requester: noteData.show_to_requester || true,
    is_mock: true
  };
  
  request.has_notes = true;
  
  res.json({
    request_note: newNote,
    response_status: {
      status_code: 2000,
      status: 'success'
    }
  });
});

// Metadata endpoints
app.get('/app/:instance/api/v3/priorities', (req, res) => {
  res.json({ priorities: mockData.priorities });
});

app.get('/app/:instance/api/v3/categories', (req, res) => {
  res.json({ categories: mockData.categories });
});

app.get('/app/:instance/api/v3/impacts', (req, res) => {
  res.json({ impacts: mockData.impacts });
});

app.get('/app/:instance/api/v3/modes', (req, res) => {
  res.json({ modes: mockData.modes });
});

app.get('/app/:instance/api/v3/request_types', (req, res) => {
  res.json({ request_types: mockData.request_types });
});

app.get('/app/:instance/api/v3/urgencies', (req, res) => {
  res.json({ urgencies: mockData.urgencies });
});

app.get('/app/:instance/api/v3/levels', (req, res) => {
  res.json({ levels: mockData.levels });
});

// Initialize data and start server
initializeMockData();

const PORT = process.env.MOCK_SDP_PORT || 3457;
app.listen(PORT, () => {
  console.log(`Mock SDP API Server running on port ${PORT}`);
  console.log(`Base URL: http://localhost:${PORT}/app/itdesk/api/v3`);
  console.log('\nMock tickets created:');
  mockData.requests.forEach(ticket => {
    console.log(`  - ${ticket.id}: ${ticket.subject} (${ticket.status.name})`);
  });
});