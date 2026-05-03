function setupWebSocket(io, db, orchestrator) {
  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Join a context room (project or task chat)
    socket.on('join', ({ contextType, contextId }) => {
      const room = `${contextType}:${contextId}`;
      socket.join(room);
      console.log(`📡 ${socket.id} joined ${room}`);
    });

    socket.on('leave', ({ contextType, contextId }) => {
      const room = `${contextType}:${contextId}`;
      socket.leave(room);
    });

    // Send message via WebSocket — saves user msg then triggers AI
    socket.on('chat:send', async (data) => {
      const { contextType, contextId, content, agent_id } = data;
      if (!content || !contextType || !contextId) return;

      // Save user message
      const result = db.prepare(`
        INSERT INTO messages (context_type, context_id, agent_id, role, content)
        VALUES (?, ?, ?, 'user', ?)
      `).run(contextType, parseInt(contextId), null, content);

      const userMsg = db.prepare(`
        SELECT m.*, a.name as agent_name, a.avatar_emoji as agent_emoji
        FROM messages m
        LEFT JOIN agents a ON m.agent_id = a.id
        WHERE m.id = ?
      `).get(result.lastInsertRowid);

      const room = `${contextType}:${contextId}`;
      io.to(room).emit('chat:message', userMsg);

      // Trigger AI response via orchestrator (if available)
      if (orchestrator) {
        try {
          await orchestrator.processMessage(contextType, parseInt(contextId), content, agent_id || null);
        } catch (err) {
          console.error('Orchestrator error:', err.message);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);
    });
  });
}

module.exports = { setupWebSocket };

