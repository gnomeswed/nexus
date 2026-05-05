// Projects list page
const ProjectsPage = {
  async render() {
    let projects = [];
    try { projects = await API.getProjects(); } catch (e) { console.error(e); }

    return `
      <div class="page-header">
        <div>
          <h1>📁 Projetos</h1>
          <div class="subtitle">${projects.length} projeto(s)</div>
        </div>
        <button class="btn btn-primary" onclick="ProjectsPage.showCreateModal()">+ Novo Projeto</button>
      </div>
      <div class="page-body">
        ${projects.length === 0 ? `
          <div class="empty-state">
            <div class="icon">📁</div>
            <h3>Nenhum projeto ainda</h3>
            <p>Crie seu primeiro projeto e atribua agentes para começar</p>
            <button class="btn btn-primary" onclick="ProjectsPage.showCreateModal()">+ Criar Projeto</button>
          </div>
        ` : `
          <div class="grid-3">
            ${projects.map(p => {
              const taskTotal = p.taskStats?.total || 0;
              const taskDone = p.taskStats?.completed || 0;
              return `
              <div class="agent-card" onclick="App.navigate('/projects/${p.id}')">
                <div class="agent-card-header">
                  <div class="agent-avatar" style="background:var(--bg-tertiary)">📁</div>
                  <div style="flex:1;min-width:0">
                    <div class="agent-name">${escapeHtml(p.name)}</div>
                    <div class="agent-role" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.description || 'Sem descrição')}</div>
                  </div>
                  <span class="status-badge ${p.status}"><span class="dot"></span>${p.status}</span>
                </div>
                <div class="progress-bar" style="margin:12px 0 8px">
                  <div class="fill" style="width:${p.progress_percent}%"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary)">
                  <span>${p.progress_percent}% concluído</span>
                  <span>${taskDone}/${taskTotal} tarefas</span>
                </div>
                ${p.agents?.length ? `
                  <div style="display:flex;gap:4px;margin-top:10px">
                    ${p.agents.map(a => `<span title="${a.name}" style="font-size:18px">${a.avatar_emoji}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            `}).join('')}
          </div>
        `}
      </div>
    `;
  },

  async showCreateModal() {
    let agents = [];
    try { agents = await API.getAgents(); } catch (e) {}

    Modal.show(`
      <div class="modal-header">
        <h2>📁 Novo Projeto</h2>
        <button class="modal-close" onclick="Modal.close()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nome do Projeto *</label>
          <input class="form-input" id="proj-name" placeholder="Ex: E-commerce Site">
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <textarea class="form-textarea" id="proj-desc" rows="3" placeholder="Descreva o objetivo do projeto..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Pasta do Projeto</label>
          <input class="form-input" id="proj-folder" placeholder="Gerada automaticamente pelo nome">
        </div>
        <div class="form-group">
          <label class="form-label">Agentes Responsáveis</label>
          <div id="proj-agents" style="display:flex;flex-direction:column;gap:6px">
            ${agents.length === 0 ? '<div style="color:var(--text-muted);font-size:13px">Nenhum agente disponível. Crie um agente primeiro.</div>' :
              agents.map(a => `
                <div class="form-check">
                  <input type="checkbox" id="proj-agent-${a.id}" value="${a.id}">
                  <label for="proj-agent-${a.id}">${a.avatar_emoji} ${a.name} <span style="color:var(--text-muted)">(${a.role || a.provider})</span></label>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="ProjectsPage.createProject()">Criar Projeto</button>
      </div>
    `);
  },

  async createProject() {
    const name = document.getElementById('proj-name').value.trim();
    if (!name) return Toast.error('Nome é obrigatório');

    const agentCheckboxes = document.querySelectorAll('#proj-agents input[type="checkbox"]:checked');
    const agent_ids = Array.from(agentCheckboxes).map(c => parseInt(c.value));

    try {
      await API.createProject({
        name,
        description: document.getElementById('proj-desc').value,
        folder_path: document.getElementById('proj-folder').value.trim() || undefined,
        agent_ids
      });
      Modal.close();
      Toast.success('Projeto criado!');
      App.refresh();
    } catch (e) { Toast.error(e.message); }
  }
};
