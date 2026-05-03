// Agent detail/edit page
const AgentDetailPage = {
  async render(id) {
    let agent;
    try { agent = await API.getAgent(id); } catch (e) {
      return `<div class="page-body"><div class="empty-state"><div class="icon">❌</div><h3>Agente não encontrado</h3></div></div>`;
    }

    const perms = JSON.parse(agent.permissions || '{}');

    return `
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:14px">
          <button class="btn btn-secondary btn-icon" onclick="App.navigate('/agents')">←</button>
          <div>
            <h1>${agent.avatar_emoji} ${agent.name}</h1>
            <div class="subtitle">${agent.role || 'Sem cargo definido'}</div>
          </div>
          <span class="status-badge ${agent.status}" style="margin-left:12px"><span class="dot"></span>${agent.status}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="AgentDetailPage.testConnection(${agent.id})">🔌 Testar API</button>
          <button class="btn btn-danger btn-sm" onclick="AgentDetailPage.deleteAgent(${agent.id})">🗑️</button>
        </div>
      </div>
      <div class="page-body">
        <div class="grid-2">
          <div>
            <div class="card" style="margin-bottom:16px">
              <h3 style="margin-bottom:16px;font-size:15px">📝 Informações</h3>
              <div class="form-group">
                <label class="form-label">Nome</label>
                <input class="form-input" id="ed-name" value="${agent.name}">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Cargo</label>
                  <input class="form-input" id="ed-role" value="${agent.role || ''}">
                </div>
                <div class="form-group">
                  <label class="form-label">Emoji</label>
                  <input class="form-input" id="ed-emoji" value="${agent.avatar_emoji || '🤖'}" maxlength="4">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-select" id="ed-status">
                  <option value="active" ${agent.status === 'active' ? 'selected' : ''}>Active</option>
                  <option value="paused" ${agent.status === 'paused' ? 'selected' : ''}>Paused</option>
                  <option value="offline" ${agent.status === 'offline' ? 'selected' : ''}>Offline</option>
                </select>
              </div>
            </div>
            <div class="card">
              <h3 style="margin-bottom:16px;font-size:15px">🔒 Permissões</h3>
              <div class="form-check"><input type="checkbox" id="perm-file_create" ${perms.file_create ? 'checked' : ''}><label for="perm-file_create">Criar Arquivos</label></div>
              <div class="form-check"><input type="checkbox" id="perm-file_edit" ${perms.file_edit ? 'checked' : ''}><label for="perm-file_edit">Editar Arquivos</label></div>
              <div class="form-check"><input type="checkbox" id="perm-web_search" ${perms.web_search ? 'checked' : ''}><label for="perm-web_search">Pesquisa Web</label></div>
              <div class="form-check"><input type="checkbox" id="perm-create_tasks" ${perms.create_tasks ? 'checked' : ''}><label for="perm-create_tasks">Criar Tarefas</label></div>
              <div class="form-check"><input type="checkbox" id="perm-read_files" ${perms.read_files ? 'checked' : ''}><label for="perm-read_files">Ler Arquivos</label></div>
              <div class="form-check"><input type="checkbox" id="perm-execute_commands" ${perms.execute_commands ? 'checked' : ''}><label for="perm-execute_commands">Executar Comandos</label></div>
            </div>
          </div>
          <div>
            <div class="card" style="margin-bottom:16px">
              <h3 style="margin-bottom:16px;font-size:15px">🔧 Configuração IA</h3>

              <div class="form-group">
                <label class="form-label">Provider</label>
                <select class="form-select" id="ed-provider">
                  <option value="9router" ${agent.provider === '9router' || !agent.provider ? 'selected' : ''}>9Router (Configuração Global)</option>
                  <option value="custom" ${agent.provider === 'custom' ? 'selected' : ''}>Endpoint Customizado (Avançado)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Modelo (Opcional)</label>
                <input class="form-input" id="ed-model" value="${agent.model_id || ''}" placeholder="Deixe em branco para o 9Router escolher">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Temperature</label>
                  <input class="form-input" id="ed-temp" type="number" min="0" max="2" step="0.1" value="${agent.temperature}">
                </div>
                <div class="form-group">
                  <label class="form-label">Max Tokens</label>
                  <input class="form-input" id="ed-tokens" type="number" min="100" max="32000" value="${agent.max_tokens}">
                </div>
              </div>
            </div>
            <div class="card">
              <h3 style="margin-bottom:16px;font-size:15px">💬 System Prompt</h3>
              <div class="form-group">
                <textarea class="form-textarea" id="ed-prompt" rows="8">${agent.system_prompt || ''}</textarea>
              </div>
            </div>
          </div>
        </div>
        <div style="margin-top:20px;display:flex;justify-content:flex-end">
          <button class="btn btn-primary" onclick="AgentDetailPage.save(${agent.id})">💾 Salvar Alterações</button>
        </div>
      </div>
    `;
  },

  async save(id) {
    try {
      await API.updateAgent(id, {
        name: document.getElementById('ed-name').value,
        role: document.getElementById('ed-role').value,
        avatar_emoji: document.getElementById('ed-emoji').value,
        status: document.getElementById('ed-status').value,
        provider: document.getElementById('ed-provider').value,
        model_id: document.getElementById('ed-model').value,
        temperature: parseFloat(document.getElementById('ed-temp').value),
        max_tokens: parseInt(document.getElementById('ed-tokens').value),
        system_prompt: document.getElementById('ed-prompt').value,
        permissions: JSON.stringify({
          file_create: document.getElementById('perm-file_create').checked,
          file_edit: document.getElementById('perm-file_edit').checked,
          web_search: document.getElementById('perm-web_search').checked,
          create_tasks: document.getElementById('perm-create_tasks').checked,
          read_files: document.getElementById('perm-read_files').checked,
          execute_commands: document.getElementById('perm-execute_commands').checked
        })
      });
      Toast.success('Agente atualizado!');
    } catch (e) { Toast.error(e.message); }
  },

  async testConnection(id) {
    Toast.info('Testando conexão...');
    try {
      const result = await API.testAgent(id);
      result.success ? Toast.success(result.message) : Toast.error(result.message);
    } catch (e) { Toast.error(e.message); }
  },

  deleteAgent(id) {
    Modal.confirm('Deletar Agente', 'Tem certeza? Esta ação não pode ser desfeita.', async () => {
      try {
        await API.deleteAgent(id);
        Toast.success('Agente deletado');
        App.navigate('/agents');
      } catch (e) { Toast.error(e.message); }
    });
  }
};
