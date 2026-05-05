// Agents list page
const AgentsPage = {
  async render() {
    let agents = [];
    try { agents = await API.getAgents(); } catch (e) { console.error(e); }

    return `
      <div class="page-header">
        <div>
          <h1>🤖 Agentes</h1>
          <div class="subtitle">${agents.length} agente(s) cadastrado(s)</div>
        </div>
        <button class="btn btn-primary" onclick="AgentsPage.showCreateModal()">+ Novo Agente</button>
      </div>
      <div class="page-body">
        ${agents.length === 0 ? `
          <div class="empty-state">
            <div class="icon">🤖</div>
            <h3>Nenhum agente cadastrado</h3>
            <p>Crie seu primeiro agente de IA para começar a usar o Nexus OS</p>
            <button class="btn btn-primary" onclick="AgentsPage.showCreateModal()">+ Criar Agente</button>
          </div>
        ` : `
          <div class="grid-3">
            ${agents.map(a => `
              <div class="agent-card" onclick="App.navigate('/agents/${a.id}')">
                <div class="agent-card-header">
                  <div class="agent-avatar">${a.avatar_emoji || '🤖'}</div>
                  <div>
                    <div class="agent-name">${escapeHtml(a.name)}</div>
                    <div class="agent-role">${escapeHtml(a.role || 'Sem cargo')}</div>
                  </div>
                  <div style="margin-left:auto">
                    <span class="status-badge ${a.status}"><span class="dot"></span>${a.status}</span>
                  </div>
                </div>
                <div class="agent-meta">
                  <span class="agent-tag">${a.provider}</span>
                  <span class="agent-tag">${a.model_id}</span>
                  ${a.error_count > 0 ? `<span class="agent-tag" style="background:rgba(255,107,107,0.1);color:var(--accent-danger);border-color:rgba(255,107,107,0.2)">❌ ${a.error_count} Erros</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  showCreateModal() {
    Modal.show(`
      <div class="modal-header">
        <h2>🤖 Novo Agente</h2>
        <button class="modal-close" onclick="Modal.close()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nome do Agente *</label>
          <input class="form-input" id="agent-name" placeholder="Ex: DevBot">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cargo / Função</label>
            <input class="form-input" id="agent-role" placeholder="Ex: Desenvolvedor Full Stack">
          </div>
          <div class="form-group">
            <label class="form-label">Emoji</label>
            <input class="form-input" id="agent-emoji" value="🤖" maxlength="4">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">System Prompt</label>
          <textarea class="form-textarea" id="agent-prompt" rows="4" placeholder="Defina a personalidade e instruções do agente..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="AgentsPage.createAgent()">Criar Agente</button>
      </div>
    `);
  },

  async createAgent() {
    const name = document.getElementById('agent-name').value.trim();
    if (!name) return Toast.error('Nome é obrigatório');

    try {
      await API.createAgent({
        name,
        role: document.getElementById('agent-role').value.trim(),
        avatar_emoji: document.getElementById('agent-emoji').value || '🤖',
        system_prompt: document.getElementById('agent-prompt').value
      });
      Modal.close();
      Toast.success('Agente criado com sucesso!');
      App.refresh();
    } catch (e) {
      Toast.error('Erro ao criar agente: ' + e.message);
    }
  }
};
