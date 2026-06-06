// Бизнес-логика

function fmtDate(iso) {
  if (!iso || iso.length < 10) return iso;
  return iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(2, 4);
}

function categoryName(categories, id) {
  const c = categories.find(c => c.id === id);
  return c ? c.name : 'id=' + id;
}

function categoryColor(categories, id) {
  const c = categories.find(c => c.id === id);
  return c ? c.color : null;
}

// ── Категории ──
async function listCategories() { return getAll('expense_categories'); }
async function addCategory(name, color) { return addItem('expense_categories', { name, color }); }
async function updateCategory(id, name, color) {
  const cat = await getById('expense_categories', id);
  cat.name = name;
  cat.color = color;
  await updateItem('expense_categories', cat);
  return cat;
}
async function deleteCategory(id) {
  const used = (await getAll('expenses')).some(e => e.category_id === id);
  if (used) throw new Error('Категория используется в расходах');
  await deleteItem('expense_categories', id);
}

// Расходы
async function listExpenses(filters = {}) {
  const { search = '', categoryId = null, sortField = 'date', sortDir = 'desc', dateFrom = '', dateTo = '' } = filters;
  let all = await getAll('expenses');
  if (search) all = all.filter(e => e.product.toLowerCase().includes(search.toLowerCase()));
  if (categoryId !== null) all = all.filter(e => e.category_id === categoryId);
  if (dateFrom) all = all.filter(e => e.date >= dateFrom);
  if (dateTo) all = all.filter(e => e.date <= dateTo);
  const mult = sortDir === 'asc' ? 1 : -1;
  all.sort((a, b) => {
    if (sortField === 'amount') return (a.amount - b.amount) * mult;
    if (sortField === 'product') return a.product.localeCompare(b.product) * mult;
    return (a.date || '').localeCompare(b.date || '') * mult;
  });
  return all;
}

async function addExpense(category_id, product, amount, date) {
  return addItem('expenses', { category_id, product, amount, quantity: 1, weight: null, date });
}

async function deleteExpense(id) {
  return deleteItem('expenses', id);
}

// Доходы
async function listIncome() {
  const all = await getAll('income');
  all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return all;
}

async function addIncome(source, equivalent, currency, amount, note, date) {
  return addItem('income', { source, equivalent, currency, amount, note, date });
}

async function deleteIncome(id) {
  return deleteItem('income', id);
}

// Накопления (статусы: active=Активен, inactive=Не активен, completed=Выполнено)
async function listSavingsPlans() {
  const plans = await getAll('savings_plan');
  const txs = await getAll('savings_transactions');
  for (const p of plans) {
    p.percent = p.target_amount > 0 ? Math.round(p.current_amount / p.target_amount * 100) : 0;
    p.months_remaining = (p.monthly_contribution > 0 && p.status === 'active')
      ? Math.ceil((p.target_amount - p.current_amount) / p.monthly_contribution) : 0;
    p.transactions = txs.filter(t => t.plan_id === p.id);
  }
  return plans;
}

async function addSavingsPlan(goal_name, target_amount, monthly_contribution) {
  return addItem('savings_plan', { goal_name, target_amount, current_amount: 0, monthly_contribution, deadline: null, status: 'active' });
}

async function topupPlan(planId, amount) {
  const plan = await getById('savings_plan', planId);
  await addItem('savings_transactions', { plan_id: planId, amount, note: 'Пополнение', date: new Date().toISOString().slice(0, 10) });
  plan.current_amount += amount;
  if (plan.current_amount >= plan.target_amount) plan.status = 'completed';
  await updateItem('savings_plan', plan);
  return plan;
}

async function withdrawPlan(planId, amount) {
  const plan = await getById('savings_plan', planId);
  if (plan.current_amount < amount) throw new Error('Сумма снятия превышает накопленное');
  await addItem('savings_transactions', { plan_id: planId, amount: -amount, note: 'Снятие', date: new Date().toISOString().slice(0, 10) });
  plan.current_amount -= amount;
  if (plan.status === 'completed' && plan.current_amount < plan.target_amount) plan.status = 'active';
  await updateItem('savings_plan', plan);
  return plan;
}

async function updatePlanStatus(planId, status) {
  const plan = await getById('savings_plan', planId);
  plan.status = status;
  await updateItem('savings_plan', plan);
}

async function deleteSavingsPlan(planId) {
  const txs = await getAll('savings_transactions');
  for (const t of txs.filter(t => t.plan_id === planId)) await deleteItem('savings_transactions', t.id);
  await deleteItem('savings_plan', planId);
}

// Инвестиции
async function listInvestments() {
  const all = await getAll('investments');
  for (const i of all) {
    i.invested = i.buy_price * i.quantity;
    i.current_value = (i.current_price || i.buy_price) * i.quantity;
    i.pnl = i.current_value - i.invested;
    i.pnl_pct = i.invested > 0 ? Math.round(i.pnl / i.invested * 1000) / 10 : 0;
  }
  return all;
}

async function addInvestment(asset_name, asset_type, buy_price, quantity, currency, note, buy_date) {
  return addItem('investments', { asset_name, asset_type, buy_price, quantity, current_price: null, currency, note, buy_date });
}

async function updateInvestmentPrice(assetId, current_price) {
  const inv = await getById('investments', assetId);
  inv.current_price = current_price;
  await updateItem('investments', inv);
}

async function deleteInvestment(assetId) { await deleteItem('investments', assetId); }

// Wishlist
async function listWishlist() { return getAll('wishlist'); }
async function addWishlistItem(item, estimated_cost, purpose) {
  return addItem('wishlist', { item, estimated_cost, purpose: (purpose || '').slice(0, 200) });
}
async function deleteWishlistItem(id) { await deleteItem('wishlist', id); }

// Дашборд
async function dashboardSummary() {
  const inc = await getAll('income');
  const exp = await getAll('expenses');
  const sav = await getAll('savings_plan');
  const inv = await getAll('investments');
  const wish = await getAll('wishlist');

  const totalIncome = inc.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = exp.reduce((s, e) => s + e.amount, 0);
  const totalSavings = sav.reduce((s, p) => s + p.current_amount, 0);
  const totalInvested = inv.reduce((s, i) => s + i.buy_price * i.quantity, 0);
  const totalCurrentValue = inv.reduce((s, i) => s + (i.current_price || i.buy_price) * i.quantity, 0);
  const wishlistTotal = wish.reduce((s, w) => s + (w.estimated_cost || 0), 0);

  return {
    totalIncome, totalExpenses, balance: totalIncome - totalExpenses,
    totalSavings, wallet: totalIncome - totalExpenses,
    totalInvestments: totalInvested, currentInvestmentValue: totalCurrentValue,
    wishlistItems: wish.length, wishlistTotal,
  };
}

async function monthlyBreakdown(months = 6) {
  const inc = await getAll('income');
  const exp = await getAll('expenses');
  const map = {};
  for (const i of inc) {
    const k = i.date.slice(0, 7); if (!map[k]) map[k] = { income: 0, expenses: 0 };
    map[k].income += i.amount;
  }
  for (const e of exp) {
    const k = e.date.slice(0, 7); if (!map[k]) map[k] = { income: 0, expenses: 0 };
    map[k].expenses += e.amount;
  }
  return Object.keys(map).sort().slice(-months).map(k => ({
    month: k, income: map[k].income, expenses: map[k].expenses, balance: map[k].income - map[k].expenses,
  }));
}