<div align="center">
  <img src="https://img.shields.io/badge/Status-Active-success.svg" alt="Status" />
  <img src="https://img.shields.io/badge/Version-1.1.0-blue.svg" alt="Version" />
  <img src="https://img.shields.io/badge/Node.js-Ready-green.svg" alt="Node" />
  <h1>🚀 Nexus OS</h1>
  <p>Orquestrador autônomo de agentes de IA, rodando localmente ou em VPS.</p>
</div>

O Nexus OS é um sistema focado em criar, gerenciar e delegar tarefas para múltiplos agentes de Inteligência Artificial. Ele delega o roteamento LLM para o **9Router**, permitindo trocar livremente entre provedores (NVIDIA, DeepSeek, Claude, etc.) sem expor chaves API no código.

---

## ✨ Features

- **🤖 Gestão de Agentes:** Crie perfis autônomos com cargos e sistema de permissões.
- **⚡ Roteamento Centralizado (9Router):** Suporte nativo a dezenas de LLMs usando `localhost:20128/v1`.
- **🛠️ Tools & Execução Autônoma:** Agentes podem pesquisar na web, criar, ler e editar arquivos na máquina.
- **💬 Chat Real-Time:** WebSocket integrado para chat reativo e fluido.
- **🎨 Glassmorphism UI:** Design clean, moderno e responsivo (Vercel-like) com Dark Mode nativo.

---

## 🛠️ Como Instalar (Local ou VPS)

### 1. Clonar o repositório
```bash
git clone https://github.com/gnomeswed/nexus.git
cd nexus
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
O repositório **não** inclui o arquivo de configuração e nem a pasta do banco de dados (por segurança). 
Crie o arquivo `.env` na raiz do projeto:

```env
PORT=3000
HOST=0.0.0.0

# URL onde o seu 9Router está rodando
AI_ROUTER_URL=http://localhost:20128/v1

# Modelo padrão. Deixe "combo" para usar o rodízio do 9Router!
# (Você pode mudar isso facilmente na aba Configurações pelo site)
DEFAULT_MODEL=combo

PROJECTS_ROOT=./projects
DB_PATH=./data/nexus.db
```

> ℹ️ **Nota sobre a pasta `data/`:** Você pode notar que a pasta `data` (onde fica o SQLite) não está no GitHub. Ela é ignorada de propósito para não sobrescrevermos o banco de dados sem querer. **Ao rodar o servidor pela primeira vez, o próprio Nexus OS cria a pasta e o banco automaticamente.**

### 4. Iniciar o Servidor
Para testes locais:
```bash
npm start
```
Acesse no navegador: `http://localhost:3000`

Para produção na VPS (Recomendado o uso de `pm2`):
```bash
pm2 start server.js --name "nexus-os"
pm2 save
```

---

## 🔄 Como atualizar o servidor

Sempre que novas atualizações forem enviadas para este repositório, basta rodar na sua máquina ou VPS:

```bash
cd nexus
git pull origin main
npm install
pm2 restart nexus-os
```

---

## 📂 Estrutura de Diretórios

```text
├── public/           # Frontend (Vanilla JS, CSS Glassmorphism)
├── src/
│   ├── config/       # Configuração e Migrations do DB SQLite
│   ├── routes/       # API REST (Agentes, Tarefas, Projetos, etc)
│   ├── services/     # Lógica do Orchestrator e Tools da IA
│   └── websocket/    # Sockets para chat em tempo real
├── server.js         # Ponto de entrada do sistema
└── ROADMAP.md        # Tarefas e andamento do projeto
```

## 📝 Licença
MIT
