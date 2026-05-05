const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');

// Parse .env — returns map of key->value, preserving line order
function parseEnvLines() {
  if (!fs.existsSync(envPath)) return [];
  return fs.readFileSync(envPath, 'utf8').split('\n');
}

function parseEnv() {
  const env = {};
  parseEnvLines().forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2];
  });
  return env;
}

// Write .env preserving comments and blank lines
function writeEnv(updates) {
  const lines = parseEnvLines();
  const updated = new Set();

  const newLines = lines.map(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (match && updates[match[1]] !== undefined) {
      updated.add(match[1]);
      return `${match[1]}=${updates[match[1]]}`;
    }
    return line;
  });

  // Append any new keys not already in file
  for (const [key, value] of Object.entries(updates)) {
    if (!updated.has(key)) newLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
}

router.get('/', (req, res) => {
  const env = parseEnv();
  res.json({
    ai_router_url: process.env.AI_ROUTER_URL || env.AI_ROUTER_URL || 'http://localhost:20128/v1',
    projects_root: process.env.PROJECTS_ROOT || env.PROJECTS_ROOT || './projects',
    default_model: process.env.DEFAULT_MODEL || env.DEFAULT_MODEL || 'combo',
    nexus_pin: process.env.NEXUS_PIN || env.NEXUS_PIN || '1234',
    version: '1.4.2'
  });
});

router.post('/', (req, res) => {
  const { ai_router_url, projects_root, default_model, nexus_pin } = req.body;

  const updates = {};
  if (ai_router_url) {
    updates.AI_ROUTER_URL = ai_router_url;
    process.env.AI_ROUTER_URL = ai_router_url;
  }
  if (projects_root) {
    updates.PROJECTS_ROOT = projects_root;
    process.env.PROJECTS_ROOT = projects_root;
    req.app.locals.projectsRoot = path.resolve(projects_root);
  }
  if (default_model) {
    updates.DEFAULT_MODEL = default_model;
    process.env.DEFAULT_MODEL = default_model;
  }
  if (nexus_pin) {
    updates.NEXUS_PIN = nexus_pin;
    process.env.NEXUS_PIN = nexus_pin;
  }
  if (Object.keys(updates).length > 0) writeEnv(updates);

  res.json({ success: true });
});

router.post('/test', async (req, res) => {
  try {
    const endpoint = process.env.AI_ROUTER_URL || 'http://localhost:20128/v1';
    const apiKey = process.env.DEFAULT_API_KEY || 'nexus-os';
    const model = process.env.DEFAULT_MODEL || 'default';

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Respond with only: OK' }],
        max_tokens: 50,
        stream: false
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'No response';
      res.json({ success: true, message: `✅ Conectado ao 9Router! Modelo: ${data.model || model} → "${reply}"` });
    } else {
      const err = await response.text();
      res.json({ success: false, message: `❌ API retornou ${response.status}: ${err}` });
    }
  } catch (error) {
    res.json({ success: false, message: `❌ Falha na conexão: ${error.message}` });
  }
});

router.get('/failures', (req, res) => {
  try {
    const db = req.app.locals.db;
    const stats = db.prepare(`
      SELECT model, count(*) as count, max(created_at) as last_failure 
      FROM ai_failures 
      GROUP BY model 
      ORDER BY count DESC
    `).all();
    
    const recent = db.prepare(`
      SELECT f.*, a.name as agent_name, a.avatar_emoji as agent_emoji
      FROM ai_failures f
      LEFT JOIN agents a ON f.agent_id = a.id
      ORDER BY f.created_at DESC LIMIT 20
    `).all();
    
    res.json({ stats, recent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/failures/clear', (req, res) => {
  try {
    const db = req.app.locals.db;
    db.prepare('DELETE FROM ai_failures').run();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
