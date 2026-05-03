// Dashboard page
const DashboardPage = {
  async render() {
    let stats = { agents: { total: 0, active: 0 }, projects: { total: 0, active: 0 }, tasks: { total: 0, pending: 0, completed: 0 }, recentActivity: [] };
    try { stats = await API.getStats(); } catch (e) { console.error(e); }

    return `
      <div class="page-header">
        <div>
          <h1>📊 Dashboard</h1>
          <div class="subtitle">Visão geral do Nexus OS</div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('/agents')">🤖 Novo Agente</button>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('/projects')">📁 Novo Projeto</button>
        </div>
      </div>
      <div class="page-body">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon purple">🤖</div>
            <div>
              <div class="stat-value">${stats.agents.active}</div>
              <div class="stat-label">Agentes Ativos</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon cyan">📁</div>
            <div>
              <div class="stat-value">${stats.projects.active}</div>
              <div class="stat-label">Projetos Ativos</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon yellow">⏳</div>
            <div>
              <div class="stat-value">${stats.tasks.pending}</div>
              <div class="stat-label">Tarefas Pendentes</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green">✅</div>
            <div>
              <div class="stat-value">${stats.tasks.completed}</div>
              <div class="stat-label">Tarefas Concluídas</div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <h3 style="margin-bottom:16px;font-size:16px;">⚡ Atividade Recente</h3>
            ${stats.recentActivity.length === 0 ? `
              <div style="padding:20px;text-align:center;color:var(--text-muted)">
                Nenhuma atividade ainda
              </div>
            ` : `
              <div class="activity-list">
                ${stats.recentActivity.slice(0, 8).map(a => `
                  <div class="activity-item">
                    <span class="emoji">${a.agent_emoji || '👤'}</span>
                    <span class="text">${a.agent_name || 'Você'}: ${truncate(a.content, 60)}</span>
                    <span class="time">${timeAgo(a.created_at)}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          <div class="card">
            <h3 style="margin-bottom:16px;font-size:16px;">🚀 Ações Rápidas</h3>
            <div style="display:flex;flex-direction:column;gap:8px">
              <button class="btn btn-secondary" onclick="AgentsPage.showCreateModal()" style="justify-content:flex-start">
                🤖 Criar Novo Agente
              </button>
              <button class="btn btn-secondary" onclick="ProjectsPage.showCreateModal()" style="justify-content:flex-start">
                📁 Criar Novo Projeto
              </button>
              <button class="btn btn-secondary" onclick="TasksPage.showCreateModal()" style="justify-content:flex-start">
                ✅ Criar Nova Tarefa
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date + 'Z');
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
