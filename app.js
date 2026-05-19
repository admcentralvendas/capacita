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

          <!-- Abas -->
          <div class="login-tabs">
            <button class="login-tab active" id="tab-entrar" onclick="App.switchLoginTab('entrar')">Entrar</button>
            <button class="login-tab" id="tab-cadastro" onclick="App.switchLoginTab('cadastro')">Primeiro acesso</button>
          </div>

          <!-- Painel Entrar -->
          <div id="painel-entrar">
            <input class="inp" type="email" id="inp-email" placeholder="E-mail" onkeydown="if(event.key==='Enter')App.loginEmail()">
            <input class="inp" type="password" id="inp-senha" placeholder="Senha" onkeydown="if(event.key==='Enter')App.loginEmail()" style="margin-top:10px">
            <p id="login-erro" style="color:#E24B4A;font-size:13px;margin:6px 0 0;min-height:16px"></p>
            <button class="btn-primary" onclick="App.loginEmail()" style="width:100%;justify-content:center;margin-top:4px">Entrar</button>
            <p style="font-size:12px;color:var(--text-3);text-align:center;margin-top:14px;cursor:pointer" onclick="App.abrirRecuperacao()">
              Esqueci minha senha
            </p>
          </div>

          <!-- Painel Primeiro acesso -->
          <div id="painel-cadastro" style="display:none">
            <p style="font-size:13px;color:var(--text-2);margin-bottom:14px">
              Use o e-mail cadastrado pelo seu gestor para criar sua senha.
            </p>
            <input class="inp" type="email" id="cad-email" placeholder="E-mail cadastrado">
            <input class="inp" type="password" id="cad-senha" placeholder="Criar senha" style="margin-top:10px" onkeydown="if(event.key==='Enter')App.doCadastro()">
            <input class="inp" type="password" id="cad-confirma" placeholder="Confirmar senha" style="margin-top:10px" onkeydown="if(event.key==='Enter')App.doCadastro()">
            <p id="cad-erro" style="color:#E24B4A;font-size:13px;margin:6px 0 0;min-height:16px"></p>
            <button class="btn-primary" onclick="App.doCadastro()" style="width:100%;justify-content:center;margin-top:8px">Criar acesso</button>
          </div>
        </div>
      </div>
    `;
  },

  switchLoginTab(tab) {
    document.getElementById('painel-entrar').style.display  = tab === 'entrar'   ? 'block' : 'none';
    document.getElementById('painel-cadastro').style.display = tab === 'cadastro' ? 'block' : 'none';
    document.getElementById('tab-entrar').classList.toggle('active',  tab === 'entrar');
    document.getElementById('tab-cadastro').classList.toggle('active', tab === 'cadastro');
  },

  async doCadastro() {
    const email    = document.getElementById('cad-email').value.trim();
    const senha    = document.getElementById('cad-senha').value;
    const confirma = document.getElementById('cad-confirma').value;
    const erro     = document.getElementById('cad-erro');

    if (!email)            { erro.textContent = 'Informe o e-mail.'; return; }
    if (senha.length < 6)  { erro.textContent = 'A senha deve ter pelo menos 6 caracteres.'; return; }
    if (senha !== confirma){ erro.textContent = 'As senhas não coincidem.'; return; }

    erro.textContent = 'Verificando...';

    try {
      // Verifica se o e-mail foi pré-cadastrado pelo gestor no Firestore
      const snap = await db.collection('usuarios')
        .where('email', '==', email.toLowerCase())
        .where('ativo', '==', false)
        .get();

      if (snap.empty) {
        // Tenta também sem o campo ativo (compatibilidade)
        const snap2 = await db.collection('usuarios')
          .where('email', '==', email.toLowerCase())
          .get();
        if (snap2.empty) {
          erro.textContent = 'E-mail não encontrado. Solicite o cadastro ao seu gestor.';
          return;
        }
        // Verifica se já tem Auth (já ativado)
        const perfil = snap2.docs[0].data();
        if (perfil.uid && perfil.uid !== perfil.email.replace(/[^a-zA-Z0-9]/g,'_')) {
          erro.textContent = 'Este e-mail já tem acesso ativo. Use a aba "Entrar".';
          return;
        }
      }

      // Perfil encontrado — cria usuário no Firebase Auth
      const docSnap = snap.empty
        ? (await db.collection('usuarios').where('email', '==', email.toLowerCase()).get()).docs[0]
        : snap.docs[0];

      const cred = await auth.createUserWithEmailAndPassword(email, senha);
      const uid  = cred.user.uid;

      // Atualiza o perfil com o uid real e marca como ativo
      await db.collection('usuarios').doc(docSnap.id).update({
        uid,
        ativo: true,
        ativadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Se o documento estava com id provisório, cria novo com uid correto
      if (docSnap.id !== uid) {
        const dadosAtuais = (await db.collection('usuarios').doc(docSnap.id).get()).data();
        await db.collection('usuarios').doc(uid).set({ ...dadosAtuais, uid });
        await db.collection('usuarios').doc(docSnap.id).delete();
      }

      erro.textContent = '';
      // Auth listener vai chamar renderApp automaticamente

    } catch(e) {
      if (e.code === 'auth/email-already-in-use') {
        erro.textContent = 'Este e-mail já tem acesso ativo. Use a aba "Entrar".';
      } else {
        erro.textContent = 'Erro: ' + e.message;
      }
    }
  },

  abrirRecuperacao() {
    auth.sendPasswordResetEmail(document.getElementById('inp-email')?.value || '')
      .then(() => alert('E-mail de recuperação enviado! Verifique sua caixa de entrada.'))
      .catch(() => {
        const email = prompt('Informe seu e-mail para recuperação:');
        if (email) auth.sendPasswordResetEmail(email)
          .then(() => alert('E-mail enviado!'))
          .catch(e => alert('Erro: ' + e.message));
      });
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
            <tr><th>Tipo</th><th>Data</th><th>Período</th><th>Observação</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${lista.length === 0
              ? `<tr><td colspan="6" class="empty-row">Nenhuma solicitação ainda</td></tr>`
              : lista.map(s => `
                <tr>
                  <td><span class="tipo-pill tipo-${s.tipo}">${App.tipoLabel(s.tipo)}</span></td>
                  <td>${App.formatDate(s.data_inicio)}</td>
                  <td>${s.modo === 'horario' ? s.hora_inicio + ' – ' + s.hora_fim + ' (' + s.horas + 'h)' : s.dias + ' dia' + (s.dias !== 1 ? 's' : '')}</td>
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
          <select class="inp" id="sol-tipo" onchange="Solicitacoes.onTipoChange()">
            <option value="ferias">Férias</option>
            <option value="folga">Folga avulsa</option>
            <option value="atestado">Atestado médico</option>
            <option value="banco_horas">Compensação banco de horas</option>
          </select>

          <label class="form-label" style="margin-top:12px">Período</label>
          <div style="display:flex;gap:10px;margin-bottom:10px">
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
              <input type="radio" name="sol-periodo" id="rad-dia" value="dia" checked onchange="Solicitacoes.onPeriodoChange()"> Dia(s) inteiro(s)
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer" id="lbl-horas-rad">
              <input type="radio" name="sol-periodo" id="rad-horas" value="horas" onchange="Solicitacoes.onPeriodoChange()"> Horário específico
            </label>
          </div>

          <!-- Modo dia inteiro -->
          <div id="bloco-dias">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
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
          </div>

          <!-- Modo horário específico -->
          <div id="bloco-horas" style="display:none">
            <div>
              <label class="form-label">Data</label>
              <input class="inp" type="date" id="sol-data-hora">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
              <div>
                <label class="form-label">Hora início</label>
                <input class="inp" type="time" id="sol-hora-ini" value="08:00">
              </div>
              <div>
                <label class="form-label">Hora fim</label>
                <input class="inp" type="time" id="sol-hora-fim" value="12:00">
              </div>
            </div>
            <div id="sol-horas-info" style="font-size:13px;color:#6B6B66;margin:8px 0 0;min-height:20px"></div>
          </div>

          <label class="form-label" style="margin-top:12px">Observação <span style="font-weight:400;color:#A0A09A">(opcional)</span></label>
          <textarea class="inp" id="sol-obs" rows="2" placeholder="Informe mais detalhes se necessário..."></textarea>
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
    ['sol-hora-ini', 'sol-hora-fim', 'sol-data-hora'].forEach(id => {
      document.getElementById(id).addEventListener('change', Solicitacoes.updateHoras);
    });
  },

  onTipoChange() {
    const tipo = document.getElementById('sol-tipo').value;
    const lblHoras = document.getElementById('lbl-horas-rad');
    // Férias só permite dias inteiros
    if (tipo === 'ferias') {
      document.getElementById('rad-dia').checked = true;
      Solicitacoes.onPeriodoChange();
      if (lblHoras) lblHoras.style.opacity = '0.4';
    } else {
      if (lblHoras) lblHoras.style.opacity = '1';
    }
  },

  onPeriodoChange() {
    const isDia = document.getElementById('rad-dia').checked;
    document.getElementById('bloco-dias').style.display = isDia ? 'block' : 'none';
    document.getElementById('bloco-horas').style.display = isDia ? 'none' : 'block';
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

  updateHoras() {
    const ini = document.getElementById('sol-hora-ini').value;
    const fim = document.getElementById('sol-hora-fim').value;
    const info = document.getElementById('sol-horas-info');
    if (ini && fim) {
      const [hi, mi] = ini.split(':').map(Number);
      const [hf, mf] = fim.split(':').map(Number);
      const totalMin = (hf * 60 + mf) - (hi * 60 + mi);
      if (totalMin > 0) {
        const h = Math.floor(totalMin / 60), m = totalMin % 60;
        info.textContent = `${h}h${m > 0 ? m + 'min' : ''} solicitado(s)`;
      } else {
        info.textContent = '';
      }
    }
  },

  async enviar() {
    const tipo   = document.getElementById('sol-tipo').value;
    const obs    = document.getElementById('sol-obs').value.trim();
    const erro   = document.getElementById('sol-erro');
    const isDia  = document.getElementById('rad-dia').checked;
    const u      = App.currentUserData;
    let dados    = {};

    if (isDia) {
      const inicio = document.getElementById('sol-inicio').value;
      const fim    = document.getElementById('sol-fim').value;
      if (!inicio || !fim) { erro.textContent = 'Preencha as datas.'; return; }
      if (fim < inicio)    { erro.textContent = 'A data fim deve ser após a data início.'; return; }
      const dias = App.daysBetween(inicio, fim);
      if (tipo === 'ferias' && dias > u.saldo_ferias) {
        erro.textContent = `Saldo insuficiente. Você tem ${u.saldo_ferias} dias de férias.`; return;
      }
      if (tipo === 'folga' && dias > u.saldo_folgas) {
        erro.textContent = `Saldo insuficiente. Você tem ${u.saldo_folgas} dia(s) de folga.`; return;
      }
      dados = { data_inicio: inicio, data_fim: fim, dias, modo: 'dia_inteiro' };
    } else {
      const data    = document.getElementById('sol-data-hora').value;
      const horaIni = document.getElementById('sol-hora-ini').value;
      const horaFim = document.getElementById('sol-hora-fim').value;
      if (!data || !horaIni || !horaFim) { erro.textContent = 'Preencha data e horários.'; return; }
      const [hi, mi] = horaIni.split(':').map(Number);
      const [hf, mf] = horaFim.split(':').map(Number);
      const totalMin = (hf * 60 + mf) - (hi * 60 + mi);
      if (totalMin <= 0) { erro.textContent = 'Hora fim deve ser após a hora início.'; return; }
      const horas = +(totalMin / 60).toFixed(2);
      dados = { data_inicio: data, data_fim: data, dias: 0, horas, hora_inicio: horaIni, hora_fim: horaFim, modo: 'horario' };
    }

    erro.textContent = '';
    try {
      await db.collection('solicitacoes').add({
        uid: u.uid, nome: u.nome,
        funcao: u.funcao || '', setor: u.setor || '', departamento: u.departamento || '',
        tipo, observacao: obs, status: 'pendente',
        ...dados,
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
    const usuarios = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => !setor || u.setor === setor);

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Equipe</h1>
          <p class="page-sub">${usuarios.length} colaborador${usuarios.length !== 1 ? 'es' : ''}${setor ? ' · ' + setor : ''}</p>
        </div>
        <button class="btn-primary" onclick="Equipe.openNovoColaborador()">
          <i class="ti ti-user-plus"></i> Novo colaborador
        </button>
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
            </div>
            <button class="btn-secondary" style="width:100%;margin-top:8px;font-size:12px"
              onclick="Equipe.editarColaborador('${u.id}')">
              <i class="ti ti-edit"></i> Editar
            </button>
          </div>`).join('')}
      </div>
    `;
  },

  openNovoColaborador() {
    const setor = App.meuSetor();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-novo-colab';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Novo colaborador</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-novo-colab').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--text-2);margin-bottom:16px">
            Cadastre o colaborador. Ele receberá um e-mail para criar a senha no primeiro acesso.
          </p>
          <label class="form-label">Nome completo</label>
          <input class="inp" id="nc-nome" placeholder="Nome do colaborador">

          <label class="form-label" style="margin-top:12px">E-mail</label>
          <input class="inp" type="email" id="nc-email" placeholder="email@empresa.com">

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div>
              <label class="form-label">Função</label>
              <input class="inp" id="nc-funcao" placeholder="Ex: Consultor">
            </div>
            <div>
              <label class="form-label">Setor</label>
              <input class="inp" id="nc-setor" value="${setor}" placeholder="Setor">
            </div>
          </div>

          <label class="form-label" style="margin-top:12px">Departamento</label>
          <input class="inp" id="nc-depto" placeholder="Ex: Comercial">

          <label class="form-label" style="margin-top:12px">Papel</label>
          <select class="inp" id="nc-papel">
            <option value="colaborador">Colaborador</option>
            <option value="gestor">Gestor</option>
          </select>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div>
              <label class="form-label">Saldo férias (dias)</label>
              <input class="inp" type="number" id="nc-ferias" value="30">
            </div>
            <div>
              <label class="form-label">Saldo folgas (dias)</label>
              <input class="inp" type="number" id="nc-folgas" value="0">
            </div>
          </div>

          <label class="form-label" style="margin-top:12px">Data de admissão</label>
          <input class="inp" type="date" id="nc-admissao">

          <div style="margin-top:14px;padding:12px;background:#F5F4F0;border-radius:8px;font-size:12px;color:#6B6B66">
            <i class="ti ti-info-circle"></i> Uma senha provisória será gerada. O colaborador poderá alterá-la no primeiro acesso.
          </div>
          <p id="nc-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-novo-colab').remove()">Cancelar</button>
          <button class="btn-primary" id="nc-btn" onclick="Equipe.salvarNovoColaborador()">Cadastrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async salvarNovoColaborador() {
    const nome     = document.getElementById('nc-nome').value.trim();
    const email    = document.getElementById('nc-email').value.trim();
    const funcao   = document.getElementById('nc-funcao').value.trim();
    const setor    = document.getElementById('nc-setor').value.trim();
    const depto    = document.getElementById('nc-depto').value.trim();
    const papel    = document.getElementById('nc-papel').value;
    const ferias   = parseInt(document.getElementById('nc-ferias').value) || 30;
    const folgas   = parseInt(document.getElementById('nc-folgas').value) || 0;
    const admissao = document.getElementById('nc-admissao').value;
    const erro     = document.getElementById('nc-erro');
    const btn      = document.getElementById('nc-btn');

    if (!nome)  { erro.textContent = 'Informe o nome.'; return; }
    if (!email) { erro.textContent = 'Informe o e-mail.'; return; }

    btn.disabled = true;
    btn.textContent = 'Cadastrando...';

    try {
      // Verifica se e-mail já existe
      const existe = await db.collection('usuarios')
        .where('email', '==', email.toLowerCase()).get();
      if (!existe.empty) {
        erro.textContent = 'Este e-mail já está cadastrado.';
        btn.disabled = false;
        btn.textContent = 'Cadastrar';
        return;
      }

      // Salva perfil no Firestore com id provisório baseado no e-mail
      // NÃO cria no Firebase Auth — colaborador fará isso no primeiro acesso
      const idProvisorio = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      await db.collection('usuarios').doc(idProvisorio).set({
        uid: idProvisorio,
        nome, email: email.toLowerCase(), foto: '',
        funcao, setor, departamento: depto,
        papel, saldo_ferias: ferias, saldo_folgas: folgas,
        banco_horas: 0,
        ativo: false,
        admissao: admissao || new Date().toISOString().split('T')[0],
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      document.getElementById('modal-novo-colab').remove();
      alert(`Colaborador cadastrado! Oriente ${nome} a acessar o Capacita, clicar em "Primeiro acesso" e usar o e-mail ${email} para criar a senha.`);
      this.render();
    } catch(e) {
      erro.textContent = 'Erro: ' + e.message;
      btn.disabled = false;
      btn.textContent = 'Cadastrar';
    }
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

// =============================================
//  MÓDULO — DESENVOLVIMENTO
//  Ciclos, 360°, Feedbacks, PDI
// =============================================

const Desenvolvimento = {

  // ─── RENDER PRINCIPAL ───────────────────────

  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando...</div>`;

    const uid = App.currentUser.uid;
    const isGestor = App.currentUserData.papel === 'gestor' || App.currentUserData.papel === 'admin';
    const setor = App.currentUserData.setor || '';

    // Ciclos do setor
    const ciclosSnap = await db.collection('ciclos').where('setor', '==', setor).get();
    const todosCiclos = ciclosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const ciclosAtivos = todosCiclos.filter(c => c.status !== 'encerrado');

    // Avaliações 360 pendentes para MIM
    const pendSnap = await db.collection('avaliacoes_360')
      .where('avaliador_uid', '==', uid)
      .where('status', '==', 'pendente')
      .get();
    const pendentes360 = pendSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Feedbacks recebidos (colaborador vê os próprios; gestor vê os da equipe)
    let feedbacks = [];
    if (isGestor) {
      // Busca uids da equipe
      const equipSnap = await db.collection('usuarios').get();
      const equipUids = equipSnap.docs
        .map(d => d.data())
        .filter(u => !setor || u.setor === setor)
        .map(u => u.uid);
      // Firestore não suporta where-in com mais de 10; busca todos e filtra
      const fbAll = await db.collection('feedbacks').get();
      feedbacks = fbAll.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(f => equipUids.includes(f.destinatario_uid))
        .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
      // Enriquece com nome do destinatário
      const nomeMap = {};
      equipSnap.docs.forEach(d => { nomeMap[d.data().uid] = d.data().nome; });
      feedbacks = feedbacks.map(f => ({ ...f, destinatario_nome: nomeMap[f.destinatario_uid] || '?' }));
    } else {
      const fbSnap = await db.collection('feedbacks').where('destinatario_uid', '==', uid).get();
      feedbacks = fbSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
    }

    // PDIs do usuário
    const pdiSnap = await db.collection('pdis').where('uid', '==', uid).get();
    const pdis = pdiSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Desenvolvimento</h1>
          <p class="page-sub">Ciclos de avaliação, feedbacks e PDI${setor ? ' · ' + setor : ''}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-secondary" onclick="Desenvolvimento.openFeedback()">
            <i class="ti ti-message-circle"></i> Dar feedback
          </button>
          ${isGestor ? `
          <button class="btn-primary" onclick="Desenvolvimento.openNovoCiclo()">
            <i class="ti ti-plus"></i> Novo ciclo
          </button>` : ''}
        </div>
      </div>

      ${pendentes360.length > 0 ? `
      <div class="alerta-card">
        <i class="ti ti-bell" style="color:var(--warning)"></i>
        <span>Você tem <strong>${pendentes360.length}</strong> avaliação${pendentes360.length > 1 ? 'ões' : ''} 360° pendente${pendentes360.length > 1 ? 's' : ''}</span>
        <button class="btn-primary" style="margin-left:auto" onclick="Desenvolvimento.openPendentes360()">Responder</button>
      </div>` : ''}

      <!-- CICLOS -->
      <div class="dev-section">
        <h2 class="dev-section-title"><i class="ti ti-refresh"></i> Ciclos de avaliação</h2>
        ${ciclosAtivos.length === 0
          ? `<p class="dev-empty">Nenhum ciclo ativo${isGestor ? ' — crie um novo ciclo para sua equipe' : ''}</p>`
          : ciclosAtivos.map(c => Desenvolvimento.renderCicloCard(c, isGestor, uid)).join('')}
      </div>

      <!-- FEEDBACKS -->
      <div class="dev-section">
        <h2 class="dev-section-title">
          <i class="ti ti-messages"></i>
          ${isGestor ? 'Feedbacks da equipe' : 'Feedbacks recebidos'}
          ${feedbacks.length > 0 ? `<span class="fb-count">${feedbacks.length}</span>` : ''}
          ${isGestor && feedbacks.length > 5 ? `<button class="btn-icon" style="margin-left:auto;font-size:12px" onclick="Desenvolvimento.verTodosFeedbacks()"><i class="ti ti-eye"></i> Ver todos</button>` : ''}
        </h2>
        ${feedbacks.length === 0
          ? `<p class="dev-empty">${isGestor ? 'Nenhum feedback registrado na equipe ainda' : 'Nenhum feedback recebido ainda'}</p>`
          : feedbacks.slice(0, isGestor ? 10 : 5).map(f => `
            <div class="feedback-card">
              <div class="feedback-header">
                <div style="display:flex;align-items:center;gap:8px">
                  ${isGestor ? `<span class="feedback-destinatario">${f.destinatario_nome}</span><span style="color:var(--text-3)">·</span>` : ''}
                  <span class="feedback-tipo">${f.tipo === 'positivo' ? '👍 Positivo' : f.tipo === 'melhoria' ? '💡 Melhoria' : '💬 Geral'}</span>
                </div>
                <span class="feedback-data">${Desenvolvimento.fmtTs(f.criadoEm)}</span>
              </div>
              <p class="feedback-texto">${f.mensagem}</p>
              <p class="feedback-de">— Anônimo</p>
            </div>`).join('')}
      </div>

      <!-- PDI -->
      <div class="dev-section">
        <h2 class="dev-section-title"><i class="ti ti-road"></i> Plano de Desenvolvimento Individual</h2>
        <button class="btn-secondary" style="margin-bottom:14px" onclick="Desenvolvimento.openNovoPDI()">
          <i class="ti ti-plus"></i> Nova meta
        </button>
        ${pdis.length === 0
          ? `<p class="dev-empty">Nenhuma meta cadastrada</p>`
          : pdis.map(p => `
            <div class="pdi-card">
              <div class="pdi-header">
                <span class="pdi-titulo">${p.titulo}</span>
                <span class="badge ${p.status === 'concluido' ? 'badge-success' : p.status === 'em_andamento' ? 'badge-warning' : 'badge-default'}">
                  ${p.status === 'concluido' ? 'Concluído' : p.status === 'em_andamento' ? 'Em andamento' : 'Pendente'}
                </span>
              </div>
              ${p.descricao ? `<p class="pdi-desc">${p.descricao}</p>` : ''}
              <div class="pdi-footer">
                <span><i class="ti ti-calendar"></i> Prazo: ${p.prazo ? App.formatDate(p.prazo) : '—'}</span>
                <button class="btn-icon" onclick="Desenvolvimento.editarPDI('${p.id}')"><i class="ti ti-edit"></i></button>
              </div>
            </div>`).join('')}
      </div>
    `;
  },

  // ─── CARD DO CICLO ──────────────────────────

  renderCicloCard(ciclo, isGestor, uid) {
    const config360 = ciclo.config_360 || {};
    const meusPares = config360[uid] || [];
    const etapaAtual = ciclo.etapa_atual || 'autoavaliacao';
    const autoFeita = !!(ciclo.avaliacoes?.[uid + '_auto']);
    const jaAvalieiGestor = isGestor && !!(ciclo.avaliacoes_gestor?.[uid]);

    // Progresso geral do ciclo
    const totalColab = Object.keys(config360).length;
    const conclGestor = Object.keys(ciclo.avaliacoes_gestor || {}).length;

    return `
      <div class="ciclo-card">
        <div class="ciclo-header">
          <div>
            <p class="ciclo-nome">${ciclo.nome}</p>
            <p class="ciclo-periodo">${ciclo.periodo || ''}</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="badge ${ciclo.status === 'aberto' ? 'badge-success' : ciclo.status === 'em_andamento' ? 'badge-warning' : 'badge-default'}">
              ${ciclo.status === 'aberto' ? 'Aberto' : ciclo.status === 'em_andamento' ? 'Em andamento' : ciclo.status}
            </span>
            ${isGestor ? `<button class="btn-icon" onclick="Desenvolvimento.verPainelCiclo('${ciclo.id}')" title="Painel do ciclo"><i class="ti ti-layout-dashboard"></i></button>` : ''}
          </div>
        </div>

        <!-- Etapas visuais -->
        <div class="ciclo-etapas">
          ${[
            { key: 'auto', label: 'Autoavaliação' },
            { key: '360', label: 'Avaliação 360°' },
            { key: 'gestor', label: 'Avaliação do gestor' },
            { key: 'resultado', label: 'Resultado' }
          ].map((e, i) => {
            const concluida = ciclo.etapas_concluidas?.includes(e.key);
            const ativa = etapaAtual === e.key;
            return `<div class="etapa-item ${ativa ? 'ativa' : ''} ${concluida ? 'concluida' : ''}">
              <div class="etapa-dot">${concluida ? '✓' : i + 1}</div>
              <span>${e.label}</span>
            </div>`;
          }).join('<div class="etapa-linha"></div>')}
        </div>

        <!-- Ações do colaborador -->
        ${!isGestor ? `
          <div class="ciclo-actions">
            ${!autoFeita && etapaAtual === 'auto'
              ? `<button class="btn-primary" onclick="Desenvolvimento.openAutoavaliacao('${ciclo.id}')">
                  <i class="ti ti-pencil"></i> Fazer autoavaliação
                 </button>`
              : autoFeita
                ? `<span style="font-size:13px;color:var(--success)"><i class="ti ti-check"></i> Autoavaliação concluída</span>`
                : ''
            }
            ${ciclo.resultados_liberados?.[uid]
              ? `<button class="btn-secondary" onclick="Desenvolvimento.verMeuResultado('${ciclo.id}')">
                  <i class="ti ti-chart-bar"></i> Ver meu resultado
                 </button>`
              : ''
            }
          </div>` : ''}

        <!-- Ações do gestor -->
        ${isGestor ? `
          <div class="ciclo-actions">
            ${ciclo.status === 'aberto'
              ? `<button class="btn-secondary" onclick="Desenvolvimento.openConfigurar360('${ciclo.id}')">
                  <i class="ti ti-settings"></i> Configurar avaliadores
                 </button>`
              : ''
            }
            ${totalColab > 0
              ? `<span style="font-size:12px;color:var(--text-2)">
                  ${conclGestor}/${totalColab} avaliações do gestor concluídas
                 </span>`
              : ''
            }
          </div>` : ''}
      </div>`;
  },

  // ─── NOVO CICLO ─────────────────────────────

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
          <div style="margin-top:14px;padding:12px;background:#F5F4F0;border-radius:8px;font-size:13px;color:#6B6B66">
            <strong>Fluxo do ciclo:</strong><br>
            1. Colaborador faz autoavaliação<br>
            2. Pares selecionados avaliam anonimamente (3–5 por colaborador)<br>
            3. Quando todos os pares respondem → gestor avalia aquele colaborador<br>
            4. Gestor conclui → resultado liberado com feedback e PDI
          </div>
          <p id="ciclo-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-ciclo').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.criarCiclo()">Criar ciclo</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  async criarCiclo() {
    const nome    = document.getElementById('ciclo-nome').value.trim();
    const periodo = document.getElementById('ciclo-periodo').value.trim();
    const erro    = document.getElementById('ciclo-erro');
    if (!nome) { erro.textContent = 'Informe o nome do ciclo.'; return; }

    await db.collection('ciclos').add({
      nome, periodo,
      setor: App.meuSetor(),
      criado_por: App.currentUser.uid,
      status: 'aberto',
      etapa_atual: 'auto',
      etapas_concluidas: [],
      config_360: {},
      avaliacoes: {},
      avaliacoes_gestor: {},
      resultados_liberados: {},
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('modal-ciclo').remove();
    this.render();
  },

  // ─── CONFIGURAR AVALIADORES 360° ────────────

  async openConfigurar360(cicloId) {
    const setor = App.meuSetor();
    const snap = await db.collection('usuarios').get();
    const equipe = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(u => !setor || u.setor === setor);

    const cicloDoc = await db.collection('ciclos').doc(cicloId).get();
    const ciclo = cicloDoc.data();
    const config360 = ciclo.config_360 || {};

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-conf360';
    overlay.innerHTML = `
      <div class="modal" style="max-width:600px">
        <div class="modal-header">
          <h3>Configurar avaliadores 360°</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-conf360').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="max-height:65vh;overflow-y:auto">
          <p style="font-size:13px;color:var(--text-2);margin-bottom:16px">
            Para cada colaborador, selecione de 3 a 5 pares que o avaliarão anonimamente.
          </p>
          ${equipe.map(u => `
            <div style="margin-bottom:18px;padding:14px;border:1px solid var(--border);border-radius:var(--radius)">
              <p style="font-weight:600;font-size:13px;margin-bottom:8px">${u.nome} <span style="font-weight:400;color:var(--text-3)">${u.funcao ? '· ' + u.funcao : ''}</span></p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                ${equipe.filter(p => p.uid !== u.uid).map(p => `
                  <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
                    <input type="checkbox" class="cb-360-${u.uid}" value="${p.uid}"
                      ${(config360[u.uid] || []).includes(p.uid) ? 'checked' : ''}>
                    ${p.nome}
                  </label>`).join('')}
              </div>
              <p class="count-360-${u.uid}" style="font-size:11px;color:var(--text-3);margin-top:6px">
                ${(config360[u.uid] || []).length} selecionado(s)
              </p>
            </div>`).join('')}
          <p id="conf360-erro" style="color:#E24B4A;font-size:13px;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-conf360').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarConf360('${cicloId}')">Salvar e iniciar ciclo</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    // Atualiza contadores
    equipe.forEach(u => {
      document.querySelectorAll(`.cb-360-${u.uid}`).forEach(cb => {
        cb.addEventListener('change', () => {
          const total = document.querySelectorAll(`.cb-360-${u.uid}:checked`).length;
          const p = document.querySelector(`.count-360-${u.uid}`);
          if (p) p.textContent = `${total} selecionado(s)`;
          if (total > 5) cb.checked = false;
        });
      });
    });
  },

  async salvarConf360(cicloId) {
    const setor = App.meuSetor();
    const snap = await db.collection('usuarios').get();
    const equipe = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(u => !setor || u.setor === setor);

    const erro = document.getElementById('conf360-erro');
    const config360 = {};

    for (const u of equipe) {
      const selecionados = [...document.querySelectorAll(`.cb-360-${u.uid}:checked`)].map(c => c.value);
      if (selecionados.length > 0 && (selecionados.length < 3 || selecionados.length > 5)) {
        erro.textContent = `${u.nome}: selecione entre 3 e 5 avaliadores (ou nenhum).`;
        return;
      }
      if (selecionados.length >= 3) config360[u.uid] = selecionados;
    }

    if (Object.keys(config360).length === 0) {
      erro.textContent = 'Configure pelo menos um colaborador.';
      return;
    }

    // Salva config e muda status para em_andamento
    await db.collection('ciclos').doc(cicloId).update({
      config_360: config360,
      status: 'em_andamento',
      etapa_atual: 'auto'
    });

    document.getElementById('modal-conf360').remove();
    this.render();
  },

  // ─── AUTOAVALIAÇÃO ──────────────────────────

  openAutoavaliacao(cicloId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-auto';
    overlay.innerHTML = `
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3>Autoavaliação</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-auto').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="max-height:65vh;overflow-y:auto">
          <p style="font-size:13px;color:var(--text-2);margin-bottom:16px">Avalie seu desempenho com honestidade. Suas respostas só serão visíveis após o ciclo completo.</p>
          ${this.renderCriterios('auto')}
          <label class="form-label" style="margin-top:16px">Comentário livre (opcional)</label>
          <textarea class="inp" id="auto-coment" rows="3" placeholder="Pontos que você gostaria de destacar..."></textarea>
          <p id="auto-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-auto').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarAutoavaliacao('${cicloId}')">Enviar autoavaliação</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  renderCriterios(pfx) {
    const criterios = [
      { id: 'entrega',      label: 'Entrega de resultados' },
      { id: 'comunicacao',  label: 'Comunicação e colaboração' },
      { id: 'iniciativa',   label: 'Iniciativa e proatividade' },
      { id: 'tecnico',      label: 'Conhecimento técnico' },
    ];
    return criterios.map(c => `
      <div style="margin-bottom:14px">
        <label class="form-label">${c.label}</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="range" id="${pfx}-${c.id}" min="0" max="10" step="0.5" value="7" style="flex:1"
            oninput="document.getElementById('${pfx}-${c.id}-val').textContent=this.value">
          <span id="${pfx}-${c.id}-val" style="font-size:15px;font-weight:600;min-width:28px;text-align:right">7</span>
        </div>
      </div>`).join('');
  },

  calcMedia(pfx) {
    return ['entrega','comunicacao','iniciativa','tecnico']
      .map(id => parseFloat(document.getElementById(`${pfx}-${id}`)?.value || 0))
      .reduce((a, b) => a + b, 0) / 4;
  },

  async salvarAutoavaliacao(cicloId) {
    const uid = App.currentUser.uid;
    const nota = this.calcMedia('auto');
    const comentario = document.getElementById('auto-coment').value.trim();

    await db.collection('ciclos').doc(cicloId).update({
      [`avaliacoes.${uid}_auto`]: { nota, comentario, criadoEm: new Date().toISOString() }
    });

    // Cria solicitações 360 para os pares desse colaborador
    const cicloDoc = await db.collection('ciclos').doc(cicloId).get();
    const pares = cicloDoc.data().config_360?.[uid] || [];
    for (const parUid of pares) {
      await db.collection('avaliacoes_360').add({
        ciclo_id: cicloId,
        avaliado_uid: uid,
        avaliador_uid: parUid,
        status: 'pendente',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    document.getElementById('modal-auto').remove();
    this.render();
  },

  // ─── AVALIAÇÃO 360° (pares respondem) ───────

  async openPendentes360() {
    const uid = App.currentUser.uid;
    const snap = await db.collection('avaliacoes_360')
      .where('avaliador_uid', '==', uid)
      .where('status', '==', 'pendente')
      .get();
    const pendentes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (pendentes.length === 0) { this.render(); return; }

    // Pega o primeiro pendente
    const aval = pendentes[0];
    const avaliadoDoc = await db.collection('usuarios').doc(aval.avaliado_uid).get();
    const avaliado = avaliadoDoc.data();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-360resp';
    overlay.innerHTML = `
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3>Avaliação 360° — ${avaliado?.nome || 'Colega'}</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-360resp').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="max-height:65vh;overflow-y:auto">
          <p style="font-size:13px;color:var(--text-2);margin-bottom:4px">Avalie o desempenho de <strong>${avaliado?.nome || 'seu colega'}</strong>.</p>
          <p style="font-size:12px;color:var(--text-3);margin-bottom:16px"><i class="ti ti-lock"></i> Sua identidade não será revelada.</p>
          ${this.renderCriterios('p360')}
          <label class="form-label" style="margin-top:16px">Comentário (opcional)</label>
          <textarea class="inp" id="p360-coment" rows="3" placeholder="Observações sobre o colega..."></textarea>
          <p style="font-size:12px;color:var(--text-3);margin-top:6px">${pendentes.length} avaliação${pendentes.length > 1 ? 'ões' : ''} pendente${pendentes.length > 1 ? 's' : ''}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-360resp').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvar360Resp('${aval.id}', '${aval.ciclo_id}', '${aval.avaliado_uid}')">Enviar avaliação</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  async salvar360Resp(avalId, cicloId, avaliadoUid) {
    const nota = this.calcMedia('p360');
    const comentario = document.getElementById('p360-coment').value.trim();
    const avaliadorUid = App.currentUser.uid;

    // Marca como concluída
    await db.collection('avaliacoes_360').doc(avalId).update({
      status: 'concluido',
      nota, comentario,
      concluidoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Verifica se todos os pares desse colaborador já responderam
    const cicloDoc = await db.collection('ciclos').doc(cicloId).get();
    const pares = cicloDoc.data().config_360?.[avaliadoUid] || [];

    const restSnap = await db.collection('avaliacoes_360')
      .where('ciclo_id', '==', cicloId)
      .where('avaliado_uid', '==', avaliadoUid)
      .where('status', '==', 'pendente')
      .get();

    if (restSnap.empty) {
      // Todos os pares responderam — calcula média 360 e libera etapa do gestor
      const todasSnap = await db.collection('avaliacoes_360')
        .where('ciclo_id', '==', cicloId)
        .where('avaliado_uid', '==', avaliadoUid)
        .get();
      const notas = todasSnap.docs.map(d => d.data().nota).filter(n => n != null);
      const media360 = notas.reduce((a, b) => a + b, 0) / notas.length;

      await db.collection('ciclos').doc(cicloId).update({
        [`media_360.${avaliadoUid}`]: media360,
        [`pronto_para_gestor.${avaliadoUid}`]: true
      });
    }

    document.getElementById('modal-360resp').remove();
    this.render();
  },

  // ─── PAINEL DO CICLO (gestor) ────────────────

  async verPainelCiclo(cicloId) {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando painel...</div>`;

    const cicloDoc = await db.collection('ciclos').doc(cicloId).get();
    const ciclo = { id: cicloDoc.id, ...cicloDoc.data() };
    const config360 = ciclo.config_360 || {};
    const avaliacoes = ciclo.avaliacoes || {};
    const avalGestor = ciclo.avaliacoes_gestor || {};
    const media360 = ciclo.media_360 || {};
    const prontoGestor = ciclo.pronto_para_gestor || {};
    const resultadosLib = ciclo.resultados_liberados || {};

    // Busca nomes
    const uids = Object.keys(config360);
    const nomes = {};
    for (const uid of uids) {
      const u = await db.collection('usuarios').doc(uid).get();
      if (u.exists) nomes[uid] = u.data();
    }

    main.innerHTML = `
      <div class="page-header">
        <div>
          <button class="btn-icon" onclick="Desenvolvimento.render()" style="margin-right:8px"><i class="ti ti-arrow-left"></i></button>
          <h1 class="page-title" style="display:inline">${ciclo.nome}</h1>
          <p class="page-sub" style="margin-top:4px">${ciclo.periodo || ''} · Painel do gestor</p>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Autoav.</th>
              <th>360°</th>
              <th>Gestor</th>
              <th>Média</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${uids.map(uid => {
              const u = nomes[uid];
              const autoNota = avaliacoes[uid + '_autos']?.nota || avaliacoes[uid + '_auto']?.nota || null;
              const m360 = media360[uid];
              const gestNota = avalGestor[uid]?.nota;
              const partes = [autoNota, m360, gestNota].filter(v => v != null);
              const media = partes.length === 3 ? (partes.reduce((a,b)=>a+b,0)/3).toFixed(1) : '—';
              const liberado = resultadosLib[uid];

              let acao = '';
              if (!avaliacoes[uid + '_auto'] && !avaliacoes[uid + '_autos']) {
                acao = `<span style="font-size:12px;color:var(--text-3)">Aguardando autoav.</span>`;
              } else if (!prontoGestor[uid]) {
                acao = `<span style="font-size:12px;color:var(--text-3)">Aguardando pares 360°</span>`;
              } else if (!avalGestor[uid]) {
                acao = `<button class="btn-primary" style="font-size:12px;padding:5px 10px" onclick="Desenvolvimento.openAvalGestor('${cicloId}','${uid}','${u?.nome || ''}')">Avaliar</button>`;
              } else if (!liberado) {
                acao = `<button class="btn-secondary" style="font-size:12px;padding:5px 10px" onclick="Desenvolvimento.openConsolidado('${cicloId}','${uid}')">Ver resultado</button>`;
              } else {
                acao = `<span style="font-size:12px;color:var(--success)"><i class="ti ti-check"></i> Concluído</span>`;
              }

              return `
                <tr>
                  <td>
                    <p style="font-weight:500">${u?.nome || uid}</p>
                    <p style="font-size:11px;color:var(--text-3)">${u?.funcao || ''}</p>
                  </td>
                  <td>${autoNota != null ? autoNota.toFixed(1) : '—'}</td>
                  <td>${m360 != null ? m360.toFixed(1) : '—'}</td>
                  <td>${gestNota != null ? gestNota.toFixed(1) : '—'}</td>
                  <td><strong>${media}</strong></td>
                  <td>${acao}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ─── AVALIAÇÃO DO GESTOR ────────────────────

  openAvalGestor(cicloId, avaliadoUid, avaliadoNome) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-gest';
    overlay.innerHTML = `
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3>Avaliação — ${avaliadoNome}</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-gest').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="max-height:65vh;overflow-y:auto">
          ${this.renderCriterios('gest')}
          <label class="form-label" style="margin-top:16px">Comentário do gestor</label>
          <textarea class="inp" id="gest-coment" rows="3" placeholder="Pontos de destaque e desenvolvimento..."></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-gest').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarAvalGestor('${cicloId}','${avaliadoUid}','${avaliadoNome}')">Salvar avaliação</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  async salvarAvalGestor(cicloId, avaliadoUid, avaliadoNome) {
    const nota = this.calcMedia('gest');
    const comentario = document.getElementById('gest-coment').value.trim();

    await db.collection('ciclos').doc(cicloId).update({
      [`avaliacoes_gestor.${avaliadoUid}`]: {
        nota, comentario,
        avaliador: App.currentUser.uid,
        criadoEm: new Date().toISOString()
      }
    });
    document.getElementById('modal-gest').remove();
    this.verPainelCiclo(cicloId);
  },

  // ─── CONSOLIDADO (gestor vê, dá feedback, cria PDI) ──

  async openConsolidado(cicloId, avaliadoUid) {
    const cicloDoc = await db.collection('ciclos').doc(cicloId).get();
    const ciclo = cicloDoc.data();
    const avaliadoDoc = await db.collection('usuarios').doc(avaliadoUid).get();
    const avaliado = avaliadoDoc.data();

    const autoNota = ciclo.avaliacoes?.[avaliadoUid + '_auto']?.nota
                  || ciclo.avaliacoes?.[avaliadoUid + '_autos']?.nota || null;
    const autoComent = ciclo.avaliacoes?.[avaliadoUid + '_auto']?.comentario
                    || ciclo.avaliacoes?.[avaliadoUid + '_autos']?.comentario || '';
    const m360   = ciclo.media_360?.[avaliadoUid];
    const gestNota = ciclo.avaliacoes_gestor?.[avaliadoUid]?.nota;
    const gestComent = ciclo.avaliacoes_gestor?.[avaliadoUid]?.comentario || '';

    // Busca comentários 360 (sem identificar autor)
    const snap360 = await db.collection('avaliacoes_360')
      .where('ciclo_id', '==', cicloId)
      .where('avaliado_uid', '==', avaliadoUid)
      .get();
    const coments360 = snap360.docs.map(d => d.data().comentario).filter(Boolean);

    const partes = [autoNota, m360, gestNota].filter(v => v != null);
    const media = partes.length ? (partes.reduce((a,b)=>a+b,0)/partes.length).toFixed(1) : '—';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-consol';
    overlay.innerHTML = `
      <div class="modal" style="max-width:580px">
        <div class="modal-header">
          <h3>Resultado — ${avaliado?.nome || ''}</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-consol').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="max-height:72vh;overflow-y:auto">

          <!-- Notas -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
            ${[
              { label: 'Autoavaliação', val: autoNota },
              { label: '360°', val: m360 },
              { label: 'Gestor', val: gestNota },
              { label: 'Média final', val: parseFloat(media), destaque: true }
            ].map(n => `
              <div style="text-align:center;padding:12px;background:${n.destaque ? 'var(--accent-bg)' : 'var(--bg)'};border-radius:var(--radius);border:1px solid var(--border)">
                <p style="font-size:11px;color:var(--text-2);margin-bottom:4px">${n.label}</p>
                <p style="font-size:${n.destaque ? '22px' : '18px'};font-weight:700;color:${n.destaque ? 'var(--accent)' : 'var(--text)'}">${n.val != null ? n.val.toFixed(1) : '—'}</p>
              </div>`).join('')}
          </div>

          <!-- Comentários -->
          ${autoComent ? `
          <div style="margin-bottom:14px">
            <p style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px">Comentário — Autoavaliação</p>
            <p style="font-size:13px;padding:10px;background:var(--bg);border-radius:8px">${autoComent}</p>
          </div>` : ''}

          ${coments360.length > 0 ? `
          <div style="margin-bottom:14px">
            <p style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px">Comentários 360° (anônimos)</p>
            ${coments360.map(c => `<p style="font-size:13px;padding:8px 10px;background:var(--bg);border-radius:8px;margin-bottom:6px">"${c}"</p>`).join('')}
          </div>` : ''}

          ${gestComent ? `
          <div style="margin-bottom:14px">
            <p style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px">Comentário do gestor</p>
            <p style="font-size:13px;padding:10px;background:var(--bg);border-radius:8px">${gestComent}</p>
          </div>` : ''}

          <hr style="border:none;border-top:1px solid var(--border);margin:18px 0">

          <!-- Feedback do gestor -->
          <p style="font-weight:600;font-size:14px;margin-bottom:10px">Feedback para o colaborador</p>
          <textarea class="inp" id="consol-feedback" rows="3" placeholder="Escreva um feedback que o colaborador verá após a conclusão...">${ciclo.feedbacks_gestor?.[avaliadoUid] || ''}</textarea>

          <hr style="border:none;border-top:1px solid var(--border);margin:18px 0">

          <!-- PDI -->
          <p style="font-weight:600;font-size:14px;margin-bottom:10px">Plano de Desenvolvimento Individual</p>
          <div id="pdi-ciclo-lista">
            ${(ciclo.pdis_ciclo?.[avaliadoUid] || []).map((p, i) => `
              <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
                <input class="inp" style="flex:1" value="${p.titulo}" id="pdi-ciclo-${i}-titulo" placeholder="Meta de desenvolvimento">
                <input class="inp" style="width:120px" type="date" value="${p.prazo || ''}" id="pdi-ciclo-${i}-prazo">
              </div>`).join('')}
          </div>
          <button class="btn-secondary" style="font-size:12px;margin-top:4px" onclick="Desenvolvimento.addPdiCicloLinha()">
            <i class="ti ti-plus"></i> Adicionar meta
          </button>

        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-consol').remove()">Fechar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarConsolidado('${cicloId}','${avaliadoUid}')">Salvar e liberar resultado</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  addPdiCicloLinha() {
    const lista = document.getElementById('pdi-ciclo-lista');
    const i = lista.children.length;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin-bottom:8px';
    div.innerHTML = `
      <input class="inp" style="flex:1" id="pdi-ciclo-${i}-titulo" placeholder="Meta de desenvolvimento">
      <input class="inp" style="width:120px" type="date" id="pdi-ciclo-${i}-prazo">`;
    lista.appendChild(div);
  },

  async salvarConsolidado(cicloId, avaliadoUid) {
    const feedback = document.getElementById('consol-feedback').value.trim();
    const lista = document.getElementById('pdi-ciclo-lista');
    const pdis = [];
    for (let i = 0; i < lista.children.length; i++) {
      const titulo = document.getElementById(`pdi-ciclo-${i}-titulo`)?.value.trim();
      const prazo  = document.getElementById(`pdi-ciclo-${i}-prazo`)?.value;
      if (titulo) pdis.push({ titulo, prazo: prazo || '' });
    }

    // Salva feedback e PDIs no ciclo
    await db.collection('ciclos').doc(cicloId).update({
      [`feedbacks_gestor.${avaliadoUid}`]: feedback,
      [`pdis_ciclo.${avaliadoUid}`]: pdis,
      [`resultados_liberados.${avaliadoUid}`]: true
    });

    // Cria PDIs reais na coleção pdis para o colaborador acompanhar
    for (const p of pdis) {
      const existe = await db.collection('pdis')
        .where('uid', '==', avaliadoUid)
        .where('titulo', '==', p.titulo)
        .where('ciclo_id', '==', cicloId)
        .get();
      if (existe.empty) {
        await db.collection('pdis').add({
          uid: avaliadoUid,
          ciclo_id: cicloId,
          titulo: p.titulo,
          prazo: p.prazo,
          status: 'pendente',
          descricao: '',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    document.getElementById('modal-consol').remove();
    this.verPainelCiclo(cicloId);
  },

  // ─── RESULTADO DO COLABORADOR ────────────────

  async verMeuResultado(cicloId) {
    const uid = App.currentUser.uid;
    const cicloDoc = await db.collection('ciclos').doc(cicloId).get();
    const ciclo = cicloDoc.data();

    const autoNota = ciclo.avaliacoes?.[uid + '_auto']?.nota;
    const m360     = ciclo.media_360?.[uid];
    const gestNota = ciclo.avaliacoes_gestor?.[uid]?.nota;
    const feedback = ciclo.feedbacks_gestor?.[uid] || '';
    const pdis     = ciclo.pdis_ciclo?.[uid] || [];

    const partes = [autoNota, m360, gestNota].filter(v => v != null);
    const media = partes.length ? (partes.reduce((a,b)=>a+b,0)/partes.length).toFixed(1) : '—';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-meuresult';
    overlay.innerHTML = `
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3>Meu resultado — ${ciclo.nome}</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-meuresult').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">

          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
            ${[
              { label: 'Autoavaliação', val: autoNota },
              { label: '360°', val: m360 },
              { label: 'Gestor', val: gestNota },
              { label: 'Média final', val: parseFloat(media), destaque: true }
            ].map(n => `
              <div style="text-align:center;padding:12px;background:${n.destaque ? 'var(--accent-bg)' : 'var(--bg)'};border-radius:var(--radius);border:1px solid var(--border)">
                <p style="font-size:11px;color:var(--text-2);margin-bottom:4px">${n.label}</p>
                <p style="font-size:${n.destaque ? '22px' : '18px'};font-weight:700;color:${n.destaque ? 'var(--accent)' : 'var(--text)'}">${n.val != null ? n.val.toFixed(1) : '—'}</p>
              </div>`).join('')}
          </div>

          ${feedback ? `
          <div style="margin-bottom:18px;padding:14px;background:var(--accent-bg);border-radius:var(--radius);border:1px solid rgba(29,78,216,0.15)">
            <p style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:6px"><i class="ti ti-message-circle"></i> Feedback do gestor</p>
            <p style="font-size:13px;color:var(--text)">${feedback}</p>
          </div>` : ''}

          ${pdis.length > 0 ? `
          <div>
            <p style="font-weight:600;font-size:14px;margin-bottom:10px">Seu PDI</p>
            ${pdis.map(p => `
              <div class="pdi-card">
                <div class="pdi-header">
                  <span class="pdi-titulo">${p.titulo}</span>
                </div>
                ${p.prazo ? `<p style="font-size:12px;color:var(--text-3)"><i class="ti ti-calendar"></i> Prazo: ${App.formatDate(p.prazo)}</p>` : ''}
              </div>`).join('')}
          </div>` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn-primary" onclick="document.getElementById('modal-meuresult').remove()">Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  // ─── FEEDBACK PONTUAL ───────────────────────

  async openFeedback() {
    const setor = App.currentUserData.setor || '';
    const snap = await db.collection('usuarios').get();
    const colegas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
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
          <p style="font-size:12px;color:var(--text-3);margin-top:6px"><i class="ti ti-lock"></i> Sua identidade não será revelada</p>
          <p id="fb-erro" style="color:#E24B4A;font-size:13px;margin:6px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-feedback').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.enviarFeedback()">Enviar</button>
        </div>
      </div>`;
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
      destinatario_uid: dest, tipo, mensagem: msg,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('modal-feedback').remove();
    alert('Feedback enviado!');
  },

  // ─── PDI (colaborador gerencia) ─────────────

  openNovoPDI() {
    this._modalPDI(null, null);
  },

  async editarPDI(id) {
    const doc = await db.collection('pdis').doc(id).get();
    this._modalPDI(id, doc.data());
  },

  _modalPDI(id, p) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-pdi';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${id ? 'Editar meta' : 'Nova meta de desenvolvimento'}</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-pdi').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <label class="form-label">Título</label>
          <input class="inp" id="pdi-titulo" value="${p?.titulo || ''}">
          <label class="form-label" style="margin-top:12px">Descrição</label>
          <textarea class="inp" id="pdi-desc" rows="3">${p?.descricao || ''}</textarea>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div>
              <label class="form-label">Prazo</label>
              <input class="inp" type="date" id="pdi-prazo" value="${p?.prazo || ''}">
            </div>
            <div>
              <label class="form-label">Status</label>
              <select class="inp" id="pdi-status">
                <option value="pendente" ${p?.status === 'pendente' || !p ? 'selected' : ''}>Pendente</option>
                <option value="em_andamento" ${p?.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
                <option value="concluido" ${p?.status === 'concluido' ? 'selected' : ''}>Concluído</option>
              </select>
            </div>
          </div>
          <p id="pdi-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-pdi').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarPDI('${id || ''}')">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  async salvarPDI(id) {
    const titulo = document.getElementById('pdi-titulo').value.trim();
    const desc   = document.getElementById('pdi-desc').value.trim();
    const prazo  = document.getElementById('pdi-prazo').value;
    const status = document.getElementById('pdi-status').value;
    const erro   = document.getElementById('pdi-erro');
    if (!titulo) { erro.textContent = 'Informe o título.'; return; }

    const dados = {
      uid: App.currentUser.uid,
      nome: App.currentUserData.nome,
      setor: App.currentUserData.setor || '',
      titulo, descricao: desc, prazo, status,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (id) {
      await db.collection('pdis').doc(id).update(dados);
    } else {
      dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('pdis').add(dados);
    }
    document.getElementById('modal-pdi').remove();
    this.render();
  },

  // ─── VER TODOS OS FEEDBACKS (gestor) ────────

  async verTodosFeedbacks() {
    const setor = App.meuSetor();
    const equipSnap = await db.collection('usuarios').get();
    const nomeMap = {};
    const equipUids = equipSnap.docs
      .map(d => d.data())
      .filter(u => !setor || u.setor === setor)
      .map(u => { nomeMap[u.uid] = u.nome; return u.uid; });

    const fbAll = await db.collection('feedbacks').get();
    const feedbacks = fbAll.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(f => equipUids.includes(f.destinatario_uid))
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0))
      .map(f => ({ ...f, destinatario_nome: nomeMap[f.destinatario_uid] || '?' }));

    // Agrupa por colaborador
    const porColab = {};
    feedbacks.forEach(f => {
      if (!porColab[f.destinatario_uid]) porColab[f.destinatario_uid] = { nome: f.destinatario_nome, feedbacks: [] };
      porColab[f.destinatario_uid].feedbacks.push(f);
    });

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-todos-fb';
    overlay.innerHTML = `
      <div class="modal" style="max-width:620px">
        <div class="modal-header">
          <h3>Feedbacks da equipe</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-todos-fb').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="max-height:72vh;overflow-y:auto">
          ${Object.values(porColab).map(c => `
            <div style="margin-bottom:24px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-bg);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">
                  ${App.initials(c.nome)}
                </div>
                <div>
                  <p style="font-weight:600;font-size:14px">${c.nome}</p>
                  <p style="font-size:11px;color:var(--text-3)">${c.feedbacks.length} feedback${c.feedbacks.length !== 1 ? 's' : ''} · ${c.feedbacks.filter(f=>f.tipo==='positivo').length} positivos · ${c.feedbacks.filter(f=>f.tipo==='melhoria').length} melhorias</p>
                </div>
              </div>
              ${c.feedbacks.map(f => `
                <div class="feedback-card" style="margin-left:42px">
                  <div class="feedback-header">
                    <span class="feedback-tipo">${f.tipo === 'positivo' ? '👍 Positivo' : f.tipo === 'melhoria' ? '💡 Melhoria' : '💬 Geral'}</span>
                    <span class="feedback-data">${Desenvolvimento.fmtTs(f.criadoEm)}</span>
                  </div>
                  <p class="feedback-texto">${f.mensagem}</p>
                  <p class="feedback-de">— Anônimo</p>
                </div>`).join('')}
            </div>`).join('')}
          ${Object.keys(porColab).length === 0 ? '<p class="dev-empty">Nenhum feedback registrado ainda</p>' : ''}
        </div>
        <div class="modal-footer">
          <button class="btn-primary" onclick="document.getElementById('modal-todos-fb').remove()">Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  // ─── UTILS ──────────────────────────────────

  fmtTs(ts) {
    if (!ts) return '';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
      return d.toLocaleDateString('pt-BR');
    } catch { return ''; }
  }
};
