// Orchestrator - The brain that coordinates agents, executes tools, and processes AI responses
const aiClient = require('./ai-client');
const fileManager = require('./file-manager');
const webSearch = require('./web-search');

class Orchestrator {
  constructor() {
    this.db = null;
    this.io = null;
  }

  init(db, io) {
    this.db = db;
    this.io = io;
  }

  /**
   * Process a user message in a context (project or task), get AI response
   */
  async processMessage(contextType, contextId, userMessage, agentId = null) {
    // Find the agent to respond
    let agent;
    if (agentId) {
      agent = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    } else {
      // Find agents assigned to this context
      agent = this.findContextAgent(contextType, contextId);
    }

    if (!agent) {
      return { error: 'No agent available for this context' };
    }

    // Get project folder for file operations
    const projectFolder = this.getProjectFolder(contextType, contextId);

    // Build conversation history
    const history = this.getConversationHistory(contextType, contextId, 20);

    // Build system message with context
    const systemMessage = this.buildSystemMessage(agent, contextType, contextId, projectFolder);

    // Save the user message to DB first if it exists
    let savedUserMsg;
    if (userMessage) {
      // Use role 'user' since this simulates the user or system prompting the agent
      savedUserMsg = this.saveMessage(contextType, contextId, null, 'user', userMessage);
      if (this.io) {
        this.io.to(`${contextType}:${contextId}`).emit('chat:message', savedUserMsg);
      }
    }

    const messages = [
      { role: 'system', content: systemMessage },
      ...history,
      { role: 'user', content: userMessage }
    ];

    try {
      if (this.io) this.io.to(`${contextType}:${contextId}`).emit('agent:thinking', { action: 'Pensando e analisando o contexto...' });

      // First AI call
      let response = await aiClient.chat(agent, messages, { enableTools: true });
      const actions = [];

      // Handle tool calls (up to 5 iterations)
      let iterations = 0;
      while (iterations < 5) {
        // Fallback: If the model writes the tool call as raw JSON in the text content instead of using the API's tool_calls array
        if (!response.tool_calls || response.tool_calls.length === 0) {
          try {
            let jsonStr = '';
            const mdMatch = response.content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (mdMatch) {
              jsonStr = mdMatch[1];
            } else {
              const rawMatch = response.content.match(/\{[\s\S]*"name"[\s\S]*"arguments"[\s\S]*\}/);
              if (rawMatch) jsonStr = rawMatch[0];
            }
            
            if (jsonStr) {
              const parsed = JSON.parse(jsonStr);
              if (parsed.name && parsed.arguments) {
                response.tool_calls = [{
                  id: 'call_fallback_' + Date.now(),
                  type: 'function',
                  function: {
                    name: parsed.name,
                    arguments: typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments)
                  }
                }];
              }
            }
          } catch (e) {
            console.error("Failed to parse hallucinated tool call:", e.message);
          }
        }

        if (!response.tool_calls || response.tool_calls.length === 0) break;

        iterations++;
        const toolResults = [];

        for (const toolCall of response.tool_calls) {
          if (this.io) this.io.to(`${contextType}:${contextId}`).emit('agent:thinking', { action: `Executando ferramenta: ${toolCall.function.name}...` });
          
          const result = await this.executeTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments || '{}'),
            agent,
            contextType,
            contextId,
            projectFolder
          );
          actions.push({ tool: toolCall.function.name, args: JSON.parse(toolCall.function.arguments || '{}'), result });

          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }

        // Add assistant message with tool calls and tool results
        messages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: response.tool_calls
        });
        messages.push(...toolResults);

        if (this.io) this.io.to(`${contextType}:${contextId}`).emit('agent:thinking', { action: 'Lendo resultado das ferramentas e gerando resposta...' });

        // Get next response
        response = await aiClient.chat(agent, messages, { enableTools: true });
      }

      // Save AI response as message
      const savedMsg = this.saveMessage(contextType, contextId, agent.id, 'assistant', response.content, { actions, model: response.model, usage: response.usage });

      // Emit via WebSocket
      if (this.io) {
        const room = `${contextType}:${contextId}`;
        this.io.to(room).emit('chat:message', savedMsg);
        this.io.emit('activity:new', savedMsg);
      }

      return {
        message: savedMsg,
        actions,
        model: response.model,
        usage: response.usage
      };
    } catch (error) {
      const errMsg = this.saveMessage(contextType, contextId, null, 'system', `❌ Error: ${error.message}`, {});

      if (this.io) {
        this.io.to(`${contextType}:${contextId}`).emit('chat:message', errMsg);
      }

      return { error: error.message, message: errMsg };
    }
  }

  /**
   * Execute a tool call from the AI
   */
  async executeTool(toolName, args, agent, contextType, contextId, projectFolder) {
    const permissions = JSON.parse(agent.permissions || '{}');

    switch (toolName) {
      case 'create_file': {
        if (!permissions.file_create) return { error: 'Permission denied: file_create' };
        if (!projectFolder) return { error: 'No project folder associated' };
        return fileManager.createFile(projectFolder, args.path, args.content);
      }

      case 'edit_file': {
        if (!permissions.file_edit) return { error: 'Permission denied: file_edit' };
        if (!projectFolder) return { error: 'No project folder associated' };
        return fileManager.editFile(projectFolder, args.path, args.search, args.replace);
      }

      case 'read_file': {
        if (!permissions.read_files) return { error: 'Permission denied: read_files' };
        if (!projectFolder) return { error: 'No project folder associated' };
        return fileManager.readFile(projectFolder, args.path);
      }

      case 'web_search': {
        if (!permissions.web_search) return { error: 'Permission denied: web_search' };
        const result = await webSearch.search(args.query);
        return { success: true, formatted: webSearch.formatResults(result), raw: result.results };
      }

      case 'create_task': {
        if (!permissions.create_tasks) return { error: 'Permission denied: create_tasks' };
        const projectId = contextType === 'project' ? contextId : null;
        const result = this.db.prepare(`
          INSERT INTO tasks (project_id, agent_id, title, description, priority, status)
          VALUES (?, ?, ?, ?, ?, 'pending')
        `).run(projectId, agent.id, args.title, args.description || '', args.priority || 'medium');

        const task = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
        if (this.io) this.io.emit('task:created', task);
        return { success: true, task_id: task.id, message: `Task created: ${args.title}` };
      }

      case 'create_agent': {
        // Enforce Human-in-the-Loop Protocol
        const lastUserMsgs = this.db.prepare("SELECT content FROM messages WHERE context_type = ? AND context_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 5").all(contextType, contextId);
        const isApproved = lastUserMsgs.some(m => m.content.toLowerCase().includes('aprovado') || m.content.toLowerCase().includes('aprovo'));
        if (!isApproved) {
          return { error: '❌ AÇÃO BLOQUEADA PELO SISTEMA: Você não pode criar agentes até que o usuário humano digite a palavra "aprovado" no chat. Peça permissão primeiro!' };
        }

        const result = this.db.prepare(`
          INSERT INTO agents (name, role, system_prompt, provider, model_id, status)
          VALUES (?, ?, ?, '9router', 'combo', 'active')
        `).run(args.name, args.role, args.system_prompt);
        return { success: true, agent_id: result.lastInsertRowid, message: `Agent created successfully: ${args.name}` };
      }

      case 'update_task_status': {
        if (args.status === 'completed') {
          // Enforce Human-in-the-Loop Protocol for completion
          const lastUserMsgs = this.db.prepare("SELECT content FROM messages WHERE context_type = ? AND context_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 5").all(contextType, contextId);
          const isApproved = lastUserMsgs.some(m => m.content.toLowerCase().includes('aprovado') || m.content.toLowerCase().includes('aprovo'));
          if (!isApproved) {
            return { error: '❌ AÇÃO BLOQUEADA PELO SISTEMA: Você não pode finalizar a tarefa (completed) até que o usuário humano digite a palavra "aprovado" no chat para o seu trabalho final.' };
          }
        }

        const targetTaskId = args.task_id || (contextType === 'task' ? contextId : null);
        if (!targetTaskId) return { error: 'No task_id provided and not in a task context' };

        const result = this.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(args.status, targetTaskId);
        if (result.changes === 0) return { error: 'Task not found' };
        if (this.io) this.io.emit('task:updated', { id: args.task_id, status: args.status });
        return { success: true, message: `Task ${args.task_id} status updated to ${args.status}` };
      }

      case 'add_subtask': {
        const targetTaskId = args.task_id || (contextType === 'task' ? contextId : null);
        if (!targetTaskId) return { error: 'No task_id provided and not in a task context' };

        const task = this.db.prepare('SELECT checklist FROM tasks WHERE id = ?').get(targetTaskId);
        if (!task) return { error: 'Task not found' };
        
        let checklist = [];
        try { checklist = JSON.parse(task.checklist || '[]'); } catch(e) {}
        checklist.push({ text: args.text, done: false });
        
        this.db.prepare('UPDATE tasks SET checklist = ? WHERE id = ?').run(JSON.stringify(checklist), targetTaskId);
        if (this.io) {
           const updatedTask = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(targetTaskId);
           this.io.emit('task:updated', updatedTask);
        }
        return { success: true, message: `Subtask added to checklist: ${args.text}` };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  /**
   * Build the system message with full context
   */
  buildSystemMessage(agent, contextType, contextId, projectFolder) {
    let system = agent.system_prompt || 'You are a helpful AI assistant.';
    system += '\n\n--- CONTEXT ---\n';

    if (contextType === 'project') {
      const project = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(contextId);
      if (project) {
        system += `Project: ${project.name}\nDescription: ${project.description}\nStatus: ${project.status}\nProgress: ${project.progress_percent}%\n`;

        // List project files
        if (projectFolder) {
          try {
            const files = fileManager.listFiles(projectFolder);
            if (files.length > 0) {
              system += '\nProject files:\n' + files.map(f => `  ${f.type === 'directory' ? '📂' : '📄'} ${f.path}`).join('\n') + '\n';
            } else {
              system += `\nYour workspace directory (${projectFolder}) is currently empty. You can create files here.\n`;
            }
          } catch (e) { /* ignore */ }
        }

        // Roadmap
        const roadmap = JSON.parse(project.roadmap || '[]');
        if (roadmap.length > 0) {
          system += '\nRoadmap:\n';
          roadmap.forEach(phase => {
            const items = phase.items || [];
            const done = items.filter(i => i.done).length;
            system += `  ${phase.name} (${done}/${items.length} done)\n`;
            items.forEach(i => { system += `    [${i.done ? 'x' : ' '}] ${i.text}\n`; });
          });
        }

        // Tasks
        const tasks = this.db.prepare("SELECT title, status, priority FROM tasks WHERE project_id = ?").all(contextId);
        if (tasks.length > 0) {
          system += '\nProject tasks:\n';
          tasks.forEach(t => { system += `  [${t.status}] ${t.title} (${t.priority})\n`; });
        }
      }
    } else if (contextType === 'task') {
      const task = this.db.prepare('SELECT t.*, p.name as project_name, p.folder_path FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?').get(contextId);
      if (task) {
        system += `Task ID: ${task.id}\nTask: ${task.title}\nDescription: ${task.description}\nStatus: ${task.status}\nPriority: ${task.priority}\n`;
        if (task.project_name) system += `Project: ${task.project_name}\n`;
      }
    }

    system += '\n--- INSTRUCTIONS ---\n';
    system += 'Respond in the same language as the user. Be concise and actionable.\n';
    system += 'When creating files, use the create_file tool. When you need information, use web_search.\n';
    system += 'You can update task statuses with update_task_status, and hire new agents with create_agent.\n\n';

    system += '=== TASK DELEGATION & SUBTASKS ===\n';
    system += 'When you are inside a Task and need to break it down into smaller steps, DO NOT use create_task. That will pollute the main board.\n';
    system += 'Instead, you MUST use the add_subtask tool to add steps to the current task\'s internal checklist.\n';
    system += 'Only use create_task if you are explicitly asked to create a completely new, independent project task.\n\n';

    system += '=== TASK RESOLUTION PROTOCOL (MANDATORY) ===\n';
    system += '1. EXECUTION: The assigned agent performs the task but DOES NOT complete it.\n';
    system += '2. REVIEW: The agent presents the final work in the chat and asks for a review.\n';
    system += '3. QUALITY CHECK: The Manager or Human verifies if all requirements were met flawlessly.\n';
    system += '4. APPROVAL: ONLY the Human (or the Manager after Human approval) can use update_task_status to set it to "completed".\n';
    system += 'CRITICAL: Never change a task to "completed" without explicit Human approval saying "aprovado".\n\n';
    
    system += 'Current date: ' + new Date().toISOString().split('T')[0] + '\n';

    return system;
  }

  /**
   * Find the best agent for a context
   */
  findContextAgent(contextType, contextId) {
    if (contextType === 'project') {
      // Get lead agent for project
      const pa = this.db.prepare(`
        SELECT a.* FROM agents a
        JOIN project_agents pa ON a.id = pa.agent_id
        WHERE pa.project_id = ? AND a.status = 'active'
        ORDER BY CASE pa.role_in_project WHEN 'lead' THEN 0 ELSE 1 END
        LIMIT 1
      `).get(contextId);
      if (pa) return pa;
    } else if (contextType === 'task') {
      const task = this.db.prepare('SELECT agent_id FROM tasks WHERE id = ?').get(contextId);
      if (task && task.agent_id) {
        return this.db.prepare('SELECT * FROM agents WHERE id = ? AND status = ?').get(task.agent_id, 'active');
      }
      // Fallback: find agent via project
      const taskProject = this.db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(contextId);
      if (taskProject && taskProject.project_id) {
        return this.findContextAgent('project', taskProject.project_id);
      }
    }

    // Global fallback: any active agent
    return this.db.prepare("SELECT * FROM agents WHERE status = 'active' ORDER BY created_at ASC LIMIT 1").get();
  }

  /**
   * Get project folder for a context
   */
  getProjectFolder(contextType, contextId) {
    if (contextType === 'project') {
      const p = this.db.prepare('SELECT folder_path FROM projects WHERE id = ?').get(contextId);
      return p?.folder_path || null;
    } else if (contextType === 'task') {
      const t = this.db.prepare('SELECT id, project_id, title FROM tasks WHERE id = ?').get(contextId);
      if (t?.project_id) {
        const p = this.db.prepare('SELECT folder_path FROM projects WHERE id = ?').get(t.project_id);
        return p?.folder_path || null;
      } else if (t) {
        // Tarefa avulsa: retorna um subdiretório exclusivo "tarefas/task_..."
        const cleanTitle = t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
        return `tarefas/task_${t.id}_${cleanTitle.substring(0, 20)}`;
      }
    }
    return null;
  }

  /**
   * Get conversation history for context
   */
  getConversationHistory(contextType, contextId, limit = 20) {
    const rows = this.db.prepare(`
      SELECT role, content FROM messages
      WHERE context_type = ? AND context_id = ? AND role IN ('user', 'assistant')
      ORDER BY created_at DESC LIMIT ?
    `).all(contextType, contextId, limit);

    return rows.reverse().map(r => ({ role: r.role, content: r.content }));
  }

  /**
   * Save a message to the database
   */
  saveMessage(contextType, contextId, agentId, role, content, metadata = {}) {
    const result = this.db.prepare(`
      INSERT INTO messages (context_type, context_id, agent_id, role, content, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(contextType, parseInt(contextId), agentId, role, content || '', JSON.stringify(metadata));

    return this.db.prepare(`
      SELECT m.*, a.name as agent_name, a.avatar_emoji as agent_emoji
      FROM messages m LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);
  }
}

module.exports = new Orchestrator();
