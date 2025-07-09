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
  ],
  subcategories: {
    'Software': [
      { id: '216826000000006691', name: 'Application', deleted: false },
      { id: '216826000000006693', name: 'Operating System', deleted: false },
      { id: '216826000000006695', name: 'Database', deleted: false },
      { id: '216826000000006697', name: 'General', deleted: false }
    ],
    'Hardware': [
      { id: '216826000000288102', name: 'Computer', deleted: false },
      { id: '216826000000288104', name: 'Printer', deleted: false },
      { id: '216826000000288106', name: 'Network', deleted: false },
      { id: '216826000000288108', name: 'General', deleted: false }
    ],
    'Access': [
      { id: '216826000000459713', name: 'File Access', deleted: false },
      { id: '216826000000459715', name: 'Application Access', deleted: false },
      { id: '216826000000459717', name: 'General', deleted: false }
    ]
  }
};

// Initialize with some mock tickets
function initializeMockData() {
  // Initialize technicians
  mockData.technicians = [
    {
      id: 216826000000007001,
      name: 'John Admin',
      email_id: 'john.admin@mock.com',
      phone: '555-0101',
      mobile: '555-1001',
      department: { id: 216826000000006301, name: 'IT Support' },
      job_title: 'Senior Technician',
      employee_id: 'EMP001',
      is_vip_user: false,
      is_technician: true,
      roles: [{ id: 216826000000006001, name: 'Admin' }],
      cost_per_hour: 75,
      is_mock: true
    },
    {
      id: 216826000000007002,
      name: 'Jane Support',
      email_id: 'jane.support@mock.com',
      phone: '555-0102',
      mobile: '555-1002',
      department: { id: 216826000000006301, name: 'IT Support' },
      job_title: 'Support Technician',
      employee_id: 'EMP002',
      is_vip_user: false,
      is_technician: true,
      roles: [{ id: 216826000000006002, name: 'Technician' }],
      cost_per_hour: 50,
      is_mock: true
    },
    {
      id: 216826000000007003,
      name: 'Bob Manager',
      email_id: 'bob.manager@mock.com',
      phone: '555-0103',
      mobile: '555-1003',
      department: { id: 216826000000006302, name: 'Management' },
      job_title: 'IT Manager',
      employee_id: 'EMP003',
      is_vip_user: false,
      is_technician: true,
      roles: [{ id: 216826000000006003, name: 'Manager' }],
      cost_per_hour: 100,
      is_mock: true
    },
    {
      id: 216826000000006907,
      name: 'Clay Meuth',
      email_id: 'cmeuth@pttg.com',
      phone: '555-0104',
      mobile: '555-1004',
      department: { id: 216826000000006301, name: 'IT Support' },
      job_title: 'Senior IT Technician',
      employee_id: 'EMP004',
      is_vip_user: false,
      is_technician: true,
      roles: [{ id: 216826000000006002, name: 'Technician' }],
      cost_per_hour: 85,
      is_mock: true
    }
  ];
  
  // Initialize users (requesters)
  mockData.users = [
    {
      id: 216826000000008001,
      name: 'Alice User',
      email_id: 'alice.user@mock.com',
      phone: '555-0201',
      mobile: '555-2001',
      department: { id: 216826000000006303, name: 'Sales' },
      job_title: 'Sales Representative',
      employee_id: 'EMP101',
      is_vip_user: false,
      is_technician: false,
      is_mock: true
    },
    {
      id: 216826000000008002,
      name: 'Charlie Customer',
      email_id: 'charlie.customer@mock.com',
      phone: '555-0202',
      mobile: '555-2002',
      department: { id: 216826000000006304, name: 'Marketing' },
      job_title: 'Marketing Manager',
      employee_id: 'EMP102',
      is_vip_user: true,
      is_technician: false,
      is_mock: true
    }
  ];
  
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
      subcategory: { name: 'Application' },
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
      subcategory: { name: 'Computer' },
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
  // Check for proper Zoho-oauthtoken format
  if (!authHeader || (!authHeader.startsWith('Zoho-oauthtoken ') && !authHeader.startsWith('Bearer '))) {
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
  
  // Check for subcategory - it's mandatory when category is provided
  if (request.category && !request.subcategory) {
    missingFields.push('subcategory');
  }
  
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
  
  // Check if trying to update priority on any ticket (mimics real API behavior)
  if (updates.priority) {
    return res.status(403).json({
      response_status: {
        status_code: 4000,
        messages: [{
          status_code: 4002,
          field: 'priority',
          message: 'Cannot give value for priority',
          type: 'failed'
        }],
        status: 'failed'
      }
    });
  }
  
  // Check if trying to update closed ticket
  if (existingRequest.status.name === 'Closed' && updates.category) {
    return res.status(403).json({
      response_status: {
        status_code: 4000,
        messages: [{
          status_code: 4001,
          field: 'category',
          message: 'Cannot update category on closed ticket',
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

// Technician endpoints
app.get('/app/:instance/api/v3/technicians', (req, res) => {
  const listInfo = req.inputData?.list_info || {};
  const searchTerm = listInfo.search_value || listInfo.search_fields?.name || '';
  const limit = listInfo.row_count || 10;
  const startIndex = listInfo.start_index || 0;
  
  let technicians = [...mockData.technicians];
  
  // Apply search filter
  if (searchTerm) {
    technicians = technicians.filter(tech => 
      tech.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tech.email_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  // Apply is_technician filter if provided
  if (listInfo.filter_by?.name === 'is_technician') {
    technicians = technicians.filter(tech => tech.is_technician === true);
  }
  
  // Apply pagination
  const paginatedTechnicians = technicians.slice(startIndex, startIndex + limit);
  
  res.json({
    technicians: paginatedTechnicians,
    list_info: {
      has_more_rows: technicians.length > (startIndex + limit),
      start_index: startIndex,
      row_count: paginatedTechnicians.length
    },
    total_count: technicians.length,
    response_status: {
      status_code: 2000,
      status: 'success'
    }
  });
});

app.get('/app/:instance/api/v3/technicians/:id', (req, res) => {
  const techId = parseInt(req.params.id);
  const technician = mockData.technicians.find(t => t.id === techId);
  
  if (!technician) {
    return res.status(404).json({
      response_status: {
        status_code: 4007,
        messages: [{ message: 'Resource not found' }],
        status: 'failed'
      }
    });
  }
  
  res.json({
    technician,
    response_status: {
      status_code: 2000,
      status: 'success'
    }
  });
});

// User endpoints
app.get('/app/:instance/api/v3/users', (req, res) => {
  const listInfo = req.inputData?.list_info || {};
  const searchTerm = listInfo.search_value || listInfo.search_fields?.name || '';
  const limit = listInfo.row_count || 10;
  const startIndex = listInfo.start_index || 0;
  
  // Include both users and technicians in the users endpoint
  let users = [...mockData.users, ...mockData.technicians];
  
  // Apply is_technician filter if provided
  if (listInfo.filter_by?.name === 'is_technician' && listInfo.filter_by?.value === true) {
    users = users.filter(user => user.is_technician === true);
  }
  
  // Apply search filter
  if (searchTerm) {
    users = users.filter(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  // Apply pagination
  const paginatedUsers = users.slice(startIndex, startIndex + limit);
  
  res.json({
    users: paginatedUsers,
    list_info: {
      has_more_rows: users.length > (startIndex + limit),
      start_index: startIndex,
      row_count: paginatedUsers.length
    },
    total_count: users.length,
    response_status: {
      status_code: 2000,
      status: 'success'
    }
  });
});

app.get('/app/:instance/api/v3/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  // Look in both users and technicians
  const user = [...mockData.users, ...mockData.technicians].find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({
      response_status: {
        status_code: 4007,
        messages: [{ message: 'Resource not found' }],
        status: 'failed'
      }
    });
  }
  
  res.json({
    user,
    response_status: {
      status_code: 2000,
      status: 'success'
    }
  });
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