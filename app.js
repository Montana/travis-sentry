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

Sentry.captureException(new Error('Test error from init'));

const app = express();
const port = process.env.PORT || 3000;

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

app.get('/', (req, res) => {
  res.send('Hello from Node + Sentry!');
});

app.get('/error', (req, res) => {
  throw new Error('Intentional error to test Sentry reporting (sync)');
});

app.get('/async-error', async (req, res, next) => {
  try {
    await new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Intentional error to test Sentry reporting (async)')), 200)
    );
  } catch (err) {
    next(err); 
  }
});

app.use(Sentry.Handlers.errorHandler());

app.use((err, req, res, next) => {
  res.status(500).send('Something broke and Sentry was notified.');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
