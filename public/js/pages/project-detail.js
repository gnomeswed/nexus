// Project detail page
const ProjectDetailPage = {
  currentTab: 'roadmap',

  async render(id) {
    let project;
    try { project = await API.getProject(id); } catch (e) {
      return `<div class="page-body"><div class="empty-state"><div class="icon">❌</div><h3>Projeto não encontrado</h3></div></div>`;
    }

    const roadmap = JSON.parse(project.roadmap || '[]');
    const messages = project.messages || [];
    const files = project.files || [];
    const tasks = project.tasks || [];

    return `
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:14px">
          <button class="btn btn-secondary btn-icon" onclick="App.navigate('/projects')">←</button>
          <div>
            <h1>📁 ${project.name}</h1>
            <div class="subtitle">${project.description || 'Sem descrição'}</div>
          </div>
          <span class="status-badge ${project.status}"><span class="dot"></span>${project.status}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="ProjectDetailPage.editProject(${id})">⚙️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="ProjectDetailPage.deleteProject(${id})">🗑️</button>
        </div>
      </div>
      <div class="page-body">
        <!-- Progress -->
        <div class="card" style="margin-bottom:20px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span style="font-size:14px;font-weight:600">Progresso: ${project.progress_percent}%</span>
            <div style="display:flex;gap:6px">
              ${(project.agents || []).map(a => `<span title="${a.name} (${a.role_in_project})" style="font-size:20px;cursor:help">${a.avatar_emoji}</span>`).join('')}
            </div>
          </div>
          <div class="progress-bar"><div class="fill" style="width:${project.progress_percent}%"></div></div>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <div class="tab ${this.currentTab === 'roadmap' ? 'active' : ''}" onclick="ProjectDetailPage.switchTab('roadmap', ${id})">📍 Roadmap</div>
          <div class="tab ${this.currentTab === 'tasks' ? 'active' : ''}" onclick="ProjectDetailPage.switchTab('tasks', ${id})">✅ Tarefas (${tasks.length})</div>
          <div class="tab ${this.currentTab === 'chat' ? 'active' : ''}" onclick="ProjectDetailPage.switchTab('chat', ${id})">💬 Chat</div>
          <div class="tab ${this.currentTab === 'files' ? 'active' : ''}" onclick="ProjectDetailPage.switchTab('files', ${id})">📄 Arquivos (${files.length})</div>
        </div>

        <!-- Tab Content -->
        <div id="tab-content">
          ${this.renderTab(this.currentTab, { roadmap, tasks, messages, files, id: project.id })}
        </div>
      </div>
    `;
  },

  renderTab(tab, data) {
    switch (tab) {
      case 'roadmap': return this.renderRoadmap(data.roadmap, data.id);
      case 'tasks': return this.renderTasks(data.tasks, data.id);
      case 'chat': return this.renderChat(data.messages, data.id);
      case 'files': return this.renderFiles(data.files);
      default: return '';
    }
  },

  renderRoadmap(roadmap, projectId) {
    if (!roadmap.length) return `
      <div class="empty-state">
        <div class="icon">📍</div>
        <h3>Nenhuma fase definida</h3>
        <p>Adicione fases ao roadmap do projeto</p>
        <button class="btn btn-primary btn-sm" onclick="ProjectDetailPage.addPhase(${projectId})">+ Adicionar Fase</button>
      </div>`;

    return `
      <div style="margin-bottom:12px"><button class="btn btn-secondary btn-sm" onclick="ProjectDetailPage.addPhase(${projectId})">+ Adicionar Fase</button></div>
      ${roadmap.map((phase, i) => {
        const items = phase.items || [];
        const done = items.filter(it => it.done).length;
        const pct = items.length ? Math.round((done / items.length) * 100) : 0;
        return `
        <div class="roadmap-phase">
          <div class="phase-header">
            <span class="phase-title">${phase.emoji || '📍'} ${phase.name}</span>
            <span style="font-size:13px;color:var(--text-secondary)">${pct}%</span>
          </div>
          <div class="progress-bar" style="margin-bottom:10px"><div class="fill" style="width:${pct}%"></div></div>
          ${items.map((it, j) => `
            <div class="checklist-item ${it.done ? 'done' : ''}">
              <input type="checkbox" ${it.done ? 'checked' : ''} onchange="ProjectDetailPage.toggleCheckItem(${projectId},${i},${j},this.checked)">
              <span>${it.text}</span>
            </div>
          `).join('')}
        </div>`;
      }).join('')}
    `;
  },

  renderTasks(tasks, projectId) {
    return `
      <div style="margin-bottom:12px"><button class="btn btn-secondary btn-sm" onclick="TasksPage.showCreateModal(${projectId})">+ Nova Tarefa</button></div>
      ${tasks.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text-muted)">Nenhuma tarefa</div>' : ''}
      ${tasks.map(t => `
        <div class="activity-item" style="cursor:pointer;margin-bottom:4px" onclick="App.navigate('/tasks/${t.id}')">
          <span class="emoji">${t.agent_emoji || '✅'}</span>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:500">${t.title}</div>
            <div style="font-size:12px;color:var(--text-muted)">${t.agent_name || 'Sem agente'}</div>
          </div>
          <span class="status-badge ${t.status}">${t.status}</span>
          <span class="priority-badge ${t.priority}">${t.priority}</span>
        </div>
      `).join('')}
    `;
  },

  renderChat(messages, projectId) {
    return `
      <div class="chat-toolbar">
        <span id="ai-live-status"></span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="API.exportChat('project',${projectId})">📤 Exportar</button>
          <button class="btn btn-danger btn-sm" onclick="ProjectDetailPage.clearChat(${projectId})">🗑️ Limpar</button>
        </div>
      </div>
      <div class="card" style="height:calc(100vh - 340px);min-height:400px;display:flex;flex-direction:column;padding:0;overflow:hidden">
        <div class="chat-messages" id="chat-messages">
          ${messages.length === 0 ? '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Inicie a conversa com seus agentes</div>' : ''}
          ${messages.map(m => `
            <div class="chat-bubble ${m.role}">
              <div class="sender">
                <span>${m.role === 'user' ? '👤 Você' : (m.agent_emoji || '🤖') + ' ' + (m.agent_name || 'Sistema')}</span>
                <span class="chat-time">${formatTime(m.created_at)}</span>
              </div>
              ${formatMarkdown(escapeHtml(m.content))}
            </div>
          `).join('')}
        </div>
        <div class="chat-input-area">
          <input type="text" id="chat-input" placeholder="Digite sua mensagem... (Ctrl+/)" onkeydown="if(event.key==='Enter')ProjectDetailPage.sendChat(${projectId})">
          <button onclick="ProjectDetailPage.sendChat(${projectId})">➤</button>
        </div>
      </div>
    `;
  },

  renderFiles(files) {
    if (!files.length) return '<div style="padding:20px;text-align:center;color:var(--text-muted)">Nenhum arquivo no projeto</div>';
    return files.map(f => `
      <div class="file-item">
        <span>${f.type === 'directory' ? '📂' : '📄'}</span>
        <span>${f.path}</span>
        <span class="size">${f.type === 'file' ? formatBytes(f.size) : ''}</span>
      </div>
    `).join('');
  },

  switchTab(tab, id) {
    this.currentTab = tab;
    // Fast tab switching without full App.refresh()
    const container = document.getElementById('tab-content');
    if (!container) return App.refresh();

    // Active tab class update
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.tab[onclick*="'${tab}'"]`);
    if (activeTab) activeTab.classList.add('active');

    // Re-render only the tab content
    this.render(id).then(html => {
        // This is a shortcut to get fresh data, but we could also just call renderTab if we had data cached
        App.refresh(); 
    });
  },

  async clearChat(projectId) {
    Modal.confirm('Limpar Chat', 'Deseja apagar todo o histórico de chat deste projeto?', async () => {
      try {
        await API.deleteChat('project', projectId);
        Toast.success('Chat limpo!');
        App.refresh();
      } catch(e) { Toast.error(e.message); }
    });
  },

  async sendChat(projectId) {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;
    input.value = '';

    // Show typing indicator
    const liveStatus = document.getElementById('ai-live-status');
    if (liveStatus) liveStatus.innerHTML = '<span class="typing-dots" style="color:var(--accent)">● ● ●</span> Processando...';

    const sendBtn = input?.nextElementSibling;
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    try {
      await API.sendAIChat('project', projectId, content);
      // UX: No need for setTimeout, Socket will broadcast the message
    } catch (e) {
      Toast.error('Erro: ' + e.message);
    } finally {
      if (input) input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      if (input) input.focus();
      const ls = document.getElementById('ai-live-status');
      if (ls) ls.innerHTML = '';
    }
  },

  // Using global escapeHtml and formatMarkdown from app.js
  

  async toggleCheckItem(projectId, phaseIdx, itemIdx, checked) {
    if (this._toggling) return;
    this._toggling = true;
    try {
      const project = await API.getProject(projectId);
      const roadmap = JSON.parse(project.roadmap || '[]');
      if (roadmap[phaseIdx] && roadmap[phaseIdx].items[itemIdx]) {
        roadmap[phaseIdx].items[itemIdx].done = checked;
        await API.updateProject(projectId, { roadmap });
        // Optionally update UI locally before refresh to feel instant
        const itemEl = event.target.closest('.checklist-item');
        if (itemEl) itemEl.classList.toggle('done', checked);
      }
    } catch (e) { 
      Toast.error(e.message); 
      App.refresh(); // Sync back on error
    } finally {
      this._toggling = false;
    }
  },

  addPhase(projectId) {
    Modal.show(`
      <div class="modal-header"><h2>📍 Nova Fase</h2><button class="modal-close" onclick="Modal.close()">×</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Nome da Fase</label><input class="form-input" id="phase-name" placeholder="Ex: Setup Inicial"></div>
        <div class="form-group"><label class="form-label">Itens (um por linha)</label><textarea class="form-textarea" id="phase-items" rows="5" placeholder="Criar estrutura de pastas\nConfigurar banco de dados\nSetup do ambiente"></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="ProjectDetailPage.savePhase(${projectId})">Adicionar</button>
      </div>
    `);
  },

  async savePhase(projectId) {
    const name = document.getElementById('phase-name').value.trim();
    if (!name) return Toast.error('Nome obrigatório');
    const itemsText = document.getElementById('phase-items').value.trim();
    const items = itemsText ? itemsText.split('\n').filter(l => l.trim()).map(text => ({ text: text.trim(), done: false })) : [];

    try {
      const project = await API.getProject(projectId);
      const roadmap = JSON.parse(project.roadmap || '[]');
      roadmap.push({ name, emoji: '📍', items });
      await API.updateProject(projectId, { roadmap });
      Modal.close();
      Toast.success('Fase adicionada!');
      App.refresh();
    } catch (e) { Toast.error(e.message); }
  },

  async editProject(id) {
    let project, agents = [];
    try {
      project = await API.getProject(id);
      agents = await API.getAgents();
    } catch(e) { return Toast.error(e.message); }

    const assignedIds = (project.agents || []).map(a => a.id);

    Modal.show(`
      <div class="modal-header"><h2>✏️ Editar Projeto</h2><button class="modal-close" onclick="Modal.close()">×</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="edit-proj-name" value="${escapeHtml(project.name)}"></div>
        <div class="form-group"><label class="form-label">Descrição</label><textarea class="form-textarea" id="edit-proj-desc" rows="3">${escapeHtml(project.description || '')}</textarea></div>
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-select" id="edit-proj-status">
            ${['planning','in_progress','review','completed','archived'].map(s => `<option value="${s}" ${project.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Agentes do Projeto <span style="font-weight:400;color:var(--text-muted)">(primeiro selecionado = líder)</span></label>
          <div id="edit-proj-agents" class="agent-checklist">
            ${agents.length === 0 ? '<div style="color:var(--text-muted);font-size:13px">Nenhum agente cadastrado</div>' :
              agents.map(a => `
                <label class="agent-check-item">
                  <input type="checkbox" value="${a.id}" ${assignedIds.includes(a.id) ? 'checked' : ''}>
                  <span class="agent-avatar" style="width:32px;height:32px;font-size:16px">${a.avatar_emoji || '🤖'}</span>
                  <div>
                    <div style="font-size:13px;font-weight:500">${a.name}</div>
                    <div style="font-size:11px;color:var(--text-muted)">${a.role || a.provider}</div>
                  </div>
                  <span class="status-badge ${a.status}" style="margin-left:auto;font-size:11px"><span class="dot"></span>${a.status}</span>
                </label>
              `).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="ProjectDetailPage.saveEdit(${id})">Salvar Mudanças</button>
      </div>
    `);
  },

  async saveEdit(id) {
    const agentCheckboxes = document.querySelectorAll('#edit-proj-agents input[type="checkbox"]:checked');
    const agent_ids = Array.from(agentCheckboxes).map(c => parseInt(c.value));

    try {
      await API.updateProject(id, {
        name: document.getElementById('edit-proj-name').value.trim(),
        description: document.getElementById('edit-proj-desc').value,
        status: document.getElementById('edit-proj-status').value,
        agent_ids
      });
      Modal.close();
      Toast.success('Projeto atualizado!');
      App.refresh();
    } catch(e) { Toast.error(e.message); }
  },

  deleteProject(id) {
    Modal.confirm('Deletar Projeto', 'Tem certeza? Tarefas e mensagens serão deletadas.', async () => {
      try { await API.deleteProject(id); Toast.success('Projeto deletado'); App.navigate('/projects'); } catch (e) { Toast.error(e.message); }
    });
  }
};
