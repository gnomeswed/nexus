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
    console.log('[Orchestrator] Initialized with DB and IO');
  }

  /**
   * Process a user message in a context (project or task), get AI response
   */
  async processMessage(contextType, contextId, userMessage, agentId = null) {
    if (!this.db) {
      console.error('[Orchestrator] Database not initialized!');
      return { error: 'Database not initialized' };
    }

    // Find the agent to respond
    let agent;
    if (agentId) {
      agent = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
      if (!agent) console.warn(`[Orchestrator] Agent ID ${agentId} not found in DB.`);
    } else {
      // Find agents assigned to this context
      agent = this.findContextAgent(contextType, contextId);
      if (!agent) console.warn(`[Orchestrator] No agent assigned to ${contextType} ${contextId}.`);
    }

    if (!agent) {
      return { error: 'No agent available for this context' };
    }

    console.log(`[Orchestrator] Processing message for ${agent.name} (ID: ${agent.id}) in ${contextType} ${contextId}`);

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
      const permissions = JSON.parse(agent.permissions || '{}');
      console.log(`[Orchestrator] Requesting AI (ID: ${agent.id}) in ${contextType}:${contextId}`);
      
      let response = await aiClient.chat(agent, messages, { enableTools: true });
      console.log(`[Orchestrator] AI Raw Response:`, response.tool_calls ? `Tool Calls: ${response.tool_calls.length}` : 'Text Response');
      
      const actions = [];
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
          
          let parsedArgs;
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (err) {
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: `JSON Parse Error: ${err.message}. Please fix your tool arguments formatting.` })
            });
            continue;
          }

          const result = await this.executeTool(
            toolCall.function.name,
            parsedArgs,
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

      // Filter out internal thinking/monologue if the model outputs it
      let cleanContent = response.content || '';
      
      // 1. Remove explicit <thought> tags
      cleanContent = cleanContent.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
      
      // 2. Remove common internal monologue start patterns (English and PT)
      const monologuePatterns = [
        /^(Thought|Thinking|Raciocínio|Análise):\s*/i,
        /^Okay, let me see what the user is asking/i,
        /^Okay, the user just said/i,
        /^First, I need to/i,
        /^I should/i
      ];
      
      monologuePatterns.forEach(p => {
        cleanContent = cleanContent.replace(p, '').trim();
      });

      // 3. If there are multiple paragraphs and the first one looks like planning, skip it
      const paragraphs = cleanContent.split('\n\n');
      if (paragraphs.length > 1) {
        const firstPara = paragraphs[0].toLowerCase();
        if (firstPara.includes('i should') || firstPara.includes('i will') || firstPara.includes('let me') || firstPara.includes('the user is asking')) {
           cleanContent = paragraphs.slice(1).join('\n\n').trim();
        }
      }

      // Save AI response as message
      const savedMsg = this.saveMessage(contextType, contextId, agent.id, 'assistant', cleanContent, { actions, model: response.model, usage: response.usage });

      // Emit via WebSocket
      if (this.io) {
        const room = `${contextType}:${contextId}`;
        this.io.to(room).emit('chat:message', savedMsg);
        this.io.emit('activity:new', savedMsg);
      }

      // Check if summarization is needed (async)
      const msgCount = this.db.prepare(`SELECT count(*) as c FROM messages WHERE context_type = ? AND context_id = ? AND role IN ('user', 'assistant') AND is_summary = 0 AND archived = 0`).get(contextType, contextId);
      if (msgCount && msgCount.c > 20) {
        setTimeout(() => this.summarizeHistory(contextType, contextId).catch(console.error), 100);
      }

      return {
        message: savedMsg,
        actions,
        model: response.model,
        usage: response.usage
      };
    } catch (error) {
      const errorAgentId = typeof agent !== 'undefined' && agent ? agent.id : null;
      const errMsg = this.saveMessage(contextType, contextId, errorAgentId, 'system', `❌ Error: ${error.message}`, {});

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
        
        // HARD BLOCK: Inside a task context, force subtask instead
        if (contextType === 'task') {
          return this.executeTool('add_subtask', { task_id: contextId, text: args.title + (args.description ? ' — ' + args.description : '') }, agent, contextType, contextId, projectFolder);
        }
        
        const projectId = contextType === 'project' ? contextId : null;
        const result = this.db.prepare(`
          INSERT INTO tasks (project_id, agent_id, title, description, priority, status)
          VALUES (?, ?, ?, ?, ?, 'pending')
        `).run(projectId, agent.id, args.title, args.description || '', args.priority || 'medium');

        const task = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
        if (this.io) this.io.emit('task:created', task);
        return { success: true, task_id: task.id, message: `Task created: ${args.title}` };
      }

      case 'delegate_task': {
        if (!permissions.delegate_tasks) return { error: 'Permission denied: delegate_tasks. Este agente não tem permissão para delegar tarefas. Faça o trabalho usando create_file/edit_file.' };
        
        // HARD BLOCK: Inside a task context, force subtask instead of creating new tasks
        if (contextType === 'task') {
          const subtaskResult = this.executeTool('add_subtask', { task_id: contextId, text: `[Delegado] ${args.title}` + (args.description ? ' — ' + args.description : '') }, agent, contextType, contextId, projectFolder);
          return { success: true, message: `SISTEMA: delegate_task bloqueado dentro de tarefa. Subtarefa adicionada ao roadmap. Execute o trabalho AQUI usando create_file/edit_file.` };
        }
        
        const projectId = contextType === 'project' ? contextId : null;
        
        // Verify if agent_id exists
        const targetAgent = this.db.prepare('SELECT id FROM agents WHERE id = ?').get(args.agent_id);
        if (!targetAgent) return { error: `Agent ID ${args.agent_id} not found.` };

        const result = this.db.prepare(`
          INSERT INTO tasks (project_id, agent_id, title, description, priority, status)
          VALUES (?, ?, ?, ?, 'medium', 'pending')
        `).run(projectId, args.agent_id, args.title, args.description || '');

        const taskId = result.lastInsertRowid;
        const task = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        if (this.io) this.io.emit('task:created', task);

        // Auto-trigger the worker agent immediately
        setTimeout(() => {
          this.processMessage('task', taskId, "Você recebeu uma nova tarefa delegada. Analise a descrição, mude o status para 'in_progress' e comece o trabalho. Use as ferramentas create_file/edit_file diretamente. NÃO delegue para outros agentes. Quando finalizar, avise que terminou.", args.agent_id).catch(console.error);
        }, 1000);

        return { success: true, task_id: taskId, message: `Task delegated successfully to agent ${args.agent_id}: ${args.title}` };
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
        if (this.io) this.io.emit('task:updated', { id: targetTaskId, status: args.status });

        // If status is review_pending, notify the project manager in the project chat
        if (args.status === 'review_pending') {
          const taskInfo = this.db.prepare('SELECT project_id, title, agent_id FROM tasks WHERE id = ?').get(targetTaskId);
          if (taskInfo && taskInfo.project_id) {
             const manager = this.findContextAgent('project', taskInfo.project_id);
             if (manager) {
                const worker = this.db.prepare('SELECT name FROM agents WHERE id = ?').get(taskInfo.agent_id);
                const workerName = worker ? worker.name : 'O trabalhador';
                
                setTimeout(() => {
                  // This triggers the manager in the project context
                  this.processMessage('project', taskInfo.project_id, `SISTEMA: ${workerName} finalizou a tarefa "${taskInfo.title}" e ela está aguardando sua revisão. Verifique os arquivos e decida se aprova ou pede ajustes.`, manager.id).catch(console.error);
                }, 1500);
             }
          }
        }

        return { success: true, message: `Task ${targetTaskId} status updated to ${args.status}` };
      }

      case 'add_subtask': {
        if (!permissions.create_tasks) return { error: 'Permission denied: create_tasks. Apenas o Gerente pode criar subtasks. Faça o trabalho e avise que terminou.' };
        const targetTaskId = args.task_id || (contextType === 'task' ? contextId : null);
        if (!targetTaskId) return { error: 'No task_id provided and not in a task context' };

        const task = this.db.prepare('SELECT checklist FROM tasks WHERE id = ?').get(targetTaskId);
        if (!task) return { error: 'Task not found' };
        
        let checklist = [];
        try { checklist = JSON.parse(task.checklist || '[]'); } catch(e) {}
        
        const pad = (n) => n.toString().padStart(2, '0');
        const now = new Date();
        const timestamp = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const creatorName = agent ? `${agent.avatar_emoji || '🤖'} ${agent.name}` : '👤 Humano';

        checklist.push({ 
          text: args.text, 
          done: false,
          created_by: creatorName,
          created_at: timestamp
        });
        
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

    system += '\n--- MULTI-AGENT ORCHESTRATION PROTOCOL ---\n';
    system += 'LANGUAGE: Respond EXCLUSIVELY in Portuguese (pt-BR). This is mandatory.\n';
    system += 'NO MONOLOGUE: Do not output your internal thinking, reasoning, or "Thought" blocks in the chat. Output only the final response.\n';
    system += 'Be concise, professional, and actionable.\n';
    system += 'You are part of a Hierarchical Multi-Agent System (Manager -> Workers).\n\n';
    
    system += '=== IF YOU ARE A MANAGER (Lead Agent) ===\n';
    system += '1. AUTONOMY: Your goal is to deliver the final result. DO NOT wait for the human to approve every small step. Proceed automatically until the task is complete.\n';
    system += '2. VISUAL ROADMAP (STRICT): You MUST use the `add_subtask` tool to populate the task\'s Roadmap. NEVER just list steps in text. If it\'s not in the Roadmap tool, it doesn\'t exist.\n';
    system += '3. DELEGATION VS EXECUTION: If there are other worker agents available, use `delegate_task`. IF YOU ARE ALONE OR NO WORKERS ARE ASSIGNED, YOU MUST EXECUTE THE WORK YOURSELF using `create_file` and `edit_file` immediately.\n';
    system += '4. NO PROCRASTINATION: Do not say "I will now do X". Just do X using your tools.\n';
    system += '5. REVIEW: Use `read_file` to check quality. Only ask the human for approval at the VERY END ("versão final").\n';
    system += '6. IDIOM: Always respond in Portuguese (PT-BR). Never use English for chat.\n\n';
    
    system += '=== EXPLOITS & EXAMPLES ===\n';
    system += 'User: "Mude o status para review_pending"\n';
    system += 'Assistant: [call update_task_status(status="review_pending")] "Status atualizado para review_pending. O script está pronto para sua análise."\n\n';
    system += 'User: "Adicione o passo de testes"\n';
    system += 'Assistant: [call add_subtask(text="Testar funcionalidades")] "Passo de testes adicionado ao Roadmap."\n\n';

    system += '=== IF YOU ARE A WORKER (e.g. Dev/Estagiário) ===\n';
    system += '1. EXECUTION: Write code strictly according to the task description. Use `create_file` or `edit_file`.\n';
    system += '2. NO CODE IN CHAT: NEVER paste large code blocks in the chat. This bloats the token context.\n';
    system += '3. COMPLETION: When you finish your work, reply in chat: "Arquivo criado em [caminho]. Aguardando revisão do Gerente."\n';
    system += '4. DO NOT COMPLETE TASKS: Only the Human or Manager can use `update_task_status` to "completed".\n\n';

    system += '=== TASK RESOLUTION PROTOCOL (MANDATORY) ===\n';
    system += '1. EXECUTION: Worker performs the task via tools.\n';
    system += '2. REVIEW: Worker tells Manager it is ready.\n';
    system += '3. QUALITY CHECK: Manager verifies the file using `read_file`.\n';
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
    const summaryMsg = this.db.prepare(`
      SELECT role, content FROM messages
      WHERE context_type = ? AND context_id = ? AND is_summary = 1 AND archived = 0
      ORDER BY created_at DESC LIMIT 1
    `).get(contextType, contextId);

    const rows = this.db.prepare(`
      SELECT role, content FROM messages
      WHERE context_type = ? AND context_id = ? AND role IN ('user', 'assistant') AND is_summary = 0 AND archived = 0
      ORDER BY created_at DESC LIMIT ?
    `).all(contextType, contextId, limit);

    const history = rows.reverse().map(r => ({ role: r.role, content: r.content }));

    if (summaryMsg) {
      history.unshift({ role: 'system', content: `[MEMÓRIA DE LONGO PRAZO - RESUMO DO INÍCIO DA CONVERSA]\n${summaryMsg.content}` });
    }

    return history;
  }

  /**
   * Asynchronously summarizes old messages to save tokens
   */
  async summarizeHistory(contextType, contextId) {
    if (this._summarizing && this._summarizing[`${contextType}:${contextId}`]) return;
    this._summarizing = this._summarizing || {};
    this._summarizing[`${contextType}:${contextId}`] = true;

    try {
      const rows = this.db.prepare(`
        SELECT id, role, content FROM messages
        WHERE context_type = ? AND context_id = ? AND role IN ('user', 'assistant') AND is_summary = 0 AND archived = 0
        ORDER BY created_at ASC
      `).all(contextType, contextId);

      if (rows.length < 15) return; // Not enough to summarize

      // Keep the 5 most recent messages intact, summarize the rest
      const messagesToArchive = rows.slice(0, rows.length - 5);
      const idsToArchive = messagesToArchive.map(r => r.id);

      const existingSummary = this.db.prepare(`
        SELECT content FROM messages
        WHERE context_type = ? AND context_id = ? AND is_summary = 1 AND archived = 0
        ORDER BY created_at DESC LIMIT 1
      `).get(contextType, contextId);

      let prompt = "Sua tarefa é resumir detalhadamente os eventos desta conversa técnica. Responda APENAS com o resumo, sem introduções ou monólogos em inglês. Foque em: decisões tomadas, arquivos criados e status das tarefas.\n\n";
      if (existingSummary) {
         prompt += "=== RESUMO ANTERIOR ===\n" + existingSummary.content + "\n\n=== NOVAS MENSAGENS PARA ADICIONAR AO RESUMO ===\n";
      } else {
         prompt += "=== MENSAGENS ===\n";
      }

      messagesToArchive.forEach(m => {
         // Truncate giant code blocks just in case they slipped through
         const safeContent = m.content.length > 1000 ? m.content.substring(0, 1000) + '...[truncado]' : m.content;
         prompt += `[${m.role.toUpperCase()}]: ${safeContent}\n`;
      });

      const agent = this.findContextAgent(contextType, contextId);
      if (!agent) return;

      const response = await aiClient.chat(agent, [{ role: 'user', content: prompt }], { enableTools: false });
      
      if (response && response.content) {
         // Insert new summary
         this.db.prepare(`
           INSERT INTO messages (context_type, context_id, agent_id, role, content, metadata, is_summary, archived)
           VALUES (?, ?, ?, 'system', ?, '{}', 1, 0)
         `).run(contextType, contextId, agent.id, response.content);

         // Archive old summary and old messages
         this.db.prepare(`UPDATE messages SET archived = 1 WHERE context_type = ? AND context_id = ? AND is_summary = 1 AND content != ?`).run(contextType, contextId, response.content);
         
         const placeholders = idsToArchive.map(() => '?').join(',');
         this.db.prepare(`UPDATE messages SET archived = 1 WHERE id IN (${placeholders})`).run(...idsToArchive);
      }
    } catch (e) {
      console.error("Summarization error:", e.message);
    } finally {
      this._summarizing[`${contextType}:${contextId}`] = false;
    }
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
