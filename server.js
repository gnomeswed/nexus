require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./src/config/database');
const agentsRouter = require('./src/routes/agents');
const projectsRouter = require('./src/routes/projects');
const tasksRouter = require('./src/routes/tasks');
const chatRouter = require('./src/routes/chat');
const settingsRouter = require('./src/routes/settings');
const { setupWebSocket } = require('./src/websocket/chat-handler');
const orchestrator = require('./src/services/orchestrator');
const scheduler = require('./src/services/scheduler');
const security = require('./src/middleware/security');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const dataDir = path.join(__dirname, 'data');
const projectsDir = path.resolve(process.env.PROJECTS_ROOT || './projects');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });

const db = initDatabase();

orchestrator.init(db, io);
scheduler.init(db, io);
scheduler.setOrchestrator(orchestrator);
scheduler.startHeartbeat(15);

app.locals.db = db;
app.locals.io = io;
app.locals.projectsRoot = projectsDir;
app.locals.orchestrator = orchestrator;
app.locals.scheduler = scheduler;

// Global Security
app.use('/api', security.rateLimiter);
app.use('/api', security.pinAuth);

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
  try {
    const result = await orchestrator.processMessage(context_type, parseInt(context_id), message, agent_id || null);
    res.json(result);
  } catch (err) {
    console.error('[AI Chat] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Stats endpoint (enhanced with usage data)
app.get('/api/stats', (req, res) => {
  try {
    const agents = db.prepare('SELECT COUNT(*) as count FROM agents').get();
    const activeAgents = db.prepare("SELECT COUNT(*) as count FROM agents WHERE status = 'active'").get();
    const projects = db.prepare('SELECT COUNT(*) as count FROM projects').get();
    const activeProjects = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status IN ('planning','in_progress','review')").get();
    const tasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
    const pendingTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status IN ('pending','in_progress')").get();
    const completedTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get();
    const urgentTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE priority = 'urgent' AND status NOT IN ('completed','cancelled')").get();
    const reviewTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'review_pending'").get();

    const recentMessages = db.prepare(`
      SELECT m.*, a.name as agent_name, a.avatar_emoji as agent_emoji
      FROM messages m LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.archived = 0
      ORDER BY m.created_at DESC LIMIT 20
    `).all();

    // Agent status overview
    const agentsList = db.prepare(`
      SELECT a.id, a.name, a.avatar_emoji, a.status, a.role,
        (SELECT COUNT(*) FROM messages m WHERE m.agent_id = a.id AND m.role = 'system' AND m.content LIKE '❌ Error:%') as error_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.agent_id = a.id AND t.status IN ('pending','in_progress')) as active_tasks
      FROM agents a ORDER BY a.status ASC, a.created_at DESC
    `).all();

    // Token usage last 7 days
    let tokenUsage = [];
    try {
      tokenUsage = db.prepare(`
        SELECT date(created_at) as day, SUM(total_tokens) as tokens, COUNT(*) as calls
        FROM usage_log WHERE created_at > datetime('now', '-7 days')
        GROUP BY date(created_at) ORDER BY day ASC
      `).all();
    } catch(e) {}

    // Total tokens
    let totalTokens = { total: 0 };
    try {
      totalTokens = db.prepare('SELECT COALESCE(SUM(total_tokens),0) as total FROM usage_log').get();
    } catch(e) {}

    // Stale tasks (no activity in 2+ hours)
    const staleTasks = db.prepare(`
      SELECT t.id, t.title, t.status, a.name as agent_name
      FROM tasks t LEFT JOIN agents a ON t.agent_id = a.id
      WHERE t.status = 'in_progress'
      AND t.updated_at < datetime('now', '-2 hours')
    `).all();

    // Error agents
    const errorAgents = agentsList.filter(a => a.error_count > 0);

    res.json({
      agents: { total: agents.count, active: activeAgents.count, list: agentsList },
      projects: { total: projects.count, active: activeProjects.count },
      tasks: { total: tasks.count, pending: pendingTasks.count, completed: completedTasks.count, urgent: urgentTasks.count, review: reviewTasks.count },
      alerts: {
        urgentTasks: urgentTasks.count,
        reviewPending: reviewTasks.count,
        staleTasks: staleTasks,
        errorAgents: errorAgents
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        dbStatus: 'healthy',
        aiGateway: !!process.env.AI_ROUTER_URL ? 'online' : 'offline',
        scheduler: scheduler.heartbeatInterval ? 'active' : 'idle'
      },
      recentActivity: recentMessages,
      tokenUsage,
      totalTokens: totalTokens.total
    });
  } catch(e) {
    console.error('[Stats] Error:', e.message);
    res.json({ agents: {total:0,active:0,list:[]}, projects:{total:0,active:0}, tasks:{total:0,pending:0,completed:0,urgent:0,review:0}, alerts:{urgentTasks:0,reviewPending:0,staleTasks:[],errorAgents:[]}, recentActivity:[], tokenUsage:[], totalTokens:0 });
  }
});

// Global search endpoint
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ tasks: [], projects: [], agents: [], messages: [] });
  const like = `%${q}%`;
  const tasks = db.prepare(`SELECT t.id, t.title, t.status, t.priority FROM tasks t WHERE t.title LIKE ? OR t.description LIKE ? LIMIT 10`).all(like, like);
  const projects = db.prepare(`SELECT p.id, p.name, p.status FROM projects p WHERE p.name LIKE ? OR p.description LIKE ? LIMIT 10`).all(like, like);
  const agents = db.prepare(`SELECT a.id, a.name, a.avatar_emoji, a.role FROM agents a WHERE a.name LIKE ? OR a.role LIKE ? LIMIT 10`).all(like, like);
  const messages = db.prepare(`SELECT m.id, m.context_type, m.context_id, substr(m.content,1,120) as content, m.created_at FROM messages m WHERE m.content LIKE ? AND m.archived = 0 ORDER BY m.created_at DESC LIMIT 10`).all(like);
  res.json({ tasks, projects, agents, messages });
});

// Export endpoint
app.get('/api/export/:type/:id', (req, res) => {
  const { type, id } = req.params;
  if (type === 'project') {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    project.tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(id);
    project.messages = db.prepare("SELECT role, content, created_at FROM messages WHERE context_type='project' AND context_id=? AND archived=0 ORDER BY created_at ASC").all(id);
    project.agents = db.prepare('SELECT a.name, a.role, pa.role_in_project FROM agents a JOIN project_agents pa ON a.id=pa.agent_id WHERE pa.project_id=?').all(id);
    res.setHeader('Content-Disposition', `attachment; filename="project_${id}.json"`);
    res.json(project);
  } else if (type === 'chat') {
    const msgs = db.prepare("SELECT role, content, created_at FROM messages WHERE context_type=? AND context_id=? AND archived=0 ORDER BY created_at ASC").all(req.query.ctx || 'project', id);
    const md = msgs.map(m => `**[${m.role.toUpperCase()}]** (${m.created_at})\n${m.content}\n`).join('\n---\n\n');
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="chat_${id}.md"`);
    res.send(md);
  } else {
    res.status(400).json({ error: 'Invalid type' });
  }
});

// Usage stats endpoint
app.get('/api/stats/usage', (req, res) => {
  const range = req.query.range || '7d';
  const days = parseInt(range) || 7;
  try {
    const daily = db.prepare(`SELECT date(created_at) as day, model, SUM(prompt_tokens) as prompt, SUM(completion_tokens) as completion, SUM(total_tokens) as total, COUNT(*) as calls FROM usage_log WHERE created_at > datetime('now', '-${days} days') GROUP BY day, model ORDER BY day ASC`).all();
    const byAgent = db.prepare(`SELECT a.name, a.avatar_emoji, SUM(u.total_tokens) as total FROM usage_log u JOIN agents a ON u.agent_id=a.id WHERE u.created_at > datetime('now', '-${days} days') GROUP BY u.agent_id ORDER BY total DESC`).all();
    res.json({ daily, byAgent });
  } catch(e) { res.json({ daily: [], byAgent: [] }); }
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

setupWebSocket(io, db, orchestrator);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`\n  🔮 NEXUS OS running at http://${HOST}:${PORT}`);
  console.log(`  📡 WebSocket ready\n`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  scheduler.stopHeartbeat();
  server.close(() => {
    db.close();
    console.log('Database closed. Goodbye.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
