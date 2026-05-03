const express = require('express');
const router = express.Router();

// GET /api/chat/:contextType/:contextId - Get messages
router.get('/:contextType/:contextId', (req, res) => {
  const db = req.app.locals.db;
  const { contextType, contextId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const messages = db.prepare(`
    SELECT m.*, a.name as agent_name, a.avatar_emoji as agent_emoji
    FROM messages m
    LEFT JOIN agents a ON m.agent_id = a.id
    WHERE m.context_type = ? AND m.context_id = ?
    ORDER BY m.created_at ASC
    LIMIT ? OFFSET ?
  `).all(contextType, contextId, parseInt(limit), parseInt(offset));

  res.json(messages);
});

// POST /api/chat/:contextType/:contextId - Send message (REST fallback)
router.post('/:contextType/:contextId', (req, res) => {
  const db = req.app.locals.db;
  const { contextType, contextId } = req.params;
  const { content, agent_id, role } = req.body;

  if (!content) return res.status(400).json({ error: 'Content is required' });

  const result = db.prepare(`
    INSERT INTO messages (context_type, context_id, agent_id, role, content)
    VALUES (?, ?, ?, ?, ?)
  `).run(contextType, parseInt(contextId), agent_id || null, role || 'user', content);

  const message = db.prepare(`
    SELECT m.*, a.name as agent_name, a.avatar_emoji as agent_emoji
    FROM messages m
    LEFT JOIN agents a ON m.agent_id = a.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  req.app.locals.io.emit('chat:message', message);
  res.status(201).json(message);
});

// DELETE /api/chat/:contextType/:contextId - Clear chat
router.delete('/:contextType/:contextId', (req, res) => {
  const db = req.app.locals.db;
  const { contextType, contextId } = req.params;
  db.prepare('DELETE FROM messages WHERE context_type = ? AND context_id = ?').run(contextType, parseInt(contextId));
  res.json({ success: true });
});

module.exports = router;
