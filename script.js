const STORAGE_KEY = 'ncc_local_v1';
const APP_SCHEMA_VERSION = 3;
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

    let state = loadState();
    let selectedMood = null;
    let calendarDate = new Date();
    let timerSeconds = 20 * 60;
    let timerInterval = null;
    let latestShareImageDataUrl = '';
    let selectedUrgeTriggers = new Set();
    let groundingStepIndex = 0;

    function defaultState() {
      return {
        meta: {
          schemaVersion: APP_SCHEMA_VERSION,
          updatedAt: ''
        },
        username: '',
        checkins: [],
        reflections: {},
        reasons: '',
        unsentMessages: [],
        relapses: [],
        letters: [],
        shareImageTemplate: 'soft',
        shareImageSize: 'portrait',
        reminderTime: '',
        reminderLastShown: ''
      };
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultState();
        const parsed = JSON.parse(raw);
        const migrated = migrateState(parsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch {
        return defaultState();
      }
    }

    function saveState({ skipRender = false } = {}) {
      state = normalizeState({
        ...state,
        meta: {
          ...(state.meta || {}),
          schemaVersion: APP_SCHEMA_VERSION,
          updatedAt: new Date().toISOString()
        }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (!skipRender) render();
    }

    function migrateState(rawState) {
      const incomingVersion = Number(rawState?.meta?.schemaVersion || rawState?.schemaVersion || 1);
      let nextState = rawState && typeof rawState === 'object' ? { ...rawState } : defaultState();

      // Before changing an older saved structure, keep a local backup.
      // This protects users when the website is updated with new features later.
      if (incomingVersion < APP_SCHEMA_VERSION) {
        createLocalBackup(`Before automatic migration from v${incomingVersion} to v${APP_SCHEMA_VERSION}`, nextState);
      }

      // v2: add explicit metadata and normalize relapse records with breakDate.
      if (incomingVersion < 2) {
        nextState.meta = {
          schemaVersion: 2,
          migratedAt: new Date().toISOString(),
          previousSchemaVersion: incomingVersion
        };
        nextState.relapses = Array.isArray(nextState.relapses)
          ? nextState.relapses.map(item => ({
              ...item,
              breakDate: item?.breakDate || (item?.date ? todayKey(new Date(item.date)) : '')
            }))
          : [];
      }

      // v3: add trigger tracking, private letters, and share image preferences.
      if (incomingVersion < 3) {
        nextState.letters = Array.isArray(nextState.letters) ? nextState.letters : [];
        nextState.shareImageTemplate = nextState.shareImageTemplate || 'soft';
        nextState.shareImageSize = nextState.shareImageSize || 'portrait';
        nextState.unsentMessages = Array.isArray(nextState.unsentMessages)
          ? nextState.unsentMessages.map(item => ({ ...item, triggers: Array.isArray(item?.triggers) ? item.triggers : [] }))
          : [];
      }

      return normalizeState(nextState);
    }

    function normalizeState(data) {
      const base = defaultState();
      const safe = data && typeof data === 'object' ? data : {};
      const merged = { ...base, ...safe };

      merged.meta = {
        ...base.meta,
        ...(safe.meta && typeof safe.meta === 'object' ? safe.meta : {}),
        schemaVersion: APP_SCHEMA_VERSION
      };

      merged.username = typeof merged.username === 'string' ? merged.username : '';
      merged.reasons = typeof merged.reasons === 'string' ? merged.reasons : '';
      merged.reminderTime = typeof merged.reminderTime === 'string' ? merged.reminderTime : '';
      merged.reminderLastShown = typeof merged.reminderLastShown === 'string' ? merged.reminderLastShown : '';

      merged.checkins = Array.isArray(merged.checkins)
        ? [...new Set(merged.checkins.filter(isDateKey))].sort()
        : [];

      merged.reflections = merged.reflections && typeof merged.reflections === 'object' && !Array.isArray(merged.reflections)
        ? Object.fromEntries(Object.entries(merged.reflections).filter(([key]) => isDateKey(key)))
        : {};

      merged.unsentMessages = Array.isArray(merged.unsentMessages)
        ? merged.unsentMessages.filter(item => item && typeof item === 'object').map(item => ({
            text: typeof item.text === 'string' ? item.text : '',
            intensity: Number(item.intensity) || 5,
            triggers: Array.isArray(item.triggers) ? item.triggers.filter(Boolean).map(String) : [],
            customTrigger: typeof item.customTrigger === 'string' ? item.customTrigger : '',
            date: typeof item.date === 'string' ? item.date : new Date().toISOString()
          }))
        : [];

      merged.relapses = Array.isArray(merged.relapses)
        ? merged.relapses.filter(item => item && typeof item === 'object').map(item => ({
            what: typeof item.what === 'string' ? item.what : '',
            trigger: typeof item.trigger === 'string' ? item.trigger : '',
            breakDate: isDateKey(item.breakDate) ? item.breakDate : (item.date ? todayKey(new Date(item.date)) : ''),
            date: typeof item.date === 'string' ? item.date : new Date().toISOString()
          }))
        : [];

      merged.letters = Array.isArray(merged.letters)
        ? merged.letters.filter(item => item && typeof item === 'object').map(item => ({
            id: typeof item.id === 'string' ? item.id : `letter-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title: typeof item.title === 'string' ? item.title : '',
            body: typeof item.body === 'string' ? item.body : '',
            date: typeof item.date === 'string' ? item.date : new Date().toISOString()
          }))
        : [];

      merged.shareImageTemplate = ['soft', 'minimal', 'dark'].includes(merged.shareImageTemplate) ? merged.shareImageTemplate : 'soft';
      merged.shareImageSize = ['portrait', 'story', 'square'].includes(merged.shareImageSize) ? merged.shareImageSize : 'portrait';

      return merged;
    }

    function isDateKey(value) {
      return typeof value === 'string' && DATE_KEY_PATTERN.test(value);
    }

    function getBackupKeys() {
      return Object.keys(localStorage)
        .filter(key => key.startsWith(BACKUP_PREFIX))
        .sort();
    }

    function createLocalBackup(reason, data = state) {
      try {
        const key = `${BACKUP_PREFIX}${new Date().toISOString()}`;
        const backup = {
          reason,
          createdAt: new Date().toISOString(),
          appSchemaVersion: APP_SCHEMA_VERSION,
          data
        };
        localStorage.setItem(key, JSON.stringify(backup));
        state.lastBackupAt = backup.createdAt;
        cleanupOldBackups();
        return key;
      } catch {
        return '';
      }
    }

    function cleanupOldBackups() {
      const keys = getBackupKeys();
      const extra = keys.length - MAX_AUTO_BACKUPS;
      if (extra <= 0) return;
      keys.slice(0, extra).forEach(key => localStorage.removeItem(key));
    }

    function restoreLatestBackup() {
      const keys = getBackupKeys();
      const latestKey = keys[keys.length - 1];
      if (!latestKey) return showToast('No backup found');
      if (!confirm('Restore the latest backup? Your current progress will be backed up first.')) return;

      try {
        const currentBackupKey = createLocalBackup('Before restoring latest backup');
        const backup = JSON.parse(localStorage.getItem(latestKey));
        state = migrateState(backup.data || backup);
        saveState();
        showBackupNotice(`Latest backup restored. Your previous progress was backed up first${currentBackupKey ? '.' : ' if storage allowed it.'}`);
        showToast('Backup restored');
      } catch {
        showToast('Could not restore this backup');
      }
    }

    function showBackupNotice(message) {
      const notice = document.getElementById('backupNotice');
      if (!notice) return;
      notice.textContent = message;
      notice.classList.remove('hidden');
    }

    function todayKey(date = new Date()) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    function parseDateKey(key) {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d);
    }

    function escapeHtml(text = '') {
      return String(text).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
    }

    function uniqueSortedCheckins() {
      return [...new Set(state.checkins)].sort();
    }

    function relapseDayKeys() {
      return state.relapses
        .map(r => r?.breakDate || (r?.date ? todayKey(new Date(r.date)) : ''))
        .filter(Boolean)
        .sort();
    }

    function latestRelapseDayKey() {
      const days = relapseDayKeys();
      return days.length ? days[days.length - 1] : '';
    }

    function getStats() {
      const days = uniqueSortedCheckins();
      const set = new Set(days);
      const relapseSet = new Set(relapseDayKeys());
      const latestRelapse = latestRelapseDayKey();
      const today = todayKey();
      let current = 0;

      // Current streak should start after the latest relapse/reset.
      // A relapse today makes the current streak 0 until a future check-in.
      let cursor = parseDateKey(set.has(today) ? today : todayKey(new Date(Date.now() - 86400000)));
      while (set.has(todayKey(cursor))) {
        const key = todayKey(cursor);
        if (latestRelapse && key <= latestRelapse) break;
        current++;
        cursor.setDate(cursor.getDate() - 1);
      }

      let longest = 0;
      let run = 0;
      let prev = null;
      days.forEach(key => {
        const currentDate = parseDateKey(key);
        if (relapseSet.has(key)) {
          run = 0;
          prev = null;
          return;
        }
        if (prev) {
          const diff = Math.round((currentDate - prev) / 86400000);
          run = diff === 1 ? run + 1 : 1;
        } else {
          run = 1;
        }
        longest = Math.max(longest, run);
        prev = currentDate;
      });

      const now = new Date();
      const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const thisMonth = days.filter(d => d.startsWith(monthPrefix)).length;
      return { current, total: days.length, longest, thisMonth, checkedToday: set.has(today) };
    }

    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2300);
    }

    function switchTab(tab) {
      document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === tab));
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (tab === 'share') {
        renderShareText();
        renderShareImage();
      }
    }

    function render() {
      const hasUser = Boolean(state.username.trim());
      document.getElementById('setupScreen').classList.toggle('hidden', hasUser);
      document.getElementById('app').classList.toggle('hidden', !hasUser);
      if (!hasUser) return;

      const stats = getStats();
      document.getElementById('userChip').textContent = `Hi, ${state.username}`;
      document.getElementById('todayTag').textContent = stats.checkedToday ? 'Already checked in today' : 'Today is a new choice';
      document.getElementById('dailyQuote').textContent = quotes[Math.floor(Date.now() / 86400000) % quotes.length];
      document.getElementById('editName').value = state.username;
      document.getElementById('reasonsText').value = state.reasons || '';
      document.getElementById('shareImageTemplate').value = state.shareImageTemplate || 'soft';
      document.getElementById('shareImageSize').value = state.shareImageSize || 'portrait';

      const btn = document.getElementById('checkinBtn');
      btn.classList.toggle('done', stats.checkedToday);
      document.getElementById('checkinTitle').textContent = stats.checkedToday ? 'Already checked in today' : 'I stayed no-contact today';
      document.getElementById('checkinSub').textContent = stats.checkedToday ? 'You showed up for yourself today 🌱' : 'Tap once to record today';
      document.getElementById('reflectionBox').classList.toggle('hidden', !stats.checkedToday);

      document.getElementById('statsGrid').innerHTML = `
        <div class="stat"><strong>${stats.current}</strong><span>Current streak</span></div>
        <div class="stat"><strong>${stats.total}</strong><span>Total no-contact days</span></div>
        <div class="stat"><strong>${stats.longest}</strong><span>Longest streak</span></div>
        <div class="stat"><strong>${stats.thisMonth}</strong><span>This month</span></div>
      `;

      renderMoodButtons();
      renderCalendar();
      renderMilestones();
      renderRecentNotes();
      renderShareText();
      renderShareImage();
      renderTriggerButtons();
      renderUrgeHistory();
      renderLetters();
      renderGroundingStep();
    }

    function renderMoodButtons() {
      const today = todayKey();
      selectedMood = state.reflections[today]?.mood || selectedMood;
      document.getElementById('reflectionNote').value = state.reflections[today]?.note || '';
      document.getElementById('moodButtons').innerHTML = moods.map(m => `
        <button type="button" class="mood-btn ${selectedMood === m ? 'active' : ''}" data-mood="${m}">${m}</button>
      `).join('');
    }

    function renderCalendar() {
      const cal = document.getElementById('calendar');
      const title = document.getElementById('calendarTitle');
      const y = calendarDate.getFullYear();
      const m = calendarDate.getMonth();
      title.textContent = calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const first = new Date(y, m, 1);
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const startOffset = first.getDay();
      const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      let html = names.map(n => `<div class="weekday">${n}</div>`).join('');
      for (let i = 0; i < startOffset; i++) html += '<div class="day empty"></div>';
      const checked = new Set(state.checkins);
      const today = todayKey();
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const cls = ['day', checked.has(key) ? 'checked' : '', key === today ? 'today' : ''].join(' ');
        const moodDot = state.reflections[key]?.mood ? '<span class="mood-dot"></span>' : '';
        html += `<div class="${cls}" title="${key}"><span>${d}</span>${moodDot}</div>`;
      }
      cal.innerHTML = html;
    }

    function renderMilestones() {
      const stats = getStats();
      document.getElementById('milestones').innerHTML = milestones.map(day => {
        const unlocked = stats.current >= day || stats.total >= day;
        return `<div class="badge-card ${unlocked ? 'unlocked' : ''}"><strong>${unlocked ? '🌿' : '🔒'} ${day} day${day > 1 ? 's' : ''}</strong><span>${unlocked ? 'Unlocked' : 'Keep going gently'}</span></div>`;
      }).join('');
    }

    function renderRecentNotes() {
      const items = Object.entries(state.reflections).sort((a,b) => b[0].localeCompare(a[0])).slice(0, 6);
      document.getElementById('recentNotes').innerHTML = items.length ? items.map(([date, r]) => `
        <div class="list-item"><strong>${escapeHtml(r.mood || 'Reflection')}</strong><small>${date}</small><p>${escapeHtml(r.note || 'No note added.')}</p></div>
      `).join('') : '<div class="empty-state"><strong>No private notes yet.</strong><p>Your mood notes will appear here after check-ins.</p></div>';
    }

    function renderTriggerButtons() {
      const container = document.getElementById('triggerButtons');
      if (!container) return;
      container.innerHTML = triggerOptions.map(trigger => `
        <button type="button" class="mood-btn ${selectedUrgeTriggers.has(trigger) ? 'active' : ''}" data-trigger="${escapeHtml(trigger)}">${escapeHtml(trigger)}</button>
      `).join('');
    }

    function renderUrgeHistory() {
      const container = document.getElementById('urgeHistory');
      if (!container) return;
      const items = state.unsentMessages.slice(0, 6);
      container.innerHTML = items.length ? items.map((item, index) => {
        const triggerText = [...(item.triggers || []), item.customTrigger].filter(Boolean).join(', ') || 'No trigger saved';
        const preview = item.text.length > 110 ? `${item.text.slice(0, 110)}…` : item.text;
        return `
          <div class="list-item">
            <strong>Intensity ${escapeHtml(item.intensity)}/10</strong>
            <div class="meta-line">${escapeHtml(new Date(item.date).toLocaleString())}</div>
            <div class="meta-line">Trigger: ${escapeHtml(triggerText)}</div>
            <p class="letter-body-preview">${escapeHtml(preview)}</p>
            <div class="item-actions"><button class="ghost-btn" data-delete-urge="${index}" type="button">Delete</button></div>
          </div>
        `;
      }).join('') : '<div class="empty-state"><strong>No saved urges yet.</strong><p>That can be a good sign. If an urge comes, write it in Help instead of sending.</p></div>';
    }

    function renderLetters() {
      const container = document.getElementById('letterList');
      if (!container) return;
      const items = state.letters.slice(0, 6);
      container.innerHTML = items.length ? items.map(letter => {
        const title = letter.title || 'Untitled letter';
        const preview = letter.body.length > 130 ? `${letter.body.slice(0, 130)}…` : letter.body;
        return `
          <div class="list-item">
            <strong>${escapeHtml(title)}</strong>
            <div class="meta-line">${escapeHtml(new Date(letter.date).toLocaleString())}</div>
            <p class="letter-body-preview">${escapeHtml(preview)}</p>
            <div class="item-actions"><button class="ghost-btn" data-delete-letter="${escapeHtml(letter.id)}" type="button">Delete</button></div>
          </div>
        `;
      }).join('') : '<div class="empty-state"><strong>No private letters yet.</strong><p>When thoughts feel heavy, write them here instead of sending.</p></div>';
    }

    function renderGroundingStep() {
      const el = document.getElementById('groundingText');
      if (!el) return;
      el.textContent = groundingSteps[groundingStepIndex % groundingSteps.length];
    }

    function saveLetter() {
      const titleEl = document.getElementById('letterTitle');
      const bodyEl = document.getElementById('letterBody');
      const body = bodyEl.value.trim();
      if (!body) return showToast('Write the letter first');

      state.letters.unshift({
        id: `letter-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: titleEl.value.trim(),
        body,
        date: new Date().toISOString()
      });
      titleEl.value = '';
      bodyEl.value = '';
      saveState();
      showToast('Letter saved privately');
    }

    function getShareData() {
      const stats = getStats();
      const mood = state.reflections[todayKey()]?.mood || 'Not added';
      return {
        username: state.username || 'Private User',
        stats,
        mood,
        dateLabel: new Date().toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }),
        message: 'I’m choosing peace today.'
      };
    }

    function renderShareText() {
      if (!state.username) return;
      const { stats, mood, message } = getShareData();
      const text = `🌿 No Contact Challenge Update
✅ Current streak: ${stats.current} day${stats.current === 1 ? '' : 's'}
📅 Total no-contact days: ${stats.total}
🏆 Longest streak: ${stats.longest} day${stats.longest === 1 ? '' : 's'}
💭 Today’s mood: ${mood}

${message}`;
      document.getElementById('shareText').textContent = text;
    }

    function roundedRect(ctx, x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    }

    function wrapCanvasText(ctx, text, maxWidth) {
      const words = String(text || '').split(/\s+/).filter(Boolean);
      if (!words.length) return [''];
      const lines = [];
      let line = words[0];

      for (let i = 1; i < words.length; i++) {
        const testLine = `${line} ${words[i]}`;
        if (ctx.measureText(testLine).width <= maxWidth) {
          line = testLine;
        } else {
          lines.push(line);
          line = words[i];
        }
      }

      lines.push(line);
      return lines;
    }

    function drawCanvasMultilineText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
      const lines = wrapCanvasText(ctx, text, maxWidth).slice(0, maxLines);
      lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
      return lines.length;
    }

    function getShareCanvasSize() {
      const size = state.shareImageSize || 'portrait';
      if (size === 'story') return { width: 1080, height: 1920, label: 'story' };
      if (size === 'square') return { width: 1080, height: 1080, label: 'square' };
      return { width: 1080, height: 1350, label: 'portrait' };
    }

    function getShareTheme() {
      const template = state.shareImageTemplate || 'soft';
      if (template === 'dark') {
        return {
          bg: '#20231d', card: 'rgba(43,48,38,0.96)', cardSoft: '#313a2a', text: '#f5f0e8', muted: '#c9c3b8',
          green: '#9fce68', greenSoft: '#334729', blueSoft: '#26384a', amberSoft: '#4b3926', amber: '#e2a95a', border: 'rgba(255,255,255,0.10)', shadow: 'rgba(0,0,0,0.26)'
        };
      }
      if (template === 'minimal') {
        return {
          bg: '#faf7ef', card: '#ffffff', cardSoft: '#fbfaf6', text: '#2c2c2a', muted: '#77746d',
          green: '#3b6d11', greenSoft: '#f2f7ea', blueSoft: '#edf5fb', amberSoft: '#fbf3e6', amber: '#ba7517', border: 'rgba(0,0,0,0.07)', shadow: 'rgba(44,44,42,0.06)'
        };
      }
      return {
        bg: '#f5f0e8', card: 'rgba(255,255,255,0.95)', cardSoft: '#fafaf7', text: '#2c2c2a', muted: '#77746d',
        green: '#3b6d11', greenSoft: '#eaf3de', blueSoft: '#e6f1fb', amberSoft: '#faeeda', amber: '#ba7517', border: 'rgba(0,0,0,0.06)', shadow: 'rgba(44,44,42,0.08)'
      };
    }

    function renderShareImage() {
      const preview = document.getElementById('shareImagePreview');
      if (!preview || !state.username) return;

      const { username, stats, mood, dateLabel, message } = getShareData();
      const { width, height, label } = getShareCanvasSize();
      const theme = getShareTheme();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      if (state.shareImageTemplate !== 'minimal') {
        const gradientA = ctx.createRadialGradient(130, 120, 0, 130, 120, 420);
        gradientA.addColorStop(0, state.shareImageTemplate === 'dark' ? 'rgba(159,206,104,0.16)' : 'rgba(99,153,34,0.14)');
        gradientA.addColorStop(1, 'rgba(99,153,34,0)');
        ctx.fillStyle = gradientA;
        ctx.fillRect(0, 0, width, height);

        const gradientB = ctx.createRadialGradient(width - 150, 80, 0, width - 150, 80, 360);
        gradientB.addColorStop(0, state.shareImageTemplate === 'dark' ? 'rgba(80,128,170,0.12)' : 'rgba(24,95,165,0.10)');
        gradientB.addColorStop(1, 'rgba(24,95,165,0)');
        ctx.fillStyle = gradientB;
        ctx.fillRect(0, 0, width, height);
      }

      const cardX = 72;
      const cardY = label === 'story' ? 126 : 78;
      const cardW = width - 144;
      const cardH = height - cardY * 2;
      ctx.save();
      ctx.shadowColor = theme.shadow;
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 16;
      roundedRect(ctx, cardX, cardY, cardW, cardH, 34);
      ctx.fillStyle = theme.card;
      ctx.fill();
      ctx.restore();

      ctx.save();
      roundedRect(ctx, cardX, cardY, cardW, cardH, 34);
      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.border;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      roundedRect(ctx, cardX + 44, cardY + 44, 320, 56, 28);
      ctx.fillStyle = theme.greenSoft;
      ctx.fill();
      ctx.translate(cardX + 84, cardY + 73);
      ctx.rotate(-Math.PI / 4);
      roundedRect(ctx, -12, -12, 24, 24, 10);
      ctx.fillStyle = theme.green;
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = theme.green;
      ctx.font = '700 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('No Contact Challenge', cardX + 116, cardY + 79);

      ctx.fillStyle = theme.muted;
      ctx.font = '600 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(dateLabel, cardX + cardW - 250, cardY + 79);

      ctx.fillStyle = theme.text;
      ctx.font = '700 64px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      drawCanvasMultilineText(ctx, `Progress update for ${username}`, cardX + 48, cardY + 168, cardW - 96, 74, 2);

      ctx.fillStyle = theme.muted;
      ctx.font = '500 29px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      drawCanvasMultilineText(ctx, 'A gentle snapshot of today’s no-contact journey.', cardX + 48, cardY + 302, cardW - 96, 42, 2);

      const streakY = cardY + 372;
      ctx.save();
      roundedRect(ctx, cardX + 48, streakY, cardW - 96, 250, 28);
      ctx.fillStyle = theme.cardSoft;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.border;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = theme.green;
      ctx.font = '800 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Current streak', cardX + 88, streakY + 74);
      ctx.fillStyle = theme.text;
      ctx.font = '800 118px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(String(stats.current), cardX + 84, streakY + 188);
      ctx.fillStyle = theme.muted;
      ctx.font = '600 34px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(`day${stats.current === 1 ? '' : 's'} of choosing peace`, cardX + 250, streakY + 182);

      const smallY = streakY + 286;
      const gap = 22;
      const smallW = (cardW - 96 - gap * 2) / 3;
      const items = [
        { label: 'Total days', value: String(stats.total), accent: theme.greenSoft, color: theme.green },
        { label: 'Longest streak', value: `${stats.longest}`, accent: theme.blueSoft, color: state.shareImageTemplate === 'dark' ? '#8bb8e8' : '#185fa5' },
        { label: 'Today’s mood', value: mood, accent: theme.amberSoft, color: theme.amber }
      ];

      items.forEach((item, index) => {
        const x = cardX + 48 + index * (smallW + gap);
        ctx.save();
        roundedRect(ctx, x, smallY, smallW, 180, 24);
        ctx.fillStyle = item.accent;
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = item.color;
        ctx.font = '700 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        ctx.fillText(item.label, x + 28, smallY + 48);
        ctx.fillStyle = theme.text;
        ctx.font = item.value.length > 12
          ? '700 34px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
          : '800 48px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        const valueLines = wrapCanvasText(ctx, item.value, smallW - 56).slice(0, 2);
        valueLines.forEach((line, lineIndex) => {
          ctx.fillText(line, x + 28, smallY + 104 + lineIndex * 42);
        });
      });

      const messageY = smallY + 226;
      if (label !== 'square') {
        ctx.save();
        roundedRect(ctx, cardX + 48, messageY, cardW - 96, 190, 28);
        ctx.fillStyle = theme.cardSoft;
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = theme.green;
        ctx.font = '700 28px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        ctx.fillText('Today’s reminder', cardX + 80, messageY + 54);

        ctx.fillStyle = theme.text;
        ctx.font = '700 44px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        drawCanvasMultilineText(ctx, message, cardX + 80, messageY + 122, cardW - 160, 58, 2);

        if (label === 'story') {
          ctx.fillStyle = theme.muted;
          ctx.font = '600 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
          drawCanvasMultilineText(ctx, 'One day at a time. One pause at a time.', cardX + 80, messageY + 300, cardW - 160, 44, 2);
        }
      } else {
        ctx.fillStyle = theme.green;
        ctx.font = '700 34px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        ctx.fillText(message, cardX + 80, cardY + cardH - 100);
      }

      ctx.fillStyle = theme.muted;
      ctx.font = '600 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Shared from my private local tracker', cardX + 80, cardY + cardH - 44);

      latestShareImageDataUrl = canvas.toDataURL('image/png');
      preview.src = latestShareImageDataUrl;
    }

    function downloadShareImage() {
      if (!latestShareImageDataUrl) renderShareImage();
      if (!latestShareImageDataUrl) return showToast('Could not create picture');
      const link = document.createElement('a');
      link.href = latestShareImageDataUrl;
      link.download = `no-contact-progress-${todayKey()}.png`;
      link.click();
      showToast('Picture downloaded');
    }

    function dataUrlToFile(dataUrl, fileName) {
      const [meta, base64] = dataUrl.split(',');
      const mimeMatch = meta.match(/data:(.*?);base64/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new File([bytes], fileName, { type: mime });
    }

    async function shareImage() {
      if (!latestShareImageDataUrl) renderShareImage();
      if (!latestShareImageDataUrl) return showToast('Could not create picture');
      const file = dataUrlToFile(latestShareImageDataUrl, `no-contact-progress-${todayKey()}.png`);

      if (!navigator.share) {
        downloadShareImage();
        showToast('Image sharing is not available here, so the picture was downloaded instead');
        return;
      }

      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'No Contact Challenge Update',
            text: 'I’m choosing peace today.'
          });
        } else {
          await navigator.share({ text: document.getElementById('shareText').textContent });
          showToast('This browser shared the text instead of the picture');
        }
      } catch {
        // User cancelled share or browser blocked it.
      }
    }

    function doCheckin() {
      const today = todayKey();
      if (state.checkins.includes(today)) {
        showToast('Already checked in today');
        return;
      }
      state.checkins.push(today);
      saveState();
      showToast('Check-in saved');
    }

    function saveReflection() {
      const today = todayKey();
      if (!state.checkins.includes(today)) return showToast('Check in first');
      state.reflections[today] = { mood: selectedMood || '', note: document.getElementById('reflectionNote').value.trim(), savedAt: new Date().toISOString() };
      saveState();
      showToast('Reflection saved');
    }

    function openEmergency() {
      document.getElementById('reasonsPreview').textContent = state.reasons || 'No reasons saved yet. Add one or two gentle reasons in Help so they are ready during an urge.';
      document.getElementById('emergencyModal').classList.add('open');
    }

    function closeEmergency() {
      document.getElementById('emergencyModal').classList.remove('open');
    }

    function updateTimerDisplay() {
      const min = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const sec = String(timerSeconds % 60).padStart(2, '0');
      document.getElementById('timerDisplay').textContent = `${min}:${sec}`;
      const phase = Math.floor((20 * 60 - timerSeconds) / 6) % 3;
      document.getElementById('breathingText').textContent = ['Breathe in slowly.', 'Hold gently.', 'Breathe out and soften your body.'][phase];
    }

    function startTimer() {
      if (timerInterval) return;
      timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();
        if (timerSeconds <= 0) {
          clearInterval(timerInterval);
          timerInterval = null;
          timerSeconds = 0;
          updateTimerDisplay();
          showToast('20 minutes passed. Decide from calm, not from urge.');
        }
      }, 1000);
    }

    function resetTimer() {
      clearInterval(timerInterval);
      timerInterval = null;
      timerSeconds = 20 * 60;
      updateTimerDisplay();
    }

    function saveUnsent() {
      const text = document.getElementById('unsentMessage').value.trim();
      const customTrigger = document.getElementById('customTrigger')?.value.trim() || '';
      if (!text) return showToast('Write something first');
      state.unsentMessages.unshift({
        text,
        intensity: Number(document.getElementById('urgeIntensity').value),
        triggers: [...selectedUrgeTriggers],
        customTrigger,
        date: new Date().toISOString()
      });
      document.getElementById('unsentMessage').value = '';
      if (document.getElementById('customTrigger')) document.getElementById('customTrigger').value = '';
      selectedUrgeTriggers.clear();
      saveState();
      showToast('Saved instead of sending');
    }

    async function copyShare() {
      const text = document.getElementById('shareText').textContent;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied for Discord');
      } catch {
        const range = document.createRange();
        range.selectNodeContents(document.getElementById('shareText'));
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
        showToast('Select and copy the text');
      }
    }

    async function nativeShare() {
      const text = document.getElementById('shareText').textContent;
      if (!navigator.share) return showToast('Sharing is not available here');
      try { await navigator.share({ text }); } catch {}
    }


    function exportData() {
      state.lastExportAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `no-contact-backup-${todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('Backup exported');
    }

    function importData(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== 'object') throw new Error('Invalid file');
          createLocalBackup('Before importing JSON file');
          state = migrateState(data);
          saveState();
          showToast('Backup imported');
        } catch {
          showToast('Could not import this backup file');
        }
      };
      reader.readAsText(file);
    }

    document.getElementById('setupForm').addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('setupName').value.trim();
      if (!name) return;
      state.username = name;
      saveState();
      showToast('Welcome 🌿');
    });

    document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    document.querySelectorAll('[data-tab-jump]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tabJump)));
    document.querySelectorAll('[data-open-emergency]').forEach(btn => btn.addEventListener('click', openEmergency));
    document.getElementById('checkinBtn').addEventListener('click', doCheckin);
    document.getElementById('moodButtons').addEventListener('click', e => {
      const btn = e.target.closest('[data-mood]');
      if (!btn) return;
      selectedMood = btn.dataset.mood;
      renderMoodButtons();
    });
    document.getElementById('saveReflectionBtn').addEventListener('click', saveReflection);
    document.getElementById('prevMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('nextMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
    document.getElementById('saveReasonsBtn').addEventListener('click', () => { state.reasons = document.getElementById('reasonsText').value.trim(); saveState(); showToast('Reasons saved'); });
    document.getElementById('saveRelapseBtn').addEventListener('click', () => {
      const today = todayKey();
      const what = document.getElementById('relapseWhat').value.trim();
      const trigger = document.getElementById('relapseTrigger').value.trim();

      state.relapses.unshift({
        what,
        trigger,
        breakDate: today,
        date: new Date().toISOString()
      });

      // If today was already checked in, remove it because today is no longer a successful no-contact day.
      state.checkins = state.checkins.filter(d => d !== today);
      delete state.reflections[today];
      selectedMood = null;

      document.getElementById('relapseWhat').value = '';
      document.getElementById('relapseTrigger').value = '';
      document.getElementById('relapseMessage').classList.remove('hidden');
      saveState();
      showToast('Restart saved gently');
    });
    document.getElementById('closeEmergencyBtn').addEventListener('click', closeEmergency);
    document.getElementById('emergencyModal').addEventListener('click', e => { if (e.target.id === 'emergencyModal') closeEmergency(); });
    document.getElementById('startTimerBtn').addEventListener('click', startTimer);
    document.getElementById('resetTimerBtn').addEventListener('click', resetTimer);
    document.getElementById('saveUnsentBtn').addEventListener('click', saveUnsent);
    document.getElementById('urgeIntensity').addEventListener('input', e => document.getElementById('urgeIntensityValue').textContent = e.target.value);
    document.getElementById('triggerButtons').addEventListener('click', e => {
      const btn = e.target.closest('[data-trigger]');
      if (!btn) return;
      const trigger = btn.dataset.trigger;
      selectedUrgeTriggers.has(trigger) ? selectedUrgeTriggers.delete(trigger) : selectedUrgeTriggers.add(trigger);
      renderTriggerButtons();
    });
    document.getElementById('nextGroundingBtn').addEventListener('click', () => {
      groundingStepIndex = (groundingStepIndex + 1) % groundingSteps.length;
      renderGroundingStep();
    });
    document.getElementById('saveLetterBtn').addEventListener('click', saveLetter);
    document.getElementById('urgeHistory').addEventListener('click', e => {
      const btn = e.target.closest('[data-delete-urge]');
      if (!btn) return;
      state.unsentMessages.splice(Number(btn.dataset.deleteUrge), 1);
      saveState();
      showToast('Urge deleted');
    });
    document.getElementById('letterList').addEventListener('click', e => {
      const btn = e.target.closest('[data-delete-letter]');
      if (!btn) return;
      state.letters = state.letters.filter(letter => letter.id !== btn.dataset.deleteLetter);
      saveState();
      showToast('Letter deleted');
    });
    document.getElementById('copyShareBtn').addEventListener('click', copyShare);
    document.getElementById('nativeShareBtn').addEventListener('click', nativeShare);
    document.getElementById('refreshShareBtn').addEventListener('click', () => {
      renderShareText();
      renderShareImage();
      showToast('Share content refreshed');
    });
    document.getElementById('downloadShareImageBtn').addEventListener('click', downloadShareImage);
    document.getElementById('shareImageBtn').addEventListener('click', shareImage);
    document.getElementById('refreshShareImageBtn').addEventListener('click', () => {
      renderShareImage();
      showToast('Share image refreshed');
    });
    document.getElementById('shareImageTemplate').addEventListener('change', e => {
      state.shareImageTemplate = e.target.value;
      saveState();
      showToast('Image style updated');
    });
    document.getElementById('shareImageSize').addEventListener('change', e => {
      state.shareImageSize = e.target.value;
      saveState();
      showToast('Image size updated');
    });
    document.getElementById('saveNameBtn').addEventListener('click', () => {
      const name = document.getElementById('editName').value.trim();
      if (!name) return showToast('Name cannot be empty');
      state.username = name;
      saveState();
      showToast('Username saved');
    });
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importFile').addEventListener('change', e => importData(e.target.files[0]));
    document.getElementById('manualBackupBtn').addEventListener('click', () => {
      const key = createLocalBackup('Manual backup');
      if (!key) return showToast('Could not create backup');
      showBackupNotice('Backup created on this device. You can restore the latest backup from here.');
      showToast('Backup created');
    });
    document.getElementById('restoreLatestBackupBtn').addEventListener('click', restoreLatestBackup);
    document.getElementById('clearTodayBtn').addEventListener('click', () => {
      if (!confirm('Clear today’s check-in and reflection?')) return;
      createLocalBackup('Before clearing today');
      const today = todayKey();
      state.checkins = state.checkins.filter(d => d !== today);
      delete state.reflections[today];
      saveState();
      showToast('Today cleared');
    });
    document.getElementById('resetAllBtn').addEventListener('click', () => {
      if (!confirm('Reset all saved progress? A backup will be created first, but this cannot be undone if your browser removes saved data.')) return;
      createLocalBackup('Before resetting all data');
      localStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      render();
      showToast('Progress reset');
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEmergency(); });

    updateTimerDisplay();
    render();



/* =========================================================
   Next-feature upgrade
   - Today plan checklist
   - Social media boundary tracker
   - Safe people list
   - Privacy mode
   - Progress insights
   All data remains localStorage-only.
   ========================================================= */

const DEFAULT_TODAY_PLAN_ITEMS = [
  'Don’t check their profile',
  'Don’t message',
  'Avoid old photos',
  'Take a walk',
  'Journal for 3 minutes',
  'Sleep earlier'
];

const DEFAULT_BOUNDARY_ITEMS = [
  'Did not check their profile',
  'Did not check stories',
  'Did not check last seen',
  'Did not ask friends about them',
  'Did not reread old chats'
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
    ['Average urge', getAverageUrgeIntensity()],
    ['Saved instead of sent', String((state.unsentMessages || []).length)],
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
    : '<div class="empty-state"><strong>No safe people added yet.</strong><p>Add one person you can contact before contacting them.</p></div>';

  if (list) list.innerHTML = html;
  if (preview) {
    preview.innerHTML = people.length
      ? people.slice(0, 3).map(person => `
        <div class="list-item sensitive">
          <strong>${safeText(person.name)}</strong>
          <small>${safeText(person.contact)}</small>
        </div>
      `).join('')
      : '<div class="empty-state"><strong>No safe person saved yet.</strong><p>Add one in Help so you have another choice during an urge.</p></div>';
  }
}

function renderContactCost() {
  ensureNextFeatureState();
  const text = document.getElementById('contactCostText');
  const preview = document.getElementById('contactCostPreview');
  if (text) text.value = state.contactCost || '';
  if (preview) {
    preview.textContent = state.contactCost || 'No reminder saved yet. Add what usually happens after contact so your future self can read it during an urge.';
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
  renderPolishHelpers();
}

const originalRenderForNextFeatures = render;
render = function patchedRender() {
  originalRenderForNextFeatures();
  if (state.username) renderNextFeatures();
};

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

ensureNextFeatureState();
bindNextFeatureEvents();
bindPolishEvents();
render();


/* Polished usability helpers */
function renderPolishHelpers() {
  const guide = document.getElementById('firstTimeGuide');
  if (guide) {
    const hasUsedCoreFeatures = getStats().total > 0 || Boolean(state.reasons) || (state.unsentMessages || []).length > 0;
    const dismissed = Boolean(state.dismissedGuide);
    guide.classList.toggle('hidden', dismissed || hasUsedCoreFeatures);
  }

  const privacyIndicator = document.getElementById('privacyIndicator');
  if (privacyIndicator) {
    privacyIndicator.classList.toggle('hidden', !state.privacyMode);
  }

  const lastExportStatus = document.getElementById('lastExportStatus');
  if (lastExportStatus) {
    lastExportStatus.textContent = state.lastExportAt
      ? new Date(state.lastExportAt).toLocaleDateString()
      : 'Not exported yet';
  }

  const lastBackupStatus = document.getElementById('lastBackupStatus');
  if (lastBackupStatus) {
    const keys = getBackupKeys();
    const latestDate = state.lastBackupAt || (keys.length ? keys[keys.length - 1].replace(BACKUP_PREFIX, '') : '');
    const parsed = latestDate ? new Date(latestDate) : null;
    lastBackupStatus.textContent = parsed && !Number.isNaN(parsed.getTime())
      ? parsed.toLocaleDateString()
      : 'No backup yet';
  }
}

function bindPolishEvents() {
  const dismissGuideBtn = document.getElementById('dismissGuideBtn');
  if (dismissGuideBtn) {
    dismissGuideBtn.addEventListener('click', () => {
      state.dismissedGuide = true;
      saveState();
      showToast('Guide hidden');
    });
  }

  const quickExportBtn = document.getElementById('quickExportBtn');
  if (quickExportBtn) {
    quickExportBtn.addEventListener('click', exportData);
  }
}
