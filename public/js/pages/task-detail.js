// Task detail page
const TaskDetailPage = {
  async render(id) {
    let task;
    try { task = await API.getTask(id); } catch (e) {
      return `<div class="page-body"><div class="empty-state"><div class="icon">❌</div><h3>Tarefa não encontrada</h3></div></div>`;
    }

    const checklist = JSON.parse(task.checklist || '[]');
    const messages = task.messages || [];

    // Join WebSocket room for live chat
    setTimeout(() => {
      Socket.joinRoom('task', id);
      Socket.off('chat:message'); // Limpa os "ouvidos" antigos para não duplicar
      Socket.on('chat:message', (msg) => {
        const chatArea = document.getElementById('task-chat-messages');
        if (!chatArea) return; // If we navigated away
        
        // Remove empty state and loading if any
        const emptyState = chatArea.querySelector('.empty-state-text');
        if (emptyState) emptyState.remove();
        const loading = document.getElementById('ai-loading');
        if (loading) loading.remove();

        let actionsHtml = '';
        if (msg.metadata) {
          try {
            const meta = JSON.parse(msg.metadata);
            if (meta.actions && meta.actions.length > 0) {
              actionsHtml = '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text-muted)">';
              meta.actions.forEach(a => { actionsHtml += `<div>🔧 ${a.tool} → ${a.result.success ? '✅' : '❌'}</div>`; });
              actionsHtml += '</div>';
            }
          } catch(e) {}
        }

        const senderName = msg.role === 'user' ? '👤 Você/Sistema' : (msg.agent_emoji || '🤖') + ' ' + (msg.agent_name || 'Agente');
        
        chatArea.innerHTML += `<div class="chat-bubble ${msg.role}"><div class="sender">${senderName}</div>${ProjectDetailPage && ProjectDetailPage.formatMarkdown ? ProjectDetailPage.formatMarkdown(msg.content) : msg.content}${actionsHtml}</div>`;
        chatArea.scrollTop = chatArea.scrollHeight;
      });

      Socket.off('agent:thinking');
      Socket.on('agent:thinking', (data) => {
        const chatArea = document.getElementById('task-chat-messages');
        if (!chatArea) return;
        
        let loading = document.getElementById('ai-loading');
        if (!loading) {
          chatArea.innerHTML += `<div class="chat-bubble assistant" id="ai-loading" style="opacity:0.8;border-color:var(--accent)"><div class="sender">🤖 Agente Trabalhando...</div><div id="ai-loading-action"></div><div class="typing-dots">● ● ●</div></div>`;
          loading = document.getElementById('ai-loading');
        }
        
        const actionSpan = document.getElementById('ai-loading-action');
        if (actionSpan && data.action) {
           actionSpan.innerHTML = `<span style="font-size:12px;color:var(--text-secondary);display:block;margin:6px 0;font-family:'JetBrains Mono', monospace">⏳ ${data.action}</span>`;
        }
        
        chatArea.scrollTop = chatArea.scrollHeight;
      });
    }, 100);

    return `
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:14px">
          <button class="btn btn-secondary btn-icon" onclick="App.navigate('/tasks')">←</button>
          <div>
            <h1>✅ ${task.title}</h1>
            <div class="subtitle">${task.project_name ? '📁 ' + task.project_name : 'Tarefa avulsa'} · ${task.agent_name ? task.agent_emoji + ' ' + task.agent_name : 'Sem agente'}</div>
          </div>
          <span class="status-badge ${task.status}"><span class="dot"></span>${task.status}</span>
          <span class="priority-badge ${task.priority}">${task.priority}</span>
        </div>
        <div style="display:flex;gap:8px">
          <select class="form-select" style="width:auto;padding:6px 30px 6px 10px;font-size:13px" onchange="TaskDetailPage.updateStatus(${id},this.value)">
            <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="cancelled" ${task.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
          <button class="btn btn-danger btn-sm" onclick="TaskDetailPage.deleteTask(${id})">🗑️</button>
        </div>
      </div>
      <div class="page-body">
        <div class="grid-2">
          <div style="display:flex;flex-direction:column;gap:16px">
            <div class="card">
              <h3 style="margin-bottom:12px;font-size:15px;display:flex;align-items:center;gap:8px">📝 <span>Descrição do Projeto</span></h3>
              <p style="color:var(--text-secondary);font-size:14px;line-height:1.6">${task.description || 'Sem descrição'}</p>
            </div>
            <div class="card" style="display:flex;flex-direction:column;flex:1">
              <h3 style="margin-bottom:16px;font-size:15px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:12px">
                <span>🗺️ Roadmap & Entregáveis</span>
                <span style="font-size:12px;background:var(--bg-lighter);padding:4px 8px;border-radius:12px;color:var(--text-secondary)">
                  ${checklist.filter(c => c.done).length} / ${checklist.length} concluídos
                </span>
              </h3>
              <div id="task-checklist-container" style="position:relative;padding-left:12px;flex:1">
                <div style="position:absolute;left:4px;top:8px;bottom:8px;width:2px;background:var(--border);border-radius:2px"></div>
                ${checklist.length === 0 ? '<div style="color:var(--text-muted);font-size:13px;padding:16px 0 16px 16px;">O roadmap ainda não tem etapas definidas.</div>' : ''}
                ${checklist.map((item, i) => `
                  <div class="checklist-item ${item.done ? 'done' : ''}" style="position:relative;display:flex;align-items:flex-start;gap:12px;padding:12px 0 12px 20px;transition:opacity 0.2s">
                    <div style="position:absolute;left:-8px;top:15px;width:12px;height:12px;border-radius:50%;background:${item.done ? 'var(--primary)' : 'var(--bg-lighter)'};border:2px solid ${item.done ? 'var(--primary)' : 'var(--border)'};z-index:2;box-shadow:0 0 0 4px var(--bg-light)"></div>
                    <input type="checkbox" ${item.done ? 'checked' : ''} onchange="TaskDetailPage.toggleCheck(${id},${i},this.checked)" style="margin-top:2px;accent-color:var(--primary);cursor:pointer;width:16px;height:16px">
                    <span style="flex:1;font-size:14px;line-height:1.4;color:${item.done ? 'var(--text-muted)' : 'var(--text)'};text-decoration:${item.done ? 'line-through' : 'none'};transition:all 0.2s">${item.text}</span>
                  </div>
                `).join('')}
              </div>
              <div style="display:flex;gap:8px;margin-top:24px;border-top:1px solid var(--border);padding-top:16px">
                <input type="text" id="new-subtask-input" class="form-input" style="background:var(--bg-lighter);border-color:transparent" placeholder="Adicionar nova etapa ao roadmap..." onkeydown="if(event.key==='Enter')TaskDetailPage.addSubtask(${id})">
                <button class="btn btn-primary btn-sm" style="padding:0 16px" onclick="TaskDetailPage.addSubtask(${id})">Adicionar</button>
              </div>
            </div>
          </div>
          <div>
            <div class="card" style="height:400px;display:flex;flex-direction:column;padding:0;overflow:hidden">
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
                    } catch(e) {}
                  }
                  return `
                  <div class="chat-bubble ${m.role}">
                    <div class="sender">${m.role === 'user' ? '👤 Você/Sistema' : (m.agent_emoji || '🤖') + ' ' + (m.agent_name || 'Agente')}</div>
                    ${ProjectDetailPage && ProjectDetailPage.formatMarkdown ? ProjectDetailPage.formatMarkdown(m.content) : m.content}
                    ${actionsHtml}
                  </div>
                  `;
                }).join('')}
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

  async updateStatus(id, status) {
    try { await API.updateTask(id, { status }); Toast.success('Status atualizado'); } catch (e) { Toast.error(e.message); }
  },

  async toggleCheck(taskId, idx, checked) {
    try {
      const task = await API.getTask(taskId);
      const checklist = JSON.parse(task.checklist || '[]');
      if (checklist[idx]) { checklist[idx].done = checked; await API.updateTask(taskId, { checklist }); App.refresh(); }
    } catch (e) { Toast.error(e.message); }
  },

  async addSubtask(taskId) {
    const input = document.getElementById('new-subtask-input');
    const text = input.value.trim();
    if (!text) return;
    input.disabled = true;

    try {
      const task = await API.getTask(taskId);
      const checklist = JSON.parse(task.checklist || '[]');
      checklist.push({ text, done: false });
      await API.updateTask(taskId, { checklist });
      App.refresh(); // recarrega a tela para mostrar
    } catch (e) { Toast.error(e.message); }
    finally { if (input) { input.disabled = false; input.value = ''; input.focus(); } }
  },

  async sendChat(taskId) {
    const input = document.getElementById('task-chat-input');
    const content = input.value.trim();
    if (!content) return;
    input.value = '';

    const chatArea = document.getElementById('task-chat-messages');
    if (chatArea) {
      // We don't append the user message manually anymore because the server will broadcast it back to us via socket!
      // Just add the loading state.
      chatArea.innerHTML += `<div class="chat-bubble assistant" id="ai-loading" style="opacity:0.8;border-color:var(--accent)"><div class="sender">🤖 Agente Trabalhando...</div><div id="ai-loading-action"></div><div class="typing-dots">● ● ●</div></div>`;
      chatArea.scrollTop = chatArea.scrollHeight;
    }

    if (input) input.disabled = true;

    try {
      // The HTTP call still saves the user message and returns the AI message.
      // But because we added Socket listener, BOTH will be broadcasted and added twice if we aren't careful.
      // Wait, /api/ai/chat does not broadcast the USER message, only the assistant message via orchestrator?
      // Actually, orchestrator NOW broadcasts the user message. 
      // And /api/ai/chat ALSO saves the user message manually (without broadcasting).
      // So let's just let the socket handle appending. We don't append manually here anymore except the loading state!
      await API.sendAIChat('task', taskId, content);
      // The socket listener will remove the loading indicator and append the new messages.
    } catch (e) {
      const loading = document.getElementById('ai-loading');
      if (loading) loading.remove();
      Toast.error(e.message);
    } finally {
      if (input) { input.disabled = false; input.focus(); }
    }
  },

  deleteTask(id) {
    Modal.confirm('Deletar Tarefa', 'Tem certeza?', async () => {
      try { await API.deleteTask(id); Toast.success('Tarefa deletada'); App.navigate('/tasks'); } catch (e) { Toast.error(e.message); }
    });
  }
};
