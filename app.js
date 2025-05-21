const express = require('express');
const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0, 
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app: express() }),
  ],
});

const app = express();
const port = process.env.PORT || 3000;

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

app.get('/', (req, res) => {
  res.send('Hello from Node + Sentry with Tracing!');
});

app.get('/error', (req, res) => {
  Sentry.addBreadcrumb({
    category: 'custom',
    message: 'Throwing error on /error route',
    level: 'error',
  });
  throw new Error('Simulated error for Sentry tracing');
});

app.use(Sentry.Handlers.errorHandler());

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
