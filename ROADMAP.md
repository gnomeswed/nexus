# Roadmap - Nexus OS

Documento de acompanhamento da evolução, refatorações e próximos passos do Nexus OS.

## 📌 Status Atual
- **Versão:** 1.4.1
- **Stack:** Node.js, Express, SQLite, Vanilla JS/CSS (Glassmorphism).
- **Integração IA:** Proxy centralizado via **9Router** (`localhost:20128/v1`).
- **Modelos testados e funcionando:** `nvidia/minimaxai/minimax-m2.7`, `nvidia/z-ai/glm4.7`
- **Modelos disponíveis (Kiro, quando ativo):** `kr/claude-sonnet-4.5`, `kr/claude-haiku-4.5`, `kr/deepseek-3.2`, `kr/qwen3-coder-next`

---

## ✅ Concluído

### v1.0.0 — Base
- [x] Modernização do Frontend (Paleta Vercel/Apple, Dark/Light Mode nativo).
- [x] Refatoração do `AIClient` para delegar escolhas de modelo 100% para o 9Router.
- [x] Centralização de Configurações (`.env` editável pela UI).
- [x] Sistema autônomo e ferramentas (`create_file`, `web_search`, `read_file`, `edit_file`, `create_task`) ativados via JSON Permissions.
- [x] Documentação base do projeto e Roadmap criados.

### v1.1.0 — Estabilização & Bug Fixes (03/05/2026)
- [x] **Fix:** `switchTab` no projeto recarregava a página inteira, perdendo a aba ativa → agora atualiza só o `#tab-content` sem re-render completo.
- [x] **Fix:** Mensagens do chat apareciam em ordem invertida (double-reverse) → corrigido para ordenar da mais antiga à mais recente.
- [x] **Fix:** Chat via WebSocket (`chat:send`) não acionava a IA → `chat-handler.js` agora chama o `orchestrator.processMessage()` após salvar a mensagem do usuário.
- [x] **Fix:** Mensagens do usuário no chat renderizavam HTML sem escape (XSS) → `escapeHtml()` aplicado.
- [x] **Fix:** `DEFAULT_MODEL=openrouter/free` inválido → atualizado para `nvidia/minimaxai/minimax-m2.7`.
- [x] **Fix:** `DEFAULT_API_KEY` com placeholder inválido → trocado para `nexus-os`.
- [x] **Fix:** `writeEnv()` apagava comentários e linhas em branco do `.env` → reescrito para preservar estrutura original.
- [x] **Fix:** Dashboard mostrava "Tarefas Concluídas: 0" sem dado real → adicionado `completedTasks` ao endpoint `/api/stats`.
- [x] **Fix:** Agente criado com `provider: openrouter` mesmo com UI mostrando `9router` → default corrigido para `9router`.
- [x] **Fix:** `max_tokens: 10` causava resposta vazia no `minimax-m2.7` → aumentado para `50` nos endpoints de teste.
- [x] **Fix:** `stream: false` faltando nos endpoints de teste → adicionado para evitar falha de parse JSON.
- [x] **Fix:** `orchestrator` não era passado para `setupWebSocket` → corrigido em `server.js`.

### v1.2.0 — Orquestração & Autonomia (03/05/2026)
- [x] **Feature:** Telemetria em tempo real (`agent:thinking`) com card de Status da Inteligência no UI.
- [x] **Feature:** Pastas automáticas isoladas para Tarefas Avulsas (`tarefas/task_id`).
- [x] **Fix:** Tolerância a falhas na conversão JSON para evitar crashes (Unterminated string).
- [x] **Feature:** Arquitetura Hierárquica: Transição de "Humano-Trabalhador" para "Humano-Gerente-Trabalhadores".
- [x] **Feature:** Ferramentas de Delegação: `delegate_task` para o Gerente acionar sub-agentes e fluxo de `review_pending`.
- [x] **Feature:** Otimização Híbrida (Tokens): Configuração global para suportar Ollama local ou 9Router por agente.
- [x] **Feature:** Auto-Sumarização de Contexto: Resumir histórico periodicamente para economizar tokens.

### v1.3.0 — Controle de Permissões & Estabilidade (04/05/2026)
- [x] **Feature:** Modal de edição de tarefas (alterar agente, projeto, prioridade).
- [x] **Feature:** Monitoramento de erros por agente: badge `❌ N Erros` na lista + seção "Logs de Erros" no detalhe.
- [x] **Feature:** Atribuição de `agent_id` nas mensagens de erro do orchestrator.
- [x] **Fix (Critical):** Multiplicação de tarefas — `create_task` e `delegate_task` são **hard-blocked por código** dentro de contexto de task, convertidos automaticamente em `add_subtask`.
- [x] **Feature:** Metadados de subtask: cada etapa do roadmap salva `created_by` (agente/humano) e `created_at` (timestamp com segundos).
- [x] **Feature:** Novas permissões granulares: `delegate_tasks` e `manage_subtasks` com categorias visuais (Gerenciamento / Arquivos / Outros).
- [x] **Feature:** Status da IA resiliente: se a última mensagem é do usuário, a tela exibe "Pensando e processando..." automaticamente ao carregar.
- [x] **Fix:** Timeout da API reduzido de 10 min para 3 min para feedback mais rápido ao usuário.
- [x] **Feature:** Documentação completa reescrita com cobertura de API REST, WebSocket, permissões e fluxo de trabalho.
- [x] **Fix (Architecture):** Unificação de diretórios na VPS (`/root/nexus-os`) e correção de caminhos de arquivos.
- [x] **Fix (Database):** Migrations automáticas para colunas de memória (`is_summary`, `archived`) e status `review_pending`.
- [x] **Feature (Orchestrator):** Filtro inteligente de monólogos (limpeza de parágrafos em inglês) e exemplos few-shot para respostas curtas e precisas em PT-BR.
- [x] **Fix (UX):** Sumarização automática agora é silenciosa e oculta no chat.
- [x] **Feature (Protocolo):** Rigidez no fluxo de trabalho — Trabalhadores agora são obrigados a atualizar o status da tarefa para `review_pending` via ferramenta antes de reportar no chat.
- [x] **Feature (Autonomia):** Loop de Auto-Correção (Self-healing) — Mensagens de erro de ferramentas agora instruem a IA a tentar corrigir o erro automaticamente antes de desistir.
- [x] **Feature (Autonomia):** Sistema de Heartbeat (Ping) — O Gerente principal "desperta" a cada 15 minutos para verificar tarefas pendentes e reativar agentes parados.
- [x] **Feature (Autonomia):** Aprovação Automática de Baixo Risco — Tarefas de pesquisa, leitura e formatação agora são auto-aprovadas, permitindo fluxo contínuo sem intervenção humana.
- [x] **Feature (Memória):** Memória de Longo Prazo — Nova tabela `memories` e ferramentas `save_memory`/`search_memory` para os agentes aprenderem com projetos passados.
- [x] **Hotfix (Critical):** Corrigido erro de sintaxe (redeclaração de variável) no `orchestrator.js` que causava crash na inicialização.

---

## 🎯 Próximos Passos (Backlog)

### Sprint Atual
- **Autenticação básica:** Proteger o painel com PIN ou JWT simples para acesso externo seguro.
- **Lembretes UI:** Adicionar modal na interface para criar/editar tarefas programadas (Reminders).
- **Fallback de modelo:** Se o modelo configurado retornar erro 4xx, tentar automaticamente o próximo disponível na lista do 9Router.

### Sprints Futuras
- **Testes Unitários:** Integrar rotinas Jest para proteger as alterações no `Orchestrator` e `AIClient`.
- **Estatísticas e Monitoramento:** Expandir Dashboard com gráficos de custo/tempo de resposta por modelo.
- **Módulo Financeiro (Firebase):** Conectar credenciais Firestore e lançar UI para acompanhamento de gastos de tokens.
- **Multi-modelo por agente:** Permitir que cada agente tente múltiplos modelos em sequência (fallback chain).
