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
          <div style="margin-top: 16px; display: flex; gap: 8px;">
            <button class="btn btn-secondary" onclick="SettingsPage.testConnection()">🔌 Testar Conexão</button>
            <button class="btn btn-primary" onclick="SettingsPage.saveSettings()">Salvar Configurações</button>
          </div>
        </div>
      </div>
    `;
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

    try {
      await API.updateSettings({ ai_router_url, projects_root });
      Toast.success('Configurações atualizadas com sucesso!');
    } catch (e) {
      Toast.error('Erro ao atualizar: ' + e.message);
    }
  }
};
