// API Client for Nexus OS (with cache layer)
const API = {
  base: '/api',
  _cache: new Map(),
  _cacheTTL: 30000, // 30 seconds

  async request(method, path, body = null) {
    const pin = localStorage.getItem('nexus_pin');
    const opts = { 
      method, 
      headers: { 
        'Content-Type': 'application/json',
        'x-nexus-pin': pin || ''
      } 
    };
    if (body) opts.body = JSON.stringify(body);
    
    try {
      const res = await fetch(this.base + path, opts);
      if (res.status === 401) {
        if (!window._nexus_pin_prompting) {
          window._nexus_pin_prompting = true;
          if (typeof App !== 'undefined' && App.showPinScreen) {
            App.showPinScreen();
          }
        }
        throw new Error('PIN Required');
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
      }
      return res.json();
    } catch (e) {
      if (e.message === 'PIN Required') throw e;
      throw e;
    }
  },

  async cached(key, fetcher) {
    const entry = this._cache.get(key);
    if (entry && Date.now() - entry.ts < this._cacheTTL) return entry.data;
    const data = await fetcher();
    this._cache.set(key, { data, ts: Date.now() });
    return data;
  },

  invalidate(prefix) {
    for (const key of this._cache.keys()) {
      if (key.startsWith(prefix)) this._cache.delete(key);
    }
  },

  // Stats
  getStats() { return this.request('GET', '/stats'); },

  // Agents
  getAgents() { return this.cached('agents', () => this.request('GET', '/agents')); },
  getAgent(id) { return this.request('GET', `/agents/${id}`); },
  createAgent(data) { this.invalidate('agents'); return this.request('POST', '/agents', data); },
  updateAgent(id, data) { this.invalidate('agents'); return this.request('PUT', `/agents/${id}`, data); },
  deleteAgent(id) { this.invalidate('agents'); return this.request('DELETE', `/agents/${id}`); },
  testAgent(id) { return this.request('POST', `/agents/${id}/test`); },

  // Projects
  getProjects() { return this.cached('projects', () => this.request('GET', '/projects')); },
  getProject(id) { return this.request('GET', `/projects/${id}`); },
  createProject(data) { this.invalidate('projects'); return this.request('POST', '/projects', data); },
  updateProject(id, data) { this.invalidate('projects'); return this.request('PUT', `/projects/${id}`, data); },
  deleteProject(id) { this.invalidate('projects'); return this.request('DELETE', `/projects/${id}`); },

  // Tasks
  getTasks(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request('GET', `/tasks${params ? '?' + params : ''}`);
  },
  getTask(id) { return this.request('GET', `/tasks/${id}`); },
  createTask(data) { this.invalidate('tasks'); return this.request('POST', '/tasks', data); },
  updateTask(id, data) { this.invalidate('tasks'); return this.request('PUT', `/tasks/${id}`, data); },
  deleteTask(id) { this.invalidate('tasks'); return this.request('DELETE', `/tasks/${id}`); },

  // Chat
  getMessages(type, id) { return this.request('GET', `/chat/${type}/${id}`); },
  sendMessage(type, id, data) { return this.request('POST', `/chat/${type}/${id}`, data); },
  deleteChat(type, id) { return this.request('DELETE', `/chat/${type}/${id}`); },

  // AI Chat
  sendAIChat(contextType, contextId, message, agentId = null) {
    return this.request('POST', '/ai/chat', { context_type: contextType, context_id: contextId, message, agent_id: agentId });
  },

  // Settings
  getSettings() { return this.request('GET', '/settings'); },
  updateSettings(data) { return this.request('POST', '/settings', data); },
  testSettings() { return this.request('POST', '/settings/test'); },

  // Search
  search(query) { return this.request('GET', `/search?q=${encodeURIComponent(query)}`); },

  // Usage
  getUsage(range = '7d') { return this.request('GET', `/stats/usage?range=${range}`); },

  // Export
  exportProject(id) { window.open(`${this.base}/export/project/${id}`, '_blank'); },
  exportChat(type, id) { window.open(`${this.base}/export/chat/${id}?ctx=${type}`, '_blank'); }
};
