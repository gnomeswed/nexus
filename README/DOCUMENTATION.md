# Nexus OS — Documentação Oficial

> Orquestrador de Agentes de IA Autônomo · Node.js + SQLite + Vanilla JS

O Nexus OS é um painel de gerenciamento e orquestração de múltiplos agentes de IA. Ele permite criar agentes com diferentes papéis, delegar tarefas entre eles em uma hierarquia de comando, e acompanhar o trabalho em tempo real via WebSocket. Projetado para rodar em VPS ou localmente.

---

## 📐 Arquitetura Hierárquica (Humano → Gerente → Trabalhadores)

O Nexus OS utiliza uma arquitetura estrita de **3 camadas** para evitar a explosão de tokens e garantir qualidade no output:

```
┌─────────────┐
│   HUMANO    │  Cria projetos, tarefas e dá aprovação final.
└──────┬──────┘
       │ conversa via chat
       ▼
┌─────────────┐
│  GERENTE    │  Planeja, delega, revisa. Usa modelos premium (9Router).
│  (Tech Lead)│  Permissões: delegate_tasks, manage_subtasks, create_tasks
└──────┬──────┘
       │ delegate_task (cria tarefa para o trabalhador)
       ▼
┌─────────────┐
│ TRABALHADOR │  Executa: create_file, edit_file, read_file.
│ (Estagiário)│  NÃO pode delegar nem criar subtasks.
└─────────────┘  Avisa o gerente quando termina → review_pending
```

### Regras de Ouro

| Regra | Implementação |
|-------|--------------|
| **Gerente não escreve código** | Ele delega via `delegate_task` e revisa via `read_file` |
| **Trabalhador não delega** | Permissão `delegate_tasks` desativada no painel |
| **Trabalhador não cria subtasks** | Permissão `manage_subtasks` desativada no painel |
| **Subtasks ao invés de novas tarefas** | `create_task` e `delegate_task` são BLOQUEADOS por código dentro de contexto de tarefa — são convertidos em `add_subtask` automaticamente |
| **Código vai para arquivo, não chat** | System prompt instrui: "NUNCA cole código no chat" |

---

## 🛡️ Segurança: Human-in-the-Loop Protocol

Travas de segurança implementadas em nível de **código backend** (não dependem de prompt):

| Ação Protegida | Trava |
|---------------|-------|
| `create_agent` | Bloqueado até o humano digitar **"aprovado"** no chat |
| `update_task_status → completed` | Bloqueado até o humano digitar **"aprovado"** no chat |
| `delegate_task` | Requer permissão `delegate_tasks` no agente |
| `add_subtask` | Requer permissão `manage_subtasks` no agente |
| `create_task` / `delegate_task` dentro de Task | **Hard-blocked por código** — convertido automaticamente em subtask |

---

## 🔑 Sistema de Permissões por Agente

Cada agente possui permissões granulares configuráveis pela interface (página de edição do agente):

### 🏗️ Gerenciamento

| Permissão | Chave JSON | Descrição |
|-----------|-----------|-----------|
| Delegar Tarefas | `delegate_tasks` | Criar tarefas e atribuir a outros agentes |
| Gerenciar Subtasks | `manage_subtasks` | Criar/editar etapas no roadmap de tarefas |
| Criar Tarefas | `create_tasks` | Criar tarefas independentes em projetos |

### 📁 Arquivos

| Permissão | Chave JSON | Descrição |
|-----------|-----------|-----------|
| Criar Arquivos | `file_create` | Usar `create_file` para gerar arquivos no workspace |
| Editar Arquivos | `file_edit` | Usar `edit_file` para modificar arquivos existentes |
| Ler Arquivos | `read_files` | Usar `read_file` para inspecionar conteúdo |

### ⚡ Outros

| Permissão | Chave JSON | Descrição |
|-----------|-----------|-----------|
| Pesquisa Web | `web_search` | Buscar informações na internet |
| Executar Comandos | `execute_commands` | Executar comandos shell (reservado) |

### Configuração Recomendada

| Papel | delegate | subtasks | create_tasks | files | read | web |
|-------|----------|----------|-------------|-------|------|-----|
| **Gerente** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Trabalhador** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## 🔧 Ferramentas Disponíveis (Tool Calling)

O Orchestrator expõe as seguintes ferramentas para os agentes via OpenAI-compatible function calling:

| Ferramenta | Permissão Requerida | Descrição |
|-----------|---------------------|-----------|
| `create_file` | `file_create` | Criar/sobrescrever arquivo no workspace do projeto |
| `edit_file` | `file_edit` | Buscar e substituir texto em arquivo existente |
| `read_file` | `read_files` | Ler o conteúdo de um arquivo |
| `web_search` | `web_search` | Pesquisar na internet |
| `create_task` | `create_tasks` | Criar tarefa independente (bloqueado dentro de task) |
| `delegate_task` | `delegate_tasks` | Delegar tarefa para outro agente (bloqueado dentro de task) |
| `add_subtask` | `manage_subtasks` | Adicionar etapa ao roadmap/checklist da tarefa |
| `update_task_status` | `create_tasks` | Alterar status de tarefa (completed requer aprovação humana) |
| `create_agent` | `create_tasks` | Criar novo agente (requer aprovação humana) |

### Metadados de Subtask

Cada subtask criada (via ferramenta ou UI) salva automaticamente:
- `created_by`: Emoji + nome do agente, ou "👤 Humano"
- `created_at`: Timestamp com data, hora, minuto e segundo

---

## 📊 Monitoramento de Erros por Agente

O sistema rastreia automaticamente erros de API por agente:

- **Lista de Agentes**: Badge vermelha `❌ N Erros` aparece no card do agente se ele tiver falhas registradas
- **Detalhe do Agente**: Seção "⚠️ Logs de Erros Recentes" lista os últimos 10 erros com contexto (task/project), mensagem de erro e timestamp
- **Atribuição**: Quando a API falha, o erro é salvo no banco de dados vinculado ao `agent_id` que causou a falha

---

## 🧠 Auto-Sumarização de Contexto

Para evitar a explosão de tokens em conversas longas, o Orchestrator possui um motor de sumarização automática:

1. A cada mensagem, o sistema conta o número de mensagens no histórico
2. Quando ultrapassa o limite (padrão: 20 mensagens), ele consolida as mensagens antigas em um único resumo de sistema
3. As mensagens originais são marcadas como `archived = 1` no banco
4. O resumo é salvo com `is_summary = 1` e é injetado como memória de longo prazo nas próximas interações

---

## ⚙️ Configuração e Instalação

### Pré-requisitos

- **Node.js** 18+ 
- **9Router** rodando na VPS (`localhost:20128`) para modelos premium
- **Ollama** (opcional) para modelos gratuitos locais

### Instalação

```bash
git clone https://github.com/gnomeswed/nexus.git
cd nexus
npm install
npm start
# Para VPS com persistência:
pm2 start server.js --name "nexus-os"
```

### Variáveis de Ambiente (`.env`)

| Variável | Descrição | Default |
|----------|-----------|---------|
| `PORT` | Porta HTTP do servidor web | `3000` |
| `AI_ROUTER_URL` | Endpoint do 9Router | `http://localhost:20128/v1` |
| `PROJECTS_ROOT` | Diretório raiz para arquivos dos projetos | `./projects` |
| `DEFAULT_MODEL` | Nome da rota/combo no 9Router | `combo` |
| `DEFAULT_API_KEY` | Chave de autenticação para o 9Router | `nexus-os` |
| `DB_PATH` | Caminho do banco SQLite | `./data/nexus.db` |

Todas as variáveis são editáveis pela interface em **Configurações**.

---

## 🗄️ Banco de Dados (SQLite)

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `agents` | Agentes de IA (nome, role, provider, model, permissions, status) |
| `projects` | Projetos com roadmap, progresso e pasta de arquivos |
| `tasks` | Tarefas com checklist/subtasks, prioridade, status |
| `messages` | Histórico de chat com suporte a sumarização (`is_summary`, `archived`) |
| `project_agents` | Relação N:N entre projetos e agentes (com papel: lead/collaborator/reviewer) |

### Status de Tarefas

```
pending → in_progress → review_pending → completed
                                       → cancelled
```

- `review_pending`: O trabalhador finalizou e notifica o gerente automaticamente para revisão
- `completed`: Requer aprovação humana explícita ("aprovado")

---

## 📁 Estrutura de Diretórios

```
nexus/
├── server.js                    # Entry point — Express + Socket.IO
├── .env                         # Variáveis de ambiente
├── data/
│   └── nexus.db                 # Banco SQLite (gerado automaticamente)
├── projects/                    # Workspace dos agentes (arquivos criados)
│   ├── projeto-nome/            # Pasta por projeto
│   └── tarefas/                 # Pastas automáticas para tarefas avulsas
│       └── task_1_nome/
├── public/                      # Frontend (Vanilla JS + CSS Glassmorphism)
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── app.js               # SPA Router
│       ├── api.js               # Cliente REST
│       ├── socket.js            # Cliente WebSocket
│       └── pages/
│           ├── dashboard.js     # Dashboard com stats
│           ├── agents.js        # Lista de agentes
│           ├── agent-detail.js  # Edição de agente + permissões + logs de erro
│           ├── projects.js      # Lista de projetos
│           ├── project-detail.js# Detalhe com roadmap, tasks, chat, arquivos
│           ├── tasks.js         # Lista de tarefas
│           ├── task-detail.js   # Detalhe com roadmap, chat, status IA
│           └── settings.js      # Configurações (.env)
├── src/
│   ├── config/
│   │   └── database.js          # Schema SQLite + migrações
│   ├── routes/
│   │   ├── agents.js            # CRUD agentes + contagem de erros
│   │   ├── projects.js          # CRUD projetos + roadmap
│   │   ├── tasks.js             # CRUD tarefas + checklist
│   │   ├── chat.js              # Endpoint de chat AI
│   │   └── settings.js          # Leitura/escrita do .env
│   ├── services/
│   │   ├── orchestrator.js      # Cérebro: tools, permissions, summarization
│   │   ├── ai-client.js         # Cliente HTTP para 9Router/Ollama/Custom
│   │   ├── file-manager.js      # CRUD de arquivos no workspace
│   │   ├── web-search.js        # Busca na internet
│   │   └── scheduler.js         # Agendador de tarefas
│   └── websocket/
│       └── chat-handler.js      # Socket.IO: rooms, chat:send, agent:thinking
└── README/
    └── DOCUMENTATION.md          # Este arquivo
```

---

## 🌐 API REST

Base URL: `http://localhost:3000/api`

### Agentes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/agents` | Lista todos (inclui `error_count`) |
| `GET` | `/api/agents/:id` | Detalhe com tasks, projects e errors |
| `POST` | `/api/agents` | Criar agente |
| `PUT` | `/api/agents/:id` | Atualizar agente |
| `DELETE` | `/api/agents/:id` | Deletar agente |
| `POST` | `/api/agents/:id/test` | Testar conexão com API de IA |

### Projetos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/projects` | Lista todos |
| `GET` | `/api/projects/:id` | Detalhe com roadmap, tasks, messages, files |
| `POST` | `/api/projects` | Criar projeto |
| `PUT` | `/api/projects/:id` | Atualizar projeto |
| `DELETE` | `/api/projects/:id` | Deletar projeto |

### Tarefas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/tasks` | Lista todas |
| `GET` | `/api/tasks/:id` | Detalhe com messages |
| `POST` | `/api/tasks` | Criar tarefa |
| `PUT` | `/api/tasks/:id` | Atualizar tarefa (status, checklist, agent_id) |
| `DELETE` | `/api/tasks/:id` | Deletar tarefa |

### Chat IA

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/chat/:contextType/:contextId` | Enviar mensagem e receber resposta da IA |

### WebSocket Events

| Evento | Direção | Descrição |
|--------|---------|-----------|
| `chat:send` | Client → Server | Enviar mensagem no chat |
| `chat:message` | Server → Client | Nova mensagem (user ou assistant) |
| `agent:thinking` | Server → Client | Status em tempo real da IA |
| `join:room` | Client → Server | Entrar na sala de um projeto/task |
| `task:created` | Server → All | Nova tarefa criada |
| `task:updated` | Server → All | Tarefa atualizada |

---

## 🔄 Fluxo de Trabalho Completo

```
1. Humano cria uma Tarefa (via UI) e atribui ao Gerente
2. Gerente analisa → muda status para in_progress
3. Gerente usa delegate_task → cria sub-tarefa para o Trabalhador
4. Trabalhador recebe a tarefa automaticamente (auto-trigger via processMessage)
5. Trabalhador executa: create_file, edit_file
6. Trabalhador avisa: "Arquivo criado em X. Aguardando revisão."
7. Trabalhador muda status para review_pending
8. Sistema notifica o Gerente automaticamente
9. Gerente usa read_file para revisar o trabalho
10. Se aprovado → Humano digita "aprovado" → Gerente muda para completed
11. Se precisa ajuste → Gerente cria add_subtask com instruções → muda para in_progress
```

---

## 📄 License

MIT
