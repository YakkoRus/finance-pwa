// IndexedDB wrapper — 7 таблиц, как в schema.sql
const DB_NAME = 'finance';
const DB_VERSION = 1;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      // expense_categories
      if (!d.objectStoreNames.contains('expense_categories')) {
        const store = d.createObjectStore('expense_categories', { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: true });
      }
      // expenses
      if (!d.objectStoreNames.contains('expenses')) {
        const store = d.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
        store.createIndex('category_id', 'category_id');
        store.createIndex('date', 'date');
      }
      // income
      if (!d.objectStoreNames.contains('income')) {
        const store = d.createObjectStore('income', { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date');
      }
      // savings_plan
      if (!d.objectStoreNames.contains('savings_plan')) {
        d.createObjectStore('savings_plan', { keyPath: 'id', autoIncrement: true });
      }
      // savings_transactions
      if (!d.objectStoreNames.contains('savings_transactions')) {
        const store = d.createObjectStore('savings_transactions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('plan_id', 'plan_id');
      }
      // investments
      if (!d.objectStoreNames.contains('investments')) {
        d.createObjectStore('investments', { keyPath: 'id', autoIncrement: true });
      }
      // wishlist
      if (!d.objectStoreNames.contains('wishlist')) {
        d.createObjectStore('wishlist', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getAll(storeName) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getById(storeName, id) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(storeName, 'readonly').objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function addItem(storeName, item) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(storeName, 'readwrite').objectStore(storeName).add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function updateItem(storeName, item) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(storeName, 'readwrite').objectStore(storeName).put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteItem(storeName, id) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(storeName, 'readwrite').objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function clearStore(storeName) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(storeName, 'readwrite').objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function seedIfEmpty() {
  const cats = await getAll('expense_categories');
  if (cats.length > 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const catColors = {
    'Продукты': '#3fb950', 'Транспорт': '#58a6ff', 'Развлечения': '#a371f7',
    'Здоровье': '#f85149', 'Кафе и рестораны': '#d2991d', 'Одежда': '#f778ba',
    'Коммуналка': '#7ee787', 'Связь': '#a5d6ff', 'Подписки': '#e3b341',
  };
  const catNames = Object.keys(catColors);
  const catIds = {};
  for (const name of catNames) {
    catIds[name] = await addItem('expense_categories', { name, color: catColors[name] });
  }

  const expenses = [
    [catIds['Продукты'], 'Хлеб, молоко, яйца', 520, today],
    [catIds['Продукты'], 'Овощи и фрукты', 890, yesterday],
    [catIds['Транспорт'], 'Проездной на месяц', 2800, weekAgo],
    [catIds['Развлечения'], 'Кино', 500, yesterday],
    [catIds['Здоровье'], 'Аптека', 1350, weekAgo],
    [catIds['Кафе и рестораны'], 'Обед в кафе', 650, today],
    [catIds['Одежда'], 'Куртка', 5000, weekAgo],
    [catIds['Коммуналка'], 'Квартплата', 5200, weekAgo],
    [catIds['Связь'], 'Мобильная связь', 500, weekAgo],
    [catIds['Подписки'], 'YouTube Premium', 299, weekAgo],
  ];
  for (const [cid, product, amount, date] of expenses) {
    await addItem('expenses', { category_id: cid, product, amount, quantity: 1, weight: null, date });
  }

  await addItem('income', { source: 'Зарплата', equivalent: 'card', currency: 'RUB', amount: 75000, note: 'Основная работа', date: weekAgo });
  await addItem('income', { source: 'Подработка', equivalent: 'cash', currency: 'RUB', amount: 12000, note: 'Фриланс', date: yesterday });
  await addItem('income', { source: 'Кэшбек', equivalent: 'card', currency: 'RUB', amount: 350, note: '', date: today });

  const plan1 = await addItem('savings_plan', { goal_name: 'Подушка безопасности', target_amount: 100000, current_amount: 25000, monthly_contribution: 5000, deadline: null, status: 'active' });
  const plan2 = await addItem('savings_plan', { goal_name: 'Отпуск', target_amount: 80000, current_amount: 10000, monthly_contribution: 8000, deadline: new Date(Date.now() + 300 * 86400000).toISOString().slice(0, 10), status: 'inactive' });
  await addItem('savings_plan', { goal_name: 'Ноутбук', target_amount: 60000, current_amount: 60000, monthly_contribution: 10000, deadline: null, status: 'completed' });

  await addItem('savings_transactions', { plan_id: plan1, amount: 5000, note: 'Ежемесячное пополнение', date: weekAgo });
  await addItem('savings_transactions', { plan_id: plan1, amount: 5000, note: 'Ежемесячное пополнение', date: yesterday });
  await addItem('savings_transactions', { plan_id: plan2, amount: 8000, note: 'Первый взнос', date: weekAgo });

  await addItem('investments', { asset_name: 'S&P 500 ETF', asset_type: 'Акция', buy_price: 420, quantity: 10, current_price: 450, currency: 'USD', note: 'Индексный фонд', buy_date: weekAgo });
  await addItem('investments', { asset_name: 'BTC', asset_type: 'Крипта', buy_price: 35000, quantity: 0.05, current_price: 40000, currency: 'USD', note: 'Биткоин', buy_date: weekAgo });
  await addItem('investments', { asset_name: 'ОФЗ 26230', asset_type: 'Облигация', buy_price: 1000, quantity: 50, current_price: 980, currency: 'RUB', note: 'Гос. облигации', buy_date: weekAgo });
  await addItem('investments', { asset_name: 'Золото', asset_type: 'Сырьё', buy_price: 5500, quantity: 2, current_price: 5700, currency: 'RUB', note: 'Золотой слиток ОМС', buy_date: weekAgo });

  await addItem('wishlist', { item: 'AirPods Pro', purpose: 'Для тренировок', estimated_cost: 25000 });
  await addItem('wishlist', { item: 'Курс по Flutter', purpose: 'Обучение', estimated_cost: 5000 });
  await addItem('wishlist', { item: 'Велосипед', purpose: 'Спорт и транспорт', estimated_cost: 30000 });
  await addItem('wishlist', { item: 'Наушники Sony WH-1000XM4', purpose: 'https://ozon.ru/example', estimated_cost: 20000 });
}