const STORAGE_KEY = 'ncc_local_v1';
const APP_SCHEMA_VERSION = 2;
const BACKUP_PREFIX = 'ncc_local_backup_';
const MAX_AUTO_BACKUPS = 5;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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
    let latestShareImageDataUrl = '';

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
      if (!confirm('Restore the latest local backup? Current data will be backed up first.')) return;

      try {
        const currentBackupKey = createLocalBackup('Before restoring latest backup');
        const backup = JSON.parse(localStorage.getItem(latestKey));
        state = migrateState(backup.data || backup);
        saveState();
        showBackupNotice(`Latest backup restored. A backup of your previous current data was also saved${currentBackupKey ? '.' : ' if storage allowed it.'}`);
        showToast('Backup restored');
      } catch {
        showToast('Could not restore backup');
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
      renderShareImage();
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

    function renderShareImage() {
      const preview = document.getElementById('shareImagePreview');
      if (!preview || !state.username) return;

      const { username, stats, mood, dateLabel, message } = getShareData();
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gradientA = ctx.createRadialGradient(130, 120, 0, 130, 120, 420);
      gradientA.addColorStop(0, 'rgba(99,153,34,0.14)');
      gradientA.addColorStop(1, 'rgba(99,153,34,0)');
      ctx.fillStyle = gradientA;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gradientB = ctx.createRadialGradient(930, 80, 0, 930, 80, 360);
      gradientB.addColorStop(0, 'rgba(24,95,165,0.10)');
      gradientB.addColorStop(1, 'rgba(24,95,165,0)');
      ctx.fillStyle = gradientB;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cardX = 72;
      const cardY = 78;
      const cardW = canvas.width - 144;
      const cardH = canvas.height - 156;
      ctx.save();
      ctx.shadowColor = 'rgba(44,44,42,0.08)';
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 16;
      roundedRect(ctx, cardX, cardY, cardW, cardH, 34);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fill();
      ctx.restore();

      ctx.save();
      roundedRect(ctx, cardX, cardY, cardW, cardH, 34);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.stroke();
      ctx.restore();

      ctx.save();
      roundedRect(ctx, cardX + 44, cardY + 44, 320, 56, 28);
      ctx.fillStyle = '#eaf3de';
      ctx.fill();
      ctx.translate(cardX + 84, cardY + 73);
      ctx.rotate(-Math.PI / 4);
      roundedRect(ctx, -12, -12, 24, 24, 10);
      ctx.fillStyle = '#3b6d11';
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#3b6d11';
      ctx.font = '700 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('No Contact Challenge', cardX + 116, cardY + 79);

      ctx.fillStyle = '#77746d';
      ctx.font = '600 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(dateLabel, cardX + cardW - 250, cardY + 79);

      ctx.fillStyle = '#2c2c2a';
      ctx.font = '700 64px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      drawCanvasMultilineText(ctx, `Progress update for ${username}`, cardX + 48, cardY + 168, cardW - 96, 74, 2);

      ctx.fillStyle = '#77746d';
      ctx.font = '500 29px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      drawCanvasMultilineText(ctx, 'A gentle snapshot of today’s no-contact journey.', cardX + 48, cardY + 302, cardW - 96, 42, 2);

      ctx.save();
      roundedRect(ctx, cardX + 48, cardY + 372, cardW - 96, 250, 28);
      ctx.fillStyle = '#f8fbf4';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(59,109,17,0.10)';
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#3b6d11';
      ctx.font = '800 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Current streak', cardX + 88, cardY + 446);
      ctx.fillStyle = '#2c2c2a';
      ctx.font = '800 118px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(String(stats.current), cardX + 84, cardY + 560);
      ctx.fillStyle = '#77746d';
      ctx.font = '600 34px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(`day${stats.current === 1 ? '' : 's'} of choosing peace`, cardX + 250, cardY + 554);

      const smallY = cardY + 658;
      const gap = 22;
      const smallW = (cardW - 96 - gap * 2) / 3;
      const items = [
        { label: 'Total days', value: String(stats.total), accent: '#eaf3de', color: '#3b6d11' },
        { label: 'Longest streak', value: `${stats.longest}`, accent: '#e6f1fb', color: '#185fa5' },
        { label: 'Today’s mood', value: mood, accent: '#faeeda', color: '#ba7517' }
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
        ctx.fillStyle = '#2c2c2a';
        ctx.font = item.value.length > 12
          ? '700 34px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
          : '800 48px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        const valueLines = wrapCanvasText(ctx, item.value, smallW - 56).slice(0, 2);
        valueLines.forEach((line, lineIndex) => {
          ctx.fillText(line, x + 28, smallY + 104 + lineIndex * 42);
        });
      });

      ctx.save();
      roundedRect(ctx, cardX + 48, cardY + 884, cardW - 96, 190, 28);
      ctx.fillStyle = '#fafaf7';
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#3b6d11';
      ctx.font = '700 28px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Today’s reminder', cardX + 80, cardY + 938);

      ctx.fillStyle = '#2c2c2a';
      ctx.font = '700 44px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      drawCanvasMultilineText(ctx, message, cardX + 80, cardY + 1006, cardW - 160, 58, 2);

      ctx.fillStyle = '#77746d';
      ctx.font = '600 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Shared from my private local tracker', cardX + 80, cardY + cardH - 44);

      latestShareImageDataUrl = canvas.toDataURL('image/png');
      preview.src = latestShareImageDataUrl;
    }

    function downloadShareImage() {
      if (!latestShareImageDataUrl) renderShareImage();
      if (!latestShareImageDataUrl) return showToast('Could not create image');
      const link = document.createElement('a');
      link.href = latestShareImageDataUrl;
      link.download = `no-contact-progress-${todayKey()}.png`;
      link.click();
      showToast('PNG downloaded');
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
      if (!latestShareImageDataUrl) return showToast('Could not create image');
      const file = dataUrlToFile(latestShareImageDataUrl, `no-contact-progress-${todayKey()}.png`);

      if (!navigator.share) {
        downloadShareImage();
        showToast('Image sharing is not available here, so the PNG was downloaded instead');
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
          showToast('This browser shared the text instead of the image');
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
          createLocalBackup('Before importing JSON file');
          state = migrateState(data);
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
    document.getElementById('manualBackupBtn').addEventListener('click', () => {
      const key = createLocalBackup('Manual backup');
      if (!key) return showToast('Could not create backup');
      showBackupNotice('Manual backup created on this device. You can restore the latest backup from here.');
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
      if (!confirm('Reset all local data? A backup will be created first, but reset cannot be undone if browser storage is cleared.')) return;
      createLocalBackup('Before resetting all data');
      localStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      render();
      showToast('Reset complete');
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEmergency(); });

    updateTimerDisplay();
    render();
