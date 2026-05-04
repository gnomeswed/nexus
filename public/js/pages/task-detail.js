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
          <div>
            <div class="card" style="margin-bottom:16px">
              <h3 style="margin-bottom:12px;font-size:15px">📝 Descrição</h3>
              <p style="color:var(--text-secondary);font-size:14px;line-height:1.6">${task.description || 'Sem descrição'}</p>
            </div>
            ${checklist.length ? `
            <div class="card">
              <h3 style="margin-bottom:12px;font-size:15px">☑️ Checklist</h3>
              ${checklist.map((item, i) => `
                <div class="checklist-item ${item.done ? 'done' : ''}">
                  <input type="checkbox" ${item.done ? 'checked' : ''} onchange="TaskDetailPage.toggleCheck(${id},${i},this.checked)">
                  <span>${item.text}</span>
                </div>
              `).join('')}
            </div>` : ''}
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
      if (checklist[idx]) { checklist[idx].done = checked; await API.updateTask(taskId, { checklist }); }
    } catch (e) { Toast.error(e.message); }
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
      chatArea.innerHTML += `<div class="chat-bubble assistant" id="ai-loading" style="opacity:0.6"><div class="sender">🤖 Pensando...</div>● ● ●</div>`;
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
