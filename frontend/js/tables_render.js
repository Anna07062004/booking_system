function tableSVG(capacity, state) {

    let fill, stroke;
    if (state === 'off') { 
        fill = '#ef4444'; stroke = '#b91c1c'; 
    } else if (state === 'busy') {
        fill = '#ef4444'; stroke = '#fca5a5'; 
    } else if (state === 'selected') {
        fill = '#8b5cf6'; stroke = '#c4b5fd'; 
    } else { 
        fill = '#10b981'; stroke = '#34d399'; 
    }

    const size = 64;
    const common = `opacity="0.35" stroke="${stroke}" stroke-width="2.5"`;
    const strike = state === 'off'
        ? `<line x1="14" y1="50" x2="50" y2="14" stroke="${stroke}" stroke-width="2.5"/>`
        : '';

    if (capacity <= 2) {
        return `
        <svg width="${size}" height="${size}" viewBox="0 0 64 64">
            <rect x="6" y="26" width="8" height="12" rx="2" fill="${stroke}" opacity="0.8"/>
            <rect x="50" y="26" width="8" height="12" rx="2" fill="${stroke}" opacity="0.8"/>
            <circle cx="32" cy="32" r="14" fill="${fill}" ${common}/>
            <text x="32" y="37" text-anchor="middle" fill="${stroke}"
                font-size="12" font-weight="700" font-family="Inter, sans-serif">2</text>
            ${strike}
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
            ${strike}
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
        ${strike}
        </svg>`;
}

function resolveTableState(table, { selectedId, busyIds } = {}) {
    if (!table.is_active) return 'off';
    if (selectedId && selectedId === table.id) return 'selected';
    if (busyIds && busyIds.has(table.id)) return 'busy';

    return 'free';
}

function tableInfoLine(table, busyIds) {
    if (!table.is_active)               return 'отключён';
    if (busyIds && busyIds.has(table.id)) return 'занят';

    return ' ' + table.capacity;
}

function tableTooltip(table, { busyIds, currentDate } = {}) {
    if (!table.is_active) return `${table.name} · НЕДОСТУПЕН (отключён администратором)`;
    if (busyIds && busyIds.has(table.id)) {
        return `${table.name} · ЗАНЯТ на ${currentDate || 'выбранную дату'}`;
    }

    return `${table.name} · ${table.capacity} мест ${table.location ? '· ' + table.location : ''}`;
}

function renderHallMapInto(container, tables, opts) {
    if (!container) return;
    if (!tables.length) {
        container.innerHTML = '<p style="color:#94a3b8;">Столиков пока нет</p>';
        return;
    }
    container.innerHTML = tables.map(t => {
        const state = resolveTableState(t, opts);
        const isSel = state === 'selected';
        const isBusy = state === 'busy';
        const isOff = state === 'off';
        return `
        <div class="hall-table ${isSel ? 'selected' : ''} ${isOff ? 'off' : (isBusy ? 'busy' : '')}"
            data-id="${t.id}"
            data-busy="${isBusy}"
            data-off="${isOff}"
            data-tooltip="${tableTooltip(t, opts)}">
            ${tableSVG(t.capacity, state)}
            <div class="hall-table-name">${t.name}</div>
            <div class="hall-table-info">${tableInfoLine(t, opts.busyIds)}</div>
        </div>`;
    }).join('');
}

function renderTableCardHTML(table, busyIds) {
    const isBusy = busyIds && busyIds.has(table.id);
    const isOff = !table.is_active;
    const cls = isOff ? 'disabled' : (isBusy ? 'busy' : '');

    let subtitle;
    if (isOff)        subtitle = '<span style="color:#f87171;font-weight:600;">Отключён администратором</span>';
    else if (isBusy)  subtitle = '<span style="color:#f87171;font-weight:600;">Занят на выбранную дату</span>';
    else              subtitle = table.description || '';

    return `
        <div class="table-card ${cls}"
            data-id="${table.id}"
            data-busy="${isBusy}"
            data-off="${isOff}">
        <h3>${table.name}</h3>
        <div class="cap">${table.capacity} мест · ${table.location || '—'}</div>
        <div class="cap" style="margin-top:6px;">${subtitle}</div>
        </div>`;
}

function renderAdminHallMapInto(container, tables) {
    if (!container) return;
    container.innerHTML = tables.map(t => {
        const state = t.is_active ? 'free' : 'off';
        return `
        <div class="hall-table ${t.is_active ? '' : 'off'}"
            data-tooltip="${t.name} · ${t.capacity} мест ${t.location ? '· ' + t.location : ''}">
            ${tableSVG(t.capacity, state)}
            <div class="hall-table-name">${t.name}</div>
            <div class="hall-table-info">${t.is_active ? 'активен' : 'отключён'}</div>
        </div>`;
    }).join('');
}

function shakeElement(el) {
    if (!el || !el.animate) return;
    el.animate(
        [{ transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(0)' }],
        { duration: 280, easing: 'ease-in-out' }
    );
}