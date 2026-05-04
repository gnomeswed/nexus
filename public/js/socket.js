// WebSocket client
const Socket = {
  io: null,

  init() {
    this.io = io();
    this.io.on('connect', () => console.log('🔌 WebSocket connected'));
    this.io.on('disconnect', () => console.log('🔌 WebSocket disconnected'));
  },

  on(event, callback) {
    if (this.io) this.io.on(event, callback);
  },

  off(event) {
    if (this.io) this.io.off(event);
  },

  emit(event, data) {
    if (this.io) this.io.emit(event, data);
  },

  joinRoom(contextType, contextId) {
    this.emit('join', { contextType, contextId });
  },

  leaveRoom(contextType, contextId) {
    this.emit('leave', { contextType, contextId });
  },

  sendMessage(contextType, contextId, content) {
    this.emit('chat:send', { contextType, contextId, content, role: 'user' });
  }
};
