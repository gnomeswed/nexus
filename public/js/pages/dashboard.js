// Dashboard Page — Command Center
const DashboardPage = {
  async render() {
    let stats = {};
    try { stats = await API.getStats(); } catch(e) { console.error(e); }

    const a = stats.alerts || {};
    const t = stats.tasks || {};
    const ag = stats.agents || {};
    const tokenUsage = stats.tokenUsage || [];
    const totalTokens = stats.totalTokens || 0;

    // Build alerts
    let alertsHtml = '';
    if (a.urgentTasks > 0) alertsHtml += `<div class="alert-item alert-danger" onclick="App.navigate('/tasks')">🚨 <strong>${a.urgentTasks}</strong> tarefa(s) urgente(s) pendente(s)</div>`;
    if (a.reviewPending > 0) alertsHtml += `<div class="alert-item alert-warning" onclick="App.navigate('/tasks')">📋 <strong>${a.reviewPending}</strong> tarefa(s) aguardando revisão</div>`;
    if (a.errorAgents?.length > 0) alertsHtml += a.errorAgents.map(ag => `<div class="alert-item alert-danger" onclick="App.navigate('/agents/${ag.id}')">❌ ${ag.avatar_emoji} <strong>${ag.name}</strong> tem ${ag.error_count} erro(s)</div>`).join('');
    if (a.staleTasks?.length > 0) alertsHtml += a.staleTasks.map(st => `<div class="alert-item alert-warning" onclick="App.navigate('/tasks/${st.id}')">⏳ <strong>${st.title}</strong> parada há mais de 2h</div>`).join('');

    // Build activity feed
    const activity = (stats.recentActivity || []).filter(m => !m.content?.includes('SISTEMA (Heartbeat)')).slice(0, 12);

    // Token chart data
    const maxTokens = Math.max(...tokenUsage.map(u => u.tokens), 1);

    return `
      <div class="page-header">
        <div>
          <h1>📊 Dashboard</h1>
          <div class="subtitle">Centro de Comando — Nexus OS</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="App.refresh()">🔄 Atualizar</button>
          <button class="btn btn-primary btn-sm" onclick="TasksPage.showCreateModal()">+ Nova Tarefa</button>
        </div>
      </div>

      <div class="page-body">
        <!-- ALERTS -->
        ${alertsHtml ? `<div class="alerts-bar">${alertsHtml}</div>` : ''}

        <!-- STATS GRID -->
        <div class="stats-grid">
          <div class="stat-card" onclick="App.navigate('/agents')">
            <div class="stat-icon cyan">🤖</div>
            <div>
              <div class="stat-value">${ag.active || 0}<span class="stat-sub">/${ag.total || 0}</span></div>
              <div class="stat-label">Agentes Ativos</div>
            </div>
          </div>
          <div class="stat-card" onclick="App.navigate('/projects')">
            <div class="stat-icon green">📁</div>
            <div>
              <div class="stat-value">${stats.projects?.active || 0}</div>
              <div class="stat-label">Projetos em Andamento</div>
            </div>
          </div>
          <div class="stat-card" onclick="App.navigate('/tasks')">
            <div class="stat-icon yellow">✅</div>
            <div>
              <div class="stat-value">${t.pending || 0}</div>
              <div class="stat-label">Tarefas Pendentes</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon purple">🪙</div>
            <div>
              <div class="stat-value">${totalTokens > 1000000 ? (totalTokens/1000000).toFixed(1) + 'M' : totalTokens > 1000 ? (totalTokens/1000).toFixed(1) + 'K' : totalTokens}</div>
              <div class="stat-label">Tokens Usados (Total)</div>
            </div>
          </div>
        </div>

        <!-- QUICK COMMAND -->
        <div class="card quick-cmd-card">
          <div class="quick-cmd-header">
            <span>⚡ Comando Rápido</span>
            <select class="form-select quick-cmd-agent" id="quick-cmd-agent" style="width:200px;padding:6px 10px;font-size:13px">
              ${(ag.list || []).filter(a => a.status === 'active').map(a => `<option value="${a.id}">${a.avatar_emoji} ${a.name}</option>`).join('') || '<option value="">Nenhum agente</option>'}
            </select>
          </div>
          <div class="quick-cmd-input-row">
            <input type="text" id="quick-cmd-input" class="form-input" placeholder="Ex: Crie um script de backup para o banco de dados..." style="border-radius:24px">
            <button class="btn btn-primary" onclick="DashboardPage.sendQuickCommand()" style="border-radius:24px;padding:10px 24px">Enviar ➤</button>
          </div>
        </div>

        <div class="grid-2 dashboard-grid">
          <!-- AGENT STATUS -->
          <div class="card">
            <h3 class="card-title">🤖 Status dos Agentes</h3>
            <div class="agent-status-list">
              ${(ag.list || []).length === 0 ? '<div class="empty-state" style="padding:20px"><div class="icon" style="font-size:32px">🤖</div><p>Nenhum agente cadastrado</p><button class="btn btn-primary btn-sm" onclick="AgentsPage.showCreateModal()">Criar Agente</button></div>' :
                (ag.list || []).map(a => `
                  <div class="agent-status-item" onclick="App.navigate('/agents/${a.id}')">
                    <span class="agent-avatar" style="width:36px;height:36px;font-size:18px">${a.avatar_emoji || '🤖'}</span>
                    <div class="agent-status-info">
                      <div class="agent-name" style="font-size:14px">${a.name}</div>
                      <div style="font-size:11px;color:var(--text-muted)">${a.role || 'Sem cargo'} · ${a.active_tasks || 0} tarefa(s)</div>
                    </div>
                    <span class="status-badge ${a.status}"><span class="dot"></span>${a.status === 'active' ? 'Online' : a.status}</span>
                    ${a.error_count > 0 ? `<span class="priority-badge urgent" style="margin-left:4px">${a.error_count} ❌</span>` : ''}
                  </div>
                `).join('')}
            </div>
          </div>

          <!-- TOKEN USAGE CHART -->
          <div class="card">
            <h3 class="card-title">📈 Uso de Tokens (7 dias)</h3>
            ${tokenUsage.length === 0 ? '<div class="empty-state" style="padding:20px"><div class="icon" style="font-size:32px">📈</div><p>Sem dados de uso ainda</p></div>' : `
              <div class="token-chart">
                ${tokenUsage.map(u => `
                  <div class="token-bar-group">
                    <div class="token-bar" style="height:${Math.max(8, (u.tokens / maxTokens) * 100)}%"
                         title="${u.tokens.toLocaleString()} tokens · ${u.calls} chamadas">
                    </div>
                    <div class="token-bar-label">${u.day.split('-').slice(1).join('/')}</div>
                  </div>
                `).join('')}
              </div>
              <div style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:8px">
                ${tokenUsage.reduce((s,u)=>s+u.tokens,0).toLocaleString()} tokens esta semana · ${tokenUsage.reduce((s,u)=>s+u.calls,0)} chamadas
              </div>
            `}
          </div>
        </div>

        <!-- ACTIVITY FEED -->
        <div class="card" style="margin-top:16px">
          <h3 class="card-title">⏱️ Atividade Recente</h3>
          <div class="activity-list">
            ${activity.length === 0 ? '<div class="empty-state" style="padding:20px"><p>Nenhuma atividade ainda</p></div>' :
              activity.map(m => `
                <div class="activity-item" onclick="${m.context_type ? `App.navigate('/${m.context_type}s/${m.context_id}')` : ''}">
                  <span class="emoji">${m.role === 'user' ? '👤' : m.agent_emoji || '🤖'}</span>
                  <div class="text">
                    <span style="font-weight:500">${m.role === 'user' ? 'Você' : (m.agent_name || 'Sistema')}</span>
                    <span style="opacity:0.7"> — ${truncate(m.content?.replace(/\n/g, ' '), 80)}</span>
                  </div>
                  <div class="time">${timeAgo(m.created_at)}</div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  async sendQuickCommand() {
    const input = document.getElementById('quick-cmd-input');
    const agentSelect = document.getElementById('quick-cmd-agent');
    if (!input || !input.value.trim()) return Toast.warning('Digite um comando');
    const agentId = agentSelect?.value;
    if (!agentId) return Toast.error('Selecione um agente');

    const msg = input.value.trim();
    input.value = '';
    input.disabled = true;
    Toast.info('Enviando comando para o agente...');

    try {
      await API.sendAIChat('agent', parseInt(agentId), msg, parseInt(agentId));
      Toast.success('Comando enviado! Verifique o chat do agente.');
      input.disabled = false;
    } catch(e) {
      Toast.error('Erro: ' + e.message);
      input.disabled = false;
    }
  }
};
