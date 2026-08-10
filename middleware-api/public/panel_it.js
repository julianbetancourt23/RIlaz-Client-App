/* Panel IT · Rilaz Clientes — lógica del panel (vanilla JS, sin dependencias). */
(() => {
  'use strict';

  // ── Estado ──
  let token = localStorage.getItem('it_token') || null;
  let currentSection = 'dashboard';
  let filtroPedidos = '';
  let filtroServicios = '';
  let filtroCatalogo = '';
  let detailDoc = null;

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;
  const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

  const KIND_LABEL = { eq: 'Insumos', sv: 'Servicio', ct: 'Cotización' };
  const KIND_BADGE = { eq: 'badge-blue', sv: 'badge-orange', ct: 'badge-purple' };
  const URG_BADGE = { Baja: 'badge-gray', Media: 'badge-orange', Alta: 'badge-red' };

  /** Badge for the wizard's "Tipo de servicio" (with legacy-urgency fallback). */
  const serviceTypeBadge = (d) => {
    if (d.serviceType === 'Insumo') return '<span class="badge badge-blue">Insumo</span>';
    if (d.serviceType) return '<span class="badge badge-orange">Correctivo</span>';
    if (d.urgency) return `<span class="badge ${URG_BADGE[d.urgency] || 'badge-gray'}">${esc(d.urgency)}</span>`;
    return '<span class="muted">—</span>';
  };

  const statusBadge = (s) =>
    s === 'nuevo'
      ? '<span class="badge badge-orange">nuevo</span>'
      : '<span class="badge badge-green">procesado</span>';

  // ── API ──
  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    if (res.status === 401 && path !== '/it/login') {
      logout();
      throw new Error('Sesión expirada');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  // ── Toasts ──
  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ── Login / logout ──
  function showPanel() {
    $('login-screen').style.display = 'none';
    loadSection(currentSection);
  }

  function logout() {
    token = null;
    localStorage.removeItem('it_token');
    $('login-screen').style.display = 'flex';
    $('login-password').value = '';
  }

  async function login() {
    const password = $('login-password').value;
    const errEl = $('login-error');
    errEl.style.display = 'none';
    try {
      const { token: t } = await api('/it/login', { method: 'POST', body: JSON.stringify({ password }) });
      token = t;
      localStorage.setItem('it_token', t);
      showPanel();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  }

  // ── Navegación ──
  const TITLES = {
    dashboard: 'Dashboard',
    pedidos: 'Pedidos de insumos',
    servicios: 'Servicios y cotizaciones',
    clientes: 'Gestión de clientes',
    catalogo: 'Catálogo de insumos',
  };

  function goTo(section) {
    currentSection = section;
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.section === section));
    document.querySelectorAll('.section').forEach((s) => s.classList.toggle('active', s.id === `section-${section}`));
    $('topbar-title').textContent = TITLES[section];
    loadSection(section);
  }

  function loadSection(section) {
    if (section === 'dashboard') loadDashboard();
    if (section === 'pedidos') loadPedidos();
    if (section === 'servicios') loadServicios();
    if (section === 'clientes') loadClientes();
    if (section === 'catalogo') loadCatalogo();
  }

  const loadingRow = (cols) =>
    `<tr><td colspan="${cols}"><div class="loading"><div class="spinner"></div>Cargando…</div></td></tr>`;
  const emptyRow = (cols, msg) => `<tr><td colspan="${cols}"><div class="empty">${msg}</div></td></tr>`;

  // ── Dashboard ──
  async function loadDashboard() {
    try {
      const [stats, docs] = await Promise.all([api('/it/stats'), api('/it/documents')]);
      $('stat-clientes').textContent = stats.clientes;
      $('stat-pedidos').textContent = stats.pedidos;
      $('stat-servicios').textContent = stats.servicios + stats.cotizaciones;
      $('stat-nuevos').textContent = stats.nuevos;
      $('mode-badge').textContent = stats.sap.mode === 'mock' ? 'MOCK' : 'SAP';
      $('status-label').textContent = stats.sap.detail;
      const rows = docs.slice(0, 8).map(
        (d) => `
        <tr class="clickable" data-doc="${d.id}">
          <td class="mono">${esc(d.folio)}</td>
          <td><span class="badge ${KIND_BADGE[d.kind]}">${KIND_LABEL[d.kind]}</span></td>
          <td>${esc(d.company)}</td>
          <td class="text-sm">${fecha(d.createdAt)}</td>
          <td>${statusBadge(d.status)}</td>
        </tr>`,
      );
      $('tbody-dash').innerHTML = rows.join('') || emptyRow(5, 'Aún no hay solicitudes — crea una desde la app.');
      bindDocRows($('tbody-dash'), docs);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Pedidos ──
  async function loadPedidos() {
    const tb = $('tbody-pedidos');
    tb.innerHTML = loadingRow(7);
    try {
      const docs = await api(`/it/documents?kind=eq${filtroPedidos ? `&status=${filtroPedidos}` : ''}`);
      const rows = docs.map((d) => {
        const units = (d.lines || []).reduce((a, l) => a + l.qty, 0);
        return `
        <tr class="clickable" data-doc="${d.id}">
          <td class="mono">${esc(d.folio)}</td>
          <td>${esc(d.company)}</td>
          <td class="text-sm">${units} uds · ${(d.lines || []).length} SKU</td>
          <td class="mono">${money(d.total)}</td>
          <td class="text-sm">${fecha(d.createdAt)}</td>
          <td>${statusBadge(d.status)}</td>
          <td><button class="btn btn-secondary btn-sm">Ver</button></td>
        </tr>`;
      });
      tb.innerHTML = rows.join('') || emptyRow(7, 'No hay pedidos con este filtro.');
      bindDocRows(tb, docs);
    } catch (e) {
      tb.innerHTML = emptyRow(7, e.message);
    }
  }

  // ── Servicios / cotizaciones ──
  async function loadServicios() {
    const tb = $('tbody-servicios');
    tb.innerHTML = loadingRow(8);
    try {
      let docs = await api('/it/documents');
      docs = docs.filter((d) => (filtroServicios ? d.kind === filtroServicios : d.kind !== 'eq'));
      const rows = docs.map((d) => {
        let detalle;
        if (d.kind === 'sv' && d.serviceType) {
          // Wizard ticket: equipo + (insumo pedido, si aplica)
          const equipo = [d.brand, d.machine && d.machine.model].filter(Boolean).join(' ');
          detalle = esc([equipo, d.supplyType].filter(Boolean).join(' · '));
        } else if (d.kind === 'sv') {
          detalle = `${esc(d.problem)}${d.machine ? ` · ${esc(d.machine.model)}` : ''}`;
        } else {
          detalle = esc((d.description || '').slice(0, 60));
        }
        return `
        <tr class="clickable" data-doc="${d.id}">
          <td class="mono">${esc(d.folio)}</td>
          <td><span class="badge ${KIND_BADGE[d.kind]}">${KIND_LABEL[d.kind]}</span></td>
          <td>${esc(d.company)}</td>
          <td class="text-sm">${detalle}</td>
          <td>${d.kind === 'sv' ? serviceTypeBadge(d) : '<span class="muted">—</span>'}</td>
          <td class="text-sm">${fecha(d.createdAt)}</td>
          <td>${statusBadge(d.status)}</td>
          <td><button class="btn btn-secondary btn-sm">Ver</button></td>
        </tr>`;
      });
      tb.innerHTML = rows.join('') || emptyRow(8, 'No hay solicitudes con este filtro.');
      bindDocRows(tb, docs);
    } catch (e) {
      tb.innerHTML = emptyRow(8, e.message);
    }
  }

  // ── Detalle de documento ──
  function bindDocRows(tbody, docs) {
    tbody.querySelectorAll('tr[data-doc]').forEach((tr) => {
      tr.addEventListener('click', () => {
        const doc = docs.find((d) => d.id === tr.dataset.doc);
        if (doc) openDetail(doc);
      });
    });
  }

  function openDetail(doc) {
    detailDoc = doc;
    $('detail-title').textContent = `${KIND_LABEL[doc.kind]} · ${doc.folio}`;
    let html = `<table class="detail-table">
      <tr><td>Cliente</td><td>${esc(doc.company)} <span class="muted mono">(${esc(doc.cardCode)})</span></td></tr>
      <tr><td>Fecha</td><td>${fecha(doc.createdAt)}</td></tr>
      <tr><td>Estado</td><td>${statusBadge(doc.status)}</td></tr>`;
    if (doc.kind === 'eq') {
      html += `<tr><td>Entrega</td><td>${esc(doc.deliveryAddress || 'No especificada')}</td></tr>`;
      html += `<tr><td>Artículos</td><td>
        <table class="lines-table">
          <tr><th>Artículo</th><th>SKU</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr>
          ${(doc.lines || [])
            .map(
              (l) =>
                `<tr><td>${esc(l.name)}</td><td class="mono">${esc(l.sku)}</td><td>${l.qty} ${esc(l.unit)}</td><td class="mono">${money(l.unitPrice)}</td><td class="mono">${money(l.unitPrice * l.qty)}</td></tr>`,
            )
            .join('')}
          <tr><td colspan="4"><strong>Total</strong></td><td class="mono"><strong>${money(doc.total)}</strong></td></tr>
        </table>
      </td></tr>`;
    }
    if (doc.kind === 'sv' && doc.serviceType) {
      // Solicitud de Servicio Técnico (wizard de 4 páginas de la app)
      const mapLink =
        Number.isFinite(doc.branchLat) && Number.isFinite(doc.branchLon)
          ? ` <a class="map-link" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${doc.branchLat}&mlon=${doc.branchLon}#map=17/${doc.branchLat}/${doc.branchLon}">Ver en mapa</a>`
          : '';
      html += `<tr><td>Empresa / Institución</td><td>${esc(doc.reportedCompany || doc.company)}</td></tr>
        <tr><td>Sucursal / Ubicación</td><td>${esc(doc.branch || '—')}${mapLink}</td></tr>
        <tr><td>Reporta</td><td>${esc(doc.reporterName || '—')}</td></tr>
        <tr><td>Teléfono</td><td class="mono">${esc(doc.phone || '—')}</td></tr>
        <tr><td>Marca</td><td>${esc(doc.brand || '—')}</td></tr>
        <tr><td>Equipo</td><td>${doc.machine ? `${esc(doc.machine.model)} <span class="muted mono">S/N ${esc(doc.machine.serial)}</span>` : 'No especificado'}</td></tr>
        <tr><td>Tipo de servicio</td><td>${esc(doc.serviceType)}</td></tr>`;
      if (doc.serviceType === 'Insumo') {
        html += `<tr><td>Insumo solicitado</td><td>${esc(doc.supplyType || '—')}</td></tr>
        <tr><td>Alerta de bajo nivel</td><td>${doc.lowTonerAlert === true ? 'Sí' : doc.lowTonerAlert === false ? 'No' : '—'}</td></tr>
        <tr><td>Contador actual</td><td class="mono">${esc(doc.counter || '—')}</td></tr>`;
      }
      if (doc.description) {
        html += `<tr><td>Descripción</td><td>${esc(doc.description)}</td></tr>`;
      }
    } else if (doc.kind === 'sv') {
      // Ticket antiguo (formulario "Solicitar mantenimiento" previo al wizard)
      html += `<tr><td>Equipo</td><td>${doc.machine ? `${esc(doc.machine.model)} <span class="muted mono">S/N ${esc(doc.machine.serial)}</span>` : 'No especificado'}</td></tr>
        <tr><td>Problema</td><td>${esc(doc.problem)}</td></tr>
        <tr><td>Urgencia</td><td><span class="badge ${URG_BADGE[doc.urgency] || 'badge-gray'}">${esc(doc.urgency)}</span></td></tr>
        <tr><td>Ubicación</td><td>${esc(doc.serviceAddress || '—')}</td></tr>
        <tr><td>Teléfono</td><td class="mono">${esc(doc.phone || '—')}</td></tr>
        <tr><td>Contrato</td><td>${esc(doc.contractType || '—')}</td></tr>
        <tr><td>Descripción</td><td>${esc(doc.description || '—')}</td></tr>`;
    }
    if (doc.kind === 'ct') {
      html += `<tr><td>Descripción</td><td>${esc(doc.description || '—')}</td></tr>`;
    }
    html += '</table>';
    $('detail-body').innerHTML = html;
    const btn = $('btn-toggle-status');
    btn.textContent = doc.status === 'nuevo' ? 'Marcar como procesado' : 'Marcar como nuevo';
    btn.className = doc.status === 'nuevo' ? 'btn btn-success' : 'btn btn-secondary';
    $('modal-detail').classList.add('open');
  }

  async function toggleStatus() {
    if (!detailDoc) return;
    const next = detailDoc.status === 'nuevo' ? 'procesado' : 'nuevo';
    try {
      await api(`/it/documents/${detailDoc.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      toast(`${detailDoc.folio} marcado como ${next}`);
      $('modal-detail').classList.remove('open');
      loadSection(currentSection);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Clientes ──
  async function loadClientes() {
    const tb = $('tbody-clientes');
    tb.innerHTML = loadingRow(7);
    try {
      const clientes = await api('/it/customers');
      const rows = clientes.map(
        (c) => `
        <tr>
          <td>${esc(c.company) || '<span class="muted">—</span>'}</td>
          <td>${esc(c.name) || '<span class="muted">—</span>'}</td>
          <td class="text-sm">${esc(c.email)}</td>
          <td class="mono">${esc(c.cardCode) || '<span class="muted">—</span>'}</td>
          <td class="text-sm">${fecha(c.lastLogin)}</td>
          <td>${c.isActive ? '<span class="badge badge-green">activo</span>' : '<span class="badge badge-red">inactivo</span>'}</td>
          <td class="action-group">
            <button class="btn btn-sm ${c.isActive ? 'btn-danger' : 'btn-success'}" data-toggle="${c.id}" data-active="${c.isActive}">
              ${c.isActive ? 'Desactivar' : 'Activar'}
            </button>
            <button class="btn btn-secondary btn-sm" data-pw="${c.id}" data-email="${esc(c.email)}">Contraseña</button>
          </td>
        </tr>`,
      );
      tb.innerHTML = rows.join('') || emptyRow(7, 'No hay clientes.');
      tb.querySelectorAll('[data-toggle]').forEach((b) =>
        b.addEventListener('click', async () => {
          try {
            await api(`/it/customers/${b.dataset.toggle}`, {
              method: 'PATCH',
              body: JSON.stringify({ isActive: b.dataset.active !== 'true' }),
            });
            toast('Cliente actualizado');
            loadClientes();
          } catch (e) {
            toast(e.message, 'error');
          }
        }),
      );
      tb.querySelectorAll('[data-pw]').forEach((b) =>
        b.addEventListener('click', () => {
          $('pw-title').textContent = `Restablecer contraseña · ${b.dataset.email}`;
          $('pw-value').value = '';
          $('pw-error').style.display = 'none';
          $('btn-save-password').dataset.customer = b.dataset.pw;
          $('modal-password').classList.add('open');
        }),
      );
    } catch (e) {
      tb.innerHTML = emptyRow(7, e.message);
    }
  }

  async function saveCustomer() {
    const err = $('nc-error');
    err.style.display = 'none';
    try {
      await api('/it/customers', {
        method: 'POST',
        body: JSON.stringify({
          company: $('nc-company').value,
          name: $('nc-name').value,
          email: $('nc-email').value,
          phone: $('nc-phone').value,
          cardCode: $('nc-cardcode').value,
          password: $('nc-password').value,
        }),
      });
      $('modal-customer').classList.remove('open');
      ['nc-company', 'nc-name', 'nc-email', 'nc-phone', 'nc-cardcode', 'nc-password'].forEach((id) => ($(id).value = ''));
      toast('Cliente creado — ya puede iniciar sesión en la app');
      loadClientes();
    } catch (e) {
      err.textContent = e.message;
      err.style.display = 'block';
    }
  }

  async function savePassword() {
    const err = $('pw-error');
    err.style.display = 'none';
    try {
      await api(`/it/customers/${$('btn-save-password').dataset.customer}`, {
        method: 'PATCH',
        body: JSON.stringify({ password: $('pw-value').value }),
      });
      $('modal-password').classList.remove('open');
      toast('Contraseña actualizada');
    } catch (e) {
      err.textContent = e.message;
      err.style.display = 'block';
    }
  }

  // ── Catálogo ──
  async function loadCatalogo() {
    const tb = $('tbody-catalogo');
    tb.innerHTML = loadingRow(6);
    try {
      const cat = await api('/it/catalog');
      const cats = filtroCatalogo ? [filtroCatalogo] : ['toner', 'paper', 'otros'];
      const rows = [];
      for (const c of cats) {
        for (const it of cat[c] || []) {
          rows.push(`
          <tr>
            <td class="mono">${esc(it.sku)}</td>
            <td>${esc(it.name)}</td>
            <td class="text-sm">${esc(it.detail)}</td>
            <td class="text-sm">${esc(it.unit)}</td>
            <td class="mono">${money(it.price)}</td>
            <td>
              <label class="switch" title="Cambiar disponibilidad">
                <input type="checkbox" ${it.inStock ? 'checked' : ''} data-item="${esc(it.id)}">
                <span class="slider"></span>
              </label>
            </td>
          </tr>`);
        }
      }
      tb.innerHTML = rows.join('') || emptyRow(6, 'Catálogo vacío.');
      tb.querySelectorAll('input[data-item]').forEach((chk) =>
        chk.addEventListener('change', async () => {
          try {
            await api(`/it/catalog/${chk.dataset.item}`, {
              method: 'PATCH',
              body: JSON.stringify({ inStock: chk.checked }),
            });
            toast(`Stock actualizado (${chk.dataset.item}: ${chk.checked ? 'disponible' : 'agotado'})`);
          } catch (e) {
            chk.checked = !chk.checked;
            toast(e.message, 'error');
          }
        }),
      );
    } catch (e) {
      tb.innerHTML = emptyRow(6, e.message);
    }
  }

  // ── Filtros ──
  function bindFilters(containerId, attr, setter) {
    $(containerId).querySelectorAll('.filter-btn').forEach((b) =>
      b.addEventListener('click', () => {
        $(containerId).querySelectorAll('.filter-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        setter(b.dataset[attr]);
      }),
    );
  }

  // ── Tema ──
  function applyTheme(theme) {
    document.body.classList.toggle('light', theme === 'light');
    $('theme-toggle').textContent = theme === 'light' ? '☾' : '☀';
    localStorage.setItem('it_theme', theme);
  }

  // ── Init ──
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(localStorage.getItem('it_theme') || 'dark');
    $('theme-toggle').addEventListener('click', () =>
      applyTheme(document.body.classList.contains('light') ? 'dark' : 'light'),
    );

    $('login-btn').addEventListener('click', login);
    $('login-password').addEventListener('keydown', (e) => e.key === 'Enter' && login());
    $('btn-logout').addEventListener('click', logout);

    document.querySelectorAll('.nav-item').forEach((n) => n.addEventListener('click', () => goTo(n.dataset.section)));
    document.querySelectorAll('.stat-card[data-goto]').forEach((c) => c.addEventListener('click', () => goTo(c.dataset.goto)));
    document.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => $(b.dataset.close).classList.remove('open')),
    );
    document.querySelectorAll('.modal-overlay').forEach((m) =>
      m.addEventListener('click', (e) => e.target === m && m.classList.remove('open')),
    );

    $('btn-refresh-dash').addEventListener('click', loadDashboard);
    $('btn-toggle-status').addEventListener('click', toggleStatus);
    $('btn-new-customer').addEventListener('click', () => {
      $('nc-error').style.display = 'none';
      $('modal-customer').classList.add('open');
    });
    $('btn-save-customer').addEventListener('click', saveCustomer);
    $('btn-save-password').addEventListener('click', savePassword);

    bindFilters('filter-pedidos', 'status', (v) => { filtroPedidos = v; loadPedidos(); });
    bindFilters('filter-servicios', 'kind', (v) => { filtroServicios = v; loadServicios(); });
    bindFilters('filter-catalogo', 'cat', (v) => { filtroCatalogo = v; loadCatalogo(); });

    if (token) showPanel();
  });
})();
