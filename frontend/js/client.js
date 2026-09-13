const me = requireAuth();
if (me) document.getElementById('userLabel').textContent = `${me.full_name || me.username}`;

let selectedTable = null;
let tablesCache = [];
let busyTableIds = new Set();
let currentMapDate = null;

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');

    if (tab.dataset.tab === 'my') loadMyBookings();
  });
});

function tableSVG(capacity, state) {
  let fill, stroke;
  if (state === 'busy') {
    fill = '#ef4444';
    stroke = '#fca5a5';
  } else if (state === 'selected') {
    fill = '#8b5cf6';
    stroke = '#c4b5fd';
  } else {
    fill = '#10b981';
    stroke = '#34d399';
  }

  const size = 64;
  const common = `opacity="0.35" stroke="${stroke}" stroke-width="2.5"`;

  if (capacity <= 2) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 64 64">
        <rect x="6" y="26" width="8" height="12" rx="2" fill="${stroke}" opacity="0.8"/>
        <rect x="50" y="26" width="8" height="12" rx="2" fill="${stroke}" opacity="0.8"/>
        <circle cx="32" cy="32" r="14" fill="${fill}" ${common}/>
        <text x="32" y="37" text-anchor="middle" fill="${stroke}"
              font-size="12" font-weight="700" font-family="Inter, sans-serif">2</text>
      </svg>`;
  }
  if (capacity <= 4) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 64 64">
        <rect x="6" y="28" width="6" height="8" rx="2" fill="${stroke}" opacity="0.8"/>
        <rect x="52" y="28" width="6" height="8" rx="2" fill="${stroke}" opacity="0.8"/>
        <rect x="28" y="6" width="8" height="6" rx="2" fill="${stroke}" opacity="0.8"/>
        <rect x="28" y="52" width="8" height="6" rx="2" fill="${stroke}" opacity="0.8"/>
        <rect x="16" y="16" width="32" height="32" rx="6" fill="${fill}" ${common}/>
        <text x="32" y="38" text-anchor="middle" fill="${stroke}"
              font-size="14" font-weight="700" font-family="Inter, sans-serif">4</text>
      </svg>`;
  }
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64">
      <rect x="4" y="28" width="7" height="8" rx="2" fill="${stroke}" opacity="0.8"/>
      <rect x="53" y="28" width="7" height="8" rx="2" fill="${stroke}" opacity="0.8"/>
      <rect x="28" y="4" width="8" height="7" rx="2" fill="${stroke}" opacity="0.8"/>
      <rect x="28" y="53" width="8" height="7" rx="2" fill="${stroke}" opacity="0.8"/>
      <circle cx="32" cy="32" r="16" fill="${fill}" ${common}/>
      <text x="32" y="38" text-anchor="middle" fill="${stroke}"
            font-size="13" font-weight="700" font-family="Inter, sans-serif">${capacity}</text>
    </svg>`;
}

async function loadBusyTables(date) {
  if (!date) return;
  try {
    const data = await api(`/api/bookings/busy_by_date?date=${date}`, { auth: false });
    busyTableIds = new Set(data.busy_table_ids);
    currentMapDate = date;
  } catch (e) {
    console.warn('Не удалось загрузить занятость:', e);
    busyTableIds = new Set();
  }
}

function renderHallMap() {
  const map = document.getElementById('hallMap');
  if (!map) return;

  if (!tablesCache.length) {
    map.innerHTML = '<p style="color:#94a3b8;">Столиков пока нет</p>';
    return;
  }

  map.innerHTML = tablesCache.map(t => {
    const isSel = selectedTable && selectedTable.id === t.id;
    const isOff = !t.is_active;
    const isBusy = busyTableIds.has(t.id);
    const state = isOff ? 'busy' : (isSel ? 'selected' : (isBusy ? 'busy' : 'free'));

    let tooltip;
    if (isOff) {
      tooltip = `${t.name} · НЕДОСТУПЕН`;
    } else if (isBusy) {
      tooltip = `${t.name} · ЗАНЯТ на ${currentMapDate || 'эту дату'}`;
    } else {
      tooltip = `${t.name} · ${t.capacity} мест ${t.location ? '· ' + t.location : ''}`;
    }

    let infoLine;
    if (isOff)      infoLine = 'недоступен';
    else if (isBusy) infoLine = 'занят';
    else             infoLine = 'Пользователь' + t.capacity;

    return `
      <div class="hall-table ${isSel ? 'selected' : ''} ${isOff || isBusy ? 'busy' : ''}"
           data-id="${t.id}"
           data-busy="${isBusy}"
           data-off="${isOff}"
           data-tooltip="${tooltip}">
        ${tableSVG(t.capacity, state)}
        <div class="hall-table-name">${t.name}</div>
        <div class="hall-table-info">${infoLine}</div>
      </div>
    `;
  }).join('');

  map.querySelectorAll('.hall-table').forEach(el => {
    el.addEventListener('click', () => handleTableClick(el, parseInt(el.dataset.id)));
  });
}

async function loadTables() {
   tablesCache = await api('/api/tables/');

  const dateForMap = document.getElementById('dateInput')?.value || new Date().toISOString().slice(0, 10);
  await loadBusyTables(dateForMap);

  renderHallMap();

  const box = document.getElementById('tables');
  box.innerHTML = tablesCache.map(t => renderTableCard(t)).join('') || '<p style="color:#94a3b8;">Столиков пока нет</p>';

  box.querySelectorAll('.table-card').forEach(el => {
    el.addEventListener('click', () => handleTableClick(el, parseInt(el.dataset.id)));
  });
}

async function selectTable(id) {
  const t = tablesCache.find(x => x.id === id);
  if (!t) return;

  // Отключённый или занятый — тихо игнорируем
  if (!t.is_active) return;
  if (busyTableIds.has(id)) return;

  selectedTable = t;

  document.querySelectorAll('.hall-table').forEach(el =>
    el.classList.toggle('selected', parseInt(el.dataset.id) === id));
  document.querySelectorAll('.table-card').forEach(el =>
    el.classList.toggle('selected', parseInt(el.dataset.id) === id));

  renderHallMap();

  document.getElementById('bookingFormCard').style.display = 'block';
  document.getElementById('selectedTableName').textContent = selectedTable.name;

  const dateInput = document.getElementById('dateInput');
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);

  await loadBusy();
  document.getElementById('bookingFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTableCard(t) {
  const isBusy = busyTableIds.has(t.id);
  const isOff = !t.is_active;
  const cls = isOff ? 'disabled' : (isBusy ? 'busy' : '');

  let subtitle;
  if (isOff) {
    subtitle = '<span style="color:#f87171;font-weight:600;">Забронирован</span>';
  } else {
    subtitle = t.description || '';
  }

  return `
    <div class="table-card ${cls}"
         data-id="${t.id}"
         data-busy="${isBusy}"
         data-off="${isOff}">
      <h3>${t.name}</h3>
      <div class="cap"> ${t.capacity} мест · ${t.location || '—'}</div>
      <div class="cap" style="margin-top:6px;">${subtitle}</div>
    </div>
  `;
}
function handleTableClick(el, id) {
  const isBusy = el.dataset.busy === 'true';
  const isOff = el.dataset.off === 'true';

  if (isOff || isBusy) return; 

  selectTable(id);
}

async function loadTablesSilent() {
  const box = document.getElementById('tables');
  if (!box) return;
  box.innerHTML = tablesCache.map(t => renderTableCard(t)).join('');
  box.querySelectorAll('.table-card').forEach(el => {
    el.addEventListener('click', () => handleTableClick(el, parseInt(el.dataset.id)));
  });
}

async function selectTable(id) {
  if (busyTableIds.has(id)) {
    showToast('Этот столик занят, выберите другой', 'error');
    return;
  }

  selectedTable = tablesCache.find(t => t.id === id);

  document.querySelectorAll('.hall-table').forEach(el =>
    el.classList.toggle('selected', parseInt(el.dataset.id) === id));
  document.querySelectorAll('.table-card').forEach(el =>
    el.classList.toggle('selected', parseInt(el.dataset.id) === id));

  renderHallMap();

  document.getElementById('bookingFormCard').style.display = 'block';
  document.getElementById('selectedTableName').textContent = selectedTable.name;

  const dateInput = document.getElementById('dateInput');
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);

  await loadBusy();
  document.getElementById('bookingFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadBusy() {
  if (!selectedTable) return;
  const date = document.getElementById('dateInput').value;
  if (!date) return;
  const slots = await api(`/api/bookings/busy/${selectedTable.id}?date=${date}`, { auth: false });
  const el = document.getElementById('busySlots');
  if (!slots.length) {
    el.innerHTML = `<div class="alert alert-success">На ${date} столик полностью свободен</div>`;
    return;
  }
  el.innerHTML = `<div class="alert alert-error"><b>Занято на ${date}:</b><br>` +
    slots.map(s => {
      const t1 = new Date(s.start_time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
      const t2 = new Date(s.end_time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
      return `${t1} — ${t2} <span class="badge badge-${s.status}">${s.status}</span>`;
    }).join('<br>') + `</div>`;
}

document.getElementById('dateInput').addEventListener('change', async (e) => {
  const newDate = e.target.value;

  await loadBusyTables(newDate);

  if (selectedTable && busyTableIds.has(selectedTable.id)) {
    selectedTable = null;
    document.getElementById('bookingFormCard').style.display = 'none';
    document.querySelectorAll('.hall-table, .table-card').forEach(el =>
      el.classList.remove('selected'));
    showToast('Выбранный стол занят на эту дату. Выберите другой.', 'warning');
  }

  renderHallMap();
  await loadTablesSilent();

  if (selectedTable) await loadBusy();
});

document.getElementById('bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('formErr');
  const ok = document.getElementById('formOk');
  err.classList.add('hidden');
  ok.classList.add('hidden');

  const date = document.getElementById('dateInput').value;
  const start = document.getElementById('startInput').value;
  const end = document.getElementById('endInput').value;

  try {
    await api('/api/bookings/', {
      method: 'POST',
      body: {
        table_id: selectedTable.id,
        start_time: `${date}T${start}:00`,
        end_time: `${date}T${end}:00`,
        guests_count: parseInt(document.getElementById('guestsInput').value),
        comment: document.getElementById('commentInput').value,
      },
    });
    ok.textContent = 'Бронь создана! Ожидает подтверждения администратора.';
    ok.classList.remove('hidden');
    e.target.reset();
    await loadBusy();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
});

async function loadMyBookings() {
  const list = await api('/api/bookings/my');
  const box = document.getElementById('myBookings');
  if (!list.length) {
    box.innerHTML = '<p style="color:#94a3b8;">У вас пока нет броней</p>';
    return;
  }

  box.innerHTML = `
    <table>
      <thead><tr><th>Столик</th><th>Начало</th><th>Окончание</th><th>Гостей</th><th>Статус</th><th></th></tr></thead>
      <tbody>
        ${list.map(b => `
          <tr>
            <td><b>${b.table ? b.table.name : '#' + b.table_id}</b></td>
            <td>${fmt(b.start_time)}</td>
            <td>${fmt(b.end_time)}</td>
            <td>${b.guests_count}</td>
            <td><span class="badge badge-${b.status}">${b.status}</span></td>
            <td>${['pending','confirmed'].includes(b.status)
              ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id})">Отменить</button>`
              : ''}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;
}

async function cancelBooking(id) {
  if (!confirm('Отменить бронь?')) return;
  try {
    await api(`/api/bookings/${id}/cancel`, { method: 'POST' });
    await loadMyBookings();
  } catch (e) {
    alert(e.message);
  }
}

loadTables();