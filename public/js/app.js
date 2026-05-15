const DEFAULT_STATE = {
  players: [],
  trainings: [],
  matches: [],
  laundryHistory: [],
  settings: {
    trainingDays: ['Di', 'Do'],
    trainingTime: '17:00',
    trainingTimeEnd: '18:30',
    trainingLocation: 'Sportplatz FVH',
    trainingExceptions: [],
    trainingThreshold: 3,
    useWeather: true,
    season: '26/27',
    seasons: ['25/26', '26/27']
  },
  trainingActive: false,
  trainingStart: null,
  trainingDate: null
};

let state = {};
let currentPage = 'dashboard';
let calendarDate = new Date();
let timerInterval = null;
let timerRunning = false;
let timerSeconds = 0;
let currentTrainingAttendance = {};
let currentTrainingDate = null;
let matchKaderSelection = {};
let playerExpanded = {};
let historySeasonFilter = null;

const FORMATIONS = {
  '2-3-1': { name: '2-3-1', desc: '2 Abwehr · 3 Mittelfeld · 1 Sturm', positions: [
    { id:'tw', label:'TW', x:50, y:90 },
    { id:'iv1', label:'IV', x:33, y:70 }, { id:'iv2', label:'IV', x:67, y:70 },
    { id:'lm', label:'LM', x:18, y:45 }, { id:'zm', label:'ZM', x:50, y:42 }, { id:'rm', label:'RM', x:82, y:45 },
    { id:'st', label:'ST', x:50, y:16 }
  ]},
  '3-2-1': { name: '3-2-1', desc: '3 Abwehr · 2 Mittelfeld · 1 Sturm', positions: [
    { id:'tw', label:'TW', x:50, y:90 },
    { id:'lv', label:'LV', x:18, y:70 }, { id:'iv', label:'IV', x:50, y:73 }, { id:'rv', label:'RV', x:82, y:70 },
    { id:'zm1', label:'ZM', x:35, y:44 }, { id:'zm2', label:'ZM', x:65, y:44 },
    { id:'st', label:'ST', x:50, y:16 }
  ]},
  '2-2-2': { name: '2-2-2', desc: '2 Abwehr · 2 Mittelfeld · 2 Sturm', positions: [
    { id:'tw', label:'TW', x:50, y:90 },
    { id:'lv', label:'LV', x:25, y:70 }, { id:'rv', label:'RV', x:75, y:70 },
    { id:'zm1', label:'ZM', x:35, y:45 }, { id:'zm2', label:'ZM', x:65, y:45 },
    { id:'lf', label:'LF', x:30, y:18 }, { id:'rf', label:'RF', x:70, y:18 }
  ]},
  '1-3-2': { name: '1-3-2', desc: '1 Abwehr · 3 Mittelfeld · 2 Sturm', positions: [
    { id:'tw', label:'TW', x:50, y:90 },
    { id:'iv', label:'IV', x:50, y:72 },
    { id:'lm', label:'LM', x:18, y:46 }, { id:'zm', label:'ZM', x:50, y:43 }, { id:'rm', label:'RM', x:82, y:46 },
    { id:'st1', label:'ST', x:33, y:17 }, { id:'st2', label:'ST', x:67, y:17 }
  ]}
};

function loadState() {
  try {
    const saved = localStorage.getItem('fvh_state');
    state = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_STATE));
    migrateState();
  } catch {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function migrateState() {
  if (!state.laundryHistory) state.laundryHistory = [];
  if (!state.settings.season) state.settings.season = '26/27';
  if (!state.settings.seasons) state.settings.seasons = ['25/26', '26/27'];
  if (state.players) {
    state.players.forEach(p => {
      if (!p.rating) p.rating = { fitness: 3, technique: 3, matchPerf: 3 };
    });
  }
  if (state.trainings) {
    state.trainings.forEach(t => {
      if (!t.season) t.season = '25/26';
    });
  }
  if (state.matches) {
    state.matches.forEach(m => {
      if (!m.season) m.season = '25/26';
      if (!m.playerRatings) m.playerRatings = {};
      if (m.homeGoals === undefined) m.homeGoals = null;
      if (m.awayGoals === undefined) m.awayGoals = null;
      if (m.kader === undefined) m.kader = null;
      if (m.lineup === undefined) m.lineup = null;
      if (!m.tasks) m.tasks = {};
      ['booth','cake','setup','teardown','laundry'].forEach(k => {
        if (!m.tasks[k]) m.tasks[k] = [];
      });
    });
  }
}

function saveState() {
  try {
    localStorage.setItem('fvh_state', JSON.stringify(state));
  } catch (e) {
    console.error('Save error:', e);
  }
}

function navigate(page) {
  currentPage = page;
  window.location.hash = page;
  render();
}

function toggleMenu() {
  document.getElementById('side-menu').classList.toggle('hidden');
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getMonday(d) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function addDays(d, days) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

const DAY_MAP = { 'Mo': 1, 'Di': 2, 'Mi': 3, 'Do': 4, 'Fr': 5, 'Sa': 6, 'So': 0 };

function isExceptionDate(dateStr) {
  var exc = state.settings.trainingExceptions || [];
  for (var i = 0; i < exc.length; i++) {
    var e = exc[i];
    if (e.to) {
      if (dateStr >= e.from && dateStr <= e.to) return true;
    } else {
      if (e.from === dateStr) return true;
    }
  }
  return false;
}

function isTrainingScheduled(dateStr) {
  if (!state.settings.trainingDays || state.settings.trainingDays.length === 0) return false;
  if (isExceptionDate(dateStr)) return false;
  const d = new Date(dateStr + 'T12:00:00');
  const dayNum = d.getDay();
  return state.settings.trainingDays.some(day => DAY_MAP[day] === dayNum);
}

function getNextScheduledTraining() {
  const today = todayStr();
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const check = new Date(d);
    check.setDate(check.getDate() + i);
    const dateStr = check.getFullYear() + '-' + String(check.getMonth()+1).padStart(2,'0') + '-' + String(check.getDate()).padStart(2,'0');
    if (isTrainingScheduled(dateStr) && dateStr >= today) return { date: dateStr, dayName: ['So','Mo','Di','Mi','Do','Fr','Sa'][check.getDay()] };
  }
  return null;
}

function getCurrentWeekTrainings() {
  const today = new Date();
  const monday = getMonday(today);
  const sunday = addDays(monday, 6);
  const mondayStr = monday.getFullYear() + '-' + String(monday.getMonth()+1).padStart(2,'0') + '-' + String(monday.getDate()).padStart(2,'0');
  const sundayStr = sunday.getFullYear() + '-' + String(sunday.getMonth()+1).padStart(2,'0') + '-' + String(sunday.getDate()).padStart(2,'0');
  return state.trainings.filter(t => t.date >= mondayStr && t.date <= sundayStr);
}

function getSeasonTrainings(season) {
  return state.trainings.filter(t => (t.season || '25/26') === (season || state.settings.season));
}

function getSeasonMatches(season) {
  return state.matches.filter(m => (m.season || '25/26') === (season || state.settings.season));
}

function getPlayerAttendancePct(playerId, season) {
  const seasonTrainings = getSeasonTrainings(season);
  const total = seasonTrainings.length;
  if (total === 0) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);
  const cutoffStr = cutoff.getFullYear() + '-' + String(cutoff.getMonth()+1).padStart(2,'0') + '-' + String(cutoff.getDate()).padStart(2,'0');

  let weightedAttended = 0;
  let weightedDenom = 0;

  for (const t of seasonTrainings) {
    const w = t.date >= cutoffStr ? 3 : 1;
    weightedDenom += w;
    const a = t.attendance && t.attendance[playerId];
    if (!a) continue;
    const status = typeof a === 'string' ? a : (a.status || '');
    if (status === 'yes' || status === 'late') {
      weightedAttended += w;
    }
  }

  if (weightedDenom === 0) return 0;
  return Math.round(weightedAttended / weightedDenom * 100);
}

function getPlayerBehaviorPct(playerId, season) {
  const seasonTrainings = getSeasonTrainings(season);
  let total = 0, good = 0;
  for (const t of seasonTrainings) {
    const a = t.attendance && t.attendance[playerId];
    if (!a || typeof a === 'string') continue;
    const status = a.status || '';
    const behav = a.behavior || '';
    if (status === 'yes' && behav) {
      total++;
      if (behav === 'good') good++;
    }
  }
  return total > 0 ? Math.round(good / total * 100) : 0;
}

function getScheduledTrainingsInMonth(year, month) {
  const result = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const time = state.settings.trainingTime || '17:00';
  const timeEnd = state.settings.trainingTimeEnd || '18:30';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (isTrainingScheduled(dateStr)) {
      result.push({ date: dateStr, time, timeEnd, scheduled: true });
    }
  }
  return result;
}

function getTrainingCount(playerId) {
  let count = 0;
  for (const t of getSeasonTrainings()) {
    const a = t.attendance && t.attendance[playerId];
    const status = a ? (typeof a === 'string' ? a : a.status || '') : '';
    if (status === 'yes') count++;
  }
  return count;
}

function getPlayerAmpel(playerId) {
  const count = getTrainingCount(playerId);
  const threshold = state.settings.trainingThreshold || 3;
  if (count >= threshold) return { level: 'green', count, label: 'Spielberechtigt' };
  if (count >= threshold - 1) return { level: 'yellow', count, label: 'Knapp' };
  return { level: 'red', count, label: 'Nicht spielberechtigt' };
}

function showModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(overlay);
  return overlay.querySelector('.modal');
}

function addPlayer() {
  const modal = showModal(`
    <h2>Spieler hinzufügen</h2>
    <label>Name</label>
    <input type="text" id="player-name-input" placeholder="Vorname Nachname" autofocus>
    <label>Trikotnummer</label>
    <input type="number" id="player-number-input" placeholder="z.B. 7" min="0" max="99">
    <button class="btn btn-primary" onclick="savePlayer()">Hinzufügen</button>
    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Abbrechen</button>
  `);
  setTimeout(() => $('#player-name-input')?.focus(), 100);
}

function editPlayer(id) {
  const p = state.players.find(x => x.id === id);
  if (!p) return;
  const r = p.rating || { fitness: 3, technique: 3, matchPerf: 3 };
  function stars(cat, val) {
    return [1,2,3,4,5].map(i => `<span style="cursor:pointer;font-size:22px;" onclick="clickRating(${id},'${cat}',${i})">${i <= val ? '⭐' : '☆'}</span>`).join('');
  }
  const modal = showModal(`
    <h2>Spieler bearbeiten</h2>
    <label>Name</label>
    <input type="text" id="player-name-input" value="${escHtml(p.name)}" autofocus>
    <label>Trikotnummer</label>
    <input type="number" id="player-number-input" value="${p.number || ''}" min="0" max="99">
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
      <div style="font-size:14px;font-weight:600;margin-bottom:8px;">🏃 Bewertung</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:100px;font-size:13px;">🏃 Fitness</span>
          <span id="stars-fitness">${stars('fitness', r.fitness)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:100px;font-size:13px;">⚽ Technik</span>
          <span id="stars-technique">${stars('technique', r.technique)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:100px;font-size:13px;">📊 Match</span>
          <span id="stars-matchPerf">${stars('matchPerf', r.matchPerf)}</span>
        </div>
      </div>
    </div>
    <button class="btn btn-primary" onclick="savePlayer(${id})">Speichern</button>
    <button class="btn btn-danger" onclick="deletePlayer(${id})">Löschen</button>
    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Abbrechen</button>
  `);
  setTimeout(() => $('#player-name-input')?.focus(), 100);
}

function clickRating(playerId, cat, val) {
  const p = state.players.find(x => x.id === playerId);
  if (!p) return;
  if (!p.rating) p.rating = { fitness: 3, technique: 3, matchPerf: 3 };
  p.rating[cat] = val;
  saveState();
  const el = document.getElementById('stars-' + cat);
  if (el) {
    el.innerHTML = [1,2,3,4,5].map(i =>
      `<span style="cursor:pointer;font-size:22px;" onclick="clickRating(${playerId},'${cat}',${i})">${i <= val ? '⭐' : '☆'}</span>`
    ).join('');
  }
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function savePlayer(editId) {
  const name = $('#player-name-input')?.value?.trim();
  const num = parseInt($('#player-number-input')?.value) || 0;
  if (!name) return;

  if (editId) {
    const p = state.players.find(x => x.id === editId);
    if (p) { p.name = name; p.number = num; if (!p.rating) p.rating = { fitness: 3, technique: 3, matchPerf: 3 }; }
  } else {
    state.players.push({ id: Date.now(), name, number: num, active: true, rating: { fitness: 3, technique: 3, matchPerf: 3 } });
  }
  saveState();
  document.querySelector('.modal-overlay')?.remove();
  render();
}

function deletePlayer(id) {
  if (!confirm('Spieler wirklich löschen?')) return;
  state.players = state.players.filter(p => p.id !== id);
  saveState();
  document.querySelector('.modal-overlay')?.remove();
  render();
}

function deleteTraining(id) {
  if (!confirm('Trainingseinheit wirklich löschen?')) return;
  state.trainings = state.trainings.filter(t => t.id !== id);
  if (state.trainingActive && state.trainingDate) {
    state.trainingActive = false;
    state.trainingDate = null;
  }
  selectedTrainingId = null;
  saveState();
  render();
}

function startPastTraining() {
  const modal = showModal(`
    <h2>Training für vergangenes Datum</h2>
    <label>Datum auswählen</label>
    <input type="date" id="past-training-date" value="${todayStr()}">
    <button class="btn btn-primary" onclick="createPastTraining()">Training anlegen</button>
    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Abbrechen</button>
  `);
}

function navigateToTrainingDate(date) {
  if (date > todayStr()) {
    alert('Dieses Training liegt in der Zukunft.');
    return;
  }
  let existing = state.trainings.find(t => t.date === date);
  if (!existing) {
    existing = { id: Date.now(), date, attendance: {} };
    state.trainings.push(existing);
  }
  state.trainingActive = true;
  state.trainingDate = date;
  currentTrainingAttendance = JSON.parse(JSON.stringify(existing.attendance || {}));
  saveState();
  navigate('training');
}

function createPastTraining() {
  const date = $('#past-training-date')?.value;
  if (!date) return;
  if (date > todayStr()) { alert('Das Datum liegt in der Zukunft.'); return; }
  if (state.trainings.find(t => t.date === date)) { alert('Training für dieses Datum existiert bereits.'); document.querySelector('.modal-overlay')?.remove(); return; }
  state.trainings.push({ id: Date.now(), date, attendance: {} });
  state.trainingActive = true;
  state.trainingDate = date;
  currentTrainingAttendance = {};
  saveState();
  document.querySelector('.modal-overlay')?.remove();
  navigate('training');
}

function startTraining() {
  const today = todayStr();
  const existing = state.trainings.find(t => t.date === today);
  if (existing) {
    state.trainingActive = true;
    state.trainingDate = today;
    currentTrainingAttendance = existing.attendance || {};
  } else {
    state.trainingActive = true;
    state.trainingDate = today;
    currentTrainingAttendance = {};
  }
  saveState();
  navigate('training');
}

function setTrainingOverall(value) {
  const today = todayStr();
  let training = state.trainings.find(t => t.date === today);
  if (!training) {
    training = { id: Date.now(), date: today, attendance: {} };
    state.trainings.push(training);
  }
  if (value) training.overall = value;
  else delete training.overall;
  saveState();
  render();
}

function stopTraining() {
  state.trainingActive = false;
  state.trainingDate = null;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerRunning = false;
  timerSeconds = 0;
  saveState();
  render();
}

function getAttStatus(playerId) {
  const a = currentTrainingAttendance[playerId];
  if (!a) return '';
  if (typeof a === 'string') return a;
  return a.status || '';
}

function getAttBehavior(playerId) {
  const a = currentTrainingAttendance[playerId];
  if (!a || typeof a === 'string') return '';
  return a.behavior || '';
}

function countAtt(key) {
  return state.players.reduce((n, p) => n + (getAttStatus(p.id) === key ? 1 : 0), 0);
}

function setAttendance(playerId, value) {
  const old = currentTrainingAttendance[playerId];
  const oldBehavior = (typeof old === 'object' && old !== null) ? old.behavior : '';
  if (!value) {
    delete currentTrainingAttendance[playerId];
  } else {
    currentTrainingAttendance[playerId] = { status: value, behavior: oldBehavior };
  }
  const date = currentTrainingDate || todayStr();
  let training = state.trainings.find(t => t.date === date);
  if (!training) {
    training = { id: Date.now(), date, attendance: {} };
    state.trainings.push(training);
  }
  training.attendance = JSON.parse(JSON.stringify(currentTrainingAttendance));
  saveState();
  render();
}

function setBehavior(playerId, value) {
  const old = currentTrainingAttendance[playerId];
  const oldStatus = (typeof old === 'object' && old !== null) ? old.status : (typeof old === 'string' ? old : '');
  const newVal = oldStatus ? { status: oldStatus, behavior: value } : null;
  if (newVal) {
    currentTrainingAttendance[playerId] = newVal;
  } else {
    delete currentTrainingAttendance[playerId];
  }
  const date = currentTrainingDate || todayStr();
  let training = state.trainings.find(t => t.date === date);
  if (!training) {
    training = { id: Date.now(), date, attendance: {} };
    state.trainings.push(training);
  }
  training.attendance = JSON.parse(JSON.stringify(currentTrainingAttendance));
  saveState();
  render();
}

function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
  } else {
    timerRunning = true;
    timerInterval = setInterval(() => { timerSeconds++; renderTimer(); }, 1000);
  }
  renderTimer();
}

function resetTimer() {
  timerSeconds = 0;
  if (timerRunning) { clearInterval(timerInterval); timerInterval = null; timerRunning = false; }
  renderTimer();
}

function renderTimer() {
  const el = $('#timer-display');
  if (!el) return;
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  el.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

function shareWhatsApp(text) {
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

function shareMatchPoll(matchId) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  var title = 'Wer ist am ' + formatDate(m.date) + ' vs ' + m.opponent + ' dabei?';
  var options = state.players.map(function(p) { return '☐ ' + p.name; });
  if (m.isHome) {
    options.push('--- Heimspiel Helfer ---');
    options.push('🧁 Kuchen:');
    options.push('🏪 Buden:');
    options.push('🛠️ Aufbau:');
    options.push('🔨 Abbau:');
  }
  var text = title + '\n\n' + options.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      alert('📋 Kopiert!\n\n1. WhatsApp öffnen\n 2. In die Gruppe + → Abstimmung\n 3. Frage einfügen\n 4. Optionen einfügen');
    }).catch(function() { fallbackCopy(text); });
  } else { fallbackCopy(text); }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); alert('📋 Kopiert! Jetzt in WhatsApp als Abstimmung einfügen.'); }
  catch(e) { prompt('Manuell kopieren:', text); }
  document.body.removeChild(ta);
}

function getWeather() {
  const el = $('#weather-content');
  if (!el) return;
  el.innerHTML = '<div class="loading">Wetter wird geladen...</div>';

  const lat = 48.806;
  const lon = 8.222;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,precipitation&hourly=precipitation_probability,weather_code&timezone=auto&forecast_days=2`;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      const temp = data.current.temperature_2m;
      const code = data.current.weather_code;
      const precip = data.current.precipitation || 0;

      const weatherEmoji = getWeatherEmoji(code);
      const weatherText = getWeatherText(code);

      let alertHtml = '';
      if (code >= 95) {
        alertHtml = '<div class="weather-alert danger">⚡ Gewitterwarnung! Training abbrechen!</div>';
      } else if (code >= 80 && precip > 0) {
        alertHtml = '<div class="weather-alert warning">🌧️ Regen – denkt an Matschklamotten!</div>';
      } else {
        alertHtml = '<div class="weather-alert ok">✅ Keine Warnung – Training kann stattfinden</div>';
      }

      const quote = getWeatherQuote(code);
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;">
          <span style="font-size:44px;">${weatherEmoji}</span>
          <div>
            <div style="font-size:32px;font-weight:800;">${Math.round(temp)}°C</div>
            <div style="font-size:14px;color:var(--text-secondary);">${weatherText}</div>
          </div>
        </div>
        ${alertHtml}
        <div style="margin-top:10px;padding:10px;background:var(--card-bg);border-radius:8px;font-size:13px;font-style:italic;color:var(--text-secondary);text-align:center;">💬 ${quote}</div>
      `;
    })
    .catch(() => {
      el.innerHTML = '<div style="color:var(--text-secondary);">Wetter nicht verfügbar</div>';
    });
}

const WEATHER_QUOTES = [
  { cond: 'sun', text: 'Schönwetter-Spieler gibt\'s im Park. FVH-Spieler kommen auch bei Regen.' },
  { cond: 'sun', text: 'Training fällt nicht aus – nur die Ausreden werden leichter.' },
  { cond: 'sun', text: 'Die Sonne scheint nur für Zuschauer. Spieler schwitzen.' },
  { cond: 'sun', text: 'Bei dem Wetter bleiben die Schwachen zu Hause. Du bist hier.' },
  { cond: 'rain', text: 'Es gibt kein schlechtes Wetter – nur falsche Kleidung.' },
  { cond: 'rain', text: 'Regen macht dich nicht nass. Er wäscht die Ausreden weg.' },
  { cond: 'rain', text: 'Bei Regen wird man nicht nass – man wird härter.' },
  { cond: 'rain', text: 'Die besten Spiele werden im Regen entschieden.' },
  { cond: 'cold', text: 'Kälte ist eine Frage der Einstellung. Und der zweiten Lage.' },
  { cond: 'cold', text: 'Frieren kann ich auch zu Hause. Aber gewinnen nur hier.' },
  { cond: 'cold', text: 'Ball ist rund, Platz ist nass, Füße sind kalt – Augen sind heiß.' },
  { cond: 'cold', text: 'Im November werden keine Titel gewonnen. Sondern im März dankbar.' },
  { cond: 'any', text: 'Das Wetter ist keine Einladung – es ist eine Ausrede.' },
  { cond: 'any', text: 'Andere Vereine haben Wetter. Wir haben Training.' },
  { cond: 'any', text: 'Der FVH macht kein Schlecht-Wetter-Training. Sondern Hart-im-Nehmen-Training.' },
  { cond: 'any', text: 'Regen? Solange der Ball rollt, ist alles gut.' }
];

function getWeatherQuote(code) {
  let cond = 'any';
  if (code <= 3) cond = 'sun';
  else if (code >= 95) cond = 'rain';
  else if (code >= 80) cond = 'rain';
  else if (code >= 55) cond = 'rain';
  else if (code >= 51) cond = 'rain';
  const pool = WEATHER_QUOTES.filter(q => q.cond === cond || q.cond === 'any');
  return pool[Math.floor(Math.random() * pool.length)].text;
}

function getWeatherEmoji(code) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌧️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌧️';
  return '⚡';
}

function getWeatherText(code) {
  const codes = {
    0: 'Klarer Himmel', 1: 'Überwiegend klar', 2: 'Teilweise bewölkt', 3: 'Bewölkt',
    45: 'Nebel', 48: 'Reifnebel',
    51: 'leichter Niesel', 53: 'Niesel', 55: 'starker Niesel',
    61: 'leichter Regen', 63: 'Regen', 65: 'starker Regen',
    71: 'leichter Schnee', 73: 'Schnee', 75: 'starker Schnee',
    80: 'leichte Schauer', 81: 'Schauer', 82: 'starke Schauer',
    95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Gewitter mit Hagel'
  };
  return codes[code] || 'Unbekannt';
}

function getMatchesBetween(start, end) {
  return state.matches.filter(m => m.date >= start && m.date <= end);
}

let selectedMatchId = null;
let selectedTrainingId = null;
let historyExpandedId = null;
let selectedFormationPos = null;
let uiCollapsed = {};

function addMatch() {
  const modal = showModal(`
    <h2>Spiel hinzufügen</h2>
    <label>Datum</label>
    <input type="date" id="match-date-input" value="${todayStr()}">
    <label>Gegner</label>
    <input type="text" id="match-opponent-input" placeholder="z.B. SV Musterdorf">
    <label>Spielort</label>
    <select id="match-location-input" onchange="document.getElementById('match-address').style.display=this.value==='Auswärts'?'block':'none'">
      <option value="Heim">🏠 Heimspiel</option>
      <option value="Auswärts">✈️ Auswärtsspiel</option>
    </select>
    <div id="match-address" style="display:none;">
      <label>Adresse (Auswärts)</label>
      <input type="text" id="match-address-input" placeholder="z.B. Sportplatz Musterdorf, Hauptstr. 1">
    </div>
    <label>Anstoß</label>
    <input type="time" id="match-time-input" value="10:30">
    <button class="btn btn-primary" onclick="saveMatch()">Hinzufügen</button>
    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Abbrechen</button>
  `);
}

function saveMatch() {
  const date = $('#match-date-input')?.value;
  const opponent = $('#match-opponent-input')?.value?.trim();
  const location = $('#match-location-input')?.value;
  const address = $('#match-address-input')?.value?.trim() || '';
  const time = $('#match-time-input')?.value;
  const isHome = location === 'Heim';
  if (!date || !opponent) return;

  state.matches.push({
    id: Date.now(), date, opponent,
    location: isHome ? 'Heim' : (address || 'Auswärts'),
    time, isHome,
    poll: {},
    tasks: { booth: [], cake: [], setup: [], teardown: [], laundry: [] },
    formation: null,
    lineup: null
  });
  saveState();
  document.querySelector('.modal-overlay')?.remove();
  render();
}

function openMatchDetail(matchId) {
  selectedMatchId = matchId;
  navigate('matchday');
}

function closeMatchDetail() {
  selectedMatchId = null;
  render();
}

function setMatchPoll(matchId, playerId, value) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  if (!m.poll) m.poll = {};
  if (value) m.poll[playerId] = value;
  else delete m.poll[playerId];
  saveState();
  render();
}

function addTaskHelper(matchId, taskType) {
  const modal = showModal(`
    <h2>Helfer hinzufügen</h2>
    <label>Name</label>
    <input type="text" id="helper-name-input" placeholder="z.B. Mama Müller" autofocus>
    ${taskType === 'cake' ? '<label>Was bringst du mit?</label><input type="text" id="helper-note-input" placeholder="z.B. Käsekuchen">' : ''}
    <button class="btn btn-primary" onclick="saveTaskHelper(${matchId},'${taskType}')">Hinzufügen</button>
    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Abbrechen</button>
  `);
  setTimeout(() => $('#helper-name-input')?.focus(), 100);
}

function saveTaskHelper(matchId, taskType) {
  const name = $('#helper-name-input')?.value?.trim();
  if (!name) return;
  const note = $('#helper-note-input')?.value?.trim() || '';
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  if (!m.tasks) m.tasks = {};
  if (!m.tasks[taskType]) m.tasks[taskType] = [];
  m.tasks[taskType].push({ name, note });
  saveState();
  document.querySelector('.modal-overlay')?.remove();
  render();
}

function removeTaskHelper(matchId, taskType, index) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m || !m.tasks || !m.tasks[taskType]) return;
  m.tasks[taskType].splice(index, 1);
  saveState();
  render();
}

function deleteMatch(id) {
  if (!confirm('Spiel löschen?')) return;
  state.matches = state.matches.filter(m => m.id !== id);
  state.laundryHistory = (state.laundryHistory || []).filter(e => e.matchId !== id);
  saveState();
  render();
}

function autoAssignLaundry(matchId) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  if (!state.laundryHistory) state.laundryHistory = [];
  const confirmed = state.players.filter(p => (m.poll && m.poll[p.id]) === 'yes');
  if (confirmed.length === 0) { alert('Keine zugesagten Spieler verfügbar.'); return; }

  const alreadyAssigned = (m.tasks?.laundry || []).map(h => h.name);
  const available = confirmed.filter(p => !alreadyAssigned.includes(p.name));
  if (available.length === 0) { alert('Alle zugesagten Spieler sind bereits eingetragen.'); return; }

  available.sort((a, b) => {
    const lastA = state.laundryHistory.filter(e => e.playerId === a.id).sort((x,y) => y.date.localeCompare(x.date))[0];
    const lastB = state.laundryHistory.filter(e => e.playerId === b.id).sort((x,y) => y.date.localeCompare(x.date))[0];
    return (lastA ? lastA.date : '') < (lastB ? lastB.date : '') ? -1 : 1;
  });

  const pick = available[0];
  if (!m.tasks) m.tasks = {};
  if (!m.tasks.laundry) m.tasks.laundry = [];
  m.tasks.laundry.push({ name: pick.name, note: '⚡ automatisch' });
  state.laundryHistory.push({ matchId, playerId: pick.id, date: m.date || todayStr() });
  saveState();
  render();
}

function setMatchScore(matchId) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  const home = parseInt($('#match-home-goals')?.value);
  const away = parseInt($('#match-away-goals')?.value);
  m.homeGoals = isNaN(home) ? null : home;
  m.awayGoals = isNaN(away) ? null : away;
  saveState();
}

function setMatchRating(matchId, playerId, cat, val) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  if (!m.playerRatings) m.playerRatings = {};
  if (!m.playerRatings[playerId]) m.playerRatings[playerId] = { spiel: 0, zweikampf: 0, verstaendnis: 0 };
  m.playerRatings[playerId][cat] = val;
  saveState();
  render();
}

function getPlayerMatchAvg(playerId, cat) {
  const ratings = [];
  for (const m of getSeasonMatches()) {
    const r = m.playerRatings && m.playerRatings[playerId];
    if (r && r[cat] && r[cat] > 0) ratings.push(r[cat]);
  }
  if (ratings.length === 0) return 0;
  const avg = ratings.reduce((a,b) => a + b, 0) / ratings.length;
  return Math.round(avg * 2) / 2; // round to nearest 0.5
}

// ─── Kader für Telegram-Umfrage ────────────────────────────
function toggleKaderPlayer(playerId) {
  matchKaderSelection[playerId] = !matchKaderSelection[playerId];
  render();
}

function selectAllKader() {
  for (const p of state.players) matchKaderSelection[p.id] = true;
  render();
}

function selectNoneKader() {
  for (const p of state.players) matchKaderSelection[p.id] = false;
  render();
}

function sendKaderPoll() {
  const nextMatch = state.matches.filter(m => m.date >= todayStr()).sort((a,b) => a.date.localeCompare(b.date))[0];
  if (!nextMatch) return alert('Kein nächstes Spiel gefunden');
  const selected = Object.keys(matchKaderSelection).filter(k => k !== '_matchId' && matchKaderSelection[k]);
  if (selected.length === 0) return alert('Keine Spieler ausgewählt');
  nextMatch.kader = selected.map(Number);
  saveState();
  startPoll(nextMatch.id, 'spieler');
}

// ─── Telegram Poll Integration ─────────────────────────────
async function apiFetch(url, opts) {
  try {
    const r = await fetch('http://localhost:3000' + url, opts);
    return await r.json();
  } catch (e) {
    console.error('API Error:', e);
    return { error: e.message };
  }
}

async function startPoll(matchId, type) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;

  const mDate = formatDateLong(m.date) || m.date;
  let options = [];
  if (type === 'spieler') {
    const kaderPlayers = m.kader && m.kader.length > 0
      ? state.players.filter(p => m.kader.includes(p.id))
      : state.players;
    options = kaderPlayers.map(p => p.name);
  } else if (type === 'kuchen') {
    options = ['Ja, bringe Kuchen mit', 'Ja, bringe etwas Herzhaftes mit', 'Nein, kann nicht'];
  } else if (type === 'helfer') {
    const taskMap = { booth: 'Budenbetreuung', setup: 'Aufbau', teardown: 'Abbau', laundry: 'Tasche waschen' };
    options = Object.values(taskMap).map(t => '🔧 ' + t);
  }

  if (options.length === 0) return alert('Keine Optionen verfügbar');
  const result = await apiFetch('/api/poll/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, opponent: m.opponent, date: mDate, time: m.time, options, type })
  });
  if (result.error) {
    if (result.error === 'Keine Telegram-Gruppe konfiguriert. Nachricht mit /start an Bot senden.') {
      alert('📱 Bitte sende /start an den Telegram-Bot in der Gruppe, dann klicke erneut.');
    } else {
      alert('❌ Fehler: ' + result.error);
    }
  } else {
    alert('✅ Umfrage gesendet!');
    if (!m.poll) m.poll = {};
    render();
  }
}

async function fetchPollResults(matchId) {
  const results = await apiFetch('/api/poll/results/' + matchId);
  return results;
}

function setMatchFormation(matchId, formationName) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  if (formationName) {
    m.formation = formationName;
    m.lineup = {};
    FORMATIONS[formationName].positions.forEach(p => { m.lineup[p.id] = null; });
  } else {
    m.formation = null;
    m.lineup = {};
  }
  saveState();
  render();
}

function setMatchLineupPlayer(matchId, posId, playerId) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  if (m.lineup[posId] === playerId) m.lineup[posId] = null;
  else m.lineup[posId] = playerId;
  saveState();
  render();
}

function renderFormationField(m) {
  if (!m.formation || !FORMATIONS[m.formation]) {
    let html = '<div style="margin-bottom:8px;display:flex;gap:4px;flex-wrap:wrap;">';
    Object.keys(FORMATIONS).forEach(key => {
      html += `<button class="btn btn-small" style="width:auto;padding:4px 10px;font-size:12px;" onclick="setMatchFormation(${m.id},'${key}')">${key}</button>`;
    });
    html += '</div><div style="text-align:center;padding:12px;color:var(--text-secondary);font-size:14px;">Wähle eine Formation</div>';
    return html;
  }

  const f = FORMATIONS[m.formation];
  const positions = f.positions;

  let html = '<div style="margin-bottom:8px;display:flex;gap:4px;flex-wrap:wrap;">';
  Object.keys(FORMATIONS).forEach(key => {
    const active = m.formation === key ? 'btn-primary' : '';
    html += `<button class="btn btn-small ${active}" style="width:auto;padding:4px 10px;font-size:12px;" onclick="setMatchFormation(${m.id},'${key}')">${key}</button>`;
  });
  html += '</div>';

  html += '<div style="display:flex;gap:12px;">';

  // Linke Spalte: Spielfeld
  html += '<div style="flex:1;min-width:0;">';
  html += '<div style="position:relative;width:100%;aspect-ratio:0.7;background:linear-gradient(180deg,#4CAF50,#388E3C);border:2px solid #fff;border-radius:8px;overflow:hidden;">';
  html += '<div style="position:absolute;top:50%;left:0;right:0;height:2px;background:rgba(255,255,255,0.4);"></div>';
  html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;border:2px solid rgba(255,255,255,0.4);border-radius:50%;"></div>';
  html += '<div style="position:absolute;bottom:0;left:15%;right:15%;height:40px;border:2px solid rgba(255,255,255,0.4);border-bottom:none;border-radius:4px 4px 0 0;"></div>';

  positions.forEach(p => {
    const playerId = m.lineup && m.lineup[p.id];
    const player = playerId ? state.players.find(pl => pl.id === playerId) : null;
    const name = player ? escHtml(player.name) : '';
    const isSelected = selectedFormationPos === p.id;
    const color = player ? '#FFD600' : 'rgba(255,255,255,0.25)';
    const border = isSelected ? '3px solid #2196F3' : (player ? '2px solid #212121' : '2px solid rgba(255,255,255,0.4)');
    html += `<div onclick="selectFormationPos('${p.id}')" style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;z-index:2;">`;
    html += `<div style="width:36px;height:36px;border-radius:50%;background:${color};border:${border};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:${player ? '#212121' : 'rgba(255,255,255,0.8)'};box-shadow:${isSelected ? '0 0 0 4px rgba(33,150,243,0.3)' : (player ? '0 2px 6px rgba(0,0,0,0.3)' : 'none')};">${p.label}</div>`;
    if (player) html += `<div style="font-size:10px;font-weight:600;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.5);white-space:nowrap;background:rgba(0,0,0,0.4);padding:1px 6px;border-radius:8px;">${name}</div>`;
    html += '</div>';
  });

  html += '</div>';
  html += `<div style="font-size:11px;color:var(--text-secondary);margin-top:4px;text-align:center;">Klick Position → dann Spieler rechts</div>`;
  html += '</div>';

  // Rechte Spalte: Spieler-Liste (nur zugesagte)
  const confirmedPlayers = state.players.filter(p => (m.poll && m.poll[p.id]) === 'yes');
  html += '<div style="flex:0 0 140px;max-height:300px;overflow-y:auto;">';
  html += '<div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:4px;">Startelf</div>';
  confirmedPlayers.forEach(p => {
    const assigned = Object.values(m.lineup || {}).includes(p.id);
    const playerPos = assigned ? Object.keys(m.lineup).find(k => m.lineup[k] === p.id) : null;
    const isActive = selectedFormationPos && !assigned;
    html += `<div onclick="${isActive ? "setMatchLineupPlayer(" + m.id + ",'" + selectedFormationPos + "'," + p.id + ")" : ''}" style="padding:4px 6px;font-size:12px;border-radius:6px;cursor:${isActive ? 'pointer' : 'default'};${assigned ? 'opacity:0.5;' : ''}${isActive ? 'background:var(--bg);' : ''}display:flex;align-items:center;gap:4px;">`;
    html += `<span>✅</span>`;
    html += `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(p.name)}</span>`;
    if (assigned) html += `<span style="font-size:10px;color:var(--primary);">${playerPos}</span>`;
    html += '</div>';
  });

  // Bank (nicht gesetzte zugesagte Spieler)
  const benchPlayers = confirmedPlayers.filter(p => !Object.values(m.lineup || {}).includes(p.id));
  if (benchPlayers.length > 0) {
    html += `<div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin:8px 0 4px 0;padding-top:6px;border-top:1px solid var(--border);">Bank</div>`;
    benchPlayers.forEach(p => {
      const isActive = selectedFormationPos && !Object.values(m.lineup || {}).includes(p.id);
      html += `<div onclick="${isActive ? "setMatchLineupPlayer(" + m.id + ",'" + selectedFormationPos + "'," + p.id + ")" : ''}" style="padding:4px 6px;font-size:12px;border-radius:6px;cursor:${isActive ? 'pointer' : 'default'};${isActive ? 'background:var(--bg);' : ''}display:flex;align-items:center;gap:4px;">`;
      html += `<span>✅</span>`;
      html += `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(p.name)}</span>`;
      html += '</div>';
    });
  }

  html += '</div>';

  html += '</div>';

  const setCount = positions.filter(p => m.lineup && m.lineup[p.id]).length;
  html += `<div style="margin-top:6px;font-size:12px;color:var(--text-secondary);text-align:center;">${setCount}/${positions.length} besetzt${selectedFormationPos ? ' · Position markiert, wähle Spieler rechts' : ''}</div>`;

  return html;
}

function selectFormationPos(posId) {
  selectedFormationPos = selectedFormationPos === posId ? null : posId;
  render();
}

function openLineupPicker(matchId, posId) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;

  const allPlayers = state.players;
  const currentPlayer = m.lineup && m.lineup[posId];
  const currentName = currentPlayer ? state.players.find(p => p.id === currentPlayer)?.name : '';

  let html = `<h2>Position besetzen</h2><p style="font-size:14px;color:var(--text-secondary);margin-bottom:8px;">Position: ${posId}</p>`;
  if (currentPlayer) {
    html += `<p style="font-size:14px;margin-bottom:8px;">Aktuell: <strong>${escHtml(currentName)}</strong></p>`;
  }
  html += '<div style="max-height:300px;overflow-y:auto;">';
  allPlayers.forEach(p => {
    const isCurrent = p.id === currentPlayer;
    const pollStatus = (m.poll && m.poll[p.id]) || '';
    const pollEmoji = pollStatus === 'yes' ? '✅' : pollStatus === 'no' ? '❌' : pollStatus === 'maybe' ? '❓' : '❔';
    const alreadySet = Object.entries(m.lineup || {}).some(([key, val]) => val === p.id && key !== posId);
    const disabled = alreadySet && !isCurrent;
    html += `<div class="settings-row" style="cursor:pointer;${isCurrent ? 'background:var(--primary);color:#fff;border-radius:8px;' : ''}${disabled ? 'opacity:0.4;' : ''}" onclick="${disabled ? '' : "setMatchLineupPlayer(" + matchId + ",'" + posId + "'," + p.id + ");document.querySelector('.modal-overlay')?.remove();"}">`;
    html += `<span style="display:flex;align-items:center;gap:6px;"><span>${pollEmoji}</span> ${escHtml(p.name)}</span>`;
    if (isCurrent) html += '<span>✔️</span>';
    else if (alreadySet) html += '<span style="font-size:12px;color:var(--text-secondary);">bereits gesetzt</span>';
    html += '</div>';
  });
  if (currentPlayer) {
    html += `<div class="settings-row" style="cursor:pointer;color:var(--danger);" onclick="setMatchLineupPlayer(${matchId},'${posId}',null);document.querySelector('.modal-overlay')?.remove();"> — Entfernen</div>`;
  }
  html += '</div><button class="btn btn-secondary" onclick="this.closest(\'.modal-overlay\').remove()">Abbrechen</button>';

  const modal = showModal(html);
}

function openTrainingDetail(id) {
  selectedTrainingId = id;
  render();
}

function closeTrainingDetail() {
  selectedTrainingId = null;
  currentTrainingDate = null;
  currentTrainingAttendance = {};
  render();
}

function renderTrainingDetail() {
  const t = state.trainings.find(x => x.id === selectedTrainingId);
  if (!t) { selectedTrainingId = null; renderTraining(); return; }

  currentTrainingDate = t.date;
  currentTrainingAttendance = JSON.parse(JSON.stringify(t.attendance || {}));

  let totalPresent = 0, totalLate = 0, totalAbsent = 0, goods = 0, oks = 0, bads = 0;
  const rows = state.players.map(p => {
    const status = getAttStatus(p.id);
    const behavior = getAttBehavior(p.id);
    const isPresent = status === 'yes';
    if (status === 'yes') totalPresent++;
    else if (status === 'late') totalLate++;
    else if (status === 'no') totalAbsent++;
    if (behavior === 'good') goods++;
    else if (behavior === 'ok') oks++;
    else if (behavior === 'bad') bads++;

    return `
      <div class="attendance-row" style="flex-direction:column;align-items:stretch;gap:6px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="attendance-name">${escHtml(p.name)}</div>
          <div class="attendance-btns">
            <button class="att-btn ${status === 'yes' ? 'selected-yes' : ''}" onclick="setAttendance(${p.id},'${status === 'yes' ? '' : 'yes'}')" title="Da">✔️</button>
            <button class="att-btn ${status === 'late' ? 'selected-late' : ''}" onclick="setAttendance(${p.id},'${status === 'late' ? '' : 'late'}')" title="Später">⏰</button>
            <button class="att-btn ${status === 'no' ? 'selected-no' : ''}" onclick="setAttendance(${p.id},'${status === 'no' ? '' : 'no'}')" title="Nicht da">❌</button>
          </div>
        </div>
        ${isPresent ? `
          <div class="behavior-row">
            <span class="behavior-label">Verhalten:</span>
            <button class="att-btn ${behavior === 'good' ? 'selected-yes' : ''}" onclick="setBehavior(${p.id},'${behavior === 'good' ? '' : 'good'}')" title="Super">😊</button>
            <button class="att-btn ${behavior === 'ok' ? 'selected-late' : ''}" onclick="setBehavior(${p.id},'${behavior === 'ok' ? '' : 'ok'}')" title="OK">🙂</button>
            <button class="att-btn ${behavior === 'bad' ? 'selected-no' : ''}" onclick="setBehavior(${p.id},'${behavior === 'bad' ? '' : 'bad'}')" title="Schlecht">☹️</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const overallMap = { good: '😊', ok: '🙂', bad: '☹️' };
  const overall = t.overall && overallMap[t.overall] ? overallMap[t.overall] : '';
  const unknown = state.players.length - totalPresent - totalLate - totalAbsent;

  const content = $('#app-content');
  content.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div class="card-title" style="margin-bottom:0;">⚽ ${formatDateLong(t.date)}</div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-small btn-danger" style="width:auto;padding:4px 12px;" onclick="deleteTraining(${t.id})">🗑️</button>
          <button class="btn btn-small" style="width:auto;padding:4px 12px;background:var(--bg);" onclick="closeTrainingDetail()">✕ Zurück</button>
        </div>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;font-size:14px;flex-wrap:wrap;margin-top:12px;">
        <span>✅ ${totalPresent}</span>
        <span>⏰ ${totalLate}</span>
        <span>❌ ${totalAbsent}</span>
        <span>❓ ${unknown}</span>
        ${goods > 0 ? `<span>😊 ${goods}</span>` : ''}
        ${oks > 0 ? `<span>🙂 ${oks}</span>` : ''}
        ${bads > 0 ? `<span>☹️ ${bads}</span>` : ''}
        ${overall ? `<span>· Gesamt: ${overall}</span>` : ''}
      </div>
    </div>
    <div class="card">
      <div class="card-title">📋 Spieler</div>
      ${state.players.length === 0 ? '<div class="empty-state" style="padding:16px;">Keine Spieler vorhanden</div>' : rows}
    </div>
  `;
}

// ============== PAGES ==============

function renderDashboard() {
  var content = $('#app-content');
  var today = todayStr();
  var totalPlayers = state.players.length;
  var seasonTrainings = getSeasonTrainings();
  var seasonMatches = getSeasonMatches();
  var totalTrainings = seasonTrainings.length;
  var totalMatches = seasonMatches.length;
  var homeMatches = seasonMatches.filter(function(m){return m.isHome}).length;
  var awayMatches = totalMatches - homeMatches;
  var upcomingMatches = seasonMatches.filter(function(m){return m.date >= today}).sort(function(a,b){return a.date.localeCompare(b.date)});
  var nextMatch = upcomingMatches[0];

  var recentEvents = [];
  seasonTrainings.forEach(function(t){if(t.date < today)recentEvents.push({date:t.date,type:'training',data:t});});
  seasonMatches.forEach(function(m){if(m.date < today)recentEvents.push({date:m.date,type:'match',data:m});});
  recentEvents.sort(function(a,b){return b.date.localeCompare(a.date)});
  recentEvents = recentEvents.slice(0, 8);

  var perPlayerStats = state.players.map(function(p) {
    var yesCount = 0, totalCount = 0, goodCount = 0, behavCount = 0;
    seasonTrainings.forEach(function(t) {
      var a = t.attendance && t.attendance[p.id];
      if (!a) return;
      var status = typeof a === 'string' ? a : (a.status || '');
      var behav = typeof a === 'object' && a ? (a.behavior || '') : '';
      if (status === 'yes' || status === 'late') { totalCount++; yesCount++; }
      if (status === 'yes' && behav) { behavCount++; if (behav === 'good') goodCount++; }
    });
    var pct = totalTrainings > 0 ? Math.round(yesCount / totalTrainings * 100) : 0;
    var behavPct = behavCount > 0 ? Math.round(goodCount / behavCount * 100) : 0;
    return { id: p.id, name: p.name, yesCount: yesCount, totalCount: totalCount, pct: pct, goodCount: goodCount, behavPct: behavPct, trainings: totalCount };
  });
  perPlayerStats.sort(function(a,b){return b.pct - a.pct});

  var avgAttendance = totalPlayers > 0 && totalTrainings > 0
    ? Math.round(perPlayerStats.reduce(function(s,p){return s + p.yesCount}, 0) / (totalPlayers * totalTrainings) * 100)
    : 0;

  var totalGood = 0, totalBehav = 0;
  seasonTrainings.forEach(function(t) {
    for (var pid in t.attendance || {}) {
      var a = t.attendance[pid];
      var behav = typeof a === 'object' && a ? (a.behavior || '') : '';
      if (behav) { totalBehav++; if (behav === 'good') totalGood++; }
    }
  });
  var overallBehav = totalBehav > 0 ? Math.round(totalGood / totalBehav * 100) : 0;

  var behavPlayers = perPlayerStats.filter(function(p){return p.behavPct > 0}).sort(function(a,b){return b.behavPct - a.behavPct});

  var lastTraining = seasonTrainings.filter(function(t){return t.date < today || t.date === today}).sort(function(a,b){return b.date.localeCompare(a.date)})[0];
  var lastAttended = 0, lastTotal = 0;
  if (lastTraining) {
    for (var pid in lastTraining.attendance || {}) {
      var a = lastTraining.attendance[pid];
      var status = typeof a === 'string' ? a : (a ? a.status : '');
      if (status === 'yes' || status === 'late') lastAttended++;
      lastTotal++;
    }
  }

  var html = [];

  if (totalPlayers === 0) {
    html.push('<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-text">Noch keine Daten<br>Füge zuerst Spieler hinzu und starte ein Training</div><button class="btn btn-primary" onclick="navigate(\'players\')">➕ Spieler hinzufügen</button></div>');
    content.innerHTML = html.join('');
    getWeather();
    return;
  }

  // Aktuelle Woche (Mo–So)
  var weekStart = getMonday(new Date());
  var weekEnd = addDays(weekStart, 6);
  var weekStartStr = weekStart.getFullYear() + '-' + String(weekStart.getMonth()+1).padStart(2,'0') + '-' + String(weekStart.getDate()).padStart(2,'0');
  var weekEndStr = weekEnd.getFullYear() + '-' + String(weekEnd.getMonth()+1).padStart(2,'0') + '-' + String(weekEnd.getDate()).padStart(2,'0');

  var weekEvents = [];

  // Trainings der Woche (nur heute & Zukunft)
  for (var d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    var dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    if (dateStr >= today && isTrainingScheduled(dateStr)) {
      weekEvents.push({ date: dateStr, type: 'training', time: state.settings.trainingTime || '17:00', timeEnd: state.settings.trainingTimeEnd || '18:30' });
    }
  }

  // Spiele der Woche (nur heute & Zukunft)
  seasonMatches.forEach(function(m) {
    if (m.date >= today && m.date >= weekStartStr && m.date <= weekEndStr) {
      weekEvents.push({ date: m.date, type: 'match', data: m });
    }
  });

  weekEvents.sort(function(a,b) { return a.date.localeCompare(b.date); });

  // Saison-Vergleich
  var prevSeason = state.settings.seasons.filter(function(s) { return s !== state.settings.season; }).sort().pop();
  var prevAtt = 0, prevBehav = 0;
  if (prevSeason && state.players.length > 0) {
    var prevP1 = getPlayerAttendancePct(state.players[0].id, prevSeason);
    if (prevP1 > 0) { // es gibt Daten für letzte Saison
      var prevAttSum = 0, prevAttCount = 0, prevBehavSum = 0, prevBehavCount = 0;
      state.players.forEach(function(pl) {
        var pa = getPlayerAttendancePct(pl.id, prevSeason);
        if (pa > 0) { prevAttSum += pa; prevAttCount++; }
        var pb = getPlayerBehaviorPct(pl.id, prevSeason);
        if (pb > 0) { prevBehavSum += pb; prevBehavCount++; }
      });
      prevAtt = prevAttCount > 0 ? Math.round(prevAttSum / prevAttCount) : 0;
      prevBehav = prevBehavCount > 0 ? Math.round(prevBehavSum / prevBehavCount) : 0;
    }
  }

  html.push('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">');
  html.push('<span style="font-size:14px;font-weight:600;color:var(--primary);">📅 Saison ' + state.settings.season + '</span>');
  if (prevAtt > 0) html.push('<span style="font-size:12px;color:var(--text-secondary);">Vorherige: ' + prevAtt + '% / 😊 ' + prevBehav + '%</span>');
  html.push('</div>');

  html.push('<div class="card"><div class="card-title">📅 Diese Woche</div>');
  if (weekEvents.length === 0) {
    html.push('<div style="text-align:center;padding:12px 0;color:var(--text-secondary);font-size:14px;">Keine Termine diese Woche</div>');
  } else {
    weekEvents.forEach(function(e) {
      if (e.type === 'training') {
        html.push('<div class="match-card" style="border-left-color:var(--success);margin-bottom:4px;">');
        html.push('<div class="match-date">' + formatDateLong(e.date) + '</div>');
        html.push('<div>⚽ Training ' + e.time + ' – ' + e.timeEnd + ' Uhr · 📍 ' + escHtml(state.settings.trainingLocation || 'Sportplatz FVH') + '</div>');
        html.push('</div>');
      } else {
        var m = e.data;
        html.push('<div class="match-card" style="border-left-color:var(--warning);margin-bottom:4px;cursor:pointer;" onclick="openMatchDetail(' + m.id + ')">');
        html.push('<div class="match-date">' + formatDateLong(m.date) + (m.time ? ' um ' + m.time : '') + '</div>');
        html.push('<div>⚽ vs ' + escHtml(m.opponent) + ' ' + (m.isHome ? '🏠' : '✈️') + '</div>');
        html.push('</div>');
      }
    });
  }
  html.push('</div>');

  // ─── Saison-Bilanz ───────────────────────────────────────
  var played = seasonMatches.filter(function(m){ return m.homeGoals !== null && m.awayGoals !== null; });
  var wins = played.filter(function(m){ return (m.isHome && m.homeGoals > m.awayGoals) || (!m.isHome && m.awayGoals > m.homeGoals); });
  var losses = played.filter(function(m){ return (m.isHome && m.homeGoals < m.awayGoals) || (!m.isHome && m.awayGoals < m.homeGoals); });
  var draws = played.filter(function(m){ return m.homeGoals === m.awayGoals; });
  if (played.length > 0) {
    html.push('<div class="card"><div class="card-title">📅 Saison ' + state.settings.season + '</div>');
    html.push('<div style="display:flex;justify-content:space-around;text-align:center;padding:8px 0;">');
    html.push('<div><div style="font-size:28px;font-weight:800;color:var(--primary);">' + played.length + '</div><div style="font-size:12px;color:var(--text-secondary);">Spiele</div></div>');
    html.push('<div><div style="font-size:28px;font-weight:800;color:#4CAF50;">' + wins.length + '</div><div style="font-size:12px;color:var(--text-secondary);">S</div></div>');
    html.push('<div><div style="font-size:28px;font-weight:800;color:#FF9800;">' + draws.length + '</div><div style="font-size:12px;color:var(--text-secondary);">U</div></div>');
    html.push('<div><div style="font-size:28px;font-weight:800;color:#F44336;">' + losses.length + '</div><div style="font-size:12px;color:var(--text-secondary);">N</div></div>');
    html.push('</div></div>');
  }

  html.push('<div class="card"><div class="card-title">📊 Übersicht</div>');
  html.push('<div style="display:flex;gap:12px;">');

  // Linke Spalte: Anwesenheit
  html.push('<div style="flex:1;min-width:0;">');
  html.push('<div style="font-size:15px;font-weight:700;color:var(--primary);text-align:center;margin-bottom:6px;">Anwesenheit</div>');
  html.push('<div style="font-size:32px;font-weight:800;color:var(--text);text-align:center;line-height:1;margin-bottom:8px;">' + avgAttendance + '%</div>');
  html.push('<div style="display:flex;flex-direction:column;gap:1px;">');
  perPlayerStats.forEach(function(p, i) {
    var medal = i < 3 ? ['🥇','🥈','🥉'][i] : '';
    var ampColor = p.pct >= 75 ? '🟢' : p.pct >= 55 ? '🟡' : '🔴';
    var nameColor = i === 0 ? '#D4A017' : i === 1 ? '#8C8C8C' : i === 2 ? '#CD7F32' : '';
    var num = (i+1) + '.';
    html.push('<div style="font-size:12px;' + (nameColor ? 'color:' + nameColor + ';' : '') + 'display:flex;align-items:center;gap:2px;">');
    html.push('<span style="width:22px;text-align:right;flex-shrink:0;">' + medal + '</span>');
    html.push('<span style="width:24px;text-align:right;flex-shrink:0;font-variant-numeric:tabular-nums;">' + num + '</span>');
    html.push('<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(p.name) + '</span>');
    html.push('<span style="font-weight:600;flex-shrink:0;font-variant-numeric:tabular-nums;">' + p.pct + '%</span>');
    html.push('<span style="flex-shrink:0;">' + ampColor + '</span>');
    html.push('</div>');
  });
  html.push('</div></div>');

  // Rechte Spalte: Verhalten
  html.push('<div style="flex:1;min-width:0;">');
  html.push('<div style="font-size:15px;font-weight:700;color:var(--primary);text-align:center;margin-bottom:6px;">Verhalten</div>');
  html.push('<div style="font-size:32px;font-weight:800;color:var(--text);text-align:center;line-height:1;margin-bottom:8px;">' + overallBehav + '%</div>');
  html.push('<div style="display:flex;flex-direction:column;gap:1px;">');
  behavPlayers.forEach(function(p, i) {
    var medal = i < 3 ? ['🥇','🥈','🥉'][i] : '';
    var ampColor = p.behavPct >= 75 ? '🟢' : p.behavPct >= 55 ? '🟡' : '🔴';
    var nameColor = i === 0 ? '#D4A017' : i === 1 ? '#8C8C8C' : i === 2 ? '#CD7F32' : '';
    var num = (i+1) + '.';
    html.push('<div style="font-size:12px;' + (nameColor ? 'color:' + nameColor + ';' : '') + 'display:flex;align-items:center;gap:2px;">');
    html.push('<span style="width:22px;text-align:right;flex-shrink:0;">' + medal + '</span>');
    html.push('<span style="width:24px;text-align:right;flex-shrink:0;font-variant-numeric:tabular-nums;">' + num + '</span>');
    html.push('<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(p.name) + '</span>');
    html.push('<span style="font-weight:600;flex-shrink:0;font-variant-numeric:tabular-nums;">' + p.behavPct + '%</span>');
    html.push('<span style="flex-shrink:0;">' + ampColor + '</span>');
    html.push('</div>');
  });
  html.push('</div></div>');

  html.push('</div></div>');

  if (recentEvents.length > 0) {
    html.push('<div class="card"><div class="card-title" onclick="toggleCollapse(\'activities\')" style="cursor:pointer;">📋 Letzte Aktivitäten <span style="margin-left:auto;font-size:12px;color:var(--text-secondary);">' + (uiCollapsed.activities ? '▸' : '▾') + '</span></div>');
    html.push('<div style="display:' + (uiCollapsed.activities ? 'none' : 'block') + '">');
    recentEvents.forEach(function(e) {
      if (e.type === 'training') {
        var cnt = 0;
        for (var pid in e.data.attendance || {}) {
          var a = e.data.attendance[pid];
          var status = typeof a === 'string' ? a : (a ? a.status : '');
          if (status === 'yes' || status === 'late') cnt++;
        }
        var overallEmoji = '';
        if (e.data.overall) overallEmoji = { good: '😊', ok: '🙂', bad: '☹️' }[e.data.overall] || '';
        html.push('<div class="match-card" style="border-left-color:var(--success);margin-bottom:4px;">');
        html.push('<div class="match-date">' + formatDateLong(e.date) + '</div>');
        html.push('<div>⚽ Training · ' + cnt + ' Spieler ' + (overallEmoji ? '· ' + overallEmoji : '') + '</div>');
        html.push('</div>');
      } else {
        html.push('<div class="match-card" style="border-left-color:var(--secondary);margin-bottom:4px;">');
        html.push('<div class="match-date">' + formatDateLong(e.date) + (e.data.time ? ' um ' + e.data.time : '') + '</div>');
        html.push('<div>⚽ Spiel vs ' + escHtml(e.data.opponent) + ' ' + (e.data.isHome ? '🏠' : '✈️') + '</div>');
        html.push('</div>');
      }
    });
    html.push('</div></div>');
  }

  html.push('<div class="card"><div class="card-title">🌤️ Wetter am Platz</div><div id="weather-content" class="weather-card"><div class="loading">Wetter wird geladen...</div></div></div>');

  content.innerHTML = html.join('');
  getWeather();
}

function renderPlayers() {
  const content = $('#app-content');
  if (state.players.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-text">Noch keine Spieler vorhanden</div>
        <button class="btn btn-primary" onclick="addPlayer()">Ersten Spieler hinzufügen</button>
      </div>
    `;
    return;
  }

  const seasonTrainings = getSeasonTrainings();
  const seasonMatches = getSeasonMatches();

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:16px;font-weight:700;color:var(--primary);">${state.players.length} Spieler</span>
      <button class="btn btn-small btn-primary" onclick="addPlayer()">+ Hinzufügen</button>
    </div>
    <div id="player-list">
      ${state.players.map(p => {
        const ampel = getPlayerAmpel(p.id);
        const attPct = getPlayerAttendancePct(p.id);
        const behavPct = getPlayerBehaviorPct(p.id);
        const r = p.rating || { fitness: 3, technique: 3, matchPerf: 3 };
        const matchSpiel = getPlayerMatchAvg(p.id, 'spiel');
        const matchZk = getPlayerMatchAvg(p.id, 'zweikampf');
        const matchSv = getPlayerMatchAvg(p.id, 'verstaendnis');
        const ampelLabel = ampel.label;
        const isExpanded = playerExpanded[p.id];
        const matchCount = seasonMatches.filter(m => m.playerRatings && m.playerRatings[p.id] && m.playerRatings[p.id].spiel > 0).length;
        const playerMatches = seasonMatches.filter(m => m.poll && m.poll[p.id] === 'yes').sort((a,b) => b.date.localeCompare(a.date));
        const playerTrainings = seasonTrainings.filter(t => t.attendance && t.attendance[p.id]).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 15);
        return `
          <div style="margin-bottom:8px;">
            <div class="player-card" style="cursor:pointer;position:relative;" onclick="togglePlayerStats(${p.id})">
              <div class="player-avatar">${p.name.charAt(0)}</div>
              <div class="player-info">
                <div class="player-name">${escHtml(p.name)}</div>
                <div class="player-number">${p.number ? '#' + p.number : ''} · ${attPct}% · 😊 ${behavPct}% · 🏃${r.fitness}⚽${r.technique}</div>
                <div style="font-size:12px;margin-top:2px;"><span class="ampel-dot ${ampel.level}" style="display:inline-block;width:10px;height:10px;vertical-align:middle;"></span> ${ampelLabel}</div>
              </div>
              <div style="position:absolute;top:12px;right:12px;font-size:12px;color:var(--text-secondary);">${isExpanded ? '▲' : '▼'}</div>
            </div>
            ${isExpanded ? `
              <div style="background:var(--bg);border:1px solid var(--border);border-top:none;border-radius:0 0 12px 12px;padding:12px;font-size:13px;">
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                  <span style="background:var(--card-bg);padding:4px 10px;border-radius:8px;">⚽ Spiel ⌀ ${matchSpiel > 0 ? matchSpiel : '-'}</span>
                  <span style="background:var(--card-bg);padding:4px 10px;border-radius:8px;">💪 Zweikampf ⌀ ${matchZk > 0 ? matchZk : '-'}</span>
                  <span style="background:var(--card-bg);padding:4px 10px;border-radius:8px;">🧠 Verständnis ⌀ ${matchSv > 0 ? matchSv : '-'}</span>
                  <span style="background:var(--card-bg);padding:4px 10px;border-radius:8px;">🏃 Fitness ${r.fitness}</span>
                  <span style="background:var(--card-bg);padding:4px 10px;border-radius:8px;">⚽ Technik ${r.technique}</span>
                </div>
                ${playerTrainings.length > 0 ? `
                  <div style="font-weight:600;margin-bottom:4px;">⚽ Training (${seasonTrainings.length} gesamt)</div>
                  ${playerTrainings.map(t => {
                    const a = t.attendance[p.id];
                    const status = a ? (a.status || '') : '';
                    const behav = a && a.behavior ? a.behavior : '';
                    const statusEmoji = status === 'yes' ? '✅' : status === 'late' ? '⏰' : '❌';
                    const behavEmoji = behav === 'good' ? '😊' : behav === 'ok' ? '🙂' : behav === 'bad' ? '☹️' : '';
                    return '<div style="display:flex;gap:6px;padding:3px 0;font-size:12px;color:var(--text-secondary);"><span>' + formatDateLong(t.date).split(',')[0] + '</span><span>' + statusEmoji + '</span>' + (behavEmoji ? '<span>' + behavEmoji + '</span>' : '') + '</div>';
                  }).join('')}
                ` : '<div style="font-size:12px;color:var(--text-secondary);">Keine Trainings in dieser Saison</div>'}
                ${playerMatches.length > 0 ? `
                  <div style="font-weight:600;margin-top:10px;margin-bottom:4px;">📊 Spiele (${matchCount} bewertet)</div>
                  ${playerMatches.map(m => {
                    const r2 = m.playerRatings && m.playerRatings[p.id];
                    const ratingsStr = r2 ? '⚽' + (r2.spiel||'-') + ' 💪' + (r2.zweikampf||'-') + ' 🧠' + (r2.verstaendnis||'-') : 'keine Bewertung';
                    return '<div style="display:flex;gap:6px;padding:3px 0;font-size:12px;color:var(--text-secondary);"><span>' + formatDate(m.date) + '</span><span>vs ' + escHtml(m.opponent) + '</span><span>' + ratingsStr + '</span></div>';
                  }).join('')}
                ` : ''}
                <div style="display:flex;gap:8px;margin-top:10px;">
                  <button class="btn btn-small btn-primary" onclick="event.stopPropagation();editPlayer(${p.id})">✏️ Bearbeiten</button>
                  <button class="btn btn-small btn-danger" onclick="event.stopPropagation();deletePlayer(${p.id})">🗑️ Löschen</button>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function togglePlayerStats(id) {
  playerExpanded[id] = !playerExpanded[id];
  render();
}

function renderTraining() {
  const content = $('#app-content');
  const today = todayStr();

  if (selectedTrainingId) {
    renderTrainingDetail();
    return;
  }

  if (!state.trainingActive || state.trainingDate !== today) {
    const recentTrainings = getSeasonTrainings().filter(t => t.date < today).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10);

    // ─── Kader für nächstes Spiel ─────────────────────────
    const todayDate = todayStr();
    const upcomingMatches = getSeasonMatches().filter(m => m.date >= todayDate).sort((a,b) => a.date.localeCompare(b.date));
    const nextMatch = upcomingMatches[0];

    let kaderHtml = '';
    if (nextMatch && state.players.length > 0) {
      const weekTrainings = getCurrentWeekTrainings();
      const weekTrainingDates = weekTrainings.map(t => t.date);

      const playerStats = state.players.map(p => {
        const attPct = getPlayerAttendancePct(p.id);
        const behavPct = getPlayerBehaviorPct(p.id);
        const rating = p.rating || { fitness: 3, technique: 3, matchPerf: 3 };
        const matchSpiel = getPlayerMatchAvg(p.id, 'spiel');
        const matchZk = getPlayerMatchAvg(p.id, 'zweikampf');
        const matchSv = getPlayerMatchAvg(p.id, 'verstaendnis');
        const ratingSum = rating.fitness + rating.technique + matchSpiel + matchZk + matchSv;
        const weekAtt = weekTrainings.map(t => {
          const a = t.attendance && t.attendance[p.id];
          const status = a ? (typeof a === 'string' ? a : (a.status || '')) : '';
          return status === 'yes' || status === 'late' ? '✅' : '❌';
        });
        const weekText = weekTrainingDates.map((d, i) => formatDate(d).split(',')[0] + weekAtt[i]).join(' ');
        return { id: p.id, name: p.name, attPct, behavPct, rating, matchSpiel, matchZk, matchSv, weekText, sortKey: -(attPct * 10000 + behavPct * 100 + ratingSum) };
      });
      playerStats.sort((a, b) => a.sortKey - b.sortKey);

      if (!matchKaderSelection._matchId || matchKaderSelection._matchId !== nextMatch.id) {
        matchKaderSelection = { _matchId: nextMatch.id };
        const saved = nextMatch.kader || [];
        for (const p of state.players) {
          const stats = playerStats.find(s => s.id === p.id);
          matchKaderSelection[p.id] = saved.length > 0 ? saved.includes(p.id) : (stats && stats.attPct >= 50);
        }
      }

      const selectedCount = Object.keys(matchKaderSelection).filter(k => k !== '_matchId' && matchKaderSelection[k]).length;

      kaderHtml = `
        <div class="card">
          <div class="card-title">📅 Nächstes Spiel: vs ${escHtml(nextMatch.opponent)} (${formatDateLong(nextMatch.date)})</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">
            Kader-Eignung · Saison ${state.settings.season} · sortiert nach Beteiligung + Verhalten
          </div>
          ${playerStats.map(ps => {
            const checked = matchKaderSelection[ps.id] ? 'checked' : '';
            const ampLabel = ps.attPct >= 75 ? '🟢' : ps.attPct >= 55 ? '🟡' : '🔴';
            return `
              <div style="display:flex;align-items:center;gap:4px;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px;flex-wrap:wrap;">
                <input type="checkbox" id="kader-${ps.id}" ${checked} onchange="toggleKaderPlayer(${ps.id})" style="flex-shrink:0;margin:0;">
                <label for="kader-${ps.id}" style="flex:1;min-width:50px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(ps.name)}</label>
                <span style="font-weight:600;width:38px;text-align:right;flex-shrink:0;">${ps.attPct}%</span>
                <span style="width:16px;text-align:center;flex-shrink:0;">${ampLabel}</span>
                <span style="font-size:11px;color:var(--text-secondary);flex-shrink:0;white-space:nowrap;display:inline-flex;align-items:center;width:46px;">
                  <span style="width:14px;text-align:center;">😊</span>
                  <span style="width:30px;text-align:right;">${ps.behavPct}%</span>
                </span>
                <span style="font-size:10px;color:var(--text-secondary);flex-shrink:0;white-space:nowrap;letter-spacing:-0.5px;">
                  🏃${ps.rating.fitness}⚽${ps.rating.technique}
                  ${ps.matchSpiel > 0 ? `⚽${ps.matchSpiel}💪${ps.matchZk}🧠${ps.matchSv}` : '⚽-💪-🧠-'}
                </span>
                <span style="font-size:11px;color:var(--text-secondary);flex-shrink:0;white-space:nowrap;">· ${ps.weekText}</span>
              </div>
            `;
          }).join('')}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
            <span style="font-size:13px;color:var(--text-secondary);">${selectedCount}/${state.players.length} ausgewählt</span>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-small btn-secondary" style="width:auto;" onclick="selectAllKader()">Alle</button>
              <button class="btn btn-small btn-secondary" style="width:auto;" onclick="selectNoneKader()">Keine</button>
            </div>
          </div>
          <button class="btn btn-primary" style="margin-top:12px;width:100%;" onclick="sendKaderPoll()">
            📲 Telegram-Umfrage senden (${selectedCount} Spieler)
          </button>
        </div>
      `;
    } else if (!nextMatch && state.players.length > 0) {
      kaderHtml = `
        <div class="card">
          <div class="card-title">📅 Nächstes Spiel</div>
          <div class="empty-state-text" style="padding:8px 0;">Keine anstehenden Spiele · Erstelle ein Spiel im Spieltag-Tab</div>
          <button class="btn btn-small btn-primary" onclick="navigate('matchday')">➕ Zum Spieltag</button>
        </div>
      `;
    }

    content.innerHTML = `
      <div class="card">
        <div class="card-title">⚽ Heutiges Training</div>
        <button class="btn btn-primary" onclick="startTraining()" style="margin-bottom:8px;">Training starten</button>
        <button class="btn btn-secondary btn-small" onclick="startPastTraining()">Training für vergangenes Datum hinzufügen</button>
      </div>

      ${kaderHtml}

      ${recentTrainings.length > 0 ? `
        <div class="card">
          <div class="card-title">📋 Vergangene Trainingseinheiten</div>
          ${recentTrainings.map(t => {
            let total = 0, goods = 0, oks = 0, bads = 0;
            for (const pid in t.attendance || {}) {
              const a = t.attendance[pid];
              const status = typeof a === 'string' ? a : (a ? a.status : '');
              const behav = typeof a === 'object' && a ? a.behavior : '';
              if (status === 'yes' || status === 'late') { total++; if (behav === 'good') goods++; else if (behav === 'ok') oks++; else if (behav === 'bad') bads++; }
            }
            const overallMap = { good: '😊', ok: '🙂', bad: '☹️' };
            const overall = t.overall && overallMap[t.overall] ? overallMap[t.overall] : '';
            return `
              <div class="match-card" style="border-left-color:var(--success);cursor:pointer;" onclick="openTrainingDetail(${t.id})">
                <div class="match-date">${formatDateLong(t.date)}</div>
                <div style="margin-top:4px;font-size:14px;">
                  ✅ ${total} anwesend ${goods || oks || bads ? `· 😊${goods} 🙂${oks} ☹️${bads}` : ''}
                  ${overall ? `· Gesamt: ${overall}` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-text">Noch keine Trainingseinheiten erfasst</div>
          <button class="btn btn-secondary btn-small" onclick="navigate('settings')">Einstellungen → Trainingstage festlegen</button>
        </div>
      `}
    `;
    return;
  }

  const present = countAtt('yes');
  const late = countAtt('late');
  const absent = countAtt('no');
  const unknown = state.players.length - present - late - absent;
  const goodBehav = state.players.filter(p => getAttBehavior(p.id) === 'good').length;
  const okBehav = state.players.filter(p => getAttBehavior(p.id) === 'ok').length;
  const badBehav = state.players.filter(p => getAttBehavior(p.id) === 'bad').length;

  content.innerHTML = `
    <div class="card">
      <div class="card-title">⏱️ Timer</div>
      <div class="timer-display">
        <div class="timer-time" id="timer-display">00:00</div>
        <div class="timer-label">${timerRunning ? 'Läuft...' : 'Gestoppt'}</div>
      </div>
      <div class="timer-controls">
        <button class="btn btn-primary" onclick="toggleTimer()">${timerRunning ? '⏸️ Pause' : '▶️ Start'}</button>
        <button class="btn btn-secondary" onclick="resetTimer()">↺ Reset</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📋 Training (${present + late}/${state.players.length})</div>
      ${state.players.map(p => {
        const status = getAttStatus(p.id);
        const behavior = getAttBehavior(p.id);
        const isPresent = status === 'yes';
        return `
          <div class="attendance-row" style="flex-direction:column;align-items:stretch;gap:6px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div class="attendance-name">${escHtml(p.name)}</div>
              <div class="attendance-btns">
                <button class="att-btn ${status === 'yes' ? 'selected-yes' : ''}" onclick="setAttendance(${p.id},'${status === 'yes' ? '' : 'yes'}')" title="Da">✔️</button>
                <button class="att-btn ${status === 'late' ? 'selected-late' : ''}" onclick="setAttendance(${p.id},'${status === 'late' ? '' : 'late'}')" title="Später">⏰</button>
                <button class="att-btn ${status === 'no' ? 'selected-no' : ''}" onclick="setAttendance(${p.id},'${status === 'no' ? '' : 'no'}')" title="Nicht da">❌</button>
              </div>
            </div>
            ${isPresent ? `
              <div class="behavior-row">
                <span class="behavior-label">Verhalten:</span>
                <button class="att-btn ${behavior === 'good' ? 'selected-yes' : ''}" onclick="setBehavior(${p.id},'${behavior === 'good' ? '' : 'good'}')" title="Super">😊</button>
                <button class="att-btn ${behavior === 'ok' ? 'selected-late' : ''}" onclick="setBehavior(${p.id},'${behavior === 'ok' ? '' : 'ok'}')" title="OK">🙂</button>
                <button class="att-btn ${behavior === 'bad' ? 'selected-no' : ''}" onclick="setBehavior(${p.id},'${behavior === 'bad' ? '' : 'bad'}')" title="Schlecht">☹️</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>

    <div class="card">
      <div style="display:flex;gap:12px;justify-content:center;font-size:14px;flex-wrap:wrap;">
        <span>✅ ${present}</span>
        <span>⏰ ${late}</span>
        <span>❌ ${absent}</span>
        <span>❓ ${unknown}</span>
        ${goodBehav > 0 ? `<span>😊 ${goodBehav}</span>` : ''}
        ${okBehav > 0 ? `<span>🙂 ${okBehav}</span>` : ''}
        ${badBehav > 0 ? `<span>☹️ ${badBehav}</span>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-title">⭐ Gesamtbewertung Training</div>
      ${(() => {
        const today = todayStr();
        const training = state.trainings.find(t => t.date === today);
        const overall = training ? training.overall || '' : '';
        return `
          <div style="display:flex;gap:12px;justify-content:center;padding:8px 0;">
            <button class="att-btn ${overall === 'good' ? 'selected-yes' : ''}" style="width:60px;height:60px;border-radius:12px;font-size:28px;" onclick="setTrainingOverall('${overall === 'good' ? '' : 'good'}')" title="Super Training">😊</button>
            <button class="att-btn ${overall === 'ok' ? 'selected-late' : ''}" style="width:60px;height:60px;border-radius:12px;font-size:28px;" onclick="setTrainingOverall('${overall === 'ok' ? '' : 'ok'}')" title="OK Training">🙂</button>
            <button class="att-btn ${overall === 'bad' ? 'selected-no' : ''}" style="width:60px;height:60px;border-radius:12px;font-size:28px;" onclick="setTrainingOverall('${overall === 'bad' ? '' : 'bad'}')" title="Schlechtes Training">☹️</button>
          </div>
        `;
      })()}
    </div>

    <button class="btn btn-danger" onclick="if(confirm('Training beenden?'))stopTraining()">
      🏁 Training beenden
    </button>
  `;

  renderTimer();
}

function renderMatchday() {
  const content = $('#app-content');
  const today = todayStr();
  const playerStats = state.players.map(p => ({ ...p, ampel: getPlayerAmpel(p.id) }));
  const greenCount = playerStats.filter(p => p.ampel.level === 'green').length;
  const yellowCount = playerStats.filter(p => p.ampel.level === 'yellow').length;
  const redCount = playerStats.filter(p => p.ampel.level === 'red').length;
  const allMatches = [...getSeasonMatches()].sort((a,b) => a.date.localeCompare(b.date));

  if (selectedMatchId) {
    renderMatchDetail();
    return;
  }

  function buildMatchHtml(m) {
    const pollYes = m.poll ? Object.values(m.poll).filter(v => v === 'yes').length : 0;
    const pollNo = m.poll ? Object.values(m.poll).filter(v => v === 'no').length : 0;
    const pollMaybe = m.poll ? Object.values(m.poll).filter(v => v === 'maybe').length : 0;
    const isUpcoming = m.date >= today;
    var html = '<div class="card" style="cursor:pointer;" onclick="openMatchDetail(' + m.id + ')">';
    html += '<div class="match-card" style="border-left-color:' + (isUpcoming ? 'var(--primary)' : 'var(--text-secondary)') + ';margin-bottom:0;">';
    html += '<div class="match-date">' + formatDateLong(m.date) + (m.time ? ' um ' + m.time : '') + '</div>';
    html += '<div class="match-opponent">⚽ vs ' + escHtml(m.opponent) + '</div>';
    if (m.homeGoals !== null && m.awayGoals !== null) {
      var scoreColor = (m.isHome && m.homeGoals > m.awayGoals) || (!m.isHome && m.awayGoals > m.homeGoals) ? '#4CAF50' : (m.homeGoals === m.awayGoals ? '#FF9800' : '#F44336');
      html += '<div style="font-size:22px;font-weight:800;color:' + scoreColor + ';margin:2px 0;">' + m.homeGoals + ':' + m.awayGoals + '</div>';
    }
    html += '<div class="match-location">' + (m.isHome ? '🏠 Heimspiel' : '✈️ Auswärts') + ' · ' + escHtml(m.location || (m.isHome ? 'Eigener Platz' : 'N.N.')) + '</div>';
    if (m.isHome) html += '<div style="font-size:12px;margin-top:4px;color:var(--text-secondary);">🧁 Budenbetreuung · 🛠️ Auf/Abbau</div>';
    html += '<div style="font-size:12px;margin-top:4px;color:var(--text-secondary);">📋 ✅' + pollYes + ' ❓' + pollMaybe + ' ❌' + pollNo + ' · ' + state.players.length + ' Spieler</div>';
    html += '</div></div>';
    return html;
  }

  function buildAmpelHtml(p) {
    var dot = p.ampel.level === 'green' ? '🟢' : p.ampel.level === 'yellow' ? '🟡' : '🔴';
    return '<div class="ampel-row"><span>' + dot + '</span><div class="ampel-name">' + escHtml(p.name) + '</div><div class="ampel-count">' + p.ampel.count + ' Trainings</div></div>';
  }

  content.innerHTML = [
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">',
    '<span style="font-size:16px;font-weight:700;color:var(--primary);">' + allMatches.length + ' Spiele</span>',
    '<button class="btn btn-small btn-primary" onclick="addMatch()">+ Hinzufügen</button></div>',
    allMatches.length === 0
      ? '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">Noch keine Spiele eingetragen</div><button class="btn btn-primary" onclick="addMatch()">Erstes Spiel hinzufügen</button></div>'
      : allMatches.map(buildMatchHtml).join(''),
    '<div class="card"><div class="card-title">📊 Spielberechtigung</div>',
    '<div class="stats-row" style="margin-bottom:16px;">',
    '<div class="stat-card" style="background:#E8F5E9;border-radius:12px;"><div class="stat-value" style="color:var(--success);">' + greenCount + '</div><div class="stat-label">Spielberechtigt</div></div>',
    '<div class="stat-card" style="background:#FFF8E1;border-radius:12px;"><div class="stat-value" style="color:var(--warning);">' + yellowCount + '</div><div class="stat-label">Knapp</div></div>',
    '<div class="stat-card" style="background:#FFEBEE;border-radius:12px;"><div class="stat-value" style="color:var(--danger);">' + redCount + '</div><div class="stat-label">Nicht berechtigt</div></div>',
    '</div>',
    playerStats.map(buildAmpelHtml).join(''),
    '</div>'
  ].join('');
}

function renderMatchDetail() {
  const content = $('#app-content');
  const m = state.matches.find(x => x.id === selectedMatchId);
  if (!m) { selectedMatchId = null; renderMatchday(); return; }

  const totalPlayers = state.players.length;
  const pollYes = m.poll ? Object.values(m.poll).filter(v => v === 'yes').length : 0;
  const pollNo = m.poll ? Object.values(m.poll).filter(v => v === 'no').length : 0;
  const pollMaybe = m.poll ? Object.values(m.poll).filter(v => v === 'maybe').length : 0;
  const wts = '⚽ Spieltag: FVH vs ' + m.opponent + ' (' + formatDate(m.date) + (m.time ? ' um ' + m.time : '') + ') - ' + (m.isHome ? '🏠 Heimspiel' : '✈️ Auswärtsspiel');

  function buildPollHtml(p) {
    var val = (m.poll && m.poll[p.id]) || '';
    var yesCls = val === 'yes' ? 'selected-yes' : '';
    var maybeCls = val === 'maybe' ? 'selected-late' : '';
    var noCls = val === 'no' ? 'selected-no' : '';
    var yesOnclick = "setMatchPoll(" + m.id + "," + p.id + ",'" + (val === 'yes' ? '' : 'yes') + "')";
    var maybeOnclick = "setMatchPoll(" + m.id + "," + p.id + ",'" + (val === 'maybe' ? '' : 'maybe') + "')";
    var noOnclick = "setMatchPoll(" + m.id + "," + p.id + ",'" + (val === 'no' ? '' : 'no') + "')";
    return '<div class="attendance-row"><div class="attendance-name">' + escHtml(p.name) + '</div><div class="attendance-btns">'
      + '<button class="att-btn ' + yesCls + '" onclick="' + yesOnclick + '" title="Dabei">✅</button>'
      + '<button class="att-btn ' + maybeCls + '" onclick="' + maybeOnclick + '" title="Vielleicht">❓</button>'
      + '<button class="att-btn ' + noCls + '" onclick="' + noOnclick + '" title="Nicht dabei">❌</button>'
      + '</div></div>';
  }

  content.innerHTML = [
    '<div class="card">',
    '<div style="display:flex;align-items:center;justify-content:space-between;">',
    '<div class="card-title" style="margin-bottom:0;">⚽ vs ' + escHtml(m.opponent) + (m.homeGoals !== null && m.awayGoals !== null ? ' <span style="font-size:22px;">' + m.homeGoals + ':' + m.awayGoals + '</span>' : '') + '</div>',
    '<button class="btn btn-small" style="width:auto;padding:4px 12px;background:var(--bg);" onclick="closeMatchDetail()">✕ Zurück</button>',
    '</div>',
    '<div style="font-size:14px;color:var(--text-secondary);margin-top:8px;">' + formatDateLong(m.date) + (m.time ? ' um ' + m.time + ' Uhr' : '') + '</div>',
    '<div style="font-size:14px;color:var(--text-secondary);">' + (m.isHome ? '🏠 Heimspiel' : '✈️ Auswärtsspiel') + ' · ' + escHtml(m.location || (m.isHome ? 'Eigener Platz' : 'N.N.')) + '</div>',
    '<div style="margin-top:10px;display:flex;align-items:center;gap:8px;font-size:16px;">',
    '<span style="font-weight:600;">' + escHtml(m.opponent) + '</span>',
    '<input type="number" id="match-home-goals" value="' + (m.homeGoals !== null ? m.homeGoals : '') + '" min="0" max="20" placeholder="-" onchange="setMatchScore(' + m.id + ')" style="width:50px;text-align:center;font-size:18px;font-weight:700;padding:4px;border:2px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);">',
    '<span style="font-weight:700;">:</span>',
    '<input type="number" id="match-away-goals" value="' + (m.awayGoals !== null ? m.awayGoals : '') + '" min="0" max="20" placeholder="-" onchange="setMatchScore(' + m.id + ')" style="width:50px;text-align:center;font-size:18px;font-weight:700;padding:4px;border:2px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);">',
    '</div>',
    '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">',
    '<button class="btn btn-small btn-secondary" style="width:auto;" onclick="shareMatchPoll(' + m.id + ')">📋 Abstimmung kopieren</button>',
    '<button class="btn btn-small btn-secondary" style="width:auto;" data-mi="' + m.id + '" onclick="startPoll(this.dataset.mi,\'spieler\')">📲 Telegram-Umfrage</button>',
    '<button class="btn btn-small" style="width:auto;background:var(--bg);" onclick="shareWhatsApp(\'' + wts.replace(/'/g, "\\'") + '\')">📱 Info senden</button>',
    '<button class="btn btn-small btn-danger" style="width:auto;" onclick="if(confirm(\'Spiel löschen?\')){deleteMatch(' + m.id + ');closeMatchDetail();}">🗑️ Löschen</button>',
    '</div></div>',
    '<div class="card"><div class="card-title">📋 Aufstellung</div>',
    renderFormationField(m),
    '</div>',
    '<div class="card"><div class="card-title" onclick="toggleCollapse(\'poll\')" style="cursor:pointer;">📋 Wer ist dabei? (' + pollYes + '/' + totalPlayers + ') <span style="margin-left:auto;font-size:12px;color:var(--text-secondary);">' + (uiCollapsed.poll ? '▸' : '▾') + '</span></div>',
    '<div style="display:' + (uiCollapsed.poll ? 'none' : 'block') + '">',
    state.players.map(buildPollHtml).join(''),
    '<div style="display:flex;gap:12px;justify-content:center;font-size:14px;margin-top:12px;flex-wrap:wrap;">',
    '<span>✅ ' + pollYes + '</span><span>❓ ' + pollMaybe + '</span><span>❌ ' + pollNo + '</span>',
    '</div></div></div>',
    '<div class="card"><div class="card-title" onclick="toggleCollapse(\'ratings\')" style="cursor:pointer;">📊 Match-Bewertung <span style="margin-left:auto;font-size:12px;color:var(--text-secondary);">' + (uiCollapsed.ratings ? '▸' : '▾') + '</span></div>',
    '<div style="display:' + (uiCollapsed.ratings ? 'none' : 'block') + '">',
    state.players.filter(function(p) { return m.poll && m.poll[p.id] === 'yes'; }).map(function(p) {
      var r = m.playerRatings && m.playerRatings[p.id];
      var spiel = r ? r.spiel : 0;
      var zk = r ? r.zweikampf : 0;
      var sv = r ? r.verstaendnis : 0;
      function starHtml(cat, val) {
        var h = '';
        for (var si = 1; si <= 5; si++) {
          var isFull = val >= si;
          var isHalf = val >= si - 0.5 && val < si;
          h += '<span style="display:inline-block;width:1.3em;height:1.3em;position:relative;font-size:15px;vertical-align:middle;">';
          h += '<span style="position:absolute;inset:0;color:#ccc;font-size:15px;line-height:1.3;">★</span>';
          if (isFull) h += '<span style="position:absolute;inset:0;color:#FFD700;font-size:15px;line-height:1.3;">★</span>';
          else if (isHalf) h += '<span style="position:absolute;inset:0;color:#FFD700;font-size:15px;line-height:1.3;width:50%;overflow:hidden;">★</span>';
          h += '<span style="position:absolute;inset:0;width:50%;cursor:pointer;" onclick="setMatchRating(' + m.id + ',' + p.id + ",'" + cat + "'," + (si - 0.5) + ')"></span>';
          h += '<span style="position:absolute;inset:0;left:50%;width:50%;cursor:pointer;" onclick="setMatchRating(' + m.id + ',' + p.id + ",'" + cat + "'," + si + ')"></span>';
          h += '</span>';
        }
        return h;
      }
      return '<div style="padding:8px 0;border-bottom:1px solid var(--border);">'
        + '<div style="font-weight:600;font-size:14px;margin-bottom:4px;">' + escHtml(p.name) + '</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">'
        + '<span style="font-size:12px;color:var(--text-secondary);">⚽</span><span>' + starHtml('spiel', spiel) + '</span>'
        + '<span style="font-size:12px;color:var(--text-secondary);">💪</span><span>' + starHtml('zweikampf', zk) + '</span>'
        + '<span style="font-size:12px;color:var(--text-secondary);">🧠</span><span>' + starHtml('verstaendnis', sv) + '</span>'
        + '</div></div>';
    }).join(''),
    '</div></div>',
    '<div style="margin-bottom:16px;"><div class="card-title" onclick="toggleCollapse(\'helpers\')" style="cursor:pointer;">🔧 Helfer-Aufgaben <span style="margin-left:auto;font-size:12px;color:var(--text-secondary);">' + (uiCollapsed.helpers ? '▸' : '▾') + '</span></div><div style="display:' + (uiCollapsed.helpers ? 'none' : 'block') + '">' + renderMatchTasks(m) + '</div></div>'
  ].join('');
}

function toggleCollapse(key) {
  uiCollapsed[key] = !uiCollapsed[key];
  render();
}

function renderMatchTasks(m) {
  var tasks = m.tasks || {};
  var taskTypes = [
    { key: 'cake', icon: '🧁', title: 'Kuchen mitbringen' },
    { key: 'booth', icon: '🏪', title: 'Budenbetreuung' },
    { key: 'setup', icon: '🛠️', title: 'Aufbau-Helfer' },
    { key: 'teardown', icon: '🔨', title: 'Abbau-Helfer' },
    { key: 'laundry', icon: '🧺', title: 'Tasche waschen' }
  ];

  function buildHelperHtml(key, h, i) {
    var nameHtml = escHtml(h.name);
    if (h.note) nameHtml += ' <span style="color:var(--text-secondary);">(' + escHtml(h.note) + ')</span>';
    return '<div class="settings-row" style="border-bottom:none;padding:8px 0;"><span style="font-size:15px;">' + nameHtml + '</span><button class="btn btn-small btn-danger" style="width:auto;padding:4px 12px;" onclick="removeTaskHelper(' + m.id + ',\'' + key + '\',' + i + ')">✕</button></div>';
  }

  function buildTaskCard(tt) {
    var helpers = tasks[tt.key] || [];
    var html = '<div class="card"><div class="card-title">' + tt.icon + ' ' + tt.title + '</div>';
    if (helpers.length === 0) html += '<p style="font-size:14px;color:var(--text-secondary);">Keine Helfer eingetragen</p>';
    html += helpers.map(function(h, i) { return buildHelperHtml(tt.key, h, i); }).join('');
    html += '<div style="display:flex;gap:6px;margin-top:8px;">';
    html += '<button class="btn btn-small btn-secondary" style="width:auto;" onclick="addTaskHelper(' + m.id + ',\'' + tt.key + '\')">+ Helfer hinzufügen</button>';
    if (tt.key === 'laundry') {
      html += '<button class="btn btn-small btn-primary" style="width:auto;" onclick="autoAssignLaundry(' + m.id + ')">⚡ Auto</button>';
    }
    html += '</div></div>';
    return html;
  }

  return taskTypes.map(buildTaskCard).join('');
}

function renderCalendar() {
  const content = $('#app-content');
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const dayNames = ['Mo','Di','Mi','Do','Fr','Sa','So'];

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  var firstOfMonth = year + '-' + String(month+1).padStart(2,'0') + '-01';
  var lastOfMonth = year + '-' + String(month+1).padStart(2,'0') + '-' + String(daysInMonth).padStart(2,'0');

  const today = todayStr();
  const scheduledTrainings = getScheduledTrainingsInMonth(year, month);
  const exceptions = state.settings.trainingExceptions || [];

  function exceptionInMonth(e) {
    if (e.to) return e.from <= lastOfMonth && e.to >= firstOfMonth;
    return e.from >= firstOfMonth && e.from <= lastOfMonth;
  }

  let html = `
    <div class="card">
      <div class="calendar-header">
        <button class="btn btn-small btn-secondary" onclick="addMatch()">+ Spiel</button>
        <div class="calendar-nav">
          <button onclick="calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar();">◀</button>
          <span class="calendar-month">${monthNames[month]} ${year}</span>
          <button onclick="calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar();">▶</button>
        </div>
      </div>
      <div class="calendar-grid">
        ${dayNames.map(d => `<div class="calendar-day-header">${d}</div>`).join('')}
        ${Array(startOffset).fill(0).map(() => '<div></div>').join('')}
        ${Array(daysInMonth).fill(0).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isScheduled = scheduledTrainings.some(t => t.date === dateStr);
          const isMatch = getSeasonMatches().some(m => m.date === dateStr);
          const isExcused = isExceptionDate(dateStr);
          const isToday = dateStr === today;
          const match = getSeasonMatches().find(m => m.date === dateStr);
          let cls = 'calendar-day';
          let title = '';
          let label = '';
          if (isMatch) {
            cls += ' match';
            title = '⚽ ' + (match.isHome ? 'FVH vs ' + match.opponent : match.opponent + ' vs FVH');
            label = match.isHome ? '🏠' : '✈️';
          } else if (isExcused) {
            cls += ' exception';
            var exc = exceptions.find(function(e) {
              if (e.to) return dateStr >= e.from && dateStr <= e.to;
              return e.from === dateStr;
            });
            title = '🚫 ' + (exc && exc.reason ? exc.reason : 'Kein Training');
            label = '🚫';
          } else if (isScheduled) {
            cls += ' training';
            title = '⚽ Training ' + (state.settings.trainingTime || '17:00') + '–' + (state.settings.trainingTimeEnd || '18:30');
            label = '⚽';
          }

          return '<div class="' + cls + '" title="' + title + '" style="' + (isToday ? 'border:2px solid var(--primary);font-weight:800;' : '') + 'flex-direction:column;gap:0;">' + day + '<div class="day-label">' + label + '</div></div>';
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">📅 Trainingsplan (${state.settings.trainingDays.join(', ')} ${state.settings.trainingTime || '17:00'} – ${state.settings.trainingTimeEnd || '18:30'} Uhr)</div>
      ${(() => {
        const weekSched = scheduledTrainings.filter(t => t.date >= today);
        if (weekSched.length === 0) {
          return '<p style="font-size:14px;color:var(--text-secondary);">Keine anstehenden Trainingstage.</p>';
        }
        return weekSched.map(t => {
          const recorded = state.trainings.find(tr => tr.date === t.date);
          const hasAttendance = !!recorded;
          let summary = '⏳ Noch nicht erfasst';
          if (recorded) {
            let total = 0, goods = 0, oks = 0, bads = 0;
            for (const pid in recorded.attendance) {
              const a = recorded.attendance[pid];
              const status = typeof a === 'string' ? a : (a ? a.status : '');
              const behav = typeof a === 'object' && a ? a.behavior : '';
              if (status === 'yes') { total++; if (behav === 'good') goods++; else if (behav === 'ok') oks++; else if (behav === 'bad') bads++; }
            }
            summary = `✅ ${total} anwesend`;
            if (goods || oks || bads) {
              summary += ` 😊${goods} 🙂${oks} ☹️${bads}`;
            }
            const overallEmojis = { good: '😊', ok: '🙂', bad: '☹️' };
            if (recorded.overall && overallEmojis[recorded.overall]) {
              summary += ` · Gesamt: ${overallEmojis[recorded.overall]}`;
            }
          }
          const clickAction = hasAttendance
            ? `openTrainingDetail(${recorded.id})`
            : `navigateToTrainingDate('${t.date}')`;
          return `
            <div class="match-card" style="border-left-color:${hasAttendance ? 'var(--success)' : 'var(--border)'};cursor:pointer;" onclick="${clickAction}">
              <div class="match-date">${formatDateLong(t.date)} ${t.time} – ${t.timeEnd} Uhr</div>
              <div style="margin-top:4px;font-size:14px;">${summary}</div>
            </div>
          `;
        }).join('');
      })()}
    </div>

    ${exceptions.filter(function(e){return exceptionInMonth(e);}).length > 0 ? `
      <div class="card">
        <div class="card-title">🚫 Kein Training</div>
        ${exceptions.filter(function(e){return exceptionInMonth(e);}).map(function(e) {
          return '<div class="match-card" style="border-left-color:var(--text-secondary);"><div class="match-date">' + formatExceptionRange(e) + '</div><div style="margin-top:4px;font-size:14px;color:var(--text-secondary);">' + (e.reason ? escHtml(e.reason) : 'Kein Training') + '</div></div>';
        }).join('')}
      </div>
    ` : ''}

    <div class="card">
      <div class="card-title">📅 Spiele</div>
      ${state.matches
        .filter(m => m.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`))
        .sort((a,b) => a.date.localeCompare(b.date))
        .map(m => `
          <div class="match-card">
            <div class="match-date">${formatDateLong(m.date)} ${m.time ? 'um ' + m.time : ''}</div>
            <div class="match-opponent">⚽ vs ${escHtml(m.opponent)}</div>
            <div class="match-location">📍 ${escHtml(m.location || 'N.N.')}</div>
            <button class="btn btn-small btn-danger" style="margin-top:4px;" onclick="deleteMatch(${m.id})">Löschen</button>
          </div>
        `).join('') || '<div class="empty-state" style="padding:16px;">Keine Spiele diesen Monat</div>'
      }
    </div>
  `;

  content.innerHTML = html;
}

function switchSeason(season) {
  state.settings.season = season;
  saveState();
  render();
}

function addNewSeason() {
  const lastSeason = state.settings.seasons.slice().sort().pop() || '26/27';
  const parts = lastSeason.split('/').map(Number);
  const nextSeason = (parts[0] + 1) + '/' + (parts[1] + 1);
  if (!state.settings.seasons.includes(nextSeason)) state.settings.seasons.push(nextSeason);
  state.settings.season = nextSeason;
  saveState();
  render();
}

function toggleTrainingDay(day) {
  const days = state.settings.trainingDays;
  const idx = days.indexOf(day);
  if (idx >= 0) days.splice(idx, 1);
  else days.push(day);
  days.sort((a,b) => 'Mo Di Mi Do Fr Sa So'.indexOf(a) - 'Mo Di Mi Do Fr Sa So'.indexOf(b));
  saveState();
  render();
  fetch('http://localhost:3000/api/settings/trainingdays', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days })
  }).catch(() => {});
}

function addExceptionDate() {
  var modal = showModal([
    '<h2>Ausnahmetage hinzufügen</h2>',
    '<label>Von</label>',
    '<input type="date" id="exc-from-input" value="' + todayStr() + '">',
    '<label>Bis (bei Zeitraum, sonst leer)</label>',
    '<input type="date" id="exc-to-input">',
    '<label>Grund (optional)</label>',
    '<input type="text" id="exc-reason-input" placeholder="z.B. Sommerferien, Feiertag">',
    '<button class="btn btn-primary" onclick="saveException()">Hinzufügen</button>',
    '<button class="btn btn-secondary" onclick="this.closest(\'.modal-overlay\').remove()">Abbrechen</button>'
  ].join(''));
}

function saveException() {
  var from = $('#exc-from-input')?.value;
  var to = $('#exc-to-input')?.value || '';
  var reason = $('#exc-reason-input')?.value?.trim() || '';
  if (!from) return;
  if (!state.settings.trainingExceptions) state.settings.trainingExceptions = [];
  if (to && to < from) to = from;
  var exists = state.settings.trainingExceptions.some(function(e) { return e.from === from && (e.to || '') === to; });
  if (!exists) state.settings.trainingExceptions.push({ from: from, to: to || '', reason: reason });
  saveState();
  document.querySelector('.modal-overlay')?.remove();
  render();
}

function removeExceptionDate(from, to) {
  state.settings.trainingExceptions = (state.settings.trainingExceptions || []).filter(function(e) { return e.from !== from || (e.to || '') !== (to || ''); });
  saveState();
  render();
}

function formatExceptionRange(e) {
  if (e.to) return formatDateLong(e.from) + ' – ' + formatDateLong(e.to);
  return formatDateLong(e.from);
}

function toggleHistoryEntry(id) {
  historyExpandedId = historyExpandedId === id ? null : id;
  render();
}

function renderHistory() {
  const content = $('#app-content');
  const today = todayStr();

  const events = [];

  state.trainings.forEach(t => {
    if (historySeasonFilter !== '__all__' && (t.season || '25/26') !== historySeasonFilter) return;
    let total = 0, goods = 0, oks = 0, bads = 0;
    for (const pid in t.attendance || {}) {
      const a = t.attendance[pid];
      const status = typeof a === 'string' ? a : (a ? a.status : '');
      const behav = typeof a === 'object' && a ? a.behavior : '';
      if (status === 'yes' || status === 'late') total++;
      if (behav === 'good') goods++;
      else if (behav === 'ok') oks++;
      else if (behav === 'bad') bads++;
    }
    const overallMap = { good: '😊', ok: '🙂', bad: '☹️' };
    events.push({
      id: t.id,
      date: t.date,
      type: 'training',
      summary: `✅ ${total} anwesend`,
      sub: goods || oks || bads ? `😊${goods} 🙂${oks} ☹️${bads}` : '',
      overall: t.overall && overallMap[t.overall] ? overallMap[t.overall] : '',
      data: t
    });
  });

  state.matches.forEach(m => {
    if (historySeasonFilter !== '__all__' && (m.season || '25/26') !== historySeasonFilter) return;
    const pollYes = m.poll ? Object.values(m.poll).filter(v => v === 'yes').length : 0;
    const pollNo = m.poll ? Object.values(m.poll).filter(v => v === 'no').length : 0;
    const pollMaybe = m.poll ? Object.values(m.poll).filter(v => v === 'maybe').length : 0;
    events.push({
      id: m.id,
      date: m.date,
      type: 'match',
      summary: `✅ ${pollYes} zugesagt`,
      sub: `❓${pollMaybe} ❌${pollNo}`,
      overall: m.isHome ? '🏠' : '✈️',
      data: m
    });
  });

  events.sort((a, b) => b.date.localeCompare(a.date));

  const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

  let currentMonth = '';
  let html = '';

  const noData = events.length === 0;

  html += '<div style="margin-bottom:8px;">';
  html += '<select id="history-season" onchange="historySeasonFilter=this.value;renderHistory()" style="font-size:14px;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);width:100%;">';
  (state.settings.seasons || ['25/26','26/27']).forEach(function(s) {
    html += '<option value="' + s + '" ' + (s === historySeasonFilter ? 'selected' : '') + '>' + s + '</option>';
  });
  html += '<option value="__all__" ' + (historySeasonFilter === '__all__' ? 'selected' : '') + '>Alle Saisons</option>';
  html += '</select></div>';

  const searchVal = ($('#history-search')?.value || '').toLowerCase();
  html += `<input type="text" id="history-search" placeholder="🔍 Spieler suchen..." value="${escHtml(searchVal)}" oninput="renderHistory()" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:8px;font-size:16px;margin-bottom:16px;outline:none;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">`;

  if (noData) {
    html += '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Noch keine Einträge</div></div>';
    content.innerHTML = html;
    return;
  }

  events.forEach(e => {
    const d = new Date(e.date + 'T12:00:00');
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthKey !== currentMonth) {
      currentMonth = monthKey;
      html += `<div style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 8px 0;">${monthNames[d.getMonth()]} ${d.getFullYear()}</div>`;
    }

    const isExpanded = historyExpandedId === (e.type + '_' + e.id);
    const emoji = e.type === 'training' ? '⚽' : '📋';
    const typeLabel = e.type === 'training' ? 'Training' : `Spiel vs ${escHtml(e.data.opponent)}`;

    html += `<div class="card" style="cursor:pointer;padding:12px;" onclick="toggleHistoryEntry('${e.type + '_' + e.id}')">`;
    html += `<div style="display:flex;justify-content:space-between;align-items:flex-start;">`;
    html += `<div><div class="match-date">${formatDateLong(e.date)}</div>`;
    html += `<div style="font-size:15px;font-weight:600;margin-top:2px;">${emoji} ${typeLabel}</div>`;
    html += `<div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">${e.summary}${e.sub ? ' · ' + e.sub : ''}${e.overall ? ' · ' + e.overall : ''}</div>`;
    html += `</div>`;
    html += `<span style="font-size:14px;color:var(--text-secondary);transition:transform 0.2s;${isExpanded ? 'transform:rotate(180deg);display:inline-block;' : ''}">▾</span>`;
    html += `</div>`;

    if (isExpanded) {
      const searchVal = ($('#history-search')?.value || '').toLowerCase().trim();
      html += `<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">`;
      if (e.type === 'training') {
        const t = e.data;
        state.players.filter(p => !searchVal || p.name.toLowerCase().includes(searchVal)).forEach(p => {
          const a = t.attendance && t.attendance[p.id];
          const status = a ? (typeof a === 'string' ? a : a.status || '') : '';
          const behav = a && typeof a === 'object' ? (a.behavior || '') : '';
          const statusEmoji = status === 'yes' ? '✅' : status === 'late' ? '⏰' : status === 'no' ? '❌' : '❓';
          const behavEmoji = behav === 'good' ? '😊' : behav === 'ok' ? '🙂' : behav === 'bad' ? '☹️' : '';
          html += `<div class="attendance-row" style="padding:8px 12px;margin-bottom:4px;"><span class="attendance-name" style="font-size:14px;">${escHtml(p.name)}</span><span style="font-size:16px;">${statusEmoji} ${behavEmoji}</span></div>`;
        });
        const tm = state.trainings.find(x => x.id === t.id);
        if (tm && tm.overall) {
          const om = { good: '😊', ok: '🙂', bad: '☹️' };
          html += `<div style="margin-top:8px;text-align:center;font-size:14px;font-weight:600;">Gesamt: ${om[tm.overall] || ''}</div>`;
        }
      } else {
        const m = e.data;
        state.players.filter(p => !searchVal || p.name.toLowerCase().includes(searchVal)).forEach(p => {
          const val = (m.poll && m.poll[p.id]) || '';
          const statusEmoji = val === 'yes' ? '✅' : val === 'no' ? '❌' : val === 'maybe' ? '❓' : '❔';
          html += `<div class="attendance-row" style="padding:8px 12px;margin-bottom:4px;"><span class="attendance-name" style="font-size:14px;">${escHtml(p.name)}</span><span style="font-size:16px;">${statusEmoji}</span></div>`;
        });
        if (m.isHome) {
          const tasks = m.tasks || {};
          const counts = [];
          if (tasks.cake && tasks.cake.length) counts.push(`🧁 ${tasks.cake.length}`);
          if (tasks.booth && tasks.booth.length) counts.push(`🏪 ${tasks.booth.length}`);
          if (tasks.setup && tasks.setup.length) counts.push(`🛠️ ${tasks.setup.length}`);
          if (tasks.teardown && tasks.teardown.length) counts.push(`🔨 ${tasks.teardown.length}`);
          if (counts.length) html += `<div style="margin-top:8px;font-size:13px;color:var(--text-secondary);text-align:center;">Helfer: ${counts.join(' · ')}</div>`;
        }
      }
      html += `</div>`;
    }

    html += `</div>`;
  });

  content.innerHTML = html;
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fvh_daten_' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data && typeof data === 'object' && Array.isArray(data.players)) {
        state = data;
        migrateState();
        saveState();
        alert('✅ Daten erfolgreich importiert!');
        render();
      } else {
        alert('❌ Ungültiges Dateiformat.');
      }
    } catch (err) {
      alert('❌ Fehler beim Import: ' + err.message);
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function renderSettings() {
  const content = $('#app-content');
  const allDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  content.innerHTML = `
    <div class="card">
      <div class="card-title">⚙️ Einstellungen</div>

      <div class="settings-group">
        <h3>Trainingsplan</h3>
        <div class="settings-row">
          <label>Trainingstage</label>
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
            ${allDays.map(d => `
              <button class="btn btn-small ${state.settings.trainingDays.includes(d) ? 'btn-primary' : ''}"
                style="width:40px;padding:8px 0;min-width:unset;"
                onclick="toggleTrainingDay('${d}')">${d}</button>
            `).join('')}
          </div>
        </div>
        <div class="settings-row" style="flex-wrap:wrap;gap:8px;">
          <label>Uhrzeit (von – bis)</label>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="time" id="set-training-time" value="${state.settings.trainingTime || '17:00'}" onchange="state.settings.trainingTime=this.value;saveState();" style="width:110px;">
            <span>–</span>
            <input type="time" id="set-training-time-end" value="${state.settings.trainingTimeEnd || '18:30'}" onchange="state.settings.trainingTimeEnd=this.value;saveState();" style="width:110px;">
          </div>
        </div>
        <div class="settings-row">
          <label>Trainingsort</label>
          <input type="text" id="set-location" value="${escHtml(state.settings.trainingLocation || state.settings.location || '')}" onchange="state.settings.trainingLocation=this.value;saveState();">
        </div>
      </div>

      <div class="settings-group">
        <h3>Ausnahmetage (Ferien, Feiertage)</h3>
        ${(state.settings.trainingExceptions || []).length === 0 ? `
          <p style="font-size:14px;color:var(--text-secondary);margin-bottom:8px;">Keine Ausnahmen eingetragen. An diesen Tagen fällt das Training aus.</p>
        ` : `
          ${(state.settings.trainingExceptions || []).map(function(e) {
            return '<div class="settings-row"><span style="font-size:14px;">' + formatExceptionRange(e) + (e.reason ? ' – ' + escHtml(e.reason) : '') + '</span><button class="btn btn-small btn-danger" style="width:auto;padding:4px 12px;" onclick="removeExceptionDate(\'' + e.from + '\',\'' + (e.to || '') + '\')">✕</button></div>';
          }).join('')}
        `}
        <button class="btn btn-small btn-secondary" style="margin-top:8px;" onclick="addExceptionDate()">+ Ausnahmetage hinzufügen</button>
      </div>

      <div class="settings-group">
        <h3>📅 Saison</h3>
        <div class="settings-row">
          <label>Aktuelle Saison</label>
          <select onchange="switchSeason(this.value)" style="font-size:14px;padding:6px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);">
            ${(state.settings.seasons || ['25/26','26/27']).map(s =>
              `<option value="${s}" ${s === state.settings.season ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </div>
        <button class="btn btn-small btn-secondary" style="margin-top:4px;" onclick="addNewSeason()">+ Neue Saison anlegen</button>
        ${!state.settings.seasons.includes('24/25') ? `
          <button class="btn btn-small btn-secondary" style="margin-top:4px;margin-left:8px;" onclick="seedSeason24_25()">📂 Simulierte Saison 24/25 laden</button>
        ` : ''}
      </div>

      <div class="settings-group">
        <h3>Team</h3>
        <div class="settings-row">
          <label>Trainingsschwelle (für Spielberechtigung)</label>
          <input type="number" id="set-threshold" value="${state.settings.trainingThreshold}" min="1" max="10" onchange="state.settings.trainingThreshold=parseInt(this.value)||3;saveState();">
        </div>
      </div>

      <div class="settings-group">
        <h3>Wetter</h3>
        <div class="settings-row">
          <label>Wetter anzeigen</label>
          <input type="checkbox" id="set-weather" ${state.settings.useWeather ? 'checked' : ''} onchange="state.settings.useWeather=this.checked;saveState();" style="width:auto;">
        </div>
      </div>

      <div class="settings-group">
        <h3>Daten</h3>
        <button class="btn btn-danger" onclick="if(confirm('Wirklich alle Daten löschen?')){localStorage.removeItem('fvh_state');state=JSON.parse(JSON.stringify(DEFAULT_STATE));render();}">
          🗑️ Alle Daten löschen
        </button>
      </div>

      <div class="settings-group">
        <h3>Daten sichern</h3>
        <button class="btn btn-secondary" onclick="exportData()">💾 Daten exportieren</button>
        <button class="btn btn-secondary" style="margin-top:8px;" onclick="document.getElementById('import-file-input').click()">📂 Daten importieren</button>
        <input type="file" id="import-file-input" accept=".json" style="display:none;" onchange="importData(this)">
        <p style="font-size:12px;color:var(--text-secondary);margin-top:8px;">Exportiert alle Spieler, Trainings, Spiele und Einstellungen als JSON-Datei.</p>
      </div>

      <div class="settings-group">
        <h3>Info</h3>
        <div style="font-size:14px;color:var(--text-secondary);">
          <p>Version 1.0.0</p>
          <p style="margin-top:4px;">Daten werden lokal im Browser gespeichert.</p>
        </div>
      </div>
    </div>
  `;
}

function render() {
  const headerTitle = {
    dashboard: '🏠 Dashboard',
    players: '👥 Spieler',
    training: '⚽ Training',
    matchday: '📋 Spieltag',
    calendar: '📅 Kalender',
    history: '📋 Verlauf',
    settings: '⚙️ Einstellungen'
  };

  $('#header-title').textContent = headerTitle[currentPage] || 'FVH D-Jugend';

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === currentPage);
  });

  switch (currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'players': renderPlayers(); break;
    case 'training': renderTraining(); break;
    case 'matchday': renderMatchday(); break;
    case 'calendar': renderCalendar(); break;
    case 'history': renderHistory(); break;
    case 'settings': renderSettings(); break;
    default: renderDashboard(); break;
  }
}

function init() {
  try {
    loadState();
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    currentPage = hash;
    render();
    console.log('FVH App initialized successfully');
  } catch (e) {
    console.error('FVH App init error:', e);
    document.getElementById('app-content').innerHTML = '<div style="padding:40px;text-align:center;"><p style="font-size:18px;font-weight:700;color:#F44336;">⚽ Ein Fehler ist aufgetreten</p><p style="font-size:14px;color:var(--text-secondary);margin-top:8px;">Bitte konsolen-log prüfen (F12) und Fehler melden.</p><button class="btn btn-primary" style="margin-top:16px;width:auto;" onclick="localStorage.clear();location.reload()">🗑️ Daten zurücksetzen</button></div>';
  }
}

window.addEventListener('hashchange', () => {
  const page = window.location.hash.replace('#', '') || 'dashboard';
  currentPage = page;
  render();
});

document.addEventListener('DOMContentLoaded', init);