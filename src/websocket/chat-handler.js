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

    // Send message via WebSocket — orchestrator handles save + AI response
    // FIX: Removed duplicate user message save. orchestrator.processMessage() 
    // already saves and broadcasts the user message at its start.
    socket.on('chat:send', async (data) => {
      const { contextType, contextId, content, agent_id } = data;
      if (!content || !contextType || !contextId) return;

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
