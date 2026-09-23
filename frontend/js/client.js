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

async function loadBusyTables(date) {
  if (!date) return;
  try {
    const data = await api(`/api/bookings/busy-all?date=${date}`, { auth: false });
    busyTableIds = new Set(data.busy_table_ids || []);
    currentMapDate = date;
  } catch (e) {
    console.warn('Не удалось загрузить занятость:', e);
    busyTableIds = new Set();
  }
}

function renderHallMap() {
  const map = document.getElementById('hallMap');
  renderHallMapInto(map, tablesCache, {
    selectedId: selectedTable ? selectedTable.id : null,
    busyIds: busyTableIds,
    currentDate: currentMapDate,
  });

  map.querySelectorAll('.hall-table').forEach(el => {
    el.addEventListener('click', () => handleTableClick(el, parseInt(el.dataset.id)));
  });
}

function renderTableList() {
  const box = document.getElementById('tables');
  if (!box) return;
  box.innerHTML = tablesCache.length
    ? tablesCache.map(t => renderTableCardHTML(t, busyTableIds)).join('')
    : '<p style="color:#94a3b8;">Столиков пока нет</p>';

  box.querySelectorAll('.table-card').forEach(el => {
    el.addEventListener('click', () => handleTableClick(el, parseInt(el.dataset.id)));
  });
}

async function loadTables() {
  try {
    tablesCache = await api('/api/tables/');

    const dateForMap = document.getElementById('dateInput')?.value || new Date().toISOString().slice(0, 10);
    await loadBusyTables(dateForMap);

    renderHallMap();
    renderTableList();
  } catch (e) {
    const box = document.getElementById('tables');
    if (box) box.innerHTML = `<div class="alert alert-error">Не удалось загрузить столики: ${e.message}</div>`;
    showToast('Не удалось загрузить столики: ' + e.message, 'error');
  }
}

function handleTableClick(el, id) {
  const isBusy = el.dataset.busy === 'true';
  const isOff = el.dataset.off === 'true';

  if (isOff) {
    shakeElement(el);
    showToast('Этот столик отключён администратором', 'warning');
    return;
  }
  if (isBusy) {
    shakeElement(el);
    showToast('Этот столик занят, выберите другой', 'error');
    return;
  }
  selectTable(id);
}

async function selectTable(id) {
  const t = tablesCache.find(x => x.id === id);
  if (!t) return;
  if (!t.is_active) return;
  if (busyTableIds.has(id)) return;

  selectedTable = t;

  document.querySelectorAll('.hall-table, .table-card').forEach(el =>
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

  const el = document.getElementById('busySlots');
  try {
    const slots = await api(`/api/bookings/busy/${selectedTable.id}?date=${date}`, { auth: false });
    if (!slots.length) {
      el.innerHTML = `<div class="alert alert-success">На ${date} столик полностью свободен</div>`;
      return;
    }
    el.innerHTML = `<div class="alert alert-error"><b>Занято на ${date}:</b><br>` +
      slots.map(s => {
        const t1 = new Date(s.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const t2 = new Date(s.end_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return `${t1} — ${t2} <span class="badge badge-${s.status}">${s.status}</span>`;
      }).join('<br>') + `</div>`;
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">Ошибка загрузки слотов: ${e.message}</div>`;
  }
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
  renderTableList();

  if (selectedTable) await loadBusy();
});

document.getElementById('bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('formErr');
  const ok = document.getElementById('formOk');
  err.classList.add('hidden');
  ok.classList.add('hidden');

  if (!selectedTable) {
    err.textContent = 'Сначала выберите столик';
    err.classList.remove('hidden');
    return;
  }

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
        comment: document.getElementById('commentInput').value || null,
      },
    });
    ok.textContent = 'Бронь создана! Ожидает подтверждения администратора.';
    ok.classList.remove('hidden');
    e.target.reset();
    await loadBusyTables(date);
    renderHallMap();
    renderTableList();
    await loadBusy();
  } catch (ex) {
    err.textContent = ' ' + ex.message;
    err.classList.remove('hidden');
  }
});

async function loadMyBookings() {
  const box = document.getElementById('myBookings');
  try {
    const list = await api('/api/bookings/my');
    if (!list.length) {
      box.innerHTML = '<p style="color:#94a3b8;">У вас пока нет броней</p>';
      return;
    }
    box.innerHTML = `
      <table>
        <thead><tr>
          <th>Столик</th><th>Начало</th><th>Окончание</th>
          <th>Гостей</th><th>Статус</th><th></th>
        </tr></thead>
        <tbody>
          ${list.map(b => `
            <tr>
              <td><b>${b.table ? b.table.name : '#' + b.table_id}</b></td>
              <td>${fmt(b.start_time)}</td>
              <td>${fmt(b.end_time)}</td>
              <td>${b.guests_count}</td>
              <td><span class="badge badge-${b.status}">${b.status}</span></td>
              <td>${['pending', 'confirmed'].includes(b.status)
                ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id})">Отменить</button>`
                : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    box.innerHTML = `<div class="alert alert-error">Не удалось загрузить брони: ${e.message}</div>`;
  }
}

async function cancelBooking(id) {
  if (!confirm('Отменить бронь?')) return;
  try {
    await api(`/api/bookings/${id}/cancel`, { method: 'POST' });
    showToast('Бронь отменена', 'success');
    await loadMyBookings();
  } catch (e) {
    showToast('Ошибка отмены: ' + e.message, 'error');
  }
}

loadTables();