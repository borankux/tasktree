import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { getDb } from './db.js';
import auth from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';
import projects from './routes/projects.js';
import nodes from './routes/nodes.js';
import layout from './routes/layout.js';
import edges from './routes/edges.js';
import tags from './routes/tags.js';
import viewRoutes from './routes/views.js';
import snapshots from './routes/snapshots.js';
import exportRoutes from './routes/export.js';

// Initialize DB on startup
getDb();

const app = new Hono();
app.use('/api/*', cors());

// Public auth routes
app.route('/api/auth', auth);

// Protected routes
app.use('/api/projects/*', authMiddleware);
app.use('/api/nodes/*', authMiddleware);
app.use('/api/edges/*', authMiddleware);
app.use('/api/tags/*', authMiddleware);
app.use('/api/views/*', authMiddleware);
app.use('/api/snapshots/*', authMiddleware);

app.route('/api/projects', projects);
app.route('/api/nodes', nodes);
app.route('/api/projects', layout);
app.route('/api/projects', exportRoutes);
app.route('/api/edges', edges);
app.route('/api/tags', tags);
app.route('/api/views', viewRoutes);
app.route('/api/snapshots', snapshots);

const port = Number(process.env.PORT) || 3001;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});
