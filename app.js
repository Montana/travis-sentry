const express = require('express');
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

const app = express();
const port = process.env.PORT || 3000;

app.use(Sentry.Handlers.requestHandler());

app.get('/', (req, res) => {
  Sentry.addBreadcrumb({
    category: 'route',
    message: 'User accessed home page',
    level: 'info',
  });
  res.send('Hello from Node + Sentry!');
});

app.get('/error', (req, res) => {
  Sentry.addBreadcrumb({
    category: 'custom',
    message: 'About to throw a test error',
    level: 'warning',
  });

  Sentry.addBreadcrumb({
    category: 'user',
    message: 'Simulated user ID: 1234',
    data: { user_id: 1234, action: 'trigger_error' },
    level: 'info',
  });

  throw new Error('Test error for Sentry with breadcrumbs');
});

app.use(Sentry.Handlers.errorHandler());

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
