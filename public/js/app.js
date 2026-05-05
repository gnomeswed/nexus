// Nexus OS - SPA Router, Shortcuts, Theme, Search, Notifications
const App = {
  currentPage: null,
  _searchDebounce: null,

  async init() {
    Socket.init();
    this.initTheme();
    this.initKeyboardShortcuts();
    this.initSidebar();
    this.initSearch();
    this.initNotifications();

    window.addEventListener('hashchange', () => this.route());
    this.route();
    this.updateCounts();

    Socket.on('agent:created', () => this.updateCounts());
    Socket.on('agent:deleted', () => this.updateCounts());
    Socket.on('project:created', () => this.updateCounts());
    Socket.on('project:deleted', () => this.updateCounts());
    Socket.on('task:created', (t) => { this.updateCounts(); this.notify(`Nova tarefa: ${t?.title || ''}`, 'info'); });
    Socket.on('task:deleted', () => this.updateCounts());
    Socket.on('task:updated', (t) => {
      if (t?.status === 'completed') this.notify(`✅ Tarefa concluída: ${t.title || ''}`, 'success');
      if (t?.status === 'review_pending') this.notify(`📋 Tarefa aguardando revisão`, 'info');
    });
    Socket.on('reminder:fire', (r) => this.notify(`⏰ ${r.title}`, 'warning'));
  },

  async route() {
    const hash = window.location.hash.slice(1) || '/';
    const container = document.getElementById('page-container');

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      const page = item.dataset.page;
      if (page === 'dashboard' && hash === '/') item.classList.add('active');
      else if (page && hash.startsWith('/' + page)) item.classList.add('active');
    });

    let html = '';
    try {
      if (hash === '/' || hash === '') {
        html = await DashboardPage.render();
      } else if (hash === '/agents') {
        html = await AgentsPage.render();
      } else if (hash.match(/^\/agents\/(\d+)$/)) {
        html = await AgentDetailPage.render(hash.match(/^\/agents\/(\d+)$/)[1]);
      } else if (hash === '/projects') {
        html = await ProjectsPage.render();
      } else if (hash.match(/^\/projects\/(\d+)$/)) {
        html = await ProjectDetailPage.render(hash.match(/^\/projects\/(\d+)$/)[1]);
      } else if (hash === '/tasks') {
        html = await TasksPage.render();
      } else if (hash.match(/^\/tasks\/(\d+)$/)) {
        html = await TaskDetailPage.render(hash.match(/^\/tasks\/(\d+)$/)[1]);
      } else if (hash === '/settings') {
        html = await SettingsPage.render();
      } else {
        html = `<div class="page-body"><div class="empty-state"><div class="icon">🔍</div><h3>Página não encontrada</h3></div></div>`;
      }
    } catch (e) {
      console.error(e);
      html = `<div class="page-body"><div class="empty-state"><div class="icon">❌</div><h3>Erro</h3><p>${e.message}</p></div></div>`;
    }

    container.innerHTML = html;

    const chatEl = document.getElementById('chat-messages') || document.getElementById('task-chat-messages');
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;

    // Close mobile sidebar on nav
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  },

  navigate(path) { window.location.hash = path; },
  refresh() { this.route(); this.updateCounts(); },

  async updateCounts() {
    try {
      const stats = await API.getStats();
      const ac = document.getElementById('agents-count');
      const pc = document.getElementById('projects-count');
      const tc = document.getElementById('tasks-count');
      if (ac) ac.textContent = stats.agents?.total || 0;
      if (pc) pc.textContent = stats.projects?.total || 0;
      if (tc) tc.textContent = stats.tasks?.pending || 0;

      // Update notification dot
      const dot = document.getElementById('notif-dot');
      if (dot && stats.alerts) {
        const hasAlerts = stats.alerts.urgentTasks > 0 || stats.alerts.reviewPending > 0 || stats.alerts.errorAgents?.length > 0;
        dot.style.display = hasAlerts ? 'block' : 'none';
      }
    } catch (e) { /* silent */ }
  },

  // Theme
  initTheme() {
    const saved = localStorage.getItem('nexus-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = saved === 'dark' ? '☀️' : '🌙';
      btn.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('nexus-theme', next);
        btn.textContent = next === 'dark' ? '☀️' : '🌙';
      };
    }
  },

  // Sidebar
  initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const collapse = document.getElementById('sidebar-collapse');
    const mobileBtn = document.getElementById('mobile-menu-btn');

    if (collapse) collapse.onclick = () => sidebar.classList.toggle('collapsed');
    if (mobileBtn) mobileBtn.onclick = () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); };
    if (overlay) overlay.onclick = () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); };

    // Restore collapsed state
    if (localStorage.getItem('nexus-sidebar') === 'collapsed') sidebar.classList.add('collapsed');
    if (collapse) collapse.addEventListener('click', () => {
      localStorage.setItem('nexus-sidebar', sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded');
    });
  },

  // Keyboard shortcuts
  initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+K - Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.openSearch();
      }
      // Ctrl+N - New task
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (typeof TasksPage !== 'undefined') TasksPage.showCreateModal();
      }
      // Ctrl+/ - Focus chat
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        const chat = document.getElementById('chat-input') || document.getElementById('task-chat-input') || document.getElementById('quick-cmd-input');
        if (chat) chat.focus();
      }
      // Escape - Close modals
      if (e.key === 'Escape') {
        this.closeSearch();
        if (typeof Modal !== 'undefined') Modal.close();
      }
    });
  },

  // Global Search
  initSearch() {
    const input = document.getElementById('global-search-input');
    const modalInput = document.getElementById('search-modal-input');
    if (input) input.addEventListener('focus', () => this.openSearch());
    if (modalInput) {
      modalInput.addEventListener('input', (e) => {
        clearTimeout(this._searchDebounce);
        this._searchDebounce = setTimeout(() => this.doSearch(e.target.value), 300);
      });
    }
  },

  openSearch() {
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('search-modal-input');
    if (overlay) overlay.classList.add('active');
    if (input) { input.value = ''; input.focus(); }
  },

  closeSearch() {
    const overlay = document.getElementById('search-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  async doSearch(query) {
    const container = document.getElementById('search-results');
    if (!container) return;
    if (!query || query.length < 2) {
      container.innerHTML = '<div class="search-empty">Digite para buscar...</div>';
      return;
    }
    try {
      const r = await API.search(query);
      let html = '';
      if (r.agents.length) {
        html += '<div class="search-group"><div class="search-group-title">🤖 Agentes</div>';
        r.agents.forEach(a => { html += `<a class="search-item" href="#/agents/${a.id}" onclick="App.closeSearch()">${a.avatar_emoji || '🤖'} ${a.name} <span>${a.role||''}</span></a>`; });
        html += '</div>';
      }
      if (r.projects.length) {
        html += '<div class="search-group"><div class="search-group-title">📁 Projetos</div>';
        r.projects.forEach(p => { html += `<a class="search-item" href="#/projects/${p.id}" onclick="App.closeSearch()">📁 ${p.name} <span class="status-badge ${p.status}">${p.status}</span></a>`; });
        html += '</div>';
      }
      if (r.tasks.length) {
        html += '<div class="search-group"><div class="search-group-title">✅ Tarefas</div>';
        r.tasks.forEach(t => { html += `<a class="search-item" href="#/tasks/${t.id}" onclick="App.closeSearch()">✅ ${t.title} <span class="priority-badge ${t.priority}">${t.priority}</span></a>`; });
        html += '</div>';
      }
      if (r.messages.length) {
        html += '<div class="search-group"><div class="search-group-title">💬 Mensagens</div>';
        r.messages.forEach(m => { html += `<a class="search-item" href="#/${m.context_type}s/${m.context_id}" onclick="App.closeSearch()">💬 ${m.content}</a>`; });
        html += '</div>';
      }
      if (!html) html = '<div class="search-empty">Nenhum resultado encontrado</div>';
      container.innerHTML = html;
    } catch(e) { container.innerHTML = '<div class="search-empty">Erro na busca</div>'; }
  },

  // Notifications
  initNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  },

  notify(message, type = 'info') {
    Toast[type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'](message);

    // Browser notification if tab not focused
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Nexus OS', { body: message, icon: '🔮' });
    }
  }
};

// Utility functions
function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date + (date.includes('Z') ? '' : 'Z'));
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

document.addEventListener('DOMContentLoaded', () => App.init());
