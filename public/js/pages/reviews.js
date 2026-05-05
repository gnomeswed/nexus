// Reviews / Approvals page
const ReviewsPage = {
  async render() {
    let tasks = [], agents = [];
    try {
      const allTasks = await API.getTasks();
      tasks = allTasks.filter(t => t.status === 'review_pending');
    } catch(e) { console.error(e); }

    // Fetch last agent message for each task
    const taskDetails = await Promise.all(tasks.map(async t => {
      try {
        const msgs = await API.getMessages('task', t.id);
        const agentMsgs = msgs.filter(m => m.role === 'assistant');
        t.lastAgentMessage = agentMsgs.length > 0 ? agentMsgs[agentMsgs.length - 1] : null;
      } catch(e) { t.lastAgentMessage = null; }
      return t;
    }));

    return `
      <div class="page-header">
        <div>
          <h1>📋 Aprovações</h1>
          <div class="subtitle">${tasks.length} tarefa(s) aguardando sua revisão</div>
        </div>
        <div style="display:flex;gap:8px">
          ${tasks.length > 1 ? `<button class="btn btn-primary btn-sm" onclick="ReviewsPage.approveAll()">✅ Aprovar Todas</button>` : ''}
        </div>
      </div>
      <div class="page-body">
        ${tasks.length === 0 ? `
          <div class="empty-state">
            <div class="icon">✅</div>
            <h3>Nenhuma aprovação pendente</h3>
            <p>Quando agentes terminarem tarefas, elas aparecerão aqui para sua revisão.</p>
            <button class="btn btn-secondary" onclick="App.navigate('/')">← Voltar ao Dashboard</button>
          </div>
        ` : `
          <div class="reviews-list">
            ${taskDetails.map(t => `
              <div class="review-card" id="review-card-${t.id}">
                <div class="review-header">
                  <div class="review-title-row">
                    <span class="agent-avatar" style="width:36px;height:36px;font-size:18px">${t.agent_emoji || '🤖'}</span>
                    <div>
                      <div class="review-title">${escapeHtml(t.title)}</div>
                      <div class="review-meta">
                        ${t.agent_name ? `<span>🤖 ${t.agent_name}</span>` : ''}
                        ${t.project_name ? `<span>📁 ${t.project_name}</span>` : '<span>Tarefa avulsa</span>'}
                        <span class="priority-badge ${t.priority}">${t.priority}</span>
                      </div>
                    </div>
                  </div>
                </div>

                ${t.description ? `
                  <div class="review-description">
                    <strong>Descrição:</strong> ${escapeHtml(truncate(t.description, 200))}
                  </div>
                ` : ''}

                ${t.lastAgentMessage ? `
                  <div class="review-agent-report">
                    <div class="review-report-header">
                      <span>${t.lastAgentMessage.agent_emoji || '🤖'} ${t.lastAgentMessage.agent_name || 'Agente'}</span>
                      <span class="time">${timeAgo(t.lastAgentMessage.created_at)}</span>
                    </div>
                    <div class="review-report-content">
                      ${formatMarkdown(escapeHtml(truncate(t.lastAgentMessage.content, 500)))}
                    </div>
                  </div>
                ` : `
                  <div class="review-agent-report" style="color:var(--text-muted);font-style:italic">
                    Nenhum relatório do agente encontrado.
                  </div>
                `}

                <div class="review-actions">
                  <button class="btn btn-secondary btn-sm" onclick="App.navigate('/tasks/${t.id}')">
                    👁️ Ver Detalhes
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="ReviewsPage.reject(${t.id})">
                    ❌ Rejeitar
                  </button>
                  <button class="btn btn-sm" style="background:var(--accent-success);color:white" onclick="ReviewsPage.approve(${t.id})">
                    ✅ Aprovar
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  async approve(taskId) {
    try {
      await API.updateTask(taskId, { status: 'completed' });
      // Notify agent
      await API.sendAIChat('task', taskId, "SISTEMA: Tarefa aprovada pelo usuário. Ótimo trabalho!");
      
      const card = document.getElementById(`review-card-${taskId}`);
      if (card) {
        card.style.opacity = '0.3';
        card.style.pointerEvents = 'none';
        card.querySelector('.review-actions').innerHTML = '<span style="color:var(--accent-success);font-weight:600">✅ Aprovada</span>';
      }
      Toast.success('Tarefa aprovada!');
      App.updateCounts();
    } catch(e) { Toast.error(e.message); }
  },

  async reject(taskId) {
    Modal.show(`
      <div class="modal-header"><h2>❌ Rejeitar Tarefa</h2><button class="modal-close" onclick="Modal.close()">×</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Motivo da rejeição (será enviado ao agente)</label>
          <textarea class="form-textarea" id="reject-reason" rows="3" placeholder="Ex: O código não trata erros corretamente..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-danger" onclick="ReviewsPage.confirmReject(${taskId})">Rejeitar e Devolver</button>
      </div>
    `);
  },

  async confirmReject(taskId) {
    const reason = document.getElementById('reject-reason')?.value?.trim() || 'Rejeitado pelo usuário';
    try {
      await API.updateTask(taskId, { status: 'in_progress' });
      // Send rejection message to the task chat so the agent knows
      await API.sendAIChat('task', taskId, `REJEIÇÃO: ${reason}. Corrija e reenvie para revisão.`);
      Modal.close();
      Toast.warning('Tarefa devolvida ao agente com feedback');
      App.refresh();
    } catch(e) { Toast.error(e.message); }
  },

  async approveAll() {
    Modal.confirm('Aprovar Todas', 'Tem certeza que deseja aprovar TODAS as tarefas pendentes?', async () => {
      try {
        const allTasks = await API.getTasks();
        const pending = allTasks.filter(t => t.status === 'review_pending');
        
        // Use Promise.allSettled for robustness
        const results = await Promise.allSettled(pending.map(async t => {
            await API.updateTask(t.id, { status: 'completed' });
            await API.sendAIChat('task', t.id, "SISTEMA: Tarefa aprovada pelo usuário via aprovação em massa.");
        }));
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.length - successCount;
        if (failCount > 0) {
          Toast.warning(`${successCount} aprovadas, ${failCount} falharam.`);
        } else {
          Toast.success(`${successCount} tarefa(s) aprovada(s)!`);
        }
        App.refresh();
      } catch(e) { Toast.error(e.message); }
    });
  }
};
