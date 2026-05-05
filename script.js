const STORAGE_KEY = 'ncc_local_v1';
const APP_SCHEMA_VERSION = 4;
const BACKUP_PREFIX = 'ncc_local_backup_';
const MAX_AUTO_BACKUPS = 5;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
    const moods = ['Calm', 'Strong', 'Sad', 'Anxious', 'Tempted', 'Hopeful'];
    const triggerOptions = ['Loneliness', 'Night time', 'Their photo', 'Social media', 'Music', 'Boredom', 'Anxiety', 'Dream', 'Alcohol', 'Memory'];
    const groundingSteps = [
      'Name 5 things you can see. Then breathe slowly.',
      'Name 4 things you can feel: your feet, your chair, your clothes, the air.',
      'Name 3 things you can hear. Let the urge be background noise.',
      'Name 2 things you can smell. Relax your jaw and shoulders.',
      'Name 1 kind thing you can do for yourself in the next 5 minutes.'
    ];
    const milestones = [1, 3, 7, 14, 30, 60, 90];
    const quotes = [
      'You do not need to reopen the wound to prove it hurt.',
      'Peace is built by small choices repeated quietly.',
      'Missing them is not a command to contact them.',
      'The urge will pass. Your self-respect can stay.',
      'You are allowed to protect your healing.',
      'Today, silence can be an act of love toward yourself.',
      'You are not weak for feeling. You are strong for pausing.'
    ];

function ensureNextFeatureState() {
  state.todayPlanItems = Array.isArray(state.todayPlanItems) && state.todayPlanItems.length
    ? state.todayPlanItems
    : [...DEFAULT_TODAY_PLAN_ITEMS];

  state.todayPlanChecks = state.todayPlanChecks && typeof state.todayPlanChecks === 'object'
    ? state.todayPlanChecks
    : {};

  state.boundaryChecks = state.boundaryChecks && typeof state.boundaryChecks === 'object'
    ? state.boundaryChecks
    : {};

  state.safePeople = Array.isArray(state.safePeople) ? state.safePeople : [];
  state.contactCost = typeof state.contactCost === 'string' ? state.contactCost : '';
  state.privacyMode = Boolean(state.privacyMode);
}

function saveNextFeatureState() {
  ensureNextFeatureState();
  saveState();
}

function safeText(value) {
  return escapeHtml(String(value || ''));
}

function getTodayArrayMap(containerKey) {
  const today = todayKey();
  if (!state[containerKey] || typeof state[containerKey] !== 'object') state[containerKey] = {};
  if (!Array.isArray(state[containerKey][today])) state[containerKey][today] = [];
  return state[containerKey][today];
}

function renderTodayPlan() {
  ensureNextFeatureState();
  const wrap = document.getElementById('todayPlanList');
  if (!wrap) return;
  const checked = new Set(getTodayArrayMap('todayPlanChecks'));
  wrap.innerHTML = state.todayPlanItems.map((item, index) => {
    const done = checked.has(index);
    return `
      <label class="check-item ${done ? 'done' : ''}">
        <input type="checkbox" data-plan-index="${index}" ${done ? 'checked' : ''} />
        <span>${safeText(item)}</span>
      </label>
    `;
  }).join('');
}

function renderBoundaryTracker() {
  ensureNextFeatureState();
  const wrap = document.getElementById('boundaryList');
  if (!wrap) return;
  const checked = new Set(getTodayArrayMap('boundaryChecks'));
  wrap.innerHTML = DEFAULT_BOUNDARY_ITEMS.map((item, index) => {
    const done = checked.has(index);
    return `
      <label class="check-item ${done ? 'done' : ''}">
        <input type="checkbox" data-boundary-index="${index}" ${done ? 'checked' : ''} />
        <span>${safeText(item)}</span>
      </label>
    `;
  }).join('');
}

function getMostCommonValue(values) {
  const counts = values.filter(Boolean).reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries[0][0] : 'Not enough data';
}

function getHardestDayOfWeek() {
  const dates = [
    ...(state.unsentMessages || []).map(item => item.date),
    ...(state.relapses || []).map(item => item.date)
  ].filter(Boolean);

  const days = dates
    .map(value => new Date(value))
    .filter(date => !Number.isNaN(date.getTime()))
    .map(date => date.toLocaleDateString(undefined, { weekday: 'long' }));

  return getMostCommonValue(days);
}

function getAverageUrgeIntensity() {
  const values = (state.unsentMessages || [])
    .map(item => Number(item.intensity))
    .filter(value => Number.isFinite(value) && value > 0);
  if (!values.length) return 'Not enough data';
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
}

function getMostCommonTrigger() {
  const relapseTriggers = (state.relapses || []).map(item => item.trigger).filter(Boolean);
  const urgeTriggers = (state.unsentMessages || [])
    .flatMap(item => Array.isArray(item.triggers) ? item.triggers : [])
    .filter(Boolean);
  return getMostCommonValue([...relapseTriggers, ...urgeTriggers]);
}

function renderProgressInsights() {
  ensureNextFeatureState();
  const wrap = document.getElementById('progressInsights');
  if (!wrap) return;
  const moodValues = Object.values(state.reflections || {}).map(item => item?.mood).filter(Boolean);
  const checkedBoundaries = Object.values(state.boundaryChecks || {}).reduce((sum, arr) => {
    return sum + (Array.isArray(arr) ? arr.length : 0);
  }, 0);

  const insights = [
    ['Most common mood', getMostCommonValue(moodValues)],
    ['Most common trigger', getMostCommonTrigger()],
    ['Hardest day', getHardestDayOfWeek()],
    ['Avg. urge intensity', getAverageUrgeIntensity()],
    ['Saved-not-sent', String((state.unsentMessages || []).length)],
    ['Boundary wins', String(checkedBoundaries)]
  ];

  wrap.innerHTML = insights.map(([label, value]) => `
    <div class="insight-card">
      <strong>${safeText(value)}</strong>
      <span>${safeText(label)}</span>
    </div>
  `).join('');
}

function renderSafePeople() {
  ensureNextFeatureState();
  const list = document.getElementById('safePeopleList');
  const preview = document.getElementById('safePeoplePreview');
  const people = state.safePeople || [];

  const html = people.length
    ? people.map((person, index) => `
      <div class="list-item sensitive">
        <strong>${safeText(person.name)}</strong>
        <small>${safeText(person.contact)}</small>
        <p>${safeText(person.note || 'Someone safer than contacting them.')}</p>
        <button class="ghost-btn" type="button" data-delete-safe-person="${index}">Remove</button>
      </div>
    `).join('')
    : '<p class="subtitle">No safe people added yet.</p>';

  if (list) list.innerHTML = html;
  if (preview) {
    preview.innerHTML = people.length
      ? people.slice(0, 3).map(person => `
        <div class="list-item sensitive">
          <strong>${safeText(person.name)}</strong>
          <small>${safeText(person.contact)}</small>
        </div>
      `).join('')
      : '<p class="subtitle">No safe people saved yet. Add one in the Emergency tab.</p>';
  }
}

function renderContactCost() {
  ensureNextFeatureState();
  const text = document.getElementById('contactCostText');
  const preview = document.getElementById('contactCostPreview');
  if (text) text.value = state.contactCost || '';
  if (preview) {
    preview.textContent = state.contactCost || 'No contact cost reminder saved yet. You can add one in the Emergency tab.';
    preview.classList.add('sensitive');
  }
}

function renderPrivacyMode() {
  ensureNextFeatureState();
  document.body.classList.toggle('privacy-on', state.privacyMode);
  const btn = document.getElementById('privacyModeToggle');
  const notice = document.getElementById('privacyNotice');

  if (btn) {
    btn.textContent = state.privacyMode ? 'Disable privacy mode' : 'Enable privacy mode';
  }

  if (notice) {
    notice.textContent = state.privacyMode
      ? 'Privacy mode is on. Sensitive notes and contact details are blurred.'
      : 'Privacy mode is off.';
    notice.classList.toggle('hidden', !state.privacyMode);
  }
}

function renderTodayPlanEditor() {
  ensureNextFeatureState();
  const editor = document.getElementById('todayPlanEditor');
  if (editor) editor.value = state.todayPlanItems.join('\n');
}

function renderNextFeatures() {
  ensureNextFeatureState();
  renderTodayPlan();
  renderBoundaryTracker();
  renderProgressInsights();
  renderSafePeople();
  renderContactCost();
  renderPrivacyMode();
  renderTodayPlanEditor();
}

document.addEventListener('click', event => {
  const safeDelete = event.target.closest('[data-delete-safe-person]');
  if (safeDelete) {
    const index = Number(safeDelete.dataset.deleteSafePerson);
    if (!Number.isInteger(index)) return;
    state.safePeople.splice(index, 1);
    saveNextFeatureState();
    showToast('Safe person removed');
  }
});

document.addEventListener('change', event => {
  const planBox = event.target.closest('[data-plan-index]');
  if (planBox) {
    const index = Number(planBox.dataset.planIndex);
    const checked = getTodayArrayMap('todayPlanChecks');
    state.todayPlanChecks[todayKey()] = planBox.checked
      ? [...new Set([...checked, index])]
      : checked.filter(item => item !== index);
    saveNextFeatureState();
    return;
  }

  const boundaryBox = event.target.closest('[data-boundary-index]');
  if (boundaryBox) {
    const index = Number(boundaryBox.dataset.boundaryIndex);
    const checked = getTodayArrayMap('boundaryChecks');
    state.boundaryChecks[todayKey()] = boundaryBox.checked
      ? [...new Set([...checked, index])]
      : checked.filter(item => item !== index);
    saveNextFeatureState();
  }
});

function bindNextFeatureEvents() {
  const resetTodayPlanBtn = document.getElementById('resetTodayPlanBtn');
  if (resetTodayPlanBtn) {
    resetTodayPlanBtn.addEventListener('click', () => {
      state.todayPlanChecks[todayKey()] = [];
      saveNextFeatureState();
      showToast('Today plan reset');
    });
  }

  const saveContactCostBtn = document.getElementById('saveContactCostBtn');
  if (saveContactCostBtn) {
    saveContactCostBtn.addEventListener('click', () => {
      state.contactCost = document.getElementById('contactCostText').value.trim();
      saveNextFeatureState();
      showToast('Contact cost reminder saved');
    });
  }

  const addSafePersonBtn = document.getElementById('addSafePersonBtn');
  if (addSafePersonBtn) {
    addSafePersonBtn.addEventListener('click', () => {
      const name = document.getElementById('safePersonName').value.trim();
      const contact = document.getElementById('safePersonContact').value.trim();
      const note = document.getElementById('safePersonNote').value.trim();

      if (!name && !contact) return showToast('Add a name or contact first');

      state.safePeople.unshift({
        name: name || 'Safe person',
        contact,
        note,
        createdAt: new Date().toISOString()
      });

      document.getElementById('safePersonName').value = '';
      document.getElementById('safePersonContact').value = '';
      document.getElementById('safePersonNote').value = '';
      saveNextFeatureState();
      showToast('Safe person added');
    });
  }

  const privacyModeToggle = document.getElementById('privacyModeToggle');
  if (privacyModeToggle) {
    privacyModeToggle.addEventListener('click', () => {
      state.privacyMode = !state.privacyMode;
      saveNextFeatureState();
      showToast(state.privacyMode ? 'Privacy mode enabled' : 'Privacy mode disabled');
    });
  }

  const saveTodayPlanItemsBtn = document.getElementById('saveTodayPlanItemsBtn');
  if (saveTodayPlanItemsBtn) {
    saveTodayPlanItemsBtn.addEventListener('click', () => {
      const items = document.getElementById('todayPlanEditor').value
        .split('\n')
        .map(item => item.trim())
        .filter(Boolean);

      if (!items.length) return showToast('Add at least one checklist item');

      state.todayPlanItems = items.slice(0, 20);
      saveNextFeatureState();
      showToast('Today plan updated');
    });
  }

  const restoreDefaultPlanBtn = document.getElementById('restoreDefaultPlanBtn');
  if (restoreDefaultPlanBtn) {
    restoreDefaultPlanBtn.addEventListener('click', () => {
      state.todayPlanItems = [...DEFAULT_TODAY_PLAN_ITEMS];
      saveNextFeatureState();
      showToast('Default plan restored');
    });
  }
}

function initApp() {
  ensureNextFeatureState();
  bindNextFeatureEvents();
  updateTimerDisplay();
  render();
}

initApp();
