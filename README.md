# 📦 AvariasControl — Princesa dos Campos
### Sistema Integrado de Controle de Avarias, Sobras, Rastreabilidade e Digital Twin Logístico

<p align="center">
  <img src="public/logo.png" alt="Princesa dos Campos" width="280">
</p>

<p align="center">
  <b>Ecossistema corporativo completo para triagem, precificação inteligente, conferência por QR Code, auditoria de movimentações e visualização 3D em tempo real para barracão de logística.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express-v5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Prisma_ORM-5.22-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma">
  <img src="https://img.shields.io/badge/SSE-Realtime_TV-FF6F00?style=for-the-badge&logo=html5&logoColor=white" alt="SSE Realtime">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/PM2-Production-2B037A?style=for-the-badge&logo=pm2&logoColor=white" alt="PM2">
</p>

---

## 📑 Tabela de Conteúdos

1. [Visão Geral](#-visão-geral)
2. [Arquitetura do Sistema](#-arquitetura-do-sistema)
3. [Tecnologias Utilizadas](#-tecnologias-utilizadas)
4. [Principais Funcionalidades](#-principais-funcionalidades)
   - [Digital Twin 3D (Canvas Isométrico)](#1-digital-twin-3d-canvas-isométrico)
   - [Modo Torre de Controle (TV em Tempo Real via SSE)](#2-modo-torre-de-controle-tv-em-tempo-real-via-sse)
   - [Inteligência de Precificação e Web Scraping](#3-inteligência-de-precificação-e-web-scraping)
   - [Gestão de Lotes Fechados (Leilão e Descarte)](#4-gestão-de-lotes-fechados-leilão-e-descarte)
   - [Etiquetas Térmicas PDF & QR Code](#5-etiquetas-térmicas-pdf--qr-code)
   - [Conferência por Scanner / Pistola USB](#6-conferência-por-scanner--pistola-usb)
   - [Trilha de Auditoria e Movimentações](#7-trilha-de-auditoria-e-movimentações)
5. [Modelagem de Dados (Prisma & PostgreSQL)](#-modelagem-de-dados-prisma--postgresql)
6. [Estrutura de Diretórios e Arquivos](#-estrutura-de-diretórios-e-arquivos)
7. [Guia de Instalação e Configuração](#-guia-de-instalação-e-configuração)
   - [Pré-requisitos](#pré-requisitos)
   - [Passo a Passo Rápido](#passo-a-passo-rápido)
   - [Configuração de Variáveis de Ambiente (.env)](#configuração-de-variáveis-de-ambiente-env)
   - [Banco de Dados com Docker Compose](#banco-de-dados-com-docker-compose)
   - [Migrações e Carga Inicial (Seeds)](#migrações-e-carga-inicial-seeds)
8. [Scripts e Rotinas de Manutenção](#-scripts-e-rotinas-de-manutenção)
9. [Referência da API REST](#-referência-da-api-rest)
   - [Itens (`/api/items`)](#-itens-apiitems)
   - [Lotes (`/api/lotes`)](#-lotes-apilotes)
   - [Movimentações (`/api/movimentacoes`)](#-movimentações-apimovimentacoes)
   - [Setores e Localizações (`/api/setores`, `/api/localizacoes`)](#-setores-e-localizações-apisetores-apilocalizacoes)
   - [Etiquetas (`/api/etiquetas`)](#-etiquetas-apietiquetas)
   - [Eventos em Tempo Real (`/api/events`)](#-eventos-em-tempo-real-apievents)
10. [Operação em Produção com PM2](#-operação-em-produção-com-pm2)
11. [Especificações de Hardware e Acessórios](#-especificações-de-hardware-e-acessórios)
12. [Solução de Problemas (Troubleshooting)](#-solução-de-problemas-troubleshooting)

---

## 🌟 Visão Geral

O **AvariasControl** foi desenvolvido para centralizar, controlar e dar visibilidade total ao fluxo de mercadorias que sofrem avarias no transporte, sobras de cargas fracionadas, itens em processo judicial, tratativas comerciais ou retenções de seguro da **Expresso Princesa dos Campos**.

O sistema elimina o controle manual em papel ou planilhas descentralizadas, oferecendo:
* **Mapeamento espacial tridimensional do barracão:** visualização exata de onde cada produto está fisicamente alocado.
* **Agilidade no pátio:** leitura rápida por QR Code via pistola USB ou coletor móvel para conferência, transferência de localização ou baixa de estoque.
* **Precificação assertiva:** busca em tempo real do preço de mercado no e-commerce para subsidiar decisões entre descarte, indenização, leilão em lote ou venda direta com 40% de sugestão.
* **Gestão visual (War Room / Torre de Controle):** TVs conectadas no galpão exibem o mapa animado que voa automaticamente para a estante a cada nova carga conferida, sem recarregar a tela.

---

## 🏗️ Arquitetura do Sistema

```mermaid
flowchart TD
    subgraph Clientes ["Dispositivos no Galpão & Escritório"]
        C1["📱 Coletor / Smartphone (Pátio)"]
        C2["🔫 Pistola USB / Leitor de Mesa"]
        C3["💻 Computador Administrativo"]
        C4["📺 TV Monitor (Torre de Controle)"]
    end

    subgraph Backend ["Servidor Node.js + Express (Porta 3009)"]
        API["Rotas REST Express"]
        SSE["SSE Broadcaster (/api/events)"]
        SCRAPER["Scraper Mercado Livre (Cheerio/Axios)"]
        PDFGEN["Gerador PDFKit + QRCode"]
    end

    subgraph Storage ["Persistência de Dados"]
        PRISMA["Prisma ORM"]
        PG[("PostgreSQL 16 (Porta 5435)")]
    end

    subgraph Externos ["Serviços Externos"]
        ML["Mercado Livre / Web"]
        PRINTER["Impressora Térmica (Zebra / Argox)"]
    end

    C1 -->|HTTP REST| API
    C2 -->|Entrada Teclado USB| C3
    C3 -->|HTTP REST| API
    API --> PRISMA --> PG
    API -->|Eventos Realtime| SSE -->|Server-Sent Events| C4
    API --> SCRAPER --> ML
    API --> PDFGEN -->|Buffer PDF Monocromático| PRINTER
```

---

## 🛠️ Tecnologias Utilizadas

### Backend
* **[Node.js (v18+)](https://nodejs.org/):** Ambiente de execução Javascript assíncrono de alto desempenho.
* **[Express (v5.2.1)](https://expressjs.com/):** Framework web minimalista para construção da API REST e controle de Server-Sent Events.
* **[Prisma ORM (v5.22.0)](https://www.prisma.io/):** ORM tipado para consultas eficientes, migrações seguras e mapeamento relacional.
* **[PostgreSQL 16](https://www.postgresql.org/):** Banco de dados relacional robusto executado via container Docker.
* **[Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events):** Protocolo de streaming unidirecional em tempo real (servidor ➔ clientes), com reconexão automática e heartbeat de 20s.
* **[Cheerio](https://cheerio.js.org/) + [Axios](https://axios-http.com/):** Extração de dados da web para busca de preços em tempo real com agente de ignorar restrições SSL corporativas.
* **[PDFKit](https://pdfkit.org/) + [node-qrcode](https://github.com/soldair/node-qrcode):** Geração dinâmica de etiquetas em vetor monocromático puro (`#000000` / `#FFFFFF`), calculadas na proporção exata de milímetros para pontos de impressão térmica.
* **[XLSX (SheetJS)](https://sheetjs.com/):** Leitura e manipulação de planilhas legadas de pendências matriz.

### Frontend
* **Vanilla JavaScript (ES6+):** Arquitetura Single Page Application (SPA) nativa, sem sobrecarga de frameworks externos (React/Vue/Angular), garantindo inicialização instantânea em qualquer coletor, TV ou browser corporativo.
* **HTML5 Semântico & CSS3 Design System:** Tema Dark corporativo com variáveis CSS, cantos arredondados, microinterações, modais animados e responsividade total.
* **HTML5 Canvas API 2D (Motor Isométrico Pseudo-3D):** Renderizador vetorial desenvolvido do zero para projetar a planta do galpão, ruas demarcadas, empilhamento dinâmico de caixas 3D, controle de câmera com órbita, zoom, rotação e interpolação linear (*lerp*).
* **Web Audio API:** Sintetizador sonoro no navegador para emissão de bipes de alerta e confirmação sem necessidade de arquivos externos `.mp3`.

### Infraestrutura & Deploy
* **[Docker & Docker Compose](https://www.docker.com/):** Container oficial `postgres:16-alpine` com mapeamento de volumes persistentes.
* **[PM2](https://pm2.keymetrics.io/):** Gerenciador de processos empresarial para execução em background (*zero downtime*, restart automático e limite de memória).

---

## 🎯 Principais Funcionalidades

### 1. Digital Twin 3D (Canvas Isométrico)
* **Planta Baixa Virtual do Galpão:** Renderização geométrica em perspectiva isométrica calculada matematicamente no Canvas.
* **Porta-Pallets Dinâmicos:** Estruturas com 8 colunas e 3 níveis de altura (`SOB-C01-N1` até `SOB-C08-N3`), além de áreas de piso (`GAI-CHAO`, `ZR-CHAO`, `NV-CHAO`, etc.).
* **Empilhamento Visual:** A quantidade de caixas 3D desenhadas nas estantes reflete fielmente a quantidade real de itens cadastrados no banco de dados.
* **Navegação Interativa:**
  * Rotação horizontal em 360° com arrasto do mouse ou botões de atalho.
  * Zoom com roda do mouse ou botões `+` e `−`.
  * Presets de câmera instantâneos: **Visão Aérea** (topo) e **Visão Entrada** (frontal).
  * Painel lateral deslizante com listagem completa ao clicar em qualquer nicho ou palete.
  * Filtro por setor com zoom automático na área selecionada.

### 2. Modo Torre de Controle (TV em Tempo Real via SSE)
* Desenvolvido especialmente para ser exibido em Smart TVs ou monitores instalados no galpão.
* O canal SSE (`/api/events`) escuta eventos disparados por qualquer operador no pátio.
* **Ao cadastrar ou bipar um item:**
  1. A TV emite um sinal sonoro de bipe via sintetizador `AudioContext`.
  2. A câmera 3D executa uma animação suave em voo até a posição exata da estante onde o item foi alocado.
  3. Um modal translúcido em destaque surge na tela por **8 segundos**, exibindo código, descrição, setor e quantidade.
  4. O painel se fecha sozinho e a câmera retorna para a visão geral — **sem necessidade de intervenção humana ou atualização de página (F5)**.

### 3. Inteligência de Precificação e Web Scraping
* Ao preencher o nome de um produto na tela de cadastro, o botão **🤖 Buscar** aciona o robô em `lib/scraper.js`.
* O robô consulta a internet (Mercado Livre), extrai títulos, valores médios e fotos dos produtos compatíveis.
* O sistema compara automaticamente o **Valor de Nota Fiscal (NF)** contra o **Valor de Mercado (Internet)**.
* **Cálculo de Sugestão:** Aplica a regra de negócio de **40% sobre o valor de referência** para precificação rápida de arremate/venda de sucata ou reparo.

### 4. Gestão de Lotes Fechados (Leilão e Descarte)
* Módulo exclusivo para consolidação de mercadorias sem liquidez individual:
  * Criação de lotes com numeração sequencial anual (ex: `LOT-2026-0001`).
  * Inclusão de itens via bipagem de leitor USB ou formulário de scanner.
  * **Fechamento do Lote:** Transfere automaticamente todas as peças alocadas para a área `LOTES-GERAL` e bloqueia alterações.
  * **Etiqueta Agregada de Lote:** Geração de etiqueta especial para o palete consolidado.
  * **Baixa em Massa:** Registro unificado de saída de todos os itens do lote de uma única vez (ex: envio para leilão ou descarte).

### 5. Etiquetas Térmicas PDF & QR Code
* Geração de PDFs em vetor gerados pelo `PDFKit` calibrados para impressoras térmicas (formato padrão **90mm x 100mm — Etiqueta 52**).
* **Monocromático Estrito:** Elementos convertidos em 100% preto (`#000000`) sobre fundo branco, sem retículas cinzas ou degradês que falham na queima da fita ribbon/cabeça térmica.
* QR Code de alta precisão (nível de correção e margens estritas para leitura a laser em ângulo).
* Detalhes impressos: Setor em barra preta superior com logo da empresa, Código do item, Localização, Quantidade/Tipo (Unidade ou Caixa e Qtd Itens), Data de Entrada e **Caixa de Destaque com o Motivo da Avaria** (`⚠ TELA TRINCADA`, `⚠ EMBALAGEM MOLHADA`, etc.).

### 6. Conferência por Scanner / Pistola USB
* Compatibilidade nativa com:
  * **Pistolas de Leitura de Código de Barras / QR Code USB:** funcionam como dispositivo HID (teclado), com captura de `Enter` para busca direta de itens `AV-...` ou lotes `LOT-...`.
  * **Câmera de Dispositivos Móveis:** leitor integrado via biblioteca `html5-qrcode`.
* Facilita a rotina de conferência de inventário no chão de fábrica e a baixa imediata de saída de mercadorias.

### 7. Trilha de Auditoria e Movimentações
* Todo evento logístico gera um registro imutável na tabela `Movimentacao`:
  * **ENTRADA:** Origem do cadastro no sistema ou importação via Excel.
  * **TRANSFERENCIA:** Mudança física de um palete/setor para outro, registrando quem autorizou e observação.
  * **SAIDA:** Baixa definitiva com identificação do motivo (**RETIRADA**, **VENDA**, **DESCARTE**, **ENCAMINHADO_UNIDADE**, **LOTE_SAIDA**), destino final e quantidade abatida.

---

## 🗄️ Modelagem de Dados (Prisma & PostgreSQL)

O modelo relacional foi estruturado para suportar relacionamentos consistentes e consultas com alta performance:

```mermaid
erDiagram
    Setor ||--o{ Localizacao : "contém"
    Localizacao ||--o{ Item : "abriga"
    Lote ||--o{ Item : "agrupa"
    Item ||--o{ Movimentacao : "possui histórico"

    Setor {
        String id PK
        String nome UK
        String descricao
        String cor
        Int posicaoX
        Int posicaoY
        Int largura
        Int altura
    }

    Localizacao {
        String id PK
        String codigo UK
        String descricao
        String tipo
        String setorId FK
        Float posicaoX
        Float posicaoY
        Float posicaoZ
        Int capacidade
    }

    Lote {
        String id PK
        String codigo UK
        String nome
        String status
        String usuario
        String observacao
        DateTime fechadoAt
    }

    Item {
        String id PK
        String codigo UK
        String nome
        String descricao
        Int quantidade
        String unidadeMedida
        Int itensPorCaixa
        String motivoAvaria
        String status
        String localizacaoId FK
        String loteId FK
        Float valorNf
        Float valorInternet
        Float sugestao
    }

    Movimentacao {
        String id PK
        String itemId FK
        String tipo
        String motivo
        String destino
        Int quantidade
        String usuario
        String observacao
        DateTime createdAt
    }
```

---

## 📁 Estrutura de Diretórios e Arquivos

```
controle-avarias/
├── docker-compose.yml           # Definição do container PostgreSQL 16 Alpine
├── ecosystem.config.js          # Configuração de processos do PM2 para produção
├── package.json                 # Metadados do projeto, dependências e scripts npm
├── package-lock.json            # Bloqueio de versões exatas das dependências
├── server.js                    # Ponto de entrada Express, SSE e orquestração de rotas
├── .env.example                 # Modelo de variáveis de ambiente
├── .env                         # Variáveis de ambiente locais (não versionar)
│
├── prisma/
│   ├── schema.prisma            # Schema do banco de dados relacional
│   ├── seed.js                  # Carga de setores e posições físicas padrão
│   └── migrations/              # Histórico de migrações DDL do Prisma
│
├── lib/
│   ├── prisma.js                # Singleton do cliente Prisma para conexões
│   └── scraper.js               # Scraper para cotação de preços no Mercado Livre
│
├── routes/
│   ├── items.js                 # CRUD de itens, dashboard stats e cotação online
│   ├── lotes.js                 # Agrupamento, fechamento e baixa de lotes
│   ├── movimentacoes.js         # Histórico e baixas de estoque
│   ├── setores.js               # Cadastro e listagem de setores do galpão
│   ├── localizacoes.js          # Cadastro e listagem de nichos e paletes
│   └── etiquetas.js             # Geração de PDF térmico e preview de QR Code
│
├── public/
│   ├── index.html               # SPA principal com todas as telas e modais
│   ├── app.js                   # Lógica da interface, motor 3D Canvas, scanner e formulários
│   ├── lotes_sse.js             # Conexão SSE, animação de TV e ações de lote
│   ├── style.css                # Folha de estilos, tokens CSS e temas visuais
│   └── logo.png                 # Logotipo institucional Princesa dos Campos
│
├── scripts/ (utilitários)
│   ├── import_excel.js          # Importador de dados da planilha PENDÊNCIAS MATRIZ.xlsx
│   ├── update_prices.js         # Atualização de valores fiscais e sugestões de lote
│   ├── update_db_localizacoes.js # Estruturador das 8 colunas x 3 níveis do Porta-Pallet
│   ├── clear_db.js              # Limpeza controlada de dados do banco
│   └── populate_mock.js         # Gerador de dados fictícios para testes de estresse
│
└── PENDÊNCIAS MATRIZ.xlsx       # Base legada de dados e pendências logísticas
```

---

## 🚀 Guia de Instalação e Configuração

### Pré-requisitos
* **[Node.js](https://nodejs.org/)** versão 18.0.0 ou superior instalada.
* **[Docker](https://www.docker.com/)** e **Docker Compose** instalados (ou uma instância própria de PostgreSQL).
* **NPM** (incluso com Node.js).
* Opcional: **PM2** globalmente para produção (`npm install -g pm2`).

---

### Passo a Passo Rápido

#### 1. Clonar o repositório e entrar na pasta:
```bash
git clone <URL_DO_REPOSITORIO> "controle avarias"
cd "controle avarias"
```

#### 2. Instalar as dependências do projeto:
```bash
npm install
```

#### 3. Configurar as variáveis de ambiente:
Copie o arquivo de exemplo para `.env`:
```bash
# No Windows (PowerShell):
Copy-Item .env.example .env

# No Linux / macOS:
cp .env.example .env
```

#### 4. Subir o banco de dados PostgreSQL via Docker:
```bash
npm run db:up
```
*(O banco inicializará na porta local `5435` mapeada para a porta interna padrão `5432`).*

#### 5. Executar as migrações e popular dados iniciais:
```bash
# Gera o cliente Prisma com os tipos atualizados
npm run db:generate

# Cria as tabelas no PostgreSQL
npx prisma db push

# Popula os setores e localizações padrão do barracão
npm run db:seed
```

#### 6. Executar o servidor:

* **Em modo de desenvolvimento (com recarga automática via nodemon):**
  ```bash
  npm run dev
  ```

* **Em modo padrão:**
  ```bash
  npm start
  ```

* **Em modo de produção (via PM2 em segundo plano):**
  ```bash
  pm2 start ecosystem.config.js
  ```

Acesse no navegador:
* **Localmente:** [http://localhost:3009](http://localhost:3009)
* **Na rede interna (Coletores e TVs):** `http://<IP-DO-SERVIDOR>:3009`

---

### Configuração de Variáveis de Ambiente (.env)

O arquivo `.env` deve conter os seguintes parâmetros:

| Variável | Descrição | Exemplo Padrão |
| :--- | :--- | :--- |
| `DATABASE_URL` | String de conexão JDBC com o PostgreSQL | `"postgresql://avarias_user:avarias_pass@127.0.0.1:5435/avarias_db"` |
| `PORT` | Porta HTTP em que a aplicação responderá | `3009` |
| `NODE_ENV` | Ambiente de execução (`development` ou `production`) | `development` |

---

### Banco de Dados com Docker Compose

O arquivo `docker-compose.yml` pré-configurado gerencia o PostgreSQL 16 Alpine:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: avarias_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: avarias_user
      POSTGRES_PASSWORD: avarias_pass
      POSTGRES_DB: avarias_db
    ports:
      - "5435:5432"
    volumes:
      - avarias_data:/var/lib/postgresql/data

volumes:
  avarias_data:
```

Comandos úteis para o Docker:
* Subir o banco: `npm run db:up` (ou `docker-compose up -d`)
* Parar o banco: `npm run db:down` (ou `docker-compose down`)
* Ver logs do banco: `docker logs -f avarias_db`

---

## ⚙️ Scripts e Rotinas de Manutenção

O projeto inclui rotinas prontas para integração de dados legados e testes:

### 1. Atualizar Estrutura das Estantes (`update_db_localizacoes.js`)
Configura a hierarquia completa das 8 colunas com 3 andares de paletes para o setor de Sobras (`SOB-C01-N1` a `SOB-C08-N3`), além de criar os setores de piso.
```bash
node update_db_localizacoes.js
```

### 2. Importar Planilha Legada (`import_excel.js`)
Lê o arquivo `PENDÊNCIAS MATRIZ.xlsx`, converte os registros em itens com código único ou etiqueta pré-existente e gera a movimentação inicial de entrada:
```bash
node import_excel.js
```

### 3. Sincronizar Preços e Sugestão (`update_prices.js`)
Varre a planilha procurando colunas `VALOR NF` e `VALOR INTER.` e atualiza os itens existentes aplicando a regra de 40% de sugestão:
```bash
node update_prices.js
```

### 4. Gerar Dados Simulados (`populate_mock.js`)
Cria dezenas de itens de teste espalhados por todos os setores para validar a visualização de volume no mapa 3D:
```bash
node populate_mock.js
```

### 5. Limpeza Total do Banco (`clear_db.js`)
> ⚠️ **CUIDADO:** Deleta todos os itens, movimentações, lotes, localizações e setores.
```bash
node clear_db.js
```

### 6. Prisma Studio (Interface Visual do Banco)
Abre uma interface web no navegador para visualizar e editar as tabelas diretamente:
```bash
npm run db:studio
```

---

## 📡 Referência da API REST

Todas as respostas são servidas em formato JSON (`application/json`), exceto as etiquetas que retornam `application/pdf`.

### 📦 Itens (`/api/items`)

#### `GET /api/items`
Retorna a lista de itens cadastrados com filtros opcionais.
* **Query Params:**
  * `status`: `ESTOQUE` ou `SAIU`
  * `setorId`: ID do setor para filtrar
  * `search`: Termo para busca por nome, código ou descrição
* **Exemplo de Resposta:**
  ```json
  [
    {
      "id": "c1f7a28e-5d1b-4f9a-9e11-828812345678",
      "codigo": "AV-M1K2J3-9X2A",
      "nome": "Smart TV Samsung 55 Polegadas Crystal UHD",
      "quantidade": 1,
      "unidadeMedida": "UN",
      "motivoAvaria": "Tela trincada na lateral esquerda",
      "status": "ESTOQUE",
      "valorNf": 2499.00,
      "valorInternet": 2299.00,
      "sugestao": 919.60,
      "localizacao": {
        "codigo": "SOB-C02-N1",
        "setor": { "nome": "Sobras", "cor": "#E74C3C" }
      }
    }
  ]
  ```

#### `POST /api/items`
Cadastra um novo item, registra a movimentação de entrada e dispara o evento SSE em tempo real.
* **Body:**
  ```json
  {
    "nome": "Lavadora Brastemp 12kg",
    "quantidade": 1,
    "unidadeMedida": "UN",
    "motivoAvaria": "Amassado lateral no transporte",
    "localizacaoId": "uuid-da-localizacao",
    "valorNf": 1850.00,
    "valorInternet": 1799.00,
    "sugestao": 719.60,
    "usuario": "Carlos Operador"
  }
  ```

#### `PUT /api/items/:id`
Atualiza dados cadastrais, quantidades ou preços de um item.

#### `POST /api/items/:id/transferir`
Transfere o item para outra localização física e gera registro de auditoria.
* **Body:**
  ```json
  {
    "localizacaoId": "uuid-do-novo-palete",
    "usuario": "Carlos Operador",
    "observacao": "Transferido por reorganização de rua"
  }
  ```

#### `POST /api/items/:id/saida`
Registra a baixa do item do estoque.
* **Body:**
  ```json
  {
    "motivo": "VENDA",
    "destino": "Comprador de Lote Sucata",
    "quantidade": 1,
    "usuario": "Carlos Operador",
    "observacao": "Venda autorizada pelo setor comercial"
  }
  ```

#### `GET /api/items/scrape/search?q={termo}`
Executa a raspagem de dados no Mercado Livre retornando média de preço e links.

#### `GET /api/items/stats/dashboard`
Retorna os contadores do dashboard (total, em estoque, saídos, ocupação por setor e últimas 10 movimentações).

---

### 📦 Lotes (`/api/lotes`)

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/lotes` | Lista todos os lotes com seus respectivos itens |
| `POST` | `/api/lotes` | Cria um novo lote aberto (`nome`, `usuario`, `observacao`) |
| `GET` | `/api/lotes/:id` | Retorna os detalhes de um lote específico |
| `GET` | `/api/lotes/codigo/:codigo` | Busca um lote pelo seu código (ex: `LOT-2026-0001`) |
| `POST` | `/api/lotes/:id/itens` | Adiciona um item ao lote via `itemId` ou `itemCodigo` |
| `DELETE` | `/api/lotes/:id/itens/:itemId` | Remove um item do lote |
| `POST` | `/api/lotes/:id/fechar` | Fecha o lote e move seus itens para a área `LOTES-GERAL` |
| `POST` | `/api/lotes/:id/saida` | Dá saída em massa em todos os itens que compõem o lote |
| `DELETE` | `/api/lotes/:id` | Exclui um lote aberto, liberando os itens para o estoque geral |

---

### 🚚 Movimentações (`/api/movimentacoes`)

#### `GET /api/movimentacoes`
Lista o histórico de movimentações com filtros por `itemId`, `tipo` (`ENTRADA`, `SAIDA`, `TRANSFERENCIA`) e `limit`.

#### `POST /api/movimentacoes/saida`
Baixa itens do estoque, com lógica de desdobramento para itens idênticos no mesmo palete.

---

### 🏷️ Etiquetas (`/api/etiquetas`)

#### `POST /api/etiquetas/gerar`
Gera um arquivo PDF monocromático no padrão térmico contendo as etiquetas solicitadas.
* **Body:**
  ```json
  {
    "itemIds": ["uuid-item-1", "uuid-item-2"],
    "larguraMM": 90,
    "alturaMM": 100
  }
  ```
* **Retorno:** Stream de arquivo `application/pdf`.

#### `GET /api/etiquetas/preview/:id`
Retorna os dados do item com o QR Code pré-gerado em formato Base64 DataURL para renderização em tela.

---

### 📡 Eventos em Tempo Real (`/api/events`)

Endpoint SSE (*Server-Sent Events*). O cliente abre a conexão e permanece ouvindo eventos contínuos:
* **Headers:**
  * `Content-Type: text/event-stream`
  * `Cache-Control: no-cache`
  * `Connection: keep-alive`
* **Heartbeat:** Linha de comentário `:heartbeat\n\n` a cada 20 segundos para evitar encerramento prematuro por firewalls ou proxies reversos.
* **Evento `novo_item`:**
  ```json
  event: novo_item
  data: {
    "id": "c1f7a28e-5d1b-4f9a-9e11-828812345678",
    "codigo": "AV-M1K2J3-9X2A",
    "nome": "Smart TV Samsung 55 Polegadas",
    "quantidade": 1,
    "setor": "Sobras",
    "setorCor": "#E74C3C",
    "localizacao": "SOB-C02-N1",
    "createdAt": "2026-10-14T11:35:00.000Z"
  }
  ```

---

## 🖥️ Operação em Produção com PM2

Para garantir alta disponibilidade no servidor da Princesa dos Campos sem risco de interrupção por falhas acidentais, utilize o **PM2**:

### Arquivo `ecosystem.config.js`
```javascript
module.exports = {
  apps: [
    {
      name: "controle-avarias",
      script: "./server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3009
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3009
      }
    }
  ]
};
```

### Comandos de Operação:
```bash
# Iniciar a aplicação
pm2 start ecosystem.config.js --env production

# Salvar o estado para reiniciar junto com o Windows/Linux
pm2 save

# Verificar status e consumo de memória
pm2 status

# Monitorar logs em tempo real
pm2 logs controle-avarias

# Reiniciar a aplicação
pm2 restart controle-avarias

# Parar a aplicação
pm2 stop controle-avarias
```

---

## 🖨️ Especificações de Hardware e Acessórios

Para usufruir de 100% dos recursos do sistema no chão de fábrica, recomenda-se:

1. **Impressoras Térmicas de Etiquetas:**
   * **Modelos suportados:** Zebra ZD220 / ZD230, Argox OS-214 Plus, Elgin L42 Pro, Honeywell PC42t.
   * **Etiqueta recomendada:** Tamanho **90mm de largura x 100mm de altura** (Papel Couchê com Ribbon ou Térmico Direto).
   * **Configuração de impressão:** Imprimir em escala 100%, sem margens e resolução mínima de 203 DPI.

2. **Leitores e Coletores de Código de Barras / QR Code:**
   * **Pistola USB Laser/2D:** Qualquer leitor compatível com padrão HID (Honeywell, Zebra, Elgin, Bematech).
   * **Coletores Móveis / Smartphones:** Android 8.0+ com navegador Google Chrome atualizado (permite uso da câmera via HTTPS para escaneamento).

3. **Painéis de TV (Torre de Controle):**
   * Smart TV ou TV comum conectada a uma TV Box/Mini PC (Windows ou Raspberry Pi).
   * Resolução recomendada: Full HD (1920x1080) ou 4K.
   * Navegador em modo tela cheia (F11), com a página `http://<ip-do-servidor>:3009` aberta diretamente na aba **Mapa 3D**.
   * Clicar no botão **🔊 Ativar Som TV** uma única vez para desbloquear a reprodução do sintetizador de áudio no navegador.

---

## 🔍 Solução de Problemas (Troubleshooting)

### 1. Erro de Conexão com o Banco de Dados (`P1001: Can't reach database server`)
* Verifique se o container do Docker está rodando:
  ```bash
  docker ps
  ```
* Se o container `avarias_db` estiver parado, reinicie com:
  ```bash
  npm run db:up
  ```
* Confirme se a porta `5435` não está ocupada por outra aplicação.

### 2. A TV não emite som ao cadastrar item
* A maioria dos navegadores modernos bloqueia reprodução automática de áudio sem interação prévia do usuário (*Autoplay Policy*).
* Na tela da TV, clique no botão **🔊 Ativar Som TV** presente na barra de ferramentas do mapa. Isso liberará o contexto de áudio permanentemente para aquela sessão.

### 3. Falha no Web Scraping de Preços no Mercado Livre
* Redes corporativas podem interceptar tráfego HTTPS via proxy/inspeção de certificados.
* O arquivo `lib/scraper.js` já possui `https.Agent({ rejectUnauthorized: false })` configurado. Certifique-se de que o servidor possui acesso à internet liberado para o domínio `mercadolivre.com.br`.

### 4. Acesso externo de outros computadores ou celulares bloqueado
* Verifique se o firewall do Windows no servidor está permitindo conexões de entrada na porta `3009`:
  ```powershell
  New-NetFirewallRule -DisplayName "Controle Avarias 3009" -Direction Inbound -LocalPort 3009 -Protocol TCP -Action Allow
  ```

---

## 👥 Mantenedor e Contribuição

Desenvolvido para uso interno no setor de Logística e Gestão de Avarias da **Expresso Princesa dos Campos**.

Para relatar inconformidades ou sugerir novas melhorias no motor 3D ou no fluxo de conferência, procure a equipe de desenvolvimento interno.

---

<p align="center">
  <b>AvariasControl — Princesa dos Campos © 2026</b><br>
  <i>Tecnologia e eficiência aplicadas à logística de ponta a ponta.</i>
</p>
