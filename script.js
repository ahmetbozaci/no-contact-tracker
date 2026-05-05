const STORAGE_KEY = 'ncc_local_v1';
    const moods = ['Calm', 'Strong', 'Sad', 'Anxious', 'Tempted', 'Hopeful'];
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
    let reminderInterval = null;

    function defaultState() {
      return {
        username: '',
        checkins: [],
        reflections: {},
        reasons: '',
        unsentMessages: [],
        relapses: [],
        reminderTime: '',
        reminderLastShown: ''
      };
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
      } catch {
        return defaultState();
      }
    }

    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
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
      if (tab === 'share') renderShareText();
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
      document.getElementById('reminderTime').value = state.reminderTime || '';

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
      updateReminderLoop();
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
      `).join('') : '<p class="subtitle">No private notes yet.</p>';
    }

    function renderShareText() {
      if (!state.username) return;
      const stats = getStats();
      const mood = state.reflections[todayKey()]?.mood || 'Not added';
      const text = `🌿 No Contact Challenge Update\n✅ Current streak: ${stats.current} day${stats.current === 1 ? '' : 's'}\n📅 Total no-contact days: ${stats.total}\n🏆 Longest streak: ${stats.longest} day${stats.longest === 1 ? '' : 's'}\n💭 Today’s mood: ${mood}\n\nI’m choosing peace today.`;
      document.getElementById('shareText').textContent = text;
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
      document.getElementById('reasonsPreview').textContent = state.reasons || 'No reasons saved yet. You can add them in the Emergency tab.';
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
      if (!text) return showToast('Write something first');
      state.unsentMessages.unshift({ text, intensity: Number(document.getElementById('urgeIntensity').value), date: new Date().toISOString() });
      document.getElementById('unsentMessage').value = '';
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
      if (!navigator.share) return showToast('Native share is not available here');
      try { await navigator.share({ text }); } catch {}
    }

    function updateReminderLoop() {
      if (reminderInterval) clearInterval(reminderInterval);
      if (!state.reminderTime) return;
      reminderInterval = setInterval(() => {
        const now = new Date();
        const current = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const today = todayKey();
        if (current === state.reminderTime && state.reminderLastShown !== today && !getStats().checkedToday) {
          state.reminderLastShown = today;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('No Contact Challenge', { body: 'A gentle reminder to check in today 🌿' });
          } else {
            showToast('Reminder: check in today 🌿');
          }
        }
      }, 30000);
    }

    async function saveReminder() {
      state.reminderTime = document.getElementById('reminderTime').value;
      const notice = document.getElementById('reminderNotice');
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        notice.textContent = permission === 'granted'
          ? 'Browser notifications are enabled. For iPhone/Safari, also set a phone alarm for reliability.'
          : 'Notifications were not enabled. Please set a phone alarm manually for reliable reminders.';
      } else {
        notice.textContent = 'This browser does not support notifications. Please set a phone alarm manually.';
      }
      notice.classList.remove('hidden');
      saveState();
      showToast('Reminder saved');
    }

    function exportData() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `no-contact-data-${todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    function importData(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== 'object') throw new Error('Invalid file');
          state = { ...defaultState(), ...data };
          saveState();
          showToast('Data imported');
        } catch {
          showToast('Could not import this JSON file');
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
    document.getElementById('copyShareBtn').addEventListener('click', copyShare);
    document.getElementById('nativeShareBtn').addEventListener('click', nativeShare);
    document.getElementById('refreshShareBtn').addEventListener('click', renderShareText);
    document.getElementById('saveNameBtn').addEventListener('click', () => {
      const name = document.getElementById('editName').value.trim();
      if (!name) return showToast('Name cannot be empty');
      state.username = name;
      saveState();
      showToast('Username saved');
    });
    document.getElementById('saveReminderBtn').addEventListener('click', saveReminder);
    document.getElementById('testNotificationBtn').addEventListener('click', async () => {
      if (!('Notification' in window)) return showToast('Notifications not supported');
      const permission = await Notification.requestPermission();
      if (permission === 'granted') new Notification('No Contact Challenge', { body: 'Test reminder works 🌿' });
      else showToast('Notification permission not granted');
    });
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importFile').addEventListener('change', e => importData(e.target.files[0]));
    document.getElementById('clearTodayBtn').addEventListener('click', () => {
      if (!confirm('Clear today’s check-in and reflection?')) return;
      const today = todayKey();
      state.checkins = state.checkins.filter(d => d !== today);
      delete state.reflections[today];
      saveState();
      showToast('Today cleared');
    });
    document.getElementById('resetAllBtn').addEventListener('click', () => {
      if (!confirm('Reset all local data? This cannot be undone.')) return;
      localStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      render();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEmergency(); });

    updateTimerDisplay();
    render();
