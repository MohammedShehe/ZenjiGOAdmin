(() => {
'use strict';

const API = window.ZenjiGOAdminAPI;
const D = window.ZENJIGO_DATA;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const money = (n) => 'TZS ' + Number(n || 0).toLocaleString();
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const statusClass = (s) => /active|success|completed|verified|delivered|confirmed|approved|paid/i.test(s) ? 'success'
  : /pending|review|assigned|arriving|searching|due|investigating|under_review/i.test(s) ? 'warning'
  : /cancel|reject|restrict|critical|failed|suspended/i.test(s) ? 'danger' : 'info';
const badge = (s) => `<span class="status ${statusClass(s)}">${esc(String(s || '—').replace(/_/g, ' '))}</span>`;
const userCell = (name, sub = '', tone = 'blue', photo = '') => {
  const initials = String(name || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const av = photo
    ? `<img class="avatar avatar-img" src="${esc(photo)}" alt="" onerror="this.outerHTML='<div class=\'avatar avatar-${tone}\'>${esc(initials)}</div>'">`
    : `<div class="avatar avatar-${tone}">${esc(initials)}</div>`;
  return `<div class="table-user">${av}<div><b>${esc(name)}</b><span>${esc(sub)}</span></div></div>`;
};

function toast(msg, type = 'success') {
  const id = 't' + Date.now();
  $('#toastHost').insertAdjacentHTML('beforeend',
    `<div id="${id}" class="toast border-0 shadow-sm" role="alert"><div class="toast-body d-flex align-items-center gap-2">
      <i class="bi ${type === 'danger' ? 'bi-exclamation-circle-fill text-danger' : 'bi-check-circle-fill text-success'}"></i>
      <span class="flex-grow-1">${esc(msg)}</span>
      <button class="btn-close" data-bs-dismiss="toast"></button></div></div>`);
  const el = $('#' + id);
  new bootstrap.Toast(el, { delay: 3200 }).show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}
window.toast = toast;

function loadBtn(btn) {
  if (!btn) return Promise.resolve();
  btn.classList.add('is-loading');
  btn.disabled = true;
  return {
    done() { btn.classList.remove('is-loading'); btn.disabled = false; }
  };
}

function makeOtp(host) {
  if (!host) return;
  host.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    host.insertAdjacentHTML('beforeend', `<input class="form-control otp" maxlength="1" inputmode="numeric" aria-label="OTP digit ${i + 1}">`);
  }
  [...host.children].forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
      if (inp.value && i < 5) host.children[i + 1].focus();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && i > 0) host.children[i - 1].focus();
    });
    inp.addEventListener('paste', (e) => {
      const v = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (v.length) {
        e.preventDefault();
        v.split('').forEach((c, j) => { if (host.children[j]) host.children[j].value = c; });
        host.children[Math.min(v.length, 6) - 1].focus();
      }
    });
  });
}

/* ---------- Auth ---------- */
function showAuth(name) {
  $$('.auth-step').forEach((x) => x.classList.remove('active'));
  const el = $('#authStep' + name[0].toUpperCase() + name.slice(1));
  if (el) el.classList.add('active');
}

async function enterApp() {
  $('#authView')?.classList.add('d-none');
  $('#adminApp')?.classList.remove('d-none');
  const s = API.session();
  if (s?.admin || s?.user || s?.fullName || s?.email) {
    const name = s.fullName || s.admin?.fullName || s.user?.fullName || 'Super Admin';
    const email = s.email || s.admin?.email || s.user?.email || '';
    const av = $$('.top-profile b, .top-profile span');
    if (av[0]) av[0].textContent = name;
    if (av[1]) av[1].textContent = email;
  }
  await syncAll();
  renderPage('dashboard');
}

async function signOut() {
  await API.logout();
  $('#adminApp')?.classList.add('d-none');
  $('#authView')?.classList.remove('d-none');
  showAuth('login');
  $$('.otp').forEach((x) => (x.value = ''));
  toast('Signed out securely.');
}

/* ---------- Data sync ---------- */
async function syncAll() {
  try {
    const [dashboard, rides, drivers, archives, riders, admins, promos, payments, payouts, tours, parcels, notifications, conversations, audit, commissions, finance, settings, commissionSettings, fareSettings, cancelSettings, driverReports] = await Promise.all([
      API.get('/admin/dashboard').catch(() => ({})),
      API.get('/admin/rides').catch(() => []),
      API.get('/admin/drivers').catch(() => []),
      API.get('/admin/archives').catch(() => []),
      API.get('/admin/riders').catch(() => []),
      API.get('/admin/admins').catch(() => []),
      API.get('/admin/promos').catch(() => []),
      API.get('/admin/payments').catch(() => []),
      API.get('/admin/payouts').catch(() => []),
      API.get('/admin/tour-packages').catch(() => []),
      API.get('/admin/parcels').catch(() => []),
      API.get('/admin/notifications').catch(() => []),
      API.get('/admin/conversations').catch(() => []),
      API.get('/admin/audit-logs').catch(() => []),
      API.get('/admin/commissions').catch(() => []),
      API.get('/admin/driver-finance').catch(() => []),
      API.get('/admin/settings').catch(() => ({})),
      API.get('/admin/commission-settings').catch(() => ({ cycleLimit: 60000, percent: 20 })),
      API.get('/admin/fare-settings').catch(() => ({ baseFare: 2500, perKm: 900, perMinute: 150, bookingFee: 500, multipliers: { boda: 1, bajaji: 1.15, taxi: 1.5 }, currency: 'TZS' })),
      API.get('/admin/cancel-settings').catch(() => ({ nearPickupKm: 1, percent: 20 })),
      API.get('/admin/driver-reports').catch(() => [])
    ]);

    D.dashboard = dashboard || {};
    D.rides = (rides || []).map(mapRide);
    D.drivers = (drivers || []).map(mapDriver);
    D.archives = (archives || []).map(mapArchive);
    D.riders = (riders || []).map(mapRider);
    D.admins = (admins || []).map(mapAdmin);
    D.promos = (promos || []).map(mapPromo);
    D.payments = payments || [];
    D.payouts = (payouts || []).map(mapPayout);
    D.tours = (tours || []).map(mapTour);
    D.parcels = (parcels || []).map(mapParcel);
    D.notifications = notifications || [];
    updateIndicators();
    D.conversations = conversations || [];
    D.audit = audit || [];
    D.commissions = commissions || [];
    D.finance = finance || [];
    D.settings = settings || {};
    D.commissionSettings = commissionSettings || { cycleLimit: 60000, percent: 20 };
    D.fareSettings = fareSettings || { baseFare: 2500, perKm: 900, perMinute: 150, bookingFee: 500, multipliers: { boda: 1, bajaji: 1.15, taxi: 1.5 }, currency: 'TZS' };
    D.cancelSettings = cancelSettings || { nearPickupKm: 1, percent: 20 };
    D.driverReports = (driverReports || []).map((r) => ({
      id: r.id,
      driverId: r.driver_id || r.driverId,
      driverName: r.driver_name || r.driverName || '—',
      driverPhone: r.driver_phone || r.driverPhone || '',
      reporterName: r.reporter_name || r.reporterName || '—',
      reporterPhone: r.reporter_phone || r.reporterPhone || '',
      reason: r.reason || r.message || r.subject || '—',
      status: r.status || 'open',
      time: r.created_at || r.createdAt || '—',
      rideId: r.ride_id || r.rideId || null
    }));
  } catch (e) {
    toast('Backend sync failed: ' + e.message, 'danger');
  }
}
window.syncAll = syncAll;

function mapRide(r) {
  const driverName = r.driverName || r.driver_name || (r.driver_id ? ('Driver #' + r.driver_id) : '—');
  return {
    id: r.ride_code || r.id, dbId: r.id,
    rider: r.riderName || r.rider_name || '—',
    driver: driverName,
    type: String(r.ride_type || '').replace(/^./, (x) => x.toUpperCase()),
    from: r.pickup_address, to: r.destination_address,
    fare: Number(r.final_fare ?? r.estimated_fare ?? 0),
    status: r.status, payment: r.payment_method || 'Cash',
    time: r.created_at ? new Date(r.created_at).toLocaleString() : '—',
    pin: r.trip_pin || '—',
    distance: (r.estimated_distance_km || 0) + ' km',
    cancelReason: r.cancel_reason || r.cancelReason || '',
    cancelledAt: r.cancelled_at || r.cancelledAt || null,
    riderPhone: r.riderPhone || r.rider_phone || '',
    driverPhone: r.driverPhone || r.driver_phone || '',
    riderId: r.rider_id || r.riderId || null,
    driverId: r.driver_id || r.driverId || null,
    riderPhoto: r.riderPhoto || r.rider_photo || '',
    driverPhoto: r.driverPhoto || r.driver_photo || '',
    rating: r.rating || r.rider_rating || null,
    driverRating: r.driver_rating || r.driverRating || null,
    rawId: r.id
  };
}

function mapArchive(a) {
  return {
    id: a.id,
    originalUserId: a.originalUserId || a.original_user_id,
    role: a.role || '—',
    name: a.fullName || a.full_name || '—',
    phone: a.phone || '—',
    email: a.email || '—',
    reason: a.archiveReason || a.archive_reason || '',
    archivedAt: a.archivedAt || a.archived_at || '',
    archivedBy: a.archivedBy || a.archived_by || null
  };
}

function mapDriver(d) {
  const nearest = d.nearestDocExpiry || d.nearest_doc_expiry || null;
  let docExpiryStatus = 'ok';
  if (Number(d.expiredDocsCount || d.expired_docs_count || 0) > 0) docExpiryStatus = 'expired';
  else if (Number(d.expiringSoonCount || d.expiring_soon_count || 0) > 0) docExpiryStatus = 'expiring';
  else if (nearest) {
    const days = Math.ceil((new Date(nearest) - new Date()) / 86400000);
    if (days < 0) docExpiryStatus = 'expired';
    else if (days <= 30) docExpiryStatus = 'expiring';
  }
  return {
    id: d.id, dbId: d.id, code: d.driverCode || d.id,
    name: d.fullName || d.name || '—', phone: d.phone || '—', email: d.email || '—',
    type: d.vehicleType || d.type || '—', plate: d.plateNumber || d.plate || '—',
    rides: d.totalRides ?? d.rides ?? 0, rating: Number(d.rating || 0).toFixed(1),
    status: d.applicationStatus || d.status, online: !!d.online,
    userStatus: d.status,
    make: d.make || d.vehicleMake || '',
    model: d.model || d.vehicleModel || '',
    color: d.color || d.vehicleColor || '',
    year: d.year || d.modelYear || d.model_year || '',
    nationalId: d.nationalId || d.national_id || '',
    homeAddress: d.homeAddress || d.home_address || '',
    rejectionReason: d.rejectionReason || d.rejection_reason || '',
    approvedAt: d.approvedAt || d.approved_at || null,
    nearestDocExpiry: nearest,
    docExpiryStatus,
    photo: d.photoUrl || d.photo_url || d.photo || '',
    earnings: Number(d.totalEarnings || d.total_earnings || 0),
    createdAt: d.createdAt || d.created_at || null
  };
}
function mapRider(r) {
  return {
    id: r.id, name: r.fullName || r.name || '—', phone: r.phone || '—', email: r.email || '—',
    island: r.island || '—', region: r.region || '—',
    area: r.district || r.region || r.ward || '—',
    district: r.district || '—', ward: r.ward || '—',
    rides: r.totalRides || r.total_rides || 0, wallet: Number(r.walletBalance || r.wallet_balance || 0),
    status: r.status, rating: Number(r.rating || 0).toFixed(1),
    photo: r.photoUrl || r.photo_url || r.photo || '',
    createdAt: r.createdAt || r.created_at || null
  };
}
function mapAdmin(a) {
  return {
    id: a.id, name: a.fullName, phone: a.phone || '—', email: a.email,
    status: a.status, created: a.createdAt ? new Date(a.createdAt).toLocaleString() : '—',
    lastLogin: a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : '—'
  };
}
function mapPromo(p) {
  return {
    id: p.id, code: p.code, description: p.description || p.title,
    discount: p.discount_type === 'percent' ? p.discount_value + '%' : money(p.discount_value),
    discountType: p.discount_type, discountValue: p.discount_value,
    service: p.applies_to, usage: (p.usage_count || 0) + ' / ' + (p.usage_limit || '∞'),
    status: p.is_active ? 'Active' : 'Paused',
    validFrom: p.valid_from, validUntil: p.valid_until
  };
}
function mapPayout(p) {
  return {
    id: p.id, driver: p.driverName, method: p.method, account: p.account_details || '',
    amount: Number(p.amount || 0), status: p.status,
    requested: p.created_at ? new Date(p.created_at).toLocaleString() : '—'
  };
}
function mapTour(t) {
  return {
    id: t.id, name: t.name, description: t.description || '',
    price: Number(t.base_price || 0), duration: t.duration_hours,
    max: t.max_tourists, status: t.is_active ? 'Active' : 'Paused'
  };
}
function mapParcel(p) {
  return {
    id: p.parcel_code || p.id, dbId: p.id,
    rider: p.riderName || p.rider_name || '—',
    driver: p.driverName || p.driver_name || '—',
    pickup: p.pickup_address || '—',
    drop: p.delivery_address || '—',
    weight: (p.weight_kg != null ? p.weight_kg : 0) + ' kg',
    status: p.status || '—',
    time: p.created_at ? new Date(p.created_at).toLocaleString() : '—',
    description: p.description || p.parcel_description || '',
    recipientName: p.recipient_name || p.recipientName || '',
    recipientPhone: p.recipient_phone || p.recipientPhone || '',
    fee: Number(p.delivery_fee ?? p.fee ?? p.estimated_fare ?? 0),
    payment: p.payment_method || 'Cash',
    notes: p.notes || p.special_instructions || '',
    size: p.size || p.package_size || '',
    category: p.category || p.parcel_type || ''
  };
}

/* Badge counts cleared when the matching menu is opened.
   Badge returns only if the count rises above the value seen at open time. */
window.__badgeClearedAt = window.__badgeClearedAt || {};

function computeBadgeCounts() {
  return {
    live: (D.rides || []).filter(r => !/completed|cancelled|canceled|failed/i.test(r.status || '')).length,
    drivers: (D.drivers || []).filter(d => /pending|review/i.test(d.status || '')).length,
    withdrawals: (D.payouts || []).filter(p => /pending/i.test(p.status || '')).length,
    chat: (D.conversations || []).filter(c => Number(c.unreadCount || c.unread_count || 0) > 0).length,
    reports: (D.rides || []).filter(r => /cancel|failed|incident|dispute/i.test(r.status || '')).length,
    notifications: (D.notifications || []).filter(n => !(n.read_at || n.readAt)).length
  };
}

function updateIndicators() {
  const counts = computeBadgeCounts();
  Object.entries(counts).forEach(([page, count]) => {
    const link = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (!link) return;
    const cleared = window.__badgeClearedAt[page];
    const show = count > 0 && (cleared === undefined || count > Number(cleared));
    let badgeEl = link.querySelector('.nav-badge');
    if (show) {
      if (!badgeEl) { badgeEl = document.createElement('em'); badgeEl.className = 'nav-badge'; link.appendChild(badgeEl); }
      badgeEl.textContent = count > 99 ? '99+' : String(count);
    } else if (badgeEl) {
      badgeEl.remove();
    }
  });
  const bell = document.querySelector('.notification-btn span');
  if (bell) {
    const unread = counts.notifications || 0;
    const cleared = window.__badgeClearedAt.notifications;
    const showBell = unread > 0 && (cleared === undefined || unread > Number(cleared));
    bell.textContent = showBell ? (unread > 99 ? '99+' : String(unread)) : '';
    bell.classList.toggle('has-count', showBell);
    bell.setAttribute('aria-label', `${unread} notifications`);
  }
}

/* ---------- Navigation ---------- */
let currentPage = 'dashboard';

const PAGE_META = {
  dashboard: ['Dashboard', 'Platform health and operations overview'],
  rides: ['Rides', 'All ride activity and lifecycle'],
  drivers: ['Drivers', 'Applications, fleet and performance'],
  riders: ['Riders', 'Accounts, wallets and history'],
  admins: ['Admins', 'Super admin and sub-admin accounts'],
  parcels: ['Parcels', 'Parcel bookings and delivery status'],
  tours: ['Tours', 'Tour packages and availability'],
  finance: ['Finance', 'Payments, commissions and ledger'],
  withdrawals: ['Withdrawals', 'Driver payout requests'],
  promotions: ['Promotions', 'Promo codes and incentives'],
  notifications: ['Notifications', 'System and admin messages'],
  chat: ['Support', 'Conversations and support threads'],
  audit: ['Audit log', 'Administrative actions trail'],
  pricing: ['Pricing & commission', 'Fare and commission configuration'],
  settings: ['Settings', 'Platform configuration'],
  archive: ['Archive', 'Archived users — restore or permanently delete'],
  live: ['Live Operations', 'Current rides, drivers and operational activity'],
  reports: ['Reports & Safety', 'Review operational activity and safety indicators']
};

async function clearPageBadges(page) {
  try {
    const counts = computeBadgeCounts();
    // Snapshot current count so the badge hides until the count increases
    if (page in counts) {
      window.__badgeClearedAt[page] = counts[page] || 0;
    }
    if (page === 'notifications') {
      const unread = (D.notifications || []).filter(n => !(n.read_at || n.readAt));
      if (unread.length) {
        await API.post('/admin/notifications/mark-all-read', {}).catch(() => null);
        (D.notifications || []).forEach(n => { if (!(n.read_at || n.readAt)) n.read_at = new Date().toISOString(); });
      }
      window.__badgeClearedAt.notifications = 0;
    }
    if (page === 'chat') {
      const unreadChat = (D.conversations || []).filter(c => Number(c.unreadCount || c.unread_count || 0) > 0);
      if (unreadChat.length) {
        await API.post('/admin/conversations/mark-all-read', {}).catch(() => null);
        (D.conversations || []).forEach(c => { c.unreadCount = 0; c.unread_count = 0; });
      }
      window.__badgeClearedAt.chat = 0;
    }
  } catch (_) {}
}

function renderPage(page) {
  currentPage = page;
  $$('.nav-link[data-page]').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
  const meta = PAGE_META[page] || [page, ''];
  if ($('#pageTitle')) $('#pageTitle').textContent = meta[0];
  if ($('#pageSubtitle')) $('#pageSubtitle').textContent = meta[1];
  const content = $('#content');
  if (!content) return;
  const fn = window.AdminPages?.[page];
  content.innerHTML = fn ? fn() : `<div class="card-x p-4"><p>Page not available.</p></div>`;
  // Clear unread badges for notifications & support chat when the menu is opened
  clearPageBadges(page).then(() => updateIndicators());
  updateIndicators();
  bindPageEvents();
}
window.renderPage = renderPage;
window.renderCurrent = () => renderPage(currentPage);

/* ---------- Table helpers ---------- */
function tableWrap(title, actionsHtml, headHtml, bodyHtml, emptyMsg) {
  return `<div class="card-x">
    <div class="card-head d-flex flex-wrap justify-content-between align-items-center gap-2">
      <div><h6 class="mb-0">${esc(title)}</h6></div>
      <div class="d-flex flex-wrap gap-2">${actionsHtml || ''}</div>
    </div>
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${bodyHtml || `<tr><td colspan="12" class="text-center text-muted py-4">${esc(emptyMsg || 'No records')}</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

function toolbar(searchId, extra = '') {
  return `<div class="toolbar d-flex flex-wrap gap-2 mb-3">
    <div class="global-search flex-grow-1" style="max-width:320px"><i class="bi bi-search"></i>
      <input id="${searchId}" placeholder="Search by name, phone, email, ID, code..."></div>
    ${extra}
  </div>`;
}

/* ---------- Pages ---------- */
window.AdminPages = {
  live() {
    const active = D.rides.filter(r => !/completed|cancelled|canceled|failed/i.test(r.status || ''));
    return toolbar('liveSearch', '<button class="btn btn-outline-primary" id="btnRefreshLive"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button>') +
      `<div class="card-x mb-3"><div class="card-head d-flex justify-content-between align-items-center"><h6 class="mb-0">Live map</h6><small class="text-muted" id="liveMapMeta">Loading…</small></div>
        <div id="adminLiveMap" style="height:380px;width:100%;background:#e8f0ee;border-radius:0 0 12px 12px;"></div>
        <div class="p-2 small text-muted border-top"><span class="me-3"><i class="bi bi-circle-fill text-success me-1"></i>Online drivers</span>
        <span class="me-3"><i class="bi bi-geo-alt-fill text-primary me-1"></i>Active ride pickup</span>
        <span><i class="bi bi-flag-fill text-danger me-1"></i>Destination</span></div></div>` +
      tableWrap('Live ride operations', '', '<th>Ride</th><th>Rider</th><th>Driver</th><th>Route</th><th>Status</th><th>Started</th>',
        active.map(r => `<tr data-search="${esc((r.id+' '+r.rider+' '+r.driver+' '+r.from+' '+r.to+' '+r.status).toLowerCase())}"><td><b>${esc(r.id)}</b></td><td>${esc(r.rider)}</td><td>${esc(r.driver)}</td><td>${esc(r.from)} → ${esc(r.to)}</td><td>${badge(r.status)}</td><td>${esc(r.time)}</td></tr>`).join(''),
        'No active rides right now.');
  },
  reports() {
    const active = D.rides.filter(r => !/completed|cancelled|canceled|failed/i.test(r.status || '')).length;
    const pending = D.drivers.filter(d => /pending|review/i.test(d.status || '')).length;
    const openReports = (D.driverReports || []).filter(r => /open|pending|new/i.test(r.status || '')).length;
    const cancelled = D.rides.filter(r => /cancel/i.test(r.status || '')).length;
    const reportRows = (D.driverReports || []).map(r =>
      `<tr data-search="${esc((r.id+' '+r.driverName+' '+r.reporterName+' '+r.reason+' '+r.status).toLowerCase())}">
        <td>Driver report</td>
        <td>#${esc(r.id)}${r.rideId ? ` · ride ${esc(r.rideId)}` : ''}</td>
        <td><b>${esc(r.driverName)}</b> <span class="text-muted small">reported by ${esc(r.reporterName)}</span>
          <div class="small mt-1">${esc(r.reason)}</div></td>
        <td>${badge(r.status)}
          <div class="btn-group btn-group-sm mt-1">
            <button class="btn btn-outline-success" data-action="report-status" data-id="${r.id}" data-status="reviewed" title="Mark reviewed">✓</button>
            <button class="btn btn-outline-secondary" data-action="report-status" data-id="${r.id}" data-status="dismissed" title="Dismiss">✕</button>
          </div>
        </td>
        <td class="small">${esc(typeof r.time === 'string' ? r.time : (r.time ? new Date(r.time).toLocaleString() : '—'))}</td>
      </tr>`
    );
    const cancelRows = D.rides.filter(r => /cancel/i.test(r.status || '')).map(r =>
      `<tr data-search="${esc(('cancel '+r.id+' '+r.rider+' '+r.driver+' '+(r.cancelReason||'')).toLowerCase())}">
        <td>Cancelled ride</td><td>${esc(r.id)}</td>
        <td>${esc(r.rider)} / ${esc(r.driver)}
          <div class="small text-danger mt-1">${esc(r.cancelReason || 'No reason provided')}</div></td>
        <td>${badge(r.status)}</td><td class="small">${esc(r.time)}</td></tr>`
    );
    const appRows = D.drivers.filter(d => /pending|review|suspended|rejected/i.test(d.status || '')).map(d =>
      `<tr data-search="${esc(('driver '+d.id+' '+d.name+' '+d.status+' '+(d.rejectionReason||'')).toLowerCase())}">
        <td>Driver application</td><td>${esc(d.code || d.id)}</td>
        <td>${userCell(d.name, d.phone, 'green', d.photo)}${d.rejectionReason ? `<div class="small text-danger mt-1">${esc(d.rejectionReason)}</div>` : ''}</td>
        <td>${badge(d.status)}</td><td>—</td></tr>`
    );
    return `<div class="row g-3 mb-3">
      <div class="col-6 col-md-3"><div class="card-x p-3"><small class="text-muted">Open driver reports</small><h3>${openReports}</h3></div></div>
      <div class="col-6 col-md-3"><div class="card-x p-3"><small class="text-muted">Cancelled rides</small><h3>${cancelled}</h3></div></div>
      <div class="col-6 col-md-3"><div class="card-x p-3"><small class="text-muted">Apps to review</small><h3>${pending}</h3></div></div>
      <div class="col-6 col-md-3"><div class="card-x p-3"><small class="text-muted">Active rides</small><h3>${active}</h3></div></div>
    </div>` + toolbar('reportsSearch') + tableWrap('Reports, cancellations & applications',
      'Driver reports from riders, cancel reasons, and application reviews.',
      '<th>Category</th><th>Reference</th><th>Detail</th><th>Status</th><th>Time</th>',
      [...reportRows, ...cancelRows, ...appRows].join(''),
      'No safety items in current data.');
  },
  dashboard() {
    const d = D.dashboard || {};
    // label, value, icon, target page, optional filter query
    const cards = [
      ['Users', d.users || 0, 'bi-people', 'riders', ''],
      ['Riders', d.riders || 0, 'bi-person', 'riders', ''],
      ['Drivers', d.drivers || 0, 'bi-scooter', 'drivers', ''],
      ['Admins', d.admins || 0, 'bi-shield-lock', 'admins', ''],
      ["Today's rides", d.todayRides || 0, 'bi-geo-alt', 'rides', ''],
      ['Active rides', d.activeRides || 0, 'bi-activity', 'live', ''],
      ['Pending apps', d.pendingDriverApplications || 0, 'bi-hourglass-split', 'drivers', 'pending'],
      ["Today's revenue", money(d.todayRevenue || 0), 'bi-cash-stack', 'finance', '']
    ];
    return `<div class="row g-3 mb-3">${cards.map(([l, v, i, page, filter]) =>
      `<div class="col-6 col-md-3"><div class="card-x p-3 h-100 metric-card" role="button" tabindex="0" data-metric-page="${esc(page)}" data-metric-filter="${esc(filter)}" title="Open ${esc(l)}">
        <div class="d-flex justify-content-between"><span class="text-muted small">${esc(l)}</span><i class="bi ${i} text-primary"></i></div>
        <div class="fs-4 fw-bold mt-1">${typeof v === 'number' ? v.toLocaleString() : esc(v)}</div>
        <div class="small text-primary mt-1 metric-hint"><i class="bi bi-arrow-right-circle me-1"></i>View</div>
      </div></div>`).join('')}</div>
      ${tableWrap('Recent rides', '', '<th>ID</th><th>Rider</th><th>Driver</th><th>Type</th><th>Fare</th><th>Status</th><th>Time</th>',
        D.rides.slice(0, 8).map((r) => `<tr data-search="${esc((r.id+' '+r.rider+' '+r.driver+' '+r.status).toLowerCase())}"><td>${esc(r.id)}</td><td>${esc(r.rider)}</td><td>${esc(r.driver)}</td><td>${esc(r.type)}</td><td>${money(r.fare)}</td><td>${badge(r.status)}</td><td>${esc(r.time)}</td></tr>`).join(''),
        'No rides yet')}`;
  },

  rides() {
    return toolbar('rideSearch') + tableWrap('All rides',
      `<button class="btn btn-sm btn-outline-primary" id="btnRefreshRides"><i class="bi bi-arrow-clockwise"></i> Refresh</button>`,
      '<th>ID</th><th>Rider</th><th>Driver</th><th>Type</th><th>From → To</th><th>Fare</th><th>Status</th><th>Time</th><th></th>',
      D.rides.map((r) => `<tr data-search="${esc((String(r.id)+' '+(r.code||'')+' '+r.rider+' '+r.driver+' '+(r.type||'')+' '+r.status+' '+(r.from||'')+' '+(r.to||'')+' '+(r.cancelReason||'')).toLowerCase())}">
        <td><b>${esc(r.id)}</b></td>
        <td>${userCell(r.rider, r.riderPhone || '', 'blue', r.riderPhoto)}</td>
        <td>${userCell(r.driver, r.driverPhone || '', 'green', r.driverPhoto)}</td>
        <td>${esc(r.type)}</td>
        <td class="small">${esc(r.from)} → ${esc(r.to)}${r.cancelReason ? `<div class="text-danger small mt-1"><i class="bi bi-x-circle"></i> ${esc(r.cancelReason)}</div>` : ''}</td>
        <td>${money(r.fare)}</td>
        <td>${badge(r.status)}</td>
        <td class="small">${esc(r.time)}</td>
        <td><button class="btn btn-sm btn-outline-primary" data-action="view-ride" data-id="${esc(r.rawId || r.id)}" title="Full details"><i class="bi bi-eye"></i></button></td>
      </tr>`).join(''));
  },


  archive() {
    const rows = D.archives || [];
    return toolbar('archiveSearch',
      `<button class="btn btn-sm btn-outline-primary" id="btnRefreshArchive"><i class="bi bi-arrow-clockwise"></i> Refresh</button>`)
      + tableWrap('Archived users', 'Users removed from live data. Restore brings them back exactly; permanent delete cannot be undone.',
        '<th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Reason</th><th>Archived</th><th></th>',
        rows.map((a) => `<tr data-search="${esc((String(a.id)+' '+String(a.originalUserId||'')+' '+a.name+' '+a.role+' '+a.phone+' '+(a.email||'')+' '+(a.reason||'')).toLowerCase())}">
          <td>${userCell(a.name, '#' + a.originalUserId, 'gray')}</td>
          <td>${badge(a.role)}</td>
          <td>${esc(a.phone)}</td>
          <td class="small">${esc(a.email)}</td>
          <td class="small">${esc(a.reason || '—')}</td>
          <td class="small">${esc(a.archivedAt ? new Date(a.archivedAt).toLocaleString() : '—')}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-success" data-action="restore-archive" data-id="${a.id}" title="Restore user"><i class="bi bi-arrow-counterclockwise"></i> Restore</button>
            <button class="btn btn-sm btn-outline-danger" data-action="permanent-delete-archive" data-id="${a.id}" title="Permanently delete"><i class="bi bi-trash"></i></button>
          </td></tr>`).join('') || '', 'No archived users.');
  },

  drivers() {
    const statusFilter = `<select class="form-select form-select-sm filter-status" data-filter="status" style="width:auto;min-width:150px">
      <option value="">All statuses</option>
      <option value="under_review">Under review</option>
      <option value="pending">Pending</option>
      <option value="active">Active</option>
      <option value="rejected">Rejected</option>
      <option value="suspended">Suspended</option>
    </select>
    <select class="form-select form-select-sm" id="docExpiryFilter" style="width:auto;min-width:160px">
      <option value="">Docs: all</option>
      <option value="expired">Docs expired</option>
      <option value="expiring">Docs expiring ≤30d</option>
      <option value="ok">Docs OK</option>
    </select>
    <button class="btn btn-sm btn-outline-danger" id="btnBulkDeleteDrivers" title="Archive selected"><i class="bi bi-trash"></i> Bulk archive</button>`;
    return toolbar('driverSearch',
      `<button class="btn btn-sm btn-primary" data-action="add-driver"><i class="bi bi-plus-lg"></i> Add driver</button>
       <button class="btn btn-sm btn-outline-primary" id="btnRefreshDrivers"><i class="bi bi-arrow-clockwise"></i></button>${statusFilter}`)
      + tableWrap('Drivers', 'Fleet, applications, document expiry and performance.',
        '<th><input type="checkbox" id="bulkSelectAll" title="Select all"></th><th>Driver</th><th>Phone</th><th>Email</th><th>Type</th><th>Plate</th><th>Make / Model</th><th>Rides</th><th>Rating</th><th>Status</th><th>Documents</th><th>Online</th><th></th>',
        D.drivers.map((d) => {
          let docBadge = '<span class="badge text-bg-success">OK</span>';
          if (d.docExpiryStatus === 'expired') docBadge = '<span class="badge text-bg-danger">Expired</span>';
          else if (d.docExpiryStatus === 'expiring') docBadge = `<span class="badge text-bg-warning text-dark">Expires ${d.nearestDocExpiry ? new Date(d.nearestDocExpiry).toLocaleDateString() : 'soon'}</span>`;
          return `<tr data-search="${esc((String(d.id)+' '+String(d.code||'')+' '+d.name+' '+d.phone+' '+(d.email||'')+' '+d.status+' '+d.plate+' '+(d.make||'')+' '+(d.model||'')+' '+d.docExpiryStatus).toLowerCase())}" data-status="${esc(d.status)}" data-doc-expiry="${esc(d.docExpiryStatus)}">
          <td><input type="checkbox" class="row-check" value="${esc(d.id)}"></td>
          <td>${userCell(d.name, d.code, 'green', d.photo)}</td><td>${esc(d.phone)}</td><td class="small">${esc(d.email)}</td>
          <td>${esc(d.type)}</td><td>${esc(d.plate)}</td>
          <td class="small">${esc([d.make, d.model].filter(Boolean).join(' ') || '—')}</td>
          <td>${d.rides}</td><td>${d.rating}</td>
          <td>${badge(d.status)}${d.rejectionReason ? `<div class="small text-danger mt-1" title="${esc(d.rejectionReason)}">${esc(String(d.rejectionReason).slice(0, 40))}${String(d.rejectionReason).length > 40 ? '…' : ''}</div>` : ''}</td>
          <td>${docBadge}</td>
          <td>${d.online ? '<span class="text-success">● Online</span>' : '<span class="text-muted">○ Offline</span>'}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-primary" data-action="view-driver" data-id="${d.id}" title="View"><i class="bi bi-eye"></i></button>
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-driver" data-id="${d.id}" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-driver" data-id="${d.id}" title="Archive user"><i class="bi bi-trash"></i></button>
          </td></tr>`;
        }).join(''), 'No drivers found.');
  },

  riders() {
    return toolbar('riderSearch',
      `<button class="btn btn-sm btn-primary" data-action="add-rider"><i class="bi bi-plus-lg"></i> Add rider</button>
       <button class="btn btn-sm btn-outline-primary" id="btnRefreshRiders"><i class="bi bi-arrow-clockwise"></i></button>`)
      + tableWrap('Riders', '',
        '<th>Rider</th><th>Phone</th><th>Email</th><th>Island / Area</th><th>Rides</th><th>Rating</th><th>Wallet</th><th>Status</th><th></th>',
        D.riders.map((r) => `<tr data-search="${esc((String(r.id)+' '+r.name+' '+r.phone+' '+(r.email||'')+' '+r.status+' '+(r.island||'')+' '+(r.area||'')).toLowerCase())}">
          <td>${userCell(r.name, r.email, 'blue', r.photo)}</td><td>${esc(r.phone)}</td><td>${esc(r.email)}</td>
          <td>${esc(r.island)} / ${esc(r.area)}</td><td>${r.rides}</td><td><i class="bi bi-star-fill text-warning"></i> ${r.rating}</td><td>${money(r.wallet)}</td><td>${badge(r.status)}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-primary" data-action="view-rider" data-id="${r.id}" title="Full profile"><i class="bi bi-eye"></i></button>
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-rider" data-id="${r.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-warning" data-action="rider-status" data-id="${r.id}" data-status="${r.status === 'suspended' ? 'active' : 'suspended'}" title="Toggle restrict">
              <i class="bi bi-slash-circle"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-rider" data-id="${r.id}"><i class="bi bi-trash"></i></button>
          </td></tr>`).join(''));
  },

  admins() {
    return toolbar('adminSearch',
      `<button class="btn btn-sm btn-primary" data-action="add-admin"><i class="bi bi-plus-lg"></i> Add sub-admin</button>
       <button class="btn btn-sm btn-outline-primary" id="btnRefreshAdmins"><i class="bi bi-arrow-clockwise"></i></button>`)
      + tableWrap('Administrators', '',
        '<th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Created</th><th>Last login</th><th></th>',
        D.admins.map((a) => `<tr data-search="${esc((String(a.id)+' '+a.name+' '+(a.email||'')+' '+(a.phone||'')+' '+a.status).toLowerCase())}">
          <td>${userCell(a.name, 'Admin', 'purple')}</td><td>${esc(a.email)}</td><td>${esc(a.phone)}</td>
          <td>${badge(a.status)}</td><td class="small">${esc(a.created)}</td><td class="small">${esc(a.lastLogin)}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-admin" data-id="${a.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-admin" data-id="${a.id}"><i class="bi bi-trash"></i></button>
          </td></tr>`).join(''));
  },

  parcels() {
    return toolbar('parcelSearch',
      `<select class="form-select form-select-sm filter-status" data-filter="status" style="width:auto;min-width:140px">
        <option value="">All statuses</option>
        <option>pending</option><option>assigned</option><option>picked_up</option>
        <option>in_transit</option><option>delivered</option><option>cancelled</option>
      </select>`) + tableWrap('Parcels', 'Full parcel delivery details from the platform.',
      '<th><input type="checkbox" id="bulkSelectAll" title="Select all"></th><th>Code</th><th>Rider</th><th>Driver</th><th>Recipient</th><th>Pickup → Drop</th><th>Weight</th><th>Fee</th><th>Status</th><th>Time</th>',
      D.parcels.map((p) => `<tr data-search="${esc((String(p.id)+' '+(p.rider||'')+' '+(p.driver||'')+' '+(p.recipientName||'')+' '+p.status+' '+(p.description||'')).toLowerCase())}" data-status="${esc(p.status)}">
        <td><input type="checkbox" class="row-check" value="${esc(p.dbId || p.id)}"></td>
        <td><b>${esc(p.id)}</b>${p.description ? `<div class="small text-muted">${esc(String(p.description).slice(0,40))}</div>` : ''}</td>
        <td>${esc(p.rider)}</td><td>${esc(p.driver)}</td>
        <td class="small">${esc(p.recipientName || '—')}${p.recipientPhone ? `<div class="text-muted">${esc(p.recipientPhone)}</div>` : ''}</td>
        <td class="small">${esc(p.pickup)} → ${esc(p.drop)}</td>
        <td>${esc(p.weight)}</td><td>${money(p.fee)}</td>
        <td>${badge(p.status)}</td><td class="small">${esc(p.time)}</td></tr>`).join(''),
      'No parcels found.');
  },

  tours() {
    return toolbar('tourSearch',
      `<button class="btn btn-sm btn-primary" data-action="add-tour"><i class="bi bi-plus-lg"></i> Add package</button>`)
      + tableWrap('Tour packages', '',
        '<th>Name</th><th>Description</th><th>Price</th><th>Duration</th><th>Max</th><th>Status</th><th></th>',
        D.tours.map((t) => `<tr data-search="${esc((String(t.id)+' '+(t.name||'')+' '+t.status).toLowerCase())}">
          <td><b>${esc(t.name)}</b></td><td class="small">${esc(t.description).slice(0, 80)}</td>
          <td>${money(t.price)}</td><td>${esc(t.duration)} h</td><td>${esc(t.max)}</td><td>${badge(t.status)}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-tour" data-id="${t.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-tour" data-id="${t.id}"><i class="bi bi-trash"></i></button>
          </td></tr>`).join(''));
  },

  finance() {
    return `<div class="row g-3 mb-3">
      <div class="col-md-6">${tableWrap('Recent payments', '',
        '<th>ID</th><th>User</th><th>Amount</th><th>Provider</th><th>Status</th><th></th>',
        (D.payments || []).slice(0, 20).map((p) => `<tr>
          <td>${p.id}</td><td>${esc(p.userName || p.user_id)}</td><td>${money(p.amount)}</td>
          <td>${esc(p.provider)}</td><td>${badge(p.status)}</td>
          <td>${p.status === 'pending' ? `<button class="btn btn-sm btn-success" data-action="complete-payment" data-id="${p.id}">Complete</button>` : ''}</td>
        </tr>`).join(''))}</div>
      <div class="col-md-6">${tableWrap('Commission ledger', '',
        '<th>Driver</th><th>Gross</th><th>Commission</th><th>Driver share</th><th>Date</th>',
        (D.commissions || []).slice(0, 20).map((c) => `<tr>
          <td>${esc(c.driverName)}</td><td>${money(c.grossAmount)}</td><td>${money(c.commissionAmount)}</td>
          <td>${money(c.driverAmount)}</td><td class="small">${c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</td>
        </tr>`).join(''))}</div>
    </div>
    <div class="row g-3 mb-3"><div class="col-12">${tableWrap('Driver commission owed', '',
        '<th>Driver</th><th>Gross since settlement</th><th>Commission owed</th><th>Status</th><th></th>',
        (D.finance || []).map((d) => `<tr>
          <td>${esc(d.driverName || d.driver_id)}</td><td>${money(d.gross_since_settlement)}</td><td>${money(d.commission_owed)}</td>
          <td>${Number(d.commission_owed) > 0 ? badge('pending') : badge('paid')}</td>
          <td>${Number(d.commission_owed) > 0 ? `<button class="btn btn-sm btn-outline-success" data-action="settle-driver" data-id="${d.driver_id}" title="Record a cash/bank commission payment received outside the app">Record payment</button>` : ''}</td>
        </tr>`).join(''))}</div></div>`;
  },

  withdrawals() {
    return toolbar('payoutSearch') + tableWrap('Payout requests', '',
      '<th>ID</th><th>Driver</th><th>Method</th><th>Amount</th><th>Requested</th><th>Status</th><th></th>',
      D.payouts.map((p) => `<tr data-search="${esc((String(p.id)+' '+(p.driver||'')+' '+p.status+' '+(p.method||'')).toLowerCase())}">
        <td>${p.id}</td><td>${esc(p.driver)}</td><td>${esc(p.method)}</td><td>${money(p.amount)}</td>
        <td class="small">${esc(p.requested)}</td><td>${badge(p.status)}</td>
        <td class="text-nowrap">${p.status === 'pending' ? `
          <button class="btn btn-sm btn-success" data-action="payout-status" data-id="${p.id}" data-status="approved">Approve</button>
          <button class="btn btn-sm btn-danger" data-action="payout-status" data-id="${p.id}" data-status="rejected">Reject</button>
        ` : p.status === 'approved' ? `
          <button class="btn btn-sm btn-primary" data-action="payout-status" data-id="${p.id}" data-status="paid">Mark paid</button>
        ` : ''}</td></tr>`).join(''));
  },

  promotions() {
    return toolbar('promoSearch',
      `<button class="btn btn-sm btn-primary" data-action="add-promo"><i class="bi bi-plus-lg"></i> Create promo</button>`)
      + tableWrap('Promotions', '',
        '<th>Code</th><th>Description</th><th>Discount</th><th>Applies</th><th>Usage</th><th>Status</th><th></th>',
        D.promos.map((p) => `<tr data-search="${esc((String(p.id)+' '+(p.code||'')+' '+p.status+' '+(p.name||'')).toLowerCase())}">
          <td><b>${esc(p.code)}</b></td><td>${esc(p.description)}</td><td>${esc(p.discount)}</td>
          <td>${esc(p.service)}</td><td>${esc(p.usage)}</td><td>${badge(p.status)}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-promo" data-id="${p.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-promo" data-id="${p.id}"><i class="bi bi-trash"></i></button>
          </td></tr>`).join(''));
  },

  notifications() {
    return toolbar('notifSearch',
      `<button class="btn btn-sm btn-primary" data-action="send-notification"><i class="bi bi-plus-lg"></i> Send</button>`)
      + tableWrap('Notifications', '',
        '<th>User</th><th>Title</th><th>Body</th><th>Type</th><th>Time</th>',
        (D.notifications || []).map((n) => { const isRead = !!(n.read_at || n.readAt); return `<tr class="notification-row ${isRead ? 'is-read' : 'is-unread'}" data-notification-id="${esc(n.id)}" data-search="${esc((n.userName+' '+n.user_id+' '+n.title+' '+n.body+' '+n.type).toLowerCase())}" tabindex="0" role="button" aria-label="${isRead ? 'Read' : 'Mark as read'} notification: ${esc(n.title)}">
          <td>${esc(n.userName || n.user_id)} ${isRead ? '' : '<span class="notification-unread-dot" title="Unread"></span>'}</td><td>${esc(n.title)} ${isRead ? '' : '<span class="badge text-bg-primary ms-1">Unread</span>'}</td>
          <td class="small">${esc(n.body)}</td><td>${esc(n.type)}</td>
          <td class="small">${n.created_at || n.createdAt ? new Date(n.created_at || n.createdAt).toLocaleString() : '—'}</td>
        </tr>`; }).join(''));
  },

  chat() {
    const list = D.conversations || [];
    const support = list.filter(c => c.type === 'support' || !c.type);
    const other = list.filter(c => c.type && c.type !== 'support');
    const rows = (support.length ? support : list).map((c) => {
      const unread = Number(c.unreadCount || c.unread_count || 0);
      const name = c.customerName || c.title || ('#' + c.id);
      const role = c.customerRole || c.type || '—';
      const last = c.lastMessage || '—';
      const when = c.lastMessageAt || c.updatedAt || c.updated_at;
      return `<tr class="chat-thread-row ${unread ? 'is-unread' : ''}" data-conversation-id="${esc(c.id)}" data-search="${esc((name+' '+role+' '+last+' '+c.type).toLowerCase())}" tabindex="0" role="button">
        <td><div class="fw-semibold">${esc(name)} ${unread ? `<span class="badge text-bg-primary ms-1">${unread > 99 ? '99+' : unread}</span>` : ''}</div>
          <div class="small text-muted text-capitalize">${esc(role)}</div></td>
        <td class="small text-truncate" style="max-width:280px">${esc(last)}</td>
        <td class="small">${c.messageCount || 0}</td>
        <td class="small">${when ? new Date(when).toLocaleString() : '—'}</td>
        <td><button class="btn btn-sm btn-primary" data-action="open-chat" data-id="${esc(c.id)}"><i class="bi bi-chat-dots"></i> Open</button></td>
      </tr>`;
    }).join('');
    return toolbar('chatSearch', `<button class="btn btn-sm btn-outline-secondary" data-action="refresh-chat"><i class="bi bi-arrow-clockwise"></i> Refresh</button>`)
      + tableWrap('Support inbox', '',
        '<th>Customer</th><th>Last message</th><th>Msgs</th><th>Updated</th><th></th>',
        rows || '', 'No support conversations yet. They appear when a rider or driver opens Support.')
      + `<div id="adminChatPanel" class="card-x mt-3 d-none">
          <div class="card-head d-flex justify-content-between align-items-center gap-2">
            <div>
              <h6 class="mb-0" id="adminChatTitle">Conversation</h6>
              <div class="small text-muted" id="adminChatSub"></div>
            </div>
            <button class="btn btn-sm btn-outline-secondary" id="adminChatClose"><i class="bi bi-x-lg"></i></button>
          </div>
          <div id="adminChatMessages" style="max-height:360px;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;background:rgba(22,160,133,.03)"></div>
          <form id="adminChatForm" class="p-3 border-top d-flex gap-2">
            <input type="text" class="form-control" id="adminChatInput" placeholder="Reply as support…" maxlength="5000" required>
            <button class="btn btn-primary" type="submit"><i class="bi bi-send-fill"></i></button>
          </form>
        </div>`;
  },

  audit() {
    return toolbar('auditSearch') + tableWrap('Audit log', '',
      '<th>Time</th><th>Admin</th><th>Action</th><th>Entity</th><th>ID</th>',
      (D.audit || []).map((a) => `<tr data-search="${esc((a.action + a.adminName + a.entity_type).toLowerCase())}">
        <td class="small">${a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
        <td>${esc(a.adminName || a.admin_id)}</td><td>${esc(a.action)}</td>
        <td>${esc(a.entity_type)}</td><td>${a.entity_id || '—'}</td>
      </tr>`).join(''));
  },

  pricing() {
    const cs = D.commissionSettings || {};
    const f = D.fareSettings || {};
    const m = f.multipliers || { boda: 1, bajaji: 1.15, taxi: 1.5 };
    return `<div class="row g-4">
      <div class="col-12 col-lg-6">
        <div class="card-x p-4">
          <h6 class="mb-1">Ride fares & charges</h6>
          <p class="small text-muted mb-3">These values are used by the apps when quoting a ride. Formula: <code>(base + km×perKm + min×perMinute + bookingFee) × vehicle multiplier</code>. Distance prefers Google road distance when the server has <code>GOOGLE_MAPS_API_KEY</code>.</p>
          <form id="fareForm">
            <div class="row g-2">
              <div class="col-6"><label class="form-label">Base fare (TZS)</label>
                <input class="form-control" name="baseFare" type="number" value="${esc(f.baseFare ?? 2500)}" required min="0" step="1"></div>
              <div class="col-6"><label class="form-label">Per kilometre (TZS)</label>
                <input class="form-control" name="perKm" type="number" value="${esc(f.perKm ?? 900)}" required min="0" step="1"></div>
              <div class="col-6"><label class="form-label">Per minute (TZS)</label>
                <input class="form-control" name="perMinute" type="number" value="${esc(f.perMinute ?? 150)}" required min="0" step="1"></div>
              <div class="col-6"><label class="form-label">Booking fee (TZS)</label>
                <input class="form-control" name="bookingFee" type="number" value="${esc(f.bookingFee ?? 500)}" required min="0" step="1"></div>
            </div>
            <hr class="my-3">
            <p class="small fw-semibold mb-2">Vehicle multipliers</p>
            <div class="row g-2">
              <div class="col-4"><label class="form-label">Boda</label>
                <input class="form-control" name="bodaMultiplier" type="number" value="${esc(m.boda ?? 1)}" required min="0.1" step="0.01"></div>
              <div class="col-4"><label class="form-label">Bajaji</label>
                <input class="form-control" name="bajajiMultiplier" type="number" value="${esc(m.bajaji ?? 1.15)}" required min="0.1" step="0.01"></div>
              <div class="col-4"><label class="form-label">Taxi</label>
                <input class="form-control" name="taxiMultiplier" type="number" value="${esc(m.taxi ?? 1.5)}" required min="0.1" step="0.01"></div>
            </div>
            <button class="btn btn-primary mt-3" type="submit">Save fare settings</button>
          </form>
        </div>
      </div>
      <div class="col-12 col-lg-6">
        <div class="card-x p-4">
          <h6 class="mb-3">Commission & settlement</h6>
          <form id="commissionForm">
            <div class="mb-3"><label class="form-label">Settlement cycle limit (TZS)</label>
              <input class="form-control" name="cycleLimit" type="number" value="${esc(cs.cycleLimit || 60000)}" required min="1"></div>
            <div class="mb-3"><label class="form-label">ZenjiGO commission (%)</label>
              <input class="form-control" name="percent" type="number" value="${esc(cs.percent || 20)}" required min="0" max="100" step="0.1"></div>
            <button class="btn btn-primary" type="submit">Save commission settings</button>
          </form>
        </div>
        <div class="card-x p-4 mt-4">
          <h6 class="mb-1">Rider near-pickup cancellation</h6>
          <p class="small text-muted mb-3">If a rider cancels while the driver is within this distance (or has arrived), the driver is credited <b>percent %</b> of the estimated fare (platform fronts it; 0% commission). The same amount is added silently to the rider’s next ride total (recovered via cash / wallet / PayGrid). The rider never sees a separate “cancellation fee” line.</p>
          <form id="cancelForm">
            <div class="mb-3"><label class="form-label">Near-pickup radius (km)</label>
              <input class="form-control" name="nearPickupKm" type="number" value="${esc((D.cancelSettings || {}).nearPickupKm ?? 1)}" required min="0" step="0.1"></div>
            <div class="mb-3"><label class="form-label">Fee percent of estimated fare</label>
              <input class="form-control" name="percent" type="number" value="${esc((D.cancelSettings || {}).percent ?? 20)}" required min="0" max="100" step="0.1"></div>
            <button class="btn btn-primary" type="submit">Save cancellation policy</button>
          </form>
        </div>
      </div>
    </div>`;
  },

  settings() {
    return `<div class="card-x p-4">
      <h6>Platform settings</h6>
      <p class="settings-api-note small">Stored in MySQL <code>app_settings</code>. Values below are live from the API.</p>
      <pre class="settings-json-preview p-3 rounded small" style="max-height:400px;overflow:auto">${esc(JSON.stringify(D.settings || {}, null, 2))}</pre>
      <div class="mt-3">
        <label class="form-label">API base URL (saved in browser)</label>
        <div class="input-group" style="max-width:480px">
          <input class="form-control" id="apiBaseInput" value="${esc(API.base)}">
          <button class="btn btn-outline-primary" id="saveApiBase">Save</button>
        </div>
      </div>
    </div>`;
  }
};

/* ---------- Event binding ---------- */

let _adminLiveMap = null;
let _adminLiveLayer = null;

async function initAdminLiveMap() {
  const el = document.getElementById('adminLiveMap');
  if (!el || typeof L === 'undefined') return;
  try {
    if (_adminLiveMap) {
      _adminLiveMap.remove();
      _adminLiveMap = null;
    }
    const center = [-6.1659, 39.2026];
    _adminLiveMap = L.map(el).setView(center, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(_adminLiveMap);
    _adminLiveLayer = L.layerGroup().addTo(_adminLiveMap);

    let data = { rides: [], drivers: [] };
    try {
      data = await ZenjiGOAdminAPI.get('/admin/live-map');
    } catch (e) {
      console.warn('live-map', e);
      // Fallback: use already-loaded D.rides / D.drivers without coords
    }

    const bounds = [];
    const rides = data.rides || [];
    const drivers = data.drivers || [];

    drivers.forEach((d) => {
      const lat = Number(d.lat ?? d.current_lat);
      const lng = Number(d.lng ?? d.current_lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      const m = L.circleMarker([lat, lng], { radius: 8, color: '#0d9488', fillColor: '#14b8a6', fillOpacity: 0.9, weight: 2 });
      m.bindPopup(`<strong>${esc(d.fullName || d.name || 'Driver')}</strong><br>${esc(d.vehicleType || '')} ${esc(d.plateNumber || '')}<br>Online`);
      m.addTo(_adminLiveLayer);
      bounds.push([lat, lng]);
    });

    rides.forEach((r) => {
      const plat = Number(r.pickupLat ?? r.pickup_lat);
      const plng = Number(r.pickupLng ?? r.pickup_lng);
      const dlat = Number(r.destinationLat ?? r.destination_lat);
      const dlng = Number(r.destinationLng ?? r.destination_lng);
      if (!Number.isNaN(plat) && !Number.isNaN(plng)) {
        const m = L.marker([plat, plng]);
        m.bindPopup(`<strong>Ride #${esc(r.id)}</strong><br>${esc(r.riderName || r.rider || '')}<br>${esc(r.pickupAddress || r.from || 'Pickup')}<br>${badge(r.status)}`);
        m.addTo(_adminLiveLayer);
        bounds.push([plat, plng]);
      }
      if (!Number.isNaN(dlat) && !Number.isNaN(dlng)) {
        const m = L.circleMarker([dlat, dlng], { radius: 6, color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.85 });
        m.bindPopup(`Destination · ${esc(r.destinationAddress || r.to || '')}`);
        m.addTo(_adminLiveLayer);
        bounds.push([dlat, dlng]);
      }
      // Driver position on active ride
      const drLat = Number(r.driverLat ?? r.driver_lat);
      const drLng = Number(r.driverLng ?? r.driver_lng);
      if (!Number.isNaN(drLat) && !Number.isNaN(drLng)) {
        const m = L.circleMarker([drLat, drLng], { radius: 7, color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.9 });
        m.bindPopup(`Driver on ride #${esc(r.id)}: ${esc(r.driverName || '')}`);
        m.addTo(_adminLiveLayer);
        bounds.push([drLat, drLng]);
      }
    });

    if (bounds.length) {
      try { _adminLiveMap.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 }); } catch (_) {}
    }
    const meta = document.getElementById('liveMapMeta');
    if (meta) meta.textContent = `${drivers.length} online drivers · ${rides.length} active rides`;
    setTimeout(() => { try { _adminLiveMap.invalidateSize(); } catch (_) {} }, 200);
  } catch (e) {
    console.warn('initAdminLiveMap', e);
    const meta = document.getElementById('liveMapMeta');
    if (meta) meta.textContent = 'Map unavailable';
  }
}

function bindPageEvents() {
  // Table filter (supports name, phone, email, plate, codes, and numeric IDs)
  $$('.toolbar input[id$="Search"]').forEach((inp) => {
    inp.oninput = () => {
      applyRowFilters();
    };
  });

  function applyRowFilters() {
    const q = ($$('.toolbar input[id$="Search"]').find(i => i.offsetParent !== null)?.value || '').toLowerCase().trim();
    const statusSel = document.querySelector('#content select.filter-status, #content select[data-filter="status"]');
    const statusVal = (statusSel?.value || '').toLowerCase();
    const docSel = document.getElementById('docExpiryFilter');
    const docVal = (docSel?.value || '').toLowerCase();
    $$('#content tbody tr').forEach((tr) => {
      const hay = (tr.getAttribute('data-search') || tr.textContent || '').toLowerCase();
      const st = (tr.getAttribute('data-status') || '').toLowerCase();
      const doc = (tr.getAttribute('data-doc-expiry') || '').toLowerCase();
      let match = true;
      if (q) {
        match = hay.includes(q)
          || hay.split(/\s+/).some((tok) => tok === q || tok.replace(/^#/, '') === q)
          || (q.replace(/\D/g, '') && hay.replace(/\D/g, '').includes(q.replace(/\D/g, '')));
      }
      if (match && statusVal) match = st.includes(statusVal) || hay.includes(statusVal);
      if (match && docVal) match = doc === docVal;
      tr.classList.toggle('d-none', !match);
    });
  }

  $$('#content select.filter-status, #content select[data-filter="status"], #docExpiryFilter').forEach((sel) => {
    sel.onchange = () => applyRowFilters();
  });

  // Bulk select all
  const bulkAll = document.getElementById('bulkSelectAll');
  if (bulkAll) {
    bulkAll.onchange = () => {
      $$('#content tbody tr:not(.d-none) .row-check').forEach((c) => { c.checked = bulkAll.checked; });
    };
  }

  // Bulk archive drivers
  document.getElementById('btnBulkDeleteDrivers')?.addEventListener('click', async () => {
    const ids = $$('#content .row-check:checked').map((c) => c.value).filter(Boolean);
    if (!ids.length) return toast('Select at least one driver', 'warning');
    if (!confirm(`Archive ${ids.length} selected driver(s)?`)) return;
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        await API.delete('/admin/drivers/' + encodeURIComponent(id));
        ok++;
      } catch (_) { fail++; }
    }
    toast(`Archived ${ok}${fail ? `, failed ${fail}` : ''}`);
    await syncAll();
    renderPage('drivers');
  });


  /* Support chat center */
  let adminCurrentConv = null;
  const openAdminChat = async (id) => {
    adminCurrentConv = id;
    const conv = (D.conversations || []).find(c => String(c.id) === String(id));
    const panel = $('#adminChatPanel');
    if (!panel) return;
    panel.classList.remove('d-none');
    $('#adminChatTitle').textContent = conv?.customerName || conv?.title || ('Conversation #' + id);
    $('#adminChatSub').textContent = [conv?.customerRole, conv?.type].filter(Boolean).join(' · ');
    const box = $('#adminChatMessages');
    box.innerHTML = '<div class="text-center py-3 text-muted small">Loading…</div>';
    try {
      const msgs = await API.get('/admin/conversations/' + encodeURIComponent(id) + '/messages');
      const list = Array.isArray(msgs) ? msgs : [];
      const me = API.session()?.user?.id;
      box.innerHTML = list.map(m => {
        const mine = m.isMine || m.senderRole === 'admin' || (me && Number(m.senderId) === Number(me));
        const time = m.createdAt || m.created_at ? new Date(m.createdAt || m.created_at).toLocaleString() : '';
        const isDark = document.documentElement.dataset.theme === 'dark' || document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const bg = mine ? '#0d9488' : (isDark ? '#1e3a45' : '#f1f5f9');
        const fg = mine ? '#ffffff' : (isDark ? '#e8f1f4' : '#0f172a');
        const border = mine ? 'transparent' : (isDark ? 'rgba(255,255,255,.12)' : 'var(--bs-border-color)');
        return `<div style="align-self:${mine ? 'flex-end' : 'flex-start'};max-width:75%">
          <div style="padding:10px 14px;border-radius:14px;background:${bg};color:${fg};border:1px solid ${border};font-size:.9rem;line-height:1.45;word-break:break-word">${esc(m.text || '')}</div>
          <div class="small mt-1" style="text-align:${mine ? 'right' : 'left'};color:${isDark ? 'rgba(232,241,244,.65)' : 'var(--bs-secondary-color)'}">${esc(m.senderName || m.senderRole || '')} · ${esc(time)}</div>
        </div>`;
      }).join('') || '<div class="text-muted small text-center">No messages yet</div>';
      box.scrollTop = box.scrollHeight;
      await API.post('/admin/conversations/' + encodeURIComponent(id) + '/read', {}).catch(() => null);
      if (conv) { conv.unreadCount = 0; conv.unread_count = 0; }
      updateIndicators();
    } catch (err) {
      box.innerHTML = '<div class="text-danger small">' + esc(err.message) + '</div>';
    }
  };
  $$('#content [data-action="open-chat"]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openAdminChat(btn.dataset.id); });
  });
  $$('#content tr[data-conversation-id]').forEach((row) => {
    row.addEventListener('click', () => openAdminChat(row.dataset.conversationId));
  });
  $('#adminChatClose')?.addEventListener('click', () => { $('#adminChatPanel')?.classList.add('d-none'); adminCurrentConv = null; });
  $('#adminChatForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!adminCurrentConv) return;
    const input = $('#adminChatInput');
    const text = (input?.value || '').trim();
    if (!text) return;
    const state = loadBtn(e.submitter);
    try {
      await API.post('/admin/conversations/' + encodeURIComponent(adminCurrentConv) + '/messages', { text });
      input.value = '';
      await openAdminChat(adminCurrentConv);
      const refreshed = await API.get('/admin/conversations').catch(() => null);
      if (Array.isArray(refreshed)) D.conversations = refreshed;
      updateIndicators();
    } catch (err) { toast(err.message, 'error'); }
    finally { state.done(); }
  });
  $$('#content [data-action="refresh-chat"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const state = loadBtn(btn);
      try {
        const refreshed = await API.get('/admin/conversations');
        D.conversations = refreshed || [];
        renderPage('chat');
        toast('Inbox refreshed');
      } catch (err) { toast(err.message, 'error'); }
      finally { state.done(); }
    });
  });

  $$('#content tr[data-notification-id]').forEach((row) => {
    const markRead = async () => {
      const item = (D.notifications || []).find(n => String(n.id) === String(row.dataset.notificationId));
      if (!item || item.read_at || item.readAt || row.dataset.busy === '1') return;
      row.dataset.busy = '1'; row.classList.add('is-marking-read');
      try {
        await API.patch(`/admin/notifications/${encodeURIComponent(item.id)}/read`, {});
        item.read_at = new Date().toISOString(); item.readAt = item.read_at;
        updateIndicators(); renderPage('notifications');
        toast('Notification marked as read');
      } catch (err) {
        row.classList.remove('is-marking-read'); delete row.dataset.busy;
        toast(err.message || 'Could not mark notification as read', 'error');
      }
    };
    row.addEventListener('click', markRead);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markRead(); } });
  });

  $('#btnRefreshLive')?.addEventListener('click', async (e) => { const state = loadBtn(e.currentTarget); try { await syncAll(); renderPage('live'); initAdminLiveMap(); } finally { state.done(); } });
  if (currentPage === 'live') initAdminLiveMap();
  $('#btnRefreshRides')?.addEventListener('click', async () => { await syncAll(); renderPage('rides'); toast('Rides refreshed'); });
  $('#btnRefreshDrivers')?.addEventListener('click', async () => { await syncAll(); renderPage('drivers'); toast('Drivers refreshed'); });
  $('#btnRefreshRiders')?.addEventListener('click', async () => { await syncAll(); renderPage('riders'); toast('Riders refreshed'); });
  $('#btnRefreshAdmins')?.addEventListener('click', async () => { await syncAll(); renderPage('admins'); toast('Admins refreshed'); });

  $('#commissionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.patch('/admin/commission-settings', {
        cycleLimit: Number(fd.get('cycleLimit')),
        percent: Number(fd.get('percent'))
      });
      toast('Commission settings saved');
      await syncAll();
      renderPage('pricing');
    } catch (err) { toast(err.message, 'danger'); }
  });

  $('#fareForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.patch('/admin/fare-settings', {
        baseFare: Number(fd.get('baseFare')),
        perKm: Number(fd.get('perKm')),
        perMinute: Number(fd.get('perMinute')),
        bookingFee: Number(fd.get('bookingFee')),
        multipliers: {
          boda: Number(fd.get('bodaMultiplier')),
          bajaji: Number(fd.get('bajajiMultiplier')),
          taxi: Number(fd.get('taxiMultiplier'))
        }
      });
      toast('Fare settings saved — new ride quotes use these values');
      await syncAll();
      renderPage('pricing');
    } catch (err) { toast(err.message, 'danger'); }
  });

  $('#cancelForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.patch('/admin/cancel-settings', {
        nearPickupKm: Number(fd.get('nearPickupKm')),
        percent: Number(fd.get('percent'))
      });
      toast('Cancellation policy saved');
      await syncAll();
      renderPage('pricing');
    } catch (err) { toast(err.message, 'danger'); }
  });

  $('#saveApiBase')?.addEventListener('click', () => {
    const v = $('#apiBaseInput')?.value?.trim();
    if (v) { localStorage.setItem('zenjigo-api-url', v); toast('API base saved. Reload the page.'); }
  });
}

/* ---------- Init ---------- */
function initAuthUI() {
  makeOtp($('#loginOtpInputs'));
  makeOtp($('#forgotOtpInputs'));

  $$('[data-auth]').forEach((b) => b.onclick = () => showAuth(b.dataset.auth));

  const toggle = $('.password-toggle');
  if (toggle) {
    toggle.onclick = () => {
      const i = $('#loginPassword');
      if (!i) return;
      i.type = i.type === 'password' ? 'text' : 'password';
      const icon = toggle.querySelector('i');
      if (icon) icon.className = 'bi ' + (i.type === 'password' ? 'bi-eye' : 'bi-eye-slash');
    };
  }

  $('#loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loadBtn(e.submitter);
    try {
      const email = $('#loginEmail').value.trim();
      const password = $('#loginPassword').value;
      const d = await API.login(email, password);
      localStorage.setItem('zenjigo-admin-email', email);
      // Backend may return tokens directly or require OTP
      if (d.accessToken) {
        API.saveSession(d);
        await enterApp();
        toast('Signed in successfully');
      } else {
        $('#otpEmailLabel') && ($('#otpEmailLabel').textContent = d.maskedEmail || email);
        showAuth('otp');
        $('#loginOtpInputs input')?.focus();
        toast('Security OTP sent');
      }
    } catch (err) {
      toast(err.message, 'danger');
    } finally { btn.done(); }
  });

  $('#otpForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = $$('#loginOtpInputs input');
    if (inputs.some((i) => !i.value)) { toast('Enter the complete 6-digit OTP', 'danger'); return; }
    const btn = loadBtn(e.submitter);
    try {
      const code = inputs.map((i) => i.value).join('');
      const email = localStorage.getItem('zenjigo-admin-email') || $('#loginEmail')?.value;
      await API.verifyOtp(email, code);
      await enterApp();
      toast('Signed in successfully');
    } catch (err) {
      toast(err.message, 'danger');
    } finally { btn.done(); }
  });

  $('#logoutBtn')?.addEventListener('click', signOut);
  $('#logoutDropdown')?.addEventListener('click', signOut);

  $$('.nav-link[data-page]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      renderPage(a.dataset.page);
      $('#adminApp')?.classList.remove('sidebar-open');
    });
  });
  $$('[data-page-jump]').forEach((b) => {
    b.addEventListener('click', () => renderPage(b.dataset.pageJump));
  });

  const openMobileNav = () => $('#adminApp')?.classList.add('sidebar-open');
  const closeMobileNav = () => $('#adminApp')?.classList.remove('sidebar-open');
  $('#openSidebar')?.addEventListener('click', openMobileNav);
  $('#closeSidebar')?.addEventListener('click', closeMobileNav);
  $('#sidebarBackdrop')?.addEventListener('click', closeMobileNav);

  // Clickable dashboard metric cards
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.metric-card[data-metric-page]');
    if (!card) return;
    const page = card.dataset.metricPage;
    const filter = card.dataset.metricFilter || '';
    if (!page) return;
    renderPage(page);
    if (filter) {
      setTimeout(() => {
        const search = document.querySelector('#content input[id$="Search"], #content .global-search input, #driverSearch, #rideSearch');
        if (search) {
          search.value = filter;
          search.dispatchEvent(new Event('input', { bubbles: true }));
        }
        // Prefer status filter selects if present
        const statusSel = document.querySelector('#content select[data-filter="status"], #content select.filter-status');
        if (statusSel) {
          statusSel.value = filter;
          statusSel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 80);
    }
  });

  // Escape key closes mobile sidebar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileNav();
  });

  const applyTheme = (theme) => { document.documentElement.dataset.theme = theme; document.documentElement.setAttribute('data-bs-theme', theme); localStorage.setItem('zenjigo-theme', theme); const icon = $('#themeBtn i'); if (icon) icon.className = 'bi ' + (theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'); };
  applyTheme(localStorage.getItem('zenjigo-theme') || 'light');
  $('#themeBtn')?.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#globalSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    $$('#content tbody tr').forEach((tr) => {
      if (!q) { tr.classList.remove('d-none'); return; }
      const hay = (tr.getAttribute('data-search') || tr.textContent || '').toLowerCase();
      const digits = q.replace(/\D/g, '');
      const match = hay.includes(q)
        || hay.split(/\s+/).some((tok) => tok === q || tok.replace(/^#/, '') === q)
        || (digits && hay.replace(/\D/g, '').includes(digits));
      tr.classList.toggle('d-none', !match);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
  // Ensure Admins nav item exists
  const nav = document.querySelector('.sidebar nav, aside nav, .sidebar-nav');
  if (nav && !nav.querySelector('[data-page="admins"]')) {
    const settingsLink = nav.querySelector('[data-page="settings"]');
    const a = document.createElement('a');
    a.className = 'nav-link';
    a.dataset.page = 'admins';
    a.innerHTML = '<i class="bi bi-shield-lock"></i><span>Admins</span>';
    if (settingsLink) settingsLink.parentNode.insertBefore(a, settingsLink);
    else nav.appendChild(a);
    a.addEventListener('click', (e) => { e.preventDefault(); renderPage('admins'); });
  }

  if (API.session()?.accessToken) {
    enterApp().catch(() => { API.clearSession(); showAuth('login'); });
  } else {
    showAuth('login');
  }
});
})();
