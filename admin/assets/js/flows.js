(() => {
'use strict';

const API = window.ZenjiGOAdminAPI;
const D = window.ZENJIGO_DATA;
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const statusClass = (s) => /active|success|completed|verified|delivered|confirmed|approved|paid/i.test(s) ? 'success'
  : /pending|review|assigned|arriving|searching|due|investigating|under_review/i.test(s) ? 'warning'
  : /cancel|reject|restrict|critical|failed|suspended/i.test(s) ? 'danger' : 'info';
const statusBadge = (s) => `<span class="status ${statusClass(s)}">${esc(String(s || '—').replace(/_/g, ' '))}</span>`;

function input(label, name, type = 'text', value = '', required = true, extra = '') {
  return `<div class="mb-3"><label class="form-label">${esc(label)}</label>
    <input class="form-control" name="${esc(name)}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${extra}></div>`;
}
function select(label, name, options, value = '') {
  return `<div class="mb-3"><label class="form-label">${esc(label)}</label>
    <select class="form-select" name="${esc(name)}" required>
      ${options.map((o) => `<option value="${esc(o)}" ${String(o) === String(value) ? 'selected' : ''}>${esc(o)}</option>`).join('')}
    </select></div>`;
}
function textarea(label, name, value = '', rows = 3) {
  return `<div class="mb-3"><label class="form-label">${esc(label)}</label>
    <textarea class="form-control" name="${esc(name)}" rows="${rows}" required>${esc(value)}</textarea></div>`;
}
function userOptions() {
  const users = [...(D.riders || []).map(u => ({...u, role:'Rider'})), ...(D.drivers || []).map(u => ({...u, role:'Driver'}))];
  return users.map(u => `<option value="${esc(u.dbId || u.id)}">${esc(u.name || 'Unnamed user')} · ${esc(u.role)} · ${esc(u.phone || 'No phone')} (#${esc(u.dbId || u.id)})</option>`).join('');
}

function openModal(eyebrow, title, bodyHtml, footerHtml) {
  $('#modalEyebrow').textContent = eyebrow;
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHtml;
  $('#modalFooter').innerHTML = footerHtml || '';
  const modal = bootstrap.Modal.getOrCreateInstance($('#genericModal'));
  modal.show();
  return modal;
}
function closeModal() {
  bootstrap.Modal.getInstance($('#genericModal'))?.hide();
}

async function afterMutation(page) {
  await window.syncAll();
  window.renderPage(page || window.currentPage || 'dashboard');
}

/* ---------- Action handlers ---------- */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const status = btn.dataset.status;

  try {
    switch (action) {
      /* Drivers */
      case 'add-driver': {
        openModal('DRIVER', 'Add driver',
          `<form id="flowForm" class="professional-form">
            <div class="form-intro"><span class="form-icon"><i class="bi bi-person-vcard"></i></span>
              <div><h6>Driver profile</h6><p>Enter contact, vehicle and document details. Application status advances level by level (under_review → active).</p></div>
            </div>
            <div class="row g-3">
              <div class="col-12 col-md-6">${input('Full name', 'fullName')}</div>
              <div class="col-12 col-md-6">${input('Phone number', 'phone', 'tel', '', true, 'placeholder="+255…"')}</div>
              <div class="col-12 col-md-6">${input('Email address', 'email', 'email', '', false)}</div>
              <div class="col-12 col-md-6">${input('National ID', 'nationalId', 'text', '', true)}</div>
              <div class="col-12">${input('Home address', 'homeAddress', 'text', '', false)}</div>
              <div class="col-12"><hr class="my-1"><h6 class="small text-muted text-uppercase mb-2">Vehicle</h6></div>
              <div class="col-12 col-md-4">${select('Vehicle type', 'vehicleType', ['taxi', 'boda', 'bajaji'])}</div>
              <div class="col-12 col-md-4">${input('Plate number', 'plateNumber')}</div>
              <div class="col-12 col-md-4">${input('Color', 'color', 'text', '', false)}</div>
              <div class="col-12 col-md-4">${input('Make', 'make', 'text', '', false)}</div>
              <div class="col-12 col-md-4">${input('Model', 'model', 'text', '', false)}</div>
              <div class="col-12 col-md-4">${input('Year', 'year', 'number', '', false, 'min="1990" max="2035" placeholder="e.g. 2020"')}</div>
              <div class="col-12"><hr class="my-1"><h6 class="small text-muted text-uppercase mb-2">Documents & expiry</h6></div>
              <div class="col-12 col-md-6">${input("Driver's license number", 'licenseNumber', 'text', '', false)}</div>
              <div class="col-12 col-md-6">${input('License expiry date', 'licenseExpiresAt', 'date', '', false)}</div>
              <div class="col-12 col-md-6">${input('Insurance policy #', 'insuranceNumber', 'text', '', false)}</div>
              <div class="col-12 col-md-6">${input('Insurance expiry date', 'insuranceExpiresAt', 'date', '', false)}</div>
              <div class="col-12 col-md-6">${input('National ID expiry (optional)', 'nationalIdExpiresAt', 'date', '', false)}</div>
              <div class="col-12 col-md-6">${select('Application status', 'status', ['under_review', 'pending', 'active'])}</div>
              <div class="col-12"><p class="form-text mb-0">After creation, upload document images from the driver detail view. Status advances under_review → active once documents are verified.</p></div>
            </div>
          </form>`,
          `<button class="btn btn-primary" data-flow-submit="create-driver"><i class="bi bi-check2-circle me-1"></i>Create driver</button>`);
        break;
      }
      case 'edit-driver': {
        const d = D.drivers.find((x) => String(x.id) === String(id));
        if (!d) return toast('Driver not found', 'danger');
        const vType = String(d.vehicle || d.type || 'taxi').toLowerCase().replace('—', 'taxi');
        openModal('DRIVER', 'Edit driver',
          `<form id="flowForm" class="professional-form">
            <div class="row g-2">
              <div class="col-md-6">${input('Full name', 'fullName', 'text', d.name)}</div>
              <div class="col-md-6">${input('Phone', 'phone', 'tel', d.phone)}</div>
              <div class="col-md-6">${input('Email', 'email', 'email', d.email === '—' ? '' : d.email, false)}</div>
              <div class="col-md-6">${input('National ID', 'nationalId', 'text', d.nationalId || '', false)}</div>
              <div class="col-12">${input('Home address', 'homeAddress', 'text', d.homeAddress || '', false)}</div>
              <div class="col-md-4">${select('Vehicle type', 'vehicleType', ['taxi', 'boda', 'bajaji'], ['taxi','boda','bajaji'].includes(vType) ? vType : 'taxi')}</div>
              <div class="col-md-4">${input('Plate number', 'plateNumber', 'text', d.plate === '—' ? '' : d.plate)}</div>
              <div class="col-md-4">${input('Color', 'color', 'text', d.color || '', false)}</div>
              <div class="col-md-4">${input('Make', 'make', 'text', d.make || '', false)}</div>
              <div class="col-md-4">${input('Model', 'model', 'text', d.model || '', false)}</div>
              <div class="col-md-4">${input('Year', 'year', 'number', d.year || '', false)}</div>
              <div class="col-md-6">${select('Application status', 'applicationStatus', ['pending', 'under_review', 'active', 'rejected'], d.status)}</div>
            </div>
          </form>`,
          `<button class="btn btn-primary" data-flow-submit="update-driver" data-id="${id}">Save changes</button>`);
        break;
      }
      
      case 'view-driver': {
        try {
          const detail = await API.get(`/admin/drivers/${id}`);
          const p = detail.profile || detail;
          const docs = detail.documents || [];
          const appStatus = p.application_status || p.applicationStatus || '—';
          const rejectReason = p.rejection_reason || p.rejectionReason || '';
          const docsHtml = docs.length
            ? docs.map(doc => {
                const dtype = doc.document_type || doc.documentType || doc.type || 'Document';
                const st = doc.status || 'pending';
                const url = doc.url || '#';
                const rr = doc.rejection_reason || doc.rejectionReason || '';
                return `<div class="border rounded p-2 mb-2 d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <div class="fw-semibold">${esc(dtype.replace(/_/g,' '))}</div>
                    <div class="small text-muted">${statusBadge(st)}${rr ? ` · <span class="text-danger">${esc(rr)}</span>` : ''}</div>
                    <a href="${esc(url)}" target="_blank" rel="noopener" class="small">Open file</a>
                  </div>
                  <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-success" data-action="doc-status" data-id="${doc.id}" data-status="approved">Approve</button>
                    <button type="button" class="btn btn-outline-danger" data-action="doc-status" data-id="${doc.id}" data-status="rejected">Reject</button>
                  </div>
                </div>`;
              }).join('')
            : '<p class="text-muted mb-0">No documents uploaded for this driver.</p>';
          const vType = p.vehicleType || p.type || '—';
          const vPlate = p.plateNumber || p.plate_number || '—';
          const vMake = p.make || '—';
          const vModel = p.model || '—';
          const vColor = p.color || '—';
          const vYear = p.year || p.model_year || p.modelYear || '—';
          const homeAddr = p.home_address || p.homeAddress || '—';
          const natId = p.national_id || p.nationalId || '—';
          openModal('DRIVER DETAILS', `${esc(p.full_name || p.fullName || 'Driver')} · ${esc(p.driver_code || p.driverCode || id)}`,
            `<div class="d-flex align-items-center gap-3 mb-3 p-3 rounded-3" style="background:var(--bs-tertiary-bg,#f8fafc)">
              ${photoHtml}
              <div>
                <div class="fw-bold fs-5">${esc(p.full_name || p.fullName || 'Driver')}</div>
                <div class="text-muted small">${esc(p.phone || '')} · ${esc(p.email || '')}</div>
                <div class="mt-1"><i class="bi bi-star-fill text-warning"></i> ${rating} · ${Number(p.total_rides||p.totalRides||0)} rides · Earnings ${Number(earnings).toLocaleString()} TZS</div>
                <div class="mt-1">${badge(appStatus)}${rejectReason ? ` <span class="small text-danger">${esc(rejectReason)}</span>` : ''}</div>
              </div>
            </div>
            <div class="mb-3">
              <h6 class="fw-bold mb-2">Personal</h6>
              <div class="row g-2 small mb-3">
                <div class="col-md-6"><span class="text-muted">Full name</span><div class="fw-semibold">${esc(p.full_name || p.fullName || '—')}</div></div>
                <div class="col-md-6"><span class="text-muted">Driver code</span><div>${esc(p.driver_code || p.driverCode || '—')}</div></div>
                <div class="col-md-6"><span class="text-muted">Phone</span><div>${esc(p.phone || '—')}</div></div>
                <div class="col-md-6"><span class="text-muted">Email</span><div>${esc(p.email || '—')}</div></div>
                <div class="col-md-6"><span class="text-muted">National ID</span><div>${esc(natId)}</div></div>
                <div class="col-md-6"><span class="text-muted">Home address</span><div>${esc(homeAddr)}</div></div>
                <div class="col-md-6"><span class="text-muted">Application status</span><div>${statusBadge(appStatus)}</div></div>
                <div class="col-md-6"><span class="text-muted">Account status</span><div>${statusBadge(p.status || '—')}</div></div>
                ${rejectReason ? `<div class="col-12"><span class="text-muted">Rejection reason</span><div class="text-danger">${esc(rejectReason)}</div></div>` : ''}
              </div>
              <h6 class="fw-bold mb-2">Vehicle</h6>
              <div class="row g-2 small mb-3">
                <div class="col-md-4"><span class="text-muted">Type</span><div class="fw-semibold text-capitalize">${esc(vType)}</div></div>
                <div class="col-md-4"><span class="text-muted">Plate number</span><div class="fw-semibold">${esc(vPlate)}</div></div>
                <div class="col-md-4"><span class="text-muted">Color</span><div>${esc(vColor)}</div></div>
                <div class="col-md-4"><span class="text-muted">Make</span><div>${esc(vMake)}</div></div>
                <div class="col-md-4"><span class="text-muted">Model</span><div>${esc(vModel)}</div></div>
                <div class="col-md-4"><span class="text-muted">Year</span><div>${esc(vYear)}</div></div>
              </div>
            </div>
            <h6 class="fw-bold">Documents</h6>
            ${docsHtml}`,
            `<button class="btn btn-success" data-action="driver-status" data-id="${id}" data-status="active"><i class="bi bi-check-lg me-1"></i>Activate</button>
             <button class="btn btn-danger" data-action="reject-driver" data-id="${id}"><i class="bi bi-x-lg me-1"></i>Reject</button>`
          );
          window.__ZENJIGO_DETAIL_ID = id;
        } catch (err) {
          toast(err.message || 'Failed to load driver', 'danger');
        }
        break;
      }
      
      case 'view-rider': {
        try {
          const list = await API.get('/admin/riders').catch(() => []);
          const arr = Array.isArray(list) ? list : (list.items || list.riders || []);
          const p = arr.find(x => String(x.id) === String(id)) || {};
          const rides = (window.ZENJIGO_DATA?.rides || []).filter(r => String(r.riderId) === String(id) || r.rider === (p.fullName || p.full_name));
          const photo = p.photoUrl || p.photo_url || p.photo || '';
          const initials = String(p.fullName || p.full_name || '?').split(/\s+/).map(x => x[0]).slice(0,2).join('').toUpperCase();
          const photoHtml = photo
            ? `<img src="${esc(photo)}" alt="" style="width:72px;height:72px;border-radius:16px;object-fit:cover">`
            : `<div class="avatar avatar-blue" style="width:72px;height:72px;font-size:1.4rem">${esc(initials)}</div>`;
          openModal('RIDER PROFILE', esc(p.fullName || p.full_name || id),
            `<div class="d-flex align-items-center gap-3 mb-3 p-3 rounded-3" style="background:var(--bs-tertiary-bg,#f8fafc)">
              ${photoHtml}
              <div>
                <div class="fw-bold fs-5">${esc(p.fullName || p.full_name || '—')}</div>
                <div class="text-muted small">${esc(p.phone || '')} · ${esc(p.email || '')}</div>
                <div class="mt-1"><i class="bi bi-star-fill text-warning"></i> ${Number(p.rating||0).toFixed(1)} · ${p.totalRides||p.total_rides||0} rides · Wallet ${Number(p.walletBalance||p.wallet_balance||0).toLocaleString()} TZS</div>
                <div class="mt-1">${badge(p.status || '—')}</div>
              </div>
            </div>
            <div class="row g-2 small mb-3">
              <div class="col-md-4"><span class="text-muted">Island</span><div class="fw-semibold">${esc(p.island||'—')}</div></div>
              <div class="col-md-4"><span class="text-muted">Region</span><div class="fw-semibold">${esc(p.region||'—')}</div></div>
              <div class="col-md-4"><span class="text-muted">District / Ward</span><div class="fw-semibold">${esc(p.district||'—')} / ${esc(p.ward||'—')}</div></div>
            </div>
            <h6 class="fw-bold">Recent rides (${rides.length})</h6>
            <div class="table-responsive"><table class="table table-sm"><thead><tr><th>ID</th><th>Route</th><th>Fare</th><th>Status</th></tr></thead>
            <tbody>${rides.slice(0,12).map(r=>`<tr><td>${esc(r.id)}</td><td class="small">${esc(r.from)} → ${esc(r.to)}</td><td>${Number(r.fare||0).toLocaleString()}</td><td>${badge(r.status)}</td></tr>`).join('') || '<tr><td colspan="4" class="text-muted">No rides in current list</td></tr>'}</tbody></table></div>`,
            `<button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
             <button class="btn btn-outline-warning" data-action="rider-status" data-id="${id}" data-status="${(p.status==='suspended')?'active':'suspended'}">Toggle restrict</button>`);
        } catch (err) { toast(err.message || 'Could not load rider', 'danger'); }
        break;
      }

      case 'view-ride': {
        try {
          const detail = await API.get(`/admin/rides/${id}`);
          const ride = detail.ride || detail;
          const events = detail.events || [];
          openModal('RIDE DETAILS', esc(ride.ride_code || ride.id || id),
            `<div class="row g-2 small mb-3">
              <div class="col-md-6"><span class="text-muted">Status</span><div>${badge(ride.status)}</div></div>
              <div class="col-md-6"><span class="text-muted">Type / payment</span><div class="fw-semibold">${esc(ride.ride_type||ride.type||'—')} · ${esc(ride.payment_method||'—')}</div></div>
              <div class="col-md-6"><span class="text-muted">Rider</span><div class="fw-semibold">${esc(ride.riderName||ride.rider_name||'—')} <span class="text-muted">${esc(ride.riderPhone||'')}</span></div></div>
              <div class="col-md-6"><span class="text-muted">Driver</span><div class="fw-semibold">${esc(ride.driverName||ride.driver_name||'—')} <span class="text-muted">${esc(ride.driverPhone||'')}</span></div></div>
              <div class="col-12"><span class="text-muted">Pickup</span><div>${esc(ride.pickup_address||ride.pickupAddress||'—')}</div></div>
              <div class="col-12"><span class="text-muted">Destination</span><div>${esc(ride.destination_address||ride.destinationAddress||'—')}</div></div>
              <div class="col-md-4"><span class="text-muted">Fare</span><div class="fw-bold">${Number(ride.final_fare??ride.estimated_fare??0).toLocaleString()} TZS</div></div>
              <div class="col-md-4"><span class="text-muted">Distance / ETA</span><div>${esc(ride.estimated_distance_km||0)} km · ${esc(ride.estimated_duration_min||0)} min</div></div>
              <div class="col-md-4"><span class="text-muted">Created</span><div>${esc(ride.created_at ? new Date(ride.created_at).toLocaleString() : '—')}</div></div>
              ${ride.cancel_reason || ride.cancelReason ? `<div class="col-12"><div class="alert alert-danger py-2 mb-0"><strong>Cancel reason:</strong> ${esc(ride.cancel_reason||ride.cancelReason)}</div></div>` : ''}
            </div>
            <h6 class="fw-bold">Timeline</h6>
            <ul class="list-unstyled small mb-0">${events.length ? events.map(ev => `<li class="mb-1"><span class="text-muted">${esc(ev.created_at||ev.time||'')}</span> · <b>${esc(ev.event_type||ev.type||ev.status||'')}</b> ${esc(ev.note||ev.message||'')}</li>`).join('') : '<li class="text-muted">No events recorded</li>'}</ul>`,
            `<button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>`);
        } catch (err) { toast(err.message || 'Could not load ride', 'danger'); }
        break;
      }

      case 'report-status': {
        try {
          await API.patch(`/admin/driver-reports/${id}`, { status });
          toast('Report updated');
          if (typeof syncAll === 'function') await syncAll();
          if (typeof renderPage === 'function') renderPage('reports');
        } catch (err) { toast(err.message || 'Update failed', 'danger'); }
        break;
      }


      case 'reject-driver': {
        openModal('REJECT DRIVER', `Reject driver #${id}`,
          `<form id="flowForm" class="professional-form">
            <p class="text-muted small">Provide a clear reason. The driver will see this message on their profile.</p>
            <div class="mb-3">
              <label class="form-label">Rejection reason <span class="text-danger">*</span></label>
              <textarea name="reason" class="form-control" rows="4" required placeholder="e.g. License photo is unclear / Insurance expired / National ID does not match"></textarea>
            </div>
          </form>`,
          `<button class="btn btn-danger" data-flow-submit="reject-driver" data-id="${id}"><i class="bi bi-x-lg me-1"></i>Confirm reject</button>`
        );
        break;
      }
      case 'doc-status': {
        const docStatus = btn.dataset.status;
        let reason = '';
        if (docStatus === 'rejected') {
          reason = prompt('Rejection reason for this document:') || '';
          if (!reason.trim()) { toast('Rejection reason is required', 'danger'); return; }
        }
        try {
          await API.patch(`/admin/documents/${id}/status`, { status: docStatus, reason });
          toast(`Document ${docStatus}`);
          // Refresh detail if open
          const detailBtn = document.querySelector(`[data-action="view-driver"][data-id="${window.__ZENJIGO_DETAIL_ID || ''}"]`);
          if (window.__ZENJIGO_DETAIL_ID) {
            const reopen = document.querySelector(`[data-action="view-driver"][data-id="${window.__ZENJIGO_DETAIL_ID}"]`);
            // re-fetch via synthetic click path
            const detail = await API.get(`/admin/drivers/${window.__ZENJIGO_DETAIL_ID}`);
            toast('Document updated');
            await afterMutation('drivers');
          } else {
            await afterMutation('drivers');
          }
        } catch (err) {
          toast(err.message || 'Failed', 'danger');
        }
        break;
      }
      case 'driver-status': {
        let reason = '';
        if (status === 'suspended' || status === 'rejected') {
          reason = prompt(`Reason for ${status} (required, shown to the driver):`) || '';
          if (!reason.trim()) { toast('A reason is required', 'danger'); return; }
        } else if (!confirm(`Set driver #${id} status to "${status}"?`)) {
          return;
        }
        await API.patch(`/admin/drivers/${id}/status`, { status, reason: reason || undefined });
        toast('Driver status updated');
        // close any open modal
        try { bootstrap.Modal.getInstance(document.getElementById('genericModal'))?.hide(); } catch (_) {}
        await afterMutation('drivers');
        break;
      }
      
      case 'restore-archive': {
        if (!confirm('Restore this user to live data with all their previous information?')) return;
        try {
          await API.post(`/admin/archives/${id}/restore`, {});
          toast('User restored');
          await afterMutation('archive');
        } catch (err) {
          toast(err.message || 'Restore failed', 'danger');
        }
        break;
      }
      case 'permanent-delete-archive': {
        if (!confirm('PERMANENTLY delete this archived user and all their data? This cannot be undone.')) return;
        if (!confirm('Type confirmation: permanently delete? Click OK to proceed.')) return;
        try {
          await API.del(`/admin/archives/${id}`);
          toast('Archived user permanently deleted');
          await afterMutation('archive');
        } catch (err) {
          toast(err.message || 'Delete failed', 'danger');
        }
        break;
      }
      case 'delete-driver': {
        if (!confirm('Archive this driver? They will be removed from live data and cannot log in. You can restore them later from Archive.')) return;
        await API.del(`/admin/drivers/${id}`);
        toast('Driver archived');
        await afterMutation('drivers');
        break;
      }

      /* Riders */
      case 'add-rider': {
        openModal('RIDER', 'Add rider',
          `<form id="flowForm">
            ${input('Full name', 'fullName')}
            ${input('Phone', 'phone', 'tel')}
            ${input('Email', 'email', 'email', '', false)}
            ${input('Island', 'island', 'text', 'Unguja', false)}
            ${input('Region / area', 'region', 'text', '', false)}
            ${select('Status', 'status', ['active', 'pending', 'suspended'])}
          </form>`,
          `<button class="btn btn-primary" data-flow-submit="create-rider">Create rider</button>`);
        break;
      }
      case 'edit-rider': {
        const r = D.riders.find((x) => String(x.id) === String(id));
        if (!r) return toast('Rider not found', 'danger');
        openModal('RIDER', 'Edit rider',
          `<form id="flowForm">
            ${input('Full name', 'fullName', 'text', r.name)}
            ${input('Phone', 'phone', 'tel', r.phone)}
            ${input('Email', 'email', 'email', r.email === '—' ? '' : r.email, false)}
            ${input('Island', 'island', 'text', r.island === '—' ? '' : r.island, false)}
            ${input('Region / area', 'region', 'text', r.area === '—' ? '' : r.area, false)}
            ${select('Status', 'status', ['active', 'pending', 'suspended', 'rejected'], r.status)}
          </form>`,
          `<button class="btn btn-primary" data-flow-submit="update-rider" data-id="${id}">Save changes</button>`);
        break;
      }
      case 'rider-status': {
        await API.patch(`/admin/riders/${id}/status`, { status });
        toast('Rider status updated');
        await afterMutation('riders');
        break;
      }
      case 'delete-rider': {
        if (!confirm('Archive this rider? They will be removed from live data and cannot log in. You can restore them later from Archive.')) return;
        await API.del(`/admin/riders/${id}`);
        toast('Rider archived');
        await afterMutation('riders');
        break;
      }

      /* Admins */
      case 'add-admin': {
        openModal('ADMIN', 'Add sub-admin',
          `<form id="flowForm">
            ${input('Full name', 'fullName')}
            ${input('Email', 'email', 'email')}
            ${input('Phone', 'phone', 'tel', '', false)}
            ${input('Password', 'password', 'password', '', true, 'minlength="8"')}
            ${select('Status', 'status', ['active', 'suspended'])}
          </form>`,
          `<button class="btn btn-primary" data-flow-submit="create-admin">Create admin</button>`);
        break;
      }
      case 'edit-admin': {
        const a = D.admins.find((x) => String(x.id) === String(id));
        if (!a) return toast('Admin not found', 'danger');
        openModal('ADMIN', 'Edit admin',
          `<form id="flowForm">
            ${input('Full name', 'fullName', 'text', a.name)}
            ${input('Email', 'email', 'email', a.email)}
            ${input('Phone', 'phone', 'tel', a.phone === '—' ? '' : a.phone, false)}
            ${input('New password (optional)', 'password', 'password', '', false, 'minlength="8"')}
            ${select('Status', 'status', ['active', 'suspended'], a.status)}
          </form>`,
          `<button class="btn btn-primary" data-flow-submit="update-admin" data-id="${id}">Save changes</button>`);
        break;
      }
      case 'delete-admin': {
        if (!confirm('Archive this admin? They will be removed from live data and cannot log in.')) return;
        await API.del(`/admin/admins/${id}`);
        toast('Admin archived');
        await afterMutation('admins');
        break;
      }

      /* Promos */
      case 'add-promo': {
        openModal('PROMOTION', 'Create promotion',
          `<form id="flowForm">
            ${input('Code', 'code')}
            ${input('Title / description', 'description')}
            ${select('Discount type', 'discountType', ['percent', 'fixed'])}
            ${input('Discount value', 'discountValue', 'number', '10')}
            ${input('Usage limit (blank = unlimited)', 'usageLimit', 'number', '', false)}
            ${select('Applies to', 'appliesTo', ['all', 'ride', 'parcel', 'tour'])}
            ${input('Valid from', 'validFrom', 'date', new Date().toISOString().slice(0, 10))}
            ${input('Valid until', 'validUntil', 'date', '', false)}
          </form>`,
          `<button class="btn btn-primary" data-flow-submit="create-promo">Create</button>`);
        break;
      }
      case 'edit-promo': {
        const p = D.promos.find((x) => String(x.id) === String(id));
        if (!p) return toast('Promo not found', 'danger');
        openModal('PROMOTION', 'Edit promotion',
          `<form id="flowForm">
            ${input('Code', 'code', 'text', p.code)}
            ${input('Description', 'description', 'text', p.description)}
            ${select('Discount type', 'discountType', ['percent', 'fixed'], p.discountType)}
            ${input('Discount value', 'discountValue', 'number', p.discountValue)}
            ${select('Status', 'isActive', ['1', '0'], p.status === 'Active' ? '1' : '0')}
          </form>`,
          `<button class="btn btn-primary" data-flow-submit="update-promo" data-id="${id}">Save</button>`);
        break;
      }
      case 'delete-promo': {
        if (!confirm('Deactivate this promotion?')) return;
        await API.del(`/admin/promos/${id}`);
        toast('Promotion deactivated');
        await afterMutation('promotions');
        break;
      }

      /* Tours */
      case 'add-tour': {
        openModal('TOURS', 'Create tour package',
          `<form id="flowForm">
            ${input('Package name', 'name')}
            ${textarea('Description', 'description')}
            ${input('Base price (TZS)', 'price', 'number', '75000')}
            ${input('Duration (hours)', 'duration', 'number', '4')}
            ${input('Max tourists', 'max', 'number', '6')}
          </form>`,
          `<button class="btn btn-primary" data-flow-submit="create-tour">Create</button>`);
        break;
      }
      case 'edit-tour': {
        const t = D.tours.find((x) => String(x.id) === String(id));
        if (!t) return toast('Tour not found', 'danger');
        openModal('TOURS', 'Edit tour package',
          `<form id="flowForm">
            ${input('Package name', 'name', 'text', t.name)}
            ${textarea('Description', 'description', t.description)}
            ${input('Base price (TZS)', 'price', 'number', t.price)}
            ${input('Duration (hours)', 'duration', 'number', t.duration)}
            ${input('Max tourists', 'max', 'number', t.max)}
            ${select('Status', 'status', ['Active', 'Paused'], t.status)}
          </form>`,
          `<button class="btn btn-primary" data-flow-submit="update-tour" data-id="${id}">Save</button>`);
        break;
      }
      case 'delete-tour': {
        if (!confirm('Deactivate this tour package?')) return;
        await API.del(`/admin/tour-packages/${id}`);
        toast('Tour package deactivated');
        await afterMutation('tours');
        break;
      }

      /* Finance */
      case 'complete-payment': {
        if (!confirm('Mark this payment as successful and credit the wallet?')) return;
        await API.post(`/admin/payments/${id}/complete`, {});
        toast('Payment completed');
        await afterMutation('finance');
        break;
      }
      case 'settle-driver': {
        if (!confirm('Record that this driver has paid the commission they owe (cash / bank, outside the app)?\n\nThis clears their outstanding commission and unblocks them. Mobile-money payments are confirmed automatically — do not use this for those.')) return;
        const reference = prompt('Payment reference / receipt number (optional):') || '';
        await API.post(`/admin/drivers/${id}/settle`, { reference });
        toast('Commission payment recorded');
        await afterMutation('finance');
        break;
      }
      case 'payout-status': {
        await API.patch(`/admin/payouts/${id}/status`, { status });
        toast('Payout status updated');
        await afterMutation('withdrawals');
        break;
      }

      /* Notifications */
      case 'send-notification': {
        openModal('NOTIFICATION', 'Send notification',
          `<form id="flowForm" class="professional-form notification-form"><div class="form-intro"><span class="form-icon"><i class="bi bi-bell"></i></span><div><h6>Compose a notification</h6><p>Choose a registered driver or rider, then write a clear message.</p></div></div><div class="mb-3"><label class="form-label" for="notificationUser">Recipient</label><select id="notificationUser" class="form-select" name="userId" required><option value="">Select a user…</option>${userOptions()}</select><div class="form-text">${(D.riders || []).length + (D.drivers || []).length} available user records loaded.</div></div>${input('Notification title', 'title')}<div class="mb-3"><label class="form-label">Message</label><textarea class="form-control" name="body" rows="4" maxlength="1000" placeholder="Write a helpful, concise message…" required></textarea><div class="form-text">Keep the message clear and actionable.</div></div>${select('Category', 'type', ['admin', 'system', 'ride', 'payment', 'safety'], 'admin')}</form>`,
          `<button class="btn btn-primary" data-flow-submit="send-notification"><i class="bi bi-send me-1"></i>Send notification</button>`);
        break;
      }
    }
  } catch (err) {
    toast(err.message, 'danger');
  }
});

/* ---------- Form submits ---------- */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-flow-submit]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const form = $('#flowForm');
  if (!form || !form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const action = btn.dataset.flowSubmit;
  const id = btn.dataset.id;
  btn.disabled = true;
  btn.classList.add('is-loading');
  const originalButtonHtml = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Processing…';

  try {
    switch (action) {
      case 'create-driver':
        await API.post('/admin/drivers', {
          fullName: data.fullName,
          phone: data.phone,
          email: data.email || null,
          nationalId: data.nationalId || null,
          homeAddress: data.homeAddress || null,
          vehicleType: data.vehicleType,
          plateNumber: data.plateNumber,
          make: data.make || null,
          model: data.model || null,
          color: data.color || null,
          year: data.year ? Number(data.year) : null,
          status: data.status,
          applicationStatus: data.status
        });
        toast('Driver created');
        closeModal();
        await afterMutation('drivers');
        break;

      case 'update-driver':
        await API.patch(`/admin/drivers/${id}`, {
          fullName: data.fullName, phone: data.phone, email: data.email || null,
          nationalId: data.nationalId || null, homeAddress: data.homeAddress || null,
          vehicleType: data.vehicleType, plateNumber: data.plateNumber,
          make: data.make || null, model: data.model || null, color: data.color || null,
          year: data.year ? Number(data.year) : null,
          applicationStatus: data.applicationStatus
        });
        toast('Driver updated');
        closeModal();
        await afterMutation('drivers');
        break;

      case 'reject-driver': {
        const reason = (data.reason || '').trim();
        if (!reason) { toast('Rejection reason is required', 'danger'); return; }
        await API.patch(`/admin/drivers/${id}/status`, { status: 'rejected', reason });
        toast('Driver rejected');
        closeModal();
        await afterMutation('drivers');
        break;
      }

      case 'create-rider':
        await API.post('/admin/riders', {
          fullName: data.fullName, phone: data.phone, email: data.email || null,
          island: data.island || null, region: data.region || null, status: data.status
        });
        toast('Rider created');
        closeModal();
        await afterMutation('riders');
        break;

      case 'update-rider':
        await API.patch(`/admin/riders/${id}`, {
          fullName: data.fullName, phone: data.phone, email: data.email || null,
          island: data.island || null, region: data.region || null, status: data.status
        });
        toast('Rider updated');
        closeModal();
        await afterMutation('riders');
        break;

      case 'create-admin':
        await API.post('/admin/admins', {
          fullName: data.fullName, email: data.email, phone: data.phone || null,
          password: data.password, status: data.status
        });
        toast('Admin created');
        closeModal();
        await afterMutation('admins');
        break;

      case 'update-admin': {
        const body = { fullName: data.fullName, email: data.email, phone: data.phone || null, status: data.status };
        if (data.password) body.password = data.password;
        await API.patch(`/admin/admins/${id}`, body);
        toast('Admin updated');
        closeModal();
        await afterMutation('admins');
        break;
      }

      case 'create-promo':
        await API.post('/admin/promos', {
          code: data.code, title: data.description || data.code, description: data.description,
          discountType: data.discountType, discountValue: Number(data.discountValue),
          usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
          appliesTo: data.appliesTo,
          validFrom: data.validFrom ? data.validFrom + ' 00:00:00' : undefined,
          validUntil: data.validUntil ? data.validUntil + ' 23:59:59' : undefined
        });
        toast('Promotion created');
        closeModal();
        await afterMutation('promotions');
        break;

      case 'update-promo':
        await API.patch(`/admin/promos/${id}`, {
          code: data.code, description: data.description,
          discountType: data.discountType, discountValue: Number(data.discountValue),
          isActive: data.isActive === '1'
        });
        toast('Promotion updated');
        closeModal();
        await afterMutation('promotions');
        break;

      case 'create-tour':
        await API.post('/admin/tour-packages', {
          name: data.name, description: data.description,
          price: Number(data.price), duration: Number(data.duration), max: Number(data.max)
        });
        toast('Tour package created');
        closeModal();
        await afterMutation('tours');
        break;

      case 'update-tour':
        await API.patch(`/admin/tour-packages/${id}`, {
          name: data.name, description: data.description,
          price: Number(data.price), duration: Number(data.duration), max: Number(data.max),
          status: data.status
        });
        toast('Tour package updated');
        closeModal();
        await afterMutation('tours');
        break;

      case 'send-notification':
        await API.post('/admin/notifications', {
          userId: Number(data.userId), title: data.title.trim(), body: data.body.trim(), type: data.type || 'admin'
        });
        toast('Notification sent');
        closeModal();
        await afterMutation('notifications');
        break;
    }
  } catch (err) {
    toast(err.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.innerHTML = originalButtonHtml;
  }
});
})();
