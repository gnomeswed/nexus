// Settings page
const SettingsPage = {
  async render() {
    let settings = {};
    try { settings = await API.getSettings(); } catch (e) {}

    return `
      <div class="page-header">
        <div><h1>⚙️ Configurações</h1><div class="subtitle">Nexus OS v${settings.version || '1.0.0'}</div></div>
      </div>
      <div class="page-body">
        <div class="card" style="max-width:600px">
          <h3 style="margin-bottom:16px;font-size:15px">🔧 Sistema</h3>
          <div class="form-group">
            <label class="form-label">AI Router URL (Endpoint 9Router)</label>
            <input class="form-input" id="setting-router" value="${settings.ai_router_url || ''}" placeholder="Ex: http://localhost:20128/v1">
          </div>
          <div class="form-group">
            <label class="form-label">Pasta de Projetos</label>
            <input class="form-input" id="setting-projects" value="${settings.projects_root || ''}" placeholder="Ex: ./projects">
          </div>
          <div class="form-group">
            <label class="form-label">Modelo Global Padrão (Ex: combo)</label>
            <input class="form-input" id="setting-model" value="${settings.default_model || ''}" placeholder="Ex: combo">
            <small style="color:var(--text-muted);font-size:12px;margin-top:4px;display:block">
              Deixe "combo" para usar o rodízio grátis do 9Router, ou digite um modelo específico (ex: kr/claude-sonnet-4.5)
            </small>
          </div>
          <div class="form-group">
            <label class="form-label">PIN de Segurança (Acesso ao Sistema)</label>
            <input type="password" class="form-input" id="setting-pin" value="${settings.nexus_pin || ''}" placeholder="Ex: 1234">
            <small style="color:var(--text-muted);font-size:12px;margin-top:4px;display:block">
              Este PIN será solicitado sempre que você abrir o sistema em uma nova sessão.
            </small>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 8px;">
            <button class="btn btn-secondary" onclick="SettingsPage.testConnection()">🔌 Testar Conexão</button>
            <button class="btn btn-primary" onclick="SettingsPage.saveSettings()">Salvar Configurações</button>
          </div>
        </div>

        <div class="card" style="margin-top: 24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="font-size:15px">🏥 Saúde da IA (Falhas de Modelos)</h3>
            <button class="btn btn-danger btn-sm" onclick="SettingsPage.clearFailures()">🗑️ Limpar Logs</button>
          </div>
          
          <div id="ai-health-dashboard">
            <div style="text-align:center;padding:20px;color:var(--text-muted)">Carregando dados de saúde...</div>
          </div>
        </div>
      </div>
    `;
  },

  async afterRender() {
    try {
      const { stats, recent } = await API.getAIFailures();
      const container = document.getElementById('ai-health-dashboard');
      if (!container) return;

      if (stats.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--success)">✅ Nenhum erro registrado. Seus modelos estão operando normalmente.</div>';
        return;
      }

      let html = `
        <div style="margin-bottom:20px">
          <label class="form-label" style="font-size:12px;opacity:0.8">Frequência de Erros por Modelo</label>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
            ${stats.map(s => `
              <div style="display:flex;align-items:center;gap:12px;background:var(--bg-light);padding:8px 12px;border-radius:8px">
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600;font-family:'JetBrains Mono', monospace">${s.model}</div>
                  <div style="font-size:11px;color:var(--text-muted)">Última falha: ${new Date(s.last_failure).toLocaleString()}</div>
                </div>
                <div style="font-size:18px;font-weight:700;color:var(--accent-danger)">${s.count}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <label class="form-label" style="font-size:12px;opacity:0.8">Falhas Recentes (Últimas 20)</label>
        <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-top:8px">
          <table class="table" style="font-size:12px">
            <thead>
              <tr>
                <th>Data</th>
                <th>Agente</th>
                <th>Modelo</th>
                <th>Erro</th>
              </tr>
            </thead>
            <tbody>
              ${recent.map(f => `
                <tr>
                  <td style="white-space:nowrap">${new Date(f.created_at).toLocaleString()}</td>
                  <td style="white-space:nowrap">${f.agent_emoji || '🤖'} ${f.agent_name || 'Desconhecido'}</td>
                  <td style="font-family:'JetBrains Mono', monospace;color:var(--accent)">${f.model}</td>
                  <td style="color:var(--accent-danger);max-width:300px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(f.error_message)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      container.innerHTML = html;
    } catch (e) {
      console.error(e);
    }
  },

  async clearFailures() {
    if (!confirm('Tem certeza que deseja limpar todos os registros de falhas?')) return;
    try {
      await API.clearAIFailures();
      Toast.success('Logs de falhas limpos!');
      this.afterRender();
    } catch (e) { Toast.error(e.message); }
  },

  async testConnection() {
    Toast.info('Testando conexão...');
    try {
      const result = await API.testSettings();
      result.success ? Toast.success(result.message) : Toast.error(result.message);
    } catch (e) {
      Toast.error('Falha: ' + e.message);
    }
  },

  async saveSettings() {
    const ai_router_url = document.getElementById('setting-router').value.trim();
    const projects_root = document.getElementById('setting-projects').value.trim();
    const default_model = document.getElementById('setting-model').value.trim();
    const nexus_pin = document.getElementById('setting-pin').value.trim();
    
    if (!nexus_pin) return Toast.error('O PIN não pode ser vazio');

    try {
      await API.updateSettings({ ai_router_url, projects_root, default_model, nexus_pin });
      Toast.success('Configurações atualizadas com sucesso!');
      // Update local storage/session if changed? 
      // Better to let the next request 401 and re-prompt or just update session
      sessionStorage.setItem('nexus_pin', nexus_pin);
    } catch (e) {
      Toast.error('Erro ao atualizar: ' + e.message);
    }
  }
};
