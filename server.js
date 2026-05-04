require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Import config
const { initDatabase } = require('./src/config/database');

// Import routes
const agentsRouter = require('./src/routes/agents');
const projectsRouter = require('./src/routes/projects');
const tasksRouter = require('./src/routes/tasks');
const chatRouter = require('./src/routes/chat');
const settingsRouter = require('./src/routes/settings');

// Import WebSocket handler
const { setupWebSocket } = require('./src/websocket/chat-handler');

// Import services
const orchestrator = require('./src/services/orchestrator');
const scheduler = require('./src/services/scheduler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure directories exist
const dataDir = path.join(__dirname, 'data');
const projectsDir = path.resolve(process.env.PROJECTS_ROOT || './projects');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });

// Initialize database
const db = initDatabase();

// Initialize orchestrator & scheduler
orchestrator.init(db, io);
scheduler.init(db, io);
scheduler.startHeartbeat(15); // Check every 15 minutes

// Make available to routes
app.locals.db = db;
app.locals.io = io;
app.locals.projectsRoot = projectsDir;
app.locals.orchestrator = orchestrator;
app.locals.scheduler = scheduler;

// API Routes
app.use('/api/agents', agentsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/chat', chatRouter);
app.use('/api/settings', settingsRouter);

// AI Orchestration endpoint
app.post('/api/ai/chat', async (req, res) => {
  const { context_type, context_id, message, agent_id } = req.body;
  if (!context_type || !context_id || !message) {
    return res.status(400).json({ error: 'context_type, context_id, and message are required' });
  }
  // The orchestrator.processMessage now saves and broadcasts the userMessage automatically!
  const result = await orchestrator.processMessage(context_type, parseInt(context_id), message, agent_id || null);
  res.json(result);
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const db = req.app.locals.db;
  const agents = db.prepare('SELECT COUNT(*) as count FROM agents').get();
  const activeAgents = db.prepare("SELECT COUNT(*) as count FROM agents WHERE status = 'active'").get();
  const projects = db.prepare('SELECT COUNT(*) as count FROM projects').get();
  const activeProjects = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status IN ('planning','in_progress','review')").get();
  const tasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
  const pendingTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status IN ('pending','in_progress')").get();
  const completedTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get();
  const recentMessages = db.prepare(`
    SELECT m.*, a.name as agent_name, a.avatar_emoji as agent_emoji
    FROM messages m LEFT JOIN agents a ON m.agent_id = a.id
    ORDER BY m.created_at DESC LIMIT 10
  `).all();
  res.json({
    agents: { total: agents.count, active: activeAgents.count },
    projects: { total: projects.count, active: activeProjects.count },
    tasks: { total: tasks.count, pending: pendingTasks.count, completed: completedTasks.count },
    recentActivity: recentMessages
  });
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

setupWebSocket(io, db, orchestrator);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`\n  🔮 NEXUS OS running at http://${HOST}:${PORT}`);
  console.log(`  📡 WebSocket ready\n`);
});
