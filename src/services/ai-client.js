// AI Client - Simplified for 9Router
// 9Router handles ALL provider routing, model selection, and fallback.
// We just send to localhost:20128/v1 and let it decide.

class AIClient {
  constructor() {
    this.endpoint = process.env.AI_ROUTER_URL || 'http://localhost:20128/v1';
  }

  /**
   * Send a chat completion request via 9Router
   * The model field is optional - 9Router will select the best one.
   * If agent has a specific route/model configured, we pass it through.
   */
  async chat(agent, messages, options = {}) {
    let apiKey = agent.api_key || process.env.DEFAULT_API_KEY || 'nexus-os';
    let targetEndpoint = this.endpoint; // Default to 9router

    // Support for direct Ollama or Custom OpenAI connections
    if (agent.provider === 'ollama') {
      targetEndpoint = agent.api_endpoint || 'http://localhost:11434/v1';
      apiKey = 'ollama'; // Ollama doesn't require API keys but accepts dummy ones
    } else if (agent.provider === 'custom' && agent.api_endpoint) {
      targetEndpoint = agent.api_endpoint;
    }

    const body = {
      messages,
      temperature: options.temperature ?? agent.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? agent.max_tokens ?? 4096,
      stream: false
    };

    // Adicionamos o modelo se estiver configurado (ex: nome da rota no 9Router)
    if (agent.model_id && agent.model_id.trim() !== '') {
      body.model = agent.model_id.trim();
    } else {
      // Se estiver vazio, mandamos 'default' para o 9Router tentar usar sua rota padrão
      body.model = process.env.DEFAULT_MODEL || 'default';
    }

    // Add tool definitions if agent has permissions
    const permissions = JSON.parse(agent.permissions || '{}');
    const tools = this.buildTools(permissions);
    
    if (tools.length > 0 && options.enableTools !== false) {
      if (agent.provider === 'ollama') {
        // Many Ollama models (like gemma2:2b) reject native 'tools' array.
        // We inject them as text into the system prompt and let our fallback parser catch them!
        let toolsText = '\n\n=== AVAILABLE TOOLS ===\nYou have the following tools available. To use a tool, you MUST reply with a JSON block in the exact format: {"name": "tool_name", "arguments": {"arg1": "value"}}\n\n';
        tools.forEach(t => {
          toolsText += `- ${t.function.name}: ${t.function.description}\n  Arguments: ${JSON.stringify(t.function.parameters.properties)}\n`;
        });
        
        // Find system message and append
        const sysMsg = body.messages.find(m => m.role === 'system');
        if (sysMsg) sysMsg.content += toolsText;
      } else {
        // Native tool calling for 9Router/OpenAI
        body.tools = tools;
        body.tool_choice = 'auto';
      }
    }

    try {
      const response = await fetch(`${targetEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://nexus-os.local',
          'X-Title': 'Nexus OS'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI API error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        tool_calls: data.choices?.[0]?.message?.tool_calls || null,
        model: data.model,
        usage: data.usage,
        finish_reason: data.choices?.[0]?.finish_reason
      };
    } catch (error) {
      if (error.name === 'TimeoutError') {
        throw new Error('AI request timed out after 120s');
      }
      throw error;
    }
  }

  /**
   * Build OpenAI-compatible tool definitions based on agent permissions
   */
  buildTools(permissions) {
    const tools = [];

    if (permissions.file_create || permissions.file_edit) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_file',
          description: 'Create or overwrite a file in the project directory',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative file path (e.g. src/index.js)' },
              content: { type: 'string', description: 'File content to write' }
            },
            required: ['path', 'content']
          }
        }
      });
    }

    if (permissions.file_edit) {
      tools.push({
        type: 'function',
        function: {
          name: 'edit_file',
          description: 'Read and edit an existing file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative file path to edit' },
              search: { type: 'string', description: 'Text to search for in the file' },
              replace: { type: 'string', description: 'Replacement text' }
            },
            required: ['path', 'search', 'replace']
          }
        }
      });
    }

    if (permissions.read_files) {
      tools.push({
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read the content of a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative file path to read' }
            },
            required: ['path']
          }
        }
      });
    }

    if (permissions.web_search) {
      tools.push({
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the internet for information',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
          }
        }
      });
    }

    if (permissions.create_tasks) {
      tools.push({
        type: 'function',
        function: {
          name: 'create_task',
          description: 'Create a new independent task for tracking work. DO NOT use this for subtasks.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
              description: { type: 'string', description: 'Task description' },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }
            },
            required: ['title']
          }
        }
      });
      
      tools.push({
        type: 'function',
        function: {
          name: 'add_subtask',
          description: 'Add a subtask step to the current task\'s checklist.',
          parameters: {
            type: 'object',
            properties: {
              task_id: { type: 'integer', description: 'ID of the current task' },
              text: { type: 'string', description: 'Description of the subtask/step' }
            },
            required: ['task_id', 'text']
          }
        }
      });
      
      tools.push({
        type: 'function',
        function: {
          name: 'update_task_status',
          description: 'Update the status of a task.',
          parameters: {
            type: 'object',
            properties: {
              task_id: { type: 'integer', description: 'ID of the task to update' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] }
            },
            required: ['task_id', 'status']
          }
        }
      });
      
      tools.push({
        type: 'function',
        function: {
          name: 'create_agent',
          description: 'Hire and create a new agent in the system.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the agent' },
              role: { type: 'string', description: 'Role of the agent' },
              system_prompt: { type: 'string', description: 'System prompt and instructions for the new agent' }
            },
            required: ['name', 'role', 'system_prompt']
          }
        }
      });
    }

    return tools;
  }
}

module.exports = new AIClient();
