// Tasks list page
const TasksPage = {
  async render() {
    let tasks = [];
    try { tasks = await API.getTasks(); } catch (e) { console.error(e); }

    return `
      <div class="page-header">
        <div>
          <h1>✅ Tarefas</h1>
          <div class="subtitle">${tasks.length} tarefa(s)</div>
        </div>
        <button class="btn btn-primary" onclick="TasksPage.showCreateModal()">+ Nova Tarefa</button>
      </div>
      <div class="page-body">
        ${tasks.length === 0 ? `
          <div class="empty-state">
            <div class="icon">✅</div>
            <h3>Nenhuma tarefa</h3>
            <p>Crie tarefas manuais ou deixe os agentes criarem automaticamente</p>
            <button class="btn btn-primary" onclick="TasksPage.showCreateModal()">+ Criar Tarefa</button>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:4px">
            ${tasks.map(t => `
              <div class="activity-item" style="cursor:pointer" onclick="App.navigate('/tasks/${t.id}')">
                <span class="emoji">${t.agent_emoji || '✅'}</span>
                <div style="flex:1">
                  <div style="font-size:14px;font-weight:500">${t.title}</div>
                  <div style="font-size:12px;color:var(--text-muted)">
                    ${t.project_name ? '📁 ' + t.project_name + ' · ' : ''}${t.agent_name || 'Sem agente'}
                  </div>
                </div>
                <span class="priority-badge ${t.priority}">${t.priority}</span>
                <span class="status-badge ${t.status}">${t.status}</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  async showCreateModal(projectId) {
    let agents = [], projects = [];
    try { agents = await API.getAgents(); projects = await API.getProjects(); } catch (e) {}

    Modal.show(`
      <div class="modal-header"><h2>✅ Nova Tarefa</h2><button class="modal-close" onclick="Modal.close()">×</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Título *</label>
          <input class="form-input" id="task-title" placeholder="Ex: Criar homepage">
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <textarea class="form-textarea" id="task-desc" rows="3"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Projeto</label>
            <select class="form-select" id="task-project">
              <option value="">Tarefa avulsa</option>
              ${projects.map(p => `<option value="${p.id}" ${p.id == projectId ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Agente Responsável</label>
            <select class="form-select" id="task-agent">
              <option value="">Sem agente</option>
              ${agents.map(a => `<option value="${a.id}">${a.avatar_emoji} ${a.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Prioridade</label>
            <select class="form-select" id="task-priority">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Prazo</label>
            <input class="form-input" id="task-due" type="date">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="TasksPage.createTask()">Criar Tarefa</button>
      </div>
    `);
  },

  async createTask() {
    const title = document.getElementById('task-title').value.trim();
    if (!title) return Toast.error('Título é obrigatório');
    try {
      await API.createTask({
        title,
        description: document.getElementById('task-desc').value,
        project_id: document.getElementById('task-project').value || null,
        agent_id: document.getElementById('task-agent').value || null,
        priority: document.getElementById('task-priority').value,
        due_date: document.getElementById('task-due').value || null
      });
      Modal.close();
      Toast.success('Tarefa criada!');
      App.refresh();
    } catch (e) { Toast.error(e.message); }
  }
};
