// Nexus OS - SPA Router & App Controller
const App = {
  currentPage: null,

  async init() {
    Socket.init();
    window.addEventListener('hashchange', () => this.route());
    this.route();
    this.updateCounts();

    // Listen for real-time updates
    Socket.on('agent:created', () => this.updateCounts());
    Socket.on('agent:deleted', () => this.updateCounts());
    Socket.on('project:created', () => this.updateCounts());
    Socket.on('project:deleted', () => this.updateCounts());
    Socket.on('task:created', () => this.updateCounts());
    Socket.on('task:deleted', () => this.updateCounts());
  },

  async route() {
    const hash = window.location.hash.slice(1) || '/';
    const container = document.getElementById('page-container');

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      const page = item.dataset.page;
      if (page === 'dashboard' && hash === '/') item.classList.add('active');
      else if (page && hash.startsWith('/' + page)) item.classList.add('active');
    });

    // Route to page
    let html = '';
    try {
      if (hash === '/' || hash === '') {
        html = await DashboardPage.render();
      } else if (hash === '/agents') {
        html = await AgentsPage.render();
      } else if (hash.match(/^\/agents\/(\d+)$/)) {
        const id = hash.match(/^\/agents\/(\d+)$/)[1];
        html = await AgentDetailPage.render(id);
      } else if (hash === '/projects') {
        html = await ProjectsPage.render();
      } else if (hash.match(/^\/projects\/(\d+)$/)) {
        const id = hash.match(/^\/projects\/(\d+)$/)[1];
        html = await ProjectDetailPage.render(id);
      } else if (hash === '/tasks') {
        html = await TasksPage.render();
      } else if (hash.match(/^\/tasks\/(\d+)$/)) {
        const id = hash.match(/^\/tasks\/(\d+)$/)[1];
        html = await TaskDetailPage.render(id);
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

    // Scroll chat to bottom
    const chatEl = document.getElementById('chat-messages') || document.getElementById('task-chat-messages');
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
  },

  navigate(path) {
    window.location.hash = path;
  },

  refresh() {
    this.route();
    this.updateCounts();
  },

  async updateCounts() {
    try {
      const stats = await API.getStats();
      const ac = document.getElementById('agents-count');
      const pc = document.getElementById('projects-count');
      const tc = document.getElementById('tasks-count');
      if (ac) ac.textContent = stats.agents.total;
      if (pc) pc.textContent = stats.projects.total;
      if (tc) tc.textContent = stats.tasks.pending;
    } catch (e) { /* silent */ }
  }
};

// Start app
document.addEventListener('DOMContentLoaded', () => App.init());
