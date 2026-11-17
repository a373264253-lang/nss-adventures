'use strict';
/* NSs Adventures — штрихкоды, «Что приготовить?», меню на неделю, покупки, прогноз веса, отчёт недели.
   Подключается после app.js и пользуется его глобальными функциями (S, P, sheet, gemini…). */

S.shop ??= []; S.plan ??= null; S.reports ??= {}; S.products ??= {};

const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const SHOP_CATS = ['Овощи и фрукты', 'Мясо и рыба', 'Молочное и яйца', 'Крупы, хлеб, макароны', 'Бакалея', 'Напитки', 'Другое'];
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const WDS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.ZXing) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => { s.remove(); rej(new Error('Не удалось загрузить сканер — проверь интернет')); };
    document.head.appendChild(s);
  });
}
function pickPhoto(capture) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.hidden = true;
    if (capture) i.setAttribute('capture', 'environment');
    i.onchange = () => { res(i.files[0] || null); i.remove(); };
    document.body.appendChild(i); i.click();
  });
}
function mealSeg(cur, action) {
  return Object.entries(MEALS).map(([k, v]) => `<button class="${cur === k ? 'on' : ''}" data-action="${action}" data-v="${k}">${v.split(' ')[0]}</button>`).join('');
}
function familyLine() {
  return S.profiles.map(q => `${q.name} (${q.age} лет, ${isKid(q) ? 'ребёнок' : GOALS[q.goal].n.toLowerCase()}, норма ~${targets(q).kcal} ккал)`).join('; ');
}
function logMeal(m) {
  day().meals.push({ id: uid(), time: hm(), type: guessMeal(), ...m });
  save(); addXP(10, 'Запись еды'); checkQuests(); render();
}

/* ================= 1. Штрихкоды ================= */
let scanReader = null, curProduct = null;
async function openScanner() {
  sheet(`<div class="row between"><button class="iconbtn" data-action="close-sheet">✕</button><b>Сканер штрихкода</b><span style="width:40px"></span></div>
    <div class="scanbox"><video id="sc-v" playsinline muted autoplay></video><div class="scanline"></div></div>
    <div class="muted" id="sc-st" style="text-align:center;margin:10px 0">Наведи камеру на штрихкод упаковки</div>
    <div class="row"><input id="sc-code" inputmode="numeric" placeholder="или введи цифры штрихкода"><button class="btn primary" data-action="bc-go">Найти</button></div>
    <button class="opt" data-action="bc-photo"><div class="e">📷</div><div><b>Сфоткать штрихкод</b><div class="muted">если камера в окне не включилась</div></div></button>`,
    { full: true, onClose: stopScanner });
  try {
    await loadScript(ZXING_URL);
    if (!$('#sc-v')) return;
    const F = ZXing.BarcodeFormat, hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E]);
    scanReader = new ZXing.BrowserMultiFormatReader(hints);
    await scanReader.decodeFromConstraints({ video: { facingMode: 'environment' } }, 'sc-v', res => {
      if (!res || !scanReader) return;
      stopScanner(); beep(1300, 90); navigator.vibrate?.(40); lookupBarcode(res.getText());
    });
  } catch (e) {
    const st = $('#sc-st'); if (st) st.textContent = 'Камера недоступна — введи цифры или сфоткай штрихкод';
  }
}
function stopScanner() { try { scanReader?.reset(); } catch { } scanReader = null; }
async function barcodeFromPhoto() {
  const f = await pickPhoto(true); if (!f) return;
  try {
    await loadScript(ZXING_URL);
    const r = await new ZXing.BrowserMultiFormatReader().decodeFromImageUrl(URL.createObjectURL(f));
    stopScanner(); lookupBarcode(r.getText());
  } catch { toast('Штрихкод не распознан — введи цифры'); }
}
async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, '');
  if (code.length < 8) return toast('Проверь цифры штрихкода');
  if (S.products[code]) return productSheet(S.products[code]);
  sheet(`<h3>Ищу продукт…</h3><div class="row"><span class="spin"></span><span class="sub">${code}</span></div>`);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_ru,generic_name,brands,nutriments,serving_quantity,image_front_small_url`);
    const j = await r.json(), pr = j.product, n = pr?.nutriments;
    const kcal = n?.['energy-kcal_100g'] ?? (n?.energy_100g ? n.energy_100g / 4.184 : null);
    if (j.status !== 1 || kcal == null) return notFound(code);
    const item = { code, name: pr.product_name_ru || pr.product_name || pr.generic_name || 'Продукт', brand: (pr.brands || '').split(',')[0].trim(),
      img: pr.image_front_small_url || '', serving: +pr.serving_quantity || 100,
      per: { kcal: +kcal, protein: +n.proteins_100g || 0, fat: +n.fat_100g || 0, carbs: +n.carbohydrates_100g || 0 } };
    S.products[code] = item; save(); productSheet(item);
  } catch { notFound(code, true); }
}
function notFound(code, net) {
  sheet(`<h3>${net ? 'Нет связи с базой продуктов' : 'Этого продукта нет в базе'} 🤔</h3>
    <p class="sub">Сфоткай упаковку там, где написана пищевая ценность — ИИ прочитает КБЖУ и запомнит продукт.</p>
    <button class="btn primary block" data-action="label-photo" data-code="${code || ''}">📷 Сфоткать этикетку</button>
    <button class="btn block" style="margin-top:8px" data-action="manual-food">Ввести вручную</button>`);
}
const LABEL_SCHEMA = { type: 'OBJECT', properties: { name: { type: 'STRING' }, brand: { type: 'STRING' }, kcal: { type: 'NUMBER' }, protein: { type: 'NUMBER' },
  fat: { type: 'NUMBER' }, carbs: { type: 'NUMBER' }, serving: { type: 'NUMBER' } }, required: ['name', 'kcal', 'protein', 'fat', 'carbs', 'serving'] };
async function labelPhoto(code) {
  const f = await pickPhoto(true); if (!f) return;
  const img = await loadImg(f), big = shrink(img, 1400, .85);
  sheet(`<h3>Читаю этикетку…</h3><div class="scan"><img src="${big}"></div><div class="row"><span class="spin"></span><span class="sub">ИИ ищет пищевую ценность</span></div>`);
  try {
    const r = await gemini([{ text: 'На фото упаковка продукта. Прочитай пищевую ценность НА 100 г (если указана на порцию — пересчитай на 100 г). name — короткое название по-русски, brand — бренд. serving — вес упаковки или порции в граммах, если виден, иначе 100.' },
      { inline_data: { mime_type: 'image/jpeg', data: big.split(',')[1] } }], LABEL_SCHEMA);
    const item = { code, name: r.name, brand: r.brand || '', img: square(img, 200), serving: r.serving || 100, per: { kcal: r.kcal, protein: r.protein, fat: r.fat, carbs: r.carbs } };
    if (code) { S.products[code] = item; save(); }
    productSheet(item);
  } catch (e) { aiError(e); }
}
function productSheet(pr) {
  curProduct = { ...pr, type: guessMeal() };
  const g = r0(pr.serving) || 100, quick = [...new Set([50, 100, g, 200])].slice(0, 4);
  sheet(`<div class="row">${pr.img ? `<img class="thumb" src="${esc(pr.img)}">` : '<div class="thumb">🏷️</div>'}<div class="grow"><h3>${esc(pr.name)}</h3>
      <div class="muted">${esc(pr.brand)}${pr.brand ? ' · ' : ''}на 100 г: ${r0(pr.per.kcal)} ккал · Б ${r0(pr.per.protein)} · Ж ${r0(pr.per.fat)} · У ${r0(pr.per.carbs)}</div></div></div>
    <label class="f" style="margin-top:14px"><span>Сколько граммов съел(а)?</span><input id="pg" type="number" inputmode="numeric" value="${g}"></label>
    <div class="row" style="flex-wrap:wrap">${quick.map(v => `<button class="btn sm" data-action="pg-set" data-v="${v}">${v} г</button>`).join('')}</div>
    <div class="card" id="pcalc"></div>
    <div class="seg" style="margin:12px 0">${mealSeg(curProduct.type, 'pm-type')}</div>
    <button class="btn primary block" data-action="product-add">Добавить в дневник</button>`);
  updProduct();
}
function updProduct() {
  const g = +$('#pg')?.value || 0, k = g / 100, pr = curProduct;
  const v = { kcal: pr.per.kcal * k, protein: pr.per.protein * k, fat: pr.per.fat * k, carbs: pr.per.carbs * k };
  curProduct.calc = { grams: g, ...v };
  if ($('#pcalc')) $('#pcalc').innerHTML = `<div class="row between"><div class="macrorow" style="margin:0;flex:1">
    <div><div class="k">Белки</div><div class="v" style="color:var(--blue)">${r0(v.protein)} г</div></div><div><div class="k">Жиры</div><div class="v" style="color:var(--amber)">${r0(v.fat)} г</div></div>
    <div><div class="k">Углеводы</div><div class="v" style="color:var(--violet)">${r0(v.carbs)} г</div></div></div><div style="text-align:right"><div style="font-size:28px;font-weight:850">${r0(v.kcal)}</div><div class="muted">ккал</div></div></div>`;
}
function addProduct() {
  const pr = curProduct, c = pr.calc; if (!c.grams) return toast('Укажи граммы');
  const name = pr.brand ? `${pr.name} (${pr.brand})` : pr.name;
  day().meals.push({ id: uid(), type: pr.type, time: hm(), name, photo: pr.img && pr.img.startsWith('data:') ? pr.img : undefined, barcode: pr.code,
    items: [{ name: pr.name, grams: c.grams, kcal: r0(c.kcal), protein: r0(c.protein), fat: r0(c.fat), carbs: r0(c.carbs) }] });
  curProduct = null; save(); closeSheet(); go('today'); addXP(10, 'Запись по штрихкоду'); checkQuests(); render();
}

/* ================= 2. Что приготовить? ================= */
const RECIPE_SCHEMA = { type: 'OBJECT', properties: {
  seen: { type: 'ARRAY', items: { type: 'STRING' } },
  recipes: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    name: { type: 'STRING' }, minutes: { type: 'INTEGER' }, servings: { type: 'INTEGER' }, kcal: { type: 'NUMBER' }, protein: { type: 'NUMBER' }, fat: { type: 'NUMBER' }, carbs: { type: 'NUMBER' },
    why: { type: 'STRING' }, steps: { type: 'ARRAY', items: { type: 'STRING' } },
    ingredients: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, qty: { type: 'STRING' }, have: { type: 'BOOLEAN' } }, required: ['name', 'qty', 'have'] } } },
    required: ['name', 'minutes', 'servings', 'kcal', 'protein', 'fat', 'carbs', 'why', 'steps', 'ingredients'] } } },
  required: ['seen', 'recipes'] };
let lastRecipes = S.recipes || [];
function openCook() {
  sheet(`<h3>👩‍🍳 Что приготовить?</h3><div class="muted">Сфоткай холодильник или перечисли продукты — ИИ подберёт рецепты под цель и остаток калорий на сегодня.</div>
    <div class="seg" style="margin:14px 0" id="ck-m">${[['any', 'Любое'], ['quick', '≤ 20 мин'], ['kids', 'Детям'], ['light', 'Лёгкое'], ['protein', 'Белковое']]
      .map(([k, n], i) => `<button class="${i ? '' : 'on'}" data-action="seg-pick" data-v="${k}">${n}</button>`).join('')}</div>
    <div class="grid2"><button class="btn primary" data-action="cook-photo" data-cap="1">📸 Холодильник</button><button class="btn" data-action="cook-photo">🖼️ Из галереи</button></div>
    <textarea id="ck-t" rows="3" style="margin-top:12px" placeholder="Или напиши: курица, рис, помидоры, яйца, сыр"></textarea>
    <button class="btn block" style="margin-top:10px" data-action="cook-text">Подобрать по списку</button>
    ${lastRecipes.length ? `<button class="btn block" style="margin-top:8px" data-action="cook-last">Показать прошлые рецепты</button>` : ''}`);
}
const COOK_MODES = { any: '', quick: 'Только блюда до 20 минут.', kids: 'Блюда, которые любят дети, без острого.', light: 'Лёгкие, низкокалорийные блюда.', protein: 'Блюда с высоким содержанием белка.' };
async function cookGo(text, imgData) {
  const p = P(), t = targets(p), x = totals(day()), left = Math.max(0, r0(t.kcal + x.burned - x.kcal));
  const mode = $('#ck-m .on')?.dataset.v || 'any';
  sheet(`<h3>Подбираю рецепты…</h3>${imgData ? `<div class="scan"><img src="${imgData}"></div>` : ''}<div class="row"><span class="spin"></span><span class="sub">Шеф-повар думает</span></div>`);
  const prompt = `Ты — шеф-повар и нутрициолог семейного приложения. ${imgData ? 'На фото — продукты (холодильник/полка). Перечисли в seen, что видишь.' : 'Продукты в наличии: ' + text + '. В seen повтори их списком.'}
Предложи 3 разных домашних рецепта, в основном из этих продуктов (соль, масло, специи есть всегда). Недостающее отметь have=false.
Для кого: ${p.name}, цель «${isKid(p) ? 'здоровое питание ребёнка' : GOALS[p.goal].n}», на сегодня осталось ~${left} ккал. Семья: ${familyLine()}.
${COOK_MODES[mode]} kcal/protein/fat/carbs — на 1 порцию. steps — 4–7 коротких шагов. why — почему подходит (до 15 слов). Всё по-русски.`;
  const parts = [{ text: prompt }];
  if (imgData) parts.push({ inline_data: { mime_type: 'image/jpeg', data: imgData.split(',')[1] } });
  try { const r = await gemini(parts, RECIPE_SCHEMA); lastRecipes = S.recipes = r.recipes || []; save(); showRecipes(r.seen); } catch (e) { aiError(e); }
}
function showRecipes(seen) {
  if (!lastRecipes.length) return sheet(`<h3>Не получилось подобрать 🤔</h3><p class="sub">Попробуй другое фото или напиши продукты списком.</p><button class="btn block" data-action="cook">Ещё раз</button>`);
  const kid = isKid(P());
  sheet(`<h3>👩‍🍳 Рецепты для тебя</h3>${seen?.length ? `<div class="muted">Вижу: ${esc(seen.join(', '))}</div>` : ''}
    ${lastRecipes.map((r, n) => {
      const miss = r.ingredients.filter(i => !i.have);
      return `<details class="card rc"${n ? '' : ' open'}><summary><div class="row between"><div class="grow"><b style="font-size:17px">${esc(r.name)}</b>
        <div class="muted">⏱ ${r.minutes} мин · ${r.servings} порц.${kid ? '' : ` · ${r0(r.kcal)} ккал/порц.`}${miss.length ? ` · нужно докупить: ${miss.length}` : ' · всё есть ✓'}</div></div><span class="muted arr">▾</span></div></summary>
        <div class="sub" style="margin:10px 0">💡 ${esc(r.why)}</div>
        ${kid ? '' : `<div class="muted">Б ${r0(r.protein)} · Ж ${r0(r.fat)} · У ${r0(r.carbs)} г на порцию</div>`}
        <div class="mtype">Ингредиенты</div>${r.ingredients.map(i => `<div class="row" style="padding:3px 0"><span>${i.have ? '✅' : '🛒'}</span><span class="grow">${esc(i.name)}</span><span class="muted">${esc(i.qty)}</span></div>`).join('')}
        <div class="mtype">Как готовить</div><ol style="margin:6px 0 12px;padding-left:20px">${r.steps.map(s => `<li style="margin:5px 0">${esc(s)}</li>`).join('')}</ol>
        <div class="grid2"><button class="btn primary sm" data-action="rc-eat" data-n="${n}">🍽️ Съел порцию</button>
        <button class="btn sm" data-action="rc-shop" data-n="${n}" ${miss.length ? '' : 'disabled style="opacity:.4"'}>🛒 Докупить</button></div></details>`;
    }).join('')}
    <button class="btn block" data-action="cook">Подобрать заново</button>`);
}

/* ================= 3. Меню на неделю + покупки ================= */
const PLAN_SCHEMA = { type: 'OBJECT', properties: {
  days: { type: 'ARRAY', items: { type: 'OBJECT', properties: { meals: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    type: { type: 'STRING', enum: Object.keys(MEALS) }, name: { type: 'STRING' }, kcal: { type: 'NUMBER' }, protein: { type: 'NUMBER' }, fat: { type: 'NUMBER' }, carbs: { type: 'NUMBER' } },
    required: ['type', 'name', 'kcal', 'protein', 'fat', 'carbs'] } } }, required: ['meals'] } },
  shopping: { type: 'ARRAY', items: { type: 'OBJECT', properties: { cat: { type: 'STRING', enum: SHOP_CATS }, name: { type: 'STRING' }, qty: { type: 'STRING' } }, required: ['cat', 'name', 'qty'] } },
  tip: { type: 'STRING' } }, required: ['days', 'shopping', 'tip'] };
let planDay = 0;
function planIndex() { return S.plan ? daysBetween(S.plan.start, dkey()) : -1; }
function openPlan() {
  if (!S.plan) return planForm();
  const i0 = planIndex(); if (planDay < 0 || planDay > 6) planDay = 0;
  const d = S.plan.days[planDay], kid = isKid(P()), sum = d ? d.meals.reduce((a, m) => a + m.kcal, 0) : 0;
  sheet(`<div class="row between"><h3>🗓️ Меню на неделю</h3><button class="btn sm" data-action="shop">🛒 Покупки (${S.shop.filter(s => !s.done).length})</button></div>
    ${i0 > 6 ? `<div class="card"><b>Неделя закончилась</b><div class="muted">Составим новое меню?</div><button class="btn primary sm" style="margin-top:8px" data-action="plan-new">Новое меню</button></div>` : ''}
    <div class="seg" style="margin:12px 0">${S.plan.days.map((_, i) => { const dk = addDays(S.plan.start, i); return `<button class="${i === planDay ? 'on' : ''}" data-action="plan-day" data-v="${i}">${i === i0 ? '•' : ''}${WDS[new Date(dk + 'T12:00').getDay()]}</button>`; }).join('')}</div>
    ${d && !kid && Math.abs(sum - targets(P()).kcal) > targets(P()).kcal * 0.15 ? `<div class="card"><div class="sub">⚠️ В этом дне ${r0(sum)} ккал при норме ${targets(P()).kcal}. Нажми на блюдо и замени его кнопкой 🔄.</div></div>` : ''}
    <div class="card">${d ? d.meals.map((m, mi) => `<div class="meal"><div class="thumb">${MEALS[m.type]?.split(' ')[0] || '🍽️'}</div><div class="grow" role="button" style="cursor:pointer" data-action="plan-meal" data-d="${planDay}" data-m="${mi}"><b>${esc(m.name)}</b>
      <div class="muted">${MEALS[m.type]?.split(' ')[1] || ''}${kid ? '' : ` · ${r0(m.kcal)} ккал · Б${r0(m.protein)} Ж${r0(m.fat)} У${r0(m.carbs)}`}</div></div>
      <div class="muted" style="margin-top:2px;color:var(--amber)">📖 рецепт · 🔄 замена</div></div>
      <button class="btn sm" data-action="plan-eat" data-d="${planDay}" data-m="${mi}">${isEaten(planDay, mi) ? '✓' : 'Съел'}</button></div>`).join('') : '<div class="empty">Нет данных</div>'}
      ${kid ? '' : `<div class="muted" style="margin-top:8px">Итого за день: ${r0(sum)} ккал (норма ${targets(P()).kcal})</div>`}</div>
    ${S.plan.tip ? `<div class="card"><div class="sub">💡 ${esc(S.plan.tip)}</div></div>` : ''}
    <button class="btn block" data-action="plan-new">Составить новое меню</button>`);
}
const eatKey = (d, m) => `${S.plan.start}-${d}-${m}-${P().id}`;
const isEaten = (d, m) => (S.plan.eaten || []).includes(eatKey(d, m));
function planForm() {
  sheet(`<h3>🗓️ Меню на неделю</h3><div class="muted">ИИ составит меню на 7 дней для всей семьи с учётом целей каждого и соберёт общий список покупок.</div>
    <div class="card"><b>Семья:</b><div class="muted">${esc(familyLine())}</div></div>
    <label class="f"><span>Пожелания (необязательно)</span><textarea id="pl-p" rows="3" placeholder="Не едим рыбу. Бюджетно. Завтраки быстрые. Саша не любит лук.">${esc(S.plan?.prefs || '')}</textarea></label>
    <button class="btn primary block" data-action="plan-go">Составить меню ✨</button><div class="muted" style="text-align:center;margin-top:8px">Займёт 20–40 секунд</div>`);
}
async function planGo(prefs) {
  const p = P(), t = targets(p);
  sheet(`<h3>Составляю меню…</h3><div class="row"><span class="spin"></span><span class="sub">Планирую 7 дней и список покупок. Это займёт до минуты.</span></div>`);
  const prompt = `Ты — диетолог семьи. Составь меню на 7 дней, начиная с сегодняшнего дня (${WDS[new Date().getDay()]}). Простая домашняя еда из обычного российского магазина, повторяй ингредиенты между днями, чтобы покупок было меньше. В каждом дне: breakfast, lunch, dinner, snack.
Калории и БЖУ указывай для порции человека: ${p.name}, цель «${isKid(p) ? 'здоровое питание ребёнка' : GOALS[p.goal].n}», норма ${t.kcal} ккал (Б${t.protein}/Ж${t.fat}/У${t.carbs}); сумма калорий за день — в пределах ±5% от нормы, белок не меньше ${t.protein} г.
${['lose', 'cut'].includes(p.goal) && !isKid(p) ? 'Цель — похудение без голода: много белка и клетчатки, овощи в каждом обеде и ужине, сложные углеводы утром и днём, лёгкий ужин, перекусы до 200 ккал, без сладких напитков и выпечки. Порции сытные за счёт овощей.' : ''}
Не повторяй одно блюдо чаще 2 раз за неделю. Используй готовку впрок: то, что приготовлено на ужин, может пойти в обед следующего дня.
Семья, для которой готовим: ${familyLine()}.
${prefs ? 'Пожелания: ' + prefs : ''}
shopping — общий список покупок на неделю на всю семью. КАЖДЫЙ продукт строго ОДИН раз (сложи количество за всю неделю), название — коротко, в именительном падеже, без уточнений в скобках («Куриное филе», «Яйца», «Помидоры»). Количество только в единицах кг, г, л, мл или шт (например «1,5 кг», «10 шт»). Соль, специи и воду не включай. tip — один совет по готовке впрок (до 25 слов). Всё по-русски.`;
  try {
    const r = await gemini([{ text: prompt }], PLAN_SCHEMA);
    S.plan = { start: dkey(), days: (r.days || []).slice(0, 7), tip: r.tip, prefs, eaten: [] };
    S.shop = S.shop.filter(s => s.done || !s.plan); // некупленное из старого меню больше не нужно
    addShop((r.shopping || []).map(s => ({ ...s })), true);
    planDay = 0; save(); toast('Меню готово! 🎉'); addXP(20, 'Меню на неделю'); openPlan(); render();
  } catch (e) { aiError(e); }
}
/* Один продукт — одна строка: «Филе куриное» = «Куриное филе», «Яйцо» = «Яйца», «Томаты» = «Помидоры». */
const SHOP_SYN = [[/(томат|помидор)\S*/g, 'помид'], [/(картош|картоф)\S*/g, 'картоф'], [/кур(иц|ин|ят)\S*/g, 'кур'], [/говя\S*/g, 'говяд'], [/свин\S*/g, 'свин'],
  [/огур\S*/g, 'огур'], [/морко\S*/g, 'морк'], [/(зелен|укроп|петрушк)\S*/g, 'зелен'], [/(^|\s)(свеж|охлажд|замор|репчат|отборн)\S*/g, ' ']];
function shopKey(name) {
  let s = String(name).toLowerCase().replace(/ё/g, 'е').replace(/\(.*?\)/g, ' ').replace(/[^а-яa-z\s]/g, ' ');
  for (const [re, to] of SHOP_SYN) s = s.replace(re, to);
  if (/яйц|яиц/.test(s)) return 'яйц';
  return s.split(/\s+/).filter(w => w.length > 1).map(w => w.slice(0, 5)).sort().join(' ');
}
function parseQty(q) {
  const m = String(q || '').replace(',', '.').match(/^\s*~?(\d+(?:\.\d+)?)\s*(кг|гр|г|л|мл|шт)?\.?\s*$/i);
  if (!m) return null;
  let n = +m[1], u = (m[2] || 'шт').toLowerCase();
  if (u === 'кг') { n *= 1000; u = 'г'; } if (u === 'гр') u = 'г'; if (u === 'л') { n *= 1000; u = 'мл'; }
  return { n, u };
}
function fmtQty({ n, u }) {
  const f = x => String(Math.round(x * 100) / 100).replace('.', ',');
  if (u === 'г') return n >= 1000 ? f(n / 1000) + ' кг' : f(n) + ' г';
  if (u === 'мл') return n >= 1000 ? f(n / 1000) + ' л' : f(n) + ' мл';
  return f(n) + ' шт';
}
function mergeQty(a, b) {
  if (!a) return b || ''; if (!b) return a;
  const pa = parseQty(a), pb = parseQty(b);
  if (pa && pb && pa.u === pb.u) return fmtQty({ n: pa.n + pb.n, u: pa.u });
  return a.includes(b) ? a : a + ' + ' + b;
}
function addShop(items, fromPlan) {
  let n = 0;
  items.forEach(it => {
    const name = String(it.name || '').replace(/\s*\(.*?\)\s*/g, ' ').trim(); if (!name) return;
    const key = shopKey(name), cat = SHOP_CATS.includes(it.cat) ? it.cat : 'Другое';
    const ex = S.shop.find(s => !s.done && shopKey(s.name) === key);
    if (ex) { ex.qty = mergeQty(ex.qty, it.qty || ''); if (ex.cat === 'Другое' && cat !== 'Другое') ex.cat = cat; if (fromPlan) ex.plan = true; return; }
    S.shop.push({ id: uid(), name: name[0].toUpperCase() + name.slice(1), qty: it.qty || '', cat, done: false, plan: !!fromPlan }); n++;
  });
  save(); return n;
}
function dedupeShop() {
  const old = S.shop || []; if (!old.length) return;
  S.shop = old.filter(s => s.done);
  addShop(old.filter(s => !s.done).map(s => ({ name: s.name, qty: s.qty, cat: s.cat })), false);
  old.filter(s => !s.done && s.plan).forEach(s => { const x = S.shop.find(y => !y.done && shopKey(y.name) === shopKey(s.name)); if (x) x.plan = true; });
  save();
}
function openShop() {
  const left = S.shop.filter(s => !s.done).length;
  const groups = SHOP_CATS.map(c => [c, S.shop.filter(s => s.cat === c)]).filter(g => g[1].length);
  sheet(`<div class="row between"><h3>🛒 Список покупок</h3><span class="muted">осталось ${left}</span></div>
    <div class="row" style="margin:10px 0"><input id="sh-n" placeholder="Добавить: молоко 2 л"><button class="btn primary" data-action="shop-add">+</button></div>
    ${groups.length ? groups.map(([c, items]) => `<div class="mtype">${c}</div>${items.map(s => `<button class="shop-row ${s.done ? 'done' : ''}" data-action="shop-toggle" data-id="${s.id}">
      <div class="check ${s.done ? 'done' : ''}">${s.done ? '✓' : ''}</div><span class="grow" style="text-align:left">${esc(s.name)}</span><span class="muted">${esc(s.qty)}</span></button>`).join('')}`).join('')
      : '<div class="empty">Список пуст. Добавь вручную или составь меню на неделю.</div>'}
    <div class="grid2" style="margin-top:14px"><button class="btn" data-action="shop-share">📤 Отправить</button><button class="btn" data-action="shop-clear">Убрать купленное</button></div>
    ${S.plan ? `<button class="btn block" style="margin-top:8px" data-action="plan">🗓️ К меню</button>` : ''}`);
}
function shareShop() {
  const groups = SHOP_CATS.map(c => [c, S.shop.filter(s => s.cat === c && !s.done)]).filter(g => g[1].length);
  if (!groups.length) return toast('Нечего отправлять');
  const text = '🛒 Покупки (NSs Adventures)\n\n' + groups.map(([c, items]) => c + ':\n' + items.map(s => `• ${s.name}${s.qty ? ' — ' + s.qty : ''}`).join('\n')).join('\n\n');
  if (navigator.share) navigator.share({ text }).catch(() => { });
  else navigator.clipboard?.writeText(text).then(() => toast('Список скопирован'));
}
const MEAL_SCHEMA = { type: 'OBJECT', properties: { type: { type: 'STRING', enum: Object.keys(MEALS) }, name: { type: 'STRING' }, kcal: { type: 'NUMBER' }, protein: { type: 'NUMBER' }, fat: { type: 'NUMBER' }, carbs: { type: 'NUMBER' } },
  required: ['type', 'name', 'kcal', 'protein', 'fat', 'carbs'] };
const MEAL_RECIPE_SCHEMA = { type: 'OBJECT', properties: { minutes: { type: 'INTEGER' }, servings: { type: 'INTEGER' },
  ingredients: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, qty: { type: 'STRING' }, cat: { type: 'STRING', enum: SHOP_CATS } }, required: ['name', 'qty', 'cat'] } },
  steps: { type: 'ARRAY', items: { type: 'STRING' } }, tip: { type: 'STRING' } }, required: ['minutes', 'servings', 'ingredients', 'steps', 'tip'] };
function openPlanMeal(d, mi) {
  const m = S.plan.days[d].meals[mi], kid = isKid(P());
  sheet(`<div class="muted">${MEALS[m.type] || ''} · ${WDS[new Date(addDays(S.plan.start, d) + 'T12:00').getDay()]}</div><h3 style="font-size:21px;margin:4px 0 8px">${esc(m.name)}</h3>
    ${kid ? '' : `<div class="macrorow" style="margin:0 0 12px"><div><div class="k">Калории</div><div class="v">${r0(m.kcal)}</div></div><div><div class="k">Белки</div><div class="v" style="color:var(--blue)">${r0(m.protein)} г</div></div>
      <div><div class="k">Жиры / Углев.</div><div class="v">${r0(m.fat)} / ${r0(m.carbs)} г</div></div></div>`}
    <div id="pm-body">${m.recipe ? recipeBody(m.recipe) : ''}</div>
    <div class="grid2" style="margin-top:12px">${m.recipe ? `<button class="btn" data-action="pm-shop" data-d="${d}" data-m="${mi}">🛒 В покупки</button>` : `<button class="btn primary" data-action="pm-recipe" data-d="${d}" data-m="${mi}">📖 Рецепт</button>`}
      <button class="btn" data-action="pm-swap" data-d="${d}" data-m="${mi}">🔄 Заменить</button></div>
    <button class="btn block ${isEaten(d, mi) ? '' : 'primary'}" style="margin-top:8px" data-action="plan-eat" data-d="${d}" data-m="${mi}">${isEaten(d, mi) ? '✓ Уже съедено' : '🍽️ Съел(а)'}</button>
    <button class="btn block" style="margin-top:8px" data-action="plan">← К меню</button>`);
}
function recipeBody(r) {
  return `<div class="card"><div class="muted">⏱ ${r.minutes} мин · ${r.servings} порц.</div><div class="mtype">Ингредиенты</div>
    ${r.ingredients.map(i => `<div class="row between" style="padding:3px 0"><span>${esc(i.name)}</span><span class="muted">${esc(i.qty)}</span></div>`).join('')}
    <div class="mtype">Как готовить</div><ol style="margin:6px 0 4px;padding-left:20px">${r.steps.map(s => `<li style="margin:5px 0">${esc(s)}</li>`).join('')}</ol>
    ${r.tip ? `<div class="sub" style="margin-top:8px">💡 ${esc(r.tip)}</div>` : ''}</div>`;
}
async function planMealRecipe(d, mi) {
  const m = S.plan.days[d].meals[mi], body = $('#pm-body');
  if (body) body.innerHTML = '<div class="row"><span class="spin"></span><span class="sub">Пишу рецепт…</span></div>';
  try {
    const r = await gemini([{ text: `Напиши простой домашний рецепт блюда «${m.name}» (${r0(m.kcal)} ккал на порцию, Б${r0(m.protein)}/Ж${r0(m.fat)}/У${r0(m.carbs)}). Семья: ${familyLine()}. servings — на сколько порций (на всю семью). Ингредиенты — из обычного российского магазина, количество на все порции в кг, г, л, мл или шт; cat — отдел магазина. steps — 4–8 коротких шагов. tip — как сделать сытнее без лишних калорий (до 20 слов). По-русски.` }], MEAL_RECIPE_SCHEMA);
    m.recipe = r; save(); openPlanMeal(d, mi);
  } catch (e) { aiError(e); }
}
async function planMealSwap(d, mi) {
  const m = S.plan.days[d].meals[mi], p = P(), all = S.plan.days.flatMap(x => x.meals.map(y => y.name));
  sheet(`<h3>Подбираю замену…</h3><div class="row"><span class="spin"></span><span class="sub">Вместо «${esc(m.name)}» ~${r0(m.kcal)} ккал</span></div>`);
  try {
    const r = await gemini([{ text: `Замени блюдо «${m.name}» (${MEALS[m.type]}, ${r0(m.kcal)} ккал, Б${r0(m.protein)}) на другое домашнее блюдо с калорийностью ±10% и не меньшим белком. Цель: ${isKid(p) ? 'здоровое питание ребёнка' : GOALS[p.goal].n}. ${S.plan.prefs ? 'Пожелания: ' + S.plan.prefs + '.' : ''} Не повторяй блюда недели: ${all.join(', ')}. type оставь «${m.type}». По-русски.` }], MEAL_SCHEMA);
    S.plan.days[d].meals[mi] = { ...r, type: m.type };
    S.plan.eaten = (S.plan.eaten || []).filter(k => k !== eatKey(d, mi));
    save(); toast(`🔄 ${r.name}`); openPlanMeal(d, mi); render();
  } catch (e) { aiError(e); }
}
function kitchenToday(p) {
  const i = planIndex(); let h = '';
  if (S.plan && i >= 0 && i < 7) {
    const d = S.plan.days[i], kid = isKid(p);
    if (d) h += `<div class="card"><div class="row between"><h3>🗓️ Меню на сегодня</h3><button class="btn sm" data-action="plan">Неделя</button></div>
      ${d.meals.map((m, mi) => `<div class="quest"><button class="check ${isEaten(i, mi) ? 'done' : ''}" data-action="plan-eat" data-d="${i}" data-m="${mi}">${isEaten(i, mi) ? '✓' : ''}</button>
      <div class="grow">${esc(m.name)}<div class="muted">${MEALS[m.type] || ''}${kid ? '' : ' · ' + r0(m.kcal) + ' ккал'}</div></div></div>`).join('')}</div>`;
  }
  const rep = S.reports[p.id], wd = new Date().getDay();
  if (!isKid(p) && (wd === 0 || wd === 1) && (!rep || daysBetween(rep.date, dkey()) >= 5) && Object.keys(S.days[p.id] || {}).length >= 3)
    h += `<button class="opt" data-action="report"><div class="e">📊</div><div class="grow"><b>Итоги недели готовы к разбору</b><div class="muted">Тренер оценит неделю и даст план</div></div></button>`;
  return h;
}

/* ================= 8. Прогноз веса ================= */
function forecast(p) {
  const ws = (S.weights[p.id] || []).filter(w => daysBetween(w.date, dkey()) <= 60).sort((a, b) => a.date < b.date ? -1 : 1);
  let slope = null, method = '';
  if (ws.length >= 2 && daysBetween(ws[0].date, ws[ws.length - 1].date) >= 5) {
    const xs = ws.map(w => daysBetween(ws[0].date, w.date)), ys = ws.map(w => w.kg), n = xs.length;
    const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    if (den) { slope = num / den; method = 'по твоим взвешиваниям'; }
  }
  if (slope === null) {
    const t = targets(p), logged = Array.from({ length: 14 }, (_, i) => S.days[p.id]?.[addDays(dkey(), -i - 1)]).filter(d => d?.meals.length);
    if (logged.length >= 3) {
      const tdee = t.bmr * p.activity;
      const bal = logged.reduce((a, d) => { const x = totals(d); return a + x.kcal - x.burned - tdee; }, 0) / logged.length;
      slope = bal / 7700; method = `по калориям за ${logged.length} дн.`;
    }
  }
  if (slope === null) return null;
  const now = ws.length ? ws[ws.length - 1].kg : p.weight;
  const f = { slope, method, week: slope * 7, in30: now + slope * 30, now };
  if (p.targetWeight && Math.abs(slope) > 0.001 && Math.sign(p.targetWeight - now) === Math.sign(slope)) {
    const days = (p.targetWeight - now) / slope;
    if (days < 730) f.eta = addDays(dkey(), Math.ceil(days));
  }
  return f;
}
function forecastHtml(p) {
  const f = forecast(p);
  if (!f) return `<div class="muted" style="margin-top:8px">📈 Прогноз появится, когда будет 3+ дня записей еды или 2 взвешивания с разницей в неделю.</div>`;
  const fmt = k => new Date(k + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const wk = f.week, fast = Math.abs(wk) > 1.2;
  return `<div class="fc"><div class="row between"><b>📈 Прогноз</b><span class="muted">${f.method}</span></div>
    <div class="grid3" style="margin-top:8px"><div><div class="muted">Темп</div><b style="color:${wk <= 0 ? 'var(--green)' : 'var(--amber)'}">${wk > 0 ? '+' : ''}${wk.toFixed(2)} кг/нед</b></div>
    <div><div class="muted">Через месяц</div><b>≈ ${f.in30.toFixed(1)} кг</b></div>
    <div><div class="muted">Цель ${p.targetWeight ? p.targetWeight + ' кг' : ''}</div><b>${p.targetWeight ? (f.eta ? '~' + fmt(f.eta) : 'не в ту сторону') : '<button class="btn sm" data-action="edit-profile" data-id="' + p.id + '">Указать</button>'}</b></div></div>
    ${fast ? `<div class="muted" style="margin-top:8px">⚠️ Больше 1 кг в неделю — слишком быстро, лучше чуть замедлиться.</div>` : ''}</div>`;
}

/* ================= 9. Отчёт недели ================= */
const REPORT_SCHEMA = { type: 'OBJECT', properties: { score: { type: 'INTEGER' }, headline: { type: 'STRING' },
  wins: { type: 'ARRAY', items: { type: 'STRING' } }, improve: { type: 'ARRAY', items: { type: 'STRING' } }, plan: { type: 'ARRAY', items: { type: 'STRING' } } },
  required: ['score', 'headline', 'wins', 'improve', 'plan'] };
function weekSummary(p) {
  const t = targets(p);
  const rows = Array.from({ length: 7 }, (_, i) => { const k = addDays(dkey(), i - 6), d = S.days[p.id]?.[k];
    if (!d) return `${k}: нет записей`;
    const x = totals(d);
    return `${k} (${WDS[new Date(k + 'T12:00').getDay()]}): ${r0(x.kcal)} ккал, Б${r0(x.protein)}/Ж${r0(x.fat)}/У${r0(x.carbs)}, вода ${d.water} мл, движение ${d.workouts.map(w => w.n + ' ' + w.min + 'мин').join(', ') || 'нет'}, еда: ${d.meals.map(m => m.name).slice(0, 6).join('; ') || '—'}`; });
  const ws = (S.weights[p.id] || []).filter(w => daysBetween(w.date, dkey()) <= 7);
  const f = forecast(p);
  return `${p.name}, ${p.age} лет, ${p.sex === 'm' ? 'муж' : 'жен'}, ${p.weight} кг${p.targetWeight ? ', цель по весу ' + p.targetWeight + ' кг' : ''}, цель «${GOALS[p.goal].n}».
Норма: ${t.kcal} ккал, Б${t.protein}/Ж${t.fat}/У${t.carbs}, вода ${t.water} мл.
По дням:\n${rows.join('\n')}
Взвешивания за неделю: ${ws.map(w => w.date + ' ' + w.kg).join(', ') || 'нет'}. ${f ? `Темп ${f.week.toFixed(2)} кг/нед (${f.method}).` : ''} Серия дней: ${streak(p)}.`;
}
async function weeklyReport(force) {
  const p = P(), cached = S.reports[p.id];
  if (cached && !force && daysBetween(cached.date, dkey()) < 1) return showReport(cached);
  sheet(`<h3>Тренер разбирает неделю…</h3><div class="row"><span class="spin"></span><span class="sub">Смотрю калории, воду, тренировки и вес за 7 дней</span></div>`);
  const prompt = `Ты — дружелюбный, но честный тренер-нутрициолог. Разбери неделю человека и ответь по-русски.
score — оценка недели 1–10. headline — главный вывод одной фразой (до 12 слов).
wins — 2–4 конкретных успеха (с цифрами). improve — 2–3 зоны роста (конкретно, без морали). plan — 3–4 конкретных шага на следующую неделю (еда + движение).
Если записей мало — мягко скажи об этом в improve. Каждый пункт до 20 слов.\n\n${weekSummary(p)}`;
  try {
    const r = await gemini([{ text: prompt }], REPORT_SCHEMA);
    S.reports[p.id] = { date: dkey(), ...r }; save(); addXP(15, 'Итоги недели'); showReport(S.reports[p.id]); render();
  } catch (e) { aiError(e); }
}
function showReport(r) {
  const sc = Math.max(1, Math.min(10, r.score || 0)), col = sc >= 8 ? '#3DDC97' : sc >= 5 ? '#FFB547' : '#FF6B6B';
  const list = (t, e, a) => a?.length ? `<div class="mtype">${t}</div>${a.map(s => `<div class="row" style="align-items:flex-start;padding:4px 0"><span>${e}</span><span>${esc(s)}</span></div>`).join('')}` : '';
  sheet(`<div class="ringwrap"><div class="ring" style="width:110px;height:110px">${ring(sc, 10, 110, 10, col)}<div class="c"><div><div class="big" style="font-size:34px">${sc}</div><div class="lbl">из 10</div></div></div></div>
    <div class="grow"><div class="muted">Итоги недели · ${new Date(r.date + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div><h3 style="font-size:19px;margin-top:4px">${esc(r.headline)}</h3></div></div>
    <div class="card">${list('Получилось', '✅', r.wins)}${list('Можно лучше', '🎯', r.improve)}${list('План на неделю', '🗓️', r.plan)}</div>
    <div class="grid2"><button class="btn" data-action="report-new">Обновить</button><button class="btn primary" data-action="close-sheet">Понятно</button></div>`);
}
function reportCard(p) {
  const r = S.reports[p.id];
  return `<div class="card"><div class="row between"><div><h3>📊 Отчёт недели</h3><div class="muted">${r ? `${esc(r.headline)} · ${r.score}/10` : 'Тренер оценит 7 дней и даст план'}</div></div>
    <button class="btn sm ${r ? '' : 'primary'}" data-action="report">${r ? 'Открыть' : 'Получить'}</button></div></div>`;
}

/* ================= демо-ответы (ключ «demo») ================= */
DEMO.set(LABEL_SCHEMA, { name: 'Йогурт греческий', brand: 'Демо', kcal: 66, protein: 9, fat: 2, carbs: 4, serving: 140 });
DEMO.set(RECIPE_SCHEMA, { seen: ['курица', 'рис', 'помидоры', 'яйца'], recipes: [
  { name: 'Курица с рисом и томатами', minutes: 30, servings: 3, kcal: 450, protein: 38, fat: 10, carbs: 50, why: 'Много белка, умеренно калорий — под твою цель',
    ingredients: [{ name: 'Куриное филе', qty: '500 г', have: true }, { name: 'Рис', qty: '200 г', have: true }, { name: 'Помидоры', qty: '3 шт', have: true }, { name: 'Зелень', qty: 'пучок', have: false }],
    steps: ['Отвари рис', 'Нарежь курицу и обжарь 7 минут', 'Добавь помидоры, туши 10 минут', 'Подавай с рисом и зеленью'] },
  { name: 'Омлет с овощами', minutes: 12, servings: 2, kcal: 280, protein: 20, fat: 18, carbs: 8, why: 'Быстро и сытно',
    ingredients: [{ name: 'Яйца', qty: '4 шт', have: true }, { name: 'Помидоры', qty: '1 шт', have: true }], steps: ['Взбей яйца', 'Добавь помидоры', 'Жарь под крышкой 6 минут'] }] });
DEMO.set(PLAN_SCHEMA, { tip: 'Отвари крупу сразу на 2 дня и запеки курицу большим противнем — сэкономишь час.',
  days: Array.from({ length: 7 }, (_, i) => ({ meals: [
    { type: 'breakfast', name: ['Овсянка с ягодами', 'Сырники', 'Омлет с овощами', 'Гречка с яйцом', 'Творог с бананом', 'Бутерброды с сыром', 'Блины с творогом'][i], kcal: 380, protein: 20, fat: 12, carbs: 48 },
    { type: 'lunch', name: ['Борщ', 'Куриный суп', 'Плов с курицей', 'Щи', 'Паста с фаршем', 'Уха', 'Голубцы'][i], kcal: 520, protein: 30, fat: 16, carbs: 60 },
    { type: 'dinner', name: ['Курица с овощами', 'Рыба с рисом', 'Котлеты с гречкой', 'Тушёная индейка', 'Запеканка', 'Салат с тунцом', 'Запечённая курица'][i], kcal: 480, protein: 38, fat: 14, carbs: 42 },
    { type: 'snack', name: 'Яблоко и йогурт', kcal: 200, protein: 8, fat: 4, carbs: 30 }] })),
  shopping: [{ cat: 'Мясо и рыба', name: 'Куриное филе', qty: '1,5 кг' }, { cat: 'Овощи и фрукты', name: 'Яблоки', qty: '1 кг' }, { cat: 'Овощи и фрукты', name: 'Помидоры', qty: '6 шт' },
    { cat: 'Молочное и яйца', name: 'Яйца', qty: '20 шт' }, { cat: 'Молочное и яйца', name: 'Творог', qty: '600 г' }, { cat: 'Крупы, хлеб, макароны', name: 'Гречка', qty: '800 г' }] });
DEMO.set(MEAL_SCHEMA, { type: 'lunch', name: 'Индейка с булгуром и овощами', kcal: 510, protein: 38, fat: 12, carbs: 55 });
DEMO.set(MEAL_RECIPE_SCHEMA, { minutes: 35, servings: 3, tip: 'Добавь больше овощей — объём вырастет, а калорий почти не прибавится.',
  ingredients: [{ name: 'Свёкла', qty: '2 шт', cat: 'Овощи и фрукты' }, { name: 'Филе куриное', qty: '400 г', cat: 'Мясо и рыба' }, { name: 'Капуста', qty: '300 г', cat: 'Овощи и фрукты' }, { name: 'Томаты', qty: '2 шт', cat: 'Овощи и фрукты' }],
  steps: ['Нарежь курицу', 'Нарежь овощи', 'Туши всё вместе 20 минут', 'Подавай с зеленью'] });
DEMO.set(REPORT_SCHEMA, { score: 7, headline: 'Хорошая неделя: белок в норме, но мало воды', wins: ['5 из 7 дней в пределах нормы калорий', '3 тренировки — отличный ритм'],
  improve: ['Вода: в среднем 1,2 л вместо 2 л', 'Ужины поздние и тяжёлые'], plan: ['Стакан воды перед каждым приёмом пищи', 'Ужин до 20:00, больше овощей', '2 прогулки по 30 минут'] });

/* ================= обработчики ================= */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action;
  switch (a) {
    case 'scan': openScanner(); break;
    case 'bc-go': lookupBarcode($('#sc-code').value); stopScanner(); break;
    case 'bc-photo': barcodeFromPhoto(); break;
    case 'label-photo': labelPhoto(el.dataset.code); break;
    case 'pg-set': $('#pg').value = el.dataset.v; updProduct(); break;
    case 'pm-type': curProduct.type = el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); break;
    case 'product-add': addProduct(); break;
    case 'cook': openCook(); break;
    case 'cook-last': showRecipes(); break;
    case 'seg-pick': el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); break;
    case 'cook-photo': { const mode = $('#ck-m .on')?.dataset.v; pickPhoto(!!el.dataset.cap).then(async f => {
      if (!f) return; const img = await loadImg(f).catch(() => null); if (!img) return toast('Не удалось открыть фото');
      if (!$('#ck-m')) openCook(); $('#ck-m')?.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === mode));
      cookGo('', shrink(img, 1100, .82)); }); break; }
    case 'cook-text': { const t = $('#ck-t').value.trim(); if (!t) return toast('Напиши, какие продукты есть'); cookGo(t); break; }
    case 'rc-eat': { const r = lastRecipes[+el.dataset.n]; closeSheet(); go('today');
      logMeal({ name: r.name, ai: true, items: [{ name: r.name, grams: 0, kcal: r0(r.kcal), protein: r0(r.protein), fat: r0(r.fat), carbs: r0(r.carbs) }] }); break; }
    case 'rc-shop': { const r = lastRecipes[+el.dataset.n], n = addShop(r.ingredients.filter(i => !i.have).map(i => ({ name: i.name, qty: i.qty, cat: 'Другое' })));
      toast(n ? `🛒 Добавлено в покупки: ${n}` : 'Уже в списке'); break; }
    case 'plan': openPlan(); break;
    case 'plan-new': planForm(); break;
    case 'plan-go': planGo($('#pl-p').value.trim()); break;
    case 'plan-day': planDay = +el.dataset.v; openPlan(); break;
    case 'plan-meal': openPlanMeal(+el.dataset.d, +el.dataset.m); break;
    case 'pm-recipe': planMealRecipe(+el.dataset.d, +el.dataset.m); break;
    case 'pm-swap': planMealSwap(+el.dataset.d, +el.dataset.m); break;
    case 'pm-shop': { const r = S.plan.days[+el.dataset.d].meals[+el.dataset.m].recipe; const before = S.shop.filter(s => !s.done).length;
      addShop(r.ingredients.map(i => ({ ...i }))); const n = S.shop.filter(s => !s.done).length - before;
      toast(n ? `🛒 Новых продуктов в списке: ${n}` : '🛒 Всё уже в списке — количество обновлено'); break; }
    case 'plan-eat': { const d = +el.dataset.d, mi = +el.dataset.m, k = eatKey(d, mi); S.plan.eaten ??= [];
      if (S.plan.eaten.includes(k)) return toast('Уже отмечено ✓');
      const m = S.plan.days[d].meals[mi]; S.plan.eaten.push(k);
      day().meals.push({ id: uid(), type: m.type, time: hm(), name: m.name, fromPlan: true, items: [{ name: m.name, grams: 0, kcal: r0(m.kcal), protein: r0(m.protein), fat: r0(m.fat), carbs: r0(m.carbs) }] });
      save(); addXP(10, 'По плану меню'); checkQuests(); if ($('#pm-body')) openPlanMeal(d, mi); else if ($('.sheet')) openPlan(); render(); break; }
    case 'shop': openShop(); break;
    case 'shop-add': { const v = $('#sh-n').value.trim(); if (!v) return; const m = v.match(/^(.*?)\s+([\d.,]+\s*\S*)$/);
      addShop([{ name: m ? m[1] : v, qty: m ? m[2] : '', cat: 'Другое' }]); openShop(); break; }
    case 'shop-toggle': { const s = S.shop.find(x => x.id === el.dataset.id); s.done = !s.done; save(); openShop(); break; }
    case 'shop-clear': S.shop = S.shop.filter(s => !s.done); save(); openShop(); break;
    case 'shop-share': shareShop(); break;
    case 'report': weeklyReport(false); break;
    case 'report-new': weeklyReport(true); break;
  }
});
document.addEventListener('input', e => { if (e.target.id === 'pg') updProduct(); });
dedupeShop();
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'sc-code') $('[data-action="bc-go"]')?.click();
  if (e.target.id === 'sh-n') $('[data-action="shop-add"]')?.click();
});
render();
