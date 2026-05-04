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
          ${agent.error_count > 0 ? `<span class="status-badge offline" style="margin-left:8px">❌ ${agent.error_count} Erros</span>` : ''}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="AgentDetailPage.testConnection(${agent.id})">🔌 Testar API</button>
          <button class="btn btn-primary btn-sm" onclick="AgentDetailPage.save(${agent.id})">💾 Salvar</button>
          <button class="btn btn-danger btn-sm" onclick="AgentDetailPage.deleteAgent(${agent.id})">🗑️</button>
        </div>
      </div>
      <div class="page-body">
        <div class="grid-2" style="align-items:start">
          <!-- LEFT COLUMN: Info + Permissions + Activity -->
          <div style="display:flex;flex-direction:column;gap:16px">
            <div class="card">
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
              <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="AgentDetailPage.togglePermissions()">
                <h3 style="font-size:15px;margin:0">🔒 Permissões</h3>
                <button class="btn btn-secondary btn-sm" id="btn-toggle-perms">Exibir/Minimizar</button>
              </div>
              <div id="perms-container" style="display:none;margin-top:16px">
                <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">
                  <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🏗️ Gerenciamento</div>
                  <div class="form-check"><input type="checkbox" id="perm-delegate_tasks" ${perms.delegate_tasks ? 'checked' : ''}><label for="perm-delegate_tasks">Delegar Tarefas</label></div>
                  <div class="form-check"><input type="checkbox" id="perm-manage_subtasks" ${perms.manage_subtasks ? 'checked' : ''}><label for="perm-manage_subtasks">Gerenciar Subtasks</label></div>
                  <div class="form-check"><input type="checkbox" id="perm-create_tasks" ${perms.create_tasks ? 'checked' : ''}><label for="perm-create_tasks">Criar Tarefas</label></div>
                </div>
                <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">
                  <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">📁 Arquivos</div>
                  <div class="form-check"><input type="checkbox" id="perm-file_create" ${perms.file_create ? 'checked' : ''}><label for="perm-file_create">Criar Arquivos</label></div>
                  <div class="form-check"><input type="checkbox" id="perm-file_edit" ${perms.file_edit ? 'checked' : ''}><label for="perm-file_edit">Editar Arquivos</label></div>
                  <div class="form-check"><input type="checkbox" id="perm-read_files" ${perms.read_files ? 'checked' : ''}><label for="perm-read_files">Ler Arquivos</label></div>
                </div>
                <div>
                  <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">⚡ Outros</div>
                  <div class="form-check"><input type="checkbox" id="perm-web_search" ${perms.web_search ? 'checked' : ''}><label for="perm-web_search">Pesquisa Web</label></div>
                  <div class="form-check"><input type="checkbox" id="perm-execute_commands" ${perms.execute_commands ? 'checked' : ''}><label for="perm-execute_commands">Executar Comandos</label></div>
                </div>
              </div>
            </div>

            <div class="card">
              <h3 style="margin-bottom:16px;font-size:15px">🎒 Atividade Recente</h3>
              ${agent.tasks && agent.tasks.length > 0 ? `
                <div class="table-responsive">
                  <table class="table" style="margin:0">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Título da Tarefa</th>
                        <th>Prioridade</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${agent.tasks.slice(0, 5).map(t => `
                        <tr onclick="App.navigate('/tasks/${t.id}')" style="cursor:pointer" class="hover-row">
                          <td style="width:100px"><span class="status-badge ${t.status}"><span class="dot"></span>${t.status}</span></td>
                          <td><strong style="color:var(--primary-light)">${t.title}</strong><div style="font-size:12px;color:var(--text-muted);margin-top:4px">${t.description ? t.description.substring(0, 50) + '...' : ''}</div></td>
                          <td style="width:80px"><span class="priority-badge ${t.priority}">${t.priority}</span></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<div style="color:var(--text-muted);font-size:13px;padding:16px 0;text-align:center">Nenhuma tarefa atribuída.</div>'}
            </div>
          </div>

          <!-- RIGHT COLUMN: IA Config + Prompt + Error Log -->
          <div style="display:flex;flex-direction:column;gap:16px">
            <div class="card">
              <h3 style="margin-bottom:16px;font-size:15px">🔧 Configuração IA</h3>
              <div class="form-group">
                <label class="form-label">Provider</label>
                <select class="form-select" id="ed-provider" onchange="document.getElementById('endpoint-group').style.display = (this.value === '9router' ? 'none' : 'block')">
                  <option value="9router" ${agent.provider === '9router' || !agent.provider ? 'selected' : ''}>9Router (Configuração Global)</option>
                  <option value="ollama" ${agent.provider === 'ollama' ? 'selected' : ''}>Ollama (Local - Gratuito)</option>
                  <option value="custom" ${agent.provider === 'custom' ? 'selected' : ''}>Endpoint Customizado (Avançado)</option>
                </select>
              </div>
              <div class="form-group" id="endpoint-group" style="display: ${agent.provider && agent.provider !== '9router' ? 'block' : 'none'}">
                <label class="form-label">API Endpoint URL</label>
                <input class="form-input" id="ed-endpoint" value="${agent.api_endpoint || ''}" placeholder="Ex: http://localhost:11434/v1">
              </div>
              <div class="form-group">
                <label class="form-label">Modelo (Opcional no 9Router, Obrigatório no Ollama)</label>
                <input class="form-input" id="ed-model" value="${agent.model_id || ''}" placeholder="Ex: llama3">
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
              <div class="form-group" style="margin:0">
                <textarea class="form-textarea" id="ed-prompt" rows="10" style="font-family:monospace;font-size:13px">${agent.system_prompt || ''}</textarea>
              </div>
            </div>

            <div class="card" style="${agent.errors && agent.errors.length > 0 ? 'border-top:3px solid var(--accent-danger)' : ''}">
              <h3 style="margin-bottom:16px;font-size:15px">⚠️ Log de Erros</h3>
              <div style="display:flex;flex-direction:column;gap:10px;max-height:280px;overflow-y:auto;padding-right:6px">
                ${agent.errors && agent.errors.length > 0 ? agent.errors.map(err => `
                  <div style="background:rgba(255,107,107,0.05);padding:10px;border-radius:6px;border:1px solid rgba(255,107,107,0.1)">
                    <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;display:flex;justify-content:space-between">
                      <span>${err.context_type} #${err.context_id}</span>
                      <span>${new Date(err.created_at).toLocaleString()}</span>
                    </div>
                    <div style="font-size:12px;color:var(--accent-danger);font-family:monospace;line-height:1.4">${err.content}</div>
                  </div>
                `).join('') : '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px">Nenhum erro registrado para este agente.</div>'}
              </div>
            </div>
          </div>
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
        api_endpoint: document.getElementById('ed-endpoint') ? document.getElementById('ed-endpoint').value : '',
        model_id: document.getElementById('ed-model').value,
        temperature: parseFloat(document.getElementById('ed-temp').value),
        max_tokens: parseInt(document.getElementById('ed-tokens').value),
        system_prompt: document.getElementById('ed-prompt').value,
        permissions: JSON.stringify({
          delegate_tasks: document.getElementById('perm-delegate_tasks').checked,
          manage_subtasks: document.getElementById('perm-manage_subtasks').checked,
          create_tasks: document.getElementById('perm-create_tasks').checked,
          file_create: document.getElementById('perm-file_create').checked,
          file_edit: document.getElementById('perm-file_edit').checked,
          read_files: document.getElementById('perm-read_files').checked,
          web_search: document.getElementById('perm-web_search').checked,
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
  },

  togglePermissions() {
    const container = document.getElementById('perms-container');
    const isHidden = container.style.display === 'none';
    container.style.display = isHidden ? 'block' : 'none';
  }
};
