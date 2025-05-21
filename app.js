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
  res.send('Hello from Node + Sentry!');
});

app.get('/error', (req, res) => {
  throw new Error('Test error for Sentry');
});

app.use(Sentry.Handlers.errorHandler());

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
