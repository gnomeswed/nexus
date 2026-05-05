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
