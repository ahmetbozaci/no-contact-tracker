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
    const milestoneChapters = [
      { day: 1, icon: '🌱', title: 'First brave pause', note: 'You made the first choice for peace.' },
      { day: 3, icon: '🌿', title: 'The urge wave passed', note: 'You are learning that urges rise and fall.' },
      { day: 7, icon: '🍃', title: 'One full week of peace', note: 'A week of choosing yourself is real progress.' },
      { day: 14, icon: '🌼', title: 'Building distance', note: 'Space is starting to protect your healing.' },
      { day: 30, icon: '🌳', title: 'A new rhythm is forming', note: 'No-contact is becoming part of your life.' },
      { day: 60, icon: '🕊️', title: 'Peace feels more familiar', note: 'You have practiced calm again and again.' },
      { day: 90, icon: '✨', title: 'Proof of consistency', note: 'This is not the end of healing. It is proof of your strength.' }
    ];
    const quotes = [
      'You do not need to reopen the wound to prove it hurt.',
      'Peace is built by small choices repeated quietly.',
      'Missing them is not a command to contact them.',
      'The urge will pass. Your self-respect can stay.',
      'You are allowed to protect your healing.',
      'Today, silence can be an act of love toward yourself.',
      'You are not weak for feeling. You are strong for pausing.',
      'You can miss someone and still choose distance.',
      'No message is worth losing your peace today.',
      'Your nervous system deserves a quiet day.',
      'One calm choice can protect the rest of your day.',
      'You do not have to answer every feeling with action.',
      'Let the wave pass before you decide anything.',
      'Checking their profile will not give you the peace you need.',
      'You are building a life that does not revolve around waiting.',
      'The silence may feel hard, but it can also protect you.',
      'You can love the memory and still protect the present.',
      'Today, your job is not to fix the past.',
      'You are allowed to choose yourself without explaining it.',
      'Not reaching out is still an action. It is care for yourself.',
      'Your future self is grateful for this pause.',
      'You can feel sad and still stay steady.',
      'The urge is temporary. Your healing matters longer.',
      'Do not trade your progress for a moment of relief.',
      'You do not need their response to be okay today.',
      'Let peace be louder than curiosity.',
      'You are practicing self-respect in small steps.',
      'Today is not about perfection. It is about protection.',
      'You can be gentle with yourself and still hold the boundary.',
      'Old patterns do not need another chance today.',
      'Your heart can ache and still move forward.',
      'A quiet day is still progress.',
      'You are not behind. You are healing at your own pace.',
      'Choose the version of you that sleeps easier tonight.',
      'You can wait 20 minutes before doing anything.',
      'You are stronger than the first wave of emotion.',
      'Do something kind for yourself before checking on them.',
      'You are not alone in wanting to go back. Pause anyway.',
      'The fact that it is hard does not mean it is wrong.',
      'Your peace is worth protecting from small triggers.',
      'Today, do not reopen the loop.',
      'You can remember them without returning to them.',
      'You deserve a love that does not cost your calm.',
      'Let the unanswered question stay unanswered today.',
      'You are learning what keeps you safe.',
      'Every day of distance gives you more room to breathe.',
      'You are allowed to outgrow the cycle.',
      'One day at a time is enough.',
      'The boundary is not punishment. It is protection.',
      'You do not have to prove your pain to anyone.',
      'Pause. Breathe. Choose what protects you.',
      'You can care and still not contact.',
      'Healing often looks quiet from the outside.',
      'Your worth is not waiting in their inbox.',
      'The calm you want is built by choices like this.',
      'Today, choose less chaos.',
      'Do not let loneliness make the decision for you.',
      'You are creating space for something healthier.',
      'Your feelings are real. They are not instructions.',
      'Keep the promise you made to your peace.',
      'You can begin again without shame.'
    ];

    const heroReminders = [
      'Choose peace. Choose growth.',
      'Protect your peace today.',
      'One calm choice is enough.',
      'Be gentle with yourself today.',
      'Let the urge pass.',
      'Stay steady today.',
      'Keep the boundary today.',
      'Pause before you act.',
      'You do not need to reach out.',
      'Your peace matters today.',
      'Choose calm over curiosity.',
      'You can get through today.'
    ];

    let state = loadState();
    let selectedMood = null;
    let calendarDate = new Date();
    let timerSeconds = 20 * 60;
    let timerInterval = null;
    let latestShareImageDataUrl = '';
    let selectedUrgeTriggers = new Set();
    let groundingStepIndex = 0;
    let lastFocusedBeforeEmergency = null;

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
        shareMode: 'image',
        reminderTime: '',
        reminderLastShown: '',
        emergencyRegion: '',
        missedDaysResponseKey: '',
        currentStreakResetDate: '',
        darkMode: false
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
      merged.missedDaysResponseKey = typeof merged.missedDaysResponseKey === 'string' ? merged.missedDaysResponseKey : '';
      merged.currentStreakResetDate = isDateKey(merged.currentStreakResetDate) ? merged.currentStreakResetDate : '';
      merged.darkMode = Boolean(merged.darkMode);

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
      merged.shareMode = ['text', 'image'].includes(merged.shareMode) ? merged.shareMode : 'image';

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


    function createPastCheckins(completedDays) {
      const count = Math.max(0, Math.min(5000, Number(completedDays) || 0));
      const dates = [];
      const cursor = new Date();

      // Start from yesterday so today's check-in still feels intentional.
      cursor.setDate(cursor.getDate() - 1);

      for (let i = 0; i < count; i++) {
        dates.push(todayKey(cursor));
        cursor.setDate(cursor.getDate() - 1);
      }

      return dates;
    }

    function addDaysToDateKey(key, days) {
      const date = parseDateKey(key);
      date.setDate(date.getDate() + days);
      return todayKey(date);
    }

    function getMissedDaysInfo() {
      const checkins = uniqueSortedCheckins();
      if (!checkins.length) return null;

      const lastCheckin = checkins[checkins.length - 1];
      const today = todayKey();
      if (lastCheckin >= today) return null;

      const missing = [];
      let cursor = addDaysToDateKey(lastCheckin, 1);

      while (cursor < today) {
        missing.push(cursor);
        cursor = addDaysToDateKey(cursor, 1);
      }

      if (!missing.length) return null;

      const rangeKey = `${missing[0]}_${missing[missing.length - 1]}`;
      if (state.missedDaysResponseKey === rangeKey) return null;

      return {
        days: missing,
        count: missing.length,
        start: missing[0],
        end: missing[missing.length - 1],
        rangeKey
      };
    }

    function resolveMissedDaysAsNoContact() {
      const info = getMissedDaysInfo();
      if (!info) return;

      state.checkins = [...new Set([...state.checkins, ...info.days])].sort();
      state.missedDaysResponseKey = info.rangeKey;
      saveState();
      showToast('Those days were added. You kept choosing peace.');
    }

    function showMissedRelapseForm() {
      const form = document.getElementById('missedRelapseForm');
      if (form) form.classList.remove('hidden');
    }

    function saveMissedRelapse() {
      const info = getMissedDaysInfo();
      if (!info) return;

      const what = document.getElementById('missedRelapseWhat')?.value.trim() || '';
      const trigger = document.getElementById('missedRelapseTrigger')?.value.trim() || '';

      const breakDate = info.end;

      state.relapses.unshift({
        what,
        trigger,
        breakDate,
        date: new Date().toISOString()
      });

      // A restart should reset visible progress even if earlier days were backfilled during setup.
      resetProgressAfterContact(breakDate);
      state.missedDaysResponseKey = info.rangeKey;

      document.getElementById('missedRelapseWhat').value = '';
      document.getElementById('missedRelapseTrigger').value = '';
      document.getElementById('missedRelapseForm').classList.add('hidden');

      saveState();
      showToast('You are not back to zero. You are learning your pattern.');
    }

    function skipMissedDaysPrompt() {
      const info = getMissedDaysInfo();
      if (!info) return;
      state.missedDaysResponseKey = info.rangeKey;
      saveState();
      showToast('Skipped for now');
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

    function resetProgressAfterContact(dateKey) {
      if (!isDateKey(dateKey)) return;

      // Restart means visible progress starts again from zero.
      // This avoids confusion when the user added prior no-contact days during setup.
      state.currentStreakResetDate = dateKey;
      state.checkins = [];
      state.reflections = {};

      if (typeof selectedMood !== 'undefined') {
        selectedMood = null;
      }
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
      const explicitReset = isDateKey(state.currentStreakResetDate) ? state.currentStreakResetDate : '';
      const streakResetDate = [latestRelapse, explicitReset].filter(Boolean).sort().pop() || '';
      const today = todayKey();
      let current = 0;

      // Current streak should start after the latest relapse/restart.
      // If restart happened today, current must stay 0 until a future successful day.
      let cursor = parseDateKey(set.has(today) ? today : todayKey(new Date(Date.now() - 86400000)));
      while (set.has(todayKey(cursor))) {
        const key = todayKey(cursor);
        if (streakResetDate && key <= streakResetDate) break;
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

    function onElement(id, eventName, handler) {
      const element = document.getElementById(id);
      if (!element) return false;
      element.addEventListener(eventName, handler);
      return true;
    }

    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2300);
    }

    function switchTab(tab) {
      document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === tab));
      document.querySelectorAll('[data-tab]').forEach(b => {
        const isActive = b.dataset.tab === tab;
        b.classList.toggle('active', isActive);
        if (isActive) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (tab === 'share') {
        renderShareMode();
        renderShareText();
        renderShareImage();
      }
    }


    function renderShareMode() {
      const mode = state.shareMode || 'image';
      const textPanel = document.getElementById('shareTextPanel');
      const imagePanel = document.getElementById('shareImagePanel');

      if (textPanel) textPanel.classList.toggle('hidden', mode !== 'text');
      if (imagePanel) imagePanel.classList.toggle('hidden', mode !== 'image');

      document.querySelectorAll('[data-share-mode]').forEach(btn => {
        const active = btn.dataset.shareMode === mode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }

    function render() {
      const hasUser = Boolean(state.username.trim());
      document.getElementById('setupScreen').classList.toggle('hidden', hasUser);
      document.getElementById('app').classList.toggle('hidden', !hasUser);
      if (!hasUser) return;

      const stats = getStats();
      document.getElementById('userChip').textContent = `Hi, ${state.username}`;
      document.getElementById('todayTag').textContent = stats.checkedToday ? 'Already checked in today' : 'Today is a new choice';
      document.getElementById('heroReminder').textContent = heroReminders[Math.floor(Date.now() / 86400000) % heroReminders.length];
      document.getElementById('editName').value = state.username;
      document.getElementById('reasonsText').value = state.reasons || '';
      document.getElementById('shareImageTemplate').value = state.shareImageTemplate || 'soft';

      const btn = document.getElementById('checkinBtn');
      btn.classList.toggle('done', stats.checkedToday);
      document.getElementById('checkinTitle').textContent = stats.checkedToday ? 'Already checked in today' : 'I stayed no-contact today';
      document.getElementById('checkinSub').textContent = stats.checkedToday ? 'You showed up for yourself today 🌱' : 'Tap once to record today';
      const todayReflection = state.reflections[todayKey()];
      const reflectionSavedToday = Boolean(todayReflection?.savedAt || todayReflection?.mood || todayReflection?.note);
      document.getElementById('reflectionBox').classList.toggle('hidden', !stats.checkedToday || reflectionSavedToday);

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
      renderShareMode();
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
      const unlockedCount = milestoneChapters.filter(item => stats.current >= item.day || stats.total >= item.day).length;
      const path = milestoneChapters.map(item => {
        const unlocked = stats.current >= item.day || stats.total >= item.day;
        return `<span class="${unlocked ? 'unlocked' : ''}" title="${escapeHtml(item.day + ' days')}">${unlocked ? item.icon : '○'}</span>`;
      }).join('<i></i>');

      document.getElementById('milestones').innerHTML = `
        <div class="milestone-path" aria-label="${unlockedCount} of ${milestoneChapters.length} milestones unlocked">${path}</div>
        <div class="milestone-grid">
          ${milestoneChapters.map(item => {
            const unlocked = stats.current >= item.day || stats.total >= item.day;
            return `
              <div class="badge-card ${unlocked ? 'unlocked' : ''}">
                <strong>${unlocked ? item.icon : '🔒'} ${item.day} day${item.day > 1 ? 's' : ''}</strong>
                <span>${unlocked ? 'Unlocked' : 'Keep going gently'}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
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

    function getMoodShareMessage(mood) {
      const moodMessages = {
        Calm: 'I’m choosing peace today.',
        Strong: 'I stayed steady today.',
        Sad: 'I’m being gentle with myself today.',
        Anxious: 'I paused before reacting today.',
        Tempted: 'I chose not to send the message today.',
        Hopeful: 'I’m moving forward gently today.'
      };

      return moodMessages[mood] || 'I’m choosing peace today.';
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
        message: getMoodShareMessage(mood)
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
      // Keep one simple default size for users: portrait share card.
      // The old shareImageSize setting can remain in saved data without affecting the UI.
      return { width: 1080, height: 1350, label: 'portrait' };
    }


    function getShareTheme() {
      const template = state.shareImageTemplate || 'soft';

      if (template === 'dark') {
        return {
          page: '#1f241f',
          pageGlowA: 'rgba(126,174,105,0.12)',
          pageGlowB: 'rgba(229,178,120,0.08)',
          card: '#2b312a',
          cardSoft: '#323a31',
          text: '#f4efe7',
          muted: '#d1cabc',
          line: 'rgba(255,255,255,0.10)',
          accent: '#95c36f',
          accentSoft: '#3a4b35',
          warm: '#e0b07a',
          statCard: '#313731',
          footerHill1: '#4a5645',
          footerHill2: '#5e6a57',
          footerHill3: '#74806d'
        };
      }

      if (template === 'minimal') {
        return {
          page: '#fbf7ef',
          pageGlowA: 'rgba(164,118,68,0.06)',
          pageGlowB: 'rgba(120,96,70,0.05)',
          card: '#fffefb',
          cardSoft: '#f8f1e7',
          text: '#2e2a24',
          muted: '#867768',
          line: 'rgba(80,62,44,0.11)',
          accent: '#9b7046',
          accentSoft: '#f2e6d7',
          warm: '#bf8755',
          statCard: '#fffaf3',
          footerHill1: '#f0e7da',
          footerHill2: '#e8dccd',
          footerHill3: '#ded1c0'
        };
      }

      return {
        page: '#eaf3df',
        pageGlowA: 'rgba(73,132,63,0.18)',
        pageGlowB: 'rgba(162,196,122,0.14)',
        card: '#f8fff3',
        cardSoft: '#e3efd8',
        text: '#103821',
        muted: '#5f7465',
        line: 'rgba(16,56,33,0.12)',
        accent: '#2f6f3e',
        accentSoft: '#d5eac9',
        warm: '#c9945b',
        statCard: '#fbfff8',
        footerHill1: '#cfe0c2',
        footerHill2: '#b9d0ab',
        footerHill3: '#9fbb91'
      };
    }

    function drawLeafSprig(ctx, x, y, scale, color, flip = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale * flip, scale);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(0, 72);
      ctx.quadraticCurveTo(14, 34, 24, 0);
      ctx.stroke();

      const leaves = [
        { x: 18, y: 12, w: 22, h: 40, r: -0.85 },
        { x: 0, y: 28, w: 20, h: 36, r: -1.75 },
        { x: 28, y: 36, w: 22, h: 40, r: 0.45 },
        { x: 8, y: 54, w: 20, h: 36, r: -1.15 }
      ];

      leaves.forEach(leaf => {
        ctx.save();
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate(leaf.r);
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf.w / 2, leaf.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      ctx.restore();
    }

    function drawSparkle(ctx, x, y, size, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size);
      ctx.moveTo(-size, 0);
      ctx.lineTo(size, 0);
      ctx.stroke();
      ctx.restore();
    }

    function drawFooterWaves(ctx, width, height, theme) {
      const baseY = height - 34;

      ctx.save();
      ctx.fillStyle = theme.footerHill1;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, baseY - 64);
      ctx.bezierCurveTo(width * 0.14, baseY - 132, width * 0.28, baseY - 12, width * 0.44, baseY - 70);
      ctx.bezierCurveTo(width * 0.58, baseY - 120, width * 0.74, baseY - 6, width, baseY - 92);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = theme.footerHill2;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, baseY - 36);
      ctx.bezierCurveTo(width * 0.16, baseY - 92, width * 0.30, baseY - 8, width * 0.46, baseY - 44);
      ctx.bezierCurveTo(width * 0.61, baseY - 80, width * 0.76, baseY - 4, width, baseY - 62);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = theme.footerHill3;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, baseY - 14);
      ctx.bezierCurveTo(width * 0.18, baseY - 54, width * 0.36, baseY + 2, width * 0.52, baseY - 24);
      ctx.bezierCurveTo(width * 0.69, baseY - 54, width * 0.84, baseY + 4, width, baseY - 34);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function renderShareImage() {
      const preview = document.getElementById('shareImagePreview');
      if (!preview || !state.username) return;

      const { username, stats, mood, dateLabel, message } = getShareData();
      const streakDays = Number(stats.current || 0);
      const headlineCount = streakDays >= 7 ? `${Math.floor(streakDays / 7)} Week${Math.floor(streakDays / 7) === 1 ? '' : 's'}` : `${streakDays} Day${streakDays === 1 ? '' : 's'}`;
      const sizeInfo = getShareCanvasSize();
      const { width, height } = sizeInfo;
      const isStory = sizeInfo.label === 'story';
      const isSquare = sizeInfo.label === 'square';
      const theme = getShareTheme();

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = theme.page;
      ctx.fillRect(0, 0, width, height);

      const glowA = ctx.createRadialGradient(width * 0.18, height * 0.12, 0, width * 0.18, height * 0.12, width * 0.38);
      glowA.addColorStop(0, theme.pageGlowA);
      glowA.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowA;
      ctx.fillRect(0, 0, width, height);

      const glowB = ctx.createRadialGradient(width * 0.82, height * 0.10, 0, width * 0.82, height * 0.10, width * 0.30);
      glowB.addColorStop(0, theme.pageGlowB);
      glowB.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowB;
      ctx.fillRect(0, 0, width, height);

      const margin = isStory ? 56 : 38;
      const cardX = margin;
      const cardY = isStory ? 64 : 34;
      const cardW = width - margin * 2;
      const cardH = height - cardY - margin;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 18;
      roundedRect(ctx, cardX, cardY, cardW, cardH, 34);
      ctx.fillStyle = theme.card;
      ctx.fill();
      ctx.restore();

      ctx.save();
      roundedRect(ctx, cardX, cardY, cardW, cardH, 34);
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      const innerPad = isStory ? 52 : 42;
      const contentX = cardX + innerPad;
      const contentW = cardW - innerPad * 2;

      // top pill
      const pillW = Math.min(420, contentW * 0.52);
      const pillH = 66;
      const pillX = cardX + (cardW - pillW) / 2;
      const pillY = cardY + 42;

      roundedRect(ctx, pillX, pillY, pillW, pillH, 33);
      ctx.fillStyle = theme.accentSoft;
      ctx.fill();

      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.moveTo(pillX + 32, pillY + 34);
      ctx.quadraticCurveTo(pillX + 24, pillY + 16, pillX + 10, pillY + 16);
      ctx.quadraticCurveTo(pillX + 14, pillY + 31, pillX + 32, pillY + 34);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pillX + 40, pillY + 38);
      ctx.quadraticCurveTo(pillX + 53, pillY + 12, pillX + 70, pillY + 22);
      ctx.quadraticCurveTo(pillX + 66, pillY + 41, pillX + 40, pillY + 38);
      ctx.fill();

      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pillX + 39, pillY + 48);
      ctx.lineTo(pillX + 41, pillY + 20);
      ctx.stroke();

      ctx.fillStyle = theme.text;
      ctx.font = '600 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('No Contact Challenge', pillX + 92, pillY + 41);

      // decorative sun/clouds/sparkles
      const sunX = cardX + cardW - 118;
      const sunY = cardY + 88;
      ctx.fillStyle = 'rgba(228, 195, 153, 0.55)';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.card;
      [[sunX - 52, sunY + 34, 32], [sunX - 10, sunY + 18, 42], [sunX + 28, sunY + 36, 26]].forEach(cloud => {
        ctx.beginPath();
        ctx.arc(cloud[0], cloud[1], cloud[2], 0, Math.PI * 2);
        ctx.fill();
      });

      drawSparkle(ctx, cardX + 88, cardY + 120, 12, 'rgba(216,178,114,0.85)');
      drawSparkle(ctx, cardX + 58, cardY + 168, 8, 'rgba(216,178,114,0.75)');

      ctx.strokeStyle = 'rgba(181,142,94,0.70)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sunX + 18, sunY + 10);
      ctx.quadraticCurveTo(sunX + 27, sunY + 2, sunX + 37, sunY + 10);
      ctx.moveTo(sunX + 40, sunY + 28);
      ctx.quadraticCurveTo(sunX + 49, sunY + 20, sunX + 59, sunY + 28);
      ctx.stroke();

      // main heading
      const headlineY = pillY + pillH + 88;
      ctx.fillStyle = theme.text;
      ctx.textAlign = 'center';
      ctx.font = `${isStory ? '700 88px' : isSquare ? '700 76px' : '700 96px'} Georgia, Times New Roman, serif`;
      ctx.fillText(headlineCount, cardX + cardW / 2, headlineY);

      ctx.font = `${isStory ? '700 98px' : isSquare ? '700 82px' : '700 106px'} Georgia, Times New Roman, serif`;
      ctx.fillText('No Contact', cardX + cardW / 2, headlineY + (isSquare ? 100 : 118));

      drawLeafSprig(ctx, cardX + 88, headlineY + 22, 1.35, 'rgba(127,150,112,0.72)', 1);
      drawLeafSprig(ctx, cardX + cardW - 88, headlineY + 22, 1.35, 'rgba(127,150,112,0.72)', -1);

      // divider heart
      const dividerY = headlineY + (isSquare ? 150 : 180);
      ctx.strokeStyle = 'rgba(198,171,131,0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cardX + cardW / 2 - 155, dividerY);
      ctx.lineTo(cardX + cardW / 2 - 42, dividerY);
      ctx.moveTo(cardX + cardW / 2 + 42, dividerY);
      ctx.lineTo(cardX + cardW / 2 + 155, dividerY);
      ctx.stroke();

      ctx.fillStyle = theme.warm;
      ctx.font = '700 34px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('♥', cardX + cardW / 2, dividerY + 12);

      ctx.fillStyle = theme.muted;
      ctx.font = `${isStory ? '600 36px' : '600 32px'} system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
      ctx.fillText(`${streakDays} day${streakDays === 1 ? '' : 's'} of choosing peace`, cardX + cardW / 2, dividerY + 72);

      // stats
      const statsTop = dividerY + 120;
      const gap = 22;
      const statsAreaW = cardW - innerPad * 2;
      const statW = (statsAreaW - gap) / 2;
      const statH = isSquare ? 138 : 150;
      const cards = [
        { label: 'Current streak', value: `${streakDays} day${streakDays === 1 ? '' : 's'}`, icon: '🔥' },
        { label: 'Total no-contact days', value: String(Number(stats.total || 0)), icon: '🗓' },
        { label: 'Longest streak', value: `${Number(stats.longest || 0)} day${Number(stats.longest || 0) === 1 ? '' : 's'}`, icon: '🏆' },
        { label: 'Today’s mood', value: mood, icon: '☺' }
      ];

      ctx.textAlign = 'left';
      cards.forEach((item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = contentX + col * (statW + gap);
        const y = statsTop + row * (statH + gap);

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.04)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 6;
        roundedRect(ctx, x, y, statW, statH, 24);
        ctx.fillStyle = theme.statCard;
        ctx.fill();
        ctx.restore();

        ctx.save();
        roundedRect(ctx, x, y, statW, statH, 24);
        ctx.strokeStyle = theme.line;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        const iconCx = x + 74;
        const iconCy = y + statH / 2;
        ctx.fillStyle = theme.accentSoft;
        ctx.beginPath();
        ctx.arc(iconCx, iconCy, 38, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = theme.accent;
        ctx.font = '700 36px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI Emoji, Segoe UI Symbol, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.icon, iconCx, iconCy + 12);

        ctx.strokeStyle = theme.line;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 132, y + 28);
        ctx.lineTo(x + 132, y + statH - 28);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = theme.text;
        ctx.font = '600 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        ctx.fillText(item.label, x + 158, y + 58);

        const valueFont = item.value.length > 10 ? '700 46px Georgia, Times New Roman, serif' : '700 52px Georgia, Times New Roman, serif';
        ctx.font = valueFont;
        ctx.fillText(item.value, x + 158, y + 116);
      });

      // quote card
      const quoteY = statsTop + statH * 2 + gap + 34;
      const quoteH = isStory ? 190 : 170;
      roundedRect(ctx, contentX, quoteY, contentW, quoteH, 28);
      ctx.fillStyle = theme.cardSoft;
      ctx.fill();

      drawLeafSprig(ctx, contentX + 70, quoteY + 50, 1.45, 'rgba(127,150,112,0.78)', 1);

      ctx.fillStyle = theme.warm;
      ctx.textAlign = 'center';
      ctx.font = '700 34px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('♥', cardX + cardW / 2, quoteY + 42);

      ctx.strokeStyle = 'rgba(214,169,106,0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cardX + cardW / 2 - 44, quoteY + 30);
      ctx.lineTo(cardX + cardW / 2 - 28, quoteY + 20);
      ctx.moveTo(cardX + cardW / 2 + 28, quoteY + 20);
      ctx.lineTo(cardX + cardW / 2 + 44, quoteY + 30);
      ctx.stroke();

      ctx.fillStyle = theme.text;
      ctx.font = `${isStory ? '700 52px' : isSquare ? '700 44px' : '700 50px'} Georgia, Times New Roman, serif`;
      ctx.fillText(message, cardX + cardW / 2, quoteY + (isStory ? 112 : 102));

      ctx.strokeStyle = 'rgba(150,168,125,0.72)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cardX + cardW / 2 - 170, quoteY + quoteH - 34);
      ctx.quadraticCurveTo(cardX + cardW / 2, quoteY + quoteH - 18, cardX + cardW / 2 + 170, quoteY + quoteH - 34);
      ctx.stroke();

      // footer
      ctx.save();
      ctx.translate(cardX, cardY);
      drawFooterWaves(ctx, cardW, cardH, theme);
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.fillStyle = theme.muted;
      ctx.font = '600 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Private progress update', cardX + cardW / 2, cardY + cardH - 52);
      ctx.fillText(dateLabel, cardX + cardW / 2, cardY + cardH - 86);

      latestShareImageDataUrl = canvas.toDataURL('image/png');
      preview.src = latestShareImageDataUrl;
    }

    function downloadShareImage() {
      renderShareImage();
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
      renderShareImage();
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
      showToast('Reflection saved. See you tomorrow 🌿');
    }

    function openEmergency() {
      lastFocusedBeforeEmergency = document.activeElement;
      document.getElementById('reasonsPreview').textContent = state.reasons || 'No reasons saved yet. Add one in Help.';
      const modal = document.getElementById('emergencyModal');
      modal.classList.add('open');
      document.getElementById('closeEmergencyBtn').focus();
    }

    function closeEmergency() {
      document.getElementById('emergencyModal').classList.remove('open');
      if (lastFocusedBeforeEmergency && typeof lastFocusedBeforeEmergency.focus === 'function') {
        lastFocusedBeforeEmergency.focus();
      }
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
      renderShareText();
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
      renderShareText();
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

    onElement('setupForm', 'submit', e => {
      e.preventDefault();
      const name = document.getElementById('setupName').value.trim();
      const priorDays = Number(document.getElementById('setupPriorDays')?.value || 0);
      const mainReason = document.getElementById('setupReason')?.value.trim() || '';
      const safePerson = document.getElementById('setupSafePerson')?.value.trim() || '';
      const emergencyRegion = document.getElementById('setupEmergencyRegion')?.value || '';
      if (!name) return;

      state.username = name;
      state.emergencyRegion = emergencyRegion;

      if (mainReason) {
        state.reasons = mainReason;
      }

      if (safePerson) {
        ensureNextFeatureState();
        state.safePeople.unshift({
          name: safePerson,
          contact: '',
          note: 'Added during setup',
          createdAt: new Date().toISOString()
        });
      }

      if (priorDays > 0) {
        state.checkins = [...new Set([...state.checkins, ...createPastCheckins(priorDays)])].sort();
      }

      saveState();
      showToast(priorDays > 0 ? `Welcome 🌿 ${Math.floor(Math.min(priorDays, 5000))} days added` : 'Welcome 🌿');
    });

    document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    document.querySelectorAll('[data-tab-jump]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tabJump)));
    document.querySelectorAll('[data-open-emergency]').forEach(btn => btn.addEventListener('click', openEmergency));
    onElement('checkinBtn', 'click', doCheckin);
    onElement('moodButtons', 'click', e => {
      const btn = e.target.closest('[data-mood]');
      if (!btn) return;
      selectedMood = btn.dataset.mood;
      renderMoodButtons();
    });
    onElement('saveReflectionBtn', 'click', saveReflection);
    onElement('prevMonth', 'click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
    onElement('nextMonth', 'click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
    onElement('saveReasonsBtn', 'click', () => { state.reasons = document.getElementById('reasonsText').value.trim(); saveState(); showToast('Reasons saved'); });
    onElement('saveRelapseBtn', 'click', () => {
      const today = todayKey();
      const what = document.getElementById('relapseWhat').value.trim();
      const trigger = document.getElementById('relapseTrigger').value.trim();

      state.relapses.unshift({
        what,
        trigger,
        breakDate: today,
        date: new Date().toISOString()
      });

      // Restart support should reset visible progress so the user starts again from 0.
      resetProgressAfterContact(today);

      document.getElementById('relapseWhat').value = '';
      document.getElementById('relapseTrigger').value = '';
      document.getElementById('relapseMessage').classList.remove('hidden');
      saveState();
      showToast('Restart saved gently');
    });
    onElement('closeEmergencyBtn', 'click', closeEmergency);
    onElement('emergencyModal', 'click', e => { if (e.target.id === 'emergencyModal') closeEmergency(); });
    onElement('startTimerBtn', 'click', startTimer);
    onElement('resetTimerBtn', 'click', resetTimer);
    onElement('saveUnsentBtn', 'click', saveUnsent);
    onElement('urgeIntensity', 'input', e => document.getElementById('urgeIntensityValue').textContent = e.target.value);
    onElement('triggerButtons', 'click', e => {
      const btn = e.target.closest('[data-trigger]');
      if (!btn) return;
      const trigger = btn.dataset.trigger;
      selectedUrgeTriggers.has(trigger) ? selectedUrgeTriggers.delete(trigger) : selectedUrgeTriggers.add(trigger);
      renderTriggerButtons();
    });
    onElement('nextGroundingBtn', 'click', () => {
      groundingStepIndex = (groundingStepIndex + 1) % groundingSteps.length;
      renderGroundingStep();
    });
    onElement('saveLetterBtn', 'click', saveLetter);
    onElement('urgeHistory', 'click', e => {
      const btn = e.target.closest('[data-delete-urge]');
      if (!btn) return;
      state.unsentMessages.splice(Number(btn.dataset.deleteUrge), 1);
      saveState();
      showToast('Urge deleted');
    });
    onElement('letterList', 'click', e => {
      const btn = e.target.closest('[data-delete-letter]');
      if (!btn) return;
      state.letters = state.letters.filter(letter => letter.id !== btn.dataset.deleteLetter);
      saveState();
      showToast('Letter deleted');
    });
    document.querySelectorAll('[data-share-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.shareMode = btn.dataset.shareMode;
        saveState();
      });
    });
    onElement('copyShareBtn', 'click', copyShare);
    onElement('nativeShareBtn', 'click', nativeShare);
    onElement('downloadShareImageBtn', 'click', downloadShareImage);
    onElement('shareImageBtn', 'click', shareImage);
    onElement('shareImageTemplate', 'change', e => {
      state.shareImageTemplate = e.target.value;
      saveState();
      renderShareImage();
      showToast('Image style updated');
    });
    onElement('saveNameBtn', 'click', () => {
      const name = document.getElementById('editName').value.trim();
      if (!name) return showToast('Name cannot be empty');
      state.username = name;
      saveState();
      showToast('Username saved');
    });
    onElement('exportBtn', 'click', exportData);
    onElement('importFile', 'change', e => importData(e.target.files[0]));
    onElement('manualBackupBtn', 'click', () => {
      const key = createLocalBackup('Manual backup');
      if (!key) return showToast('Could not create backup');
      showBackupNotice('Backup created on this device. You can restore the latest backup from here.');
      showToast('Backup created');
    });
    onElement('restoreLatestBackupBtn', 'click', restoreLatestBackup);
    onElement('clearTodayBtn', 'click', () => {
      if (!confirm('Clear today’s check-in and reflection?')) return;
      createLocalBackup('Before clearing today');
      const today = todayKey();
      state.checkins = state.checkins.filter(d => d !== today);
      delete state.reflections[today];
      saveState();
      showToast('Today cleared');
    });
    onElement('resetAllBtn', 'click', () => {
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
  'Don’t message them',
  'Don’t check their profile',
  'Don’t check stories or last seen',
  'Don’t reread old messages',
  'Don’t ask someone about them',
  'Do one thing that helps me feel calm'
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
  state.emergencyRegion = typeof state.emergencyRegion === 'string' ? state.emergencyRegion : '';
  state.missedDaysResponseKey = typeof state.missedDaysResponseKey === 'string' ? state.missedDaysResponseKey : '';
  state.currentStreakResetDate = isDateKey(state.currentStreakResetDate) ? state.currentStreakResetDate : '';
  state.darkMode = Boolean(state.darkMode);
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
  const protectionWins = Object.values(state.todayPlanChecks || {}).reduce((sum, arr) => {
    return sum + (Array.isArray(arr) ? arr.length : 0);
  }, 0);

  const insights = [
    ['Most common mood', getMostCommonValue(moodValues)],
    ['Most common trigger', getMostCommonTrigger()],
    ['Hardest day', getHardestDayOfWeek()],
    ['Average urge', getAverageUrgeIntensity()],
    ['Saved instead of sent', String((state.unsentMessages || []).length)],
    ['Protection wins', String(protectionWins)]
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
    preview.textContent = state.contactCost || 'No reminder saved yet.';
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

function renderDarkMode() {
  ensureNextFeatureState();
  document.body.classList.toggle('dark-mode', state.darkMode);
  const btn = document.getElementById('darkModeToggle');
  if (btn) {
    btn.textContent = state.darkMode ? 'Disable dark mode' : 'Enable dark mode';
  }
}


function renderTodayPlanEditor() {
  ensureNextFeatureState();
  const editor = document.getElementById('todayPlanEditor');
  if (editor) editor.value = state.todayPlanItems.join('\n');
}


function getEmergencyHelpInfo(region) {
  const options = {
    turkey: {
      title: 'Turkey',
      lines: ['Immediate danger: 112']
    },
    us: {
      title: 'United States',
      lines: ['Immediate danger: 911', 'Crisis support: call or text 988']
    },
    canada: {
      title: 'Canada',
      lines: ['Immediate danger: 911', 'Suicide crisis support: call or text 988']
    },
    uk_ireland: {
      title: 'United Kingdom / Ireland',
      lines: ['Immediate danger: 999 or 112', 'Emotional support: Samaritans 116 123']
    },
    eu: {
      title: 'European Union',
      lines: ['Immediate danger: 112']
    },
    other: {
      title: 'Use your local emergency number',
      lines: ['If there is immediate danger, call your local emergency services now.']
    }
  };

  return options[region] || {
    title: 'Choose an emergency help region in Settings',
    lines: ['If there is immediate danger, use your local emergency number now.']
  };
}

function renderEmergencyHelpCard() {
  const number = document.getElementById('urgentHelpNumber');
  if (!number) return;

  const info = getEmergencyHelpInfo(state.emergencyRegion);
  number.innerHTML = `<strong>${safeText(info.title)}</strong>${info.lines.map(line => `<span>${safeText(line)}</span>`).join('')}`;

  const select = document.getElementById('emergencyRegionSelect');
  if (select) select.value = state.emergencyRegion || '';
}


function renderMissedDaysPrompt() {
  const card = document.getElementById('missedDaysCard');
  if (!card) return;

  const info = getMissedDaysInfo();
  card.classList.toggle('hidden', !info);

  if (!info) return;

  const text = document.getElementById('missedDaysText');
  const count = document.getElementById('missedDaysCount');
  const form = document.getElementById('missedRelapseForm');

  if (count) count.textContent = String(info.count);
  if (text) {
    text.textContent = `You were away for ${info.count} day${info.count === 1 ? '' : 's'}. What happened?`;
  }
  if (form) form.classList.add('hidden');
}

function renderNextFeatures() {
  ensureNextFeatureState();
  renderMissedDaysPrompt();
  renderTodayPlan();
  renderProgressInsights();
  renderSafePeople();
  renderContactCost();
  renderPrivacyMode();
  renderDarkMode();
  renderTodayPlanEditor();
  renderEmergencyHelpCard();
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
});

function bindNextFeatureEvents() {
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

  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
      state.darkMode = !state.darkMode;
      saveNextFeatureState();
      showToast(state.darkMode ? 'Dark mode enabled' : 'Dark mode disabled');
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

  const emergencyRegionSelect = document.getElementById('emergencyRegionSelect');
  if (emergencyRegionSelect) {
    emergencyRegionSelect.addEventListener('change', e => {
      state.emergencyRegion = e.target.value;
      saveNextFeatureState();
      showToast('Emergency help region saved');
    });
  }

  const missedStayedBtn = document.getElementById('missedStayedBtn');
  if (missedStayedBtn) {
    missedStayedBtn.addEventListener('click', resolveMissedDaysAsNoContact);
  }

  const missedContactedBtn = document.getElementById('missedContactedBtn');
  if (missedContactedBtn) {
    missedContactedBtn.addEventListener('click', showMissedRelapseForm);
  }

  const missedSkipBtn = document.getElementById('missedSkipBtn');
  if (missedSkipBtn) {
    missedSkipBtn.addEventListener('click', skipMissedDaysPrompt);
  }

  const missedRelapseSaveBtn = document.getElementById('missedRelapseSaveBtn');
  if (missedRelapseSaveBtn) {
    missedRelapseSaveBtn.addEventListener('click', saveMissedRelapse);
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
