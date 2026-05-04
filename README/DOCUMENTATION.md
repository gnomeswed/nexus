# Nexus OS - Documentação Oficial

O Nexus OS é um orquestrador de IA autônomo projetado para criar, gerenciar e delegar tarefas para múltiplos agentes simultaneamente. Construído em Node.js com SQLite, ele foi projetado para rodar localmente ou em uma VPS.

## 🚀 Filosofia de Roteamento & Arquitetura Hierárquica (Manager -> Worker)

O Nexus OS foi projetado para evitar a "explosão de tokens" e falhas de protocolo comuns em sistemas multi-agentes. Nós utilizamos uma arquitetura estrita baseada em delegação, combinada com uma roteirização híbrida de APIs.

### A Hierarquia:
1. **O Gerente (O Cérebro):** O usuário conversa APENAS com o Gerente. Ele usa modelos avançados e caros via **9Router** (Claude 3.5, GPT-4o, DeepSeek). Ele planeja, cria tarefas, avalia o trabalho e delega. Como ele não escreve código, ele gasta pouquíssimos tokens de saída.
2. **Os Estagiários (Os Músculos):** Trabalhadores braçais configurados para rodar de graça usando modelos open-source (Gemma, Llama) via **Ollama Local**. Eles recebem tarefas do Gerente (via ferramenta `delegate_task`), processam milhares de linhas de código e salvam em arquivos. Eles não enviam o código para o chat, preservando o contexto e o custo.

*Essa separação garante que seu sistema tenha raciocínio de ponta com um custo próximo de zero.*

## 🛡️ Segurança: Human-in-the-Loop Protocol

Os agentes do Nexus têm ferramentas poderosas (`create_file`, `edit_file`, `create_agent`). Para evitar que uma Inteligência Artificial crie agentes sem necessidade ou finalize projetos incompletos, o Orchestrator possui uma trava de segurança em nível de código (Backend).

**Regra Estrita:** Um agente **NUNCA** conseguirá criar outro agente ou marcar uma tarefa principal como finalizada (`completed`) a menos que o usuário humano tenha digitado a palavra **"aprovado"** ou **"aprovo"** nas últimas mensagens do chat daquela tarefa. O sistema rejeitará a requisição da IA com uma mensagem de erro até que a aprovação seja detectada.

## 🗺️ Interface Bento & Timeline Roadmap

O front-end do Nexus utiliza a filosofia "Glassmorphism" do ecossistema Vercel. Na tela de tarefas, em vez de listas mortas, os Subtasks são renderizados em um formato **Bento Card** com um **TreeView / Timeline de Roadmap** integrado.
Isso permite que você crie subtarefas manualmente ou veja a Inteligência Artificial quebrando problemas complexos em nós interativos que se acendem à medida que são concluídos.

## ⚙️ Configurações e Instalação

### Instalação do Backend de IAs
- **9Router (Obrigatório para Premium):** Execute em sua VPS (`localhost:20128`). Gerencie combos e contas.
- **Ollama (Opcional para Agentes Gratuitos):** Instale em sua VPS. Configure seus agentes mais simples para usarem o Provider `Ollama` com o endpoint `http://localhost:11434/v1` na página de edição do agente.

### Instalação do Nexus OS
```bash
git clone https://github.com/gnomeswed/nexus.git
cd nexus
npm install
npm start # ou pm2 start server.js --name "nexus-os" para VPS
```

As variáveis de ambiente ficam no `.env` (gerado manualmente) ou na página web de "Configurações":

| Variável | Descrição | Default |
|----------|-------------|---------|
| `PORT` | Porta HTTP do servidor | `3000` |
| `AI_ROUTER_URL` | URL de fallback do 9Router | `http://localhost:20128/v1` |
| `PROJECTS_ROOT` | Diretório onde os agentes criam arquivos de código | `./projects` |
| `DEFAULT_MODEL` | Nome do Combo ou rota primária do 9Router | `combo` |

## 📁 Arquitetura de Diretórios

- `data/`: Armazena o banco de dados relacional SQLite (`nexus.db`). Gerado automaticamente no primeiro boot.
- `public/`: Frontend Vanilla JS modular.
- `src/routes/`: API REST Node.js (Express).
- `src/services/`: Núcleo de processamento autônomo.
  - `orchestrator.js`: Executa Tools, aplica o Human-in-the-Loop, intercepta alucinações de LLM e manda a IA refazer tarefas.
  - `ai-client.js`: Cliente flexível para bater no 9Router ou diretamente em provedores customizados / Ollama.
- `src/websocket/`: Atualização visual e de chat em tempo real (`chat-handler.js`).

## 📄 License
MIT
