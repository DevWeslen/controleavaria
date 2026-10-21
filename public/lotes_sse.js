// =====================
// SERVER-SENT EVENTS (SSE) - Notificação em tempo real
// =====================
let evtSource;

function initSSE() {
  if (evtSource) return; // já inicializado

  evtSource = new EventSource('/api/events');
  
  evtSource.addEventListener('novo_item', (e) => {
    try {
      const item = JSON.parse(e.data);
      console.log('Novo item via SSE:', item);
      
      // Tentar tocar o som
      if (typeof window.playSuccessBeep === 'function') {
        window.playSuccessBeep();
      } else {
        playBeep();
      }

      // Se o usuário estiver na tela do mapa (ex: TV), faz a animação e mostra o modal
      if (typeof currentPage !== 'undefined' && currentPage === 'mapa' && item.localizacao) {
        
        // Foca no item no mapa
        window.highlightedLoc = item.localizacao;
        if (typeof drawablePaletes !== 'undefined') {
          const palete = drawablePaletes.find(p => 
            p.loc && p.loc.codigo === item.localizacao || 
            (p.setor && p.setor.nome === item.localizacao)
          );

          if(palete && typeof animateCamera === 'function') {
            animateCamera(45, 160, 2.5, palete.x, palete.z);
          } else if(typeof drawWarehouse === 'function') {
            drawWarehouse();
          }
        }

        // Mostra o modal
        setTimeout(() => {
          const details = document.getElementById('modalRegistrationDetails');
          const modal = document.getElementById('modalRegistrationSuccess');
          if(details && modal) {
            details.innerHTML = `
              <strong style="color:white;font-size:16px;">${item.nome}</strong><br>
              <span style="color:var(--primary);">Código: ${item.codigo}</span><br>
              Localização: ${item.localizacao || '—'}<br>
              Quantidade: ${item.quantidade}
            `;
            modal.style.display = 'flex';
          }
        }, 600);

        // Fecha automaticamente o modal depois de 8 segundos (modo TV)
        setTimeout(() => {
          if (typeof window.closeRegistrationModal === 'function') {
            window.closeRegistrationModal();
          }
        }, 8600);

      } else {
        // Exibir card toast normal se não estiver no mapa
        showToast(`NOVO ITEM: ${item.nome} (${item.codigo})\nLocal: ${item.localizacao || 'N/A'}`, 'info', 5000);
      }

      // Atualizar lista de estoque se estiver nela
      if (typeof currentPage !== 'undefined') {
         if (currentPage === 'estoque' && typeof loadEstoque === 'function') loadEstoque();
         if (currentPage === 'dashboard' && typeof loadDashboard === 'function') loadDashboard();
         if (currentPage === 'mapa' && typeof loadMapa === 'function') loadMapa();
      }
    } catch(err) {
      console.error('Erro ao processar SSE:', err);
    }
  });

  evtSource.onerror = (err) => {
    console.error('EventSource failed:', err);
    evtSource.close();
    evtSource = null;
    // Tentar reconectar em 5 segundos
    setTimeout(initSSE, 5000);
  };
}

// Inicia o SSE assim que carregar o script
document.addEventListener('DOMContentLoaded', initSSE);

function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // Frequência em Hz
    oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch(e) {
    console.warn("Web Audio API não suportada ou bloqueada", e);
  }
}

// =====================
// TRANSFERÊNCIA DE ITENS
// =====================
async function carregarLocalizacoesTransferencia() {
  const select = document.getElementById('transLocalizacaoId');
  if(!select) return;
  select.innerHTML = '<option value="">Carregando...</option>';
  try {
    const setores = await apiFetch('/setores');
    select.innerHTML = '<option value="">-- Selecione o Destino --</option>';
    setores.forEach(setor => {
      // Filtrar o setor de lotes fechados (não pode transferir direto pra lá)
      if(setor.nome.toUpperCase().includes('LOTES FECHADOS')) return;
      
      const optgroup = document.createElement('optgroup');
      optgroup.label = setor.nome;
      setor.localizacoes.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.id;
        option.textContent = loc.codigo;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });
  } catch(e) {
    select.innerHTML = '<option value="">Erro ao carregar localizações</option>';
  }
}

function abrirTransferenciaDoModal() {
  if (typeof currentItemForModal === 'undefined' || !currentItemForModal) {
    showToast('Erro: Item não encontrado no contexto do modal.', 'error');
    return;
  }
  const itemId = currentItemForModal.id;
  const nome = currentItemForModal.nome;
  const setorAtual = currentItemForModal.localizacao?.setor?.nome || 'N/A';

  document.getElementById('transItemId').value = itemId;
  document.getElementById('transItemNome').textContent = nome;
  document.getElementById('transItemAtual').textContent = `Atual: ${setorAtual}`;
  
  document.getElementById('transUsuario').value = '';
  document.getElementById('transObservacao').value = '';

  carregarLocalizacoesTransferencia();
  
  closeModal('modalDetalhes');
  document.getElementById('modalTransferencia').style.display = 'flex';
}

async function confirmarTransferencia() {
  const itemId = document.getElementById('transItemId').value;
  const localizacaoId = document.getElementById('transLocalizacaoId').value;
  const usuario = document.getElementById('transUsuario').value;
  const observacao = document.getElementById('transObservacao').value;

  if(!localizacaoId) {
    showToast('Selecione a localização de destino', 'warning');
    return;
  }

  try {
    const btn = document.querySelector('#modalTransferencia .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Aguarde...';

    await apiFetch(`/items/${itemId}/transferir`, {
      method: 'POST',
      body: { localizacaoId, usuario, observacao }
    });

    showToast('Item transferido com sucesso!', 'success');
    closeModal('modalTransferencia');
    
    // Atualiza a tela de origem
    if(typeof currentPage !== 'undefined') {
      if(currentPage === 'estoque') loadEstoque();
      if(currentPage === 'mapa') loadMapa();
    }
  } catch(e) {
    showToast('Erro ao transferir: ' + e.message, 'error');
  } finally {
    const btn = document.querySelector('#modalTransferencia .btn-primary');
    btn.disabled = false;
    btn.textContent = 'Transferir';
  }
}

// =====================
// GERENCIAMENTO DE LOTES
// =====================

function formatarBrlLote(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcularTotaisLote(lote) {
  let totalNf = 0;
  let totalInternet = 0;
  let totalSugestao = 0;
  let totalQtd = 0;

  (lote.itens || []).forEach(i => {
    const qtd = Number(i.quantidade) || 1;
    const vn = Number(i.valorNf) || 0;
    const vi = Number(i.valorInternet) || 0;
    let sug = Number(i.sugestao) || 0;
    if (!sug && vi > 0) sug = vi * 0.4;
    else if (!sug && vn > 0) sug = vn * 0.4;

    totalNf += vn;
    totalInternet += vi;
    totalSugestao += sug;
    totalQtd += qtd;
  });

  return { totalNf, totalInternet, totalSugestao, totalQtd };
}

// Status efetivo: lote FECHADO cujos itens já saíram todos conta como SAIU (cobre lotes antigos)
function statusEfetivoLote(lote) {
  if (lote.status === 'SAIU') return 'SAIU';
  const itens = lote.itens || [];
  if (lote.status === 'FECHADO' && itens.length > 0 && itens.every(i => i.status === 'SAIU')) return 'SAIU';
  return lote.status;
}

const LOTE_STATUS_UI = {
  ABERTO: { label: 'ABERTO', icon: '🟢', bg: 'rgba(52, 211, 153, 0.15)', fg: '#34D399', bd: 'rgba(52, 211, 153, 0.3)', accent: '#34D399' },
  FECHADO: { label: 'FECHADO • AGUARDANDO SAÍDA', icon: '🟠', bg: 'rgba(245, 158, 11, 0.15)', fg: '#FBBF24', bd: 'rgba(245, 158, 11, 0.35)', accent: '#F59E0B' },
  SAIU: { label: 'SAIU', icon: '📤', bg: 'rgba(96, 165, 250, 0.15)', fg: '#60A5FA', bd: 'rgba(96, 165, 250, 0.35)', accent: '#60A5FA' }
};

let loteFiltroStatus = 'TODOS';

function setFiltroLotes(f) {
  loteFiltroStatus = f;
  loadLotes();
}

function darSaidaLote(loteId, nome, qtd) {
  document.getElementById('modalLoteNome').textContent = nome;
  document.getElementById('modalLoteQtd').textContent = qtd;
  document.getElementById('modalLoteSaida').style.display = 'flex';
  document.getElementById('btnConfirmarLoteSaida').onclick = async () => {
    const destino = document.getElementById('modalLoteDestino').value || 'Leilão/Transferência';
    try {
      await apiFetch(`/lotes/${loteId}/saida`, { method: 'POST', body: { motivo: 'LOTE_SAIDA', destino } });
      showToast('Saída do lote registrada com sucesso!', 'success');
      closeModal('modalLoteSaida');
      loadLotes();
    } catch (e) {
      showToast('Erro ao dar saída no lote: ' + e.message, 'error');
    }
  };
}

async function loadLotes() {
  const container = document.getElementById('lotesContainer');
  if(!container) return;
  container.innerHTML = '<div class="loading-spinner" style="margin:20px auto"></div>';
  
  try {
    const lotes = await apiFetch('/lotes');
    if(!lotes || lotes.length === 0) {
      container.innerHTML = '<p style="color:#aaa; text-align:center; padding:30px 0;">Nenhum lote criado ainda. Utilize o formulário acima para criar o primeiro lote.</p>';
      
      // Zerar cards de métricas
      const elTotal = document.getElementById('statLotesTotal');
      if (elTotal) elTotal.textContent = '0';
      const elAbertos = document.getElementById('statLotesAbertos');
      if (elAbertos) elAbertos.textContent = '0';
      const elFechados = document.getElementById('statLotesFechados');
      if (elFechados) elFechados.textContent = '0';
      const elValSug = document.getElementById('statLotesValorSugestao');
      if (elValSug) elValSug.textContent = 'R$ 0,00';
      const elValNf = document.getElementById('statLotesValorNf');
      if (elValNf) elValNf.textContent = 'R$ 0,00';
      const elTotalItens = document.getElementById('statLotesTotalItens');
      if (elTotalItens) elTotalItens.textContent = '0';
      const elTotalUnidades = document.getElementById('statLotesTotalUnidades');
      if (elTotalUnidades) elTotalUnidades.textContent = '0';
      return;
    }

    // Calcular totais consolidados para as métricas do topo
    let grandTotalSugestao = 0;
    let grandTotalNf = 0;
    let grandTotalItens = 0;
    let grandTotalUnidades = 0;
    let abertosCount = 0;
    let fechadosCount = 0;
    let saiuCount = 0;

    const lotesComTotais = lotes.map(l => {
      const lote = { ...l, status: statusEfetivoLote(l) };
      const totais = calcularTotaisLote(lote);
      if (lote.status === 'ABERTO') abertosCount++;
      else if (lote.status === 'SAIU') saiuCount++;
      else fechadosCount++;

      grandTotalSugestao += totais.totalSugestao;
      grandTotalNf += totais.totalNf;
      grandTotalItens += (lote.itens ? lote.itens.length : 0);
      grandTotalUnidades += totais.totalQtd;

      return { lote, totais };
    });

    // Barra de filtros visual
    const filtroBar = document.getElementById('lotesFiltroBar');
    if (filtroBar) {
      const chips = [
        ['TODOS', 'Todos', lotes.length, '#9ca3af'],
        ['ABERTO', '🟢 Abertos', abertosCount, '#34D399'],
        ['FECHADO', '🟠 Aguardando saída', fechadosCount, '#FBBF24'],
        ['SAIU', '📤 Já saíram', saiuCount, '#60A5FA']
      ];
      filtroBar.innerHTML = chips.map(([k, label, n, cor]) => `
        <button onclick="setFiltroLotes('${k}')" style="cursor:pointer; padding:7px 14px; border-radius:20px; font-size:13px; font-weight:600; border:1px solid ${cor}; background:${loteFiltroStatus === k ? cor : 'transparent'}; color:${loteFiltroStatus === k ? '#111' : cor};">${label} (${n})</button>
      `).join('');
    }
    const elSaiu = document.getElementById('statLotesSairam');
    if (elSaiu) elSaiu.textContent = saiuCount;
    const lotesVisiveis = lotesComTotais.filter(({ lote }) => loteFiltroStatus === 'TODOS' || lote.status === loteFiltroStatus);

    // Atualizar métricas consolidadas no topo da página de lotes
    const elTotal = document.getElementById('statLotesTotal');
    if (elTotal) elTotal.textContent = lotes.length;
    const elAbertos = document.getElementById('statLotesAbertos');
    if (elAbertos) elAbertos.textContent = abertosCount;
    const elFechados = document.getElementById('statLotesFechados');
    if (elFechados) elFechados.textContent = fechadosCount;
    const elValSug = document.getElementById('statLotesValorSugestao');
    if (elValSug) elValSug.textContent = formatarBrlLote(grandTotalSugestao);
    const elValNf = document.getElementById('statLotesValorNf');
    if (elValNf) elValNf.textContent = formatarBrlLote(grandTotalNf);
    const elTotalItens = document.getElementById('statLotesTotalItens');
    if (elTotalItens) elTotalItens.textContent = grandTotalItens;
    const elTotalUnidades = document.getElementById('statLotesTotalUnidades');
    if (elTotalUnidades) elTotalUnidades.textContent = grandTotalUnidades;

    // Renderizar cada lote existente
    container.innerHTML = lotesVisiveis.length === 0 ? '<p style="color:#aaa; text-align:center; padding:30px 0;">Nenhum lote neste filtro.</p>' : lotesVisiveis.map(({ lote, totais }) => { const ui = LOTE_STATUS_UI[lote.status] || LOTE_STATUS_UI.FECHADO; return `
      <div class="lote-card" style="background:#1e1e24; border:1px solid #2d2d3a; border-left:5px solid ${ui.accent}; border-radius:10px; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow: 0 4px 14px rgba(0,0,0,0.25); ${lote.status === 'SAIU' ? 'opacity:0.8;' : ''}">
        
        <!-- CABEÇALHO DO LOTE -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
          <div>
            <div style="display:flex; align-items:center; gap:10px;">
              <h4 style="margin:0; font-size:17px; font-weight:700; color:#fff;">${lote.nome}</h4>
              <span style="padding:3px 8px; border-radius:4px; font-size:11px; font-weight:700; letter-spacing:0.5px; background:${ui.bg}; color:${ui.fg}; border: 1px solid ${ui.bd};">${ui.icon} ${ui.label}</span>
            </div>
            <p style="margin:4px 0 0 0; font-size:12px; color:#9ca3af;">
              <code style="color:#F59E0B; font-weight:600;">${lote.codigo}</code> &bull; Criado por: <strong style="color:#e5e7eb;">${lote.usuario || 'N/A'}</strong>
              ${lote.createdAt ? ` &bull; ${new Date(lote.createdAt).toLocaleDateString('pt-BR')}` : ''}
            </p>
            ${lote.observacao ? `<p style="margin:4px 0 0 0; font-size:12px; color:#9ca3af; font-style:italic;">Obs: ${lote.observacao}</p>` : ''}
          </div>
        </div>

        <!-- PAINEL DE VALORES DO LOTE -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:10px; padding:12px 14px; background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.06); border-radius:8px;">
          <div>
            <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af; display:block;">Valor Representado (Lote)</span>
            <strong style="font-size:18px; color:#34D399; display:block; margin-top:2px;">${formatarBrlLote(totais.totalSugestao)}</strong>
            <span style="font-size:10px; color:#6b7280;">Avaliação / Sugestão de Leilão</span>
          </div>

          <div>
            <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af; display:block;">Valor NF Total</span>
            <strong style="font-size:16px; color:#60A5FA; display:block; margin-top:2px;">${formatarBrlLote(totais.totalNf)}</strong>
            <span style="font-size:10px; color:#6b7280;">Soma do valor fiscal dos itens</span>
          </div>

          ${totais.totalInternet > 0 ? `
          <div>
            <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af; display:block;">Valor Mercado Web</span>
            <strong style="font-size:16px; color:#FBBF24; display:block; margin-top:2px;">${formatarBrlLote(totais.totalInternet)}</strong>
            <span style="font-size:10px; color:#6b7280;">Preço de referência e-commerce</span>
          </div>` : ''}

          <div>
            <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af; display:block;">Volume Físico</span>
            <strong style="font-size:16px; color:#e5e7eb; display:block; margin-top:2px;">${lote.itens.length} itens</strong>
            <span style="font-size:10px; color:#6b7280;">${totais.totalQtd} unidades físicas</span>
          </div>
        </div>
        
        <!-- ITENS DO LOTE -->
        <div style="background:#141418; padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.04);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:12px; font-weight:600; color:#d1d5db;">Itens neste lote:</span>
            <span style="font-size:11px; color:#9ca3af;">${lote.itens.length} item(ns)</span>
          </div>
          
          ${lote.itens.length === 0 ? `
            <p style="margin:0; font-size:12px; color:#6b7280; font-style:italic;">Nenhum item associado a este lote ainda. Clique em "Adicionar Item" abaixo para associar itens do estoque.</p>
          ` : `
            <div style="display:flex; gap:8px; flex-wrap:wrap; max-height: 220px; overflow-y: auto; padding: 2px;">
              ${lote.itens.map(i => {
                const itemSug = Number(i.sugestao) || (i.valorInternet ? i.valorInternet * 0.4 : (i.valorNf ? i.valorNf * 0.4 : 0));
                return `
                <span style="background:#262630; border:1px solid ${i.status === 'SAIU' ? 'rgba(96,165,250,0.4)' : '#3b3b4a'}; padding:6px 10px; border-radius:6px; font-size:12px; color:#e5e7eb; display:inline-flex; align-items:center; gap:8px; ${i.status === 'SAIU' ? 'opacity:0.65;' : ''}">
                  ${i.status === 'SAIU' ? '<span style="font-size:10px; font-weight:700; color:#60A5FA;">📤 SAIU</span>' : ''}
                  <code style="color:#60A5FA; font-weight:600;">${i.codigo}</code>
                  <span style="max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${i.nome}">${i.nome}</span>
                  <span style="color:#9ca3af; font-size:11px;">(${i.quantidade || 1} un)</span>
                  ${itemSug > 0 ? `<strong style="color:#34D399; font-size:11px;" title="Sugestão / Leilão">${formatarBrlLote(itemSug)}</strong>` : ''}
                  ${i.valorNf ? `<span style="color:#888; font-size:10px;" title="Valor NF">(NF: ${formatarBrlLote(i.valorNf)})</span>` : ''}
                  ${lote.status === 'ABERTO' ? `
                    <button onclick="removerItemDoLote('${lote.id}', '${i.id}')" style="background:rgba(239, 68, 68, 0.2); border:1px solid rgba(239, 68, 68, 0.4); color:#F87171; cursor:pointer; font-weight:bold; font-size:13px; padding:0 5px; line-height:1.2; border-radius:4px; margin-left:2px;" title="Remover item do lote">&times;</button>
                  ` : ''}
                </span>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- AÇÕES DO LOTE -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
          ${lote.status === 'ABERTO' ? `
             <button class="btn-danger-small" style="background:transparent; border:1px solid #E74C3C; color:#E74C3C; padding:6px 12px;" onclick="apagarLote('${lote.id}')">🗑️ Apagar Lote</button>
             <div style="display:flex; gap:10px;">
                <button class="btn-primary-small" style="padding:6px 14px;" onclick="promptAdicionarItemLote('${lote.id}')">➕ Adicionar Item</button>
                ${lote.itens.length > 0 ? `<button class="btn-danger-small" style="padding:6px 14px; background:#D97706; border-color:#F59E0B; color:#fff;" onclick="fecharLote('${lote.id}')">🔒 Fechar Lote</button>` : ''}
             </div>
          ` : lote.status === 'SAIU' ? `
             <span style="font-size:12px; color:#60A5FA; font-weight:600;">📤 Saiu do estoque${lote.updatedAt ? ' em ' + new Date(lote.updatedAt).toLocaleString('pt-BR') : ''}</span>
             <div style="display:flex; gap:10px;">
               <button class="btn-primary-small" style="padding:6px 14px;" onclick="imprimirEtiquetaLote('${lote.codigo}', '${lote.nome}')">🖨️ Etiqueta de Lote</button>
             </div>
          ` : `
             <span style="font-size:12px; color:#9ca3af;">Fechado em: ${lote.fechadoAt ? new Date(lote.fechadoAt).toLocaleString('pt-BR') : '—'}</span>
             <div style="display:flex; gap:10px;">
               <button class="btn-primary-small" style="padding:6px 14px;" onclick="imprimirEtiquetaLote('${lote.codigo}', '${lote.nome}')">🖨️ Etiqueta de Lote</button>
               <button class="btn-danger-small" style="padding:6px 14px; background:#2563EB; border-color:#3B82F6; color:#fff;" onclick="darSaidaLote('${lote.id}', decodeURIComponent('${encodeURIComponent(lote.nome)}'), ${lote.itens.length})">📤 Dar Saída</button>
             </div>
          `}
        </div>
      </div>
    `; }).join('');

  } catch(e) {
    container.innerHTML = '<p style="color:var(--danger); padding:20px; text-align:center;">Erro ao carregar lotes: ' + e.message + '</p>';
  }
}

async function criarLote() {
  const nome = document.getElementById('loteNome').value.trim();
  let usuario = document.getElementById('loteUsuario').value.trim();
  const observacao = document.getElementById('loteObservacao').value.trim();

  if(!nome) {
    showToast('O nome do lote é obrigatório', 'warning');
    return;
  }

  if (!usuario && typeof currentUser !== 'undefined' && currentUser) {
    usuario = currentUser.nome || currentUser.username || currentUser.login || '';
  }

  try {
    await apiFetch('/lotes', {
      method: 'POST',
      body: { nome, usuario, observacao }
    });
    showToast('Lote criado com sucesso!', 'success');
    document.getElementById('loteNome').value = '';
    document.getElementById('loteObservacao').value = '';
    // Mantém o nome do usuário responsável preenchido para comodidade
    if (typeof currentUser !== 'undefined' && currentUser) {
      document.getElementById('loteUsuario').value = currentUser.nome || currentUser.username || currentUser.login || '';
    } else {
      document.getElementById('loteUsuario').value = '';
    }
    loadLotes();
  } catch(e) {
    showToast('Erro ao criar lote: ' + e.message, 'error');
  }
}

async function promptAdicionarItemLote(loteId) {
  if (typeof abrirScanner === 'function') {
    abrirScanner('lote', loteId);
  } else {
    showToast('Scanner indisponível', 'error');
  }
}

async function processScanParaLote(loteId, codigoLido) {
  if(!codigoLido) return;
  showToast('Buscando ' + codigoLido + '...', 'info');

  try {
    const res = await apiFetch(`/items?search=${encodeURIComponent(codigoLido.trim())}`);
    if (!res || res.length === 0) {
       showToast('Item não encontrado: ' + codigoLido, 'error');
       return;
    }
    const item = res.find(i => i.codigo.toUpperCase() === codigoLido.trim().toUpperCase()) || res[0];

    await apiFetch(`/lotes/${loteId}/itens`, {
      method: 'POST',
      body: { itemCodigo: item.codigo }
    });
    showToast('Item adicionado ao lote com sucesso!', 'success');
    
    // Toca som de sucesso para feedback rapido se o scanner continua aberto
    if (typeof playBeep === 'function') playBeep();
    
    loadLotes();
  } catch(e) {
    showToast('Erro ao adicionar item: ' + e.message, 'error');
  }
}

async function fecharLote(loteId) {
  if(!confirm("Tem certeza que deseja fechar este lote? Os itens serão movidos para 'Lotes Fechados'.")) return;

  try {
    await apiFetch(`/lotes/${loteId}/fechar`, { method: 'POST', body: {} });
    showToast('Lote fechado com sucesso!', 'success');
    loadLotes();
  } catch(e) {
    showToast('Erro ao fechar lote: ' + e.message, 'error');
  }
}

function imprimirEtiquetaLote(codigo, nome) {
  const preview = window.open('', '_blank');
  preview.document.write(`
    <html>
    <head>
      <title>Etiqueta Lote</title>
      <style>
        body { font-family: sans-serif; text-align: center; margin: 0; padding: 20px; }
        .etiqueta { border: 2px dashed #000; padding: 20px; display: inline-block; }
        h2 { margin: 0 0 10px 0; font-size: 24px; }
        h4 { margin: 0 0 20px 0; font-size: 16px; color: #555; }
        img { max-width: 200px; }
        .codigo { font-family: monospace; font-size: 18px; margin-top: 10px; font-weight: bold; }
      </style>
    </head>
    <body onload="window.print()">
      <div class="etiqueta">
        <h2>LOTE FECHADO</h2>
        <h4>${nome}</h4>
        <!-- Gerando QR usando API externa para simplificar -->
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(codigo)}" alt="QR Code">
        <div class="codigo">${codigo}</div>
      </div>
    </body>
    </html>
  `);
  preview.document.close();
}

async function apagarLote(loteId) {
  window.customConfirm(
    'Apagar Lote?',
    'Deseja realmente apagar este lote? Os itens voltarão para o estoque normal.',
    '🗑️',
    async () => {
      try {
        await apiFetch(`/lotes/${loteId}`, { method: 'DELETE' });
        showToast('Lote apagado com sucesso!', 'success');
        loadLotes();
      } catch(e) {
        showToast('Erro ao apagar lote: ' + e.message, 'error');
      }
    }
  );
}

async function removerItemDoLote(loteId, itemId) {
  window.customConfirm(
    'Remover Item?',
    'Tem certeza que deseja remover este item do lote?',
    '✂️',
    async () => {
      try {
        await apiFetch(`/lotes/${loteId}/itens/${itemId}`, { method: 'DELETE' });
        showToast('Item removido do lote!', 'success');
        loadLotes();
      } catch(e) {
        showToast('Erro ao remover item do lote: ' + e.message, 'error');
      }
    }
  );
}
