/* =========================================================
   CONTROLE DE AVARIAS — JAVASCRIPT PRINCIPAL
   ========================================================= */

const API = '/api';
let currentPage = 'mapa';
let allItems = [];
let allSetores = [];
let allLocalizacoes = [];
let currentItemForModal = null;

// =====================
// NAVEGAÇÃO
// =====================
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  const navEl = document.getElementById(`nav-${page}`);

  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');

  currentPage = page;
  document.getElementById('pageName').textContent = {
    dashboard: 'Dashboard',
    mapa: 'Mapa 3D do Barracão',
    estoque: 'Estoque',
    cadastrar: 'Cadastrar Item',
    movimentacoes: 'Movimentações'
  }[page] || page;

  const searchWrapper = document.getElementById('searchWrapper');
  searchWrapper.style.display = page === 'estoque' ? 'flex' : 'none';

  // Carregar dados da página
  if (page === 'dashboard') loadDashboard();
  else if (page === 'mapa') loadMapa();
  else if (page === 'estoque') loadEstoque();
  else if (page === 'movimentacoes') loadMovimentacoes();
  else if (page === 'lotes') loadLotes();

  // Fechar sidebar no mobile ou esconder no modo mapa
  if (window.innerWidth <= 768 || page === 'mapa') {
    document.body.classList.add('sidebar-collapsed');
    document.getElementById('sidebar').classList.remove('open');
  } else {
    document.body.classList.remove('sidebar-collapsed');
  }

  if (page === 'mapa') {
    document.body.classList.add('mapa-active');
  } else {
    document.body.classList.remove('mapa-active');
  }

  // Se a view atual é mapa, redimensiona o canvas quando transitar para ele
  if (page === 'mapa' && mapaCanvas) {
    setTimeout(() => {
      const container = mapaCanvas.parentElement;
      mapaCanvas.width = window.innerWidth;
      mapaCanvas.height = window.innerHeight;
      drawWarehouse();
    }, 300);
  }
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

document.getElementById('menuToggle').addEventListener('click', () => {
  if (window.innerWidth > 768) {
    document.body.classList.toggle('sidebar-collapsed');
    // Resize canvas to fill the new space
    if (currentPage === 'mapa' && typeof drawWarehouse === 'function' && mapaCanvas) {
      setTimeout(() => {
        mapaCanvas.width = window.innerWidth;
        mapaCanvas.height = window.innerHeight;
        drawWarehouse();
      }, 300);
    }
  } else {
    document.getElementById('sidebar').classList.toggle('open');
  }
});

window.addEventListener('resize', () => {
  if (currentPage === 'mapa' && typeof drawWarehouse === 'function' && mapaCanvas) {
    mapaCanvas.width = window.innerWidth;
    mapaCanvas.height = window.innerHeight;
    drawWarehouse();
  }
});

// =====================
// TOAST
// =====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }[type] || 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'none';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = '0.2s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// =====================
// API HELPERS
// =====================
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (e) {
    console.error('API Error:', e);
    throw e;
  }
}

// =====================
// STATUS DE CONEXÃO
// =====================
async function checkConnection() {
  const dot = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  try {
    await fetch(`${API}/health`);
    dot.className = 'status-dot connected';
    text.textContent = 'Conectado';
  } catch {
    dot.className = 'status-dot error';
    text.textContent = 'Offline';
  }
}

// =====================
// DASHBOARD
// =====================
async function loadDashboard() {
  try {
    const stats = await apiFetch('/items/stats/dashboard');

    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statEstoque').textContent = stats.emEstoque;
    
    // Format saidas breakdown
    let saidasHtml = `${stats.saidos}`;
    if (stats.saidasAgrupadas && stats.saidasAgrupadas.length > 0) {
      const breakdown = stats.saidasAgrupadas.map(g => {
        const motivo = g.motivo || 'Outros';
        const qtd = g._sum.quantidade || 0;
        return `<div style="font-size:10px; margin-top:4px; display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.1)">
          <span style="color:#aaa">${motivo}</span>
          <strong>${qtd}</strong>
        </div>`;
      }).join('');
      saidasHtml += `<div style="margin-top:8px; width:100%; display:block">${breakdown}</div>`;
    }
    document.getElementById('statSaiu').innerHTML = saidasHtml;

    // Barras de ocupação por setor
    const ocupacaoEl = document.getElementById('setoresOcupacao');
    const setores = await apiFetch('/setores');
    allSetores = setores;

    const setoresParaOcupacao = setores.filter(s => {
      if (!s || !s.nome) return false;
      const n = s.nome.toUpperCase();
      return !n.includes('SEGURO') && !n.includes('VENDA') && !n.includes('SOBRA');
    });

    ocupacaoEl.innerHTML = setoresParaOcupacao.map(s => {
      const totalItens = s.localizacoes.reduce((acc, l) => acc + (l._count?.itens || 0), 0);
      const capacidade = s.localizacoes.reduce((acc, l) => acc + (l.capacidade || 0), 0);
      const pct = capacidade > 0 ? Math.min(100, Math.round((totalItens / capacidade) * 100)) : 0;
      return `
        <div class="setor-bar-item">
          <div class="setor-bar-header">
            <span class="setor-bar-name" style="color:${s.cor}">${s.nome}</span>
            <span class="setor-bar-count">${totalItens} itens / ${capacidade} capacidade</span>
          </div>
          <div class="setor-bar-track">
            <div class="setor-bar-fill" style="width:${pct}%;background:${s.cor}"></div>
          </div>
        </div>
      `;
    }).join('');

    // Últimas movimentações
    const movEl = document.getElementById('ultimasMovimentacoes');
    if (!stats.ultimasMovimentacoes.length) {
      movEl.innerHTML = '<div class="empty-state"><p>Nenhuma movimentação ainda</p></div>';
      return;
    }

    movEl.innerHTML = stats.ultimasMovimentacoes.map(m => `
      <div class="mov-item-recente">
        <div class="mov-icon ${m.tipo.toLowerCase()}">
          ${m.tipo === 'ENTRADA' ? '📥' : '📤'}
        </div>
        <div class="mov-info">
          <div class="mov-info-nome">${m.item?.nome || 'Item desconhecido'}</div>
          <div class="mov-info-meta">
            ${m.tipo} • ${m.motivo || ''} • ${formatDate(m.createdAt)}
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    showToast('Erro ao carregar dashboard: ' + e.message, 'error');
  }
}

// =====================
// MAPA 3D
// =====================
let mapaSetores = [];
let mapaCanvas, mapaCtx;
let rotX = 25, rotY = 145;
let isDragging = false, lastMouse = { x: 0, y: 0 };
let mapaScale = 1;
let hoveredPalete = null;

async function loadMapa() {
  try {
    mapaSetores = await apiFetch('/setores');
    initCanvas();
    drawWarehouse();
  } catch (e) {
    showToast('Erro ao carregar mapa: ' + e.message, 'error');
  }
}

function initCanvas() {
  mapaCanvas = document.getElementById('mapaCanvas');
  mapaCtx = mapaCanvas.getContext('2d');

  const container = mapaCanvas.parentElement;
  mapaCanvas.width = container.clientWidth - 32;
  mapaCanvas.height = Math.max(420, window.innerHeight - 180);

  // Mouse events apenas para hover e click (sem arrastar)
  mapaCanvas.addEventListener('mousemove', e => {
    handleMapaHover(e);
  });

  mapaCanvas.addEventListener('mouseleave', () => {
    hoveredPalete = null;
    document.getElementById('mapaTooltip').style.opacity = '0';
    drawWarehouse();
  });

  mapaCanvas.addEventListener('click', e => handleMapaClick(e));

  // Removemos o wheel zoom manual
  // mapaCanvas.addEventListener('wheel', e => { ... });

  // Controles de botão (Mantivemos para pequenos ajustes)
  document.getElementById('btnRotateLeft').onclick = () => { rotY -= 15; drawWarehouse(); };
  document.getElementById('btnRotateRight').onclick = () => { rotY += 15; drawWarehouse(); };
  document.getElementById('btnZoomIn').onclick = () => { mapaScale = Math.min(3, mapaScale + 0.15); drawWarehouse(); };
  document.getElementById('btnZoomOut').onclick = () => { mapaScale = Math.max(0.4, mapaScale - 0.15); drawWarehouse(); };
  document.getElementById('btnResetView').onclick = () => { 
    // Anima de volta para o padrão
    animateCamera(25, 145, 1, 0, 0); 
  };
}

let animFrame = null;
let camTargetX = 0, camTargetY = 0;
window.camX = 0; 
window.camY = 0;
window.camZ = 0;

function animateCamera(targetRotX, targetRotY, targetScale, targetCamX, targetCamZ) {
  if (animFrame) cancelAnimationFrame(animFrame);
  
  const speed = 0.05; // suavidade
  const step = () => {
    let diffRotX = targetRotX - rotX;
    let diffRotY = targetRotY - rotY;
    let diffScale = targetScale - mapaScale;
    let diffCX = targetCamX - window.camX;
    let diffCZ = targetCamZ - (window.camZ || 0);

    if (Math.abs(diffRotX) < 0.1 && Math.abs(diffRotY) < 0.1 && Math.abs(diffScale) < 0.01 && Math.abs(diffCX) < 0.1 && Math.abs(diffCZ) < 0.1) {
      rotX = targetRotX;
      rotY = targetRotY;
      mapaScale = targetScale;
      window.camX = targetCamX;
      window.camZ = targetCamZ;
      drawWarehouse();
      return;
    }

    rotX += diffRotX * speed;
    rotY += diffRotY * speed;
    mapaScale += diffScale * speed;
    window.camX += diffCX * speed;
    window.camZ = (window.camZ || 0) + diffCZ * speed;
    
    drawWarehouse();
    animFrame = requestAnimationFrame(step);
  };
  step();
}

// Função de Busca no Mapa
async function buscarNoMapa() {
  const q = document.getElementById('mapSearchInput').value.trim();
  if(!q) return;

  try {
    const items = await apiFetch(`/items?search=${encodeURIComponent(q)}&status=ESTOQUE`);
    if(items.length === 0) {
      showToast('Nenhum item em estoque encontrado para essa busca.', 'warning');
      window.highlightedLoc = null;
      drawWarehouse();
      return;
    }

    const firstItem = items[0];
    const locCode = firstItem.localizacao?.codigo;
    if(!locCode) {
      showToast('O item encontrado não possui localização!', 'warning');
      return;
    }

    window.highlightedLoc = locCode;
    showToast(`Item encontrado na localização: ${locCode}`, 'success');
    if(window.playSuccessBeep) window.playSuccessBeep();

    // Forçar visão 3D para o zoom funcionar e aparecer os blocos!
    const selectMode = document.getElementById('viewModeSelect');
    if(selectMode && selectMode.value !== '3d') {
      selectMode.value = '3d';
      window.currentViewMode = '3d';
      drawWarehouse(); // desenha a primeira vez em 3D pra gerar o drawablePaletes
    }

    // Encontrar as coordenadas (x, z) desse palete no mapa para dar zoom
    // Note que se for FloorBlock o id pode ser TC-CHAO-C01-L1 enquanto locCode é TC-CHAO
    const palete = drawablePaletes.find(p => 
      p.id === locCode || 
      (p.loc && p.loc.codigo === locCode) ||
      (p.setor && p.setor.nome === locCode)
    );

    if(palete) {
      const targetScale = 2.5;
      const tX = palete.x;
      const tZ = palete.z;
      
      animateCamera(45, 160, targetScale, tX, tZ);
      
      setTimeout(() => {
        showPaletePanel(palete);
      }, 500);
    } else {
      drawWarehouse();
    }

  } catch(e) {
    showToast('Erro ao buscar item no mapa.', 'error');
  }
}

// Função para dar zoom em um setor inteiro (clicando na legenda)
function zoomToSector(setorNomeBusca) {
  const buscaL = setorNomeBusca.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const sectorPaletes = drawablePaletes.filter(p => {
    if (!p.setor?.nome) return false;
    const sName = p.setor.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return sName.includes(buscaL) || buscaL.includes(sName);
  });
  
  if (sectorPaletes.length === 0) {
    showToast('Nenhum palete desenhado para este setor.', 'warning');
    return;
  }

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const allSectorItensMap = new Map();
  
  for (const p of sectorPaletes) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
    
    if (p.loc?.itens) {
      p.loc.itens.forEach(item => allSectorItensMap.set(item.id, item));
    }
  }
  
  const allSectorItens = Array.from(allSectorItensMap.values());
  
  const centerX = minX + (maxX - minX) / 2;
  const centerZ = minZ + (maxZ - minZ) / 2;

  animateCamera(45, 160, 2.0, centerX, centerZ); 
  
  const refPalete = sectorPaletes[0];
  
  const dummyPalete = {
    ...refPalete,
    loc: { codigo: 'Visão Geral do Setor', itens: allSectorItens } 
  };
  
  window.highlightedLoc = null;
  
  setTimeout(() => {
    showPaletePanel(dummyPalete);
  }, 500);
}

// Projeção isométrica 3D
function project(x, y, z) {
  const ox = x - (window.camX || 0);
  const oy = y - (window.camY || 0);
  const oz = z - (window.camZ || 0);

  const rx = rotX * Math.PI / 180;
  const ry = rotY * Math.PI / 180;

  // Rotação Y
  let px = ox * Math.cos(ry) - oz * Math.sin(ry);
  let pz = ox * Math.sin(ry) + oz * Math.cos(ry);
  let py = oy;

  // Rotação X
  let finalX = px;
  // py is multiplied by -1 so that positive Y (upwards) moves UP on the screen (smaller pixel Y)
  let finalY = -py * Math.cos(rx) - pz * Math.sin(rx);

  let scale = 18 * mapaScale;
  // Efeito perspectiva (Z distance) quando camera tiver proxima (para VR real)
  if (window.usePerspective) {
     const fz = pz > -50 ? pz : -50;
     scale = (600 / (600 + fz)) * 10 * mapaScale;
  }

  const cx = mapaCanvas.width / 2;
  const cy = mapaCanvas.height / 2;

  return {
    x: cx + finalX * scale,
    y: cy + finalY * scale,
    depth: pz
  };
}

function drawFace(pts, fillColor, strokeColor = 'rgba(0,0,0,0.3)') {
  mapaCtx.beginPath();
  mapaCtx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) mapaCtx.lineTo(pts[i].x, pts[i].y);
  mapaCtx.closePath();
  mapaCtx.fillStyle = fillColor;
  mapaCtx.fill();
  mapaCtx.strokeStyle = strokeColor;
  mapaCtx.lineWidth = 0.8;
  mapaCtx.stroke();
}

// Converter hex para rgba
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex, factor) {
  const r = Math.floor(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.floor(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.floor(parseInt(hex.slice(5, 7), 16) * factor);
  return `rgb(${r},${g},${b})`;
}

// Coletar todos os cubos a desenhar e ordená-los por profundidade
let drawablePaletes = [];

function draw2DMap(W, H, ctx, dbLocs, labels) {
  // Fundo planta baixa
  ctx.fillStyle = '#1A1E26';
  ctx.fillRect(0, 0, W, H);

  const padding = 40;
  // O warehouse tem 75 de largura (x de -45 a 30) e 85 de profundidade (z de -35 a 50)
  const scale = Math.min((W - padding) / 80, (H - padding) / 90);
  const cx = W / 2 + (5 * scale); // Offset slightly to center the -45 to +30 range
  const cy = H / 2 - (5 * scale); // Offset slightly to center the -35 to +50 range

  // Paredes 2D
  ctx.strokeStyle = '#34495E';
  ctx.lineWidth = 4;
  ctx.strokeRect(cx - 45 * scale, cy - 35 * scale, 75 * scale, 80 * scale);

  // Áreas
  for (const l of labels) {
    ctx.fillStyle = hexToRgba(l.cor, 0.15); // Mais transparente para ficar bonito
    ctx.strokeStyle = l.cor;
    ctx.lineWidth = 2;
    // Borda arredondada no 2D (simulado com fillRect pra simplificar, mas podemos arredondar)
    ctx.beginPath();
    ctx.roundRect(cx + l.x * scale, cy + l.z * scale, l.w * scale, l.d * scale, 4);
    ctx.fill();
    ctx.stroke();

    // Contagem
    let totalArea = 0;
    for(const key in dbLocs) {
      const dbItem = dbLocs[key];
      if(dbItem.setor && dbItem.setor.nome.toLowerCase().includes(l.text.toLowerCase().split(' ')[0])) {
         totalArea += dbItem.loc.itens ? dbItem.loc.itens.filter(i => i.status === 'ESTOQUE').length : 0;
      }
    }
    
    // O texto vai no meio
    ctx.fillStyle = '#FFF';
    const fontSize = Math.max(10, scale * 1.8); // Escala proporcional à caixa
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(l.text, cx + l.x * scale + (l.w * scale) / 2, cy + l.z * scale + (l.d * scale) / 2 - (fontSize * 0.6));
    
    ctx.font = `bold ${Math.max(9, scale * 1.2)}px Inter, sans-serif`;
    ctx.fillStyle = '#A0AAB5';
    ctx.fillText(`Total de Itens: ${totalArea}`, cx + l.x * scale + (l.w * scale) / 2, cy + l.z * scale + (l.d * scale) / 2 + (fontSize * 0.8));
  }
}

function drawWarehouse() {
  const ctx = mapaCtx;
  const W = mapaCanvas.width;
  const H = mapaCanvas.height;

  ctx.clearRect(0, 0, W, H);

  // Fundo gradiente
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0D0F14');
  grad.addColorStop(1, '#141820');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Map the DB layout to the hardcoded layout
  // Map the DB layout to the hardcoded layout
  const dbLocs = {};
  for(const setor of mapaSetores) {
    for(const loc of setor.localizacoes) {
      dbLocs[loc.codigo] = { loc, setor };
    }
  }

  // Labels no chao
  const labels = [
    // LADO ESQUERDO DA TELA (X = 10 a 46)
    {x: 34, z: -40, w: 12, d: 8, text: 'Gaiola', cor: '#E74C3C'},
    {x: 10, z: -40, w: 22, d: 15, text: 'Porta Pallet', cor: '#E74C3C'},
    {x: 10, z: -20, w: 16, d: 12, text: 'Proc. Judicial', cor: '#1ABC9C'},
    {x: 28, z: -20, w: 18, d: 12, text: 'Zero Resíduos', cor: '#2ECC71'},
    {x: 10, z: -5, w: 16, d: 12, text: 'Débito', cor: '#E67E22'},
    {x: 28, z: -5, w: 18, d: 12, text: 'Tratativa Comercial', cor: '#F1C40F'},
    {x: 10, z: 10, w: 36, d: 15, text: 'Novas Vendas', cor: '#27AE60'}, 

    // LADO DIREITO DA TELA (X = -35 a -10)
    {x: -35, z: -40, w: 25, d: 35, text: 'Seguro', cor: '#3498DB'},
    {x: -35, z: -2, w: 25, d: 27, text: 'Lotes Fechados', cor: '#F59E0B'},

    // ENTRADA (Frente total)
    {x: -35, z: 32, w: 81, d: 12, text: 'ENTRADA / RECEBIMENTO', cor: '#8E44AD'}, 
  ];

  if (window.currentViewMode === 'aerea') {
    // Calcular bounding box do 2D para caber na tela
    window.mapaScale = Math.min(W / 120, H / 120); 
    return draw2DMap(W, H, ctx, dbLocs, labels);
  }

  // Grid do chão
  drawFloorGrid();

  // Ruas
  drawStreets();

  // Paredes do galpão
  drawWarehouseWalls();

  // Cercado Traseiro da Gaiola e Porta Pallet
  if (window.currentViewMode !== 'aerea') {
    drawGaiolaWalls(true); // true = back only
    drawPortaPalletWalls(true);
  }

  const layout = [];
  
  function addFloorBlock(dbId, name, color, startX, startZ, width, depth, rows, cols) {
    const spaceX = width / cols;
    const spaceZ = depth / rows;
    for(let r=0; r<rows; r++) {
      for(let c=0; c<cols; c++) {
        const layoutId = `${dbId}-C${String(c+1).padStart(2, '0')}-L${r+1}`;
        const cx = startX + (c * spaceX) + (spaceX / 2) - 1.25;
        const cz = startZ + (r * spaceZ) + (spaceZ / 2) - 1.25;
        layout.push({ 
          id: layoutId,
          dbId: dbId, 
          label: `${name} (C${c+1} L${r+1})`, 
          cor: color, 
          x: cx, 
          y: 0, 
          z: cz,
          w: 2.5,
          d: 2.5
        });
      }
    }
  }

  function addRackBlock(dbId, color, startX, startZ, width, depth, cols, levels) {
    const spaceX = width / cols;
    const zPos = startZ + (depth / 2) - 1.25; 
    for(let c=0; c<cols; c++) {
      for(let n=1; n<=levels; n++) {
        layout.push({
          id: `SOB-C${String(c+1).padStart(2, '0')}-N${n}`, 
          dbId: dbId,
          label: `Sobras (Col ${c+1} Niv ${n})`, 
          cor: color, 
          x: startX + (c * spaceX) + (spaceX / 2) - 1.25, 
          y: (n - 1) * 2.5,
          z: zPos,
          w: 2.5,
          d: 2.5
        });
      }
    }
  }

  // --- LADO ESQUERDO DA TELA ---
  addRackBlock('SOB', '#E74C3C', 10, -40, 22, 15, 6, 3);
  addFloorBlock('GAI-CHAO', 'Gaiola', '#E74C3C', 34, -40, 12, 8, 2, 2);
  
  addFloorBlock('PJ-CHAO', 'Proc. Judicial', '#1ABC9C', 10, -20, 16, 12, 2, 3);
  addFloorBlock('ZR-CHAO', 'Zero Residuos', '#2ECC71', 28, -20, 18, 12, 2, 3);
  
  addFloorBlock('DB-CHAO', 'Debito', '#E67E22', 10, -5, 16, 12, 2, 3);
  addFloorBlock('TC-CHAO', 'Tratativa Com.', '#F1C40F', 28, -5, 18, 12, 2, 3);

  addFloorBlock('NV-CHAO', 'Novas Vendas', '#27AE60', 10, 10, 36, 15, 3, 6);
  
  // --- LADO DIREITO DA TELA ---
  addFloorBlock('SEG-CHAO', 'Seguro', '#3498DB', -35, -40, 25, 35, 7, 5);
  addFloorBlock('LOTES-GERAL', 'Lotes Fechados', '#F59E0B', -35, -2, 25, 27, 4, 5);

  for(const l of labels) {
    drawSetorFloor(l.x, l.z, l.w, l.d, l.cor, l.text);
  }

  const dbIdCounts = {};
  for(const l of layout) {
    const key = l.dbId || l.id;
    dbIdCounts[key] = (dbIdCounts[key] || 0) + 1;
  }

  const dbItemsDrawn = {};
  
  // Limpar os paletes desenhados da última renderização! (MUITO IMPORTANTE PARA ANIMAÇÃO)
  drawablePaletes = [];

  for (const l of layout) {
    let ocupado = false;
    let totalItens = 0;
    const searchId = l.dbId || l.id;
    let dbItem = dbLocs[searchId];

    if(dbItem) {
      const dbTotal = dbItem.loc.itens ? dbItem.loc.itens.filter(i => i.status === 'ESTOQUE').length : 0;
      const numPallets = dbIdCounts[searchId];
      // Distribute evenly
      const itemsPerPallet = Math.floor(dbTotal / numPallets);
      const remainder = dbTotal % numPallets;
      
      dbItemsDrawn[searchId] = dbItemsDrawn[searchId] || 0;
      
      totalItens = itemsPerPallet + (dbItemsDrawn[searchId] < remainder ? 1 : 0);
      dbItemsDrawn[searchId]++;
      
      ocupado = totalItens > 0;
    }
    
    // Highlight da busca
    const isHighlighted = window.highlightedLoc && (window.highlightedLoc === l.id || window.highlightedLoc === l.dbId || (l.id && l.id.startsWith(window.highlightedLoc + '-')));
    const ph = ocupado ? 1.5 + Math.min(2, totalItens * 0.3) : 0.4;
    
    drawablePaletes.push({
      x: l.x, y: l.y, z: l.z, 
      w: l.w || 2.5, d: l.d || 2.5,
      h: isHighlighted ? ph + 2 : ph, // cresce se destacado
      cor: isHighlighted ? '#FFF' : l.cor,
      ocupado, totalItens,
      loc: dbItem ? dbItem.loc : { codigo: l.id }, 
      setor: dbItem ? dbItem.setor : { nome: l.label },
      highlight: isHighlighted
    });
  }

  // Ordenar paletes por profundidade para pintor correto
  const camVec = {
    x: Math.sin(rotY * Math.PI / 180),
    z: Math.cos(rotY * Math.PI / 180),
    y: -Math.sin(rotX * Math.PI / 180) // Invert Y so higher boxes are drawn last!
  };

  drawablePaletes.sort((a, b) => {
    const da = a.x * camVec.x + a.y * camVec.y + a.z * camVec.z;
    const db = b.x * camVec.x + b.y * camVec.y + b.z * camVec.z;
    return db - da;
  });

  for (const p of drawablePaletes) {
    const isRack = p.loc.codigo && p.loc.codigo.startsWith('SOB');
    drawPalete(p.x, p.y, p.z, p.w, p.d, p.h, p.cor, p.ocupado, p.totalItens, p.loc === hoveredPalete?.loc, isRack);
  }

  // Cercado Frontal da Gaiola e Porta Pallet
  if (window.currentViewMode !== 'aerea') {
    drawGaiolaWalls(false);
    drawPortaPalletWalls(false);
    
    if (typeof drawCharacter === 'function') drawCharacter();
  }
}

function drawFloorGrid() {
  const ctx = mapaCtx;
  ctx.save();
  // Fundo muito escuro
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, mapaCanvas.width, mapaCanvas.height);

  // Grid fino
  for (let gx = -65; gx <= 50; gx += 2) {
    for (let gz = -55; gz <= 65; gz += 2) {
      const p00 = project(gx, 0, gz);
      const p10 = project(gx + 2, 0, gz);
      const p11 = project(gx + 2, 0, gz + 2);
      const p01 = project(gx, 0, gz + 2);

      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawStreets() {
  const ctx = mapaCtx;
  const streetColor = 'rgba(255, 255, 255, 0.08)'; // Bright white/grey path
  const lineStripe = 'rgba(255, 204, 0, 0.7)'; // Very explicit bright yellow dash

  // Street regions {x, z, w, d}
  const streets = [
    {x: -5, z: -45, w: 10, d: 70},   // Main vertical (Between Left and Right columns)
    {x: 10, z: -25, w: 36, d: 5},    // Small horizontal left 1 (Below Porta Pallet)
    {x: 10, z: -8, w: 36, d: 3},     // Small horizontal left 2 (Below ZR/PJ)
    {x: 10, z: 7, w: 36, d: 3},      // Small horizontal left 3 (Below Tratativa/Debito)
    {x: -35, z: -5, w: 25, d: 3},    // Small horizontal right 1 (Inside Seguro - visual break)
    {x: -40, z: 25, w: 90, d: 7},    // Main Horizontal (Separating Entrada from rest)
  ];

  for (const s of streets) {
    const pts = [
      project(s.x, 0.02, s.z),
      project(s.x + s.w, 0.02, s.z),
      project(s.x + s.w, 0.02, s.z + s.d),
      project(s.x, 0.02, s.z + s.d)
    ];
    drawFace(pts, streetColor, 'transparent');

    // Draw dashed center line
    ctx.save();
    ctx.strokeStyle = lineStripe;
    ctx.lineWidth = 2 * mapaScale;
    ctx.setLineDash([10 * mapaScale, 10 * mapaScale]);
    ctx.beginPath();
    if(s.w > s.d) {
      // Horizontal street
      const p1 = project(s.x, 0.03, s.z + s.d/2);
      const p2 = project(s.x + s.w, 0.03, s.z + s.d/2);
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    } else {
      // Vertical street
      const p1 = project(s.x + s.w/2, 0.03, s.z);
      const p2 = project(s.x + s.w/2, 0.03, s.z + s.d);
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawWarehouseWalls() {
  // Removidas para deixar o fundo infinito escuro igual a referencia
}

function drawPortaPalletWalls(isBack = true) {
  const ctx = mapaCtx;
  const sx = 10, sz = -40, sw = 22, sd = 15;
  const fenceColor = 'rgba(231, 76, 60, 0.05)'; 
  const strokeColor = 'rgba(231, 76, 60, 0.4)';
  const height = 6;

  // points = [BACK, LEFT, RIGHT, FRONT] 
  const points = [];
  if (isBack) {
    // BACK
    points.push([project(sx, 0, sz), project(sx + sw, 0, sz), project(sx + sw, height, sz), project(sx, height, sz)]);
    // LEFT
    points.push([project(sx, 0, sz + sd), project(sx, 0, sz), project(sx, height, sz), project(sx, height, sz + sd)]);
  } else {
    // RIGHT
    points.push([project(sx + sw, 0, sz), project(sx + sw, 0, sz + sd), project(sx + sw, height, sz + sd), project(sx + sw, height, sz)]);
    // FRONT
    points.push([project(sx + sw, 0, sz + sd), project(sx, 0, sz + sd), project(sx, height, sz + sd), project(sx + sw, height, sz + sd)]);
  }

  for (const pts of points) {
    drawFace(pts, fenceColor, strokeColor);
    ctx.save();
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[2].x, pts[2].y);
    ctx.moveTo(pts[1].x, pts[1].y); ctx.lineTo(pts[3].x, pts[3].y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawGaiolaWalls(isBack = true) {
  const ctx = mapaCtx;
  const gx = 34, gz = -40, gw = 12, gd = 8;
  const fenceColor = 'rgba(231, 76, 60, 0.1)'; // Vermelho claro transparente
  const strokeColor = 'rgba(231, 76, 60, 0.6)';
  const height = 4;

  const points = [];
  if (isBack) {
    // BACK
    points.push([project(gx, 0, gz), project(gx + gw, 0, gz), project(gx + gw, height, gz), project(gx, height, gz)]);
    // LEFT
    points.push([project(gx, 0, gz + gd), project(gx, 0, gz), project(gx, height, gz), project(gx, height, gz + gd)]);
  } else {
    // RIGHT
    points.push([project(gx + gw, 0, gz), project(gx + gw, 0, gz + gd), project(gx + gw, height, gz + gd), project(gx + gw, height, gz)]);
    // FRONT
    points.push([project(gx + gw, 0, gz + gd), project(gx, 0, gz + gd), project(gx, height, gz + gd), project(gx + gw, height, gz + gd)]);
  }

  for (const pts of points) {
    drawFace(pts, fenceColor, strokeColor);
    // Draw wireframe fence details
    ctx.save();
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[2].x, pts[2].y);
    ctx.moveTo(pts[1].x, pts[1].y); ctx.lineTo(pts[3].x, pts[3].y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSetorFloor(sx, sz, sw, sd, cor, nome) {
  const alpha = 0.12;
  const pts = [
    project(sx, 0.05, sz),
    project(sx + sw, 0.05, sz),
    project(sx + sw, 0.05, sz + sd),
    project(sx, 0.05, sz + sd)
  ];
  drawFace(pts, hexToRgba(cor, alpha), hexToRgba(cor, 0.4));

  // Label do setor no chão
  const center = project(sx + sw / 2, 0.05, sz + sd / 2);
  mapaCtx.save();
  mapaCtx.font = `bold ${12 * mapaScale}px Inter, sans-serif`;
  mapaCtx.fillStyle = hexToRgba(cor, 0.9);
  mapaCtx.textAlign = 'center';
  mapaCtx.shadowColor = 'rgba(0,0,0,0.8)';
  mapaCtx.shadowBlur = 4;
  mapaCtx.fillText(nome, center.x, center.y);
  mapaCtx.restore();
}

function drawSolidBlock(px, py, pz, pw, pd, ph, baseColor, isHovered) {
  const fillTop = isHovered ? hexToRgba(baseColor, 1) : hexToRgba(baseColor, 0.85);
  const fillFront = darken(baseColor, 0.6);
  const fillSide = darken(baseColor, 0.45);
  const glowStroke = isHovered ? hexToRgba(baseColor, 1) : 'rgba(0,0,0,0.4)';

  const top = [
    project(px, py + ph, pz),
    project(px + pw, py + ph, pz),
    project(px + pw, py + ph, pz + pd),
    project(px, py + ph, pz + pd)
  ];
  const front = [
    project(px, py, pz + pd),
    project(px + pw, py, pz + pd),
    project(px + pw, py + ph, pz + pd),
    project(px, py + ph, pz + pd)
  ];
  const side = [
    project(px + pw, py, pz),
    project(px + pw, py, pz + pd),
    project(px + pw, py + ph, pz + pd),
    project(px + pw, py + ph, pz)
  ];

  drawFace(front, fillFront, glowStroke);
  drawFace(side, fillSide, glowStroke);
  drawFace(top, fillTop, glowStroke);
}

function drawPalete(px, py, pz, pw, pd, ph, cor, ocupado, totalItens, isHovered, isRack) {
  let baseY = py;

  // 1. Desenha a base escura do rack apenas se for rack
  if (isRack) {
    drawSolidBlock(px, baseY, pz, pw, pd, 0.5, '#151515', false);
    baseY += 0.5; // boxes stack on top of the base
  } else if (!ocupado) {
    return; // Não desenha nada se for chão e estiver vazio
  }

  // 2. Se tiver item, desenha caixas coloridas empilhadas
  if (ocupado) {
    let maxStack = Math.min(3, Math.ceil(totalItens / 2));
    if (maxStack === 0) maxStack = 1;

    const bx = px + 0.3;
    const bz = pz + 0.3;
    const bw = pw - 0.6;
    const bd = pd - 0.6;
    const boxH = 1.6;

    for (let i = 0; i < maxStack; i++) {
      const by = baseY + (i * boxH);
      const boxColor = isHovered ? '#FFFFFF' : cor;
      drawSolidBlock(bx, by, bz, bw, bd, boxH, boxColor, isHovered);
    }

    // Contador no topo
    const topCenter = project(px + pw / 2, baseY + 0.5 + (maxStack * boxH) + 0.2, pz + pd / 2);
    mapaCtx.save();
    mapaCtx.font = `bold ${Math.max(9, 10 * mapaScale)}px Inter`;
    mapaCtx.fillStyle = 'white';
    mapaCtx.textAlign = 'center';
    mapaCtx.shadowColor = 'rgba(0,0,0,0.9)';
    mapaCtx.shadowBlur = 6;
    mapaCtx.fillText(totalItens, topCenter.x, topCenter.y);
    mapaCtx.restore();
  }
}


function getCanvasPos(e) {
  const rect = mapaCanvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function findPaleteAt(mouseX, mouseY) {
  for (let i = drawablePaletes.length - 1; i >= 0; i--) {
    const p = drawablePaletes[i];
    const pw = 1.8, pd = 1.8;

    const top = [
      project(p.x, p.h, p.z),
      project(p.x + pw, p.h, p.z),
      project(p.x + pw, p.h, p.z + pd),
      project(p.x, p.h, p.z + pd)
    ];

    if (pointInPolygon(mouseX, mouseY, top)) return p;
  }
  return null;
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function handleMapaHover(e) {
  const { x, y } = getCanvasPos(e);
  const found = findPaleteAt(x, y);
  const tooltip = document.getElementById('mapaTooltip');

  if (found) {
    hoveredPalete = found;
    mapaCanvas.style.cursor = 'pointer';

    const loc = found.loc;
    const itensStr = found.totalItens > 0
      ? `${found.totalItens} itens em estoque`
      : 'Vazio';

    tooltip.innerHTML = `
      <strong>${loc.codigo}</strong><br>
      ${loc.descricao || ''}<br>
      <span style="color:${found.cor}">${found.setor.nome}</span> • ${itensStr}
    `;
    tooltip.style.opacity = '1';
    tooltip.style.left = `${x + 12}px`;
    tooltip.style.top = `${y - 10}px`;
  } else {
    hoveredPalete = null;
    mapaCanvas.style.cursor = 'grab';
    tooltip.style.opacity = '0';
  }

  drawWarehouse();
}

function handleMapaClick(e) {
  const { x, y } = getCanvasPos(e);
  const found = findPaleteAt(x, y);

  if (found) {
    showPaletePanel(found);
  }
}

function showPaletePanel(palete) {
  const panel = document.getElementById('mapaPanel');
  const title = document.getElementById('panelTitle');
  const body = document.getElementById('panelBody');

  title.textContent = `${palete.loc.codigo} — ${palete.setor.nome}`;
  title.style.color = palete.cor;

  const itens = palete.loc.itens || [];
  const emEstoque = itens.filter(i => i.status === 'ESTOQUE');

  // Sector KPIs
  const sectorPaletes = drawablePaletes.filter(p => p.setor?.nome === palete.setor?.nome);
  const uniqueItemsMap = new Map();
  for (const p of sectorPaletes) {
    if (p.loc?.itens) {
      for (const i of p.loc.itens) {
        if (i.status === 'ESTOQUE') {
           uniqueItemsMap.set(i.id, i);
        }
      }
    }
  }

  const uniqueItems = Array.from(uniqueItemsMap.values());
  const totalSectorItens = uniqueItems.length;

  let sectorTotalNf = 0;
  let sectorTotalInternet = 0;
  let sectorTotalSugestao = 0;

  for (const i of uniqueItems) {
    sectorTotalNf += i.valorNf || 0;
    sectorTotalInternet += i.valorInternet || 0;
    sectorTotalSugestao += i.sugestao || 0;
  }

  const fNf = sectorTotalNf.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  const fInt = sectorTotalInternet.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  const fSug = sectorTotalSugestao.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  const kpisHtml = `
    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; margin-bottom:15px; border-left: 3px solid ${palete.cor}">
      <div style="font-size:11px; color:#aaa; margin-bottom:5px; text-transform:uppercase">📊 KPIs do Setor: ${palete.setor?.nome}</div>
      <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px">
        <div>Itens no setor: <strong>${totalSectorItens}</strong></div>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px; font-size:11px;">
        <div style="display:flex; justify-content:space-between;"><span>Valor NF Total:</span> <strong>${fNf}</strong></div>
        <div style="display:flex; justify-content:space-between;"><span>Valor Internet Total:</span> <strong>${fInt}</strong></div>
        <div style="display:flex; justify-content:space-between; color:#4A90D9"><span>Venda (Lucro Liq 40%):</span> <strong>${fSug}</strong></div>
      </div>
    </div>
  `;

  let contentHtml = kpisHtml;

  if (!emEstoque.length) {
    contentHtml += '<div class="empty-state"><p>Nenhum item neste palete</p></div>';
  } else {
    // Agrupa os itens pelo código para evitar poluição visual
    const groupedItems = {};
    emEstoque.forEach(item => {
      if (!groupedItems[item.codigo]) {
        groupedItems[item.codigo] = { ...item };
      } else {
        groupedItems[item.codigo].quantidade += item.quantidade;
      }
    });

    contentHtml += Object.values(groupedItems).map(item => `
      <div class="panel-item-row">
        <div>
          <div class="panel-item-name">${item.nome}</div>
          <div style="font-size:11px;color:var(--text-muted);font-family:monospace">${item.codigo}</div>
        </div>
        <div class="panel-item-qty">Qtd: <strong>${item.quantidade}</strong></div>
        <button class="btn-primary-small" onclick="showItemDetails('${item.id}')">Ver</button>
      </div>
    `).join('');
  }

  body.innerHTML = contentHtml;
  panel.style.display = 'block';
}

function closeMpaPanel() {
  document.getElementById('mapaPanel').style.display = 'none';
  window.highlightedLoc = null;
  animateCamera(25, 145, 1, 0, 0);
}

// =====================
// ESTOQUE
// =====================
async function loadEstoque(statusFilter, setorFilter) {
  const grid = document.getElementById('itemsGrid');
  grid.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // Se não for fornecido, pega do tab ativo (ou vazio se for "Todos")
    if (statusFilter === undefined) {
      const activeTab = document.querySelector('.filter-tab.active');
      statusFilter = activeTab ? (activeTab.dataset.status || '') : '';
    }
    if (setorFilter === undefined) {
      setorFilter = document.getElementById('filterSetor')?.value || '';
    }

    let url = '/items?';
    if (statusFilter) url += `status=${statusFilter}&`;
    if (setorFilter) url += `setorId=${setorFilter}&`;

    allItems = await apiFetch(url);

    // Popular select de setores
    if (!allSetores.length) {
      allSetores = await apiFetch('/setores');
    }

    const filterSelect = document.getElementById('filterSetor');
    if (filterSelect.children.length <= 1) {
      allSetores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id; opt.textContent = s.nome;
        filterSelect.appendChild(opt);
      });
    }

    renderItemsGrid(allItems);
  } catch (e) {
    grid.innerHTML = `<div class="empty-state"><p>Erro ao carregar itens: ${e.message}</p></div>`;
  }
}

function renderItemsGrid(items) {
  const grid = document.getElementById('itemsGrid');

  if (!items.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        </svg>
        <p>Nenhum item encontrado</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(item => {
    const cor = item.localizacao?.setor?.cor || '#64748B';
    const setor = item.localizacao?.setor?.nome || 'Sem setor';
    const local = item.localizacao?.codigo || 'Sem localização';
    const status = item.status === 'ESTOQUE' ? 'status-estoque' : 'status-saiu';
    const statusLabel = item.status === 'ESTOQUE' ? 'Em estoque' : 'Saiu';

    return `
      <div class="item-card" onclick="showItemDetails('${item.id}')">
        <div class="item-card-setor" style="background:${hexToRgba(cor, 0.15)};color:${cor}">
          <span style="width:6px;height:6px;border-radius:50%;background:${cor};display:inline-block"></span>
          ${setor}
        </div>
        <div class="item-card-nome">${item.nome}</div>
        <div class="item-card-codigo">${item.codigo}</div>
        <div style="font-size:12px;color:var(--text-muted)">📍 ${local}</div>
        ${item.motivoAvaria ? `<div style="font-size:11px;color:#EF4444;margin-top:4px">⚠️ ${item.motivoAvaria}</div>` : ''}
        <div class="item-card-footer">
          <div class="item-card-qtd">Qtd: <strong>${item.quantidade}</strong></div>
          <span class="item-status-badge ${status}">${statusLabel}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Busca
document.getElementById('searchInput').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  if (!q) { renderItemsGrid(allItems); return; }
  const filtered = allItems.filter(i =>
    i.nome.toLowerCase().includes(q) ||
    i.codigo.toLowerCase().includes(q) ||
    (i.descricao || '').toLowerCase().includes(q)
  );
  renderItemsGrid(filtered);
});

// Filtros de tab
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadEstoque(tab.dataset.status, document.getElementById('filterSetor').value);
  });
});

document.getElementById('filterSetor').addEventListener('change', (e) => {
  const activeTab = document.querySelector('.filter-tab.active');
  loadEstoque(activeTab?.dataset.status || '', e.target.value);
});

// =====================
// CADASTRAR ITEM
// =====================
async function initCadastrarForm() {
  const select = document.getElementById('inputLocalizacao');
  if (select.children.length <= 1) {
    const locais = await apiFetch('/localizacoes');
    allLocalizacoes = locais;
    locais.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = `${l.codigo} — ${l.setor?.nome || ''}`;
      select.appendChild(opt);
    });
  }
}

async function submitCadastro(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSalvar');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const data = {
      nome: document.getElementById('inputNome').value,
      quantidade: parseInt(document.getElementById('inputQuantidade').value),
      localizacaoId: document.getElementById('inputLocalizacao').value || null,
      motivoAvaria: document.getElementById('inputMotivoAvaria').value || null,
      descricao: document.getElementById('inputDescricao').value || null,
      usuario: document.getElementById('inputUsuario').value || 'Sistema',
      valorNf: document.getElementById('inputValorNf').value || null,
      valorInternet: document.getElementById('inputValorInternet').value || null,
      sugestao: document.getElementById('inputSugestao').value || null
    };

    const item = await apiFetch('/items', { method: 'POST', body: data });

    showToast(`Item "${item.nome}" cadastrado! Código: ${item.codigo}`, 'success');
    if(window.playSuccessBeep) window.playSuccessBeep();

    // Mostrar preview de etiqueta (no fundo)
    await showEtiquetaPreview(item);

    // Baixar etiqueta automaticamente
    await imprimirEtiqueta();

    // Limpar form
    document.getElementById('formCadastrar').reset();

    // Mostra o modal e pergunta se quer ir para o mapa
    // Agora vai automaticamente para o mapa, foca no item, e mostra um modal
    navigateTo('mapa');

    // Forçar visão 3D para o zoom
    const selectMode = document.getElementById('viewModeSelect');
    if(selectMode && selectMode.value !== '3d') {
      selectMode.value = '3d';
      window.currentViewMode = '3d';
      drawWarehouse(); // Atualiza paletes
    }

    const locCode = item.localizacao?.codigo;
    if (locCode) {
      window.highlightedLoc = locCode;
      
      const palete = drawablePaletes.find(p => 
        p.id === locCode || 
        (p.loc && p.loc.codigo === locCode) ||
        (p.setor && p.setor.nome === locCode)
      );

      if(palete) {
        const targetScale = 2.5;
        const tX = palete.x;
        const tZ = palete.z;
        animateCamera(45, 160, targetScale, tX, tZ);
      } else {
        drawWarehouse();
      }
    }

    // Modal format
    setTimeout(() => {
      const details = document.getElementById('modalRegistrationDetails');
      details.innerHTML = `
        <strong style="color:white;font-size:16px;">${item.nome}</strong><br>
        <span style="color:var(--primary);">Código: ${item.codigo}</span><br>
        Localização: ${item.localizacao?.codigo || '—'}<br>
        Quantidade: ${item.quantidade}
      `;
      document.getElementById('modalRegistrationSuccess').style.display = 'flex';
    }, 600);

  } catch (e) {
    showToast('Erro ao cadastrar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Salvar e Gerar Etiqueta
    `;
  }
}

function resetForm() {
  document.getElementById('formCadastrar').reset();
  document.getElementById('etiquetaPreviewCard').style.display = 'none';
}

let currentItemIdForEtiqueta = null;

async function showEtiquetaPreview(item) {
  try {
    const preview = await apiFetch(`/etiquetas/preview/${item.id}`);
    currentItemIdForEtiqueta = item.id;

    const card = document.getElementById('etiquetaPreviewCard');
    const previewEl = document.getElementById('etiquetaPreview');

    card.style.display = 'block';
    // Preview proporcional a 90mm x 100mm (razão 0.9)
    previewEl.innerHTML = `
      <div class="etiqueta-header-bar" style="background:#000000;color:#ffffff;font-size:14px;padding:8px 12px">
        ${preview.setor}
      </div>
      <div class="etiqueta-body" style="gap:14px;padding:10px 0 6px">
        <div class="etiqueta-qr" style="flex-shrink:0">
          <img src="${preview.qrCode}" alt="QR Code" style="width:96px;height:96px;display:block">
          <div style="font-size:9px;color:#888;text-align:center;margin-top:3px;font-family:monospace;word-break:break-all">${item.codigo}</div>
        </div>
        <div class="etiqueta-info">
          <div class="etiqueta-nome" style="font-size:14px;margin-bottom:6px">${item.nome}</div>
          <div class="etiqueta-field"><strong>Cód:</strong> ${item.codigo}</div>
          <div class="etiqueta-field"><strong>Local:</strong> ${preview.localizacao}</div>
          <div class="etiqueta-field"><strong>Qtd:</strong> ${item.quantidade}</div>
          <div class="etiqueta-field"><strong>Data:</strong> ${formatDate(item.createdAt || new Date())}</div>
        </div>
      </div>
      ${item.motivoAvaria ? `<div class="etiqueta-avaria" style="margin:4px 0 6px;padding:4px 6px;background:#fff0f0;border-radius:3px">⚠️ ${item.motivoAvaria}</div>` : ''}
      <div class="etiqueta-footer" style="font-size:10px">
        <div>Data de entrada: ${formatDate(item.createdAt || new Date())}</div>
        <div style="color:#aaa;margin-top:2px">AvariasControl — Princesa dos Campos</div>
      </div>
    `;
  } catch (e) {
    console.error('Erro preview etiqueta:', e);
  }
}

async function imprimirEtiqueta() {
  if (!currentItemIdForEtiqueta) return;
  try {
    const res = await fetch(`${API}/etiquetas/gerar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: [currentItemIdForEtiqueta] })
    });

    if (!res.ok) throw new Error('Falha ao gerar PDF');

    const blob = new Blob([await res.arrayBuffer()], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.error('Erro ao imprimir via onload', err);
        }
      }, 200);
    };

    // Fallback: em alguns navegadores o onload não dispara para PDFs
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {}
    }, 1000);

    showToast('Preparando impressão...', 'success');
  } catch (e) {
    showToast('Erro ao gerar etiqueta: ' + e.message, 'error');
  }
}

// =====================
// MOVIMENTAÇÕES
// =====================
async function loadMovimentacoes() {
  const tbody = document.getElementById('movTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="loading-spinner"></div></td></tr>';

  try {
    const movs = await apiFetch('/movimentacoes?limit=100');

    if (!movs.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:32px">Nenhuma movimentação registrada</td></tr>';
      return;
    }

    tbody.innerHTML = movs.map(m => {
      const tipo = m.tipo === 'ENTRADA'
        ? '<span class="mov-tipo-badge" style="background:rgba(16,185,129,0.15);color:#10B981">📥 ENTRADA</span>'
        : '<span class="mov-tipo-badge" style="background:rgba(239,68,68,0.15);color:#EF4444">📤 SAÍDA</span>';

      const motivos = {
        CADASTRO: 'Cadastro', DESCARTE: 'Descarte', REAPROVEITAMENTO: 'Reaproveitamento',
        DEVOLUCAO_FORNECEDOR: 'Devolução Fornecedor', VENDA: 'Venda/Leilão', TRANSFERENCIA: 'Transferência'
      };

      return `
        <tr>
          <td style="white-space:nowrap;color:var(--text-muted);font-size:12px">${formatDateTime(m.createdAt)}</td>
          <td>${tipo}</td>
          <td>
            <div style="font-weight:500;font-size:13px">${m.item?.nome || '—'}</div>
            <div style="font-size:11px;color:var(--text-muted);font-family:monospace">${m.item?.codigo || ''}</div>
          </td>
          <td style="font-size:12px;color:var(--text-secondary)">${m.item?.localizacao?.codigo || '—'}</td>
          <td style="font-size:12px">${motivos[m.motivo] || m.motivo || '—'}</td>
          <td style="font-weight:600">${m.quantidade}</td>
          <td style="font-size:12px;color:var(--text-muted)">${m.usuario || '—'}</td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:20px;color:var(--danger)">Erro: ${e.message}</td></tr>`;
  }
}

// =====================
// MODAL DETALHES
// =====================
async function showItemDetails(id) {
  const modal = document.getElementById('modalDetalhes');
  const title = document.getElementById('modalDetalhesTitle');
  const body = document.getElementById('modalDetalhesBody');

  modal.style.display = 'flex';
  body.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const item = await apiFetch(`/items/${id}`);
    currentItemForModal = item;

    const preview = await apiFetch(`/etiquetas/preview/${id}`).catch(() => null);

    title.textContent = item.nome;

    const cor = item.localizacao?.setor?.cor || '#64748B';
    const statusClass = item.status === 'ESTOQUE' ? 'status-estoque' : 'status-saiu';
    const statusLabel = item.status === 'ESTOQUE' ? 'Em Estoque' : 'Saiu';

    // Calcular quantidade total se houver itens duplicados
    let quantidadeAgrupada = item.quantidade;
    if (window.drawablePaletes && item.status === 'ESTOQUE') {
      const p = drawablePaletes.find(p => p.loc?.itens?.some(i => i.id === item.id));
      if (p && p.loc && p.loc.itens) {
        const idens = p.loc.itens.filter(i => i.codigo === item.codigo && i.status === 'ESTOQUE');
        quantidadeAgrupada = idens.reduce((sum, i) => sum + i.quantidade, 0);
      }
    }

    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span class="item-status-badge ${statusClass}">${statusLabel}</span>
        ${item.localizacao ? `<span class="item-card-setor" style="background:${hexToRgba(cor,0.15)};color:${cor};padding:3px 8px;border-radius:100px;font-size:11px;font-weight:700">${item.localizacao.setor?.nome || ''}</span>` : ''}
      </div>

      <div class="detail-grid">
        <div class="detail-field">
          <label>Código</label>
          <span style="font-family:monospace;font-size:13px">${item.codigo}</span>
        </div>
        <div class="detail-field">
          <label>Quantidade</label>
          <span style="font-size:20px;font-weight:700">${quantidadeAgrupada}</span>
        </div>
        <div class="detail-field">
          <label>Localização</label>
          <span>${item.localizacao?.codigo || 'Não definida'}</span>
        </div>
        <div class="detail-field">
          <label>Cadastrado em</label>
          <span>${formatDate(item.createdAt)}</span>
        </div>
        ${item.valorNf || item.valorInternet ? `
          <div class="detail-field detail-full" style="background:rgba(0,0,0,0.2); border-radius:6px; padding:12px; margin-top:8px">
            <label style="margin-bottom:8px; display:block">Preços e Avaliação</label>
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px">
              <div>
                <span style="font-size:11px; color:var(--text-muted)">Nota Fiscal:</span><br>
                <strong>R$ ${item.valorNf ? Number(item.valorNf).toFixed(2).replace('.',',') : '0,00'}</strong>
              </div>
              <div>
                <span style="font-size:11px; color:var(--text-muted)">Internet:</span><br>
                <strong>R$ ${item.valorInternet ? Number(item.valorInternet).toFixed(2).replace('.',',') : '0,00'}</strong>
              </div>
              <div>
                <span style="font-size:11px; color:var(--text-muted)">Diferença:</span><br>
                ${(function() {
                  const nf = Number(item.valorNf) || 0;
                  const internet = Number(item.valorInternet) || 0;
                  if (nf > 0 && internet > 0) {
                    const diff = internet - nf;
                    const perc = ((diff / nf) * 100).toFixed(1);
                    const diffText = diff >= 0 ? `+ R$ ${diff.toFixed(2).replace('.',',')} (+${perc}%)` : `- R$ ${Math.abs(diff).toFixed(2).replace('.',',')} (${perc}%)`;
                    const color = diff >= 0 ? 'var(--success)' : 'var(--danger)';
                    return `<strong style="color:${color}">${diffText}</strong>`;
                  }
                  return '<strong>-</strong>';
                })()}
              </div>
              <div>
                <span style="font-size:11px; color:var(--text-muted)">Sugestão (40%):</span><br>
                <strong style="color:var(--primary)">R$ ${item.sugestao ? Number(item.sugestao).toFixed(2).replace('.',',') : '0,00'}</strong>
              </div>
            </div>
          </div>
        ` : ''}
        ${item.motivoAvaria ? `
          <div class="detail-field detail-full">
            <label>Motivo da Avaria</label>
            <span style="color:var(--danger)">${item.motivoAvaria}</span>
          </div>
        ` : ''}
        ${item.descricao ? `
          <div class="detail-field detail-full">
            <label>Observações</label>
            <span style="color:var(--text-secondary)">${item.descricao}</span>
          </div>
        ` : ''}
      </div>

      ${preview ? `
        <div class="detail-qr-section">
          <div style="text-align:center">
            <img src="${preview.qrCode}" alt="QR Code" style="width:120px;height:120px">
            <div style="font-size:11px;color:#888;margin-top:4px;font-family:monospace">${item.codigo}</div>
          </div>
        </div>
      ` : ''}

      ${item.movimentacoes?.length ? `
        <div>
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:8px">Histórico</div>
          ${item.movimentacoes.slice(0, 5).map(m => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
              <span>${m.tipo === 'ENTRADA' ? '📥' : '📤'} ${m.motivo || m.tipo}</span>
              <span style="color:var(--text-muted)">${formatDate(m.createdAt)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    // Mostrar/ocultar botão de saída
    const btnSaida = document.getElementById('btnSaidaModal');
    btnSaida.style.display = item.status === 'ESTOQUE' ? 'flex' : 'none';

  } catch (e) {
    body.innerHTML = `<p style="color:var(--danger)">Erro ao carregar: ${e.message}</p>`;
  }
}

function abrirSaidaDoModal() {
  if (!currentItemForModal) return;
  closeModal('modalDetalhes');
  
  let quantidadeAgrupada = currentItemForModal.quantidade;
  if (window.drawablePaletes && currentItemForModal.status === 'ESTOQUE') {
    const p = drawablePaletes.find(p => p.loc?.itens?.some(i => i.id === currentItemForModal.id));
    if (p && p.loc && p.loc.itens) {
      const idens = p.loc.itens.filter(i => i.codigo === currentItemForModal.codigo && i.status === 'ESTOQUE');
      quantidadeAgrupada = idens.reduce((sum, i) => sum + i.quantidade, 0);
    }
  }
  
  abrirModalSaida(currentItemForModal.id, currentItemForModal.nome, quantidadeAgrupada);
}

function abrirModalSaida(id, nome, qtdMax) {
  document.getElementById('modalItemId').value = id;
  document.getElementById('modalItemNome').textContent = nome;
  document.getElementById('modalQtd').max = qtdMax;
  document.getElementById('modalQtd').value = qtdMax;
  document.getElementById('modalSaida').style.display = 'flex';
}

async function confirmarSaida() {
  const itemId = document.getElementById('modalItemId').value;
  const motivo = document.getElementById('modalMotivo').value;

  if (!motivo) { showToast('Selecione o motivo da saída', 'error'); return; }

  try {
    await apiFetch('/movimentacoes/saida', {
      method: 'POST',
      body: {
        itemId,
        motivo,
        destino: document.getElementById('modalDestino').value,
        quantidade: parseInt(document.getElementById('modalQtd').value),
        usuario: document.getElementById('modalUsuario').value || 'Sistema',
        observacao: document.getElementById('modalObservacao').value
      }
    });

    showToast('Saída registrada com sucesso!', 'success');
    closeModal('modalSaida');

    // Recarregar página atual
    if (currentPage === 'estoque') loadEstoque();
    else if (currentPage === 'dashboard') loadDashboard();
    else if (currentPage === 'mapa') loadMapa();

  } catch (e) {
    showToast('Erro ao registrar saída: ' + e.message, 'error');
  }
}

async function imprimirEtiquetaModal() {
  if (!currentItemForModal) return;
  currentItemIdForEtiqueta = currentItemForModal.id;
  await imprimirEtiqueta();
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Fechar modal clicando fora
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});

// =====================
// UTILS
// =====================
function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return `rgba(100,100,100,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// =====================
// INICIALIZAÇÃO
// =====================
(async function init() {
  await checkConnection();
  setInterval(checkConnection, 30000);

  // Inicializar form de cadastro
  await initCadastrarForm();

  // Carregar página inicial
  navigateTo('mapa');
})();

// =====================
// CONTROLE DO MAPA 3D
// =====================
function mudarVisaoMapa(viewMode) {
  window.currentViewMode = viewMode;
  if (viewMode === 'aerea') {
    rotX = 60; // Visto de cima inclinado
    rotY = 0;
    mapaScale = 0.8;
    window.camX = 0;
    window.camY = -10;
    window.camZ = 5;
    window.usePerspective = false;
  } else if (viewMode === 'entrada') {
    rotX = 25; // Inclinado como na referência
    rotY = 145; // Girar a câmera para o outro lado (Entrada fica embaixo)
    mapaScale = 1.0;
    window.camX = 0;
    window.camY = -15; 
    window.camZ = -10; // Câmera movida para o outro lado do galpão
    window.usePerspective = true;
  }
  drawWarehouse();
}

// =====================
// PREÇOS E SUGESTÃO
// =====================
function calcularSugestao() {
  const vNf = parseFloat(document.getElementById('inputValorNf').value) || 0;
  const vInt = parseFloat(document.getElementById('inputValorInternet').value) || 0;
  
  const baseValue = vInt > 0 ? vInt : vNf;
  const sugestao = baseValue * 0.40;
  
  document.getElementById('inputSugestao').value = sugestao > 0 ? sugestao.toFixed(2) : '';

  // Calcular Diferença
  const divDiff = document.getElementById('diferencaPrecoInfo');
  if (vNf > 0 && vInt > 0) {
    const diff = vInt - vNf;
    const perc = ((diff / vNf) * 100).toFixed(1);
    const cor = diff >= 0 ? '#4ADE80' : '#EF4444'; // verde se internet > NF, vermelho se NF > internet
    const texto = diff >= 0 
        ? `Valor na internet é <strong>R$ ${diff.toFixed(2).replace('.',',')} (+${perc}%) MAIOR</strong> que a Nota Fiscal.`
        : `Valor na internet é <strong style="color:#EF4444">R$ ${Math.abs(diff).toFixed(2).replace('.',',')} (${perc}%) MENOR</strong> que a Nota Fiscal.`;
    
    divDiff.style.display = 'block';
    divDiff.innerHTML = `<span style="color:${cor}">${texto}</span>`;
  } else {
    divDiff.style.display = 'none';
  }
}

async function buscarPrecoInternet() {
  const nome = document.getElementById('inputNome').value.trim();
  if(!nome) {
    showToast('Preencha o nome do item primeiro para buscar o preço', 'warning');
    return;
  }
  
  const divRes = document.getElementById('scrapeResults');
  divRes.innerHTML = '🤖 Robô pesquisando na internet...';
  
  try {
    const res = await apiFetch(`/items/scrape/search?q=${encodeURIComponent(nome)}`);
    if(res && res.success && res.options && res.options.length > 0) {
      document.getElementById('inputValorInternet').value = res.average;
      
      let html = `<div style="margin-bottom: 8px;">✅ <b>Média encontrada: R$ ${res.average.toFixed(2).replace('.',',')}</b></div>`;
      html += `<div style="font-size: 11px; color: #888; margin-bottom: 5px;">Baseado em ${res.options.length} resultados reais:</div>`;
      
      res.options.forEach((opt, idx) => {
        const imgHtml = opt.image ? `<img src="${opt.image}" style="width: 28px; height: 28px; object-fit: contain; margin-right: 8px; border-radius: 4px; background: #fff;" />` : '';
        html += `<div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-bottom: 5px; border-bottom: 1px solid #333; padding-bottom: 5px;">
          <div style="display: flex; align-items: center; max-width: 70%; overflow: hidden;">
            ${imgHtml}
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${opt.title}">- ${opt.title}</span>
          </div>
          <span style="white-space: nowrap; margin-left: 5px;">R$ ${opt.price.toFixed(2).replace('.',',')} <a href="${opt.link}" target="_blank" style="color:#4A90D9;text-decoration:none; margin-left: 5px;">🛒</a></span>
        </div>`;
      });
      
      divRes.innerHTML = html;
      calcularSugestao();
      showToast('Preço médio encontrado na internet!', 'success');
    } else {
      divRes.innerHTML = '❌ Não foi possível encontrar um preço exato na internet.';
      showToast('Não encontrou preço', 'warning');
    }
  } catch(e) {
    divRes.innerHTML = '❌ Erro ao consultar robô de preços.';
    showToast('Erro no robô', 'error');
  }
}

// =====================
// CUSTOM CONFIRM
// =====================
window.customConfirm = function(title, message, icon, onConfirm) {
  document.getElementById('modalConfirmTitle').textContent = title;
  document.getElementById('modalConfirmMessage').textContent = message;
  document.getElementById('modalConfirmIcon').textContent = icon || '⚠️';
  document.getElementById('modalConfirm').style.display = 'flex';
  
  const btnOk = document.getElementById('btnConfirmOk');
  btnOk.onclick = () => {
    closeModal('modalConfirm');
    if (onConfirm) onConfirm();
  };
};

window.playSuccessBeep = function() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.50, ctx.currentTime); // Nota C6
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch(e) {
    console.log("Audio API not supported", e);
  }
};

// =====================
// QR SCANNER (USB / Teclado)
// =====================
let scannerContext = 'saida';
let scannerContextId = null;

function abrirScanner(context = 'saida', id = null) {
  scannerContext = context;
  scannerContextId = id;
  document.getElementById('modalScanner').style.display = 'flex';
  
  // Foca no input USB para leitores de pistola
  setTimeout(() => {
    const usbInput = document.getElementById('leitorUsbInput');
    if(usbInput) usbInput.focus();
  }, 100);
}

function fecharScanner() {
  document.getElementById('modalScanner').style.display = 'none';
}

async function processScan(codigoLido) {
  if (scannerContext === 'lote' && scannerContextId) {
    if (typeof processScanParaLote === 'function') {
      return processScanParaLote(scannerContextId, codigoLido);
    }
  }

  // Se não for lote, ou for uma saída normal, fecha o scanner
  fecharScanner();

  showToast('Buscando: ' + codigoLido, 'info');
  
  try {
    // 1. Tentar verificar se é um Lote
    if (codigoLido.toUpperCase().startsWith('LOT-')) {
      try {
        const lote = await apiFetch(`/lotes/codigo/${encodeURIComponent(codigoLido)}`);
        if (lote && lote.id) {
          if(window.playSuccessBeep) window.playSuccessBeep();
          // Usa o modal bonitinho em vez de window.confirm()
          document.getElementById('modalLoteNome').textContent = lote.nome;
          document.getElementById('modalLoteQtd').textContent = lote.itens.length;
          document.getElementById('modalLoteSaida').style.display = 'flex';
          
          document.getElementById('btnConfirmarLoteSaida').onclick = async () => {
             const destino = document.getElementById('modalLoteDestino').value || 'Leilão/Transferência';
             try {
               await apiFetch(`/lotes/${lote.id}/saida`, {
                 method: 'POST',
                 body: { motivo: 'LOTE_SAIDA', destino }
               });
               showToast('Saída em massa registrada com sucesso!', 'success');
               closeModal('modalLoteSaida');
               if(currentPage === 'dashboard') loadDashboard();
               if(currentPage === 'estoque') loadEstoque();
               if(currentPage === 'mapa') loadMapa();
               if(currentPage === 'lotes') loadLotes();
             } catch(e) {
               showToast('Erro ao dar saída no lote: ' + e.message, 'error');
             }
          };
          return;
        }
      } catch(err) {
        console.warn("Código LOT- não encontrado nos lotes. ", err);
      }
    }

    // 2. Senão, busca como Item normal
    const res = await apiFetch(`/items?search=${encodeURIComponent(codigoLido)}`);
    if (res && res.length > 0) {
      // Pega todos os itens idênticos em estoque para somar a quantidade
      const idens = res.filter(i => i.codigo === codigoLido && i.status === 'ESTOQUE');
      
      if (idens.length > 0) {
        if(window.playSuccessBeep) window.playSuccessBeep();
        const itemPrinc = idens[0];
        const qtdTotal = idens.reduce((sum, i) => sum + i.quantidade, 0);
        abrirModalSaida(itemPrinc.id, itemPrinc.nome, qtdTotal);
      } else {
        showToast('Este item já tem saída registrada ou não está em estoque!', 'warning');
      }
    } else {
      showToast('Item não encontrado pelo código: ' + codigoLido, 'error');
    }
  } catch (e) {
    showToast('Erro ao buscar código: ' + e.message, 'error');
  }
}

let lastScannedCode = null;
let scanTimeout = null;

function onScanSuccess(decodedText) {
  if (lastScannedCode === decodedText) return; // evita scan duplicado rápido
  
  lastScannedCode = decodedText;
  clearTimeout(scanTimeout);
  scanTimeout = setTimeout(() => { lastScannedCode = null; }, 2000); // libera depois de 2s

  processScan(decodedText);
}
function onScanFailure(error) { /* Ignorar erros de leitura por frame */ }

// Ouvinte para o leitor USB dar o Enter
document.addEventListener('DOMContentLoaded', () => {
  const usbInput = document.getElementById('leitorUsbInput');
  if(usbInput) {
    usbInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = this.value.trim();
        if (code) {
          processScan(code);
          this.value = '';
        }
      }
    });
  }
});

// =====================
// ANIMAÇÃO PERSONAGEM
// =====================
let charPos = { x: -35, z: 28, dir: 1, timer: 0 };

function updateCharacter() {
  charPos.x += charPos.dir * 0.15;
  charPos.timer += 0.2;
  if (charPos.x > 40) charPos.dir = -1;
  if (charPos.x < -35) charPos.dir = 1;
}

function drawCharacter() {
  if (window.currentViewMode === 'aerea') return;
  const bounce = Math.abs(Math.sin(charPos.timer)) * 0.2;
  
  const cx = charPos.x;
  const cy = bounce;
  const cz = charPos.z;

  function drawCube(bx, by, bz, bw, bh, bd, colorTop, colorRight, colorLeft) {
    const p000 = project(bx, by, bz);
    const p100 = project(bx+bw, by, bz);
    const p101 = project(bx+bw, by, bz+bd);
    const p001 = project(bx, by, bz+bd);
    
    const p010 = project(bx, by+bh, bz);
    const p110 = project(bx+bw, by+bh, bz);
    const p111 = project(bx+bw, by+bh, bz+bd);
    const p011 = project(bx, by+bh, bz+bd);

    // Left/Front (facing +Z)
    drawFace([p001, p101, p111, p011], colorLeft, 'rgba(0,0,0,0.4)');
    // Right (facing +X)
    drawFace([p100, p101, p111, p110], colorRight, 'rgba(0,0,0,0.4)');
    // Top
    drawFace([p010, p110, p111, p011], colorTop, 'rgba(0,0,0,0.4)');
  }
  
  // Forklift body
  drawCube(cx - 2.5, cy + 0.5, cz - 1.5, 5, 2, 3, '#F39C12', '#D68910', '#B9770E');
  
  // Cabin
  drawCube(cx - 1, cy + 2.5, cz - 1, 2.5, 2.5, 2, '#34495E', '#2C3E50', '#212F3C');
  
  // Wheels
  drawCube(cx - 2, cy, cz - 1.7, 1.2, 1.2, 0.4, '#111', '#000', '#222');
  drawCube(cx + 1, cy, cz - 1.7, 1.2, 1.2, 0.4, '#111', '#000', '#222');
  drawCube(cx - 2, cy, cz + 1.3, 1.2, 1.2, 0.4, '#111', '#000', '#222');
  drawCube(cx + 1, cy, cz + 1.3, 1.2, 1.2, 0.4, '#111', '#000', '#222');

  // Forks and Mast
  if (charPos.dir === 1) {
    drawCube(cx + 2.5, cy + 0.2, cz - 1, 2, 0.2, 0.4, '#BDC3C7', '#95A5A6', '#7F8C8D');
    drawCube(cx + 2.5, cy + 0.2, cz + 0.6, 2, 0.2, 0.4, '#BDC3C7', '#95A5A6', '#7F8C8D');
    drawCube(cx + 2.3, cy + 0.2, cz - 1.5, 0.4, 4, 3, '#95A5A6', '#7F8C8D', '#616A6B');
  } else {
    drawCube(cx - 4.5, cy + 0.2, cz - 1, 2, 0.2, 0.4, '#BDC3C7', '#95A5A6', '#7F8C8D');
    drawCube(cx - 4.5, cy + 0.2, cz + 0.6, 2, 0.2, 0.4, '#BDC3C7', '#95A5A6', '#7F8C8D');
    drawCube(cx - 2.7, cy + 0.2, cz - 1.5, 0.4, 4, 3, '#95A5A6', '#7F8C8D', '#616A6B');
  }
}

let isAnimRunning = false;
let lastFrameTime = 0;
const targetFPS = 15;
const frameDelay = 1000 / targetFPS;

function startAnimLoop() {
  if (isAnimRunning) return;
  isAnimRunning = true;
  function loop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const elapsed = timestamp - lastFrameTime;
    
    if (elapsed > frameDelay) {
      updateCharacter();
      if (currentPage === 'mapa' && typeof mapaCanvas !== 'undefined' && mapaCanvas) {
        drawWarehouse();
      }
      lastFrameTime = timestamp - (elapsed % frameDelay);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Inicia o loop de animação
startAnimLoop();

window.closeRegistrationModal = function() {
  document.getElementById('modalRegistrationSuccess').style.display = 'none';
  window.highlightedLoc = null;
  // Voltar zoom normal e visão padrão do mapa
  animateCamera(25, 145, 1, 0, 0);
  drawWarehouse();
};
