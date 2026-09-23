const me = requireAuth(true);
if (me) document.getElementById('userLabel').textContent = `${me.full_name || me.username} (админ)`;

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');

    const t = tab.dataset.tab;
    if (t === 'bookings') loadBookings();
    if (t === 'tables') loadTables();
    if (t === 'users') loadUsers();
    if (t === 'calendar') loadCalendar();
  });
});

async function loadBookings() {
  const box = document.getElementById('bookingsBox');
  try {
    const list = await api('/api/bookings/');
    if (!list.length) {
      box.innerHTML = '<p style="color:#94a3b8;">Броней пока нет</p>';
      return;
    }
    box.innerHTML = `
      <table>
        <thead><tr>
          <th>#</th><th>Клиент</th><th>Столик</th>
          <th>Начало</th><th>Окончание</th><th>Гостей</th>
          <th>Статус</th><th>Действия</th>
        </tr></thead>
        <tbody>
          ${list.map(b => `
            <tr>
              <td>${b.id}</td>
              <td>${b.user ? b.user.username : '—'}</td>
              <td>${b.table ? b.table.name : '—'}</td>
              <td>${fmt(b.start_time)}</td>
              <td>${fmt(b.end_time)}</td>
              <td>${b.guests_count}</td>
              <td><span class="badge badge-${b.status}">${b.status}</span></td>
              <td>
                ${b.status === 'pending' ? `
                  <button class="btn btn-success btn-sm" onclick="setStatus(${b.id},'confirmed')">Подтвердить</button>
                  <button class="btn btn-danger btn-sm" onclick="setStatus(${b.id},'rejected')">Отклонить</button>
                ` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    box.innerHTML = `<div class="alert alert-error">Ошибка загрузки броней: ${e.message}</div>`;
  }
}

async function setStatus(id, status) {
  try {
    await api(`/api/bookings/${id}/status`, { method: 'POST', body: { status } });
    showToast('Статус обновлён: ' + status, 'success');
    await loadBookings();
  } catch (e) {
    showToast('Не удалось изменить статус: ' + e.message, 'error');
  }
}

async function loadTables() {
  const box = document.getElementById('tablesBox');
  try {
    const list = await api('/api/tables/');
    box.innerHTML = `
      <table>
        <thead><tr>
          <th>ID</th><th>Название</th><th>Мест</th>
          <th>Локация</th><th>Описание</th><th>Активен</th><th></th>
        </tr></thead>
        <tbody>
          ${list.map(t => `
            <tr>
              <td>${t.id}</td>
              <td><b>${t.name}</b></td>
              <td>${t.capacity}</td>
              <td>${t.location || ''}</td>
              <td>${t.description || ''}</td>
              <td>${t.is_active ? 'да' : 'нет'}</td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="toggleTable(${t.id}, ${!t.is_active})">
                  ${t.is_active ? 'Отключить' : 'Включить'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteTable(${t.id})">Удалить</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    const map = document.getElementById('adminHallMap');
    if (map) renderAdminHallMapInto(map, list);
  } catch (e) {
    box.innerHTML = `<div class="alert alert-error">Ошибка загрузки столов: ${e.message}</div>`;
    showToast('Ошибка загрузки столов: ' + e.message, 'error');
  }
}

const tableForm = document.getElementById('tableForm');
if (tableForm) {
  tableForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/api/tables/', {
        method: 'POST',
        body: {
          name: fd.get('name'),
          capacity: parseInt(fd.get('capacity')),
          location: fd.get('location') || null,
          description: fd.get('description') || null,
          is_active: true,
        },
      });
      e.target.reset();
      showToast('Столик добавлен', 'success');
      await loadTables();
    } catch (ex) {
      showToast('Ошибка добавления: ' + ex.message, 'error');
    }
  });
}

async function toggleTable(id, active) {
  try {
    await api(`/api/tables/${id}`, { method: 'PUT', body: { is_active: active } });
    showToast(active ? 'Столик включён' : 'Столик отключён', 'success');
    await loadTables();
  } catch (e) {
    showToast('Не удалось изменить столик: ' + e.message, 'error');
  }
}

async function deleteTable(id) {
  if (!confirm('Удалить столик? Это действие нельзя отменить.')) return;
  try {
    await api(`/api/tables/${id}`, { method: 'DELETE' });
    showToast('Столик удалён', 'success');
    await loadTables();
  } catch (e) {
    showToast('Не удалось удалить: ' + e.message, 'error');
  }
}

async function loadUsers() {
  const box = document.getElementById('usersBox');
  try {
    const list = await api('/api/users/');
    box.innerHTML = `
      <table>
        <thead><tr>
          <th>ID</th><th>Логин</th><th>Email</th>
          <th>ФИО</th><th>Роль</th><th>Активен</th><th></th>
        </tr></thead>
        <tbody>
          ${list.map(u => `
            <tr>
              <td>${u.id}</td>
              <td><b>${u.username}</b></td>
              <td>${u.email}</td>
              <td>${u.full_name || ''}</td>
              <td>${u.role}</td>
              <td>${u.is_active ? 'да' : 'нет'}</td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="toggleUser(${u.id})">
                  ${u.is_active ? 'Блок' : 'Разблок'}
                </button>
                <button class="btn btn-secondary btn-sm"
                        onclick="setRole(${u.id}, '${u.role === 'admin' ? 'client' : 'admin'}')">
                  Сделать ${u.role === 'admin' ? 'клиентом' : 'админом'}
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    box.innerHTML = `<div class="alert alert-error">Ошибка загрузки пользователей: ${e.message}</div>`;
  }
}

async function toggleUser(id) {
  try {
    await api(`/api/users/${id}/toggle`, { method: 'POST' });
    showToast('Статус пользователя изменён', 'success');
    await loadUsers();
  } catch (e) {
    showToast('Ошибка: ' + e.message, 'error');
  }
}

async function setRole(id, role) {
  try {
    await api(`/api/users/${id}/role?role=${role}`, { method: 'POST' });
    showToast('Роль изменена на ' + role, 'success');
    await loadUsers();
  } catch (e) {
    showToast('Ошибка: ' + e.message, 'error');
  }
}

async function loadCalendar() {
  const box = document.getElementById('calendarBox');
  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 14);

    const params = new URLSearchParams({
      date_from: from.toISOString().slice(0, 19),
      date_to: to.toISOString().slice(0, 19),
    });
    const list = await api('/api/bookings/schedule?' + params);

    const byDay = {};
    list.forEach(b => {
      const d = b.start_time.slice(0, 10);
      (byDay[d] ||= []).push(b);
    });

    const cells = [];

    for (let i = 0; i < 14; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const items = (byDay[key] || []).map(b => {
        const t = new Date(b.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const name = b.table ? b.table.name : '';
        return `<div class="slot" title="${name} ${t}">${t} ${name}</div>`;
      }).join('');
      cells.push(`<div class="cal-cell"><div class="day">${key}</div>${items}</div>`);
    }
    box.innerHTML = cells.join('');
  } catch (e) {
    box.innerHTML = `<div class="alert alert-error">Ошибка календаря: ${e.message}</div>`;
  }
}

loadBookings();