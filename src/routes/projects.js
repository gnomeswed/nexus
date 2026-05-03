const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// GET /api/projects - List all projects
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();

  // Attach agents for each project
  const stmtAgents = db.prepare(`
    SELECT a.*, pa.role_in_project
    FROM agents a
    JOIN project_agents pa ON a.id = pa.agent_id
    WHERE pa.project_id = ?
  `);

  const stmtTaskCount = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM tasks WHERE project_id = ?
  `);

  projects.forEach(p => {
    p.agents = stmtAgents.all(p.id);
    p.taskStats = stmtTaskCount.get(p.id);
  });

  res.json(projects);
});

// GET /api/projects/:id - Get single project
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Agents
  project.agents = db.prepare(`
    SELECT a.*, pa.role_in_project
    FROM agents a
    JOIN project_agents pa ON a.id = pa.agent_id
    WHERE pa.project_id = ?
  `).all(req.params.id);

  // Tasks
  project.tasks = db.prepare(`
    SELECT t.*, a.name as agent_name, a.avatar_emoji as agent_emoji
    FROM tasks t
    LEFT JOIN agents a ON t.agent_id = a.id
    WHERE t.project_id = ?
    ORDER BY t.created_at DESC
  `).all(req.params.id);

  // Recent messages
  project.messages = db.prepare(`
    SELECT m.*, a.name as agent_name, a.avatar_emoji as agent_emoji
    FROM messages m
    LEFT JOIN agents a ON m.agent_id = a.id
    WHERE m.context_type = 'project' AND m.context_id = ?
    ORDER BY m.created_at DESC LIMIT 50
  `).all(req.params.id);

  // Files in project folder
  project.files = [];
  if (project.folder_path) {
    const fullPath = path.resolve(req.app.locals.projectsRoot, project.folder_path);
    if (fs.existsSync(fullPath)) {
      project.files = listFilesRecursive(fullPath, fullPath);
    }
  }

  res.json(project);
});

// POST /api/projects - Create project
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { name, description, status, folder_path, roadmap, agent_ids } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  // Create folder
  const folderName = folder_path || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const fullPath = path.resolve(req.app.locals.projectsRoot, folderName);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }

  const stmt = db.prepare(`
    INSERT INTO projects (name, description, status, folder_path, roadmap)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    name,
    description || '',
    status || 'planning',
    folderName,
    typeof roadmap === 'string' ? roadmap : JSON.stringify(roadmap || [])
  );

  const projectId = result.lastInsertRowid;

  // Assign agents
  if (agent_ids && agent_ids.length > 0) {
    const assignStmt = db.prepare('INSERT OR IGNORE INTO project_agents (project_id, agent_id, role_in_project) VALUES (?, ?, ?)');
    agent_ids.forEach((agentId, index) => {
      assignStmt.run(projectId, agentId, index === 0 ? 'lead' : 'collaborator');
    });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  project.agents = db.prepare(`
    SELECT a.*, pa.role_in_project FROM agents a
    JOIN project_agents pa ON a.id = pa.agent_id
    WHERE pa.project_id = ?
  `).all(projectId);

  req.app.locals.io.emit('project:created', project);
  res.status(201).json(project);
});

// PUT /api/projects/:id - Update project
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const { name, description, status, roadmap, progress_percent, agent_ids } = req.body;

  db.prepare(`
    UPDATE projects SET
      name = ?, description = ?, status = ?, roadmap = ?,
      progress_percent = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name ?? existing.name,
    description ?? existing.description,
    status ?? existing.status,
    typeof roadmap === 'string' ? roadmap : JSON.stringify(roadmap ?? JSON.parse(existing.roadmap || '[]')),
    progress_percent ?? existing.progress_percent,
    req.params.id
  );

  // Update agent assignments if provided
  if (agent_ids) {
    db.prepare('DELETE FROM project_agents WHERE project_id = ?').run(req.params.id);
    const assignStmt = db.prepare('INSERT INTO project_agents (project_id, agent_id, role_in_project) VALUES (?, ?, ?)');
    agent_ids.forEach((agentId, index) => {
      assignStmt.run(req.params.id, agentId, index === 0 ? 'lead' : 'collaborator');
    });
  }

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  updated.agents = db.prepare(`
    SELECT a.*, pa.role_in_project FROM agents a
    JOIN project_agents pa ON a.id = pa.agent_id
    WHERE pa.project_id = ?
  `).all(req.params.id);

  req.app.locals.io.emit('project:updated', updated);
  res.json(updated);
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.prepare('DELETE FROM project_agents WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM messages WHERE context_type = ? AND context_id = ?').run('project', req.params.id);
  db.prepare('DELETE FROM tasks WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

  req.app.locals.io.emit('project:deleted', { id: parseInt(req.params.id) });
  res.json({ success: true });
});

// Helper: list files recursively
function listFilesRecursive(dir, baseDir) {
  const results = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      if (stat.isDirectory()) {
        results.push({ path: rel, type: 'directory', size: 0 });
        results.push(...listFilesRecursive(full, baseDir));
      } else {
        results.push({ path: rel, type: 'file', size: stat.size });
      }
    }
  } catch (e) { /* ignore permission errors */ }
  return results;
}

module.exports = router;
