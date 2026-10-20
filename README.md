# Digi-Tron Balanças — GLPI AutoScheduler (TI)

Sistema corporativo de agendamento e lançamento automático de chamados preventivos, operacionais e de rotina no **GLPI** exclusivo para a equipe de **Tecnologia da Informação (TI)** da **Digi-Tron**.

---

## 🏗️ 1. Arquitetura de Conexão Local

O sistema adota arquitetura desacoplada e segura para execução local no computador/servidor Windows da Digi-Tron:

```
┌─────────────────────────────────┐
│     GLPI (Docker Desktop)       │
│  - Web:   http://localhost:8080/front/central.php
│  - API:   http://localhost:8080/apirest.php
└────────────────┬────────────────┘
                 ▲ (Chamadas REST com App-Token e User-Token)
                 │
┌────────────────┴────────────────┐
│   Backend Python (FastAPI)      │
│  - Porta: http://localhost:8000 │
│  - Agendador de fundo em loop   │
│  - Persistência e Idempotência  │
│  - Validação estrita de TI      │
└────────────────┬────────────────┘
                 ▲ (CORS / JSON API: VITE_API_URL=http://localhost:8000)
                 │
┌────────────────┴────────────────┐
│      Frontend React (Vite)      │
│  - Porta: http://localhost:3000 │
│  - Interface Digi-Tron TI       │
│  - Painel, Rotinas e Auditoria  │
└─────────────────────────────────┘
```

> **Por que o backend local é necessário?**  
> Quando a aplicação executa em um container na nuvem, o endereço `localhost` referencia o próprio container e não alcança a porta 8080 do Windows. Ao executar o backend localmente no computador Windows que hospeda o Docker Desktop, a conexão com `http://localhost:8080/apirest.php` opera de forma nativa e direta.

---

## 📋 2. Pré-requisitos

1. **Windows 10/11** com **Docker Desktop** ativo rodando o container do GLPI na porta **8080**.
2. **Node.js 18+** e **npm** instalados.
3. **Python 3.10+** instalado (marque a opção *"Add Python to PATH"* durante a instalação).
4. **Git** e **Visual Studio Code** (opcional, para edição e depuração).

---

## 🚀 3. Instalação e Execução no Windows (Passo a Passo)

### Opção A: Início Rápido com 1 Clique (Recomendado no Windows)

Dê um duplo clique no arquivo **`start-windows.bat`** na raiz do projeto.  
Esse script irá:
1. Criar o ambiente virtual Python (`venv`) e instalar dependências em `backend/requirements.txt`.
2. Iniciar o **Backend FastAPI** na porta `8000`.
3. Iniciar o **Frontend React** na porta `3000`.
4. Abrir o sistema em seu navegador: **`http://localhost:3000`**.

---

### Opção B: Execução Manual via Terminal ou VS Code

#### Passo 1 — Configurar o Backend Python FastAPI
Abra um terminal (PowerShell ou CMD) na pasta `backend/`:

```cmd
cd backend
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edite o arquivo `backend\.env` com seus tokens gerados no GLPI:
```env
GLPI_BASE_URL="http://localhost:8080/apirest.php"
GLPI_APP_TOKEN="seu_app_token_gerado_no_glpi"
GLPI_USER_TOKEN="seu_user_token_gerado_no_glpi"
```

Inicie o backend:
```cmd
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
* Swagger Docs disponível em: **`http://localhost:8000/docs`**

#### Passo 2 — Configurar o Frontend React (Vite)
Abra outro terminal na raiz do projeto:

```cmd
npm install
copy .env.example .env
```

Certifique-se de que o `.env` contenha:
```env
VITE_API_URL="http://localhost:8000"
```

Inicie o frontend:
```cmd
npm run dev
```

Acesse o sistema em: **`http://localhost:3000`**

---

## 🔑 4. Acesso ao Sistema e Credenciais Padrão

* **E-mail do Administrador:** `joao.leopoldino@digitronbalancas.com.br`
* **Senha:** `123456`
* Na tela de login há um botão de preenchimento rápido em 1 clique e fluxo de recuperação de senha com código seguro.

---

## ⚙️ 5. Como Gerar os Tokens no GLPI Local (Docker)

1. Acesse o GLPI em `http://localhost:8080/front/central.php` com usuário administrador (`glpi`/`glpi` ou sua credencial).
2. **Habilitar API REST e Gerar App-Token:**
   - Acesse **Configurar > Geral > aba API**.
   - Marque **Habilitar API Rest: Sim**.
   - Marque **Habilitar login com token de usuário: Sim**.
   - Em **Clientes de API**, clique em **Adicionar cliente de API**.
   - Nome: `DigiTron AutoScheduler`, Ativo: `Sim`, clique em **Adicionar**.
   - Copie o **Token da Aplicação (App-Token)** gerado.
3. **Gerar User-Token do Técnico/Admin:**
   - No canto superior direito, clique na sua foto/nome > **Meu Perfil**.
   - Vá na aba **Chaves de Acesso Remoto** (ou Chaves de API).
   - Clique em **Regenerar** e copie o **Token de usuário (User-Token)**.
4. Cole os tokens na aba **"Conexão GLPI"** do sistema ou no arquivo `backend/.env`.

---

## 🧪 6. Testes de Integração Disponíveis na Interface

1. **Testar Conexão Real (Leitura Não-Intrusiva):**
   - Executa 7 etapas de validação: formato do endpoint, alcance de rede, `/initSession`, validação de tokens, consulta de perfil (`/getMyProfiles`), checagem de permissões e `/killSession`.
   - **Garantia:** Não cria nenhum chamado no banco de dados.

2. **Testar Criação de Chamado Real (Com Confirmação Explícita):**
   - Cria um chamado de teste real no GLPI (`POST /Ticket`) com categoria de TI e grupo de TI.
   - Requer confirmação explícita do usuário em modal de aviso antes de qualquer escrita no GLPI.

---

## 🛡️ 7. Restrições e Segurança de TI

- **Escopo Exclusivo de TI:** O backend valida e rejeita qualquer rotina ou chamado que contenha termos fora do setor de TI (como *balança, calibração, célula de carga, fosso, rodoviária, metrologia*).
- **Categorias Permitidas:**
  - *TI - Infraestrutura e Servidores*
  - *TI - Backups e Armazenamento*
  - *TI - Redes e Conectividade*
  - *TI - Sistemas e ERP Factory OS*
  - *TI - Suporte a Usuários e Estações*
  - *TI - Segurança da Informação*
  - *TI - Bancos de Dados*
  - *TI - Periféricos e Impressão*
- **Agendador de Fundo:** Executa via serviço local Python independente do navegador permanecer aberto.
- **Prevenção de Duplicidade:** Janela de idempotência de 55 segundos para evitar múltiplos envios da mesma rotina.
