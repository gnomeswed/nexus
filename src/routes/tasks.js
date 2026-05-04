const express = require('express');
const router = express.Router();
const orchestrator = require('../services/orchestrator');

// GET /api/tasks - List all tasks (with optional filters)
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { project_id, agent_id, status, priority } = req.query;

  let query = `
    SELECT t.*, a.name as agent_name, a.avatar_emoji as agent_emoji,
           p.name as project_name
    FROM tasks t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (project_id) { query += ' AND t.project_id = ?'; params.push(project_id); }
  if (agent_id) { query += ' AND t.agent_id = ?'; params.push(agent_id); }
  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority); }

  query += ' ORDER BY t.created_at DESC';

  const tasks = db.prepare(query).all(...params);
  res.json(tasks);
});

// GET /api/tasks/:id - Get single task
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const task = db.prepare(`
    SELECT t.*, a.name as agent_name, a.avatar_emoji as agent_emoji,
           p.name as project_name
    FROM tasks t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Messages for this task
  task.messages = db.prepare(`
    SELECT m.*, a.name as agent_name, a.avatar_emoji as agent_emoji
    FROM messages m
    LEFT JOIN agents a ON m.agent_id = a.id
    WHERE m.context_type = 'task' AND m.context_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.id);

  res.json(task);
});

// POST /api/tasks - Create task
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { project_id, agent_id, title, description, status, priority, checklist, due_date } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required' });

  const result = db.prepare(`
    INSERT INTO tasks (project_id, agent_id, title, description, status, priority, checklist, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    project_id || null,
    agent_id || null,
    title,
    description || '',
    status || 'pending',
    priority || 'medium',
    typeof checklist === 'string' ? checklist : JSON.stringify(checklist || []),
    due_date || null
  );

  const task = db.prepare(`
    SELECT t.*, a.name as agent_name, a.avatar_emoji as agent_emoji,
           p.name as project_name
    FROM tasks t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  req.app.locals.io.emit('task:created', task);
  res.status(201).json(task);

  // Auto-trigger agent if task is assigned
  if (task.agent_id) {
    setTimeout(() => {
      orchestrator.processMessage('task', task.id, "Você recebeu uma nova tarefa. Analise a descrição, mude o status para 'in_progress' usando 'update_task_status' e comece o trabalho.", task.agent_id).catch(console.error);
    }, 1000);
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const { project_id, agent_id, title, description, status, priority, checklist, due_date } = req.body;

  db.prepare(`
    UPDATE tasks SET
      project_id = ?, agent_id = ?, title = ?, description = ?,
      status = ?, priority = ?, checklist = ?, due_date = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    project_id !== undefined ? project_id : existing.project_id,
    agent_id !== undefined ? agent_id : existing.agent_id,
    title ?? existing.title,
    description ?? existing.description,
    status ?? existing.status,
    priority ?? existing.priority,
    typeof checklist === 'string' ? checklist : JSON.stringify(checklist ?? JSON.parse(existing.checklist || '[]')),
    due_date !== undefined ? due_date : existing.due_date,
    req.params.id
  );

  const task = db.prepare(`
    SELECT t.*, a.name as agent_name, a.avatar_emoji as agent_emoji,
           p.name as project_name
    FROM tasks t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(req.params.id);

  // Update project progress if task belongs to a project
  if (task.project_id) {
    updateProjectProgress(db, task.project_id);
  }

  req.app.locals.io.emit('task:updated', task);
  res.json(task);

  // Auto-trigger agent if status was changed to in_progress manually
  if (status === 'in_progress' && existing.status !== 'in_progress' && task.agent_id) {
    setTimeout(() => {
      orchestrator.processMessage('task', task.id, "A tarefa foi movida para In Progress. Por favor, leia a descrição e comece o trabalho agora.", task.agent_id).catch(console.error);
    }, 1000);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM messages WHERE context_type = ? AND context_id = ?').run('task', req.params.id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);

  if (task.project_id) {
    updateProjectProgress(db, task.project_id);
  }

  req.app.locals.io.emit('task:deleted', { id: parseInt(req.params.id) });
  res.json({ success: true });
});

// Helper: recalculate project progress
function updateProjectProgress(db, projectId) {
  const stats = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM tasks WHERE project_id = ?
  `).get(projectId);

  const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  db.prepare('UPDATE projects SET progress_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(progress, projectId);
}

module.exports = router;
