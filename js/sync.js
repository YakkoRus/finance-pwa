// GitHub Gist синхронизация
const TOKEN_KEY = 'finance_github_token';
const GIST_ID_KEY = 'finance_gist_id';

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function getGistId() { return localStorage.getItem(GIST_ID_KEY) || ''; }
function setGistId(id) { localStorage.setItem(GIST_ID_KEY, id); }

async function exportData() {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    expense_categories: await getAll('expense_categories'),
    expenses: await getAll('expenses'),
    income: await getAll('income'),
    savings_plan: await getAll('savings_plan'),
    savings_transactions: await getAll('savings_transactions'),
    investments: await getAll('investments'),
    wishlist: await getAll('wishlist'),
  };
}

async function importData(data) {
  // Мердж: добавляем только записи с id, которых ещё нет локально
  const merge = async (store, items) => {
    const existing = await getAll(store);
    const existingIds = new Set(existing.map(i => i.id));
    for (const item of items) {
      if (!existingIds.has(item.id)) {
        await updateItem(store, item); // put = insert or update
      }
    }
  };
  await merge('expense_categories', data.expense_categories || []);
  await merge('expenses', data.expenses || []);
  await merge('income', data.income || []);
  await merge('savings_plan', data.savings_plan || []);
  await merge('savings_transactions', data.savings_transactions || []);
  await merge('investments', data.investments || []);
  await merge('wishlist', data.wishlist || []);
}

async function pushToGist(token) {
  if (!token) throw new Error('Токен не задан');
  const data = await exportData();
  const json = JSON.stringify(data, null, 2);
  const headers = {
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github.v3+json',
  };
  let gistId = getGistId();
  if (gistId) {
    const resp = await fetch('https://api.github.com/gists/' + gistId, {
      method: 'PATCH', headers, body: JSON.stringify({ files: { 'finance.json': { content: json } } }),
    });
    if (!resp.ok) throw new Error('Ошибка обновления gist: ' + resp.status);
  } else {
    const resp = await fetch('https://api.github.com/gists', {
      method: 'POST', headers, body: JSON.stringify({
        description: 'Finance DB backup', public: false,
        files: { 'finance.json': { content: json } },
      }),
    });
    if (!resp.ok) throw new Error('Ошибка создания gist: ' + resp.status);
    const gist = await resp.json();
    setGistId(gist.id);
    gistId = gist.id;
  }
  return gistId;
}

async function pullFromGist(token) {
  if (!token) throw new Error('Токен не задан');
  const gistId = getGistId();
  if (!gistId) return null;
  const headers = { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' };
  const resp = await fetch('https://api.github.com/gists/' + gistId, { headers });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error('Ошибка загрузки gist: ' + resp.status);
  const gist = await resp.json();
  const files = gist.files || {};
  if (!files['finance.json']) return null;
  try {
    return JSON.parse(files['finance.json'].content);
  } catch (e) { return null; }
}

async function syncGist(token) {
  const remote = await pullFromGist(token);
  await pushToGist(token);
  if (remote) {
    await importData(remote);
    await pushToGist(token);
  }
  return getGistId();
}