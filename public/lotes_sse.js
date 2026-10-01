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
            p.id === item.localizacao || 
            (p.loc && p.loc.codigo === item.localizacao) ||
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
         if (currentPage === 'mapa' && typeof loadMapa === 'function' && !item.localizacao) loadMapa();
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
async function loadLotes() {
  const container = document.getElementById('lotesContainer');
  if(!container) return;
  container.innerHTML = '<div class="loading-spinner" style="margin:20px auto"></div>';
  
  try {
    const lotes = await apiFetch('/lotes');
    if(!lotes || lotes.length === 0) {
      container.innerHTML = '<p style="color:#aaa; text-align:center;">Nenhum lote criado.</p>';
      return;
    }

    container.innerHTML = lotes.map(lote => `
      <div style="background:#222; border:1px solid #333; border-radius:8px; padding:15px; display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h4 style="margin:0; font-size:16px; color:#fff">${lote.nome}</h4>
            <p style="margin:4px 0 0 0; font-size:12px; color:#888">${lote.codigo} | Criado por: ${lote.usuario || 'N/A'}</p>
          </div>
          <span style="padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; background:${lote.status === 'ABERTO' ? '#065F46' : '#991B1B'}; color:${lote.status === 'ABERTO' ? '#34D399' : '#FCA5A5'}">${lote.status}</span>
        </div>
        
        <div style="background:#111; padding:10px; border-radius:6px;">
          <p style="margin:0 0 10px 0; font-size:13px; color:#bbb"><strong>${lote.itens.length} itens</strong> associados.</p>
          
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${lote.itens.map(i => `
              <span style="background:#333; padding:4px 8px; border-radius:4px; font-size:11px; color:#ddd; display:flex; align-items:center; gap:6px;">
                ${i.codigo} - ${i.nome}
                ${lote.status === 'ABERTO' ? `<button onclick="removerItemDoLote('${lote.id}', '${i.id}')" style="background:none; border:none; color:#E74C3C; cursor:pointer; font-weight:bold; font-size:14px; padding:0; line-height:1;" title="Remover item do lote">&times;</button>` : ''}
              </span>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
          ${lote.status === 'ABERTO' ? `
             <button class="btn-danger-small" style="background:transparent; border:1px solid #E74C3C; color:#E74C3C;" onclick="apagarLote('${lote.id}')">🗑️ Apagar Lote</button>
             <div style="display:flex; gap:10px;">
                <button class="btn-primary-small" onclick="promptAdicionarItemLote('${lote.id}')">➕ Adicionar Item</button>
                ${lote.itens.length > 0 ? `<button class="btn-danger-small" onclick="fecharLote('${lote.id}')">🔒 Fechar Lote</button>` : ''}
             </div>
          ` : `
             <div></div>
             <button class="btn-primary-small" onclick="imprimirEtiquetaLote('${lote.codigo}', '${lote.nome}')">🖨️ Etiqueta</button>
          `}
        </div>
      </div>
    `).join('');

  } catch(e) {
    container.innerHTML = '<p style="color:var(--danger)">Erro ao carregar lotes.</p>';
  }
}

async function criarLote() {
  const nome = document.getElementById('loteNome').value.trim();
  const usuario = document.getElementById('loteUsuario').value.trim();
  const observacao = document.getElementById('loteObservacao').value.trim();

  if(!nome) {
    showToast('O nome do lote é obrigatório', 'warning');
    return;
  }

  try {
    await apiFetch('/lotes', {
      method: 'POST',
      body: { nome, usuario, observacao }
    });
    showToast('Lote criado com sucesso!', 'success');
    document.getElementById('loteNome').value = '';
    document.getElementById('loteUsuario').value = '';
    document.getElementById('loteObservacao').value = '';
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
