<div align="center">
  <img src="https://img.shields.io/badge/Status-Active-success.svg" alt="Status" />
  <img src="https://img.shields.io/badge/Version-1.2.0-blue.svg" alt="Version" />
  <img src="https://img.shields.io/badge/Node.js-Ready-green.svg" alt="Node" />
  <h1>🚀 Nexus OS</h1>
  <p>Orquestrador autônomo de agentes de IA, rodando localmente ou em VPS com suporte a 9Router e Ollama.</p>
</div>

O Nexus OS é um sistema focado em criar, gerenciar e delegar tarefas para múltiplos agentes de Inteligência Artificial. Ele permite roteamento avançado via **9Router** (para modelos Premium) e roteamento direto via **Ollama** (para tarefas de volume gratuitas), tudo integrado em uma interface reativa moderna.

---

## ✨ Novidades da V1.2.0

- **🛡️ Human-in-the-Loop Estrito:** Agentes não podem tomar ações críticas (como contratar novos agentes ou dar uma tarefa como concluída) sem que o humano escreva explicitamente "aprovado" no chat.
- **🗺️ Bento Roadmap UI:** Tela de tarefas modernizada com TreeView em tempo real e barra de progresso visual de subtarefas.
- **🔌 Multi-Provider Nativo:** Configure agentes individualmente para rodarem via 9Router (Global) ou diretamente no Ollama (Local/Gratuito).
- **📡 WebSockets Refinados:** Atualizações em tempo real livres de duplicações, com fallbacks automáticos para alucinações de LLMs locais.

---

## 🛠️ Como Instalar (Local ou VPS)

### 1. Requisitos e Ferramentas Auxiliares

Antes de iniciar o Nexus OS, você precisa do motor de IA. O sistema foi feito para funcionar com o 9Router.

**A) Instalação do 9Router (Obrigatório para Modelos Cloud - GPT, Claude, DeepSeek)**
O 9Router é a ponte que gerencia as chaves de API sem precisar expor no Nexus.
Certifique-se de que ele esteja rodando na sua máquina (geralmente na porta `20128`).
> *Se estiver instalando em uma VPS, mantenha o 9Router rodando via `pm2 start`.*

**B) Instalação do Ollama (OPCIONAL - Para uso de Agentes Gratuitos)**
Você pode usar o Ollama para delegar "trabalho pesado" para modelos open-source (como o `llama3`) rodando na sua própria máquina a custo zero.
- Instale no Linux VPS: `curl -fsSL https://ollama.com/install.sh | sh`
- Baixe um modelo leve: `ollama run llama3`
- *O Ollama rodará por padrão em `http://localhost:11434`.*

### 2. Clonar e Configurar o Nexus OS
```bash
git clone https://github.com/gnomeswed/nexus.git
cd nexus
npm install
```

### 3. Configurar Variáveis de Ambiente
O repositório **não** inclui o arquivo de configuração. Crie o arquivo `.env` na raiz do projeto:

```env
PORT=3000
HOST=0.0.0.0

# URL onde o seu 9Router está rodando
AI_ROUTER_URL=http://localhost:20128/v1

# Modelo padrão. Deixe "combo" para usar o rodízio do 9Router!
DEFAULT_MODEL=combo

PROJECTS_ROOT=./projects
DB_PATH=./data/nexus.db
```

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

## 🧠 Como Configurar os Agentes (Estratégia)

No Nexus OS, a melhor arquitetura de uso de IA é a hierarquia **"Cérebro x Músculos"**:

1. **O Cérebro (Manager/Tech Lead):** Vá na página do seu Agente Principal e deixe o Provider como `9Router`. Ele usará a inteligência de ponta (como o Claude 3.5 ou GPT-4o) para analisar suas requisições, planejar arquiteturas e orquestrar ferramentas.
2. **Os Músculos (Agentes Auxiliares/Estagiários):** Crie novos agentes, altere o Provider deles para `Ollama (Local)` e coloque o modelo (ex: `llama3`). Peça para o Cérebro "delegar a formatação/leitura densa" para o estagiário. O estagiário trabalhará na sua máquina usando 0 tokens, enquanto o Cérebro apenas gerencia.

---

## 🔄 Como atualizar o servidor
Sempre que novas atualizações forem enviadas, basta rodar:
```bash
cd nexus
git pull origin main
npm install
pm2 restart nexus-os
```

## 📝 Licença
MIT
