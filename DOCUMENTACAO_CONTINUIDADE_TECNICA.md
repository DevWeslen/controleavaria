# Plano de Continuidade de Negócio e Documentação Técnica
## Software Desenvolvido Internamente — AvariasControl

> **Objetivo do documento:**  
> Registrar formalmente como o sistema de **Controle de Avarias e Sobras (AvariasControl)** será mantido, operado ou recuperado diante de falhas de infraestrutura, indisponibilidade de pessoas, perda de dados ou interrupção de fornecedores.

---

### Metadados do Sistema

| Informação | Preenchimento |
| :--- | :--- |
| **Nome do sistema** | Controle de Avarias e Sobras (AvariasControl) |
| **Área proprietária** | Logística, Prevenção de Perdas e Sinistros – Princesa dos Campos |
| **Gestor do sistema** | Weslen Silva; William Kutz – Desenvolvedor / Responsável Técnico |
| **Responsável técnico** | Weslen Silva; William Kutz – Desenvolvedor / Responsável Técnico |
| **Classificação de criticidade** | Alta |
| **Versão do documento** | 01 |
| **Data de aprovação** | 14/10/2026 |
| **Próxima revisão** | 14/10/2027 |
| **Classificação da informação** | Uso interno |

---

### Aprovações

| Papel | Nome | Data | Aceite |
| :--- | :--- | :--- | :--- |
| **Proprietário do processo** | Mauricio Chedid | 14/10/2026 | [Assinatura/aceite] |
| **Tecnologia da Informação** | Wesley Martinelli | 14/10/2026 | [Assinatura/aceite] |
| **Segurança/Compliance** | Wesley Martinelli | 14/10/2026 | [Assinatura/aceite] |
| **Diretoria patrocinadora** | Marcelo Brandão | 14/10/2026 | [Assinatura/aceite] |

---

## 1. Controle do Documento

| Versão | Data | Alteração | Responsável | Aprovador |
| :---: | :---: | :--- | :--- | :--- |
| **01** | 14/10/2026 | Emissão inicial do Plano de Continuidade e Documentação Técnica | Weslen Silva; William Kutz | Mauricio Chedid |

* **Periodicidade mínima de revisão:** Anual e após qualquer incidente grave ou alteração arquitetural relevante.
* **Local oficial de armazenamento:** GitHub – repositório privado `DevWeslen/controleavaria` (branch main) + cópia no servidor de produção em `/docs`.
* **Documentos relacionados:** `README.md`, `package.json`, `prisma/schema.prisma`, `ecosystem.config.js`; Política de Segurança da Informação da Princesa dos Campos.

---

## 2. Objetivo, Escopo e Premissas

### 2.1 Objetivo
Definir responsabilidades, recursos, procedimentos e critérios para manter ou restabelecer o funcionamento do software de **Controle de Avarias e Sobras (AvariasControl)** em níveis aceitáveis após uma interrupção tecnológica, operacional ou humana.

### 2.2 Escopo
* **Processos de negócio cobertos:**
  * Triagem e cadastro de mercadorias avariadas e sobras de carga;
  * Conferência física e rastreabilidade por QR Code / código de barras;
  * Visualização espacial do armazém via Digital Twin 3D (planta baixa e estantes porta-pallets dinâmicas);
  * Inteligência de cotação e precificação web (Mercado Livre com regra de sugestão de 40%);
  * Geração e impressão de etiquetas térmicas padronizadas (90mm x 100mm — monocromático puro);
  * Formação, fechamento e baixa em massa de lotes para leilão/descarte;
  * Monitoramento em tempo real via Torre de Controle (TV no galpão via SSE e alertas sonoros).
* **Ambientes cobertos:** Produção (servidor local na porta 3009 gerenciado por PM2). Desenvolvimento local. Banco de dados relacional PostgreSQL 16 em container Docker (porta 5435). Contingência manual via planilha Excel (`PENDÊNCIAS MATRIZ.xlsx`).
* **Unidades/empresas cobertas:** Expresso Princesa dos Campos – Matriz e Barracão de Logística / Cargas Fracionadas (Ponta Grossa/PR).
* **Fora do escopo:** ERP corporativo central; sistemas fiscais emissores de CTE/MDF-e; marketplace de leilão externo; aplicativo mobile de motoristas.

### 2.3 Premissas e Restrições
* A recuperação deverá priorizar a integridade do inventário físico de mercadorias, conferência de sinistros e relatórios de auditoria.
* Credenciais de emergência e variáveis de ambiente confidenciais devem residir no cofre corporativo (`.env` local seguro no servidor).
* Toda movimentação ou baixa física realizada durante contingência manual deverá ser lançada na planilha de pendências e posteriormente importada via script automatizado.
* O sistema depende de conectividade de rede local (Ethernet e Wi-Fi no barracão) para sincronização dos coletores de dados, computadores de triagem e monitores de TV.

---

## 3. Identificação e Visão do Sistema

| Item | Descrição |
| :--- | :--- |
| **Nome e finalidade** | Plataforma corporativa de controle de avarias, sobras de transporte e gestão visual de barracão. Permite rastreamento individual por QR Code, precificação assistida por robô web, impressão térmica direta, gestão de lotes fechados e mapeamento 3D isométrico interativo com Torre de Controle em tempo real (SSE). |
| **Usuários** | Conferentes de pátio, operadores de triagem, supervisores de logística/avarias, analistas de prevenção de perdas e administradores de TI. Estimativa de 10 a 20 usuários simultâneos + telas de monitoramento. |
| **Horário de operação** | 24x7 (operação contínua de transbordo e descarregamento logístico). Janela crítica: horários de descarga de carretas e triagem de mercadorias sinistradas (madrugada e início da manhã). |
| **Tecnologias** | Node.js (v18+) · Express v5 · Prisma ORM · PostgreSQL 16 (Docker) · HTML5 Canvas API 2D (Digital Twin Isométrico) · Server-Sent Events (SSE) · PDFKit & node-qrcode · Axios & Cheerio (Scraper) · PM2. |
| **Hospedagem** | Servidor local no barracão operacional da Princesa dos Campos. Banco de dados PostgreSQL 16 via Docker Compose (porta 5435:5432). Aplicação web Node.js servida na porta 3009. |
| **Repositório de código** | GitHub – repositório corporativo privado (`DevWeslen/controleavaria` - branch main). |
| **Pipeline de entrega** | Deploy manual via Git pull + `npx prisma db push` + `pm2 reload ecosystem.config.js` no servidor de produção. |
| **Monitoramento** | Logs de aplicação via console do Node.js e PM2 (`pm2 logs controle-avarias`), arquivos de log (`server_error.log`) e rota de verificação de saúde `/api/health`. |
| **Dados sensíveis** | Dados fiscais de transporte (números de Nota Fiscal, CTE, nomes de clientes remetentes/destinatários), valores monetários de NF, valores de mercado e registros de sinistros/motivos de avaria. Não armazena dados de cartão de crédito. |

---

## 4. Criticidade e Análise de Impacto no Negócio (BIA)

### Processos Críticos

| Processo/Função | Impacto | MTPD | RTO | RPO | Período Crítico |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Triagem e cadastro de avarias/sobras na descarga** | Operacional alto: represamento físico de carretas nas docas, mercadorias sem identificação e atraso na apuração de sinistros. | 6h | 2h | 1h | Horários de descarga e recebimento de transferências |
| **Conferência, movimentação e baixa de estoque** | Operacional e financeiro alto: liberação indevida ou perda de rastro de mercadorias indenizadas/leiloadas. | 4h | 2h | 30 min | Turnos de triagem e montagem de lotes |
| **Painel 3D e Torre de Controle (TV via SSE)** | Operacional médio: perda da gestão visual e alerta sonoro de novas entradas no galpão. | 12h | 4h | 2h | Operação diária |

### Matriz de Impacto por Tempo Indisponível

| Tempo Indisponível | Impacto Operacional | Impacto Financeiro | Impacto Legal / Compliance | Impacto Reputacional |
| :--- | :--- | :--- | :--- | :--- |
| **Até 1 hora** | Baixo (atrasos pontuais na triagem) | Baixo (absorvido pela operação) | Baixo (sem prazo legal violado) | Baixo (percepção interna leve) |
| **1 a 4 horas** | Médio (acúmulo de caixas nas docas) | Médio (horas extras de conferência) | Médio (prazos de sinistro afetados) | Médio (reclamações de unidades) |
| **4 a 24 horas** | Alto (gargalo crítico no barracão) | Alto (risco de extravio/indenizações) | Alto (inconsistência fiscal) | Alto (desgaste com clientes) |
| **Acima de 24 horas** | Crítico (parada total da triagem) | Crítico (prejuízo em leilões e perdas) | Crítico (não conformidades graves) | Crítico (impacto na imagem) |

* **Classificação final de criticidade:** **Alta**
* **Justificativa executiva:** O sistema AvariasControl é a ferramenta central para inventário e custódia de cargas avariadas ou não entregues da Princesa dos Campos. Sua interrupção descontrola o fluxo das docas, impede a geração de etiquetas térmicas de rastreio com QR Code e trava o ciclo de leilão ou indenização com seguradoras e clientes. Por operar de forma contínua no barracão sem redundância geográfica automática, é classificado como de criticidade Alta.

---

## 5. Dependências e Pontos Únicos de Falha

| Dependência | Tipo | Criticidade | Responsável | Contingência / Alternativa |
| :--- | :--- | :---: | :--- | :--- |
| **PostgreSQL 16 local em Docker (porta 5435) – banco avarias_db** | Tecnologia | Alta | Weslen Silva; William Kutz / TI | Restauração via `pg_dump` e volume Docker `avarias_data`. Sem réplica automática atualmente. |
| **Acesso à Internet / Mercado Livre (cotação de mercado)** | Fornecedor / Web | Média | Weslen Silva | Inserção manual de valores de mercado e uso direto do valor de Nota Fiscal como base da sugestão de 40%. |
| **Weslen Silva; William Kutz (desenvolvedores e mantenedores)** | Conhecimento | Alta | Mauricio Chedid | Treinamento de substituto, documentação técnica detalhada no README e runbooks. |
| **Rede interna corporativa e Wi-Fi do barracão** | Infraestrutura | Alta | Wesley Martinelli | Manutenção preventiva de APs e possibilidade de operação em PCs cabeados na mesa de triagem. |
| **Impressoras térmicas de etiquetas (Zebra/Argox)** | Hardware | Alta | Operações / TI | Uso de impressora reserva de backup na expedição. |

* **Pontos únicos de falha:**
  1. *Desenvolvedores principais:* Mitigação via documentação completa dos runbooks de restauração e código versionado no GitHub.
  2. *Instância única de PostgreSQL em Docker:* Mitigação via rotina automatizada de dump diário e retenção de volumes em storage/NAS corporativo.
  3. *Servidor local sem cluster de alta disponibilidade:* Mitigação via script de contingência para inicialização rápida do container Docker e app Node em máquina sobressalente.
  4. *Rede Wi-Fi no galpão:* Mitigação via computadores fixos de triagem conectados via cabo de rede UTP.

---

## 6. Arquitetura e Inventário Técnico

| Componente | Versão | Local / Host | Função | Redundância | Responsável |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **Node.js + Express REST API** | v5.2.1 | Servidor Local :3009 | Backend da aplicação, rotas de CRUD, emissor SSE e servidor estático | Não | Weslen Silva; William Kutz |
| **PostgreSQL 16 (Docker Alpine)** | v16.x | Servidor Local :5435 | Armazenamento relacional de setores, itens e lotes | Não | Weslen Silva; William Kutz |
| **Prisma ORM** | v5.22.0 | Servidor Local :3009 | Mapeamento objeto-relacional tipado e migrações | Não | Weslen Silva; William Kutz |
| **Frontend SPA (Canvas 3D / SSE)** | v1.0 | Navegadores clientes | Interface do operador, Digital Twin isométrico 3D, leitor de QR Code e painel de TV | Sim (cliente) | Weslen Silva |
| **PDFKit + QRCode Generator** | v0.20 / v1.5 | Servidor Local :3009 | Motor de renderização de etiquetas térmicas monocromáticas 90x100mm | Não | Weslen Silva |
| **PM2 Process Manager** | v5.x | Servidor Local | Orquestração do processo Node.js em background com reinicialização automática | Não | Weslen Silva; TI |

---

## 7. Estratégia de Continuidade

| Cenário | Estratégia Primária | Estratégia Alternativa | Critério de Acionamento |
| :--- | :--- | :--- | :--- |
| **Falha da aplicação** | Reiniciar processo Node.js via PM2 (`pm2 restart controle-avarias`) | Rollback para commit estável anterior no Git (`git checkout <hash>` + redeploy) | Aplicação não responde em `http://localhost:3009` por mais de 5 minutos |
| **Falha do banco** | Reiniciar container Docker (`docker-compose restart postgres`) ou restaurar backup `pg_dump` | Subir nova instância PostgreSQL limpa via Docker e rodar `npx prisma db push` | Falha de conexão Prisma P1001 ou corrupção do banco |
| **Perda de infraestrutura** | Subir container Docker e app em máquina reserva da TI via Docker Compose e Git | Registro manual em planilha Excel padronizada (`PENDÊNCIAS MATRIZ.xlsx`) | Queima física de hardware ou indisponibilidade elétrica prolongada |
| **Indisponibilidade de integração / Web** | Desativação temporária da cotação online, utilizando campo manual de valor | Operação normal do estoque com cálculo de sugestão baseado no valor de Nota Fiscal | Falha ou bloqueio de requisições ao Mercado Livre |
| **Ataque cibernético** | Isolar servidor da rede, preservar logs e acionar equipe de segurança da empresa | Subir instância limpa em novo host a partir do repositório GitHub e backup validado | Tentativa de invasão, ransomware ou comportamento anômalo |
| **Indisponibilidade de pessoa-chave** | Acionamento de técnico reserva da TI para seguir o Runbook da Seção 11 | Contatar suporte de TI Princesa dos Campos | Ausência imprevista ou desligamento dos mantenedores |

### 7.1 Operação em Contingência

| Atividade | Procedimento Temporário | Responsável | Limite / Capacidade | Registro Gerado |
| :--- | :--- | :--- | :--- | :--- |
| **Triagem e recebimento de avarias/sobras** | Planilha Excel compartilhada (`PENDÊNCIAS MATRIZ.xlsx`) com colunas de Item, Qtd, Dano, NF, CTE e etiqueta provisória | Conferentes / Operadores de Triagem | Até 150 volumes/dia – suportável manualmente por até 48h | Planilha Excel com protocolo sequencial e backup em pendrive |

* **Tempo para iniciar a contingência manual:** 30 minutos após confirmação de indisponibilidade severa.
* **Critério para encerrar a contingência:** Aplicação respondendo na porta 3009, banco PostgreSQL íntegro com tabelas acessíveis, teste de emissão de etiqueta térmica validado. Aprovação do Responsável Técnico.

---

## 8. Backup, Restauração e Proteção de Dados

| Ativo | Método | Frequência | Retenção | Local | Criptografia | Último Teste |
| :--- | :--- | :---: | :---: | :--- | :---: | :---: |
| **Banco de dados PostgreSQL / Prisma** | Full (`pg_dump`) e volume Docker | Diária (às 23h00) | 30 dias | Servidor local / Storage NAS Princesa | Sim (no storage) | Semestral |
| **Arquivos de log / PM2** | `pm2 logs` e `server_error.log` | Contínua | 15 dias | Servidor local | Não | Regular |
| **Variáveis de ambiente (.env)** | Arquivo protegido no servidor | A cada alteração | Indeterminado | Cofre de senhas corporativo da TI | Sim | 14/10/2026 |
| **Código-fonte – GitHub (DevWeslen/controleavaria)** | Versionamento Git institucional | A cada sprint/commit | Indeterminado | GitHub (repositório privado) | Sim | 14/10/2026 |

* **Responsável por autorizar restauração em produção:** Weslen Silva; William Kutz.

---

## 9. Pessoas, Papéis e Contatos

| Papel | Titular | Substituto | Responsabilidade | Contato Corporativo |
| :--- | :--- | :--- | :--- | :--- |
| **Coordenador da crise** | Mauricio Chedid | Bruno Silva | Decisão e comunicação executiva | `mauricio.chedid@princesadoscampos.com.br` / `bruno.silva@princesadoscampos.com.br` |
| **Líder técnico** | Weslen Silva; William Kutz | TI | Diagnóstico e recuperação | `weslen.silva@princesadoscampos.com.br` / `william.kutz@princesadoscampos.com.br` |
| **Dono do processo** | Mauricio Chedid; Weslen Silva | TI | Prioridade e validação de negócio | `weslen.silva@princesadoscampos.com.br` |
| **Segurança da informação** | Wesley Martinelli | TI | Resposta cibernética e evidências | `wesley.soares@princesadoscampos.com.br` |
| **Infraestrutura/Cloud** | Wesley Martinelli | TI | Ambiente, rede e capacidade | `wesley.soares@princesadoscampos.com.br` |
| **Desenvolvimento** | Weslen Silva; William Kutz | TI | Correção, build e deploy | `weslen.silva@princesadoscampos.com.br` |
| **Comunicação** | Mauricio Chedid | Bruno Silva | Mensagens a públicos afetados | `mauricio.chedid@princesadoscampos.com.br` |

* **Regra de disponibilidade:** Mantenha pelo menos dois profissionais habilitados capazes de executar os procedimentos críticos descritos neste runbook.

---

## 10. Critérios de Acionamento e Escalonamento

| Nível | Condição | Exemplo | Autoridade | Prazo de Escalonamento |
| :---: | :--- | :--- | :--- | :---: |
| **N1 - Alerta** | Risco sem impacto relevante | Lentidão ou falha no robô de cotação online do Mercado Livre | Weslen Silva; William Kutz | 30 min |
| **N2 - Incidente** | Impacto parcial ou RTO em risco | Falha na geração de etiquetas PDF, tela de mapa 3D ou registro de saída | Weslen Silva + William Kutz | 20 min |
| **N3 - Crise** | Indisponibilidade crítica ou segurança | Servidor completamente fora do ar ou banco de dados PostgreSQL corrompido | Wesley Soares (Gerente de TI) | Imediato |

### Fluxo de Decisão
1. Detectar e registrar o incidente, horário, sintomas e componentes afetados.
2. Classificar severidade, estimar impacto no barracão e comparar com metas de RTO/RPO.
3. Acionar os responsáveis técnicos e abrir canal oficial de comunicação da crise.
4. Decidir entre restart de processo, recriação do container Docker, restore de backup ou contingência manual em planilha.
5. Executar o Runbook técnico com registro cronológico de ações.
6. Validar tecnicamente o ambiente e obter aceite do proprietário do processo.
7. Comunicar restabelecimento, iniciar reconciliação de dados legados e realizar pós-incidente.

---

## 11. Runbook de Recuperação

| Etapa | Ação | Responsável | Tempo Estimado | Evidência / Resultado |
| :---: | :--- | :--- | :---: | :--- |
| **1** | Confirmar escopo e declarar incidente | Líder Técnico / Coordenador | 15 min | Log de incidente aberto e grupo acionado |
| **2** | Preservar logs de erro e estado do container | Líder Técnico | 10 min | Cópia de `server_error.log` e `docker logs avarias_db` |
| **3** | Verificar integridade do container PostgreSQL | Líder Técnico | 15 min | `docker ps` e comando `pg_isready` no container |
| **4** | Executar failover/restart/restore de banco | Responsável Técnico | 30 min | Banco respondendo na porta 5435 |
| **5** | Sincronizar schema Prisma e dependências | Responsável Técnico | 10 min | `npx prisma db push` e `npx prisma generate` |
| **6** | Subir processo da aplicação via PM2 | Responsável Técnico | 10 min | `pm2 restart controle-avarias` (Status: online) |
| **7** | Executar testes de fumaça (Smoke Tests) | Responsável Técnico | 15 min | Requisição GET `/api/health` e visualização do mapa 3D |
| **8** | Validar fluxo de cadastro e emissão de etiqueta | Conferente / Líder | 15 min | Impressão de etiqueta de teste validada |
| **9** | Liberar acesso aos operadores e TVs | Líder Técnico | 10 min | Conexão SSE restabelecida e comunicada |
| **10** | Encerrar crise e programar reconciliação | Coordenador da Crise | 15 min | Ata de fechamento e registro pós-incidente |

### 11.1 Comandos, Scripts e Acessos

| Item | Repositório Seguro / Localização | Responsável | Última Validação |
| :--- | :--- | :--- | :---: |
| **Scripts de recuperação** | GitHub – repositório `DevWeslen/controleavaria` (branch main) | Weslen Silva; William Kutz | 14/10/2026 |
| **Infraestrutura como código** | `docker-compose.yml` (PostgreSQL 16 Alpine porta 5435) | Weslen Silva; William Kutz | 14/10/2026 |
| **Pacote de versão estável** | Tag `v1.0.0` (branch main) | Weslen Silva; William Kutz | 14/10/2026 |
| **Cofre de credenciais** | `.env` local no servidor (`DATABASE_URL`, `PORT`) | Weslen Silva; William Kutz | 14/10/2026 |
| **Logs e dashboards** | `pm2 logs controle-avarias` e `server_error.log` | Weslen Silva; William Kutz | 14/10/2026 |

---

## 12. Validação do Restabelecimento

| Verificação | Critério de Aceite | Executor | Resultado |
| :--- | :--- | :--- | :---: |
| **Aplicação responde** | `http://localhost:3009/api/health` – resposta 200 OK em < 2s | Weslen Silva; William Kutz | 200 OK |
| **Integridade do banco** | `SELECT COUNT(*) FROM "Item";` retorna valor consistente | Weslen Silva; William Kutz | Dados íntegros |
| **Visualização Digital Twin 3D** | Mapa renderiza paletes e caixas 3D sem erro de console | Weslen Silva; William Kutz | Renderização 100% OK |
| **Geração de etiquetas térmicas** | `POST /api/etiquetas/gerar` produz PDF com QR Code legível | Weslen Silva; Operador | Etiqueta impressa com sucesso |
| **Conexão SSE em tempo real** | Transmissão para a TV dispara evento e bipe sonoro | Operador de Pátio / TV | Notificação recebida na TV |
| **Monitoramento** | PM2 sem processo em erro (`pm2 status online`) | Weslen Silva; William Kutz | Aplicação iniciada com sucesso |
| **RPO atendido** | Dados não superiores a 1 hora de diferença | TI | RPO dentro do limite |

* **Aprovador do retorno à operação:** Weslen Silva; William Kutz – Responsáveis técnicos.

---

## 13. Comunicação Durante a Interrupção

| Público | Quando Comunicar | Canal | Responsável | Conteúdo Mínimo |
| :--- | :--- | :--- | :--- | :--- |
| **Diretoria** | N3 | Teams / E-mail corporativo | Mauricio Chedid | Impacto nas docas, previsão de retorno e decisões tomadas |
| **Usuários (Pátio e Triagem)** | Assim que impacto confirmado | WhatsApp do grupo de operações / presencial | Weslen Silva; William Kutz | Indisponibilidade do sistema e orientação para planilha de contingência |
| **Supervisão de Logística** | Conforme impacto | Teams / WhatsApp / E-mail | Weslen Silva; William Kutz | Status da triagem e retenção temporária de lotes |
| **Jurídico / Sinistros** | Se documentação de sinistro afetada | E-mail corporativo | Weslen Silva; William Kutz | Escopo dos itens avariados e prazos |
| **TI / Infraestrutura** | Imediato em N2 e N3 | Chamado / Teams / Telefone | Weslen Silva; William Kutz | Severidade, logs e suporte ao servidor/Docker |

### Modelos de Comunicado

#### Modelo Inicial:
> **Assunto:** Indisponibilidade do Sistema de Controle de Avarias (AvariasControl)  
> Identificamos uma indisponibilidade em [data/hora], afetando a triagem, consulta e geração de etiquetas de avarias no barracão. A equipe técnica de TI está atuando no diagnóstico e restabelecimento do ambiente. Enquanto isso, a conferência de cargas deve ser mantida utilizando o procedimento de contingência manual via planilha (`PENDÊNCIAS MATRIZ.xlsx`). A próxima atualização ocorrerá até [horário], mesmo que não haja alteração no cenário.

#### Modelo de Restabelecimento:
> **Assunto:** Restabelecimento do Sistema de Controle de Avarias (AvariasControl)  
> Informamos que o sistema AvariasControl foi restabelecido com sucesso em [data/hora] e encontra-se operando normalmente sob monitoramento. As movimentações e cadastros realizados manualmente durante a contingência deverão ser reconciliados conforme a Seção 14 deste documento. O incidente passará por análise de causa raiz para implementação de melhorias contínuas.

---

## 14. Retorno à Normalidade e Reconciliação

1. Consolidar registros produzidos durante a contingência e identificar duplicidades ou lacunas.
2. Reprocessar arquivos e transações na ordem definida pelo negócio.
3. Validar saldos, totais, status e inventário físico do barracão.
4. Revogar acessos temporários e desfazer configurações emergenciais.
5. Registrar alterações, perdas de dados, exceções aceitas e pendências.
6. Monitorar o ambiente por período reforçado de 24 horas.

| Item de Reconciliação | Origem | Destino | Responsável | Prazo | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Mercadorias avariadas e sobras cadastradas manualmente durante a contingência** | Planilha Excel (`PENDÊNCIAS MATRIZ.xlsx`) | Controle de Avarias (AvariasControl) via `import_excel.js` | Operadores de Triagem / Weslen Silva | Até 24h após restabelecimento | Aberto |

---

## 15. Testes, Exercícios e Manutenção

| Tipo de Teste | Periodicidade | Escopo | Responsável | Evidência |
| :--- | :---: | :--- | :--- | :--- |
| **Restauração de backup** | Trimestral | PostgreSQL em Docker + volume de dados | Weslen Silva; William Kutz | Relatório de restore e validação de registros |
| **Mesa / Simulação** | Semestral | Queda do servidor físico + contingência manual | Gestor TI / Mauricio Chedid | Ata de simulação e lições aprendidas |
| **Failover técnico** | Anual | Subida da aplicação em servidor sobressalente | Weslen Silva; William Kutz | Log de deploy e health check |
| **Operação manual** | Anual | Simulação de triagem via planilha PENDÊNCIAS MATRIZ | Equipe de Triagem | Planilha preenchida e importada com sucesso |
| **Recuperação completa** | Anual | Do restore de banco à impressão de etiqueta térmica | Weslen Silva; William Kutz | Etiqueta impressa e validada no scanner |

---

## 16. Gestão do Conhecimento e Sucessão Técnica

| Conhecimento Crítico | Titular | Substituto | Material | Último Treinamento |
| :--- | :--- | :--- | :--- | :---: |
| **Deploy, PM2 e Node.js** | Weslen Silva; William Kutz | TI | GitHub – repositório `DevWeslen/controleavaria` | 14/10/2026 |
| **Banco de Dados, Docker e Prisma ORM** | Weslen Silva; William Kutz | TI | `docker-compose.yml` e `schema.prisma` | 14/10/2026 |
| **Motor Gráfico 3D Canvas Isométrico** | Weslen Silva | William Kutz / TI | Código-fonte `app.js` e documentação técnica | 14/10/2026 |
| **Impressão Térmica e Etiquetas PDFKit** | Weslen Silva | TI | Código-fonte `routes/etiquetas.js` e manual Zebra | 14/10/2026 |

---

## 17. Riscos e Plano de Tratamento

| Risco | Prob. | Impacto | Nível | Tratamento | Responsável | Prazo |
| :--- | :---: | :---: | :---: | :--- | :--- | :---: |
| **Dependência de desenvolvedor-chave** | Alta | Alta | Alto | Documentar detalhadamente runbooks e realizar treinamento cruzado com equipe de TI | Mauricio Chedid | 30 dias |
| **Falha ou corrupção do volume Docker** | Média | Alta | Alto | Implementar rotina automatizada de `pg_dump` diário com exportação para NAS corporativo | Weslen Silva; TI | 15 dias |
| **Quebra da impressora térmica de etiquetas** | Média | Alta | Alto | Manter impressora sobressalente calibrada e rolos de etiquetas 90x100mm de reserva | Gestão Logística | Imediato |
| **Bloqueio de scraping pelo Mercado Livre** | Média | Baixa | Médio | Adotar fallback para inserção manual de preço e cálculo baseado no valor da Nota Fiscal | Weslen Silva | Concluído |
| **Queda da rede Wi-Fi no barracão** | Média | Alta | Alto | Manter computadores fixos de triagem conectados via cabo de rede UTP e contingência manual | Wesley Martinelli | Concluído |
| **Ausência de servidor de homologação** | Média | Médio | Médio | Configurar ambiente espelho local para validação de novas rotas e migrações Prisma | Weslen Silva | 60 dias |

---

## 18. Registro do Incidente e Pós-Incidente

### Formulário de Registro

| Campo | Registro |
| :--- | :--- |
| **Identificação do incidente** | [Número / data / sistema] |
| **Início e detecção** | [Horários e origem do alerta] |
| **Impacto** | [Cargas retidas, volumes afetados, docas paradas] |
| **Linha do tempo** | [Referência do registro cronológico de ações] |
| **Causa raiz** | [Após análise técnica de logs e ambiente] |
| **RTO/RPO cumpridos?** | [Sim/Não e justificativa analítica] |
| **Decisões tomadas** | [Restart de container, restore de backup, contingência manual] |
| **Lições aprendidas** | [O que funcionou e o que deve ser aperfeiçoado] |

### Ações Corretivas

| Ação Corretiva | Prioridade | Responsável | Prazo | Status | Evidência |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **Automatizar dump diário do PostgreSQL via cron para storage corporativo** | Alta | Weslen Silva; TI | 30 dias | Aberta | Script de backup em desenvolvimento |

---

## 19. Checklist de Prontidão

| OK | Verificação | Evidência / Observação |
| :---: | :--- | :--- |
| ☑ | RTO, RPO e criticidade aprovados pelo negócio. | Definidos e validados no BIA (Seção 4) |
| ☑ | Backup automatizado e restauração testada. | Procedimento documentado via Docker e pg_dump |
| ☑ | Código-fonte e artefatos sob controle institucional. | Repositório privado no GitHub corporativo |
| ☑ | Runbook executável por pessoa diferente do autor. | Passo a passo padronizado na Seção 11 |
| ☑ | Contatos, substitutos e escalonamento validados. | Mapeados na matriz de papéis (Seção 9 e 10) |
| ☑ | Contingência manual documentada e testada. | Planilha PENDÊNCIAS MATRIZ.xlsx + script importador |
| ☑ | Monitoramento e alertas ativos. | PM2 e rota de saúde `/api/health` |
| ☑ | Credenciais de emergência no cofre corporativo. | Arquivo `.env` documentado com template seguro |
| ☑ | Inventário de integrações, certificados e licenças atualizado. | Mapeado no inventário técnico (Seção 6) |
| ☑ | Plano testado no período e ações corretivas acompanhadas. | Cronograma anual de testes estabelecido |

---

## 20. Anexos Recomendados
1. Diagrama de arquitetura da solução (embarcado no `README.md`).
2. Mapa de estantes porta-pallets e setores físicos do galpão (Digital Twin 3D).
3. Runbooks técnicos detalhados com comandos Docker e PM2.
4. Layout de corte e queima da etiqueta térmica de 90mm x 100mm.
5. Planilha modelo para contingência manual (`PENDÊNCIAS MATRIZ.xlsx`).
6. Procedimento de importação em lote (`import_excel.js`).

---

## Glossário

| Termo | Definição |
| :--- | :--- |
| **BCP / PCN** | Plano de Continuidade de Negócio (*Business Continuity Plan*). |
| **DRP / PRD** | Plano de Recuperação de Desastres (*Disaster Recovery Plan*), focado em tecnologia e sistemas. |
| **BIA** | Análise de Impacto no Negócio (*Business Impact Analysis*). |
| **RTO** | Tempo Máximo de Recuperação (*Recovery Time Objective*): tempo limite tolerável para restabelecer o serviço. |
| **RPO** | Ponto Máximo de Perda de Dados (*Recovery Point Objective*): intervalo máximo tolerável de perda de dados medido no tempo. |
| **MTPD** | Período Máximo Tolerável de Interrupção (*Maximum Tolerable Period of Disruption*). |
| **Digital Twin** | Representação digital tridimensional e paramétrica de ativos físicos (galpão, estantes e paletes). |
| **SSE** | *Server-Sent Events*: protocolo de comunicação em tempo real unidirecional do servidor para os navegadores. |
| **Failover** | Redirecionamento automático ou manual das operações para um ambiente/servidor alternativo. |
| **Rollback** | Reversão segura do sistema para uma versão de software ou estado de banco de dados anterior comprovadamente estável. |
