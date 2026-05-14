// =============================================
//  APP.JS — Capacita | Gestão de Pessoas
// =============================================

let db, auth;
try {
  if (typeof firebase === 'undefined') throw new Error('Firebase SDK não carregou.');
  if (!firebase.apps.length) throw new Error('firebase.initializeApp() não foi chamado. Verifique o firebase-config.js.');
  db   = firebase.firestore();
  auth = firebase.auth();
} catch(e) {
  document.getElementById('root').innerHTML = `
    <div style="font-family:sans-serif;max-width:480px;margin:80px auto;padding:24px;border:1px solid #fca5a5;border-radius:12px;background:#fef2f2">
      <h2 style="color:#dc2626;margin:0 0 8px">Erro de configuração Firebase</h2>
      <p style="color:#7f1d1d;font-size:14px;margin:0 0 12px">${e.message}</p>
      <p style="color:#7f1d1d;font-size:13px;margin:0">Verifique o arquivo <code>firebase-config.js</code>.</p>
    </div>`;
  throw e;
}

const App = {
  currentUser: null,
  currentUserData: null,
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),

  async init() {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        this.currentUser = user;
        const doc = await db.collection('usuarios').doc(user.uid).get();
        if (doc.exists) {
          this.currentUserData = doc.data();
          this.renderApp();
        } else {
          const perfil = {
            uid: user.uid,
            nome: user.displayName || user.email.split('@')[0],
            email: user.email,
            foto: user.photoURL || '',
            funcao: '',
            setor: '',
            departamento: '',
            papel: 'colaborador',
            saldo_ferias: 30,
            saldo_folgas: 0,
            banco_horas: 0,
            admissao: new Date().toISOString().split('T')[0],
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
          };
          await db.collection('usuarios').doc(user.uid).set(perfil);
          this.currentUserData = perfil;
          this.renderApp();
        }
      } else {
        this.renderLogin();
      }
    });
  },

  async loginEmail() {
    const email = document.getElementById('inp-email').value;
    const senha = document.getElementById('inp-senha').value;
    try {
      await auth.signInWithEmailAndPassword(email, senha);
    } catch (e) {
      document.getElementById('login-erro').textContent = 'E-mail ou senha incorretos.';
    }
  },

  async logout() {
    await auth.signOut();
  },

  renderLogin() {
    document.getElementById('root').innerHTML = `
      <div class="login-wrap">
        <div class="login-box">
          <div class="login-logo">
            <span class="logo-icon">◈</span>
            <span class="logo-text">Capacita</span>
          </div>
          <p class="login-sub">Gestão de pessoas para departamentos</p>
          <input class="inp" type="email" id="inp-email" placeholder="E-mail">
          <input class="inp" type="password" id="inp-senha" placeholder="Senha" onkeydown="if(event.key==='Enter')App.loginEmail()">
          <p id="login-erro" style="color:#E24B4A;font-size:13px;margin:4px 0 0;min-height:16px"></p>
          <button class="btn-primary" onclick="App.loginEmail()">Entrar</button>
        </div>
      </div>
    `;
  },

  renderApp() {
    const u = this.currentUserData;
    const isGestor = u.papel === 'gestor' || u.papel === 'admin';
    document.getElementById('root').innerHTML = `
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-logo">
            <span class="logo-icon">◈</span>
            <span class="logo-text">Capacita</span>
          </div>
          <nav class="nav">
            <a class="nav-item active" onclick="App.showPage('calendario')" data-page="calendario">
              <i class="ti ti-calendar"></i> Calendário
            </a>
            <a class="nav-item" onclick="App.showPage('solicitacoes')" data-page="solicitacoes">
              <i class="ti ti-file-text"></i> Solicitações
            </a>
            <a class="nav-item" onclick="App.showPage('banco-horas')" data-page="banco-horas">
              <i class="ti ti-clock"></i> Banco de horas
            </a>
            <a class="nav-item" onclick="App.showPage('desenvolvimento')" data-page="desenvolvimento">
              <i class="ti ti-road"></i> Desenvolvimento
            </a>
            ${isGestor ? `
            <div class="nav-section">Gestão</div>
            <a class="nav-item" onclick="App.showPage('aprovacoes')" data-page="aprovacoes">
              <i class="ti ti-checks"></i> Aprovações
            </a>
            <a class="nav-item" onclick="App.showPage('equipe')" data-page="equipe">
              <i class="ti ti-users"></i> Equipe
            </a>` : ''}
          </nav>
          <div class="sidebar-user">
            ${u.foto ? `<img src="${u.foto}" class="user-avatar">` : `<div class="user-avatar-initials">${this.initials(u.nome)}</div>`}
            <div class="user-info">
              <span class="user-name">${u.nome}</span>
              <span class="user-role">${u.papel === 'gestor' ? 'Gestor' : 'Colaborador'}${u.setor ? ' · ' + u.setor : ''}</span>
            </div>
            <button class="btn-logout" onclick="App.logout()" title="Sair">
              <i class="ti ti-logout"></i>
            </button>
          </div>
        </aside>
        <main class="main" id="main-content"></main>
      </div>
    `;
    this.showPage('calendario');
  },

  showPage(page) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const nav = document.querySelector(`[data-page="${page}"]`);
    if (nav) nav.classList.add('active');
    switch(page) {
      case 'calendario':   Calendario.render(); break;
      case 'solicitacoes': Solicitacoes.render(); break;
      case 'banco-horas':  BancoHoras.render(); break;
      case 'aprovacoes':   Aprovacoes.render(); break;
      case 'equipe':       Equipe.render(); break;
      case 'desenvolvimento': Desenvolvimento.render(); break;
    }
  },

  // Retorna o setor do usuário logado (para filtrar equipe do gestor)
  meuSetor() {
    return App.currentUserData.setor || '';
  },

  initials(nome) {
    if (!nome || typeof nome !== 'string') return '?';
    return nome.trim().split(' ').filter(n => n).map(n => n[0]).slice(0,2).join('').toUpperCase();
  },

  formatDate(str) {
    if (!str) return '—';
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  },

  daysBetween(start, end) {
    const a = new Date(start), b = new Date(end);
    return Math.round((b - a) / 86400000) + 1;
  },

  tipoLabel(tipo) {
    const map = { ferias: 'Férias', folga: 'Folga', atestado: 'Atestado', banco_horas: 'Banco de horas' };
    return map[tipo] || tipo;
  },

  statusBadge(status) {
    const map = {
      pendente:  { label: 'Pendente',  cls: 'badge-warning' },
      aprovado:  { label: 'Aprovado',  cls: 'badge-success' },
      reprovado: { label: 'Reprovado', cls: 'badge-danger' },
    };
    const s = map[status] || { label: status, cls: 'badge-default' };
    return `<span class="badge ${s.cls}">${s.label}</span>`;
  }
};

// =============================================
//  MÓDULO — CALENDÁRIO
// =============================================

const Calendario = {
  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando...</div>`;

    const isGestor = App.currentUserData.papel === 'gestor' || App.currentUserData.papel === 'admin';
    const fimMes = new Date(App.currentYear, App.currentMonth + 1, 0).toISOString().split('T')[0];
    const iniMes = new Date(App.currentYear, App.currentMonth, 1).toISOString().split('T')[0];

    let solicitacoes = [];

    if (isGestor) {
      // Gestor vê apenas o setor dele — aprovadas
      const setor = App.meuSetor();
      const snap = await db.collection('solicitacoes').where('status', '==', 'aprovado').get();
      // Filtra por setor no cliente
      solicitacoes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.data_inicio <= fimMes && s.data_fim >= iniMes && (!setor || s.setor === setor));
    } else {
      // Colaborador vê os dias ocupados do próprio setor (sem nome), mais as próprias solicitações
      const setor = App.currentUserData.setor || '';
      const snap = await db.collection('solicitacoes').where('status', '==', 'aprovado').get();
      solicitacoes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.data_inicio <= fimMes && s.data_fim >= iniMes && (!setor || s.setor === setor));
    }

    this.renderCalendario(solicitacoes, isGestor);
  },

  renderCalendario(solicitacoes, isGestor) {
    const main = document.getElementById('main-content');
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const ano = App.currentYear;
    const mes = App.currentMonth;
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias   = new Date(ano, mes + 1, 0).getDate();

    // Monta mapa de eventos por dia
    const eventos = {};
    solicitacoes.forEach(sol => {
      let d = new Date(sol.data_inicio + 'T12:00:00');
      const fim = new Date(sol.data_fim + 'T12:00:00');
      while (d <= fim) {
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!eventos[key]) eventos[key] = [];
        eventos[key].push(sol);
        d.setDate(d.getDate() + 1);
      }
    });

    const u = App.currentUserData;

    let cells = '';
    for (let i = 0; i < primeiroDia; i++) cells += `<div class="cal-cell empty"></div>`;
    for (let dia = 1; dia <= totalDias; dia++) {
      const key = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
      const evs = eventos[key] || [];
      const isHoje = key === new Date().toISOString().split('T')[0];
      const isWeekend = new Date(key + 'T12:00:00').getDay() === 0 || new Date(key + 'T12:00:00').getDay() === 6;

      const evHtml = evs.slice(0,2).map(e => {
        const cls = e.tipo === 'ferias' ? 'ev-ferias' : e.tipo === 'folga' ? 'ev-folga' : 'ev-atestado';
        // Gestor vê nome, colaborador vê só o tipo
        const label = isGestor ? (e.nome ? e.nome.split(' ')[0] : App.tipoLabel(e.tipo)) : App.tipoLabel(e.tipo);
        const title = isGestor ? `${e.nome || '?'} — ${App.tipoLabel(e.tipo)}` : App.tipoLabel(e.tipo);
        return `<div class="cal-ev ${cls}" title="${title}">${label}</div>`;
      }).join('');
      const mais = evs.length > 2 ? `<div class="cal-ev-more">+${evs.length - 2}</div>` : '';

      cells += `
        <div class="cal-cell${isHoje ? ' hoje' : ''}${isWeekend ? ' weekend' : ''}">
          <span class="cal-day-num">${dia}</span>
          ${evHtml}${mais}
        </div>`;
    }

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Calendário</h1>
          <p class="page-sub">Férias, folgas e atestados${u.setor ? ' · ' + u.setor : ''}</p>
        </div>
        <button class="btn-primary" onclick="Solicitacoes.openNova()">
          <i class="ti ti-plus"></i> Nova solicitação
        </button>
      </div>
      <div class="saldo-cards">
        <div class="saldo-card">
          <span class="saldo-label"><i class="ti ti-beach"></i> Saldo férias</span>
          <span class="saldo-num">${u.saldo_ferias} dias</span>
        </div>
        <div class="saldo-card">
          <span class="saldo-label"><i class="ti ti-sun"></i> Folgas disponíveis</span>
          <span class="saldo-num">${u.saldo_folgas} dias</span>
        </div>
        <div class="saldo-card">
          <span class="saldo-label"><i class="ti ti-clock"></i> Banco de horas</span>
          <span class="saldo-num">${u.banco_horas > 0 ? '+' : ''}${u.banco_horas}h</span>
        </div>
      </div>
      <div class="cal-nav">
        <button class="btn-icon" onclick="Calendario.prevMes()"><i class="ti ti-chevron-left"></i></button>
        <h2 class="cal-mes-titulo">${meses[mes]} ${ano}</h2>
        <button class="btn-icon" onclick="Calendario.nextMes()"><i class="ti ti-chevron-right"></i></button>
      </div>
      <div class="cal-grid">
        ${diasSemana.map(d => `<div class="cal-header-cell">${d}</div>`).join('')}
        ${cells}
      </div>
      <div class="cal-legenda">
        <span class="leg-item"><span class="leg-dot ev-ferias"></span> Férias</span>
        <span class="leg-item"><span class="leg-dot ev-folga"></span> Folga</span>
        <span class="leg-item"><span class="leg-dot ev-atestado"></span> Atestado</span>
      </div>
    `;
  },

  prevMes() {
    if (App.currentMonth === 0) { App.currentMonth = 11; App.currentYear--; }
    else App.currentMonth--;
    this.render();
  },

  nextMes() {
    if (App.currentMonth === 11) { App.currentMonth = 0; App.currentYear++; }
    else App.currentMonth++;
    this.render();
  }
};

// =============================================
//  MÓDULO — SOLICITAÇÕES
// =============================================

const Solicitacoes = {
  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando...</div>`;

    const snap = await db.collection('solicitacoes')
      .where('uid', '==', App.currentUser.uid)
      .get();

    const lista = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Minhas solicitações</h1>
          <p class="page-sub">Histórico de férias, folgas e atestados</p>
        </div>
        <button class="btn-primary" onclick="Solicitacoes.openNova()">
          <i class="ti ti-plus"></i> Nova solicitação
        </button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Tipo</th><th>Início</th><th>Fim</th><th>Dias</th><th>Observação</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${lista.length === 0
              ? `<tr><td colspan="6" class="empty-row">Nenhuma solicitação ainda</td></tr>`
              : lista.map(s => `
                <tr>
                  <td><span class="tipo-pill tipo-${s.tipo}">${App.tipoLabel(s.tipo)}</span></td>
                  <td>${App.formatDate(s.data_inicio)}</td>
                  <td>${App.formatDate(s.data_fim)}</td>
                  <td>${s.dias}</td>
                  <td class="obs-cell">${s.observacao || '—'}</td>
                  <td>${App.statusBadge(s.status)}</td>
                </tr>`).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  },

  openNova() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-nova';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Nova solicitação</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-nova').remove()">
            <i class="ti ti-x"></i>
          </button>
        </div>
        <div class="modal-body">
          <label class="form-label">Tipo</label>
          <select class="inp" id="sol-tipo">
            <option value="ferias">Férias</option>
            <option value="folga">Folga avulsa</option>
            <option value="atestado">Atestado médico</option>
            <option value="banco_horas">Compensação banco de horas</option>
          </select>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div>
              <label class="form-label">Data início</label>
              <input class="inp" type="date" id="sol-inicio">
            </div>
            <div>
              <label class="form-label">Data fim</label>
              <input class="inp" type="date" id="sol-fim">
            </div>
          </div>
          <div id="sol-dias-info" style="font-size:13px;color:#6B6B66;margin:8px 0 0;min-height:20px"></div>
          <label class="form-label" style="margin-top:12px">Observação <span style="font-weight:400;color:#A0A09A">(opcional)</span></label>
          <textarea class="inp" id="sol-obs" rows="3" placeholder="Informe mais detalhes se necessário..."></textarea>
          <p id="sol-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-nova').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Solicitacoes.enviar()">Enviar solicitação</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    ['sol-inicio', 'sol-fim'].forEach(id => {
      document.getElementById(id).addEventListener('change', Solicitacoes.updateDias);
    });
  },

  updateDias() {
    const inicio = document.getElementById('sol-inicio').value;
    const fim    = document.getElementById('sol-fim').value;
    const info   = document.getElementById('sol-dias-info');
    if (inicio && fim && fim >= inicio) {
      const dias = App.daysBetween(inicio, fim);
      info.textContent = `${dias} dia${dias > 1 ? 's' : ''} solicitado${dias > 1 ? 's' : ''}`;
    } else {
      info.textContent = '';
    }
  },

  async enviar() {
    const tipo   = document.getElementById('sol-tipo').value;
    const inicio = document.getElementById('sol-inicio').value;
    const fim    = document.getElementById('sol-fim').value;
    const obs    = document.getElementById('sol-obs').value.trim();
    const erro   = document.getElementById('sol-erro');

    if (!inicio || !fim) { erro.textContent = 'Preencha as datas.'; return; }
    if (fim < inicio)    { erro.textContent = 'A data fim deve ser após a data início.'; return; }

    const dias = App.daysBetween(inicio, fim);
    const u = App.currentUserData;

    if (tipo === 'ferias' && dias > u.saldo_ferias) {
      erro.textContent = `Saldo insuficiente. Você tem ${u.saldo_ferias} dias de férias.`; return;
    }
    if (tipo === 'folga' && dias > u.saldo_folgas) {
      erro.textContent = `Saldo insuficiente. Você tem ${u.saldo_folgas} dia(s) de folga.`; return;
    }

    erro.textContent = '';
    try {
      await db.collection('solicitacoes').add({
        uid: u.uid,
        nome: u.nome,
        funcao: u.funcao || '',
        setor: u.setor || '',
        departamento: u.departamento || '',
        tipo,
        data_inicio: inicio,
        data_fim: fim,
        dias,
        observacao: obs,
        status: 'pendente',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      document.getElementById('modal-nova').remove();
      App.showPage('solicitacoes');
    } catch(e) {
      erro.textContent = 'Erro ao enviar: ' + e.message;
    }
  }
};

// =============================================
//  MÓDULO — BANCO DE HORAS
// =============================================

const BancoHoras = {
  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando...</div>`;

    const snap = await db.collection('banco_horas')
      .where('uid', '==', App.currentUser.uid)
      .get();

    const lancamentos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    const saldo = App.currentUserData.banco_horas || 0;

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Banco de horas</h1>
          <p class="page-sub">Controle de horas extras e compensações</p>
        </div>
        ${App.currentUserData.papel === 'gestor' ? `
        <button class="btn-primary" onclick="BancoHoras.openLancamento()">
          <i class="ti ti-plus"></i> Lançar horas
        </button>` : ''}
      </div>
      <div class="saldo-cards">
        <div class="saldo-card ${saldo >= 0 ? 'saldo-positivo' : 'saldo-negativo'}">
          <span class="saldo-label"><i class="ti ti-clock"></i> Saldo atual</span>
          <span class="saldo-num saldo-grande">${saldo > 0 ? '+' : ''}${saldo}h</span>
        </div>
      </div>
      <div class="table-wrap" style="margin-top:24px">
        <table class="table">
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Horas</th><th>Descrição</th></tr>
          </thead>
          <tbody>
            ${lancamentos.length === 0
              ? `<tr><td colspan="4" class="empty-row">Nenhum lançamento ainda</td></tr>`
              : lancamentos.map(l => `
                <tr>
                  <td>${App.formatDate(l.data)}</td>
                  <td><span class="badge ${l.horas > 0 ? 'badge-success' : 'badge-warning'}">${l.horas > 0 ? 'Crédito' : 'Débito'}</span></td>
                  <td style="font-weight:500">${l.horas > 0 ? '+' : ''}${l.horas}h</td>
                  <td>${l.descricao || '—'}</td>
                </tr>`).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  },

  openLancamento() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-bh';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Lançar horas</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-bh').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <label class="form-label">Data</label>
          <input class="inp" type="date" id="bh-data">
          <label class="form-label" style="margin-top:12px">Horas (positivo = extra, negativo = compensação)</label>
          <input class="inp" type="number" id="bh-horas" placeholder="Ex: 2 ou -4" step="0.5">
          <label class="form-label" style="margin-top:12px">Descrição</label>
          <input class="inp" type="text" id="bh-desc" placeholder="Ex: Reunião fora do expediente">
          <p id="bh-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-bh').remove()">Cancelar</button>
          <button class="btn-primary" onclick="BancoHoras.salvar()">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async salvar() {
    const data  = document.getElementById('bh-data').value;
    const horas = parseFloat(document.getElementById('bh-horas').value);
    const desc  = document.getElementById('bh-desc').value.trim();
    const erro  = document.getElementById('bh-erro');

    if (!data || isNaN(horas)) { erro.textContent = 'Preencha data e horas.'; return; }

    try {
      await db.collection('banco_horas').add({
        uid: App.currentUser.uid, data, horas, descricao: desc,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('usuarios').doc(App.currentUser.uid).update({
        banco_horas: firebase.firestore.FieldValue.increment(horas)
      });
      App.currentUserData.banco_horas = (App.currentUserData.banco_horas || 0) + horas;
      document.getElementById('modal-bh').remove();
      this.render();
    } catch(e) {
      erro.textContent = 'Erro: ' + e.message;
    }
  }
};

// =============================================
//  MÓDULO — APROVAÇÕES (gestor — filtra por setor)
// =============================================

const Aprovacoes = {
  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando...</div>`;

    const setor = App.meuSetor();
    const snap = await db.collection('solicitacoes').where('status', '==', 'pendente').get();

    const lista = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => !setor || s.setor === setor)
      .sort((a, b) => (a.criadoEm?.seconds || 0) - (b.criadoEm?.seconds || 0));

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Aprovações pendentes</h1>
          <p class="page-sub">${lista.length} solicitação${lista.length !== 1 ? 'ões' : ''} aguardando${setor ? ' · ' + setor : ''}</p>
        </div>
      </div>
      ${lista.length === 0
        ? `<div class="empty-state">
             <i class="ti ti-checks" style="font-size:48px;color:#A0A09A"></i>
             <p>Nenhuma solicitação pendente</p>
           </div>`
        : lista.map(s => `
          <div class="aprov-card">
            <div class="aprov-info">
              <div class="aprov-avatar">${s.nome ? s.nome.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() : '?'}</div>
              <div>
                <p class="aprov-nome">${s.nome || '—'}</p>
                <p class="aprov-detalhe" style="font-size:11px;color:#A0A09A;margin:1px 0 4px">${[s.funcao, s.setor, s.departamento].filter(Boolean).join(' · ')}</p>
                <p class="aprov-detalhe">
                  <span class="tipo-pill tipo-${s.tipo}">${App.tipoLabel(s.tipo)}</span>
                  ${App.formatDate(s.data_inicio)} → ${App.formatDate(s.data_fim)}
                  · <strong>${s.dias} dia${s.dias > 1 ? 's' : ''}</strong>
                </p>
                ${s.observacao ? `<p class="aprov-obs">"${s.observacao}"</p>` : ''}
              </div>
            </div>
            <div class="aprov-actions">
              <button class="btn-danger" onclick="Aprovacoes.reprovar('${s.id}')">
                <i class="ti ti-x"></i> Reprovar
              </button>
              <button class="btn-success" onclick="Aprovacoes.aprovar('${s.id}', '${s.uid}', '${s.tipo}', ${s.dias})">
                <i class="ti ti-check"></i> Aprovar
              </button>
            </div>
          </div>`).join('')
      }
    `;
  },

  async aprovar(id, uid, tipo, dias) {
    await db.collection('solicitacoes').doc(id).update({
      status: 'aprovado',
      aprovadoPor: App.currentUser.uid,
      aprovadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    const campo = tipo === 'ferias' ? 'saldo_ferias' : tipo === 'folga' ? 'saldo_folgas' : null;
    if (campo) {
      await db.collection('usuarios').doc(uid).update({
        [campo]: firebase.firestore.FieldValue.increment(-dias)
      });
    }
    this.render();
  },

  async reprovar(id) {
    await db.collection('solicitacoes').doc(id).update({
      status: 'reprovado',
      reprovadoPor: App.currentUser.uid,
      reprovadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    this.render();
  }
};

// =============================================
//  MÓDULO — EQUIPE (gestor — filtra por setor)
// =============================================

const Equipe = {
  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando...</div>`;

    const setor = App.meuSetor();
    const snap = await db.collection('usuarios').get();
    // Gestor vê só o próprio setor (se tiver setor definido)
    const usuarios = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => !setor || u.setor === setor);

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Equipe</h1>
          <p class="page-sub">${usuarios.length} colaborador${usuarios.length !== 1 ? 'es' : ''}${setor ? ' · ' + setor : ''}</p>
        </div>
      </div>
      <div class="equipe-grid">
        ${usuarios.map(u => `
          <div class="equipe-card">
            <div class="equipe-avatar">${App.initials(u.nome)}</div>
            <p class="equipe-nome">${u.nome}</p>
            <p class="equipe-cargo">${u.funcao || u.papel}</p>
            <p style="font-size:11px;color:#A0A09A;margin:-4px 0 8px">${[u.setor, u.departamento].filter(Boolean).join(' · ') || '—'}</p>
            <div class="equipe-saldos">
              <span title="Férias"><i class="ti ti-beach"></i> ${u.saldo_ferias || 0}d</span>
              <span title="Folgas"><i class="ti ti-sun"></i> ${u.saldo_folgas || 0}d</span>
              <span title="Banco de horas"><i class="ti ti-clock"></i> ${u.banco_horas || 0}h</span>
            </div>
            <button class="btn-secondary" style="width:100%;margin-top:8px;font-size:12px"
              onclick="Equipe.editarColaborador('${u.id}')">
              <i class="ti ti-edit"></i> Editar
            </button>
          </div>`).join('')}
      </div>
    `;
  },

  async editarColaborador(uid) {
    const doc = await db.collection('usuarios').doc(uid).get();
    const u = doc.data();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-edit';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Editar colaborador</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-edit').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <label class="form-label">Nome</label>
          <input class="inp" id="ed-nome" value="${u.nome || ''}">

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div>
              <label class="form-label">Função</label>
              <input class="inp" id="ed-funcao" value="${u.funcao || ''}">
            </div>
            <div>
              <label class="form-label">Setor</label>
              <input class="inp" id="ed-setor" value="${u.setor || ''}">
            </div>
          </div>

          <label class="form-label" style="margin-top:12px">Departamento</label>
          <input class="inp" id="ed-depto" value="${u.departamento || ''}">

          <label class="form-label" style="margin-top:12px">Papel</label>
          <select class="inp" id="ed-papel">
            <option value="colaborador" ${u.papel === 'colaborador' ? 'selected' : ''}>Colaborador</option>
            <option value="gestor" ${u.papel === 'gestor' ? 'selected' : ''}>Gestor</option>
          </select>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px">
            <div>
              <label class="form-label">Saldo férias</label>
              <input class="inp" type="number" id="ed-ferias" value="${u.saldo_ferias || 0}">
            </div>
            <div>
              <label class="form-label">Saldo folgas</label>
              <input class="inp" type="number" id="ed-folgas" value="${u.saldo_folgas || 0}">
            </div>
            <div>
              <label class="form-label">Banco horas</label>
              <input class="inp" type="number" id="ed-bh" value="${u.banco_horas || 0}">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-edit').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Equipe.salvarEdicao('${uid}')">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async salvarEdicao(uid) {
    await db.collection('usuarios').doc(uid).update({
      nome:         document.getElementById('ed-nome').value,
      funcao:       document.getElementById('ed-funcao').value,
      setor:        document.getElementById('ed-setor').value,
      departamento: document.getElementById('ed-depto').value,
      papel:        document.getElementById('ed-papel').value,
      saldo_ferias: parseInt(document.getElementById('ed-ferias').value) || 0,
      saldo_folgas: parseInt(document.getElementById('ed-folgas').value) || 0,
      banco_horas:  parseFloat(document.getElementById('ed-bh').value) || 0,
    });
    document.getElementById('modal-edit').remove();
    this.render();
  }
};

// =============================================
//  MÓDULO — DESENVOLVIMENTO (Feedbacks, Ciclos, PDI)
// =============================================

const Desenvolvimento = {

  // ---------- RENDER PRINCIPAL ----------

  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando...</div>`;

    const isGestor = App.currentUserData.papel === 'gestor' || App.currentUserData.papel === 'admin';
    const uid = App.currentUser.uid;

    // Busca ciclos ativos
    const ciclosSnap = await db.collection('ciclos')
      .where('status', 'in', ['aberto', 'em_andamento'])
      .get();
    const ciclos = ciclosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Busca feedbacks recebidos
    const feedSnap = await db.collection('feedbacks')
      .where('destinatario_uid', '==', uid)
      .get();
    const feedbacks = feedSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

    // Busca PDI do usuário
    const pdiSnap = await db.collection('pdis')
      .where('uid', '==', uid)
      .get();
    const pdis = pdiSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Desenvolvimento</h1>
          <p class="page-sub">Feedbacks, ciclos de avaliação e PDI</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-secondary" onclick="Desenvolvimento.openFeedback()">
            <i class="ti ti-message-circle"></i> Dar feedback
          </button>
          ${isGestor ? `
          <button class="btn-primary" onclick="Desenvolvimento.openNovoCiclo()">
            <i class="ti ti-plus"></i> Novo ciclo
          </button>` : ''}
        </div>
      </div>

      <!-- CICLOS ATIVOS -->
      <div class="dev-section">
        <h2 class="dev-section-title"><i class="ti ti-refresh"></i> Ciclos de avaliação</h2>
        ${ciclos.length === 0
          ? `<p class="dev-empty">Nenhum ciclo ativo no momento</p>`
          : ciclos.map(c => Desenvolvimento.renderCicloCard(c, isGestor)).join('')
        }
      </div>

      <!-- FEEDBACKS RECEBIDOS -->
      <div class="dev-section">
        <h2 class="dev-section-title"><i class="ti ti-messages"></i> Feedbacks recebidos</h2>
        ${feedbacks.length === 0
          ? `<p class="dev-empty">Nenhum feedback recebido ainda</p>`
          : feedbacks.slice(0,5).map(f => `
            <div class="feedback-card">
              <div class="feedback-header">
                <span class="feedback-tipo tipo-${f.tipo}">${f.tipo === 'positivo' ? '👍 Positivo' : f.tipo === 'melhoria' ? '💡 Melhoria' : '💬 Geral'}</span>
                <span class="feedback-data">${Desenvolvimento.formatTs(f.criadoEm)}</span>
              </div>
              <p class="feedback-texto">${f.mensagem}</p>
              <p class="feedback-de">— Anônimo</p>
            </div>`).join('')
        }
      </div>

      <!-- PDI -->
      <div class="dev-section">
        <h2 class="dev-section-title"><i class="ti ti-road"></i> Plano de Desenvolvimento Individual</h2>
        <button class="btn-secondary" style="margin-bottom:14px" onclick="Desenvolvimento.openNovoPDI()">
          <i class="ti ti-plus"></i> Nova meta de desenvolvimento
        </button>
        ${pdis.length === 0
          ? `<p class="dev-empty">Nenhuma meta de PDI cadastrada</p>`
          : pdis.map(p => `
            <div class="pdi-card">
              <div class="pdi-header">
                <span class="pdi-titulo">${p.titulo}</span>
                <span class="badge ${p.status === 'concluido' ? 'badge-success' : p.status === 'em_andamento' ? 'badge-warning' : 'badge-default'}">
                  ${p.status === 'concluido' ? 'Concluído' : p.status === 'em_andamento' ? 'Em andamento' : 'Pendente'}
                </span>
              </div>
              <p class="pdi-desc">${p.descricao || ''}</p>
              <div class="pdi-footer">
                <span><i class="ti ti-calendar"></i> Prazo: ${p.prazo ? App.formatDate(p.prazo) : '—'}</span>
                <button class="btn-icon" onclick="Desenvolvimento.editarPDI('${p.id}')"><i class="ti ti-edit"></i></button>
              </div>
            </div>`).join('')
        }
      </div>
    `;
  },

  renderCicloCard(ciclo, isGestor) {
    const uid = App.currentUser.uid;
    const etapas = {
      autoavaliacao: { label: 'Autoavaliação', icon: 'ti-user' },
      gestor: { label: 'Avaliação do gestor', icon: 'ti-briefcase' },
      avaliacao_360: { label: 'Avaliação 360°', icon: 'ti-arrows-left-right' },
    };

    const etapaAtual = ciclo.etapa_atual || 'autoavaliacao';
    const minhaAvaliacao = ciclo.avaliacoes?.[uid];
    const mediaFinal = ciclo.media_final;

    return `
      <div class="ciclo-card">
        <div class="ciclo-header">
          <div>
            <p class="ciclo-nome">${ciclo.nome}</p>
            <p class="ciclo-periodo">${ciclo.periodo || ''}</p>
          </div>
          <span class="badge ${ciclo.status === 'aberto' ? 'badge-success' : 'badge-warning'}">
            ${ciclo.status === 'aberto' ? 'Aberto' : 'Em andamento'}
          </span>
        </div>

        <div class="ciclo-etapas">
          ${Object.entries(etapas).map(([key, val], i) => {
            const concluida = ciclo.etapas_concluidas?.includes(key);
            const ativa = etapaAtual === key;
            return `
              <div class="etapa-item ${ativa ? 'ativa' : ''} ${concluida ? 'concluida' : ''}">
                <div class="etapa-dot">${concluida ? '✓' : i+1}</div>
                <span>${val.label}</span>
              </div>`;
          }).join('<div class="etapa-linha"></div>')}
        </div>

        ${mediaFinal ? `
          <div class="ciclo-resultado">
            <span>Resultado final:</span>
            <strong>${mediaFinal.toFixed(1)} / 10</strong>
          </div>` : ''
        }

        <div class="ciclo-actions">
          ${etapaAtual === 'autoavaliacao' && !ciclo.avaliacoes?.[uid + '_auto']
            ? `<button class="btn-primary" onclick="Desenvolvimento.openAutoavaliacao('${ciclo.id}')">
                <i class="ti ti-pencil"></i> Fazer autoavaliação
               </button>` : ''
          }
          ${isGestor && etapaAtual === 'gestor'
            ? `<button class="btn-primary" onclick="Desenvolvimento.openAvaliacaoGestor('${ciclo.id}')">
                <i class="ti ti-clipboard-check"></i> Avaliar equipe
               </button>
               <button class="btn-secondary" onclick="Desenvolvimento.openEscolher360('${ciclo.id}')">
                <i class="ti ti-arrows-left-right"></i> Configurar 360°
               </button>` : ''
          }
          ${isGestor
            ? `<button class="btn-secondary" onclick="Desenvolvimento.verResultadosCiclo('${ciclo.id}')">
                <i class="ti ti-chart-bar"></i> Ver resultados
               </button>` : ''
          }
        </div>
      </div>`;
  },

  formatTs(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleDateString('pt-BR');
  },

  // ---------- FEEDBACK PONTUAL ----------

  async openFeedback() {
    // Busca lista de colegas do mesmo setor
    const setor = App.currentUserData.setor || '';
    const snap = await db.collection('usuarios').get();
    const colegas = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.uid !== App.currentUser.uid && (!setor || u.setor === setor));

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-feedback';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Dar feedback</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-feedback').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <label class="form-label">Para quem</label>
          <select class="inp" id="fb-dest">
            <option value="">Selecione...</option>
            ${colegas.map(c => `<option value="${c.uid}">${c.nome}</option>`).join('')}
          </select>
          <label class="form-label" style="margin-top:12px">Tipo</label>
          <select class="inp" id="fb-tipo">
            <option value="positivo">👍 Positivo</option>
            <option value="melhoria">💡 Ponto de melhoria</option>
            <option value="geral">💬 Geral</option>
          </select>
          <label class="form-label" style="margin-top:12px">Mensagem</label>
          <textarea class="inp" id="fb-msg" rows="4" placeholder="Escreva seu feedback..."></textarea>
          <p style="font-size:12px;color:#A0A09A;margin-top:6px"><i class="ti ti-lock"></i> O destinatário não saberá que foi você</p>
          <p id="fb-erro" style="color:#E24B4A;font-size:13px;margin:6px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-feedback').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.enviarFeedback()">Enviar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async enviarFeedback() {
    const dest = document.getElementById('fb-dest').value;
    const tipo = document.getElementById('fb-tipo').value;
    const msg  = document.getElementById('fb-msg').value.trim();
    const erro = document.getElementById('fb-erro');

    if (!dest) { erro.textContent = 'Selecione o destinatário.'; return; }
    if (!msg)  { erro.textContent = 'Escreva a mensagem.'; return; }

    await db.collection('feedbacks').add({
      destinatario_uid: dest,
      tipo, mensagem: msg,
      // Remetente anônimo — não salva uid do autor
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('modal-feedback').remove();
    alert('Feedback enviado com sucesso!');
  },

  // ---------- NOVO CICLO (gestor) ----------

  openNovoCiclo() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-ciclo';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Novo ciclo de avaliação</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-ciclo').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <label class="form-label">Nome do ciclo</label>
          <input class="inp" id="ciclo-nome" placeholder="Ex: 1º Semestre 2025">
          <label class="form-label" style="margin-top:12px">Período</label>
          <input class="inp" id="ciclo-periodo" placeholder="Ex: Jan–Jun 2025">
          <label class="form-label" style="margin-top:12px">Descrição (opcional)</label>
          <textarea class="inp" id="ciclo-desc" rows="2" placeholder="Contexto ou objetivo do ciclo..."></textarea>
          <div style="margin-top:14px;padding:12px;background:#F5F4F0;border-radius:8px;font-size:13px;color:#6B6B66">
            <p style="font-weight:500;margin-bottom:6px">O ciclo terá 3 etapas:</p>
            <p>1. Autoavaliação — cada colaborador se avalia (nota 0–10)</p>
            <p style="margin-top:4px">2. Avaliação do gestor — gestor avalia cada colaborador</p>
            <p style="margin-top:4px">3. Avaliação 360° — 5 pares escolhidos pelo gestor avaliam anonimamente</p>
            <p style="margin-top:6px;font-weight:500">Resultado = média das 3 notas</p>
          </div>
          <p id="ciclo-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-ciclo').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.criarCiclo()">Criar ciclo</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async criarCiclo() {
    const nome    = document.getElementById('ciclo-nome').value.trim();
    const periodo = document.getElementById('ciclo-periodo').value.trim();
    const desc    = document.getElementById('ciclo-desc').value.trim();
    const erro    = document.getElementById('ciclo-erro');

    if (!nome) { erro.textContent = 'Informe o nome do ciclo.'; return; }

    await db.collection('ciclos').add({
      nome, periodo, descricao: desc,
      setor: App.meuSetor(),
      criado_por: App.currentUser.uid,
      status: 'aberto',
      etapa_atual: 'autoavaliacao',
      etapas_concluidas: [],
      avaliacoes: {},
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('modal-ciclo').remove();
    this.render();
  },

  // ---------- AUTOAVALIAÇÃO ----------

  openAutoavaliacao(cicloId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-auto';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Autoavaliação</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-auto').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:#6B6B66;margin-bottom:16px">Avalie seu próprio desempenho neste ciclo com honestidade.</p>

          ${Desenvolvimento.renderCriterios('auto')}

          <label class="form-label" style="margin-top:16px">Comentário livre (opcional)</label>
          <textarea class="inp" id="auto-comentario" rows="3" placeholder="Pontos que você gostaria de destacar..."></textarea>
          <p id="auto-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-auto').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarAutoavaliacao('${cicloId}')">Enviar autoavaliação</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  renderCriterios(prefixo) {
    const criterios = [
      { id: 'entrega', label: 'Entrega de resultados' },
      { id: 'comunicacao', label: 'Comunicação e colaboração' },
      { id: 'iniciativa', label: 'Iniciativa e proatividade' },
      { id: 'tecnico', label: 'Conhecimento técnico' },
    ];
    return criterios.map(c => `
      <div style="margin-bottom:14px">
        <label class="form-label">${c.label}</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="range" id="${prefixo}-${c.id}" min="0" max="10" step="0.5" value="7"
            style="flex:1" oninput="document.getElementById('${prefixo}-${c.id}-val').textContent=this.value">
          <span id="${prefixo}-${c.id}-val" style="font-size:15px;font-weight:600;min-width:28px;text-align:right">7</span>
        </div>
      </div>`).join('');
  },

  calcMediaCriterios(prefixo) {
    const ids = ['entrega', 'comunicacao', 'iniciativa', 'tecnico'];
    const vals = ids.map(id => parseFloat(document.getElementById(`${prefixo}-${id}`)?.value || 0));
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  },

  async salvarAutoavaliacao(cicloId) {
    const media = this.calcMediaCriterios('auto');
    const comentario = document.getElementById('auto-comentario').value.trim();
    const uid = App.currentUser.uid;

    await db.collection('ciclos').doc(cicloId).update({
      [`avaliacoes.${uid}_auto`]: {
        nota: media,
        comentario,
        criadoEm: new Date().toISOString()
      }
    });
    document.getElementById('modal-auto').remove();
    alert(`Autoavaliação enviada! Sua nota média: ${media.toFixed(1)}`);
    this.render();
  },

  // ---------- AVALIAÇÃO DO GESTOR ----------

  async openAvaliacaoGestor(cicloId) {
    const setor = App.meuSetor();
    const snap = await db.collection('usuarios').get();
    const equipe = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.uid !== App.currentUser.uid && (!setor || u.setor === setor));

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-gest-aval';
    overlay.innerHTML = `
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <h3>Avaliação do gestor</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-gest-aval').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">
          <label class="form-label">Selecione o colaborador</label>
          <select class="inp" id="gest-aval-colab" onchange="Desenvolvimento.trocarColabGestor()">
            <option value="">Selecione...</option>
            ${equipe.map(u => `<option value="${u.uid}" data-nome="${u.nome}">${u.nome}</option>`).join('')}
          </select>
          <div id="gest-aval-form" style="margin-top:16px;display:none">
            <div id="gest-criterios"></div>
            <label class="form-label" style="margin-top:12px">Comentário</label>
            <textarea class="inp" id="gest-comentario" rows="3" placeholder="Pontos de destaque e melhoria..."></textarea>
          </div>
          <p id="gest-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-gest-aval').remove()">Fechar</button>
          <button class="btn-primary" id="btn-salvar-gest" style="display:none" onclick="Desenvolvimento.salvarAvaliacaoGestor('${cicloId}')">Salvar avaliação</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  trocarColabGestor() {
    const sel = document.getElementById('gest-aval-colab');
    const form = document.getElementById('gest-aval-form');
    const btn = document.getElementById('btn-salvar-gest');
    if (sel.value) {
      form.style.display = 'block';
      btn.style.display = 'inline-flex';
      document.getElementById('gest-criterios').innerHTML = Desenvolvimento.renderCriterios('gest');
    } else {
      form.style.display = 'none';
      btn.style.display = 'none';
    }
  },

  async salvarAvaliacaoGestor(cicloId) {
    const sel = document.getElementById('gest-aval-colab');
    const uid = sel.value;
    if (!uid) return;

    const media = this.calcMediaCriterios('gest');
    const comentario = document.getElementById('gest-comentario').value.trim();

    await db.collection('ciclos').doc(cicloId).update({
      [`avaliacoes.${uid}_gestor`]: {
        nota: media,
        comentario,
        avaliador: App.currentUser.uid,
        criadoEm: new Date().toISOString()
      }
    });
    document.getElementById('gest-erro').textContent = '';
    sel.value = '';
    document.getElementById('gest-aval-form').style.display = 'none';
    document.getElementById('btn-salvar-gest').style.display = 'none';
    alert(`Avaliação de ${sel.options[sel.selectedIndex]?.text || 'colaborador'} salva! Nota: ${media.toFixed(1)}`);
  },

  // ---------- AVALIAÇÃO 360° ----------

  async openEscolher360(cicloId) {
    const setor = App.meuSetor();
    const snap = await db.collection('usuarios').get();
    const equipe = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => (!setor || u.setor === setor));

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-360';
    overlay.innerHTML = `
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <h3>Configurar Avaliação 360°</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-360').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:#6B6B66;margin-bottom:16px">
            Selecione o colaborador avaliado e depois escolha <strong>5 pares</strong> que o avaliarão anonimamente.
          </p>
          <label class="form-label">Colaborador avaliado</label>
          <select class="inp" id="sel-avaliado">
            <option value="">Selecione...</option>
            ${equipe.map(u => `<option value="${u.uid}">${u.nome}</option>`).join('')}
          </select>
          <label class="form-label" style="margin-top:14px">Selecione 5 avaliadores (os avaliados não saberão quem os avaliou)</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
            ${equipe.map(u => `
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 8px;border-radius:6px;border:1px solid #E8E7E3">
                <input type="checkbox" class="check-360" value="${u.uid}" data-nome="${u.nome}">
                ${u.nome}
              </label>`).join('')}
          </div>
          <p style="font-size:12px;color:#A0A09A;margin-top:8px" id="count-360">0 de 5 selecionados</p>
          <p id="err-360" style="color:#E24B4A;font-size:13px;margin:6px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-360').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvar360Config('${cicloId}')">Salvar configuração</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Contador de checkboxes
    document.querySelectorAll('.check-360').forEach(cb => {
      cb.addEventListener('change', () => {
        const total = document.querySelectorAll('.check-360:checked').length;
        document.getElementById('count-360').textContent = `${total} de 5 selecionados`;
        if (total > 5) cb.checked = false;
      });
    });
  },

  async salvar360Config(cicloId) {
    const avaliado = document.getElementById('sel-avaliado').value;
    const avaliadores = [...document.querySelectorAll('.check-360:checked')].map(c => c.value);
    const erro = document.getElementById('err-360');

    if (!avaliado) { erro.textContent = 'Selecione o colaborador avaliado.'; return; }
    if (avaliadores.length !== 5) { erro.textContent = 'Selecione exatamente 5 avaliadores.'; return; }
    if (avaliadores.includes(avaliado)) { erro.textContent = 'O avaliado não pode ser um dos avaliadores.'; return; }

    // Salva configuração 360 no ciclo
    await db.collection('ciclos').doc(cicloId).update({
      [`config_360.${avaliado}`]: avaliadores
    });

    // Cria solicitações de avaliação para cada avaliador
    for (const avaliadorUid of avaliadores) {
      await db.collection('avaliacoes_360').add({
        ciclo_id: cicloId,
        avaliado_uid: avaliado,
        avaliador_uid: avaliadorUid,
        status: 'pendente',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    document.getElementById('modal-360').remove();
    alert('Avaliação 360° configurada! Os avaliadores receberão a solicitação.');
    this.render();
  },

  // ---------- PDI ----------

  openNovoPDI() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-pdi';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Nova meta de desenvolvimento</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-pdi').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <label class="form-label">Título da meta</label>
          <input class="inp" id="pdi-titulo" placeholder="Ex: Concluir certificação em liderança">
          <label class="form-label" style="margin-top:12px">Descrição</label>
          <textarea class="inp" id="pdi-desc" rows="3" placeholder="Como pretende alcançar essa meta..."></textarea>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div>
              <label class="form-label">Prazo</label>
              <input class="inp" type="date" id="pdi-prazo">
            </div>
            <div>
              <label class="form-label">Status</label>
              <select class="inp" id="pdi-status">
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
          </div>
          <p id="pdi-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-pdi').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarPDI()">Salvar meta</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async salvarPDI(id) {
    const titulo = document.getElementById('pdi-titulo').value.trim();
    const desc   = document.getElementById('pdi-desc').value.trim();
    const prazo  = document.getElementById('pdi-prazo').value;
    const status = document.getElementById('pdi-status').value;
    const erro   = document.getElementById('pdi-erro');

    if (!titulo) { erro.textContent = 'Informe o título da meta.'; return; }

    const dados = {
      uid: App.currentUser.uid,
      nome: App.currentUserData.nome,
      setor: App.currentUserData.setor || '',
      titulo, descricao: desc, prazo, status,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
      await db.collection('pdis').doc(id).update(dados);
    } else {
      await db.collection('pdis').add(dados);
    }

    document.getElementById('modal-pdi').remove();
    this.render();
  },

  async editarPDI(id) {
    const doc = await db.collection('pdis').doc(id).get();
    const p = doc.data();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-pdi';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Editar meta</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-pdi').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <label class="form-label">Título</label>
          <input class="inp" id="pdi-titulo" value="${p.titulo || ''}">
          <label class="form-label" style="margin-top:12px">Descrição</label>
          <textarea class="inp" id="pdi-desc" rows="3">${p.descricao || ''}</textarea>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div>
              <label class="form-label">Prazo</label>
              <input class="inp" type="date" id="pdi-prazo" value="${p.prazo || ''}">
            </div>
            <div>
              <label class="form-label">Status</label>
              <select class="inp" id="pdi-status">
                <option value="pendente" ${p.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                <option value="em_andamento" ${p.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
                <option value="concluido" ${p.status === 'concluido' ? 'selected' : ''}>Concluído</option>
              </select>
            </div>
          </div>
          <p id="pdi-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-pdi').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarPDI('${id}')">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  // ---------- RESULTADOS DO CICLO (gestor) ----------

  async verResultadosCiclo(cicloId) {
    const doc = await db.collection('ciclos').doc(cicloId).get();
    const ciclo = { id: doc.id, ...doc.data() };
    const avaliacoes = ciclo.avaliacoes || {};

    // Coleta UIDs únicos avaliados
    const uids = [...new Set(
      Object.keys(avaliacoes).map(k => k.replace(/_auto|_gestor|_360_\w+/g, ''))
    )];

    // Busca nomes
    const nomes = {};
    for (const uid of uids) {
      const u = await db.collection('usuarios').doc(uid).get();
      if (u.exists) nomes[uid] = u.data().nome;
    }

    // Calcula médias por colaborador
    const resultados = uids.map(uid => {
      const auto   = avaliacoes[uid + '_auto']?.nota;
      const gestor = avaliacoes[uid + '_gestor']?.nota;
      // Média das notas 360 disponíveis
      const notas360 = Object.entries(avaliacoes)
        .filter(([k]) => k.startsWith(uid + '_360_'))
        .map(([, v]) => v.nota);
      const media360 = notas360.length ? notas360.reduce((a,b) => a+b, 0) / notas360.length : null;

      const partes = [auto, gestor, media360].filter(v => v !== null && v !== undefined);
      const media = partes.length ? partes.reduce((a,b) => a+b, 0) / partes.length : null;

      return { uid, nome: nomes[uid] || uid, auto, gestor, media360, media };
    });

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-resultados';
    overlay.innerHTML = `
      <div class="modal" style="max-width:600px">
        <div class="modal-header">
          <h3>Resultados — ${ciclo.nome}</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-resultados').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">
          <table class="table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Autoav.</th>
                <th>Gestor</th>
                <th>360°</th>
                <th>Média final</th>
              </tr>
            </thead>
            <tbody>
              ${resultados.map(r => `
                <tr>
                  <td>${r.nome}</td>
                  <td>${r.auto != null ? r.auto.toFixed(1) : '—'}</td>
                  <td>${r.gestor != null ? r.gestor.toFixed(1) : '—'}</td>
                  <td>${r.media360 != null ? r.media360.toFixed(1) : '—'}</td>
                  <td><strong>${r.media != null ? r.media.toFixed(1) : '—'}</strong></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" onclick="document.getElementById('modal-resultados').remove()">Fechar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
};
