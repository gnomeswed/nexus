// API Client for Nexus OS
const API = {
  base: '/api',

  async request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },

  // Stats
  getStats() { return this.request('GET', '/stats'); },

  // Agents
  getAgents() { return this.request('GET', '/agents'); },
  getAgent(id) { return this.request('GET', `/agents/${id}`); },
  createAgent(data) { return this.request('POST', '/agents', data); },
  updateAgent(id, data) { return this.request('PUT', `/agents/${id}`, data); },
  deleteAgent(id) { return this.request('DELETE', `/agents/${id}`); },
  testAgent(id) { return this.request('POST', `/agents/${id}/test`); },

  // Projects
  getProjects() { return this.request('GET', '/projects'); },
  getProject(id) { return this.request('GET', `/projects/${id}`); },
  createProject(data) { return this.request('POST', '/projects', data); },
  updateProject(id, data) { return this.request('PUT', `/projects/${id}`, data); },
  deleteProject(id) { return this.request('DELETE', `/projects/${id}`); },

  // Tasks
  getTasks(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request('GET', `/tasks${params ? '?' + params : ''}`);
  },
  getTask(id) { return this.request('GET', `/tasks/${id}`); },
  createTask(data) { return this.request('POST', '/tasks', data); },
  updateTask(id, data) { return this.request('PUT', `/tasks/${id}`, data); },
  deleteTask(id) { return this.request('DELETE', `/tasks/${id}`); },

  // Chat
  getMessages(type, id) { return this.request('GET', `/chat/${type}/${id}`); },
  sendMessage(type, id, data) { return this.request('POST', `/chat/${type}/${id}`, data); },

  // AI Chat (triggers real AI response)
  sendAIChat(contextType, contextId, message, agentId = null) {
    return this.request('POST', '/ai/chat', {
      context_type: contextType,
      context_id: contextId,
      message,
      agent_id: agentId
    });
  },

  // Settings
  getSettings() { return this.request('GET', '/settings'); },
  updateSettings(data) { return this.request('POST', '/settings', data); },
  testSettings() { return this.request('POST', '/settings/test'); }
};
