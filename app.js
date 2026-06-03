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
              <span id="badge-desenv" style="display:none;margin-left:auto;min-width:18px;height:18px;background:var(--danger);color:#fff;border-radius:9px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 4px"></span>
            </a>
            ${isGestor ? `
            <div class="nav-section">Gestão</div>
            <a class="nav-item" onclick="App.showPage('aprovacoes')" data-page="aprovacoes">
              <i class="ti ti-checks"></i> Aprovações
            </a>
            <a class="nav-item" onclick="App.showPage('equipe')" data-page="equipe">
              <i class="ti ti-users"></i> Equipe
            </a>
            <a class="nav-item" onclick="App.showPage('bloqueios')" data-page="bloqueios">
              <i class="ti ti-lock"></i> Dias bloqueados
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
    this.carregarNotificacoes();
  },

  async carregarNotificacoes() {
    const uid = App.currentUser.uid;
    let total = 0;

    // Avaliações 360 pendentes para mim
    try {
      const snap = await db.collection('avaliacoes_360')
        .where('avaliador_uid', '==', uid).where('status', '==', 'pendente').get();
      total += snap.size;
    } catch(e) {}

    // Ciclos ativos onde sou o colaborador e ainda não fiz autoavaliação
    try {
      const snap2 = await db.collection('ciclos')
        .where('colaborador_uid', '==', uid).where('status', '!=', 'encerrado').get();
      snap2.docs.forEach(d => {
        const c = d.data();
        if (!c.avaliacoes?.[uid + '_auto']) total++;
      });
    } catch(e) {}

    const badge = document.getElementById('badge-desenv');
    if (badge) {
      if (total > 0) {
        badge.textContent = total > 9 ? '9+' : total;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
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
      case 'bloqueios':       Bloqueios.render(); break;
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
    const map = { ferias: 'Férias', folga: 'Folga', atestado: 'Consulta médica', banco_horas: 'Banco de horas' };
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
    const dept = App.currentUserData.departamento || '';

    // Busca solicitações aprovadas do departamento
    const snap = await db.collection('solicitacoes').where('status', '==', 'aprovado').get();
    const solicitacoes = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => s.data_inicio <= fimMes && s.data_fim >= iniMes && (!dept || s.departamento === dept));

    // Busca dias bloqueados do departamento (sem filtro no Firestore — evita índice)
    const bloqSnap = await db.collection('dias_bloqueados').get();
    const bloqueados = {};
    bloqSnap.docs.forEach(d => {
      const b = d.data();
      if (!dept || !b.departamento || b.departamento === dept) {
        bloqueados[b.data] = b.motivo || 'Bloqueado';
      }
    });

    this.renderCalendario(solicitacoes, isGestor, bloqueados);
  },

  renderCalendario(solicitacoes, isGestor, bloqueados = {}) {
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

    // Serializa eventos para passar ao onclick
    const eventosJSON = JSON.stringify(eventos).replace(/`/g,"'").replace(/\\/g,"\\\\");

    let cells = '';
    for (let i = 0; i < primeiroDia; i++) cells += `<div class="cal-cell empty"></div>`;
    for (let dia = 1; dia <= totalDias; dia++) {
      const key = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
      const evs = eventos[key] || [];
      const isHoje = key === new Date().toISOString().split('T')[0];
      const isWeekend = new Date(key + 'T12:00:00').getDay() === 0 || new Date(key + 'T12:00:00').getDay() === 6;
      const isLotado = evs.length > 2;
      const temEvento = evs.length > 0;

      const isBloqueado = !!bloqueados[key];
      const motivoBloq  = bloqueados[key] || '';

      const evHtml = evs.slice(0,2).map(e => {
        const cls = e.tipo === 'ferias' ? 'ev-ferias' : e.tipo === 'folga' ? 'ev-folga' : 'ev-atestado';
        const periodo = e.modo === 'horario' ? `${e.hora_inicio}–${e.hora_fim}` : 'Dia todo';
        const nomePart = isGestor ? (e.nome ? e.nome.split(' ')[0] : App.tipoLabel(e.tipo)) : App.tipoLabel(e.tipo);
        const label = `${nomePart} <span class="cal-ev-periodo">${periodo}</span>`;
        const title = isGestor ? `${e.nome || '?'} — ${App.tipoLabel(e.tipo)} · ${periodo}` : `${App.tipoLabel(e.tipo)} · ${periodo}`;
        return `<div class="cal-ev ${cls}" title="${title}">${label}</div>`;
      }).join('');
      const mais = isLotado ? `<div class="cal-ev-more">+${evs.length - 2} mais</div>` : '';
      const bloqTag = isBloqueado ? `<div class="cal-ev-bloq" title="${motivoBloq}"><i class="ti ti-lock"></i> ${motivoBloq}</div>` : '';

      const clickAttr = isBloqueado
        ? `onclick="Calendario.openDiaBloqueado('${key}','${motivoBloq.replace(/'/g,'\'')}')" style="cursor:pointer"`
        : temEvento
          ? `onclick="Calendario.openDia('${key}', ${isGestor})" style="cursor:pointer"`
          : '';

      cells += `
        <div class="cal-cell${isHoje ? ' hoje' : ''}${isWeekend ? ' weekend' : ''}${isLotado ? ' lotado' : ''}${isBloqueado ? ' bloqueado' : ''}"
          ${clickAttr}>
          <span class="cal-day-num">${dia}</span>
          ${bloqTag}${evHtml}${mais}
        </div>`;
    }

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Calendário</h1>
          <p class="page-sub">Férias, folgas e consultas${u.departamento ? ' · ' + u.departamento : ''}</p>
        </div>
        <button class="btn-primary" onclick="Solicitacoes.openNova()">
          <i class="ti ti-plus"></i> Nova solicitação
        </button>
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
        <span class="leg-item"><span class="leg-dot ev-atestado"></span> Consulta</span>
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
  },

  openDiaBloqueado(key, motivo) {
    const [ano, mes, dia] = key.split('-');
    alert(`📅 ${dia}/${mes}/${ano}\n\n🔒 Dia bloqueado\n${motivo}`);
  },

  openDia(key, isGestor) {
    // Pega solicitações desse dia dos dados já carregados
    const [ano, mes, dia] = key.split('-');
    const dataFmt = `${dia}/${mes}/${ano}`;

    // Busca no Firestore direto para garantir dados frescos
    const fimDia = key + 'T23:59:59';
    db.collection('solicitacoes')
      .where('status', '==', 'aprovado')
      .get()
      .then(snap => {
        const dept = App.currentUserData.departamento || '';
        const evs = snap.docs
          .map(d => d.data())
          .filter(s => s.data_inicio <= key && s.data_fim >= key && (!dept || s.departamento === dept));

        if (evs.length === 0) return;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-dia';
        overlay.innerHTML = `
          <div class="modal" style="max-width:440px">
            <div class="modal-header">
              <h3><i class="ti ti-calendar-event"></i> ${dataFmt}</h3>
              <button class="btn-icon" onclick="document.getElementById('modal-dia').remove()"><i class="ti ti-x"></i></button>
            </div>
            <div class="modal-body">
              ${evs.map(e => `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
                  <div style="width:36px;height:36px;border-radius:50%;background:var(--accent-bg);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0">
                    ${App.initials(e.nome || '?')}
                  </div>
                  <div style="flex:1">
                    <p style="font-weight:500;font-size:13px">${isGestor ? (e.nome || '—') : App.tipoLabel(e.tipo)}</p>
                    <p style="font-size:12px;color:var(--text-2)">${isGestor ? App.tipoLabel(e.tipo) + (e.funcao ? ' · ' + e.funcao : '') : ''}</p>
                    ${e.modo === 'horario' ? `<p style="font-size:11px;color:var(--text-3)">${e.hora_inicio} – ${e.hora_fim}</p>` : ''}
                  </div>
                  <span class="tipo-pill tipo-${e.tipo}" style="flex-shrink:0">${App.tipoLabel(e.tipo)}</span>
                </div>`).join('')}
            </div>
            <div class="modal-footer">
              <button class="btn-primary" onclick="document.getElementById('modal-dia').remove()">Fechar</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
      });
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
          <p class="page-sub">Histórico de solicitações</p>
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
            <option value="atestado">Consulta médica</option>
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

    // Verifica dias bloqueados (férias não são afetadas)
    if (tipo !== 'ferias') {
      const dept = App.currentUserData.departamento || '';
      const bloqSnap2 = await db.collection('dias_bloqueados').get();
      const diasBloq = bloqSnap2.docs.map(d => d.data()).filter(b => !dept || b.departamento === dept);
      if (isDia) {
        let dataCheck = new Date(document.getElementById('sol-inicio').value + 'T12:00:00');
        const dataFimCheck = new Date(document.getElementById('sol-fim').value + 'T12:00:00');
        while (dataCheck <= dataFimCheck) {
          const k = dataCheck.toISOString().split('T')[0];
          const bloq = diasBloq.find(b => b.data === k);
          if (bloq) { erro.textContent = `O dia ${App.formatDate(k)} está bloqueado: ${bloq.motivo}`; return; }
          dataCheck.setDate(dataCheck.getDate() + 1);
        }
      } else {
        const k2 = document.getElementById('sol-data-hora').value;
        const bloq2 = diasBloq.find(b => b.data === k2);
        if (bloq2) { erro.textContent = `O dia ${App.formatDate(k2)} está bloqueado: ${bloq2.motivo}`; return; }
      }
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

    const depto = App.currentUserData.departamento || '';
    const snap = await db.collection('solicitacoes').where('status', '==', 'pendente').get();

    const lista = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => !depto || s.departamento === depto)
      .sort((a, b) => (a.criadoEm?.seconds || 0) - (b.criadoEm?.seconds || 0));

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Aprovações</h1>
          <p class="page-sub">${lista.length} solicitação${lista.length !== 1 ? 'ões' : ''} pendente${lista.length !== 1 ? 's' : ''}${depto ? ' · ' + depto : ''}</p>
        </div>
        <button class="btn-secondary" onclick="Aprovacoes.openRelatorio()">
          <i class="ti ti-file-analytics"></i> Relatório
        </button>
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
  },

  openRelatorio() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-relatorio';
    overlay.innerHTML = `
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <h3><i class="ti ti-file-analytics"></i> Relatório de solicitações</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-relatorio').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="form-label">Data início</label>
              <input class="inp" type="date" id="rel-inicio">
            </div>
            <div>
              <label class="form-label">Data fim</label>
              <input class="inp" type="date" id="rel-fim">
            </div>
          </div>
          <label class="form-label" style="margin-top:12px">Nome do colaborador (opcional)</label>
          <input class="inp" id="rel-nome" placeholder="Buscar por nome...">
          <label class="form-label" style="margin-top:12px">Tipo</label>
          <select class="inp" id="rel-tipo">
            <option value="">Todos</option>
            <option value="ferias">Férias</option>
            <option value="folga">Folga</option>
            <option value="atestado">Consulta médica</option>
          </select>
          <label class="form-label" style="margin-top:12px">Status</label>
          <select class="inp" id="rel-status">
            <option value="">Todos</option>
            <option value="aprovado">Aprovado</option>
            <option value="reprovado">Reprovado</option>
            <option value="pendente">Pendente</option>
          </select>
          <p id="rel-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-relatorio').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Aprovacoes.gerarRelatorio()">
            <i class="ti ti-search"></i> Gerar relatório
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  async gerarRelatorio() {
    const inicio  = document.getElementById('rel-inicio').value;
    const fim     = document.getElementById('rel-fim').value;
    const nome    = document.getElementById('rel-nome').value.trim().toLowerCase();
    const tipo    = document.getElementById('rel-tipo').value;
    const status  = document.getElementById('rel-status').value;
    const erro    = document.getElementById('rel-erro');

    erro.textContent = 'Buscando...';

    try {
      const depto = App.currentUserData.departamento || '';
      const snap = await db.collection('solicitacoes').get();
      let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filtros
      if (depto)   lista = lista.filter(s => !s.departamento || s.departamento === depto);
      if (inicio)  lista = lista.filter(s => s.data_inicio >= inicio);
      if (fim)     lista = lista.filter(s => s.data_inicio <= fim);
      if (nome)    lista = lista.filter(s => (s.nome || '').toLowerCase().includes(nome));
      if (tipo)    lista = lista.filter(s => s.tipo === tipo);
      if (status)  lista = lista.filter(s => s.status === status);

      lista.sort((a, b) => a.data_inicio?.localeCompare(b.data_inicio));

      if (lista.length === 0) { erro.textContent = 'Nenhum resultado encontrado.'; return; }

      erro.textContent = '';

      // Monta HTML do relatório
      const totalAprov  = lista.filter(s => s.status === 'aprovado').length;
      const totalReprov = lista.filter(s => s.status === 'reprovado').length;
      const totalPend   = lista.filter(s => s.status === 'pendente').length;

      document.getElementById('modal-relatorio').innerHTML = `
        <div class="modal" style="max-width:700px">
          <div class="modal-header">
            <h3><i class="ti ti-file-analytics"></i> Relatório — ${lista.length} resultado${lista.length !== 1 ? 's' : ''}</h3>
            <div style="display:flex;gap:8px">
              <button class="btn-secondary" style="font-size:12px" onclick="Aprovacoes.openRelatorio()"><i class="ti ti-arrow-left"></i> Filtrar</button>
              <button class="btn-secondary" style="font-size:12px" onclick="Aprovacoes.imprimirRelatorio()"><i class="ti ti-printer"></i> Imprimir</button>
              <button class="btn-icon" onclick="document.getElementById('modal-relatorio').remove()"><i class="ti ti-x"></i></button>
            </div>
          </div>
          <div class="modal-body" style="max-height:70vh;overflow-y:auto" id="rel-conteudo">

            <!-- Resumo -->
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
              <div style="text-align:center;padding:12px;background:var(--success-bg);border-radius:var(--radius);border:1px solid var(--border)">
                <p style="font-size:11px;color:var(--success);font-weight:600;margin-bottom:4px">APROVADAS</p>
                <p style="font-size:22px;font-weight:700;color:var(--success)">${totalAprov}</p>
              </div>
              <div style="text-align:center;padding:12px;background:var(--warning-bg);border-radius:var(--radius);border:1px solid var(--border)">
                <p style="font-size:11px;color:var(--warning);font-weight:600;margin-bottom:4px">PENDENTES</p>
                <p style="font-size:22px;font-weight:700;color:var(--warning)">${totalPend}</p>
              </div>
              <div style="text-align:center;padding:12px;background:var(--danger-bg);border-radius:var(--radius);border:1px solid var(--border)">
                <p style="font-size:11px;color:var(--danger);font-weight:600;margin-bottom:4px">REPROVADAS</p>
                <p style="font-size:22px;font-weight:700;color:var(--danger)">${totalReprov}</p>
              </div>
            </div>

            <!-- Tabela -->
            <table class="table" style="font-size:12.5px">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Tipo</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Período</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${lista.map(s => `
                  <tr>
                    <td>
                      <p style="font-weight:500">${s.nome || '—'}</p>
                      <p style="font-size:11px;color:var(--text-3)">${s.funcao || ''}</p>
                    </td>
                    <td><span class="tipo-pill tipo-${s.tipo}">${App.tipoLabel(s.tipo)}</span></td>
                    <td>${App.formatDate(s.data_inicio)}</td>
                    <td>${App.formatDate(s.data_fim)}</td>
                    <td>${s.modo === 'horario' ? s.hora_inicio + '–' + s.hora_fim : s.dias + 'd'}</td>
                    <td>${App.statusBadge(s.status)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" onclick="document.getElementById('modal-relatorio').remove()">Fechar</button>
          </div>
        </div>`;
    } catch(e) {
      erro.textContent = 'Erro: ' + e.message;
    }
  },

  imprimirRelatorio() {
    const conteudo = document.getElementById('rel-conteudo')?.innerHTML;
    if (!conteudo) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Relatório Capacita</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 13px; padding: 24px; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb; }
        td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; }
        .resumo { display: flex; gap: 16px; margin-bottom: 20px; }
        .resumo-card { flex: 1; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center; }
        .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .badge-success { background: #C8EDE0; color: #136B4E; }
        .badge-warning { background: #F5DFB8; color: #8A5210; }
        .badge-danger  { background: #F8D0D0; color: #C0201F; }
        .badge-default { background: #E5E7EB; color: #3D3D38; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>
        <h2 style="margin-bottom:4px">Relatório de Solicitações</h2>
        <p style="color:#6B6B64;margin-bottom:20px;font-size:12px">Capacita · ${new Date().toLocaleDateString('pt-BR')}</p>
        ${conteudo}
      </body></html>`);
    win.document.close();
    win.print();
  }
};

// =============================================
//  MÓDULO — EQUIPE (gestor — filtra por setor)
// =============================================

const Equipe = {
  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando...</div>`;

    const deptAtual = App.currentUserData.departamento || '';
    const snap = await db.collection('usuarios').get();
    const usuarios = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => !deptAtual || u.departamento === deptAtual);

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Equipe</h1>
          <p class="page-sub">${usuarios.length} colaborador${usuarios.length !== 1 ? 'es' : ''}${deptAtual ? ' · ' + deptAtual : ''}</p>
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
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn-secondary" style="flex:1;font-size:12px"
                onclick="Equipe.editarColaborador('${u.id}')">
                <i class="ti ti-edit"></i> Editar
              </button>
              <button class="btn-danger" style="font-size:12px;padding:7px 10px"
                onclick="Equipe.confirmarExclusao('${u.id}', '${u.nome}')" title="Excluir colaborador">
                <i class="ti ti-trash"></i>
              </button>
            </div>
          </div>`).join('')}
      </div>
    `;
  },

  openNovoColaborador() {
    const depto = App.currentUserData.departamento || '';
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
            Oriente o colaborador a acessar o Capacita e clicar em <strong>"Primeiro acesso"</strong> usando o e-mail cadastrado.
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
              <input class="inp" id="nc-setor" placeholder="Ex: Vendas">
            </div>
          </div>

          <label class="form-label" style="margin-top:12px">Departamento</label>
          <input class="inp" id="nc-depto" value="${depto}" placeholder="Ex: Comercial">
          <p style="font-size:11px;color:var(--text-3);margin-top:4px">Preenchido com seu departamento. Altere se necessário.</p>

          <label class="form-label" style="margin-top:12px">Papel</label>
          <select class="inp" id="nc-papel">
            <option value="colaborador">Colaborador</option>
            <option value="gestor">Gestor</option>
          </select>

          <label class="form-label" style="margin-top:12px">Data de admissão</label>
          <input class="inp" type="date" id="nc-admissao">

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
        papel, banco_horas: 0,
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


        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-edit').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Equipe.salvarEdicao('${uid}')">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  confirmarExclusao(id, nome) {
    if (!confirm(`Excluir o colaborador "${nome}"?\n\nEsta ação remove o perfil permanentemente.`)) return;
    this.excluirColaborador(id, nome);
  },

  async excluirColaborador(id, nome) {
    try {
      await db.collection('usuarios').doc(id).delete();
      alert(`Colaborador "${nome}" removido.`);
      this.render();
    } catch(e) {
      alert('Erro ao excluir: ' + e.message);
    }
  },

  async salvarEdicao(uid) {
    await db.collection('usuarios').doc(uid).update({
      nome:         document.getElementById('ed-nome').value,
      funcao:       document.getElementById('ed-funcao').value,
      setor:        document.getElementById('ed-setor').value,
      departamento: document.getElementById('ed-depto').value,
      papel:        document.getElementById('ed-papel').value,
    });
    document.getElementById('modal-edit').remove();
    this.render();
  }
};

// =============================================

// =============================================

// =============================================
//  MÓDULO — DESENVOLVIMENTO
//  Ciclos individuais, Feedbacks, PDI
// =============================================

const Desenvolvimento = {

  // ─── RENDER PRINCIPAL ───────────────────────

  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando...</div>`;

    const uid = App.currentUser.uid;
    const isGestor = App.currentUserData.papel === 'gestor' || App.currentUserData.papel === 'admin';
    const setor = App.currentUserData.setor || '';
    const dept  = App.currentUserData.departamento || '';

    if (isGestor) {
      await this.renderGestor(uid, setor, dept);
    } else {
      await this.renderColaborador(uid);
    }
  },

  // ─── VISÃO DO GESTOR ────────────────────────

  async renderGestor(uid, setor, dept) {
    const main = document.getElementById('main-content');

    const snap = await db.collection('ciclos').where('criado_por', '==', uid).get();
    const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

    const ativos    = todos.filter(c => c.status !== 'encerrado');
    const encerrados = todos.filter(c => c.status === 'encerrado');

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Desenvolvimento</h1>
          <p class="page-sub">Ciclos de avaliação individual da equipe</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-secondary" onclick="Desenvolvimento.openFeedback()">
            <i class="ti ti-message-circle"></i> Dar feedback
          </button>
          <button class="btn-primary" onclick="Desenvolvimento.openNovoCiclo()">
            <i class="ti ti-plus"></i> Novo ciclo
          </button>
        </div>
      </div>

      <!-- Busca -->
      <div style="position:relative;margin-bottom:20px">
        <i class="ti ti-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-3)"></i>
        <input class="inp" id="busca-ciclos" placeholder="Buscar por colaborador ou período..."
          style="padding-left:36px" oninput="Desenvolvimento.filtrarCiclos()">
      </div>

      <!-- Ciclos ativos -->
      <div id="secao-ativos">
        <p class="dev-section-title"><i class="ti ti-refresh"></i> Ciclos ativos <span class="fb-count">${ativos.length}</span></p>
        <div id="lista-ativos">
          ${ativos.length === 0
            ? `<p class="dev-empty">Nenhum ciclo ativo — crie um novo ciclo para um colaborador</p>`
            : ativos.map(c => this.renderCicloCardGestor(c)).join('')}
        </div>
      </div>

      <!-- Ciclos encerrados -->
      ${encerrados.length > 0 ? `
      <div id="secao-encerrados" style="margin-top:28px">
        <p class="dev-section-title" style="color:var(--text-3)"><i class="ti ti-history"></i> Ciclos encerrados <span style="font-size:12px;font-weight:400">(${encerrados.length})</span></p>
        <div id="lista-encerrados">
          ${encerrados.map(c => this.renderCicloCardGestor(c, true)).join('')}
        </div>
      </div>` : ''}
    `;

    // Guarda todos para filtragem
    window._ciclosGestor = todos;
  },

  renderCicloCardGestor(ciclo, encerrado = false) {
    const etapaLabel = {
      auto: 'Aguardando autoavaliação',
      '360': 'Avaliação 360° em andamento',
      gestor: 'Aguardando avaliação do gestor',
      resultado: 'Resultado disponível',
      encerrado: 'Encerrado'
    };
    const etapa = ciclo.status === 'encerrado' ? 'encerrado' : (ciclo.etapa_atual || 'auto');
    const media = ciclo.media_final;

    return `
      <div class="ciclo-card ${encerrado ? 'ciclo-encerrado' : ''}" data-nome="${(ciclo.colaborador_nome || '').toLowerCase()}" data-periodo="${(ciclo.periodo || '').toLowerCase()}">
        <div class="ciclo-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="equipe-avatar" style="width:38px;height:38px;font-size:13px">${App.initials(ciclo.colaborador_nome || '?')}</div>
            <div>
              <p class="ciclo-nome">${ciclo.colaborador_nome || '—'}</p>
              <p class="ciclo-periodo">${ciclo.nome} ${ciclo.periodo ? '· ' + ciclo.periodo : ''}</p>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            ${media != null ? `<span style="font-size:13px;font-weight:700;color:var(--accent)">${media.toFixed(1)}</span>` : ''}
            <span class="badge ${ciclo.status === 'encerrado' ? 'badge-default' : ciclo.status === 'em_andamento' ? 'badge-warning' : 'badge-success'}">
              ${ciclo.status === 'encerrado' ? 'Encerrado' : ciclo.status === 'em_andamento' ? 'Em andamento' : 'Aberto'}
            </span>
          </div>
        </div>
        <p style="font-size:12px;color:var(--text-2);margin-bottom:12px">
          <i class="ti ti-point"></i> ${etapaLabel[etapa] || etapa}
        </p>
        <div class="ciclo-actions">
          <button class="btn-primary" style="font-size:12px;padding:6px 12px"
            onclick="Desenvolvimento.abrirPainelCiclo('${ciclo.id}')">
            <i class="ti ti-layout-dashboard"></i> Abrir ciclo
          </button>
          ${ciclo.status !== 'encerrado' ? `
          <button class="btn-secondary" style="font-size:12px;padding:6px 12px"
            onclick="Desenvolvimento.encerrarCiclo('${ciclo.id}', '${(ciclo.colaborador_nome||'').replace(/'/g,"\\'")}')">
            <i class="ti ti-lock"></i> Encerrar
          </button>` : ''}
        </div>
      </div>`;
  },

  filtrarCiclos() {
    const q = document.getElementById('busca-ciclos')?.value.toLowerCase() || '';
    document.querySelectorAll('.ciclo-card').forEach(card => {
      const nome    = card.dataset.nome || '';
      const periodo = card.dataset.periodo || '';
      card.style.display = (!q || nome.includes(q) || periodo.includes(q)) ? '' : 'none';
    });
  },

  // ─── VISÃO DO COLABORADOR ────────────────────

  async renderColaborador(uid) {
    const main = document.getElementById('main-content');

    // Ciclos onde este colaborador é o avaliado
    const snap = await db.collection('ciclos').where('colaborador_uid', '==', uid).get();
    const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

    const ativo      = todos.find(c => c.status !== 'encerrado');
    const encerrados = todos.filter(c => c.status === 'encerrado');

    // Avaliações 360 pendentes para mim
    const pendSnap = await db.collection('avaliacoes_360')
      .where('avaliador_uid', '==', uid).where('status', '==', 'pendente').get();
    const pendentes360 = pendSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Feedbacks recebidos
    const fbSnap = await db.collection('feedbacks').where('destinatario_uid', '==', uid).get();
    const feedbacks = fbSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

    // PDIs do colaborador
    const pdiSnap = await db.collection('pdis').where('uid', '==', uid).get();
    const pdis = pdiSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Meu desenvolvimento</h1>
          <p class="page-sub">Ciclos de avaliação, feedbacks e PDI</p>
        </div>
        <button class="btn-secondary" onclick="Desenvolvimento.openFeedback()">
          <i class="ti ti-message-circle"></i> Dar feedback
        </button>
      </div>

      ${pendentes360.length > 0 ? `
      <div class="alerta-card">
        <i class="ti ti-bell" style="color:var(--warning)"></i>
        <span>Você tem <strong>${pendentes360.length}</strong> avaliação${pendentes360.length > 1 ? 'ões' : ''} 360° pendente${pendentes360.length > 1 ? 's' : ''}</span>
        <button class="btn-primary" style="margin-left:auto" onclick="Desenvolvimento.openPendentes360()">Responder</button>
      </div>` : ''}

      <!-- CICLO ATIVO -->
      <div class="dev-section">
        <h2 class="dev-section-title"><i class="ti ti-refresh"></i> Ciclo ativo</h2>
        ${!ativo
          ? `<p class="dev-empty">Nenhum ciclo ativo no momento</p>`
          : `<div class="ciclo-card">
              <div class="ciclo-header">
                <div>
                  <p class="ciclo-nome">${ativo.nome}</p>
                  <p class="ciclo-periodo">${ativo.periodo || ''}</p>
                </div>
                <span class="badge badge-success">Ativo</span>
              </div>
              ${this.renderEtapasColab(ativo, uid)}
              <div class="ciclo-actions">
                ${ativo.etapa_atual === 'auto' && !ativo.avaliacoes?.[uid + '_auto']
                  ? `<button class="btn-primary" onclick="Desenvolvimento.openAutoavaliacao('${ativo.id}')">
                      <i class="ti ti-pencil"></i> Fazer autoavaliação
                     </button>`
                  : ativo.etapa_atual === 'auto' && ativo.avaliacoes?.[uid + '_auto']
                    ? `<span style="color:var(--success);font-size:13px"><i class="ti ti-check"></i> Autoavaliação concluída — aguardando próxima etapa</span>`
                    : ''
                }
                ${ativo.resultados_liberados?.[uid]
                  ? `<button class="btn-secondary" onclick="Desenvolvimento.verMeuResultado('${ativo.id}')">
                      <i class="ti ti-chart-bar"></i> Ver meu resultado
                     </button>`
                  : ''
                }
              </div>
            </div>`
        }
      </div>

      <!-- CICLOS ENCERRADOS -->
      ${encerrados.length > 0 ? `
      <div class="dev-section">
        <h2 class="dev-section-title" style="color:var(--text-3)"><i class="ti ti-history"></i> Ciclos encerrados</h2>
        ${encerrados.map(c => `
          <div class="ciclo-card ciclo-encerrado">
            <div class="ciclo-header">
              <div>
                <p class="ciclo-nome">${c.nome}</p>
                <p class="ciclo-periodo">${c.periodo || ''}</p>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                ${c.media_final != null ? `<span style="font-size:16px;font-weight:700;color:var(--accent)">${c.media_final.toFixed(1)}</span>` : ''}
                <span class="badge badge-default">Encerrado</span>
              </div>
            </div>
            ${c.resultados_liberados?.[c.colaborador_uid]
              ? `<button class="btn-secondary" style="font-size:12px" onclick="Desenvolvimento.verMeuResultado('${c.id}')">
                  <i class="ti ti-chart-bar"></i> Ver resultado
                 </button>`
              : `<p style="font-size:12px;color:var(--text-3)">Resultado não liberado</p>`
            }
          </div>`).join('')}
      </div>` : ''}

      <!-- FEEDBACKS -->
      <div class="dev-section">
        <h2 class="dev-section-title"><i class="ti ti-messages"></i> Feedbacks recebidos</h2>
        ${feedbacks.length === 0
          ? `<p class="dev-empty">Nenhum feedback recebido ainda</p>`
          : feedbacks.slice(0,5).map(f => `
            <div class="feedback-card">
              <div class="feedback-header">
                <span class="feedback-tipo">${f.tipo === 'positivo' ? '👍 Positivo' : f.tipo === 'melhoria' ? '💡 Melhoria' : '💬 Geral'}</span>
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

  renderEtapasColab(ciclo, uid) {
    const etapas = [
      { key: 'auto', label: 'Autoavaliação' },
      { key: '360',  label: 'Avaliação 360°' },
      { key: 'gestor', label: 'Avaliação do gestor' },
      { key: 'resultado', label: 'Resultado' }
    ];
    const atual = ciclo.etapa_atual || 'auto';
    return `
      <div class="ciclo-etapas" style="margin-bottom:12px">
        ${etapas.map((e, i) => {
          const concluida = ciclo.etapas_concluidas?.includes(e.key);
          const ativa = atual === e.key;
          return `<div class="etapa-item ${ativa ? 'ativa' : ''} ${concluida ? 'concluida' : ''}">
            <div class="etapa-dot">${concluida ? '✓' : i + 1}</div>
            <span>${e.label}</span>
          </div>`;
        }).join('<div class="etapa-linha"></div>')}
      </div>`;
  },

  // ─── NOVO CICLO ─────────────────────────────

  async openNovoCiclo() {
    const setor = App.currentUserData.setor || '';
    const dept  = App.currentUserData.departamento || '';
    const snap  = await db.collection('usuarios').get();
    const equipe = snap.docs.map(d => d.data())
      .filter(u => u.uid !== App.currentUser.uid && (!dept || u.departamento === dept));

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
          <label class="form-label">Colaborador <span style="color:#E24B4A">*</span></label>
          <select class="inp" id="ciclo-colab">
            <option value="">Selecione o colaborador...</option>
            ${equipe.map(u => `<option value="${u.uid}" data-nome="${u.nome}">${u.nome}${u.funcao ? ' · ' + u.funcao : ''}</option>`).join('')}
          </select>

          <label class="form-label" style="margin-top:12px">Nome do ciclo <span style="color:#E24B4A">*</span></label>
          <input class="inp" id="ciclo-nome" placeholder="Ex: Avaliação Semestral">

          <label class="form-label" style="margin-top:12px">Período</label>
          <input class="inp" id="ciclo-periodo" placeholder="Ex: 1º Semestre 2025">

          <div style="margin-top:14px;padding:12px;background:#F5F4F0;border-radius:8px;font-size:13px;color:#6B6B66">
            <strong>Fluxo:</strong> Autoavaliação → Avaliação 360° pelos pares → Avaliação do gestor → Resultado
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
    const sel    = document.getElementById('ciclo-colab');
    const colUid = sel.value;
    const colNome = sel.options[sel.selectedIndex]?.dataset.nome || '';
    const nome    = document.getElementById('ciclo-nome').value.trim();
    const periodo = document.getElementById('ciclo-periodo').value.trim();
    const erro    = document.getElementById('ciclo-erro');

    if (!colUid) { erro.textContent = 'Selecione o colaborador.'; return; }
    if (!nome)   { erro.textContent = 'Informe o nome do ciclo.'; return; }

    // Verifica se já existe ciclo ativo para esse colaborador
    const existe = await db.collection('ciclos')
      .where('colaborador_uid', '==', colUid)
      .where('status', '!=', 'encerrado')
      .get();
    if (!existe.empty) {
      erro.textContent = `${colNome} já possui um ciclo ativo. Encerre-o antes de criar outro.`;
      return;
    }

    const novoDoc = await db.collection('ciclos').add({
      nome, periodo,
      colaborador_uid:  colUid,
      colaborador_nome: colNome,
      setor:  App.currentUserData.setor || '',
      departamento: App.currentUserData.departamento || '',
      criado_por: App.currentUser.uid,
      criado_por_nome: App.currentUserData.nome,
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
    // Abre o painel do ciclo e já dispara a configuração dos avaliadores
    await this.abrirPainelCiclo(novoDoc.id);
    this.openConfigurar360(novoDoc.id, colUid, colNome);
  },

  async encerrarCiclo(id, nome) {
    if (!confirm(`Encerrar o ciclo de ${nome}?\n\nApós encerrado não poderá ser reaberto.`)) return;
    await db.collection('ciclos').doc(id).update({ status: 'encerrado' });
    this.render();
  },

  // ─── PAINEL DO CICLO (gestor) ─────────────

  async abrirPainelCiclo(cicloId) {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando...</div>`;

    const doc  = await db.collection('ciclos').doc(cicloId).get();
    const ciclo = { id: doc.id, ...doc.data() };
    const colUid  = ciclo.colaborador_uid;
    const colNome = ciclo.colaborador_nome || '—';

    const autoAval   = ciclo.avaliacoes?.[colUid + '_auto'];
    const gestorAval = ciclo.avaliacoes_gestor?.[colUid];
    const m360       = ciclo.media_360?.[colUid];
    const prontoGest = ciclo.pronto_para_gestor?.[colUid];
    const liberado   = ciclo.resultados_liberados?.[colUid];
    const config360  = ciclo.config_360?.[colUid] || [];

    // Busca nome dos avaliadores 360 selecionados
    const aval360Snap = await db.collection('avaliacoes_360')
      .where('ciclo_id', '==', cicloId)
      .where('avaliado_uid', '==', colUid)
      .get();
    const avaliacoes360 = aval360Snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const concl360 = avaliacoes360.filter(a => a.status === 'concluido').length;
    const total360 = avaliacoes360.length;

    main.innerHTML = `
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn-icon" onclick="Desenvolvimento.render()"><i class="ti ti-arrow-left"></i></button>
          <div>
            <h1 class="page-title">${colNome}</h1>
            <p class="page-sub">${ciclo.nome}${ciclo.periodo ? ' · ' + ciclo.periodo : ''}</p>
          </div>
        </div>
        <span class="badge ${ciclo.status === 'encerrado' ? 'badge-default' : ciclo.status === 'em_andamento' ? 'badge-warning' : 'badge-success'}" style="font-size:13px;padding:5px 12px">
          ${ciclo.status === 'encerrado' ? 'Encerrado' : ciclo.status === 'em_andamento' ? 'Em andamento' : 'Aberto'}
        </span>
      </div>

      <!-- Etapas -->
      ${this.renderEtapasColab(ciclo, colUid)}

      <!-- Cards de status -->
      <div class="saldo-cards" style="margin-bottom:24px">
        <div class="saldo-card">
          <span class="saldo-label"><i class="ti ti-user"></i> Autoavaliação</span>
          <span class="saldo-num" style="font-size:16px">${autoAval ? `✅ ${autoAval.nota?.toFixed(1)}` : '⏳ Pendente'}</span>
        </div>
        <div class="saldo-card">
          <span class="saldo-label"><i class="ti ti-arrows-left-right"></i> Avaliação 360°</span>
          <span class="saldo-num" style="font-size:16px">${total360 > 0 ? `${concl360}/${total360} respondidas` : '⏳ Não iniciada'}</span>
        </div>
        <div class="saldo-card">
          <span class="saldo-label"><i class="ti ti-briefcase"></i> Avaliação gestor</span>
          <span class="saldo-num" style="font-size:16px">${gestorAval ? `✅ ${gestorAval.nota?.toFixed(1)}` : '⏳ Pendente'}</span>
        </div>
        ${ciclo.media_final != null ? `
        <div class="saldo-card" style="background:var(--accent-bg);border-color:rgba(29,78,216,0.2)">
          <span class="saldo-label" style="color:var(--accent)"><i class="ti ti-chart-bar"></i> Média final</span>
          <span class="saldo-num" style="color:var(--accent)">${ciclo.media_final.toFixed(1)}</span>
        </div>` : ''}
      </div>

      <!-- Ações por etapa -->
      <div style="display:flex;flex-direction:column;gap:12px">

        ${ciclo.status !== 'encerrado' && !config360.length ? `
        <div class="ciclo-card">
          <p style="font-weight:600;margin-bottom:8px"><i class="ti ti-settings"></i> Configurar avaliadores 360°</p>
          <p style="font-size:13px;color:var(--text-2);margin-bottom:12px">Selecione de 3 a 5 pares que avaliarão ${colNome} anonimamente.</p>
          <button class="btn-primary" onclick="Desenvolvimento.openConfigurar360('${cicloId}', '${colUid}', '${colNome.replace(/'/g,"\\'")}')">
            <i class="ti ti-users"></i> Selecionar avaliadores
          </button>
        </div>` : ''}

        ${config360.length > 0 && !autoAval ? `
        <div class="ciclo-card">
          <p style="font-size:13px;color:var(--text-2)"><i class="ti ti-clock"></i> Aguardando autoavaliação de <strong>${colNome}</strong></p>
        </div>` : ''}

        ${prontoGest && !gestorAval ? `
        <div class="ciclo-card" style="border-color:var(--accent)">
          <p style="font-weight:600;margin-bottom:8px;color:var(--accent)"><i class="ti ti-clipboard-check"></i> Sua vez de avaliar!</p>
          <p style="font-size:13px;color:var(--text-2);margin-bottom:12px">Todos os pares já responderam. Faça sua avaliação de ${colNome}.</p>
          <button class="btn-primary" onclick="Desenvolvimento.openAvalGestor('${cicloId}', '${colUid}', '${colNome.replace(/'/g,"\\'")}')">
            <i class="ti ti-pencil"></i> Avaliar agora
          </button>
        </div>` : ''}

        ${gestorAval && !liberado ? `
        <div class="ciclo-card" style="border-color:var(--success)">
          <p style="font-weight:600;margin-bottom:8px;color:var(--success)"><i class="ti ti-chart-bar"></i> Avaliações concluídas!</p>
          <p style="font-size:13px;color:var(--text-2);margin-bottom:12px">Escreva o feedback e crie o PDI para liberar o resultado para ${colNome}.</p>
          <button class="btn-primary" onclick="Desenvolvimento.openConsolidado('${cicloId}', '${colUid}')">
            <i class="ti ti-send"></i> Ver resultado e liberar
          </button>
        </div>` : ''}

        ${liberado ? `
        <div class="ciclo-card">
          <p style="font-weight:600;margin-bottom:12px"><i class="ti ti-check"></i> Resultado liberado para ${colNome}</p>

          ${(ciclo.pdis_ciclo?.[colUid] || []).length > 0 ? `
          <p style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">PDI</p>
          ${(ciclo.pdis_ciclo?.[colUid] || []).map((p, i) => {
            // Busca status real da coleção pdis
            return `<div class="pdi-status-row" id="pdi-row-${i}" data-uid="${colUid}" data-titulo="${p.titulo.replace(/"/g,'&quot;')}">
              <span class="pdi-titulo" style="font-size:13px">${p.titulo}</span>
              <span class="badge badge-default pdi-status-badge" id="pdi-status-${i}">Carregando...</span>
              ${p.prazo ? `<span style="font-size:11px;color:var(--text-3)"><i class="ti ti-calendar"></i> ${App.formatDate(p.prazo)}</span>` : ''}
            </div>`;
          }).join('')}
          <script>
            (async () => {
              const rows = document.querySelectorAll('[data-uid="${colUid}"]');
              for (let i = 0; i < rows.length; i++) {
                const titulo = rows[i].dataset.titulo;
                const snap = await db.collection('pdis').where('uid','==','${colUid}').where('titulo','==',titulo).get();
                const badge = document.getElementById('pdi-status-' + i);
                if (badge && !snap.empty) {
                  const st = snap.docs[0].data().status || 'pendente';
                  badge.textContent = st === 'concluido' ? 'Concluído' : st === 'em_andamento' ? 'Em andamento' : 'Pendente';
                  badge.className = 'badge ' + (st === 'concluido' ? 'badge-success' : st === 'em_andamento' ? 'badge-warning' : 'badge-default') + ' pdi-status-badge';
                }
              }
            })();
          </script>` : '<p style="font-size:13px;color:var(--text-3)">Nenhum PDI cadastrado</p>'}

          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
            <button class="btn-secondary" onclick="Desenvolvimento.openConsolidado('${cicloId}', '${colUid}')">
              <i class="ti ti-eye"></i> Ver consolidado completo
            </button>
          </div>
        </div>` : ''}

      </div>
    `;
  },

  // ─── CONFIGURAR 360° para um colaborador ────

  async openConfigurar360(cicloId, avaliadoUid, avaliadoNome) {
    const dept = App.currentUserData.departamento || '';
    const snap = await db.collection('usuarios').get();
    const equipe = snap.docs.map(d => d.data())
      .filter(u => u.uid !== avaliadoUid && (!dept || u.departamento === dept));

    const cicloDoc = await db.collection('ciclos').doc(cicloId).get();
    const jaConf = cicloDoc.data().config_360?.[avaliadoUid] || [];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-conf360';
    overlay.innerHTML = `
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3>Avaliadores 360° — ${avaliadoNome}</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-conf360').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--text-2);margin-bottom:14px">Selecione de <strong>3 a 5 pares</strong> que avaliarão ${avaliadoNome} anonimamente.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${equipe.map(u => `
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:8px 10px;border-radius:8px;border:1px solid var(--border)">
                <input type="checkbox" class="cb-360" value="${u.uid}" ${jaConf.includes(u.uid) ? 'checked' : ''}>
                <div>
                  <p style="font-weight:500">${u.nome}</p>
                  <p style="font-size:11px;color:var(--text-3)">${u.funcao || ''}</p>
                </div>
              </label>`).join('')}
          </div>
          <p id="cnt-360" style="font-size:12px;color:var(--text-3);margin-top:10px">${jaConf.length} de 5 selecionados</p>
          <p id="err-360" style="color:#E24B4A;font-size:13px;margin-top:4px;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-conf360').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarConf360('${cicloId}','${avaliadoUid}')">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.querySelectorAll('.cb-360').forEach(cb => {
      cb.addEventListener('change', () => {
        const t = document.querySelectorAll('.cb-360:checked').length;
        document.getElementById('cnt-360').textContent = `${t} de 5 selecionados`;
        if (t > 5) cb.checked = false;
      });
    });
  },

  async salvarConf360(cicloId, avaliadoUid) {
    const selecionados = [...document.querySelectorAll('.cb-360:checked')].map(c => c.value);
    const erro = document.getElementById('err-360');
    if (selecionados.length < 3 || selecionados.length > 5) {
      erro.textContent = 'Selecione entre 3 e 5 avaliadores.'; return;
    }

    await db.collection('ciclos').doc(cicloId).update({
      [`config_360.${avaliadoUid}`]: selecionados,
      status: 'em_andamento'
    });

    document.getElementById('modal-conf360').remove();
    this.abrirPainelCiclo(cicloId);
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
          <p style="font-size:13px;color:var(--text-2);margin-bottom:16px">Suas respostas só serão visíveis após o ciclo completo.</p>
          ${this.renderCriterios('auto')}
          <label class="form-label" style="margin-top:16px">Comentário (opcional)</label>
          <textarea class="inp" id="auto-coment" rows="3" placeholder="Pontos que você gostaria de destacar..."></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-auto').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarAutoavaliacao('${cicloId}')">Enviar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  renderCriterios(pfx) {
    return [
      { id: 'entrega',     label: 'Entrega de resultados' },
      { id: 'comunicacao', label: 'Comunicação e colaboração' },
      { id: 'iniciativa',  label: 'Iniciativa e proatividade' },
      { id: 'tecnico',     label: 'Conhecimento técnico' },
    ].map(c => `
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
    const uid   = App.currentUser.uid;
    const nota  = this.calcMedia('auto');
    const coment = document.getElementById('auto-coment').value.trim();

    await db.collection('ciclos').doc(cicloId).update({
      [`avaliacoes.${uid}_auto`]: { nota, comentario: coment, criadoEm: new Date().toISOString() }
    });

    // Cria solicitações 360 para os pares
    const cicloDoc = await db.collection('ciclos').doc(cicloId).get();
    const pares = cicloDoc.data().config_360?.[uid] || [];
    for (const parUid of pares) {
      const jaExiste = await db.collection('avaliacoes_360')
        .where('ciclo_id','==',cicloId).where('avaliador_uid','==',parUid).get();
      if (jaExiste.empty) {
        await db.collection('avaliacoes_360').add({
          ciclo_id: cicloId, avaliado_uid: uid, avaliador_uid: parUid,
          status: 'pendente', criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    document.getElementById('modal-auto').remove();
    this.render();
  },

  // ─── RESPONDER 360° ─────────────────────────

  async openPendentes360() {
    const uid = App.currentUser.uid;
    const snap = await db.collection('avaliacoes_360')
      .where('avaliador_uid','==',uid).where('status','==','pendente').get();
    const pendentes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!pendentes.length) { this.render(); return; }

    const aval = pendentes[0];
    const avalDoc = await db.collection('usuarios').doc(aval.avaliado_uid).get();
    const avaliado = avalDoc.data();

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
          <p style="font-size:13px;color:var(--text-2);margin-bottom:4px">Avalie <strong>${avaliado?.nome}</strong> com honestidade.</p>
          <p style="font-size:12px;color:var(--text-3);margin-bottom:16px"><i class="ti ti-lock"></i> Sua identidade não será revelada.</p>
          ${this.renderCriterios('p360')}
          <label class="form-label" style="margin-top:16px">Comentário (opcional)</label>
          <textarea class="inp" id="p360-coment" rows="3" placeholder="Observações..."></textarea>
          <p style="font-size:12px;color:var(--text-3);margin-top:6px">${pendentes.length} avaliação${pendentes.length>1?'ões':''} pendente${pendentes.length>1?'s':''}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-360resp').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvar360Resp('${aval.id}','${aval.ciclo_id}','${aval.avaliado_uid}')">Enviar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  async salvar360Resp(avalId, cicloId, avaliadoUid) {
    const nota = this.calcMedia('p360');
    const coment = document.getElementById('p360-coment').value.trim();

    await db.collection('avaliacoes_360').doc(avalId).update({
      status: 'concluido', nota, comentario: coment,
      concluidoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Verifica se todos os pares responderam
    const restSnap = await db.collection('avaliacoes_360')
      .where('ciclo_id','==',cicloId).where('avaliado_uid','==',avaliadoUid).where('status','==','pendente').get();

    if (restSnap.empty) {
      const todasSnap = await db.collection('avaliacoes_360')
        .where('ciclo_id','==',cicloId).where('avaliado_uid','==',avaliadoUid).get();
      const notas = todasSnap.docs.map(d => d.data().nota).filter(n => n != null);
      const m360  = notas.reduce((a,b) => a+b, 0) / notas.length;
      await db.collection('ciclos').doc(cicloId).update({
        [`media_360.${avaliadoUid}`]: m360,
        [`pronto_para_gestor.${avaliadoUid}`]: true,
        etapa_atual: 'gestor'
      });
    }

    document.getElementById('modal-360resp').remove();
    this.render();
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
          <label class="form-label" style="margin-top:16px">Comentário</label>
          <textarea class="inp" id="gest-coment" rows="3" placeholder="Pontos de destaque e desenvolvimento..."></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-gest').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarAvalGestor('${cicloId}','${avaliadoUid}')">Salvar avaliação</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  async salvarAvalGestor(cicloId, avaliadoUid) {
    const nota   = this.calcMedia('gest');
    const coment = document.getElementById('gest-coment').value.trim();

    await db.collection('ciclos').doc(cicloId).update({
      [`avaliacoes_gestor.${avaliadoUid}`]: { nota, comentario: coment, criadoEm: new Date().toISOString() },
      etapa_atual: 'resultado'
    });

    document.getElementById('modal-gest').remove();
    this.abrirPainelCiclo(cicloId);
  },

  // ─── CONSOLIDADO ────────────────────────────

  async openConsolidado(cicloId, avaliadoUid) {
    const cicloDoc = await db.collection('ciclos').doc(cicloId).get();
    const ciclo    = cicloDoc.data();
    const avalDoc  = await db.collection('usuarios').doc(avaliadoUid).get();
    const avaliado = avalDoc.data();

    const autoNota   = ciclo.avaliacoes?.[avaliadoUid + '_auto']?.nota || null;
    const autoComent = ciclo.avaliacoes?.[avaliadoUid + '_auto']?.comentario || '';
    const m360       = ciclo.media_360?.[avaliadoUid] || null;
    const gestNota   = ciclo.avaliacoes_gestor?.[avaliadoUid]?.nota || null;
    const gestComent = ciclo.avaliacoes_gestor?.[avaliadoUid]?.comentario || '';

    const snap360 = await db.collection('avaliacoes_360')
      .where('ciclo_id','==',cicloId).where('avaliado_uid','==',avaliadoUid).get();
    const coments360 = snap360.docs.map(d => d.data().comentario).filter(Boolean);

    const partes = [autoNota, m360, gestNota].filter(v => v != null);
    const media  = partes.length ? partes.reduce((a,b)=>a+b,0)/partes.length : null;

    if (media != null) {
      await db.collection('ciclos').doc(cicloId).update({ media_final: media });
    }

    const pdisAtuais = ciclo.pdis_ciclo?.[avaliadoUid] || [];
    const feedbackAtual = ciclo.feedbacks_gestor?.[avaliadoUid] || '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-consol';
    overlay.innerHTML = `
      <div class="modal" style="max-width:580px">
        <div class="modal-header">
          <h3>Resultado — ${avaliado?.nome}</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-consol').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="max-height:72vh;overflow-y:auto">

          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
            ${[
              { label: 'Autoavaliação', val: autoNota },
              { label: '360°', val: m360 },
              { label: 'Gestor', val: gestNota },
              { label: 'Média final', val: media, destaque: true }
            ].map(n => `
              <div style="text-align:center;padding:12px;background:${n.destaque?'var(--accent-bg)':'var(--bg)'};border-radius:var(--radius);border:1px solid var(--border)">
                <p style="font-size:11px;color:var(--text-2);margin-bottom:4px">${n.label}</p>
                <p style="font-size:${n.destaque?'22px':'18px'};font-weight:700;color:${n.destaque?'var(--accent)':'var(--text)'}">${n.val!=null?n.val.toFixed(1):'—'}</p>
              </div>`).join('')}
          </div>

          ${autoComent ? `<div style="margin-bottom:14px"><p style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px">Comentário — Autoavaliação</p><p style="font-size:13px;padding:10px;background:var(--bg);border-radius:8px">${autoComent}</p></div>` : ''}
          ${coments360.length > 0 ? `<div style="margin-bottom:14px"><p style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px">Comentários 360° (anônimos)</p>${coments360.map(c=>`<p style="font-size:13px;padding:8px 10px;background:var(--bg);border-radius:8px;margin-bottom:6px">"${c}"</p>`).join('')}</div>` : ''}
          ${gestComent ? `<div style="margin-bottom:14px"><p style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px">Comentário do gestor</p><p style="font-size:13px;padding:10px;background:var(--bg);border-radius:8px">${gestComent}</p></div>` : ''}

          <hr style="border:none;border-top:1px solid var(--border);margin:18px 0">
          <p style="font-weight:600;font-size:14px;margin-bottom:10px">Feedback para ${avaliado?.nome}</p>
          <textarea class="inp" id="consol-feedback" rows="3" placeholder="Escreva um feedback que o colaborador verá...">${feedbackAtual}</textarea>

          <hr style="border:none;border-top:1px solid var(--border);margin:18px 0">
          <p style="font-weight:600;font-size:14px;margin-bottom:10px">Plano de Desenvolvimento Individual</p>
          <div id="pdi-lista">
            ${pdisAtuais.map((p,i) => `
              <div style="display:flex;gap:8px;margin-bottom:8px">
                <input class="inp" style="flex:1" id="pdi-${i}-titulo" value="${p.titulo}" placeholder="Meta">
                <input class="inp" style="width:130px" type="date" id="pdi-${i}-prazo" value="${p.prazo||''}">
              </div>`).join('')}
          </div>
          <button class="btn-secondary" style="font-size:12px" onclick="Desenvolvimento.addPdiLinha()">
            <i class="ti ti-plus"></i> Adicionar meta
          </button>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-consol').remove()">Fechar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarConsolidado('${cicloId}','${avaliadoUid}')">
            <i class="ti ti-send"></i> Salvar e liberar resultado
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  addPdiLinha() {
    const lista = document.getElementById('pdi-lista');
    const i = lista.children.length;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px';
    div.innerHTML = `
      <input class="inp" style="flex:1" id="pdi-${i}-titulo" placeholder="Meta de desenvolvimento">
      <input class="inp" style="width:130px" type="date" id="pdi-${i}-prazo">`;
    lista.appendChild(div);
  },

  async salvarConsolidado(cicloId, avaliadoUid) {
    const feedback = document.getElementById('consol-feedback').value.trim();
    const lista    = document.getElementById('pdi-lista');
    const pdis     = [];
    for (let i = 0; i < lista.children.length; i++) {
      const titulo = document.getElementById(`pdi-${i}-titulo`)?.value.trim();
      const prazo  = document.getElementById(`pdi-${i}-prazo`)?.value;
      if (titulo) pdis.push({ titulo, prazo: prazo || '' });
    }

    await db.collection('ciclos').doc(cicloId).update({
      [`feedbacks_gestor.${avaliadoUid}`]: feedback,
      [`pdis_ciclo.${avaliadoUid}`]: pdis,
      [`resultados_liberados.${avaliadoUid}`]: true
    });

    for (const p of pdis) {
      const ex = await db.collection('pdis')
        .where('uid','==',avaliadoUid).where('titulo','==',p.titulo).where('ciclo_id','==',cicloId).get();
      if (ex.empty) {
        await db.collection('pdis').add({
          uid: avaliadoUid, ciclo_id: cicloId,
          titulo: p.titulo, prazo: p.prazo,
          status: 'pendente', descricao: '',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    document.getElementById('modal-consol').remove();
    this.abrirPainelCiclo(cicloId);
  },

  // ─── RESULTADO DO COLABORADOR ────────────────

  async verMeuResultado(cicloId) {
    const uid = App.currentUser.uid;
    const cicloDoc = await db.collection('ciclos').doc(cicloId).get();
    const ciclo = cicloDoc.data();

    const autoNota = ciclo.avaliacoes?.[uid + '_auto']?.nota || null;
    const m360     = ciclo.media_360?.[uid] || null;
    const gestNota = ciclo.avaliacoes_gestor?.[uid]?.nota || null;
    const feedback = ciclo.feedbacks_gestor?.[uid] || '';
    const pdis     = ciclo.pdis_ciclo?.[uid] || [];
    const partes   = [autoNota, m360, gestNota].filter(v => v != null);
    const media    = partes.length ? partes.reduce((a,b)=>a+b,0)/partes.length : null;

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
              {label:'Autoavaliação',val:autoNota},
              {label:'360°',val:m360},
              {label:'Gestor',val:gestNota},
              {label:'Média final',val:media,destaque:true}
            ].map(n=>`
              <div style="text-align:center;padding:12px;background:${n.destaque?'var(--accent-bg)':'var(--bg)'};border-radius:var(--radius);border:1px solid var(--border)">
                <p style="font-size:11px;color:var(--text-2);margin-bottom:4px">${n.label}</p>
                <p style="font-size:${n.destaque?'22px':'18px'};font-weight:700;color:${n.destaque?'var(--accent)':'var(--text)'}">${n.val!=null?n.val.toFixed(1):'—'}</p>
              </div>`).join('')}
          </div>
          ${feedback ? `
          <div style="margin-bottom:18px;padding:14px;background:var(--accent-bg);border-radius:var(--radius)">
            <p style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:6px"><i class="ti ti-message-circle"></i> Feedback do gestor</p>
            <p style="font-size:13px">${feedback}</p>
          </div>` : ''}
          ${pdis.length > 0 ? `
          <p style="font-weight:600;font-size:14px;margin-bottom:10px">Meu PDI</p>
          ${pdis.map(p=>`
            <div class="pdi-card">
              <div class="pdi-header"><span class="pdi-titulo">${p.titulo}</span></div>
              ${p.prazo?`<p style="font-size:12px;color:var(--text-3)"><i class="ti ti-calendar"></i> Prazo: ${App.formatDate(p.prazo)}</p>`:''}
            </div>`).join('')}` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn-primary" onclick="document.getElementById('modal-meuresult').remove()">Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  // ─── FEEDBACK PONTUAL ───────────────────────

  async openFeedback() {
    const dept = App.currentUserData.departamento || '';
    const snap = await db.collection('usuarios').get();
    const colegas = snap.docs.map(d => d.data())
      .filter(u => u.uid !== App.currentUser.uid && (!dept || u.departamento === dept));

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
            ${colegas.map(c=>`<option value="${c.uid}">${c.nome}</option>`).join('')}
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

  openNovoPDI() { this._modalPDI(null, null); },
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
          <h3>${id ? 'Editar meta' : 'Nova meta'}</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-pdi').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <label class="form-label">Título</label>
          <input class="inp" id="pdi-titulo" value="${p?.titulo||''}">
          <label class="form-label" style="margin-top:12px">Descrição</label>
          <textarea class="inp" id="pdi-desc" rows="3">${p?.descricao||''}</textarea>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div>
              <label class="form-label">Prazo</label>
              <input class="inp" type="date" id="pdi-prazo" value="${p?.prazo||''}">
            </div>
            <div>
              <label class="form-label">Status</label>
              <select class="inp" id="pdi-status">
                <option value="pendente" ${!p||p?.status==='pendente'?'selected':''}>Pendente</option>
                <option value="em_andamento" ${p?.status==='em_andamento'?'selected':''}>Em andamento</option>
                <option value="concluido" ${p?.status==='concluido'?'selected':''}>Concluído</option>
              </select>
            </div>
          </div>
          <p id="pdi-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-pdi').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Desenvolvimento.salvarPDI('${id||''}')">Salvar</button>
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
      uid: App.currentUser.uid, nome: App.currentUserData.nome,
      departamento: App.currentUserData.departamento || '',
      titulo, descricao: desc, prazo, status,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (id) { await db.collection('pdis').doc(id).update(dados); }
    else    { dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('pdis').add(dados); }
    document.getElementById('modal-pdi').remove();
    this.render();
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

// =============================================
//  MÓDULO — DIAS BLOQUEADOS
// =============================================

const Bloqueios = {
  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="page-loading"><i class="ti ti-loader spin"></i> Carregando...</div>`;

    const dept = App.currentUserData.departamento || '';
    const snap = await db.collection('dias_bloqueados').get();
    const lista = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(b => !dept || b.departamento === dept)
      .sort((a, b) => a.data.localeCompare(b.data));

    // Separa passados e futuros
    const hoje = new Date().toISOString().split('T')[0];
    const futuros  = lista.filter(b => b.data >= hoje);
    const passados = lista.filter(b => b.data <  hoje);

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dias bloqueados</h1>
          <p class="page-sub">Datas em que ninguém pode solicitar ausência${dept ? ' · ' + dept : ''}</p>
        </div>
        <button class="btn-primary" onclick="Bloqueios.openNovo()">
          <i class="ti ti-lock"></i> Bloquear dia
        </button>
      </div>

      ${futuros.length === 0 && passados.length === 0 ? `
        <div class="empty-state">
          <i class="ti ti-lock-open" style="font-size:48px;color:var(--text-3)"></i>
          <p>Nenhum dia bloqueado ainda</p>
        </div>` : ''}

      ${futuros.length > 0 ? `
        <p class="dev-section-title" style="margin-bottom:12px"><i class="ti ti-calendar-event"></i> Próximos bloqueios</p>
        <div class="table-wrap" style="margin-bottom:28px">
          <table class="table">
            <thead><tr><th>Data</th><th>Motivo</th><th>Criado por</th><th></th></tr></thead>
            <tbody>
              ${futuros.map(b => `
                <tr>
                  <td><strong>${App.formatDate(b.data)}</strong></td>
                  <td>${b.motivo || '—'}</td>
                  <td style="font-size:12px;color:var(--text-2)">${b.criado_por_nome || '—'}</td>
                  <td style="text-align:right">
                    <button class="btn-danger" style="font-size:12px;padding:5px 10px" onclick="Bloqueios.excluir('${b.id}', '${App.formatDate(b.data)}')">
                      <i class="ti ti-trash"></i> Remover
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

      ${passados.length > 0 ? `
        <p class="dev-section-title" style="margin-bottom:12px;color:var(--text-3)"><i class="ti ti-history"></i> Histórico</p>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Data</th><th>Motivo</th></tr></thead>
            <tbody>
              ${passados.map(b => `
                <tr style="opacity:0.6">
                  <td>${App.formatDate(b.data)}</td>
                  <td>${b.motivo || '—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}
    `;
  },

  openNovo() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-bloq';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Bloquear dia</h3>
          <button class="btn-icon" onclick="document.getElementById('modal-bloq').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--text-2);margin-bottom:16px">
            Nenhum colaborador do departamento poderá abrir solicitação para este dia.
          </p>
          <label class="form-label">Data</label>
          <input class="inp" type="date" id="bloq-data">
          <label class="form-label" style="margin-top:12px">Motivo</label>
          <input class="inp" id="bloq-motivo" placeholder="Ex: Treinamento obrigatório, Pico de demanda...">
          <p id="bloq-erro" style="color:#E24B4A;font-size:13px;margin:8px 0 0;min-height:16px"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="document.getElementById('modal-bloq').remove()">Cancelar</button>
          <button class="btn-primary" onclick="Bloqueios.salvar()"><i class="ti ti-lock"></i> Bloquear</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async salvar() {
    const data   = document.getElementById('bloq-data').value;
    const motivo = document.getElementById('bloq-motivo').value.trim();
    const erro   = document.getElementById('bloq-erro');

    if (!data)   { erro.textContent = 'Selecione uma data.'; return; }
    if (!motivo) { erro.textContent = 'Informe o motivo.'; return; }

    const dept = App.currentUserData.departamento || '';

    // Verifica se já existe bloqueio nessa data
    const existe = await db.collection('dias_bloqueados')
      .where('data', '==', data)
      .where('departamento', '==', dept)
      .get();
    if (!existe.empty) { erro.textContent = 'Este dia já está bloqueado.'; return; }

    await db.collection('dias_bloqueados').add({
      data, motivo,
      departamento: dept,
      criado_por: App.currentUser.uid,
      criado_por_nome: App.currentUserData.nome,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById('modal-bloq').remove();
    this.render();
  },

  async excluir(id, dataFmt) {
    if (!confirm(`Remover o bloqueio do dia ${dataFmt}?`)) return;
    await db.collection('dias_bloqueados').doc(id).delete();
    this.render();
  }
};
