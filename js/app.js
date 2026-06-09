// UI & Navigation

const PAGES = ['dashboard', 'expenses', 'income', 'savings', 'investments'];
const PAGE_LABELS = { dashboard: 'Дашборд', expenses: 'Расходы', income: 'Доходы', savings: 'Накопления', investments: 'Инвестиции' };
let currentPage = 'dashboard';
let chartMonthIdx = 0; // индекс текущего месяца для переключаемой диаграммы

const PALETTE = ['#3fb950','#58a6ff','#a371f7','#f85149','#d2991d','#f778ba','#7ee787','#a5d6ff','#e3b341','#ff7b72','#79c0ff','#d2a8ff'];

function buildNav() {
  document.getElementById('sidebar-nav').innerHTML = PAGES.map(p =>
    `<a href="#" data-page="${p}" onclick="navigate('${p}')">${PAGE_LABELS[p]}</a>`).join('');
  document.getElementById('sidebar-footer').innerHTML = `<a href="#" onclick="navigate('sync')">Синхронизация</a>`;
}

function init() { buildNav(); buildBottomBar(); navigate('dashboard'); }

function buildBottomBar() {
  let bar = document.getElementById('bottom-bar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'bottom-bar'; document.getElementById('main-content').appendChild(bar); }
  bar.innerHTML = PAGES.map(p => `<a href="#" data-page="${p}" onclick="navigate('${p}')"><span class="icon">${p==='dashboard'?'📊':p==='expenses'?'🛒':p==='income'?'💰':p==='savings'?'🏦':'📈'}</span>${PAGE_LABELS[p]}</a>`).join('');
}

async function navigate(page) {
  currentPage = page;
  document.querySelectorAll('#sidebar-nav a, #sidebar-footer a, #bottom-bar a').forEach(a =>
    a.classList.toggle('active', a.dataset.page === page || (page === 'sync' && a.textContent === 'Синхронизация')));
  document.getElementById('page-title').textContent = page === 'sync' ? 'Синхронизация' : (PAGE_LABELS[page] || page);
  document.getElementById('content').innerHTML = '';
  switch (page) {
    case 'dashboard': await renderDashboard(); break;
    case 'expenses': await renderExpenses(); break;
    case 'income': await renderIncome(); break;
    case 'savings': await renderSavings(); break;
    case 'investments': await renderInvestments(); break;
    case 'sync': renderSync(); break;
  }
}

function toggleView(mode) { document.body.classList.toggle('mobile-view', mode === 'mobile'); }

// ── Modal ──
function showModal(html) {
  closeModal(); const o = document.createElement('div'); o.className = 'modal-overlay'; o.id = 'modal-overlay'; o.onclick = e => { if (e.target === o) closeModal(); };
  const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = html; o.appendChild(m); document.body.appendChild(o);
}
function closeModal() { const o = document.getElementById('modal-overlay'); if (o) o.remove(); }

// ═══ Dashboard ═══
async function renderDashboard() {
  const s = await dashboardSummary();
  const breakdown = await monthlyBreakdown(12);
  const c = document.getElementById('content');

  const fields = [
    ['Доходы', s.totalIncome, 'positive'], ['Расходы', s.totalExpenses, 'negative'],
    ['Баланс', s.balance, s.balance >= 0 ? 'positive' : 'negative'],
    ['Кошелёк', s.wallet, s.wallet >= 0 ? 'positive' : 'negative'],
    ['Накоплено', s.totalSavings, 'neutral'], ['Желаемое', s.wishlistTotal, 'neutral'],
  ];

  let h = '<div class="card"><h2>Сводка</h2><div class="dash-grid">';
  fields.forEach(([l,v,cls]) => h += `<div class="dash-item"><div class="label">${l}</div><div class="value ${cls}">${Math.round(v).toLocaleString()}</div></div>`);
  h += '</div></div>';

  // Годовая диаграмма
  if (breakdown.length) {
    const max = Math.max(...breakdown.map(b => Math.max(b.income, b.expenses))) * 1.2 || 1;
    h += '<div class="card"><h2>Год</h2><div class="chart-container">';
    breakdown.forEach(b => {
      const ip = (b.income / max * 100).toFixed(1);
      const ep = (b.expenses / max * 100).toFixed(1);
      h += `<div class="month-row">
        <div class="month-label">${b.month.slice(5)}.${b.month.slice(2,4)}</div>
        <div class="month-bars">
          <div class="bar-income" style="width:${ip}%"><span class="bar-label">${Math.round(b.income).toLocaleString()}</span></div>
          <div class="bar-expense" style="width:${ep}%"><span class="bar-label">${Math.round(b.expenses).toLocaleString()}</span></div>
        </div>
        <div class="month-balance" style="color:${b.balance>=0?'var(--green)':'var(--red)'}">${b.balance>=0?'+':''}${Math.round(b.balance).toLocaleString()}</div>
      </div>`;
    });
    h += '<div class="chart-legend"><span class="legend-income">Доходы</span><span class="legend-expense">Расходы</span></div></div></div>';
  }

  // Месячная диаграмма (последний месяц по умолчанию)
  if (breakdown.length) {
    chartMonthIdx = breakdown.length - 1;
    h += `<div class="card"><h2>Месяц</h2><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <button class="btn small" onclick="shiftMonth(-1)">◀</button>
      <span id="chart-month-label" style="font-weight:600;min-width:80px;text-align:center;">${breakdown[chartMonthIdx].month.slice(5)}.${breakdown[chartMonthIdx].month.slice(2,4)}</span>
      <button class="btn small" onclick="shiftMonth(1)">▶</button>
    </div><div id="month-chart-area"></div></div>`;
  }

  c.innerHTML = h;
  if (breakdown.length) renderMonthChart();
}

window.shiftMonth = (dir) => {
  monthlyBreakdown(12).then(data => {
    chartMonthIdx = Math.max(0, Math.min(data.length - 1, chartMonthIdx + dir));
    document.getElementById('chart-month-label').textContent = data[chartMonthIdx].month.slice(5) + '.' + data[chartMonthIdx].month.slice(2,4);
    renderMonthChart();
  });
};

async function renderMonthChart() {
  const data = await monthlyBreakdown(12);
  const b = data[chartMonthIdx];
  const area = document.getElementById('month-chart-area');
  if (!area || !b) return;
  const max = Math.max(b.income, b.expenses) * 1.2 || 1;
  const ip = (b.income / max * 100).toFixed(1);
  const ep = (b.expenses / max * 100).toFixed(1);
  area.innerHTML = `
    <div class="month-row" style="margin-bottom:6px;">
      <div class="month-bars">
        <div class="bar-income" style="width:${ip}%"><span class="bar-label">+${Math.round(b.income).toLocaleString()}</span></div>
        <div class="bar-expense" style="width:${ep}%"><span class="bar-label">-${Math.round(b.expenses).toLocaleString()}</span></div>
      </div>
    </div>
    <div style="font-weight:700;color:${b.balance>=0?'var(--green)':'var(--red)'};">Баланс: ${b.balance>=0?'+':''}${Math.round(b.balance).toLocaleString()}</div>`;
}

// ═══ Expenses ═══
async function renderExpenses(filters = {}) {
  const categories = await listCategories();
  const expenses = await listExpenses(filters);
  const c = document.getElementById('content');

  let h = `<div class="card">
    <div class="filter-bar">
      <input id="exp-search" placeholder="Поиск по товару..." value="${filters.search||''}" onchange="applyExpenseFilters()" style="flex:2;">
      <select id="exp-cat" onchange="applyExpenseFilters()"><option value="">Все категории</option>${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
      <select id="exp-sort" onchange="applyExpenseFilters()">
        <option value="date" ${(filters.sortField||'date')==='date'?'selected':''}>По дате</option>
        <option value="amount" ${filters.sortField==='amount'?'selected':''}>По сумме</option>
        <option value="product" ${filters.sortField==='product'?'selected':''}>По названию</option>
      </select>
      <button class="btn-add" onclick="showExpenseModal()" title="Добавить">+</button>
      <button class="btn small" onclick="showCategoriesModal()">Категории</button>
    </div>
    <table><thead><tr><th></th><th>Категория</th><th>Товар</th><th>Сумма</th><th>Дата</th><th></th></tr></thead><tbody>`;

  expenses.forEach(e => {
    const color = categoryColor(categories, e.category_id);
    const stripe = color ? `<div style="width:4px;height:20px;background:${color};border-radius:2px;flex-shrink:0;"></div>` : '';
    h += `<tr><td>${stripe}</td><td>${categoryName(categories, e.category_id)}</td><td>${e.product}</td><td style="color:var(--red)">-${e.amount.toLocaleString()}</td><td>${fmtDate(e.date)}</td><td><button class="btn-del" onclick="deleteExpenseAndRefresh(${e.id})">-</button></td></tr>`;
  });
  h += '</tbody></table></div>';
  if (!expenses.length) h += '<div style="text-align:center;padding:24px;color:var(--text-muted);">Нет расходов</div>';
  c.innerHTML = h;
  if (filters.categoryId) document.getElementById('exp-cat').value = filters.categoryId;
}

window.applyExpenseFilters = () => {
  renderExpenses({
    search: document.getElementById('exp-search')?.value || '',
    categoryId: parseInt(document.getElementById('exp-cat')?.value) || null,
    sortField: document.getElementById('exp-sort')?.value || 'date', sortDir: 'desc',
  });
};

async function deleteExpenseAndRefresh(id) { await deleteExpense(id); applyExpenseFilters(); }

async function showExpenseModal() {
  const cats = await listCategories();
  const today = new Date().toISOString().slice(0,10);
  showModal(`<button class="modal-close" onclick="closeModal()">x</button><h2>Добавить расход</h2>
    <div class="form-group"><label>Категория</label><select id="em-cat">${cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
    <div class="form-group"><label>Товар</label><input id="em-product" placeholder="Товар"></div>
    <div class="form-group"><label>Сумма</label><input type="number" id="em-amount" placeholder="0"></div>
    <div class="form-group"><label>Дата</label><input type="date" id="em-date" value="${today}"></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn" id="em-save" style="border-color:var(--green);color:var(--green);">Добавить</button></div>`);
  document.getElementById('em-save').onclick = async () => {
    const cid = parseInt(document.getElementById('em-cat').value);
    const p = document.getElementById('em-product').value, a = parseFloat(document.getElementById('em-amount').value);
    if (!p || !a) return;
    await addExpense(cid, p, a, document.getElementById('em-date').value);
    closeModal(); applyExpenseFilters();
  };
}

// Категории с правкой цвета
async function showCategoriesModal() {
  const cats = await listCategories();
  showModal(`<button class="modal-close" onclick="closeModal()">x</button><h2>Категории</h2>
    <div class="form-row"><input id="cat-name" placeholder="Новая категория"><input id="cat-color" placeholder="#3fb950" style="flex:0;width:100px;"><button class="btn" onclick="addCategoryAction()" style="flex:0;">Добавить</button></div>
    <div class="mb-8" style="display:flex;gap:4px;flex-wrap:wrap;">${PALETTE.map(c => `<span style="display:inline-block;width:24px;height:24px;background:${c};border-radius:4px;cursor:pointer;border:1px solid var(--border);" onclick="document.getElementById('cat-color').value='${c}'" title="${c}"></span>`).join('')}</div>
    <table><tbody>
      ${cats.map(c => `<tr>
        <td><span style="display:inline-block;width:14px;height:14px;background:${c.color||'transparent'};border-radius:3px;margin-right:8px;vertical-align:middle;"></span>${c.name}</td>
        <td style="font-size:12px;color:var(--text-muted);">${c.color||''}</td>
        <td><button class="btn small" onclick="editCategoryColor(${c.id},'${c.name}','${c.color||''}')">✏</button></td>
        <td><button class="btn-del" onclick="deleteCategoryAction(${c.id})">-</button></td>
      </tr>`).join('')}
    </tbody></table>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Закрыть</button></div>`);
  window.addCategoryAction = async () => {
    const n = document.getElementById('cat-name').value.trim();
    if (!n) return;
    await addCategory(n, document.getElementById('cat-color').value || null);
    closeModal(); showCategoriesModal();
  };
  window.deleteCategoryAction = async (id) => {
    try { await deleteCategory(id); closeModal(); showCategoriesModal(); } catch (e) { alert(e.message); }
  };
  window.editCategoryColor = (id, name, color) => {
    showModal(`<button class="modal-close" onclick="closeModal()">x</button><h2>Изменить: ${name}</h2>
      <div class="form-group"><label>Название</label><input id="ecat-name" value="${name.replace(/"/g,'"')}"></div>
      <div class="form-group"><label>Цвет</label><input id="ecat-color" value="${color}"></div>
      <div class="mb-8" style="display:flex;gap:4px;flex-wrap:wrap;">${PALETTE.map(c => `<span style="display:inline-block;width:24px;height:24px;background:${c};border-radius:4px;cursor:pointer;border:1px solid var(--border);" onclick="document.getElementById('ecat-color').value='${c}'" title="${c}"></span>`).join('')}</div>
      <div class="modal-actions"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn" style="border-color:var(--green);color:var(--green);" onclick="saveCategoryEdit(${id})">Сохранить</button></div>`);
    window.saveCategoryEdit = async (cid) => {
      const n = document.getElementById('ecat-name').value.trim();
      if (!n) return;
      await updateCategory(cid, n, document.getElementById('ecat-color').value || null);
      closeModal(); closeModal(); showCategoriesModal();
    };
  };
}

// ═══ Income ═══
async function renderIncome() {
  const items = await listIncome();
  const c = document.getElementById('content');
  const el = { cash: 'Наличные', card: 'Карта', crypto: 'Крипта' };

  let h = `<div class="card"><div class="section-actions"><span></span><button class="btn-add" onclick="showIncomeModal()" title="Добавить">+</button></div>
    <table><thead><tr><th>Источник</th><th>Тип</th><th>Валюта</th><th>Сумма</th><th>Примечание</th><th>Дата</th><th></th></tr></thead><tbody>`;
  items.forEach(i => h += `<tr><td>${i.source}</td><td><span class="badge ${i.equivalent}">${el[i.equivalent]||i.equivalent}</span></td><td>${i.currency}</td><td style="color:var(--green)">+${i.amount.toLocaleString()}</td><td>${i.note||''}</td><td>${fmtDate(i.date)}</td><td><button class="btn-del" onclick="deleteIncomeAndRefresh(${i.id})">-</button></td></tr>`);
  h += '</tbody></table></div>';
  if (!items.length) h += '<div style="text-align:center;padding:24px;color:var(--text-muted);">Нет доходов</div>';
  c.innerHTML = h;
}
async function deleteIncomeAndRefresh(id) { await deleteIncome(id); renderIncome(); }

async function showIncomeModal() {
  const today = new Date().toISOString().slice(0,10);
  showModal(`<button class="modal-close" onclick="closeModal()">x</button><h2>Добавить доход</h2>
    <div class="form-group"><label>Источник</label><input id="im-source" placeholder="Источник"></div>
    <div class="form-group"><label>Сумма</label><input type="number" id="im-amount" placeholder="0"></div>
    <div class="form-group"><label>Тип</label><select id="im-equiv"><option value="card">Карта</option><option value="cash">Наличные</option><option value="crypto">Крипта</option></select></div>
    <div class="form-group"><label>Валюта</label><select id="im-currency"><option>RUB</option><option>USD</option><option>EUR</option></select></div>
    <div class="form-group"><label>Примечание</label><input id="im-note"></div>
    <div class="form-group"><label>Дата</label><input type="date" id="im-date" value="${today}"></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn" id="im-save" style="border-color:var(--green);color:var(--green);">Добавить</button></div>`);
  document.getElementById('im-save').onclick = async () => {
    const s = document.getElementById('im-source').value, a = parseFloat(document.getElementById('im-amount').value);
    if (!s || !a) return;
    await addIncome(s, document.getElementById('im-equiv').value, document.getElementById('im-currency').value, a, document.getElementById('im-note').value, document.getElementById('im-date').value);
    closeModal(); renderIncome();
  };
}

// ═══ Savings ═══
async function renderSavings() {
  const plans = await listSavingsPlans();
  const wishItems = await listWishlist();
  const c = document.getElementById('content');
  const sl = { active: 'Активен', inactive: 'Не активен', completed: 'Выполнено' };

  let h = `<div class="section-actions"><span></span><button class="btn-add" onclick="showSavingsModal()" title="Добавить">+</button></div>`;
  plans.forEach(p => {
    const fc = p.percent >= 100 ? 'done' : p.percent >= 50 ? '' : 'warning';
    h += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;"><b>${p.goal_name}</b><span class="badge ${p.status}">${sl[p.status]}</span></div>
      <div class="progress-bar"><div class="fill ${fc}" style="width:${Math.min(p.percent,100)}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin:0.35rem 0;color:var(--text-muted);"><span>${p.percent}% (${Math.round(p.current_amount).toLocaleString()} / ${Math.round(p.target_amount).toLocaleString()})</span>${p.months_remaining > 0 && p.status === 'active' ? '<span>Ост. месяцев: '+p.months_remaining+'</span>' : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn small" onclick="topupPlanAction(${p.id})">Пополнить</button>
        <button class="btn small" onclick="withdrawPlanAction(${p.id})">Снять</button>
        <select style="font-size:0.8rem;padding:2px 6px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:4px;" onchange="updatePlanStatusAction(${p.id},this.value)" value="${p.status}"><option value="active" ${p.status==='active'?'selected':''}>Активен</option><option value="inactive" ${p.status==='inactive'?'selected':''}>Не активен</option><option value="completed" ${p.status==='completed'?'selected':''}>Выполнено</option></select>
        <button class="btn-del" onclick="deleteSavingsPlanAction(${p.id})" style="margin-left:auto;">-</button>
      </div>`;
    if (p.transactions && p.transactions.length) {
      h += `<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--text-muted);"><b>История операций:</b>${p.transactions.slice(-5).reverse().map(t => `<div style="padding:1px 0;">${t.amount>=0?'+':''}${Math.round(t.amount).toLocaleString()} — ${t.note} — ${fmtDate(t.date)}</div>`).join('')}</div>`;
    }
    h += '</div>';
  });
  if (!plans.length) h += '<div style="text-align:center;padding:24px;color:var(--text-muted);">Нет планов</div>';

  h += '<h2 style="margin:1.5rem 0 0.75rem;">Список желаний</h2><div class="section-actions"><span></span><button class="btn-add" onclick="showWishlistModal()" title="Добавить">+</button></div>';
  if (wishItems.length) {
    h += '<div class="card"><table><thead><tr><th>Цель</th><th>Цена</th><th>Примечание</th><th></th></tr></thead><tbody>';
    wishItems.forEach(w => h += `<tr><td>${w.item}</td><td>${w.estimated_cost>0?'≈'+w.estimated_cost.toLocaleString():''}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${w.purpose||''}</td><td><button class="btn-del" onclick="deleteWishlistAction(${w.id})">-</button></td></tr>`);
    h += '</tbody></table></div>';
  } else h += '<div style="text-align:center;padding:12px;color:var(--text-muted);">Список пуст</div>';
  c.innerHTML = h;
}

window.topupPlanAction = async (id) => { const a = parseFloat(prompt('Сумма пополнения:')); if (a > 0) { await topupPlan(id, a); renderSavings(); } };
window.withdrawPlanAction = async (id) => { const a = parseFloat(prompt('Сумма снятия:')); if (a > 0) { try { await withdrawPlan(id, a); renderSavings(); } catch (e) { alert(e.message); } } };
window.updatePlanStatusAction = async (id, s) => { await updatePlanStatus(id, s); renderSavings(); };
window.deleteSavingsPlanAction = async (id) => { if (confirm('Удалить план?')) { await deleteSavingsPlan(id); renderSavings(); } };
window.deleteWishlistAction = async (id) => { if (confirm('Удалить?')) { await deleteWishlistItem(id); renderSavings(); } };

async function showSavingsModal() {
  showModal(`<button class="modal-close" onclick="closeModal()">×</button><h2>Новый план</h2>
    <div class="form-group"><label>Цель</label><input id="sm-goal" placeholder="Название цели"></div>
    <div class="form-group"><label>Целевая сумма</label><input type="number" id="sm-target" placeholder="0" oninput="calcMonths()"></div>
    <div class="form-group"><label>Ежемес. взнос</label><input type="number" id="sm-monthly" placeholder="0" oninput="calcMonths()"></div>
    <div class="form-group"><label>Текущая сумма</label><input type="number" id="sm-current" placeholder="0" value="0"></div>
    <div id="sm-estimate" style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;"></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn" id="sm-save" style="border-color:var(--green);color:var(--green);">Создать</button></div>`);
  window.calcMonths = () => {
    const t = parseFloat(document.getElementById('sm-target').value) || 0;
    const c = parseFloat(document.getElementById('sm-current').value) || 0;
    const m = parseFloat(document.getElementById('sm-monthly').value) || 0;
    const est = document.getElementById('sm-estimate');
    const remaining = Math.max(0, t - c);
    est.textContent = (m > 0 && t > 0) ? `≈${Math.ceil(remaining / m)} месяцев при взносе ${m.toLocaleString()}` : '';
  };
  document.getElementById('sm-save').onclick = async () => {
    const g = document.getElementById('sm-goal').value, t = parseFloat(document.getElementById('sm-target').value);
    if (!g || !t) return;
    await addSavingsPlan(g, t, parseFloat(document.getElementById('sm-monthly').value) || 0, parseFloat(document.getElementById('sm-current').value) || 0);
    closeModal(); renderSavings();
  };
}

async function showWishlistModal() {
  showModal(`<button class="modal-close" onclick="closeModal()">×</button><h2>Добавить желание</h2>
    <div class="form-group"><label>Цель</label><input id="wm-item" placeholder="Что хотите"></div>
    <div class="form-group"><label>Цена</label><input type="number" id="wm-cost" placeholder="0"></div>
    <div class="form-group"><label>Примечание</label><input id="wm-purpose" placeholder="Ссылка или описание (до 200 символов)" maxlength="200"></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn" id="wm-save" style="border-color:var(--green);color:var(--green);">Добавить</button></div>`);
  document.getElementById('wm-save').onclick = async () => {
    const item = document.getElementById('wm-item').value; if (!item) return;
    await addWishlistItem(item, parseFloat(document.getElementById('wm-cost').value) || 0, document.getElementById('wm-purpose').value);
    closeModal(); renderSavings();
  };
}

// ═══ Investments ═══
async function renderInvestments() {
  const items = await listInvestments();
  const c = document.getElementById('content');
  let h = `<div class="section-actions"><span></span><button class="btn-add" onclick="showInvestmentModal()" title="Добавить">+</button></div>`;
  items.forEach(i => h += `<div class="card">
    <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;"><b>${i.asset_name}</b><span style="color:var(--text-muted);font-size:0.85rem;">${i.asset_type} &bull; ${i.currency}</span></div>
    <table style="width:auto;margin-bottom:0.5rem;"><tbody>
      <tr><td style="border:none;padding:2px 16px 2px 0;font-size:0.85rem;">Цена покупки:</td><td style="border:none;font-size:0.85rem;">${i.buy_price.toLocaleString()}</td><td style="border:none;padding:2px 16px 2px 0;font-size:0.85rem;">Количество:</td><td style="border:none;font-size:0.85rem;">${i.quantity}</td></tr>
      <tr><td style="border:none;padding:2px 16px 2px 0;font-size:0.85rem;">Инвестировано:</td><td style="border:none;font-size:0.85rem;">${Math.round(i.invested).toLocaleString()}</td><td style="border:none;padding:2px 16px 2px 0;font-size:0.85rem;">Тек. цена:</td><td style="border:none;font-size:0.85rem;">${i.current_price?i.current_price.toLocaleString():'не задана'}</td></tr>
      <tr><td style="border:none;padding:2px 16px 2px 0;font-size:0.85rem;">Тек. стоимость:</td><td style="border:none;font-size:0.85rem;">${Math.round(i.current_value).toLocaleString()}</td><td style="border:none;padding:2px 16px 2px 0;font-size:0.85rem;">PnL:</td><td style="border:none;font-size:0.85rem;font-weight:700;color:${i.pnl>=0?'var(--green)':'var(--red)'}">${i.pnl>=0?'+':''}${Math.round(i.pnl).toLocaleString()} (${i.pnl_pct}%)</td></tr>
    </tbody></table>
    ${i.note?`<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.5rem;">Примечание: ${i.note}</div>`:''}
    <div style="display:flex;gap:6px;"><button class="btn small" onclick="updatePriceAction(${i.id})">Обновить цену</button><button class="btn small btn-del" onclick="deleteInvestmentAction(${i.id})" style="border-radius:var(--radius);">-</button></div>
  </div>`);
  if (!items.length) h += '<div style="text-align:center;padding:24px;color:var(--text-muted);">Нет активов</div>';
  c.innerHTML = h;
}
window.updatePriceAction = async (id) => { const p = parseFloat(prompt('Новая текущая цена:')); if (p > 0) { await updateInvestmentPrice(id, p); renderInvestments(); } };
window.deleteInvestmentAction = async (id) => { if (confirm('Удалить актив?')) { await deleteInvestment(id); renderInvestments(); } };

async function showInvestmentModal() {
  const today = new Date().toISOString().slice(0,10);
  showModal(`<button class="modal-close" onclick="closeModal()">×</button><h2>Добавить актив</h2>
    <div class="form-group"><label>Тип</label><select id="iv-type"><option>Акция</option><option>Облигация</option><option>Крипта</option><option>Сырьё</option><option>Предмет</option></select></div>
    <div class="form-group"><label>Название</label><input id="iv-name" placeholder="Название"></div>
    <div class="form-group"><label>Цена покупки</label><input type="number" id="iv-price" placeholder="0"></div>
    <div class="form-group"><label>Количество</label><input type="number" id="iv-qty" step="any" placeholder="0"></div>
    <div class="form-group"><label>Валюта</label><select id="iv-currency"><option>RUB</option><option>USD</option><option>EUR</option></select></div>
    <div class="form-group"><label>Примечание</label><input id="iv-note"></div>
    <div class="form-group"><label>Дата покупки</label><input type="date" id="iv-date" value="${today}"></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Отмена</button><button class="btn" id="iv-save" style="border-color:var(--green);color:var(--green);">Добавить</button></div>`);
  document.getElementById('iv-save').onclick = async () => {
    const n = document.getElementById('iv-name').value, p = parseFloat(document.getElementById('iv-price').value), q = parseFloat(document.getElementById('iv-qty').value);
    if (!n || !p || !q) return;
    await addInvestment(n, document.getElementById('iv-type').value, p, q, document.getElementById('iv-currency').value, document.getElementById('iv-note').value, document.getElementById('iv-date').value);
    closeModal(); renderInvestments();
  };
}

// ═══ Sync ═══
function renderSync() {
  const c = document.getElementById('content');
  const token = getToken();
  c.innerHTML = `<div class="card"><h2>GitHub Токен</h2><div class="form-row"><input type="password" id="sync-token" value="${token}" placeholder="ghp_..." style="flex:2;"><button class="btn" onclick="saveToken()">Сохранить</button></div><div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">Создайте токен с правами gist на github.com/settings/tokens</div></div>
    <div class="card"><div style="display:flex;gap:8px;"><button class="btn" onclick="doPush()" ${!token?'disabled':''}>Выгрузить</button><button class="btn" onclick="doPull()" ${!token?'disabled':''}>Загрузить</button><button class="btn" onclick="doSync()" ${!token?'disabled':''}>Синхронизировать</button></div><div class="sync-log" id="sync-log">Лог операций</div></div>`;
}
window.saveToken = () => { const t = document.getElementById('sync-token').value.trim(); if (t) { setToken(t); renderSync(); } };
function syncLog(msg) { const el = document.getElementById('sync-log'); if (el) el.textContent += '\n' + msg; }
window.doPush = async () => { try { syncLog('Выгружено. Gist: ' + await pushToGist(getToken())); } catch (e) { syncLog('Ошибка: ' + e.message); } };
window.doPull = async () => { try { const d = await pullFromGist(getToken()); if (d) { await importData(d); syncLog('Загружено и слито'); } else syncLog('Нет данных'); } catch (e) { syncLog('Ошибка: ' + e.message); } };
window.doSync = async () => { try { syncLog('Синхронизация завершена. Gist: ' + await syncGist(getToken())); } catch (e) { syncLog('Ошибка: ' + e.message); } };

(async () => { await openDB(); await seedIfEmpty(); init(); })();