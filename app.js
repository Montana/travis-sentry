const express = require('express');
const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');
const fs = require('fs').promises;
const path = require('path');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  debug: true,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app: express() }),
    new Sentry.Integrations.Postgres(),
    new Sentry.Integrations.Mysql(),
    new Sentry.Integrations.Redis(),
  ],
  beforeSend(event) {

    event.tags = {
      ...event.tags,
      component: 'sentry-test-app',
      version: '1.0.0'
    };
    
    if (event.request && event.request.headers) {
      event.user = {
        id: event.request.headers['x-user-id'] || 'anonymous',
        ip_address: event.request.ip
      };
    }
    
    return event;
  }
});

Sentry.captureException(new Error('Application startup test error'));

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  
  Sentry.addBreadcrumb({
    message: `${req.method} ${req.path}`,
    category: 'http',
    level: 'info',
    data: {
      url: req.url,
      method: req.method,
      headers: req.headers,
      query: req.query
    }
  });
  
  next();
});

app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.get('/', (req, res) => {
  Sentry.addBreadcrumb({
    message: 'Root endpoint accessed',
    level: 'info'
  });
  
  res.json({
    message: 'Hello from Node + Sentry Enhanced Test!',
    timestamp: new Date().toISOString(),
    sentryTraceId: res.getHeader('sentry-trace')
  });
});

app.get('/error', (req, res) => {
  Sentry.setTag('error_type', 'synchronous');
  Sentry.setContext('error_details', {
    endpoint: '/error',
    intentional: true,
    severity: 'high'
  });
  
  throw new Error('Intentional synchronous error to test Sentry reporting');
});

app.get('/async-error', async (req, res, next) => {
  Sentry.setTag('error_type', 'asynchronous');
  
  try {
    await new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Intentional asynchronous error to test Sentry reporting'));
      }, Math.random() * 1000 + 200); 
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { endpoint: '/async-error' },
      extra: { delay: 'random', intentional: true }
    });
    next(err);
  }
});

app.get('/db-error', async (req, res, next) => {
  const transaction = Sentry.startTransaction({
    op: 'db.query',
    name: 'Simulated Database Query'
  });
  
  Sentry.getCurrentHub().configureScope((scope) => {
    scope.setSpan(transaction);
  });
  
  try {

    await new Promise((resolve, reject) => {
      setTimeout(() => {
        reject({
          code: 'ER_NO_SUCH_TABLE',
          errno: 1146,
          message: "Table 'test.users' doesn't exist",
          sql: 'SELECT * FROM users WHERE id = ?',
          sqlMessage: "Table 'test.users' doesn't exist"
        });
      }, 100);
    });
  } catch (dbError) {
    Sentry.captureException(new Error(`Database Error: ${dbError.message}`), {
      tags: { 
        error_type: 'database',
        error_code: dbError.code,
        errno: dbError.errno
      },
      extra: {
        sql: dbError.sql,
        sqlMessage: dbError.sqlMessage
      }
    });
    next(dbError);
  } finally {
    transaction.finish();
  }
});

app.get('/fs-error', async (req, res, next) => {
  try {
    Sentry.addBreadcrumb({
      message: 'Attempting to read non-existent file',
      category: 'filesystem',
      level: 'info'
    });
    
    await fs.readFile(path.join(__dirname, 'non-existent-file.txt'), 'utf8');
    res.json({ success: true });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { error_type: 'filesystem' },
      extra: { 
        filename: 'non-existent-file.txt',
        operation: 'readFile'
      }
    });
    next(err);
  }
});

app.get('/network-error', async (req, res, next) => {
  const fetch = require('node-fetch');
  
  try {
    Sentry.addBreadcrumb({
      message: 'Making request to non-existent API',
      category: 'http',
      level: 'info'
    });
    
    const response = await fetch('https://nonexistent-api-endpoint-12345.com/data', {
      timeout: 5000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { 
        error_type: 'network',
        url: 'https://nonexistent-api-endpoint-12345.com/data'
      },
      extra: {
        timeout: 5000,
        intentional: true
      }
    });
    next(err);
  }
});

app.post('/validate', (req, res, next) => {
  const { email, age, name } = req.body;
  const errors = [];
  
  if (!name || name.length < 2) {
    errors.push('Name is required and must be at least 2 characters');
  }
  
  if (!email || !email.includes('@')) {
    errors.push('Valid email is required');
  }
  
  if (!age || age < 0 || age > 150) {
    errors.push('Age must be between 0 and 150');
  }
  
  if (errors.length > 0) {
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';
    validationError.details = errors;
    
    Sentry.captureException(validationError, {
      tags: { error_type: 'validation' },
      extra: {
        input: req.body,
        validation_errors: errors
      },
      level: 'warning'
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }
  
  res.json({ message: 'Validation passed', data: req.body });
});

app.get('/memory-leak', (req, res) => {
  const data = [];
  
  for (let i = 0; i < 100000; i++) {
    data.push({
      id: i,
      data: 'x'.repeat(100),
      timestamp: new Date()
    });
  }
  
  global.leakedData = global.leakedData || [];
  global.leakedData.push(data);
  
  Sentry.addBreadcrumb({
    message: 'Memory leak simulation triggered',
    category: 'performance',
    level: 'warning',
    data: { 
      items_created: 100000,
      total_leaks: global.leakedData.length
    }
  });
  
  res.json({ 
    message: 'Memory leak simulated',
    items_created: 100000,
    memory_usage: process.memoryUsage()
  });
});

app.get('/slow-endpoint', async (req, res) => {
  const transaction = Sentry.startTransaction({
    op: 'http.server',
    name: 'Slow Endpoint Processing'
  });
  
  Sentry.getCurrentHub().configureScope((scope) => {
    scope.setSpan(transaction);
  });
  
  try {
    const delay = Math.random() * 3000 + 1000; 
    
    Sentry.addBreadcrumb({
      message: `Starting slow processing (${delay}ms)`,
      category: 'performance',
      level: 'info'
    });
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    res.json({
      message: 'Slow processing completed',
      processing_time: `${delay}ms`,
      timestamp: new Date().toISOString()
    });
  } finally {
    transaction.finish();
  }
});

app.get('/unhandled-promise', (req, res) => {

  Promise.reject(new Error('Unhandled promise rejection test'));
  
  res.json({ message: 'Unhandled promise rejection triggered' });
});

class CustomBusinessError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CustomBusinessError';
    this.code = code;
  }
}

app.get('/business-error', (req, res, next) => {
  const error = new CustomBusinessError('Insufficient funds for transaction', 'INSUFFICIENT_FUNDS');
  
  Sentry.captureException(error, {
    tags: { 
      error_type: 'business_logic',
      error_code: error.code
    },
    extra: {
      user_id: req.headers['x-user-id'] || 'anonymous',
      transaction_amount: 1000,
      available_balance: 250
    },
    level: 'error'
  });
  
  next(error);
});

app.get('/log-levels', (req, res) => {
  Sentry.captureMessage('This is an info message', 'info');
  Sentry.captureMessage('This is a warning message', 'warning');
  Sentry.captureMessage('This is an error message', 'error');
  Sentry.captureMessage('This is a fatal message', 'fatal');
  
  res.json({ message: 'Various log levels sent to Sentry' });
});

app.post('/feedback', (req, res) => {
  const { name, email, comments } = req.body;
  
  Sentry.captureUserFeedback({
    event_id: Sentry.lastEventId(),
    name: name || 'Anonymous',
    email: email || 'no-email@example.com',
    comments: comments || 'No comments provided'
  });
  
  res.json({ 
    message: 'Feedback captured',
    event_id: Sentry.lastEventId()
  });
});

app.get('/set-user/:userId', (req, res) => {
  const userId = req.params.userId;
  
  Sentry.setUser({
    id: userId,
    username: `user_${userId}`,
    email: `user${userId}@example.com`,
    ip_address: req.ip
  });
  
  res.json({ 
    message: `User context set for user ${userId}`,
    user_id: userId
  });
});

app.get('/clear-user', (req, res) => {
  Sentry.setUser(null);
  res.json({ message: 'User context cleared' });
});

app.get('/add-context', (req, res) => {
  Sentry.setTag('feature', 'context_testing');
  Sentry.setTag('version', '2.1.0');
  
  Sentry.setContext('business_context', {
    department: 'engineering',
    team: 'backend',
    sprint: 'sprint-42'
  });
  
  Sentry.setExtra('request_details', {
    user_agent: req.headers['user-agent'],
    referer: req.headers.referer,
    timestamp: new Date().toISOString()
  });
  
  res.json({ message: 'Context, tags, and extras added to Sentry scope' });
});

app.get('/test-all-errors', async (req, res) => {
  const errorTypes = [
    'sync-error',
    'async-error', 
    'db-error',
    'fs-error',
    'network-error',
    'business-error'
  ];
  
  const randomError = errorTypes[Math.floor(Math.random() * errorTypes.length)];
  
  Sentry.addBreadcrumb({
    message: `Randomly triggering error type: ${randomError}`,
    category: 'test',
    level: 'info'
  });
  
  res.redirect(`/${randomError}`);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  Sentry.captureException(error, {
    tags: { error_type: 'uncaught_exception' }
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  Sentry.captureException(reason, {
    tags: { error_type: 'unhandled_rejection' },
    extra: { promise: promise.toString() }
  });
});

app.use(Sentry.Handlers.errorHandler());

app.use((err, req, res, next) => {
  console.error('Error caught by express handler:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details,
      sentry_id: res.sentry
    });
  }
  
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      error: 'File Not Found',
      message: 'The requested file could not be found',
      sentry_id: res.sentry
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something broke and Sentry was notified',
    sentry_id: res.sentry,
    timestamp: new Date().toISOString()
  });
});

app.use('*', (req, res) => {
  Sentry.captureMessage(`404 - Route not found: ${req.originalUrl}`, 'warning');
  
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    available_routes: [
      '/',
      '/healthz',
      '/error',
      '/async-error',
      '/db-error',
      '/fs-error',
      '/network-error',
      '/memory-leak',
      '/slow-endpoint',
      '/unhandled-promise',
      '/business-error',
      '/log-levels',
      '/test-all-errors',
      'POST /validate',
      'POST /feedback',
      '/set-user/:userId',
      '/clear-user',
      '/add-context'
    ]
  });
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  await Sentry.close(2000);
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Enhanced Sentry Test Server running at http://localhost:${port}`);
  console.log('Available test endpoints:');
  console.log('- GET  /healthz - Health check');
  console.log('- GET  /error - Synchronous error');
  console.log('- GET  /async-error - Asynchronous error');
  console.log('- GET  /db-error - Database error simulation');
  console.log('- GET  /fs-error - File system error');
  console.log('- GET  /network-error - Network/HTTP error');
  console.log('- GET  /memory-leak - Memory leak simulation');
  console.log('- GET  /slow-endpoint - Performance monitoring');
  console.log('- GET  /unhandled-promise - Unhandled promise rejection');
  console.log('- GET  /business-error - Custom business logic error');
  console.log('- GET  /log-levels - Test different Sentry log levels');
  console.log('- GET  /test-all-errors - Randomly trigger different errors');
  console.log('- POST /validate - Validation error testing');
  console.log('- POST /feedback - User feedback capture');
  console.log('- GET  /set-user/:userId - Set user context');
  console.log('- GET  /clear-user - Clear user context');
  console.log('- GET  /add-context - Add tags and context');
  
  Sentry.captureMessage('Enhanced Sentry test application started successfully', 'info');
});
