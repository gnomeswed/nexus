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
    const reversed = [...messages].reverse();
    return `
      <div class="card" style="height:400px;display:flex;flex-direction:column;padding:0;overflow:hidden">
        <div class="chat-messages" id="chat-messages">
          ${reversed.length === 0 ? '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Inicie a conversa com seus agentes</div>' : ''}
          ${reversed.map(m => `
            <div class="chat-bubble ${m.role}">
              <div class="sender">${m.role === 'user' ? '👤 Você' : (m.agent_emoji || '🤖') + ' ' + (m.agent_name || 'Sistema')}</div>
              ${m.content}
            </div>
          `).join('')}
        </div>
        <div class="chat-input-area">
          <input type="text" id="chat-input" placeholder="Digite sua mensagem..." onkeydown="if(event.key==='Enter')ProjectDetailPage.sendChat(${projectId})">
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
    App.refresh();
  },

  async sendChat(projectId) {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;
    input.value = '';

    // Add user message to UI immediately
    const chatArea = document.getElementById('chat-messages');
    if (chatArea) {
      chatArea.innerHTML += `<div class="chat-bubble user"><div class="sender">👤 Você</div>${this.escapeHtml(content)}</div>`;
      chatArea.innerHTML += `<div class="chat-bubble assistant" id="ai-loading" style="opacity:0.6"><div class="sender">🤖 Pensando...</div><span class="typing-dots">● ● ●</span></div>`;
      chatArea.scrollTop = chatArea.scrollHeight;
    }

    // Disable input while processing
    const sendBtn = input?.nextElementSibling;
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    try {
      const result = await API.sendAIChat('project', projectId, content);

      // Remove loading indicator
      const loading = document.getElementById('ai-loading');
      if (loading) loading.remove();

      if (result.error) {
        Toast.error(result.error);
      } else if (result.message) {
        // Show AI response
        if (chatArea) {
          let actionsHtml = '';
          if (result.actions && result.actions.length > 0) {
            actionsHtml = '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text-muted)">';
            result.actions.forEach(a => {
              actionsHtml += `<div>🔧 ${a.tool}(${Object.values(a.args).map(v => typeof v === 'string' && v.length > 30 ? v.slice(0,30)+'...' : v).join(', ')}) → ${a.result.success ? '✅' : '❌'}</div>`;
            });
            actionsHtml += '</div>';
          }
          chatArea.innerHTML += `<div class="chat-bubble assistant"><div class="sender">${result.message.agent_emoji || '🤖'} ${result.message.agent_name || 'Agente'}</div>${this.formatMarkdown(result.message.content)}${actionsHtml}</div>`;
          chatArea.scrollTop = chatArea.scrollHeight;
        }
      }
    } catch (e) {
      const loading = document.getElementById('ai-loading');
      if (loading) loading.remove();
      Toast.error('Erro: ' + e.message);
    } finally {
      if (input) input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      if (input) input.focus();
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  formatMarkdown(text) {
    if (!text) return '';
    // Basic markdown formatting
    return text
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:var(--bg-primary);padding:10px;border-radius:8px;margin:8px 0;overflow-x:auto;font-family:JetBrains Mono,monospace;font-size:12px"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code style="background:var(--bg-primary);padding:2px 6px;border-radius:4px;font-size:12px">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  },

  async toggleCheckItem(projectId, phaseIdx, itemIdx, checked) {
    try {
      const project = await API.getProject(projectId);
      const roadmap = JSON.parse(project.roadmap || '[]');
      if (roadmap[phaseIdx] && roadmap[phaseIdx].items[itemIdx]) {
        roadmap[phaseIdx].items[itemIdx].done = checked;
        await API.updateProject(projectId, { roadmap });
      }
    } catch (e) { Toast.error(e.message); }
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

  editProject(id) { /* TODO: edit modal */ Toast.info('Em breve'); },

  deleteProject(id) {
    Modal.confirm('Deletar Projeto', 'Tem certeza? Tarefas e mensagens serão deletadas.', async () => {
      try { await API.deleteProject(id); Toast.success('Projeto deletado'); App.navigate('/projects'); } catch (e) { Toast.error(e.message); }
    });
  }
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
