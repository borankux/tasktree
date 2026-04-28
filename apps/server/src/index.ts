import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getDb } from './db.js';
import projects from './routes/projects.js';
import nodes from './routes/nodes.js';
import layout from './routes/layout.js';

// Initialize DB on startup
getDb();

const app = new Hono();
app.use('/api/*', cors());

app.route('/api/projects', projects);
app.route('/api/nodes', nodes);
app.route('/api/projects', layout);

const port = Number(process.env.PORT) || 3001;
console.log(`Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
