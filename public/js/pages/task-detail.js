// Task detail page
const TaskDetailPage = {
  async render(id) {
    let task;
    try { task = await API.getTask(id); } catch (e) {
      return `<div class="page-body"><div class="empty-state"><div class="icon">❌</div><h3>Tarefa não encontrada</h3></div></div>`;
    }

    const checklist = JSON.parse(task.checklist || '[]');
    const messages = task.messages || [];

    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    let isThinking = lastMsg && lastMsg.role === 'user';
    let initialStatus = isThinking 
      ? '<span class="typing-dots" style="color:var(--accent);font-size:14px;margin-right:8px">● ● ●</span> <span style="color:var(--text)">Pensando e processando...</span>'
      : 'Aguardando nova instrução...';

    // Join WebSocket room for live chat using the external method
    setTimeout(() => {
      TaskDetailPage.setupSocket(id);
    }, 100);

    return `
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:14px">
          <button class="btn btn-secondary btn-icon" onclick="App.navigate('/tasks')">←</button>
          <div>
            <h1>✅ ${this.escapeHtml(task.title)}</h1>
            <div class="subtitle">${task.project_name ? '📁 ' + task.project_name : 'Tarefa avulsa'} · ${task.agent_name ? task.agent_emoji + ' ' + task.agent_name : 'Sem agente'}</div>
          </div>
          <span class="status-badge ${task.status}"><span class="dot"></span>${task.status}</span>
          <span class="priority-badge ${task.priority}">${task.priority}</span>
        </div>
        <div style="display:flex;gap:8px">
          <select class="form-select" style="width:auto;padding:6px 30px 6px 10px;font-size:13px" onchange="TaskDetailPage.updateStatus(${id},this.value)">
            <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="review_pending" ${task.status === 'review_pending' ? 'selected' : ''}>Review Pending</option>
            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="cancelled" ${task.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="TaskDetailPage.editTask(${id})">⚙️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="TaskDetailPage.deleteTask(${id})">🗑️</button>
        </div>
      </div>
      <div class="page-body">
        <div class="grid-2">
          <div style="display:flex;flex-direction:column;gap:16px">
            <div class="card">
              <h3 style="margin-bottom:12px;font-size:15px;display:flex;align-items:center;gap:8px">📝 <span>Descrição do Projeto</span></h3>
              <p style="color:var(--text-secondary);font-size:14px;line-height:1.6">${this.escapeHtml(task.description || 'Sem descrição')}</p>
            </div>
            <div class="card" style="display:flex;flex-direction:column;flex:1">
              <h3 style="margin-bottom:0;font-size:15px;display:flex;justify-content:space-between;align-items:center;padding-bottom:12px">
                <span>📋 Subtasks & Roadmap</span>
                <span style="font-size:12px;background:var(--bg-lighter);padding:4px 10px;border-radius:12px;color:var(--text-secondary)">
                  ${checklist.filter(c => c.done).length} / ${checklist.length} concluídos
                </span>
              </h3>
              ${checklist.length > 0 ? `
                <div style="width:100%;height:6px;background:var(--bg-lighter);border-radius:4px;margin-bottom:16px;overflow:hidden">
                  <div style="height:100%;width:${checklist.length > 0 ? Math.round((checklist.filter(c=>c.done).length / checklist.length) * 100) : 0}%;background:linear-gradient(90deg, var(--primary), var(--accent));border-radius:4px;transition:width 0.4s ease"></div>
                </div>
              ` : ''}
              <div id="task-checklist-container" style="position:relative;padding-left:14px;flex:1;border-left:2px solid var(--border);margin-left:6px">
                ${checklist.length === 0 ? '<div style="color:var(--text-muted);font-size:13px;padding:20px 0 20px 16px;text-align:center">Nenhuma subtask criada ainda.<br><span style="font-size:12px;opacity:0.7">Use o campo abaixo ou peça ao Gerente via chat.</span></div>' : ''}
                ${checklist.map((item, i) => `
                  <div class="checklist-item ${item.done ? 'done' : ''}" style="position:relative;display:flex;align-items:flex-start;gap:10px;padding:10px 0 10px 18px;transition:all 0.2s;border-bottom:1px solid rgba(255,255,255,0.03)">
                    <div style="position:absolute;left:-7px;top:14px;width:12px;height:12px;border-radius:50%;background:${item.done ? 'var(--success, #22c55e)' : 'var(--bg-light)'};border:2px solid ${item.done ? 'var(--success, #22c55e)' : 'var(--border)'};z-index:2;transition:all 0.3s;display:flex;align-items:center;justify-content:center">
                      ${item.done ? '<span style="font-size:7px;color:#fff">✓</span>' : ''}
                    </div>
                    <input type="checkbox" ${item.done ? 'checked' : ''} onchange="TaskDetailPage.toggleCheck(${id},${i},this.checked)" style="margin-top:3px;accent-color:var(--primary);cursor:pointer;width:15px;height:15px;flex-shrink:0">
                    <div style="flex:1;min-width:0">
                      <span style="font-size:13px;line-height:1.5;color:${item.done ? 'var(--text-muted)' : 'var(--text)'};text-decoration:${item.done ? 'line-through' : 'none'};transition:all 0.2s;display:block">${this.escapeHtml(item.text)}</span>
                      ${item.created_at ? `<div style="font-size:10px;color:var(--text-muted);margin-top:3px;opacity:0.7">${item.created_by || '?'} · ${item.created_at}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
              <div style="display:flex;gap:8px;margin-top:16px;border-top:1px solid var(--border);padding-top:12px">
                <input type="text" id="new-subtask-input" class="form-input" style="background:var(--bg-lighter);border-color:transparent;font-size:13px" placeholder="+ Nova subtask..." onkeydown="if(event.key==='Enter')TaskDetailPage.addSubtask(${id})">
                <button class="btn btn-primary btn-sm" style="padding:0 16px;white-space:nowrap" onclick="TaskDetailPage.addSubtask(${id})">Adicionar</button>
              </div>
            </div>
          </div>
          <div>
            <div class="card" style="margin-bottom:16px;background:var(--bg-lighter);border-left:4px solid var(--accent)">
              <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span>🧠</span> Status da Inteligência</div>
              <div id="ai-live-status" style="font-family:'JetBrains Mono', monospace;font-size:13px;color:var(--text-muted);display:flex;align-items:center;">
                ${initialStatus}
              </div>
            </div>
            <div class="card" style="min-height:400px; height:60vh; max-height:800px; display:flex; flex-direction:column; padding:0; overflow:hidden">
              <div style="padding:14px 16px;border-bottom:1px solid var(--border);font-size:15px;font-weight:600">💬 Chat da Tarefa</div>
              <div class="chat-messages" id="task-chat-messages">
                ${messages.length === 0 ? '<div class="empty-state-text" style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px">Converse com o agente responsável</div>' : ''}
                ${messages.map(m => {
                  let actionsHtml = '';
                  if (m.metadata) {
                    try {
                      const meta = JSON.parse(m.metadata);
                      if (meta.actions && meta.actions.length > 0) {
                        actionsHtml = '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text-muted)">';
                        meta.actions.forEach(a => { actionsHtml += `<div>🔧 ${a.tool} → ${a.result.success ? '✅' : '❌'}</div>`; });
                        actionsHtml += '</div>';
                      }
                      if (meta.requires_approval) {
                         actionsHtml += `
                            <div class="approval-actions" style="margin-top:12px;display:flex;gap:8px">
                              <button class="btn btn-sm" style="background:var(--accent-success);color:white;padding:4px 12px;font-size:12px" onclick="TaskDetailPage.approveAction('${meta.action}', ${meta.task_id || id}, ${JSON.stringify(meta.args || {}).replace(/"/g, '&quot;')})">✅ Aprovar</button>
                              <button class="btn btn-sm btn-danger" style="padding:4px 12px;font-size:12px" onclick="TaskDetailPage.rejectAction()">❌ Negar</button>
                            </div>
                         `;
                      }
                    } catch(e) {}
                  }
                  return `
                  <div class="chat-bubble ${m.role}">
                    <div class="sender">
                      <span>${m.role === 'user' ? '👤 Você/Sistema' : (m.agent_emoji || '🤖') + ' ' + (m.agent_name || 'Agente')}</span>
                      <span class="chat-time">${formatTime(m.created_at)}</span>
                    </div>
                    ${ProjectDetailPage && ProjectDetailPage.formatMarkdown ? ProjectDetailPage.formatMarkdown(m.content) : m.content}
                    ${actionsHtml}
                  </div>
                  `;
                }).join('')}
              </div>
              <div id="approval-bar-container">
                ${task.status === 'review_pending' ? `
                  <div style="background:var(--bg-lighter);border-top:2px solid var(--accent-success);padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px">
                    <div style="font-size:13px;font-weight:600">🚀 Tarefa aguardando sua aprovação final!</div>
                    <div style="display:flex;gap:8px">
                      <button class="btn btn-secondary btn-sm" onclick="ReviewsPage.reject(${id})">❌ Ajustes</button>
                      <button class="btn btn-sm" style="background:var(--accent-success);color:white" onclick="ReviewsPage.approve(${id})">✅ Aprovar</button>
                    </div>
                  </div>
                ` : ''}
              </div>
              <div class="chat-input-area">
                <input type="text" id="task-chat-input" placeholder="Mensagem..." onkeydown="if(event.key==='Enter')TaskDetailPage.sendChat(${id})">
                <button onclick="TaskDetailPage.sendChat(${id})">➤</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  setupSocket(taskId) {
    Socket.off('chat:message');
    Socket.on('chat:message', (msg) => {
      const chatArea = document.getElementById('task-chat-messages');
      if (!chatArea) return;

      const emptyState = chatArea.querySelector('.empty-state-text');
      if (emptyState) emptyState.remove();

      const liveStatus = document.getElementById('ai-live-status');
      if (liveStatus) {
         liveStatus.innerHTML = `<span style="color:var(--success)">✅ Resposta gerada / Aguardando...</span>`;
      }

      let actionsHtml = '';
      if (msg.metadata) {
        try {
          const meta = JSON.parse(msg.metadata);
          if (meta.actions && meta.actions.length > 0) {
            actionsHtml = '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text-muted)">';
            meta.actions.forEach(a => { actionsHtml += `<div>🔧 ${a.tool} → ${a.result.success ? '✅' : '❌'}</div>`; });
            actionsHtml += '</div>';
          }
          if (meta.requires_approval) {
             actionsHtml += `
                <div class="approval-actions" style="margin-top:12px;display:flex;gap:8px">
                  <button class="btn btn-sm" style="background:var(--accent-success);color:white;padding:4px 12px;font-size:12px" onclick="TaskDetailPage.approveAction('${meta.action}', ${meta.task_id || taskId}, ${JSON.stringify(meta.args || {}).replace(/"/g, '&quot;')})">✅ Aprovar</button>
                  <button class="btn btn-sm btn-danger" style="padding:4px 12px;font-size:12px" onclick="TaskDetailPage.rejectAction()">❌ Negar</button>
                </div>
             `;
          }
        } catch(e) {}
      }

      const senderName = msg.role === 'user' ? '👤 Você/Sistema' : (msg.agent_emoji || '🤖') + ' ' + (msg.agent_name || 'Agente');
      const newMsg = document.createElement('div');
      newMsg.className = `chat-bubble ${msg.role}`;
      newMsg.innerHTML = `
        <div class="sender">
          <span>${senderName}</span>
          <span class="chat-time">${formatTime(msg.created_at || new Date().toISOString())}</span>
        </div>
        ${ProjectDetailPage && ProjectDetailPage.formatMarkdown ? ProjectDetailPage.formatMarkdown(msg.content) : msg.content}
        ${actionsHtml}
      `;
      chatArea.appendChild(newMsg);
      chatArea.scrollTop = chatArea.scrollHeight;

      // Update approval bar if needed
      const container = document.getElementById('approval-bar-container');
      if (container && msg.role === 'assistant') {
         API.getTask(taskId).then(t => {
            if (t.status === 'review_pending') {
               container.innerHTML = `
                  <div style="background:var(--bg-lighter);border-top:2px solid var(--accent-success);padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px">
                    <div style="font-size:13px;font-weight:600">🚀 Tarefa aguardando sua aprovação final!</div>
                    <div style="display:flex;gap:8px">
                      <button class="btn btn-secondary btn-sm" onclick="ReviewsPage.reject(${taskId})">❌ Ajustes</button>
                      <button class="btn btn-sm" style="background:var(--accent-success);color:white" onclick="ReviewsPage.approve(${taskId})">✅ Aprovar</button>
                    </div>
                  </div>
               `;
            }
         });
      }
    });

    Socket.off('agent:thinking');
    Socket.on('agent:thinking', (data) => {
      const liveStatus = document.getElementById('ai-live-status');
      if (liveStatus && data.action) {
         liveStatus.innerHTML = `<span class="typing-dots" style="color:var(--accent);font-size:14px;margin-right:8px">● ● ●</span> <span style="color:var(--text)">${data.action}</span>`;
      }
    });
  },

  async updateStatus(id, status) {
    try { 
      await API.updateTask(id, { status }); 
      Toast.success('Status atualizado'); 
      if (status === 'completed' || status === 'review_pending') App.refresh();
    } catch (e) { Toast.error(e.message); }
  },

  async editTask(id) {
    try {
      const task = await API.getTask(id);
      const agents = await API.getAgents();
      const projects = await API.getProjects();

      Modal.show(`
        <div class="modal-header"><h2>⚙️ Editar Tarefa</h2><button class="modal-close" onclick="Modal.close()">×</button></div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Título</label>
            <input class="form-input" id="edit-task-title" value="${this.escapeHtml(task.title)}">
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-textarea" id="edit-task-desc" rows="3">${this.escapeHtml(task.description || '')}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Projeto</label>
              <select class="form-select" id="edit-task-project">
                <option value="">Tarefa avulsa</option>
                ${projects.map(p => `<option value="${p.id}" ${task.project_id === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Agentes Responsáveis</label>
              <div id="edit-task-agents" class="agent-checklist" style="max-height:160px">
                ${agents.map(a => `
                  <label class="agent-check-item">
                    <input type="checkbox" value="${a.id}" ${(task.agents || []).some(ta => ta.id === a.id) || task.agent_id === a.id ? 'checked' : ''}>
                    <span class="agent-avatar" style="width:28px;height:28px;font-size:14px">${a.avatar_emoji || '🤖'}</span>
                    <div>
                      <div style="font-size:13px;font-weight:500">${a.name}</div>
                      <div style="font-size:11px;color:var(--text-muted)">${a.role || ''}</div>
                    </div>
                    <span class="status-badge ${a.status}" style="margin-left:auto;font-size:10px"><span class="dot"></span>${a.status}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Prioridade</label>
              <select class="form-select" id="edit-task-priority">
                <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
          <button class="btn btn-primary" onclick="TaskDetailPage.saveEdit(${id})">Salvar Mudanças</button>
        </div>
      `);
    } catch (e) { Toast.error(e.message); }
  },

  async saveEdit(id) {
    const title = document.getElementById('edit-task-title').value.trim();
    if (!title) return Toast.error('Título é obrigatório');
    const checkedAgents = document.querySelectorAll('#edit-task-agents input[type="checkbox"]:checked');
    const agent_ids = Array.from(checkedAgents).map(c => parseInt(c.value));
    
    try {
      await API.updateTask(id, {
        title,
        description: document.getElementById('edit-task-desc').value,
        project_id: document.getElementById('edit-task-project').value || null,
        agent_ids,
        priority: document.getElementById('edit-task-priority').value
      });
      Modal.close();
      Toast.success('Tarefa atualizada!');
      App.refresh();
    } catch (e) { Toast.error(e.message); }
  },

  async toggleCheck(taskId, index, done) {
    try {
      const task = await API.getTask(taskId);
      let checklist = JSON.parse(task.checklist || '[]');
      checklist[index].done = done;
      await API.updateTask(taskId, { checklist: JSON.stringify(checklist) });
      App.refresh();
    } catch(e) { Toast.error(e.message); }
  },

  async addSubtask(taskId) {
    const input = document.getElementById('new-subtask-input');
    const text = input.value.trim();
    if (!text) return;
    try {
      await API.sendMessage('task', taskId, { role: 'system', content: `SUBTASK: ${text}`, metadata: JSON.stringify({ action: 'add_subtask', args: { text } }) });
      // Actually we have a tool for this in orchestrator, but for manual entry:
      const task = await API.getTask(taskId);
      let checklist = JSON.parse(task.checklist || '[]');
      checklist.push({ text, done: false, created_by: '👤 Você' });
      await API.updateTask(taskId, { checklist: JSON.stringify(checklist) });
      input.value = '';
      App.refresh();
    } catch(e) { Toast.error(e.message); }
  },

  async sendChat(taskId) {
    const input = document.getElementById('task-chat-input');
    const content = input.value.trim();
    if (!content) return;
    input.value = '';

    const chatArea = document.getElementById('task-chat-messages');
    if (chatArea) {
      const liveStatus = document.getElementById('ai-live-status');
      if (liveStatus) {
         liveStatus.innerHTML = `<span class="typing-dots" style="color:var(--accent);font-size:14px;margin-right:8px">● ● ●</span> <span style="color:var(--text)">Iniciando processamento...</span>`;
      }
    }

    if (input) input.disabled = true;

    try {
      await API.sendAIChat('task', taskId, content);
    } catch (e) {
      Toast.error(e.message);
    } finally {
      if (input) input.disabled = false;
      if (input) input.focus();
      const ls = document.getElementById('ai-live-status');
      if (ls) ls.innerHTML = '';
    }
  },

  async approveAction(action, contextId, args) {
    try {
      if (action === 'complete_task') {
        await API.updateTask(contextId, { status: 'completed' });
        await API.sendAIChat('task', contextId, "SISTEMA: O usuário aprovou a conclusão da tarefa via botão.");
      } else if (action === 'create_agent') {
        await API.sendAIChat('task', contextId, `Aprovado! Prossiga com a criação do agente "${args.name}" conforme solicitado.`);
      }
      Toast.success('Ação autorizada!');
      App.refresh();
    } catch(e) { Toast.error(e.message); }
  },

  async rejectAction() {
    Toast.info('Ação não autorizada. O agente continuará aguardando.');
  },

  escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  },

  deleteTask(id) {
    Modal.confirm('Deletar Tarefa', 'Tem certeza?', async () => {
      try { await API.deleteTask(id); Toast.success('Tarefa deletada'); App.navigate('/tasks'); } catch (e) { Toast.error(e.message); }
    });
  }
};
