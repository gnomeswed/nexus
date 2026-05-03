# Nexus OS

O Nexus OS é um orquestrador de IA projetado para criar, gerenciar e delegar tarefas para múltiplos agentes autônomos. Ele roda localmente ou em uma VPS e utiliza o **9Router** como proxy centralizador, abstraindo a complexidade de gerenciar chaves e provedores de IA (OpenRouter, NVIDIA NIM, DeepSeek, Kiro, etc.).

## 🚀 Quick Start (Iniciando)

```bash
# 1. Instale as dependências
npm install

# 2. Inicie o sistema
npm start

# Para produção com PM2 (Recomendado):
pm2 start server.js --name "nexus-os"
pm2 save
```

Acesse em `http://localhost:3000`.

## ✨ Features Principais

- **Gestão de Agentes**: Crie e edite agentes definindo seu Prompt de Sistema, Cargo e Permissões (Tools).
- **Roteamento Inteligente (9Router)**: Todo o tráfego LLM aponta para `localhost:20128/v1`. Não há necessidade de colocar API Keys no Nexus OS.
- **Modelos Variados**: Suporte testado com modelos da NVIDIA (`minimaxai/minimax-m2.7`, `z-ai/glm4.7`) e Kiro (`kr/claude-sonnet-4.5`, etc.).
- **Projetos e Tarefas**: Organize o trabalho dos agentes através de Projetos e acompanhe via quadro Kanban.
- **Execução Autônoma e Tools**: O `Orchestrator` em background permite que os agentes pesquisem na web, criem, leiam e editem arquivos dentro do diretório do projeto. Chat via WebSocket totalmente reativo.
- **Interface Glassmorphism**: Design UI limpo, minimalista e com suporte a Dark/Light Mode inspirado no ecossistema Vercel.

## ⚙️ Configuração

As configurações do sistema ficam salvas no arquivo `.env` (que pode ser editado com segurança preservando comentários pelo painel `Configurações` na UI):

| Variável | Descrição | Default |
|----------|-------------|---------|
| `PORT` | Porta HTTP do servidor | `3000` |
| `HOST` | Host de escuta | `0.0.0.0` |
| `AI_ROUTER_URL` | URL do endpoint do 9Router | `http://localhost:20128/v1` |
| `PROJECTS_ROOT` | Diretório onde os agentes criarão arquivos | `./projects` |
| `DEFAULT_MODEL` | Nome da Rota de fallback caso o agente não exija um modelo específico | `nvidia/minimaxai/minimax-m2.7` |
| `DEFAULT_API_KEY` | Chave de passagem (o 9Router gerencia as chaves reais) | `nexus-os` |

## 📁 Estrutura do Projeto

- `data/`: Armazena o banco de dados relacional SQLite (`nexus.db`).
- `public/`: Frontend em Vanilla JS focado em performance (arquivos `.js` modulares).
- `src/routes/`: API REST (endpoints para chat, agentes, tarefas, configurações).
- `src/services/`: Lógica pesada (`ai-client.js`, `orchestrator.js`, `scheduler.js`).
- `src/websocket/`: Comunicação em tempo real para streaming e logs na UI (`chat-handler.js`).
- `README/`: Arquivos de documentação (como este).

## 📄 License
MIT
