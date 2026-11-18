'use strict';
/* NSs Adventures — женский цикл: календарь, прогноз, фазы, симптомы. Данные только на телефоне. */

const SYMPTOMS = [['cramps', 'Спазмы', '⚡'], ['headache', 'Голова', '🤕'], ['bloating', 'Вздутие', '🎈'], ['mood', 'Настроение', '🎭'],
  ['cravings', 'Тянет на сладкое', '🍫'], ['fatigue', 'Усталость', '😴'], ['acne', 'Высыпания', '🔴'], ['breast', 'Грудь', '💗']];
const FLOWS = [['light', 'Скудные'], ['medium', 'Средние'], ['heavy', 'Обильные']];
const PHASES = {
  menstrual: { n: 'Менструация', e: '🩸', c: '#FF6B8A', train: 'stretch',
    tip: 'Энергии меньше, и это нормально. Подойдут прогулка, растяжка, йога. Добавь железо: гречку, говядину, шпинат. Тёплое питьё помогает при спазмах.' },
  follicular: { n: 'Фолликулярная фаза', e: '🌱', c: '#3DDC97', train: 'hiit',
    tip: 'Энергия растёт, аппетит ниже обычного. Лучшее время для дефицита калорий и интенсивных тренировок.' },
  ovulation: { n: 'Овуляция', e: '✨', c: '#FFB547', train: 'legs',
    tip: 'Пик сил: силовые и HIIT даются легче всего. Следи за техникой, связки в эти дни мягче.' },
  luteal: { n: 'Лютеиновая фаза', e: '🌙', c: '#A78BFA', train: 'abs',
    tip: 'Обмен веществ выше на 100–300 ккал, может тянуть на сладкое. Больше белка и клетчатки, на перекус фрукты или творог. Вес может подрасти на 0,5–1,5 кг из-за воды, это не жир.' }
};
const cycOn = p => !!p && p.sex === 'f' && p.age >= 11 && p.modes?.cycle !== false;
function cyc(p) { p.cycle ??= { periods: [], len: 28, plen: 5 }; return p.cycle; }
const fmtD = (k, o = { day: 'numeric', month: 'long' }) => new Date(k + 'T12:00').toLocaleDateString('ru-RU', o);
const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;

function cycleStats(p) {
  const c = cyc(p), ps = [...c.periods].sort((a, b) => a.start < b.start ? -1 : 1);
  const lens = [];
  for (let i = 1; i < ps.length; i++) { const d = daysBetween(ps[i - 1].start, ps[i].start); if (d >= 18 && d <= 45) lens.push(d); }
  const recent = lens.slice(-6);
  const plens = ps.filter(x => x.end).map(x => daysBetween(x.start, x.end) + 1).filter(x => x >= 2 && x <= 10).slice(-6);
  return { len: avg(recent) || c.len || 28, plen: avg(plens) || c.plen || 5, last: ps[ps.length - 1], ps, lens,
    irregular: recent.length >= 3 && Math.max(...recent) - Math.min(...recent) > 7 };
}
function cycleInfo(p, k = dkey()) {
  const st = cycleStats(p); if (!st.last) return null;
  const day = daysBetween(st.last.start, k) + 1, ov = st.len - 14;
  const periodEnd = st.last.end || addDays(st.last.start, st.plen - 1);
  const inPeriod = k <= periodEnd && day >= 1;
  let phase = inPeriod ? 'menstrual' : day < ov - 1 ? 'follicular' : day <= ov + 1 ? 'ovulation' : 'luteal';
  const late = day > st.len ? day - st.len : 0;
  if (late) phase = 'luteal';
  const next = addDays(st.last.start, st.len);
  return { ...st, day, phase, late, next, inPeriod, openPeriod: !st.last.end && day <= 10, untilNext: daysBetween(k, next), fertile: day >= ov - 5 && day <= ov + 1 };
}
/* отметки для календаря */
function cycleMarks(p) {
  const st = cycleStats(p), m = { logged: new Set(), pred: new Set(), fertile: new Set(), ov: new Set() };
  if (!st.last) return m;
  const today = dkey();
  st.ps.forEach(x => {
    const end = x.end || (x === st.last ? (addDays(x.start, st.plen - 1) < today ? addDays(x.start, st.plen - 1) : today) : addDays(x.start, st.plen - 1));
    for (let k = x.start; k <= end; k = addDays(k, 1)) m.logged.add(k);
  });
  for (let i = 0; i <= 3; i++) {
    const s = addDays(st.last.start, st.len * i);
    if (i > 0 && s > today) for (let j = 0; j < st.plen; j++) m.pred.add(addDays(s, j));
    const ov = addDays(s, st.len - 15);
    for (let j = -5; j <= 1; j++) m.fertile.add(addDays(ov, j));
    m.ov.add(ov);
  }
  return m;
}
function cycleRing(info) {
  const size = 92, sw = 9, r = (size - sw) / 2, C = 2 * Math.PI * r, v = Math.min(1, info.day / info.len), col = PHASES[info.phase].c;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="${sw}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - v)}"/></svg>`;
}

/* ---------- карточка на «Сегодня» ---------- */
function cycleToday(p) {
  if (!cycOn(p)) return '';
  const info = cycleInfo(p);
  if (!info) return `<div class="card cyc"><div class="row"><div style="font-size:30px">🌸</div><div class="grow"><h3>Женский цикл</h3>
    <div class="muted">Отметь начало последних месячных: подскажу, когда тренироваться интенсивнее и почему вес иногда «стоит».</div></div></div>
    <button class="btn primary block" style="margin-top:10px" data-action="cyc-pick">Отметить начало месячных</button></div>`;
  const ph = PHASES[info.phase];
  const status = info.openPeriod ? `${info.day}-й день месячных` : info.late ? `Задержка ${info.late} дн.` : info.untilNext === 0 ? 'Месячные ожидаются сегодня'
    : `Месячные через ${info.untilNext} дн. (${fmtD(info.next)})`;
  return `<div class="card cyc"><div class="ringwrap" style="gap:14px"><div class="ring" style="width:92px;height:92px">${cycleRing(info)}
      <div class="c"><div><div class="big" style="font-size:24px">${info.day}</div><div class="lbl">день</div></div></div></div>
    <div class="grow"><h3 style="margin:0">${ph.e} ${ph.n}</h3><div class="sub" style="margin:2px 0 4px">${status}</div>${info.fertile && !info.inPeriod ? '<div class="pill" style="background:rgba(61,220,151,.15);color:var(--green)">Фертильные дни</div>' : ''}</div></div>
    <div class="muted" style="margin-top:10px;line-height:1.45">${ph.tip}</div>
    ${info.late >= 7 ? `<div class="muted" style="margin-top:6px;color:var(--amber)">Задержка больше недели. Если она повторяется, стоит показаться гинекологу.</div>` : ''}
    <div class="grid2" style="margin-top:12px">${info.openPeriod ? `<button class="btn" data-action="cyc-end">Закончились</button>` : `<button class="btn primary" data-action="cyc-start">Начались сегодня</button>`}
    <button class="btn" data-action="cyc-open">Календарь</button></div></div>`;
}

/* ---------- экран цикла ---------- */
let cycMonth = null;
function calHtml(p, m) {
  const marks = cycleMarks(p), first = new Date(m + '-01T12:00'), dow = (first.getDay() + 6) % 7;
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), today = dkey();
  let h = `<div class="cal">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => `<b>${d}</b>`).join('')}`;
  for (let i = 0; i < dow; i++) h += '<span></span>';
  for (let d = 1; d <= dim; d++) {
    const k = `${m}-${String(d).padStart(2, '0')}`, dd = S.days[p.id]?.[k]?.cyc;
    const cls = marks.logged.has(k) ? 'lg' : marks.pred.has(k) ? 'pr' : marks.ov.has(k) ? 'ov' : marks.fertile.has(k) ? 'fe' : '';
    h += `<button class="${cls} ${k === today ? 'td' : ''}" data-action="cyc-day" data-k="${k}">${d}${dd?.sym?.length || dd?.flow ? '<i></i>' : ''}</button>`;
  }
  return h + '</div>';
}
const monthLabel = m => new Date(m + '-15T12:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
const shiftMonth = (m, n) => { const d = new Date(m + '-15T12:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };
function openCycle(k = dkey()) {
  const p = P(), info = cycleInfo(p), st = cycleStats(p);
  cycMonth ??= dkey().slice(0, 7);
  const dd = (S.days[p.id] ??= {})[k]?.cyc || {};
  const inPeriod = cycleMarks(p).logged.has(k);
  sheet(`<div class="row between"><h3 style="margin:0">🌸 Цикл</h3><button class="btn sm" data-action="cyc-pick">+ Отметить начало</button></div>
    <div class="grid2" style="margin:12px 0"><div class="card" style="margin:0;text-align:center"><div class="muted">Средний цикл</div><b style="font-size:22px">${st.len} дн.</b>${st.lens.length ? `<div class="muted">по ${Math.min(6, st.lens.length)} циклам</div>` : '<div class="muted">пока по умолчанию</div>'}</div>
      <div class="card" style="margin:0;text-align:center"><div class="muted">Месячные</div><b style="font-size:22px">${st.plen} дн.</b><div class="muted">${info ? (info.late ? 'задержка ' + info.late + ' дн.' : 'следующие ' + fmtD(info.next)) : '—'}</div></div></div>
    ${st.irregular ? '<div class="muted" style="margin-bottom:8px;color:var(--amber)">Длина цикла сильно меняется, поэтому прогноз приблизительный.</div>' : ''}
    <div class="row between"><button class="iconbtn" data-action="cyc-m" data-n="-1">‹</button><b style="text-transform:capitalize">${monthLabel(cycMonth)}</b><button class="iconbtn" data-action="cyc-m" data-n="1">›</button></div>
    <div style="height:8px"></div>${calHtml(p, cycMonth)}
    <div class="cal-legend"><span><i class="lg"></i>месячные</span><span><i class="pr"></i>прогноз</span><span><i class="fe"></i>фертильные</span><span><i class="ov"></i>овуляция</span></div>
    <div class="card"><div class="row between"><h3 style="margin:0">${k === dkey() ? 'Сегодня' : fmtD(k)}</h3><span class="muted">${info ? PHASES[cycleInfo(p, k)?.phase || 'follicular'].n : ''}</span></div>
      ${inPeriod ? `<div class="mtype">Выделения</div><div class="seg">${FLOWS.map(([v, n]) => `<button class="${dd.flow === v ? 'on' : ''}" data-action="cyc-flow" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div>` : ''}
      <div class="mtype">Самочувствие</div><div class="symgrid">${SYMPTOMS.map(([v, n, e]) => `<button class="${dd.sym?.includes(v) ? 'on' : ''}" data-action="cyc-sym" data-k="${k}" data-v="${v}"><span>${e}</span>${n}</button>`).join('')}</div></div>
    ${st.ps.length ? `<h2 style="margin-top:14px">История</h2><div class="card">${[...st.ps].reverse().slice(0, 8).map((x, i, arr) => {
      const nx = i ? arr[i - 1] : null, len = nx ? daysBetween(x.start, nx.start) : null;
      return `<div class="meal"><div class="thumb">🩸</div><div class="grow"><b>${fmtD(x.start)}</b><div class="muted">${x.end ? (daysBetween(x.start, x.end) + 1) + ' дн. месячных' : 'идут сейчас'}${len ? ' · цикл ' + len + ' дн.' : ''}</div></div>
        <button class="iconbtn" style="width:32px;height:32px;font-size:13px" data-action="cyc-del" data-s="${x.start}">✕</button></div>`;
    }).join('')}</div>` : ''}
    <div class="card"><h3>Настройки</h3><div class="grid2"><label class="f"><span>Цикл по умолчанию, дн.</span><input id="cy-len" type="number" inputmode="numeric" value="${cyc(p).len}"></label>
      <label class="f"><span>Месячные, дн.</span><input id="cy-plen" type="number" inputmode="numeric" value="${cyc(p).plen}"></label></div>
      <div class="muted">Используются, пока не наберётся своя история. Потом приложение считает по твоим данным.</div>
      <button class="btn block" style="margin-top:8px" data-action="cyc-save">Сохранить</button>
      ${info ? `<button class="btn block" style="margin-top:8px" data-action="cyc-ics">📅 Прогноз в Календарь iPhone</button>` : ''}</div>
    <div class="muted" style="text-align:center;margin:6px 0 4px">Данные о цикле хранятся только на этом телефоне. Прогноз ориентировочный и не годится как метод контрацепции.</div>`);
  cycDay = k;
}
let cycDay = null;
function pickStart() {
  sheet(`<h3>🩸 Начало месячных</h3><label class="f"><span>Первый день</span><input id="cy-d" type="date" value="${dkey()}" max="${dkey()}"></label>
    <div class="muted">Можно отметить и прошлые месячные: чем больше история, тем точнее прогноз.</div>
    <button class="btn primary block" style="margin-top:12px" data-action="cyc-add">Сохранить</button>`);
}
function addPeriod(k) {
  const p = P(), c = cyc(p);
  if (c.periods.some(x => Math.abs(daysBetween(x.start, k)) < 10)) { toast('Рядом уже отмечены месячные'); return false; }
  const prev = c.periods.filter(x => x.start < k).sort((a, b) => a.start < b.start ? 1 : -1)[0];
  if (prev && !prev.end) prev.end = addDays(prev.start, Math.min(cycleStats(p).plen, daysBetween(prev.start, k)) - 1);
  c.periods.push({ start: k, end: null });
  if (k < dkey()) { const after = c.periods.find(x => x.start > k); if (after || daysBetween(k, dkey()) > 9) c.periods.find(x => x.start === k).end = addDays(k, cycleStats(p).plen - 1); }
  save(); addXP(5, 'Цикл отмечен'); return true;
}
function cycleIcs(p) {
  const info = cycleInfo(p); if (!info) return null;
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NSs Adventures//RU', 'X-WR-CALNAME:NSs · цикл'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  for (let i = 1; i <= 3; i++) {
    const s = addDays(info.last.start, info.len * i); if (s <= dkey()) continue;
    L.push('BEGIN:VEVENT', `UID:nss-cycle-${s}@nss`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${s.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(s, info.plen).replace(/-/g, '')}`,
      'SUMMARY:🌸 Ожидаются месячные', 'DESCRIPTION:Прогноз NSs Adventures', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Завтра ожидаются месячные', 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT');
  }
  L.push('END:VCALENDAR'); return L.join('\r\n');
}
/* строка для ИИ-тренера и отчёта недели */
function cycleCoachLine(p) {
  if (!cycOn(p)) return '';
  const i = cycleInfo(p); if (!i) return '';
  return `Женский цикл: ${i.day}-й день, ${PHASES[i.phase].n.toLowerCase()}${i.late ? ', задержка ' + i.late + ' дн.' : ''}. Учти фазу в советах по еде и нагрузке.`;
}
function cycleModeHtml(p) {
  if (p.sex !== 'f' || p.age < 11) return '';
  const on = p.modes.cycle !== false;
  return `<div class="mode"><div class="e" style="background:linear-gradient(135deg,#FF6B8A,#A78BFA)">🌸</div><div class="grow"><b>Женский цикл</b><div class="muted">Календарь, прогноз месячных, советы по фазам</div></div>
    <button class="sw ${on ? 'on' : ''}" data-action="cyc-mode" aria-label="Женский цикл"></button></div>`;
}

/* ---------- стили ---------- */
document.head.insertAdjacentHTML('beforeend', `<style>
.cyc{background:linear-gradient(160deg,rgba(255,107,138,.12),rgba(167,139,250,.08) 60%,transparent),linear-gradient(180deg,var(--card),#131a2c)}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;text-align:center}
.cal b{font-size:11px;color:var(--tx3);font-weight:600;padding:2px 0}
.cal button{aspect-ratio:1;border-radius:12px;background:var(--card);font-size:14px;position:relative;border:1.5px solid transparent}
.cal button.lg{background:#FF6B8A;color:#2a0410;font-weight:700}
.cal button.pr{background:rgba(255,107,138,.18);border:1.5px dashed #FF6B8A}
.cal button.fe{background:rgba(61,220,151,.16)}
.cal button.ov{background:rgba(61,220,151,.45);font-weight:700}
.cal button.td{border-color:var(--amber)}
.cal button i{position:absolute;bottom:4px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--violet)}
.cal-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--tx2);margin:10px 2px}
.cal-legend i{display:inline-block;width:11px;height:11px;border-radius:4px;margin-right:5px;vertical-align:-1px}
.cal-legend i.lg{background:#FF6B8A}.cal-legend i.pr{border:1.5px dashed #FF6B8A}.cal-legend i.fe{background:rgba(61,220,151,.3)}.cal-legend i.ov{background:rgba(61,220,151,.7)}
.symgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.symgrid button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 2px;border-radius:14px;background:var(--card2);font-size:11px;color:var(--tx2);border:1.5px solid transparent}
.symgrid button span{font-size:20px}
.symgrid button.on{border-color:#A78BFA;color:var(--tx);background:rgba(167,139,250,.15)}
</style>`);

/* ---------- миграция и обработчики ---------- */
S.profiles.forEach(p => { if (p.sex === 'f' && p.modes && p.modes.cycle === undefined) p.modes.cycle = true; });
save();

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action, p = S.profiles.length ? P() : null; if (!p) return;
  switch (a) {
    case 'cyc-open': cycMonth = dkey().slice(0, 7); openCycle(); break;
    case 'cyc-pick': pickStart(); break;
    case 'cyc-add': { const k = $('#cy-d').value || dkey(); if (k > dkey()) return toast('Дата не может быть в будущем'); if (addPeriod(k)) { cycMonth = k.slice(0, 7); openCycle(); render(); } break; }
    case 'cyc-start': if (addPeriod(dkey())) { toast('🩸 Отмечено. Береги себя'); render(); } break;
    case 'cyc-end': { const st = cycleStats(p); if (st.last && !st.last.end) { st.last.end = dkey(); save(); toast('Отмечено: месячные закончились'); render(); } break; }
    case 'cyc-m': cycMonth = shiftMonth(cycMonth, +el.dataset.n); openCycle(cycDay || dkey()); break;
    case 'cyc-day': openCycle(el.dataset.k); break;
    case 'cyc-flow': { const d = day(p.id, el.dataset.k); d.cyc ??= {}; d.cyc.flow = d.cyc.flow === el.dataset.v ? null : el.dataset.v; save(); openCycle(el.dataset.k); break; }
    case 'cyc-sym': { const d = day(p.id, el.dataset.k); d.cyc ??= {}; const s = new Set(d.cyc.sym || []); s.has(el.dataset.v) ? s.delete(el.dataset.v) : s.add(el.dataset.v); d.cyc.sym = [...s]; save(); openCycle(el.dataset.k); break; }
    case 'cyc-del': if (confirm('Удалить эту запись о месячных?')) { const c = cyc(p); c.periods = c.periods.filter(x => x.start !== el.dataset.s); save(); openCycle(); render(); } break;
    case 'cyc-save': { const c = cyc(p), l = +$('#cy-len').value, pl = +$('#cy-plen').value;
      if (l >= 20 && l <= 45) c.len = l; if (pl >= 2 && pl <= 10) c.plen = pl; save(); toast('Сохранено'); openCycle(); render(); break; }
    case 'cyc-ics': { const ics = cycleIcs(p); if (!ics) return; const a2 = document.createElement('a'); a2.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      a2.download = 'nss-cycle.ics'; document.body.appendChild(a2); a2.click(); a2.remove(); toast('Открой файл и нажми «Добавить все»'); break; }
    case 'cyc-mode': p.modes.cycle = p.modes.cycle === false; save(); render(); break;
  }
});
render();
