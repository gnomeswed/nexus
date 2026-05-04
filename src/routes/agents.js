const express = require('express');
const router = express.Router();

// GET /api/agents - List all agents
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const agents = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
  res.json(agents);
});

// GET /api/agents/:id - Get single agent
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  // Get assigned projects
  const projects = db.prepare(`
    SELECT p.*, pa.role_in_project
    FROM projects p
    JOIN project_agents pa ON p.id = pa.project_id
    WHERE pa.agent_id = ?
  `).all(req.params.id);

  // Get assigned tasks
  const tasks = db.prepare(`
    SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC
  `).all(req.params.id);

  agent.projects = projects;
  agent.tasks = tasks;
  res.json(agent);
});

// POST /api/agents - Create agent
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const {
    name, role, avatar_emoji, provider, model_id,
    api_key, api_endpoint, system_prompt, permissions,
    temperature, max_tokens, status
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  const stmt = db.prepare(`
    INSERT INTO agents (name, role, avatar_emoji, provider, model_id, api_key, api_endpoint, system_prompt, permissions, temperature, max_tokens, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    name,
    role || '',
    avatar_emoji || '🤖',
    provider || '9router',
    model_id || '',
    api_key || '',
    api_endpoint || '',
    system_prompt || '',
    typeof permissions === 'string' ? permissions : JSON.stringify(permissions || { file_create: true, file_edit: true, web_search: true, create_tasks: true, read_files: true, execute_commands: false }),
    temperature ?? 0.7,
    max_tokens ?? 4096,
    status || 'active'
  );

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(result.lastInsertRowid);
  req.app.locals.io.emit('agent:created', agent);
  res.status(201).json(agent);
});

// PUT /api/agents/:id - Update agent
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Agent not found' });

  const {
    name, role, avatar_emoji, provider, model_id,
    api_key, api_endpoint, system_prompt, permissions,
    temperature, max_tokens, status
  } = req.body;

  const stmt = db.prepare(`
    UPDATE agents SET
      name = ?, role = ?, avatar_emoji = ?, provider = ?, model_id = ?,
      api_key = ?, api_endpoint = ?, system_prompt = ?, permissions = ?,
      temperature = ?, max_tokens = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(
    name ?? existing.name,
    role ?? existing.role,
    avatar_emoji ?? existing.avatar_emoji,
    provider ?? existing.provider,
    model_id ?? existing.model_id,
    api_key ?? existing.api_key,
    api_endpoint ?? existing.api_endpoint,
    system_prompt ?? existing.system_prompt,
    typeof permissions === 'string' ? permissions : JSON.stringify(permissions ?? JSON.parse(existing.permissions)),
    temperature ?? existing.temperature,
    max_tokens ?? existing.max_tokens,
    status ?? existing.status,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  req.app.locals.io.emit('agent:updated', updated);
  res.json(updated);
});

// DELETE /api/agents/:id - Delete agent
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  db.prepare('DELETE FROM project_agents WHERE agent_id = ?').run(req.params.id);
  db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
  req.app.locals.io.emit('agent:deleted', { id: parseInt(req.params.id) });
  res.json({ success: true });
});

// POST /api/agents/:id/test - Test agent connection
router.post('/:id/test', async (req, res) => {
  const db = req.app.locals.db;
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  try {
    let endpoint = agent.api_endpoint || process.env.AI_ROUTER_URL || 'http://localhost:20128/v1';
    let apiKey = agent.api_key || process.env.DEFAULT_API_KEY || '';

    if (agent.provider === 'ollama') {
      endpoint = agent.api_endpoint || 'http://localhost:11434/v1';
      apiKey = 'ollama';
    } else if (agent.provider === 'custom' && agent.api_endpoint) {
      endpoint = agent.api_endpoint;
    }

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: agent.model_id || process.env.DEFAULT_MODEL || 'default',
        messages: [{ role: 'user', content: 'Respond with only: OK' }],
        max_tokens: 50,
        stream: false
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'No response';
      res.json({ success: true, message: `Connected! Model responded: "${reply}"`, model: data.model });
    } else {
      const err = await response.text();
      res.json({ success: false, message: `API returned ${response.status}: ${err}` });
    }
  } catch (error) {
    res.json({ success: false, message: `Connection failed: ${error.message}` });
  }
});

module.exports = router;
