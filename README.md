# 📦 AvariasControl - Princesa dos Campos

O **AvariasControl** é um ecossistema interno, robusto e moderno, criado sob medida para a otimização logística, auditoria e rastreamento de mercadorias avariadas e lotes de sobras.

## 🛠️ Stack Tecnológico
O sistema adota um ecossistema baseado em JavaScript/Node.js, focado em alta performance, comunicação assíncrona e visualização interativa.

### Backend (Servidor)
* **Node.js + Express:** API REST veloz para gerenciar as rotas da aplicação.
* **Prisma (ORM):** Mapeamento objeto-relacional tipado para interações seguras e ágeis com o banco de dados.
* **SQLite / Banco Relacional:** Banco de dados otimizado.
* **Puppeteer / Scraping Tools:** Web scraping dinâmico para varrer a internet (como MercadoLivre) em busca do preço real dos produtos avariados em tempo de execução.
* **SSE (Server-Sent Events):** Transmissão unidirecional em tempo real do servidor para os clientes (WebSockets *lightweight*), essencial para a atualização da Torre de Controle (TV).
* **PDFKit + QRCode:** Geração dinâmica de etiquetas em PDF monocromático, 100% otimizadas para leitura rápida em impressoras térmicas empresariais (como Zebra).
* **PM2:** Gerenciador de processos (via `ecosystem.config.js`) garantindo que o servidor rode em segundo plano sem quedas (*Zero Downtime*).

### Frontend (Cliente)
* **Vanilla JavaScript (ES6+) & HTML/CSS:** Arquitetura leve e livre de dependências pesadas de framework para máxima velocidade de carregamento em qualquer dispositivo (Desktop, Coletores, TVs).
* **Canvas API 2D Avançado (Digital Twin):** Renderização matemática em canvas, construindo um ambiente pseudo-3D isométrico do zero para mapear visualmente a planta-baixa, corredores e prateleiras do armazém.
* **CSS3 Custom Variables & Responsividade:** Sistema unificado de *design tokens*, garantindo adaptação entre modos mobile (operador no pátio) e modo TV (gestão visual).

---

## 🎯 Principais Funcionalidades e Ferramentas

### 1. Digital Twin 3D Interativo (Visão do Armazém)
* **Planta Baixa Virtual:** Representação geométrica isométrica do armazém com ruas demarcadas e setores separados por cores.
* **Racks e Prateleiras (Porta-Pallets dinâmicos):** Construção dinâmica de nichos empilhados. Quanto mais itens em uma localização ("Gaiola", "Sobras", "Seguro"), mais caixas "brotam" visivelmente nas prateleiras no 3D.
* **Câmera Inteligente & Destaque em Tempo Real:** Uma busca por código ilumina o palete específico em branco piscante, fazendo a câmera voar suavemente até o alvo para rápida localização física pelo operador.

### 2. Gestão do Ciclo de Vida dos Itens e Compliance
* **Cadastro Automatizado:** Geração automática de códigos identificadores únicos e associação visual instantânea a um setor/localização (ex: `SOB`, `GAI-CHAO`).
* **Trilha de Auditoria (Movimentações):** Rastreio inalterável que responde as perguntas vitais da logística: **quem, quando, para onde e por que** um item foi movido (Entrada, Venda, Descarte, Transferência, etc).

### 3. Sistema Integrado de Inteligência de Mercado e Precificação
* O sistema não apenas guarda a caixa, ele a *avalia*. Rotas de *scraping* buscam similaridade de preços do item na web com base na sua descrição.
* Gestores conseguem visualizar rapidamente se a peça compensa ser reparada ou se o repasse (leilão) em lote fechado é o caminho mais lucrativo (comparando *Valor NF* vs *Valor de Mercado*).

### 4. Geração Profissional de Etiquetas Térmicas PDF
* Rotina geradora de arquivos `.pdf` monocromáticos com QR Code nítido, dispensando licenças de softwares complexos de terceiros.
* Ausência de tons acinzentados ou fundos, garantindo leitura a laser impecável, além de detalhar visualmente motivos de avaria para o leiturista.

### 5. Modo "Torre de Controle" (TV) via SSE
* Arquivos voltados a eventos (`lotes_sse.js`) transformam telas comuns do galpão em painéis de *War Room*.
* Sempre que um operador bipa ou cadastra um item no sistema via coletor, a TV emite um bipe de sucesso e **automaticamente anima a câmera** para a estante/gaiola onde a caixa foi fisicamente depositada, exibindo os detalhes recém-chegados por 8 segundos antes de retornar à visão global, *sem necessidade de refresh (F5)*.

### 6. Agrupamento em "Lotes Fechados"
* Possibilidade de consolidar diversas mercadorias de curva C ou sem liquidez individual, gerando um "Lote Pai" unificado com uma única etiqueta agregada, facilitando vendas em bloco e leilões físicos.

---

## 🚀 Como Iniciar e Executar o Projeto

1. **Instalar Dependências:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Gerar e Semear o Banco de Dados:**
   \`\`\`bash
   # Gera os tipamentos do Prisma
   npx prisma generate
   # Sincroniza e cria as tabelas no DB
   npx prisma db push
   # Opcionalmente, semeia localizações, corredores e cores base no mapa:
   node prisma/seed.js
   \`\`\`

3. **Subir a Aplicação:**
   **Modo desenvolvimento (Dev):**
   \`\`\`bash
   npm run dev
   \`\`\`
   
   **Modo produção (Serviço em Background via PM2):**
   \`\`\`bash
   pm2 start ecosystem.config.js
   \`\`\`

*(A aplicação estará acessível através da porta especificada no arquivo `.env` na raiz do repositório).*
