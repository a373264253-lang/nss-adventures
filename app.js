'use strict';
/* NSs Adventures — семейный счётчик калорий. Всё хранится на устройстве (localStorage). */

const KEY = 'nss-adventures-v1';
const VERSION = '1.4';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r0 = n => Math.round(+n || 0);
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return dkey(d); };
const hm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/* ---------- справочники ---------- */
const EMOJIS = ['🦊', '🐻', '🐼', '🦁', '🐯', '🐨', '🐸', '🦄', '🐙', '🦉', '🐬', '🚀', '⭐', '🌸', '🔥', '⚡'];
const ACTIVITY = [
  { v: 1.2, n: 'Сидячий образ жизни' }, { v: 1.375, n: 'Лёгкая активность (1–3 раза/нед)' },
  { v: 1.55, n: 'Средняя (3–5 раз/нед)' }, { v: 1.725, n: 'Высокая (6–7 раз/нед)' }];
const GOALS = {
  lose: { n: 'Похудение', e: '🔥', k: 0.85, p: 1.8 },
  cut: { n: 'Сушка', e: '💎', k: 0.8, p: 2.0 },
  keep: { n: 'Поддержание', e: '⚖️', k: 1, p: 1.4 },
  gain: { n: 'Набор массы', e: '💪', k: 1.1, p: 1.8 }};
const MEALS = { breakfast: '🌅 Завтрак', lunch: '☀️ Обед', dinner: '🌙 Ужин', snack: '🍎 Перекус' };
const ACTS = [
  { id: 'walk', n: 'Ходьба', e: '🚶', met: 3.5 }, { id: 'run', n: 'Бег', e: '🏃', met: 9 },
  { id: 'bike', n: 'Велосипед', e: '🚴', met: 7 }, { id: 'swim', n: 'Плавание', e: '🏊', met: 6 },
  { id: 'dance', n: 'Танцы', e: '💃', met: 5 }, { id: 'gym', n: 'Силовая', e: '🏋️', met: 5 },
  { id: 'play', n: 'Игры с детьми', e: '⚽', met: 4.5 }, { id: 'yoga', n: 'Йога', e: '🧘', met: 2.5 }];
const WORKOUTS = [
  { id: 'morning', n: 'Утренняя зарядка', e: '🌅', bg: 'linear-gradient(135deg,#FFB547,#FF7A59)', met: 4, ex: [
    ['Ходьба на месте', 40, 'Высоко поднимай колени'], ['Круги руками', 30, 'Вперёд, потом назад'], ['Наклоны в стороны', 30, 'Руки на поясе'],
    ['Приседания', 40, 'Спина прямая, пятки на полу'], ['Отдых', 15], ['Выпады', 40, 'Поочерёдно каждой ногой'],
    ['Планка', 30, 'Тело — прямая линия'], ['Растяжка', 40, 'Тянись вверх и в стороны']] },
  { id: 'hiit', n: 'Жиросжигающий HIIT', e: '🔥', bg: 'linear-gradient(135deg,#FF5E7E,#A78BFA)', met: 8, ex: [
    ['Разминка: бег на месте', 45], ['Джампинг-джек', 40, 'Прыжки ноги врозь — руки вверх'], ['Отдых', 20], ['Берпи', 30, 'В своём темпе'], ['Отдых', 20],
    ['Скалолаз', 40, 'Колени к груди в упоре'], ['Отдых', 20], ['Прыжки с приседом', 30], ['Отдых', 20], ['Джампинг-джек', 40], ['Отдых', 20],
    ['Скалолаз', 40], ['Заминка: глубокое дыхание', 45]] },
  { id: 'abs', n: 'Пресс и кор', e: '💎', bg: 'linear-gradient(135deg,#4FC3F7,#3DDC97)', met: 4.5, ex: [
    ['Скручивания', 40], ['Отдых', 15], ['Велосипед лёжа', 40], ['Отдых', 15], ['Планка', 45], ['Отдых', 15],
    ['Боковая планка — левая', 30], ['Боковая планка — правая', 30], ['Подъём ног лёжа', 40], ['Супермен', 30, 'Лёжа на животе подними руки и ноги']] },
  { id: 'legs', n: 'Ноги и ягодицы', e: '🍑', bg: 'linear-gradient(135deg,#F472B6,#FFB547)', met: 5, ex: [
    ['Приседания', 45], ['Отдых', 15], ['Ягодичный мостик', 45], ['Отдых', 15], ['Выпады назад', 45], ['Отдых', 15],
    ['Сумо-приседания', 40], ['Подъёмы на носки', 40], ['Махи ногой — левая', 30], ['Махи ногой — правая', 30]] },
  { id: 'family', n: 'Семейная зарядка с детьми', e: '👨‍👩‍👧', bg: 'linear-gradient(135deg,#3DDC97,#FFB547)', met: 4.5, ex: [
    ['Прыжки зайчиком', 30, 'Кто выше?'], ['Медведь', 30, 'Ходим на четвереньках'], ['Самолёт', 30, 'Руки в стороны, наклоны'],
    ['Лягушка', 30, 'Присели — прыжок вперёд'], ['Отдых', 15], ['Танец-стоп', 45, 'Включите музыку, на паузе — замри!'],
    ['Цапля', 30, 'Стоим на одной ноге'], ['Тянемся к солнышку', 30]] },
  { id: 'stretch', n: 'Растяжка перед сном', e: '🌙', bg: 'linear-gradient(135deg,#A78BFA,#4FC3F7)', met: 2.5, ex: [
    ['Дыхание животом', 45], ['Наклон к ногам сидя', 45], ['Поза ребёнка', 45], ['Скрутка лёжа — влево', 30],
    ['Скрутка лёжа — вправо', 30], ['Кошка-корова', 45], ['Бабочка', 45], ['Расслабление', 60]] }];
// повторяем упражнения кругами с отдыхом между ними
WORKOUTS.forEach(w => { const r = { morning: 2, hiit: 2, abs: 2, legs: 3, family: 2, stretch: 1 }[w.id] || 1; const base = w.ex; w.ex = [];
  for (let i = 0; i < r; i++) { if (i) w.ex.push(['Отдых · круг ' + (i + 1) + ' из ' + r, 30, 'Попей воды и отдышись']); w.ex.push(...base); } });
const TITLES = ['Новичок-путник', 'Искатель', 'Следопыт', 'Странник', 'Рейнджер', 'Покоритель вершин', 'Мастер пути', 'Герой', 'Чемпион', 'Легенда'];
const FAST = [{ h: 12, n: '12:12' }, { h: 14, n: '14:10' }, { h: 16, n: '16:8' }, { h: 18, n: '18:6' }, { h: 20, n: '20:4' }, { h: 23, n: 'OMAD' }];
const FAST_STAGES = [[0, 'Переваривание'], [4, 'Сахар в крови снижается'], [10, 'Переход на жиры'], [14, 'Активное жиросжигание'], [18, 'Глубокое голодание']];
const RAINBOW = [['red', '#FF5E5E', 'Красный'], ['orange', '#FFA94D', 'Оранжевый'], ['yellow', '#FFE066', 'Жёлтый'], ['green', '#51CF66', 'Зелёный'], ['purple', '#B197FC', 'Фиолетовый'], ['white', '#F1F3F5', 'Белый']];

/* ---------- состояние ---------- */
function fresh() {
  return {
    v: 1, activeId: null, profiles: [], days: {}, weights: {}, coach: {}, shop: [], plan: null, reports: {}, products: {},
    settings: { apiKey: '', model: 'gemini-flash-latest', endpoint: 'https://generativelanguage.googleapis.com', voice: true },
    reminders: [
      { id: 'r1', e: '🌅', t: 'Завтрак — сфоткай тарелку', times: ['08:30'], days: [1, 2, 3, 4, 5, 6, 0], on: true },
      { id: 'r2', e: '☀️', t: 'Обед — не забудь записать', times: ['13:00'], days: [1, 2, 3, 4, 5, 6, 0], on: true },
      { id: 'r3', e: '🌙', t: 'Ужин — запиши в дневник', times: ['19:00'], days: [1, 2, 3, 4, 5, 6, 0], on: true },
      { id: 'r4', e: '💧', t: 'Выпей стакан воды', times: ['10:00', '12:00', '15:00', '17:00', '20:00'], days: [1, 2, 3, 4, 5, 6, 0], on: true },
      { id: 'r5', e: '⚡', t: 'Время движения!', times: ['18:00'], days: [1, 2, 3, 4, 5], on: true },
      { id: 'r6', e: '⚖️', t: 'Взвешивание', times: ['08:00'], days: [1], on: true }],
    fired: {}
  };
}
let S;
try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch { S = fresh(); }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { prunePhotos(14); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('Память телефона заполнена — сделай бэкап'); } }
}
function prunePhotos(keepDays) {
  const lim = addDays(dkey(), -keepDays);
  for (const pid in S.days) for (const k in S.days[pid]) if (k < lim) S.days[pid][k].meals.forEach(m => delete m.photo);
}
const P = () => S.profiles.find(p => p.id === S.activeId) || S.profiles[0];
function day(pid = P().id, k = dkey()) {
  S.days[pid] ??= {};
  return S.days[pid][k] ??= { meals: [], water: 0, workouts: [], xp: 0, quests: [] };
}
const isKid = p => p.age < 14;

/* ---------- нормы ---------- */
function targets(p) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const g = isKid(p) ? GOALS.keep : GOALS[p.goal] || GOALS.keep;
  const kcal = Math.max(r0(bmr * p.activity * g.k), isKid(p) ? 1200 : r0(bmr * 1.05));
  const protein = r0(p.weight * (isKid(p) ? 1.1 : g.p));
  const fat = r0(p.weight * (isKid(p) ? 1.2 : 0.9));
  const carbs = Math.max(50, r0((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs, water: Math.max(1200, Math.round(p.weight * 33 / 250) * 250), bmr: r0(bmr) };
}
function totals(d) {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0, burned: 0 };
  d.meals.forEach(m => m.items.forEach(i => { t.kcal += +i.kcal || 0; t.protein += +i.protein || 0; t.fat += +i.fat || 0; t.carbs += +i.carbs || 0; }));
  d.workouts.forEach(w => t.burned += +w.kcal || 0);
  return t;
}
const burnMin = (kcal, met, kg) => Math.max(1, r0(kcal * 60 / (met * kg)));

/* ---------- приключение: XP, квесты, достижения ---------- */
const level = xp => Math.floor(Math.sqrt((xp || 0) / 60)) + 1;
const lvlXp = l => (l - 1) ** 2 * 60;
const title = l => TITLES[Math.min(TITLES.length - 1, Math.floor((l - 1) / 2))];
function addXP(n, why) {
  const p = P(); if (!p.modes.adventure) return;
  const before = level(p.xp);
  p.xp = (p.xp || 0) + n; day().xp += n; save();
  toast(`+${n} XP · ${why}`, 'xp');
  if (level(p.xp) > before) setTimeout(() => { confetti(); toast(`🏆 Уровень ${level(p.xp)}: ${title(level(p.xp))}!`, 'xp'); speak(`Новый уровень! ${title(level(p.xp))}`); }, 700);
}
const QUESTS = [
  { id: 'photo3', t: 'Сфотографируй 3 приёма пищи', ok: (d) => d.meals.filter(m => m.photo || m.ai).length >= 3 },
  { id: 'water', t: 'Выпей норму воды', ok: (d, t) => d.water >= t.water },
  { id: 'move', t: 'Сделай тренировку или прогулку', ok: d => d.workouts.length > 0 },
  { id: 'healthy', t: 'Съешь блюдо на 8+ ★', ok: d => d.meals.some(m => (m.score || 0) >= 8) },
  { id: 'protein', t: 'Набери 80% нормы белка', ok: (d, t, x) => x.protein >= t.protein * 0.8 },
  { id: 'veg', t: 'Собери 4 цвета радуги в тарелке', ok: d => new Set(d.meals.flatMap(m => m.colors || [])).size >= 4 },
  { id: 'burn150', t: 'Сожги 150+ ккал движением', ok: (d, t, x) => x.burned >= 150 },
  { id: 'breakfast', t: 'Не пропусти завтрак', ok: d => d.meals.some(m => m.type === 'breakfast') }];
function todaysQuests(pid, k = dkey()) {
  let h = 0; for (const c of pid + k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const kid = isKid(S.profiles.find(q => q.id === pid) || {});
  const pool = QUESTS.filter(q => !kid || !['protein', 'burn150'].includes(q.id)); const out = [];
  while (out.length < 3) { out.push(pool.splice(h % pool.length, 1)[0]); h = (h * 1103515245 + 12345) >>> 0; }
  return out;
}
function checkQuests() {
  const p = P(); if (!p.modes.adventure) return;
  const d = day(), t = targets(p), x = totals(d);
  todaysQuests(p.id).forEach(q => {
    if (!d.quests.includes(q.id) && q.ok(d, t, x)) { d.quests.push(q.id); addXP(25, 'Квест: ' + q.t); }
  });
  const qs = todaysQuests(p.id).map(q => q.id);
  if (qs.every(q => d.quests.includes(q)) && !d.quests.includes('_all')) { d.quests.push('_all'); setTimeout(() => { addXP(50, 'Все квесты дня!'); confetti(); }, 900); }
  checkAch();
}
const ACH = [
  { id: 'first', e: '📸', n: 'Первое фото', ok: s => s.photos >= 1 },
  { id: 'p50', e: '🍽️', n: '50 блюд', ok: s => s.meals >= 50 },
  { id: 'w1', e: '⚡', n: 'Первая тренировка', ok: s => s.workouts >= 1 },
  { id: 'w20', e: '🏅', n: '20 тренировок', ok: s => s.workouts >= 20 },
  { id: 's3', e: '🔥', n: '3 дня подряд', ok: s => s.streak >= 3 },
  { id: 's7', e: '🌟', n: 'Неделя подряд', ok: s => s.streak >= 7 },
  { id: 's30', e: '👑', n: '30 дней подряд', ok: s => s.streak >= 30 },
  { id: 'water7', e: '💧', n: '7 дней воды', ok: s => s.waterDays >= 7 },
  { id: 'fast', e: '⏳', n: 'Голодание выполнено', ok: s => s.fasts >= 1 },
  { id: 'l5', e: '🗻', n: 'Уровень 5', ok: s => s.level >= 5 },
  { id: 'l10', e: '🐉', n: 'Уровень 10', ok: s => s.level >= 10 },
  { id: 'rainbow', e: '🌈', n: 'Вся радуга', ok: s => s.rainbow }];
function stats(p) {
  const ds = S.days[p.id] || {}; const t = targets(p);
  const s = { photos: 0, meals: 0, workouts: 0, waterDays: 0, streak: streak(p), fasts: p.fasts || 0, level: level(p.xp), rainbow: false };
  for (const k in ds) {
    const d = ds[k]; s.meals += d.meals.length; s.photos += d.meals.filter(m => m.photo || m.ai).length;
    s.workouts += d.workouts.length; if (d.water >= t.water) s.waterDays++;
    if (new Set(d.meals.flatMap(m => m.colors || [])).size >= 6) s.rainbow = true;
  }
  return s;
}
function streak(p) {
  const ds = S.days[p.id] || {}; let k = dkey(), n = 0;
  if (!ds[k]?.meals.length) k = addDays(k, -1);
  while (ds[k]?.meals.length) { n++; k = addDays(k, -1); }
  return n;
}
function checkAch() {
  const p = P(); p.ach ??= []; const s = stats(p);
  ACH.forEach(a => { if (!p.ach.includes(a.id) && a.ok(s)) { p.ach.push(a.id); save(); setTimeout(() => { toast(`${a.e} Достижение: ${a.n}`, 'xp'); confetti(); }, 1400); } });
}

/* ---------- UI-утилиты ---------- */
function toast(msg, cls = '') {
  const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = msg;
  $('#toast-root').appendChild(el); setTimeout(() => el.remove(), 2800);
}
function confetti() {
  const c = document.createElement('canvas'); c.className = 'confetti'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const x = c.getContext('2d'); const cols = ['#FFB547', '#FF6B6B', '#3DDC97', '#4FC3F7', '#A78BFA', '#F472B6'];
  const ps = Array.from({ length: 120 }, () => ({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - .5) * 14, vy: Math.random() * -14 - 4, s: Math.random() * 7 + 4, c: cols[Math.random() * 6 | 0], r: Math.random() * 6 }));
  let f = 0; (function tick() {
    x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .45; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (++f < 110) requestAnimationFrame(tick); else c.remove();
  })();
  navigator.vibrate?.(30);
}
let audioCtx;
function beep(f = 880, ms = 120) {
  try { audioCtx ??= new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + ms / 1000); o.start(); o.stop(audioCtx.currentTime + ms / 1000); } catch { }
}
function speak(t) {
  if (S.profiles.length && P().modes.voice === false || !window.speechSynthesis) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'ru-RU'; u.rate = 1.02; speechSynthesis.speak(u); } catch { }
}
function ring(val, max, size, stroke, color, track = 'rgba(255,255,255,.07)') {
  const rr = (size - stroke) / 2, C = 2 * Math.PI * rr, pct = Math.min(1, max ? val / max : 0);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><linearGradient id="g${size}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB547"/><stop offset=".6" stop-color="#FF7A59"/><stop offset="1" stop-color="#FF5E7E"/></linearGradient></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${rr}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${rr}" fill="none" stroke="${color || `url(#g${size})`}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" style="transition:stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)"/></svg>`;
}
function bar(v, max, color) { return `<div class="bar"><i style="width:${Math.min(100, max ? v / max * 100 : 0)}%;background:${color}"></i></div>`; }

let sheetClose = null;
function sheet(html, opts = {}) {
  sheetClose = null; // замена содержимого — не закрытие
  const root = $('#sheet-root');
  root.innerHTML = `<div class="overlay" data-action="close-sheet"></div><div class="sheet ${opts.full ? 'full' : ''}">${opts.full ? '' : '<div class="grab"></div>'}${html}</div>`;
  sheetClose = opts.onClose || null;
}
function closeSheet() { if (sheetClose) { const f = sheetClose; sheetClose = null; f(); } $('#sheet-root').innerHTML = ''; }

/* ---------- Gemini ---------- */
const FOOD_SCHEMA = {
  type: 'OBJECT', properties: {
    dish: { type: 'STRING' }, isFood: { type: 'BOOLEAN' },
    items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      name: { type: 'STRING' }, grams: { type: 'NUMBER' }, kcal: { type: 'NUMBER' }, protein: { type: 'NUMBER' }, fat: { type: 'NUMBER' }, carbs: { type: 'NUMBER' } },
      required: ['name', 'grams', 'kcal', 'protein', 'fat', 'carbs'] } },
    healthScore: { type: 'INTEGER' }, tip: { type: 'STRING' },
    colors: { type: 'ARRAY', items: { type: 'STRING', enum: RAINBOW.map(r => r[0]) } } },
  required: ['dish', 'isFood', 'items', 'healthScore', 'tip', 'colors'] };
function foodPrompt(p, extra = '') {
  return `Ты — диетолог-нутрициолог. Определи все продукты/блюда ${extra ? 'из описания' : 'на фото'} и оцени вес каждой порции в граммах (ориентируйся на размер тарелки, приборов, рук).
Для каждой позиции посчитай калории, белки, жиры, углеводы (граммы). Названия — по-русски, коротко.
healthScore — полезность блюда от 1 до 10. colors — какие цвета овощей/фруктов есть (для детской «радуги»; хлеб/рис/мясо не считаются).
tip — один короткий дружелюбный совет (до 20 слов) для человека с целью «${isKid(p) ? 'здоровое питание ребёнка' : GOALS[p.goal].n}». Если еды нет — isFood=false и пустой items.
${extra ? 'Описание: ' + extra : ''}`;
}
async function gemini(parts, schema) {
  const st = S.settings;
  if (!st.apiKey) throw new Error('NOKEY');
  if (st.apiKey.trim().toLowerCase() === 'demo') return demoAnswer(schema);
  const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2 } };
  if (schema) { body.generationConfig.responseMimeType = 'application/json'; body.generationConfig.responseSchema = schema; }
  // Модели по очереди: последняя удачная → выбранная → запасные. При перегрузке — повтор, потом следующая модель.
  const models = [...new Set([st.lastOk, st.model, ...FALLBACK_MODELS].filter(Boolean))];
  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await geminiCall(model, body, schema);
        if (st.lastOk !== model) { st.lastOk = model; save(); }
        return out;
      } catch (e) {
        lastErr = e;
        if (e.fatal) throw e;               // неверный ключ / регион — менять модель бессмысленно
        if (!e.retry) break;                // модели нет или ошибка запроса — сразу следующая
        await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
async function geminiCall(model, body, schema) {
  const st = S.settings;
  const url = `${st.endpoint.replace(/\/$/, '')}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': st.apiKey.trim() }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(j.error?.message || 'HTTP ' + res.status);
    e.fatal = res.status === 400 && /API key|location|region/i.test(e.message) || res.status === 403;
    e.retry = [429, 500, 502, 503, 504].includes(res.status);
    throw e;
  }
  const txt = (j.candidates?.[0]?.content?.parts || []).filter(x => !x.thought).map(x => x.text || '').join('');
  if (!txt) { const e = new Error('Пустой ответ ИИ'); e.retry = true; throw e; }
  return schema ? JSON.parse(txt) : txt.trim();
}
const DEMO = new Map(); // схема → тестовый ответ (заполняет features.js)
function demoAnswer(schema) {
  if (DEMO.has(schema)) return new Promise(r => setTimeout(() => r(structuredClone(DEMO.get(schema))), 900));
  return new Promise(r => setTimeout(() => r(schema ? {
    dish: 'Курица с рисом и салатом', isFood: true, healthScore: 8, colors: ['red', 'green', 'white'],
    tip: 'Отличный баланс! Добавь ещё горсть зелени — и будет идеально.',
    items: [{ name: 'Куриная грудка', grams: 150, kcal: 248, protein: 46, fat: 5, carbs: 0 },
      { name: 'Рис отварной', grams: 180, kcal: 234, protein: 4, fat: 1, carbs: 51 },
      { name: 'Салат из овощей', grams: 120, kcal: 70, protein: 2, fat: 5, carbs: 6 }]
  } : '• Ты отлично держишь белок — так держать!\n• До нормы воды осталось 2 стакана.\n• Вечером: 15 минут быстрой ходьбы или «Растяжка перед сном».'), 1300));
}
function aiError(e) {
  if (e.message === 'NOKEY') { toast('Сначала добавь ключ Gemini в «Режимы → ИИ»'); openSettings(); return; }
  let m = e.message || String(e);
  if (/location is not supported|not supported for the API/i.test(m)) m = 'Gemini недоступен из этого региона. Включи VPN или укажи прокси в настройках ИИ.';
  else if (/API key not valid|API_KEY_INVALID/i.test(m)) m = 'Ключ Gemini не подходит — проверь его в настройках.';
  else if (/high demand|overloaded|UNAVAILABLE|503/i.test(m)) m = 'Серверы Gemini сейчас перегружены (это у Google, не у тебя). Я попробовал все запасные модели — подожди минуту и повтори.';
  else if (/quota|exhausted|429/i.test(m)) m = 'Бесплатный лимит Gemini на сегодня/минуту исчерпан. Попробуй чуть позже.';
  else if (/Failed to fetch|NetworkError|Load failed/i.test(m)) m = 'Нет связи с Gemini. Проверь интернет/VPN.';
  sheet(`<h3>Не получилось 😕</h3><p class="sub">${esc(m)}</p><button class="btn block" data-action="close-sheet">Понятно</button>`);
}

/* ---------- изображения ---------- */
function loadImg(file) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
}
function shrink(img, max, q) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = r0(img.naturalWidth * k); c.height = r0(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q);
}
const square = (img, s) => {
  const c = document.createElement('canvas'); c.width = c.height = s; const m = Math.min(img.naturalWidth, img.naturalHeight);
  c.getContext('2d').drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, s, s); return c.toDataURL('image/jpeg', .72);
};

/* ---------- анализ еды ---------- */
let pending = null; // результат анализа, который ещё не добавлен
function guessMeal() { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; }
async function analyzePhoto(file) {
  let img; try { img = await loadImg(file); } catch { return toast('Не удалось открыть фото'); }
  const big = shrink(img, 1024, .82), thumb = square(img, 200);
  sheet(`<h3>Анализирую тарелку…</h3><div class="scan"><img src="${big}"></div><div class="row"><span class="spin"></span><span class="sub">ИИ узнаёт продукты и считает порции</span></div>`);
  try {
    const r = await gemini([{ text: foodPrompt(P()) }, { inline_data: { mime_type: 'image/jpeg', data: big.split(',')[1] } }], FOOD_SCHEMA);
    if (!r.isFood || !r.items?.length) return sheet(`<h3>Еды не видно 🤔</h3><p class="sub">Попробуй снять тарелку сверху при хорошем свете.</p><button class="btn primary block" data-action="cam">Переснять</button>`);
    showResult({ ...r, photo: thumb, big });
  } catch (e) { aiError(e); }
}
async function analyzeText(text) {
  sheet(`<h3>Считаю…</h3><div class="row"><span class="spin"></span><span class="sub">${esc(text)}</span></div>`);
  try {
    const r = await gemini([{ text: foodPrompt(P(), text) }], FOOD_SCHEMA);
    if (!r.items?.length) return sheet(`<h3>Не понял, что это 🤔</h3><p class="sub">Опиши иначе, например «2 яйца, тост с маслом, кофе с молоком».</p><button class="btn block" data-action="close-sheet">Ок</button>`);
    showResult({ ...r, text });
  } catch (e) { aiError(e); }
}
function showResult(r) {
  r.items.forEach(i => { i.base = { ...i }; i.grams = r0(i.grams); });
  pending = { ...r, type: guessMeal() };
  renderResult();
}
function renderResult() {
  const r = pending, p = P(), kid = isKid(p);
  const sum = r.items.reduce((a, i) => (a.k += i.kcal, a.p += i.protein, a.f += i.fat, a.c += i.carbs, a), { k: 0, p: 0, f: 0, c: 0 });
  const stars = '★'.repeat(Math.max(0, Math.min(10, r.healthScore))) + '☆'.repeat(10 - Math.max(0, Math.min(10, r.healthScore)));
  sheet(`
    ${r.big ? `<img class="resimg" src="${r.big}">` : ''}
    <div class="row between" style="margin-top:14px"><div class="grow"><h3 style="font-size:21px">${esc(r.dish)}</h3>
      <div class="score" style="color:var(--amber)">${kid ? '⭐'.repeat(Math.ceil(r.healthScore / 2)) : stars}</div></div>
      ${kid ? '' : `<div style="text-align:right"><div style="font-size:30px;font-weight:850">${r0(sum.k)}</div><div class="muted">ккал</div></div>`}</div>
    ${kid ? '' : `<div class="macrorow"><div><div class="k">Белки</div><div class="v" style="color:var(--blue)">${r0(sum.p)} г</div></div>
      <div><div class="k">Жиры</div><div class="v" style="color:var(--amber)">${r0(sum.f)} г</div></div><div><div class="k">Углеводы</div><div class="v" style="color:var(--violet)">${r0(sum.c)} г</div></div></div>`}
    <div class="card" style="margin-top:14px">
      <div class="muted" style="margin-bottom:4px">Поправь граммы, если ИИ ошибся</div>
      ${r.items.map((i, n) => `<div class="item"><div>${esc(i.name)}${kid ? '' : `<div class="muted">${r0(i.kcal)} ккал</div>`}</div>
        <input type="number" inputmode="numeric" value="${i.grams}" data-grams="${n}"><span class="muted">г</span>
        <button class="iconbtn" style="width:28px;height:28px;font-size:13px" data-action="rm-item" data-n="${n}">✕</button></div>`).join('')}
    </div>
    <div class="card"><div class="row"><span style="font-size:22px">💡</span><div class="sub">${esc(r.tip)}</div></div>
    ${kid ? rainbowHtml(r.colors || []) : `<div class="muted" style="margin-top:12px">Чтобы сжечь это блюдо:</div><div class="burn">${ACTS.slice(0, 4).map(a => `<div><span>${a.e}</span><b>${burnMin(sum.k, a.met, p.weight)}</b>мин</div>`).join('')}</div>`}</div>
    <div class="seg" style="margin:14px 0">${Object.entries(MEALS).map(([k, v]) => `<button class="${r.type === k ? 'on' : ''}" data-action="mtype" data-v="${k}">${v.split(' ')[0]}</button>`).join('')}</div>
    <button class="btn primary block" data-action="add-pending">Добавить в ${esc(MEALS[r.type].split(' ')[1].toLowerCase())}</button>`);
}
function rainbowHtml(cols) {
  return `<div class="muted" style="margin-top:12px">Радуга в тарелке</div><div class="rainbow">${RAINBOW.map(([k, c]) => `<i class="${cols.includes(k) ? 'on' : ''}" style="background:${c}"></i>`).join('')}</div>`;
}
function addPending() {
  const r = pending; if (!r) return;
  const d = day();
  d.meals.push({ id: uid(), type: r.type, time: hm(), name: r.dish, photo: r.photo, ai: true, score: r.healthScore, colors: r.colors, tip: r.tip,
    items: r.items.map(i => ({ name: i.name, grams: i.grams, kcal: r0(i.kcal), protein: r0(i.protein), fat: r0(i.fat), carbs: r0(i.carbs) })) });
  pending = null; save(); closeSheet(); go('today');
  addXP(r.photo ? 15 : 10, r.photo ? 'Фото еды' : 'Запись еды');
  checkQuests(); render();
}

/* ---------- экраны ---------- */
let tab = 'today';
function go(t) { tab = t; render(); scrollTo(0, 0); }
function render() {
  document.querySelectorAll('#tabbar .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (!S.profiles.length) { $('#tabbar').style.display = 'none'; $('#app').innerHTML = onboardingHtml(); return; }
  $('#tabbar').style.display = '';
  $('#app').innerHTML = ({ today: todayHtml, snap: snapHtml, train: trainHtml, progress: progressHtml, more: moreHtml }[tab])();
}
function header(sub) {
  const p = P(), l = level(p.xp), pr = (p.xp - lvlXp(l)) / (lvlXp(l + 1) - lvlXp(l));
  const hr = new Date().getHours(), hi = hr < 6 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
  return `<div class="top"><button class="avatar" data-action="profiles">${p.emoji}</button><div class="grow">
    <div class="sub">${sub || hi}</div><div class="row"><b style="font-size:20px">${esc(p.name)}</b>
    ${p.modes.adventure ? `<span class="lvl">Ур. ${l} · ${title(l)}</span>` : ''}</div>
    ${p.modes.adventure ? `<div class="xpbar"><i style="width:${r0(pr * 100)}%"></i></div>` : ''}</div>
    ${S.profiles.length > 1 ? `<button class="iconbtn" data-action="profiles" title="Сменить профиль">⇄</button>` : ''}</div>`;
}

function todayHtml() {
  const p = P(), d = day(), t = targets(p), x = totals(d), kid = isKid(p);
  const budget = t.kcal + x.burned, left = budget - x.kcal;
  const glasses = Math.ceil(t.water / 250), drunk = Math.floor(d.water / 250);
  let h = header();
  if (kid) {
    const cols = [...new Set(d.meals.flatMap(m => m.colors || []))];
    const st = d.meals.reduce((a, m) => a + Math.ceil((m.score || 5) / 2), 0);
    h += `<div class="card glow"><h3>Мои звёзды сегодня</h3><div class="stars">${st ? '⭐'.repeat(Math.min(st, 20)) : '<span class="muted">Сфоткай первую тарелку!</span>'}</div>
      ${rainbowHtml(cols)}<div class="muted" style="margin-top:8px">Собери все цвета радуги из овощей и фруктов 🌈</div></div>`;
  } else {
    h += `<div class="card glow"><div class="ringwrap"><div class="ring">${ring(x.kcal, budget, 150, 14, left < 0 ? '#FF6B6B' : null)}
      <div class="c"><div><div class="big">${Math.abs(r0(left))}</div><div class="lbl">${left >= 0 ? 'ккал осталось' : 'ккал сверх нормы'}</div></div></div></div>
      <div class="grow"><div class="stat"><div class="muted">Цель</div><b>${t.kcal}</b></div><div class="stat"><div class="muted">Съедено</div><b>${r0(x.kcal)}</b></div>
      <div class="stat"><div class="muted">Сожжено</div><b style="color:var(--green)">+${r0(x.burned)}</b></div></div></div>
      <div class="macrorow">${[['Белки', x.protein, t.protein, 'var(--blue)'], ['Жиры', x.fat, t.fat, 'var(--amber)'], ['Углеводы', x.carbs, t.carbs, 'var(--violet)']]
        .map(([n, v, m, c]) => `<div class="macro"><div class="k">${n}</div><div class="v">${r0(v)}<span class="muted">/${m} г</span></div>${bar(v, m, c)}</div>`).join('')}</div></div>`;
  }
  h += `<div class="card"><div class="row between"><h3>💧 Вода</h3><span class="muted">${d.water} / ${t.water} мл</span></div>
    <div class="drops">${Array.from({ length: glasses }, (_, i) => `<button class="drop ${i < drunk ? 'on' : ''}" data-action="water" data-n="${i}">${i < drunk ? '' : '+'}</button>`).join('')}</div></div>`;
  if (p.modes.fasting) h += fastingCard(p);
  if (p.modes.adventure) {
    h += `<div class="card"><div class="row between"><h3>🗺️ Квесты дня</h3><span class="pill">+25 XP</span></div>
      ${todaysQuests(p.id).map(q => `<div class="quest"><div class="check ${d.quests.includes(q.id) ? 'done' : ''}">${d.quests.includes(q.id) ? '✓' : ''}</div><div>${q.t}</div></div>`).join('')}</div>`;
  }
  if (typeof kitchenToday === 'function') h += kitchenToday(p);
  h += `<h2>Дневник</h2><div class="card">`;
  if (!d.meals.length) h += `<div class="empty">Пока пусто. Нажми 📸 внизу и сфотографируй тарелку</div>`;
  for (const [k, v] of Object.entries(MEALS)) {
    const ms = d.meals.filter(m => m.type === k); if (!ms.length) continue;
    h += `<div class="mtype">${v}</div>` + ms.map(m => {
      const kc = m.items.reduce((a, i) => a + (+i.kcal || 0), 0);
      return `<button class="meal" style="width:100%;text-align:left" data-action="meal" data-id="${m.id}">${m.photo ? `<img class="thumb" src="${m.photo}">` : `<div class="thumb">🍽️</div>`}
        <div class="grow"><div style="font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name)}</div><div class="muted">${m.time}${m.score ? ' · ★' + m.score : ''}</div></div>
        ${kid ? '' : `<div class="kcal">${r0(kc)}</div>`}</button>`;
    }).join('');
  }
  h += `</div>`;
  if (d.workouts.length) h += `<h2>Движение</h2><div class="card">${d.workouts.map(w => `<div class="meal"><div class="thumb">${w.e}</div><div class="grow"><b>${esc(w.n)}</b><div class="muted">${w.min} мин</div></div><div class="kcal" style="color:var(--green)">−${w.kcal}</div></div>`).join('')}</div>`;
  const c = S.coach[p.id + dkey()];
  h += `<div class="card"><div class="row between"><h3>🧭 Советы тренера</h3><button class="btn sm" data-action="coach">${c ? 'Обновить' : 'Получить'}</button></div>
    ${c ? `<div class="coach">${esc(c)}</div>` : `<div class="muted">ИИ посмотрит твой день и подскажет, что съесть и как подвигаться.</div>`}</div>`;
  return h;
}
function fastingCard(p) {
  const f = p.fast, sch = p.modes.fastH || 16;
  if (!f) return `<div class="card fast"><div class="row between"><div><h3>⏳ Голодание ${FAST.find(x => x.h === sch)?.n || sch + 'ч'}</h3><div class="muted">Начни после последнего приёма пищи</div></div>
    <button class="btn primary sm" data-action="fast-start">Начать</button></div></div>`;
  const el = (Date.now() - f.start) / 3600000, left = f.hours - el;
  const st = [...FAST_STAGES].reverse().find(s => el >= s[0]);
  const end = new Date(f.start + f.hours * 3600000);
  return `<div class="card fast"><div class="ringwrap"><div class="ring">${ring(el, f.hours, 130, 12, left <= 0 ? '#3DDC97' : '#A78BFA')}
    <div class="c"><div><div class="big" style="font-size:26px">${left > 0 ? `${Math.floor(left)}:${pad(Math.floor(left % 1 * 60))}` : '✓'}</div><div class="lbl">${left > 0 ? 'осталось' : 'цель достигнута'}</div></div></div></div>
    <div class="grow"><h3>⏳ Голодание</h3><div class="sub">${st[1]}</div><div class="muted" style="margin:6px 0 10px">Окно еды с ${hm(end)}</div>
    <button class="btn sm ${left <= 0 ? 'primary' : ''}" data-action="fast-stop">${left <= 0 ? 'Завершить 🎉' : 'Прервать'}</button></div></div>
    <div class="muted" style="margin-top:8px">Этапы ориентировочные. Голодание не для детей, беременных и людей с диабетом — уточни у врача.</div></div>`;
}

function snapHtml() {
  return `${header('Что на тарелке?')}<div class="hero"><button class="camcircle" data-action="cam">📸</button>
    <h1>Сфоткай тарелку</h1><div class="sub">ИИ определит блюда, вес порций и калории</div></div>
    <button class="opt" data-action="scan"><div class="e">▥</div><div><b>Сканировать штрихкод</b><div class="muted">Точные КБЖУ с упаковки</div></div></button>
    <button class="opt" data-action="gal"><div class="e">🖼️</div><div><b>Из галереи</b><div class="muted">Выбрать готовое фото</div></div></button>
    <button class="opt" data-action="text-food"><div class="e">✍️</div><div><b>Описать словами</b><div class="muted">«Тарелка борща и 2 куска хлеба»</div></div></button>
    <button class="opt" data-action="manual-food"><div class="e">🔢</div><div><b>Ввести вручную</b><div class="muted">Если знаешь калории с упаковки</div></div></button>
    <h2>Кухня</h2>
    <button class="opt" data-action="cook"><div class="e">👩‍🍳</div><div><b>Что приготовить?</b><div class="muted">Сфоткай холодильник — ИИ подберёт рецепты</div></div></button>
    <button class="opt" data-action="plan"><div class="e">🗓️</div><div><b>Меню на неделю</b><div class="muted">${S.plan ? 'Открыть текущее меню' : 'Для всей семьи под цели каждого'}</div></div></button>
    <button class="opt" data-action="shop"><div class="e">🛒</div><div><b>Список покупок</b><div class="muted">${S.shop.filter(s => !s.done).length ? 'Осталось купить: ' + S.shop.filter(s => !s.done).length : 'Пока пусто'}</div></div></button>
    <div class="muted" style="text-align:center;margin-top:14px">Совет: снимай сверху, при дневном свете, вилка рядом помогает оценить размер</div>`;
}

function trainHtml() {
  const p = P(), d = day(), x = totals(d), last = d.meals[d.meals.length - 1];
  let h = header('Движение — жизнь');
  if (last && !isKid(p)) {
    const kc = last.items.reduce((a, i) => a + (+i.kcal || 0), 0);
    h += `<div class="card glow"><h3>Сжечь «${esc(last.name)}» (${r0(kc)} ккал)</h3><div class="burn">${ACTS.slice(0, 8).map(a => `<div><span>${a.e}</span><b>${burnMin(kc, a.met, p.weight)}</b>мин</div>`).join('')}</div></div>`;
  }
  h += `<h2>Тренировки с таймером</h2>` + WORKOUTS.map(w => {
    const sec = w.ex.reduce((a, e) => a + e[1], 0);
    return `<button class="wcard" data-action="workout" data-id="${w.id}"><div class="e" style="background:${w.bg}">${w.e}</div><div class="grow"><b>${w.n}</b>
      <div class="muted">${Math.round(sec / 60)} мин · ~${r0(w.met * p.weight * sec / 3600)} ккал · ${w.ex.filter(e => !e[0].startsWith('Отдых')).length} упражнений</div></div><span class="muted">▶</span></button>`;
  }).join('');
  h += `<h2>Записать активность</h2><div class="card"><div class="grid2">${ACTS.map(a => `<button class="btn" data-action="act" data-id="${a.id}">${a.e} ${a.n}</button>`).join('')}</div>
    <div class="muted" style="margin-top:10px">Сегодня сожжено: <b style="color:var(--green)">${r0(x.burned)} ккал</b></div></div>`;
  return h;
}

function progressHtml() {
  const p = P(), t = targets(p), s = stats(p), ws = S.weights[p.id] || [];
  let h = header('Твой путь');
  h += `<div class="grid3"><div class="card" style="margin:0;text-align:center"><div style="font-size:26px">🔥</div><b style="font-size:22px">${s.streak}</b><div class="muted">дней подряд</div></div>
    <div class="card" style="margin:0;text-align:center"><div style="font-size:26px">🍽️</div><b style="font-size:22px">${s.meals}</b><div class="muted">блюд</div></div>
    <div class="card" style="margin:0;text-align:center"><div style="font-size:26px">⚡</div><b style="font-size:22px">${s.workouts}</b><div class="muted">тренировок</div></div></div>`;
  if (!isKid(p)) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(dkey(), i - 6));
    const vals = days.map(k => S.days[p.id]?.[k] ? totals(S.days[p.id][k]).kcal : 0);
    const mx = Math.max(t.kcal * 1.3, ...vals), W = 320, H = 150;
    const wd = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    h += `<div class="card chart"><div class="row between"><h3>Калории за неделю</h3><span class="muted">норма ${t.kcal}</span></div>
      <svg viewBox="0 0 ${W} ${H + 22}"><line x1="0" x2="${W}" y1="${H - t.kcal / mx * H}" y2="${H - t.kcal / mx * H}" stroke="#FFB547" stroke-dasharray="4 4" opacity=".6"/>
      ${vals.map((v, i) => { const bh = Math.max(3, v / mx * H), over = v > t.kcal * 1.05; return `<rect x="${i * 46 + 8}" y="${H - bh}" width="30" height="${bh}" rx="8" fill="${over ? '#FF6B6B' : v ? 'url(#bg)' : 'rgba(255,255,255,.08)'}"/>
        <text x="${i * 46 + 23}" y="${H + 16}" fill="#6B7594" font-size="11" text-anchor="middle">${wd[new Date(days[i] + 'T12:00').getDay()]}</text>`; }).join('')}
      <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3DDC97"/><stop offset="1" stop-color="#4FC3F7"/></linearGradient></defs></svg></div>`;
    h += `<div class="card chart"><div class="row between"><h3>⚖️ Вес</h3><button class="btn sm" data-action="weigh">+ Записать</button></div>`;
    if (ws.length >= 2) {
      const pts = ws.slice(-30), mn = Math.min(...pts.map(w => w.kg)) - 1, mxw = Math.max(...pts.map(w => w.kg)) + 1;
      const xy = pts.map((w, i) => [i / (pts.length - 1) * (W - 20) + 10, 110 - (w.kg - mn) / (mxw - mn) * 100]);
      const diff = pts[pts.length - 1].kg - pts[0].kg;
      h += `<div class="sub">${pts[pts.length - 1].kg} кг <span style="color:${diff <= 0 ? 'var(--green)' : 'var(--coral)'}">${diff > 0 ? '+' : ''}${diff.toFixed(1)} кг</span></div>
        <svg viewBox="0 0 ${W} 120"><polyline fill="none" stroke="url(#wg)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${xy.map(a => a.join(',')).join(' ')}"/>
        ${xy.map(a => `<circle cx="${a[0]}" cy="${a[1]}" r="3.5" fill="#FFB547"/>`).join('')}
        <defs><linearGradient id="wg"><stop offset="0" stop-color="#FFB547"/><stop offset="1" stop-color="#FF5E7E"/></linearGradient></defs></svg>`;
    } else h += `<div class="muted">Текущий вес: ${p.weight} кг. Записывай вес раз в неделю — появится график.</div>`;
    if (typeof forecastHtml === 'function') h += forecastHtml(p);
    h += `</div>`;
    if (typeof reportCard === 'function') h += reportCard(p);
  }
  p.ach ??= [];
  h += `<h2>Достижения <span class="muted">${p.ach.length}/${ACH.length}</span></h2><div class="ach">${ACH.map(a => `<div class="${p.ach.includes(a.id) ? 'on' : ''}"><span>${a.e}</span>${a.n}</div>`).join('')}</div>`;
  if (S.profiles.length > 1) {
    const lb = S.profiles.map(q => ({ q, xp: Array.from({ length: 7 }, (_, i) => S.days[q.id]?.[addDays(dkey(), -i)]?.xp || 0).reduce((a, b) => a + b, 0) })).sort((a, b) => b.xp - a.xp);
    h += `<h2>👨‍👩‍👧 Семейный челлендж недели</h2><div class="card">${lb.map((r, i) => `<div class="lb"><div class="pos">${['🥇', '🥈', '🥉'][i] || i + 1}</div><div class="avatar sm">${r.q.emoji}</div><div class="grow"><b>${esc(r.q.name)}</b></div><b>${r.xp} XP</b></div>`).join('')}</div>`;
  }
  return h;
}

function moreHtml() {
  const p = P(), m = p.modes;
  const mode = (key, e, bg, name, desc, extra = '') => `<div class="mode"><div class="e" style="background:${bg}">${e}</div><div class="grow"><b>${name}</b><div class="muted">${desc}</div>${extra}</div>
    <button class="sw ${m[key] ? 'on' : ''}" data-action="mode" data-k="${key}" aria-label="${name}"></button></div>`;
  let h = header('Режимы и настройки');
  h += `<h2>Цель</h2><div class="seg">${Object.entries(GOALS).map(([k, g]) => `<button class="${p.goal === k ? 'on' : ''}" data-action="goal" data-v="${k}">${g.e} ${g.n}</button>`).join('')}</div>
    <div class="muted" style="margin:8px 4px">Норма: ${targets(p).kcal} ккал · Б ${targets(p).protein} / Ж ${targets(p).fat} / У ${targets(p).carbs} г${isKid(p) ? ' · детский профиль: без дефицита' : ''}</div>`;
  h += `<h2>Режимы</h2>`;
  h += mode('adventure', '🗺️', 'var(--grad2)', 'Приключение', 'Уровни, XP, квесты дня и достижения');
  if (!isKid(p)) h += mode('fasting', '⏳', 'linear-gradient(135deg,#A78BFA,#F472B6)', 'Интервальное голодание', 'Таймер окна еды и этапы',
    m.fasting ? `<div class="seg" style="margin-top:8px">${FAST.map(f => `<button class="${(m.fastH || 16) === f.h ? 'on' : ''}" data-action="fasth" data-v="${f.h}">${f.n}</button>`).join('')}</div>` : '');
  h += mode('voice', '🔊', 'linear-gradient(135deg,#3DDC97,#4FC3F7)', 'Голосовой тренер', 'Озвучивает упражнения и уровни');
  h += `<div class="mode"><div class="e" style="background:linear-gradient(135deg,#FFE066,#51CF66)">🧒</div><div class="grow"><b>Детский режим</b><div class="muted">Включается сам для профилей младше 14 лет: звёзды и радуга вместо калорий</div></div></div>`;
  h += `<h2>Ещё</h2>
    <button class="opt" data-action="profiles"><div class="e">👨‍👩‍👧</div><div class="grow"><b>Семья</b><div class="muted">${S.profiles.length} профил${S.profiles.length === 1 ? 'ь' : 'я'} · добавить или изменить</div></div></button>
    <button class="opt" data-action="reminders"><div class="e">⏰</div><div class="grow"><b>Напоминания</b><div class="muted">Еда, вода, тренировки, взвешивание</div></div></button>
    <button class="opt" data-action="settings"><div class="e">🤖</div><div class="grow"><b>ИИ (Gemini)</b><div class="muted">${S.settings.apiKey ? 'Ключ добавлен ✓' : 'Добавь бесплатный ключ'}</div></div></button>
    <button class="opt" data-action="backup"><div class="e">💾</div><div class="grow"><b>Резервная копия</b><div class="muted">Сохранить или перенести на другой телефон</div></div></button>
    <button class="opt" data-action="install"><div class="e">📲</div><div class="grow"><b>Установить на iPhone</b><div class="muted">Как добавить на экран «Домой»</div></div></button>
    <div class="muted" style="text-align:center;margin:20px 0">NSs Adventures ${VERSION} · данные хранятся только на этом телефоне<br>Оценки ИИ приблизительные и не заменяют врача</div>`;
  return h;
}

/* ---------- профили ---------- */
function profileForm(p = {}) {
  const em = p.emoji || EMOJIS[S.profiles.length % EMOJIS.length];
  return `<div class="emojis" id="pf-emoji">${EMOJIS.map(e => `<button type="button" class="${e === em ? 'on' : ''}" data-action="pick-emoji" data-v="${e}">${e}</button>`).join('')}</div>
    <label class="f"><span>Имя</span><input id="pf-name" value="${esc(p.name || '')}" placeholder="Например, Настя"></label>
    <div class="grid2"><label class="f"><span>Пол</span><select id="pf-sex"><option value="f" ${p.sex !== 'm' ? 'selected' : ''}>Женский</option><option value="m" ${p.sex === 'm' ? 'selected' : ''}>Мужской</option></select></label>
    <label class="f"><span>Возраст</span><input id="pf-age" type="number" inputmode="numeric" value="${p.age || ''}" placeholder="30"></label>
    <label class="f"><span>Рост, см</span><input id="pf-h" type="number" inputmode="numeric" value="${p.height || ''}" placeholder="170"></label>
    <label class="f"><span>Вес, кг</span><input id="pf-w" type="number" inputmode="decimal" step="0.1" value="${p.weight || ''}" placeholder="65"></label></div>
    <label class="f"><span>Активность</span><select id="pf-act">${ACTIVITY.map(a => `<option value="${a.v}" ${(p.activity || 1.375) == a.v ? 'selected' : ''}>${a.n}</option>`).join('')}</select></label>
    <label class="f"><span>Желаемый вес, кг (необязательно)</span><input id="pf-tw" type="number" inputmode="decimal" step="0.1" value="${p.targetWeight || ''}" placeholder="для прогноза"></label>
    <label class="f"><span>Цель</span><select id="pf-goal">${Object.entries(GOALS).map(([k, g]) => `<option value="${k}" ${(p.goal || 'lose') === k ? 'selected' : ''}>${g.e} ${g.n}</option>`).join('')}</select></label>`;
}
function readProfile(base = {}) {
  const v = id => $('#' + id).value.trim();
  const p = { ...base, emoji: $('#pf-emoji .on')?.dataset.v || '🦊', name: v('pf-name'), sex: v('pf-sex'), age: +v('pf-age'), height: +v('pf-h'),
    weight: +v('pf-w').replace(',', '.'), activity: +v('pf-act'), goal: v('pf-goal'), targetWeight: +v('pf-tw').replace(',', '.') || null };
  if (!p.name) return toast('Введи имя'), null;
  if (!(p.age > 2 && p.age < 110 && p.height > 60 && p.height < 250 && p.weight > 10 && p.weight < 350)) return toast('Проверь возраст, рост и вес'), null;
  return p;
}
function newProfile(p) {
  return { id: uid(), xp: 0, ach: [], fasts: 0, modes: { adventure: true, fasting: false, fastH: 16, voice: true }, ...p };
}
function onboardingHtml() {
  return `<div class="hero" style="padding-top:20px"><div class="avatar" style="width:84px;height:84px;font-size:46px;margin:0 auto;border-radius:28px">🧭</div>
    <h1 style="margin-top:16px">NSs Adventures</h1><div class="sub">Семейное приключение к здоровью: фото еды → калории, тренировки, квесты</div></div>
    <div class="card"><h3>Создай первого героя</h3>${profileForm()}<button class="btn primary block" style="margin-top:8px" data-action="onboard">Начать приключение 🚀</button></div>`;
}
function openProfiles() {
  sheet(`<h3>Семья</h3><div class="muted">Нажми на профиль, чтобы переключиться</div>
    ${S.profiles.map(q => `<div class="lb"><button class="row grow" style="text-align:left" data-action="switch" data-id="${q.id}"><div class="avatar sm">${q.emoji}</div>
      <div class="grow"><b>${esc(q.name)}</b> ${q.id === P().id ? '<span class="pill">сейчас</span>' : ''}<div class="muted">${q.age} лет · ${isKid(q) ? 'детский режим' : GOALS[q.goal].n}</div></div></button>
      <button class="iconbtn" data-action="edit-profile" data-id="${q.id}">✎</button></div>`).join('')}
    <button class="btn primary block" style="margin-top:12px" data-action="add-profile">+ Добавить члена семьи</button>`);
}
function editProfile(id) {
  const p = S.profiles.find(q => q.id === id);
  sheet(`<h3>${p ? 'Профиль' : 'Новый член семьи'}</h3>${profileForm(p)}
    <button class="btn primary block" data-action="save-profile" data-id="${id || ''}">Сохранить</button>
    ${p && S.profiles.length > 1 ? `<button class="btn danger block" style="margin-top:8px" data-action="del-profile" data-id="${id}">Удалить профиль</button>` : ''}`);
}

/* ---------- приёмы пищи ---------- */
function openMeal(id) {
  const m = day().meals.find(x => x.id === id); if (!m) return;
  const kid = isKid(P());
  sheet(`${m.photo ? `<img class="resimg" src="${m.photo}" style="max-height:200px">` : ''}<h3 style="margin-top:12px">${esc(m.name)}</h3>
    <div class="muted">${MEALS[m.type]} · ${m.time}${m.score ? ' · полезность ★' + m.score : ''}</div>
    <div class="card">${m.items.map(i => `<div class="row between" style="padding:6px 0"><div>${esc(i.name)} <span class="muted">${i.grams ? i.grams + ' г' : ''}</span></div>${kid ? '' : `<b>${r0(i.kcal)} ккал</b>`}</div>`).join('')}</div>
    ${m.tip ? `<div class="card"><div class="sub">💡 ${esc(m.tip)}</div></div>` : ''}
    <div class="grid2"><button class="btn" data-action="repeat-meal" data-id="${id}">↻ Повторить</button><button class="btn danger" data-action="del-meal" data-id="${id}">Удалить</button></div>`);
}
function manualFood() {
  sheet(`<h3>Ввести вручную</h3><label class="f"><span>Название</span><input id="mf-n" placeholder="Йогурт"></label>
    <div class="grid2"><label class="f"><span>Калории</span><input id="mf-k" type="number" inputmode="numeric"></label><label class="f"><span>Граммы</span><input id="mf-g" type="number" inputmode="numeric"></label>
    <label class="f"><span>Белки, г</span><input id="mf-p" type="number" inputmode="decimal"></label><label class="f"><span>Жиры, г</span><input id="mf-f" type="number" inputmode="decimal"></label></div>
    <label class="f"><span>Углеводы, г</span><input id="mf-c" type="number" inputmode="decimal"></label>
    <button class="btn primary block" data-action="save-manual">Добавить</button>`);
}

/* ---------- тренировка-плеер ---------- */
let PL = null;
function startWorkout(id) {
  const w = WORKOUTS.find(x => x.id === id);
  PL = { w, i: 0, left: w.ex[0][1], paused: false, startedAt: Date.now(), done: 0 };
  speak('Начинаем. ' + w.ex[0][0]);
  PL.timer = setInterval(tickWorkout, 1000);
  renderPlayer();
}
function tickWorkout() {
  if (!PL || PL.paused) return;
  PL.left--; PL.done++;
  if (PL.left <= 3 && PL.left > 0) beep(660, 90);
  if (PL.left <= 0) nextEx(); else renderPlayer(true);
}
function nextEx() {
  PL.i++; beep(990, 220);
  if (PL.i >= PL.w.ex.length) return finishWorkout();
  PL.left = PL.w.ex[PL.i][1]; speak(PL.w.ex[PL.i][0]); renderPlayer();
}
function renderPlayer(onlyTimer) {
  if (onlyTimer && $('#pl-t')) { $('#pl-t').textContent = `${Math.floor(PL.left / 60)}:${pad(PL.left % 60)}`; return; }
  const e = PL.w.ex[PL.i], nx = PL.w.ex[PL.i + 1];
  sheet(`<div class="row between"><button class="iconbtn" data-action="close-sheet">✕</button><b>${PL.w.e} ${PL.w.n}</b><span style="width:40px"></span></div>
    <div class="player"><div class="dots">${PL.w.ex.map((_, i) => `<i class="${i < PL.i ? 'd' : i === PL.i ? 'c' : ''}"></i>`).join('')}</div>
    <div style="font-size:64px;margin-top:20px">${e[0].startsWith('Отдых') ? '😮‍💨' : PL.w.e}</div><div class="now">${esc(e[0])}</div><div class="sub">${esc(e[2] || '')}</div>
    <div class="timer" id="pl-t" style="margin:24px 0">${Math.floor(PL.left / 60)}:${pad(PL.left % 60)}</div>
    <div class="muted">${nx ? 'Далее: ' + esc(nx[0]) : 'Последнее упражнение!'}</div>
    <div class="grid2" style="margin-top:30px"><button class="btn" data-action="pl-pause">${PL.paused ? '▶ Продолжить' : '❚❚ Пауза'}</button><button class="btn primary" data-action="pl-next">Дальше ⏭</button></div></div>`,
    { full: true, onClose: () => { if (PL) { clearInterval(PL.timer); if (PL.done > 60) logWorkout(PL.w.n, PL.w.e, PL.done / 60, PL.w.met); PL = null; render(); } } });
}
function finishWorkout() {
  const w = PL.w, min = PL.done / 60; clearInterval(PL.timer); PL = null;
  if (min < 1) { render(); return sheet(`<h3>Тренировка пропущена</h3><p class="sub">Чтобы она засчиталась, позанимайся хотя бы минуту 😉</p><button class="btn block" data-action="close-sheet">Ок</button>`); }
  const kc = logWorkout(w.n, w.e, min, w.met);
  speak('Тренировка завершена! Ты молодец!'); confetti();
  sheet(`<div class="hero"><div style="font-size:70px">🏆</div><h1>Готово!</h1><div class="sub">${w.n} · ${Math.round(min)} мин · −${kc} ккал</div></div>
    <button class="btn primary block" data-action="close-sheet">Супер</button>`);
}
function logWorkout(n, e, min, met) {
  const kc = r0(met * P().weight * min / 60);
  day().workouts.push({ id: uid(), n, e, min: Math.max(1, Math.round(min)), kcal: kc }); save();
  addXP(30, 'Тренировка'); checkQuests(); render(); return kc;
}

/* ---------- голодание ---------- */
function fastStart() { const p = P(); p.fast = { start: Date.now(), hours: p.modes.fastH || 16 }; save(); render(); toast('Голодание началось ⏳'); }
function fastStop() {
  const p = P(), f = p.fast; if (!f) return;
  const ok = (Date.now() - f.start) / 3600000 >= f.hours; p.fast = null;
  if (ok) { p.fasts = (p.fasts || 0) + 1; confetti(); addXP(40, 'Голодание выполнено'); checkAch(); }
  save(); render();
}

/* ---------- напоминания ---------- */
const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
function openReminders() {
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  sheet(`<h3>⏰ Напоминания</h3>
    <div class="card" style="margin-top:6px"><b>📅 Самый надёжный способ</b><div class="muted" style="margin:4px 0 10px">iPhone не даёт веб-приложениям будить телефон по расписанию. Добавь напоминания в Календарь — они будут приходить всегда, даже если приложение закрыто.</div>
    <button class="btn primary block" data-action="ics">Добавить в Календарь iPhone</button></div>
    ${perm !== 'granted' && perm !== 'unsupported' ? `<button class="btn block" data-action="notif">🔔 Разрешить уведомления (когда приложение открыто)</button>` : ''}
    ${S.reminders.map(r => `<div class="mode"><div class="e" style="background:var(--card2)">${r.e}</div><div class="grow"><b>${esc(r.t)}</b>
      <input value="${r.times.join(', ')}" data-rem-times="${r.id}" style="margin-top:6px;padding:8px 10px" placeholder="08:30, 13:00">
      <div class="muted" style="margin-top:4px">${r.days.length === 7 ? 'Каждый день' : r.days.map(d => WD[d]).join(', ')}</div></div>
      <button class="sw ${r.on ? 'on' : ''}" data-action="rem-toggle" data-id="${r.id}"></button></div>`).join('')}
    <button class="btn block" data-action="close-sheet">Готово</button>`);
}
function buildIcs() {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NSs Adventures//RU', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:NSs Adventures'];
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'], start = dkey(new Date(Date.now() + 864e5)).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  S.reminders.filter(r => r.on).forEach(r => r.times.forEach(t => {
    L.push('BEGIN:VEVENT', `UID:nss-${r.id}-${t.replace(':', '')}@nss`, `DTSTAMP:${stamp}`, `DTSTART:${start}T${t.replace(':', '')}00`, 'DURATION:PT5M',
      `RRULE:FREQ=WEEKLY;BYDAY=${r.days.map(d => BY[d]).join(',')}`, `SUMMARY:${r.e} ${r.t}`, 'DESCRIPTION:Открой NSs Adventures',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${r.t}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  }));
  L.push('END:VCALENDAR'); return L.join('\r\n');
}
async function exportIcs() {
  const ics = buildIcs(), file = new File([ics], 'nss-reminders.ics', { type: 'text/calendar' });
  const url = URL.createObjectURL(file);
  if (navigator.canShare?.({ files: [file] }) && !/iPhone|iPad/.test(navigator.userAgent)) { try { await navigator.share({ files: [file] }); return; } catch { } }
  const a = document.createElement('a'); a.href = url; a.download = 'nss-reminders.ics'; document.body.appendChild(a); a.click(); a.remove();
  toast('Открой файл и нажми «Добавить всё»');
}
function checkReminders() {
  const now = new Date(), t = hm(now), k = dkey();
  S.reminders.forEach(r => {
    if (!r.on || !r.days.includes(now.getDay()) || !r.times.includes(t)) return;
    const id = `${k}-${r.id}-${t}`; if (S.fired[id]) return;
    for (const f in S.fired) if (!f.startsWith(k)) delete S.fired[f];
    S.fired[id] = 1; save();
    toast(`${r.e} ${r.t}`); beep(880, 150);
    if ('Notification' in window && Notification.permission === 'granted')
      navigator.serviceWorker?.ready.then(reg => reg.showNotification('NSs Adventures', { body: `${r.e} ${r.t}`, icon: 'icons/icon-192.png', tag: r.id })).catch(() => { });
  });
}

/* ---------- настройки / бэкап ---------- */
function openSettings() {
  const s = S.settings;
  sheet(`<h3>🤖 ИИ — Google Gemini</h3>
    <div class="muted">Бесплатный ключ: открой <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> → «Create API key» → скопируй сюда. Бесплатного лимита хватает на всю семью. Ключ хранится только на этом телефоне.</div>
    <label class="f"><span>API-ключ</span><input id="st-key" value="${esc(s.apiKey)}" placeholder="AIza…" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    <label class="f"><span>Модель</span><input id="st-model" value="${esc(s.model)}" autocapitalize="off" spellcheck="false"></label>
    <label class="f"><span>Адрес API (можно указать свой прокси)</span><input id="st-ep" value="${esc(s.endpoint)}" autocapitalize="off" spellcheck="false"></label>
    <div class="muted" style="margin-bottom:12px">Если Gemini пишет «регион не поддерживается» — нужен VPN. Для пробы без ключа введи <b>demo</b>.</div>
    <div class="muted" style="margin-bottom:10px">Версия приложения ${VERSION}</div>
    <div class="grid2"><button class="btn" data-action="test-ai">Проверить</button><button class="btn primary" data-action="save-settings">Сохранить</button></div>`);
}
function saveSettingsFromForm() {
  S.settings.apiKey = $('#st-key').value.trim(); S.settings.model = $('#st-model').value.trim() || 'gemini-flash-latest';
  S.settings.endpoint = $('#st-ep').value.trim() || 'https://generativelanguage.googleapis.com'; save();
}
function openBackup() {
  sheet(`<h3>💾 Резервная копия</h3><div class="muted">Данные живут только на этом телефоне. Сохрани копию в «Файлы», чтобы не потерять, или перенеси на другой iPhone.</div>
    <div class="grid2" style="margin-top:14px"><button class="btn primary" data-action="export">Сохранить</button><button class="btn" data-action="import">Загрузить</button></div>
    <hr><button class="btn danger block" data-action="reset">Стереть всё</button>`);
}
function exportData() {
  const blob = new Blob([JSON.stringify({ ...S, settings: { ...S.settings, apiKey: '' } })], { type: 'application/json' });
  const f = new File([blob], `nss-backup-${dkey()}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [f] })) return navigator.share({ files: [f] }).catch(() => { });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = f.name; a.click();
}
function openInstall() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  sheet(`<h3>📲 Установка на iPhone</h3>${standalone ? '<div class="pill hot" style="margin:6px 0">Уже установлено ✓</div>' : ''}
    <div class="card"><b>1.</b> Открой эту страницу в <b>Safari</b><br><b>2.</b> Нажми кнопку «Поделиться» <span style="font-size:20px">⎋</span><br>
    <b>3.</b> Выбери «На экран “Домой”»<br><b>4.</b> Нажми «Добавить» — готово!</div>
    <div class="muted">У каждого члена семьи на своём iPhone свои данные. На одном телефоне можно вести несколько профилей.</div>
    <button class="btn block" style="margin-top:12px" data-action="close-sheet">Понятно</button>`);
}
async function coach() {
  const p = P(), d = day(), t = targets(p), x = totals(d);
  const sheetMsg = $('#app').querySelector('[data-action="coach"]'); if (sheetMsg) sheetMsg.innerHTML = '<span class="spin"></span>';
  const q = `Ты — дружелюбный тренер и нутрициолог семейного приложения NSs Adventures. Пиши по-русски, без markdown-заголовков, максимум 70 слов, 3–4 пункта с «•».
Человек: ${p.name}, ${p.age} лет, ${p.sex === 'm' ? 'муж' : 'жен'}, ${p.weight} кг, цель: ${isKid(p) ? 'здоровое питание ребёнка (не говори о калориях, только о еде и играх)' : GOALS[p.goal].n}.
Сейчас ${hm()}. Норма ${t.kcal} ккал, Б${t.protein}/Ж${t.fat}/У${t.carbs}. Съедено ${r0(x.kcal)} ккал, Б${r0(x.protein)}/Ж${r0(x.fat)}/У${r0(x.carbs)}. Вода ${d.water}/${t.water} мл.
Еда сегодня: ${d.meals.map(m => m.name).join(', ') || 'пока ничего'}. Тренировки: ${d.workouts.map(w => w.n + ' ' + w.min + 'мин').join(', ') || 'нет'}.
Дай: что съесть дальше (конкретно), одно упражнение или активность на сегодня с длительностью, и короткую мотивацию.`;
  try { const ans = await gemini([{ text: q }]); for (const c in S.coach) if (!c.endsWith(dkey())) delete S.coach[c]; S.coach[p.id + dkey()] = ans; save(); render(); } catch (e) { render(); aiError(e); }
}

/* ---------- обработчики ---------- */
document.addEventListener('click', e => {
  const tb = e.target.closest('[data-tab]');
  if (tb) { if (tb.dataset.tab === 'snap' && tab === 'snap') return $('#cam').click(); return go(tb.dataset.tab); }
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action, id = el.dataset.id, p = S.profiles.length ? P() : null;
  switch (a) {
    case 'close-sheet': closeSheet(); break;
    case 'cam': $('#cam').click(); break;
    case 'gal': $('#gal').click(); break;
    case 'pick-emoji': el.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on')); el.classList.add('on'); break;
    case 'onboard': { const np = readProfile(); if (!np) return; const pr = newProfile(np); S.profiles.push(pr); S.activeId = pr.id;
      S.weights[pr.id] = [{ date: dkey(), kg: pr.weight }]; save(); confetti(); render(); setTimeout(openSettings, 600); break; }
    case 'profiles': openProfiles(); break;
    case 'switch': S.activeId = id; save(); closeSheet(); render(); toast(`Привет, ${P().name}! ${P().emoji}`); break;
    case 'add-profile': editProfile(null); break;
    case 'edit-profile': editProfile(id); break;
    case 'save-profile': { const old = S.profiles.find(q => q.id === id); const np = readProfile(old); if (!np) return;
      if (old) { if (np.weight !== old.weight) (S.weights[old.id] ??= []).push({ date: dkey(), kg: np.weight }); Object.assign(old, np); }
      else { const pr = newProfile(np); S.profiles.push(pr); S.weights[pr.id] = [{ date: dkey(), kg: pr.weight }]; }
      save(); closeSheet(); render(); break; }
    case 'del-profile': if (confirm('Удалить профиль и все его записи?')) { S.profiles = S.profiles.filter(q => q.id !== id); delete S.days[id]; delete S.weights[id];
      S.activeId = S.profiles[0].id; save(); closeSheet(); render(); } break;
    case 'water': { const d = day(), n = +el.dataset.n, cur = Math.floor(d.water / 250); d.water = (n < cur ? n : n + 1) * 250; save(); beep(1200, 60);
      if (d.water >= targets(p).water && !d.quests.includes('_water')) { d.quests.push('_water'); addXP(20, 'Норма воды!'); } checkQuests(); render(); break; }
    case 'meal': openMeal(id); break;
    case 'del-meal': { const d = day(); d.meals = d.meals.filter(m => m.id !== id); save(); closeSheet(); render(); break; }
    case 'repeat-meal': { const m = day().meals.find(x => x.id === id); day().meals.push({ ...m, id: uid(), time: hm(), type: guessMeal(), items: m.items.map(i => ({ ...i })) });
      save(); closeSheet(); addXP(10, 'Запись еды'); checkQuests(); render(); break; }
    case 'rm-item': pending.items.splice(+el.dataset.n, 1); if (!pending.items.length) { pending = null; closeSheet(); } else renderResult(); break;
    case 'mtype': pending.type = el.dataset.v; renderResult(); break;
    case 'add-pending': addPending(); break;
    case 'text-food': sheet(`<h3>✍️ Что съел(а)?</h3><textarea id="tf" rows="3" placeholder="Тарелка борща со сметаной, 2 куска чёрного хлеба"></textarea>
      <button class="btn primary block" style="margin-top:12px" data-action="text-go">Посчитать</button>`); setTimeout(() => $('#tf')?.focus(), 300); break;
    case 'text-go': { const t = $('#tf').value.trim(); if (t) analyzeText(t); break; }
    case 'manual-food': manualFood(); break;
    case 'save-manual': { const v = i => +($('#' + i).value.replace(',', '.')) || 0, n = $('#mf-n').value.trim() || 'Продукт';
      if (!v('mf-k')) return toast('Укажи калории');
      day().meals.push({ id: uid(), type: guessMeal(), time: hm(), name: n, items: [{ name: n, grams: v('mf-g'), kcal: v('mf-k'), protein: v('mf-p'), fat: v('mf-f'), carbs: v('mf-c') }] });
      save(); closeSheet(); go('today'); addXP(10, 'Запись еды'); checkQuests(); render(); break; }
    case 'workout': startWorkout(id); break;
    case 'pl-pause': PL.paused = !PL.paused; renderPlayer(); break;
    case 'pl-next': nextEx(); break;
    case 'act': { const ac = ACTS.find(x => x.id === id);
      sheet(`<h3>${ac.e} ${ac.n}</h3><label class="f"><span>Сколько минут?</span><input id="am" type="number" inputmode="numeric" value="30"></label>
        <button class="btn primary block" data-action="act-save" data-id="${id}">Записать</button>`); break; }
    case 'act-save': { const ac = ACTS.find(x => x.id === id), mn = +$('#am').value; if (!mn) return; closeSheet(); const kc = logWorkout(ac.n, ac.e, mn, ac.met); toast(`−${kc} ккал 🔥`); break; }
    case 'weigh': sheet(`<h3>⚖️ Вес сегодня</h3><input id="wk" type="number" inputmode="decimal" step="0.1" value="${p.weight}">
      <button class="btn primary block" style="margin-top:12px" data-action="weigh-save">Сохранить</button>`); break;
    case 'weigh-save': { const kg = +$('#wk').value.replace(',', '.'); if (!(kg > 10)) return; const ws = (S.weights[p.id] ??= []);
      const ex = ws.find(w => w.date === dkey()); ex ? ex.kg = kg : ws.push({ date: dkey(), kg }); p.weight = kg; save(); closeSheet(); addXP(10, 'Взвешивание'); render(); break; }
    case 'mode': p.modes[el.dataset.k] = !p.modes[el.dataset.k]; if (el.dataset.k === 'voice') S.settings.voice = p.modes.voice; save(); render(); break;
    case 'fasth': p.modes.fastH = +el.dataset.v; save(); render(); break;
    case 'goal': p.goal = el.dataset.v; save(); render(); toast(`Цель: ${GOALS[p.goal].n}`); break;
    case 'fast-start': fastStart(); break;
    case 'fast-stop': fastStop(); break;
    case 'reminders': openReminders(); break;
    case 'rem-toggle': { const r = S.reminders.find(x => x.id === id); r.on = !r.on; save(); el.classList.toggle('on', r.on); break; }
    case 'ics': exportIcs(); break;
    case 'notif': Notification.requestPermission().then(() => openReminders()); break;
    case 'settings': openSettings(); break;
    case 'save-settings': saveSettingsFromForm(); closeSheet(); render(); toast('Сохранено ✓'); break;
    case 'test-ai': saveSettingsFromForm(); el.innerHTML = '<span class="spin"></span>';
      gemini([{ text: 'Ответь одним словом: работает' }]).then(t => { toast('Gemini отвечает: ' + t.slice(0, 40)); el.textContent = 'Проверить ✓'; })
        .catch(e2 => { el.textContent = 'Проверить'; aiError(e2); }); break;
    case 'backup': openBackup(); break;
    case 'export': exportData(); break;
    case 'import': $('#imp').click(); break;
    case 'reset': if (confirm('Точно стереть все данные всех профилей?')) { localStorage.removeItem(KEY); location.reload(); } break;
    case 'install': openInstall(); break;
    case 'coach': coach(); break;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.grams !== undefined && pending) {
    const i = pending.items[+t.dataset.grams], g = Math.max(0, +t.value || 0), k = i.base.grams ? g / i.base.grams : 0;
    Object.assign(i, { grams: g, kcal: i.base.kcal * k, protein: i.base.protein * k, fat: i.base.fat * k, carbs: i.base.carbs * k }); renderResult();
  }
  if (t.dataset.remTimes) {
    const r = S.reminders.find(x => x.id === t.dataset.remTimes);
    const ts = t.value.split(/[,\s;]+/).map(s => s.trim().replace('.', ':')).filter(s => /^\d{1,2}:\d{2}$/.test(s)).map(s => s.padStart(5, '0'));
    if (ts.length) { r.times = ts; save(); t.value = ts.join(', '); } else toast('Формат времени: 08:30, 13:00');
  }
});
['cam', 'gal'].forEach(id => $('#' + id).addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) analyzePhoto(f); }));
$('#imp').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (!Array.isArray(d.profiles)) throw 0; const key = S.settings.apiKey;
    S = Object.assign(fresh(), d); S.settings.apiKey ||= key; save(); closeSheet(); render(); toast('Данные загружены ✓'); }
  catch { toast('Это не файл копии NSs'); }
});

/* ---------- старт ---------- */
if ('serviceWorker' in navigator) {
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => { });
  // пришла новая версия — один раз перезагружаемся, чтобы сразу её показать
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW && !sessionStorage.nssReloaded) { sessionStorage.nssReloaded = 1; location.reload(); } });
}
render();
setInterval(() => { checkReminders(); if (tab === 'today' && P()?.fast && !$('.sheet')) render(); }, 30000);
checkReminders();
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.profiles.length) { checkReminders(); if (!$('.sheet')) render(); } });
