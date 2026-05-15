// Simulierte Saison 24/25 – 60 Trainings + 18 Spiele
(function() {

  const PLAYER_IDS = [10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008, 10009, 10010, 10011];
  const PLAYER_NAMES = ['Miko','Simon','Liam','Max','Ajan','Jasper','Jannis','Kuba','Periklis','Adriel','Quentin'];

  // Anwesenheits-Wahrscheinlichkeiten pro Spieler [pct_yes, pct_late, pct_no]
  const ATT_PROFILES = {
    'Miko':     [0.92, 0.05, 0.03],
    'Simon':    [0.90, 0.07, 0.03],
    'Liam':     [0.88, 0.08, 0.04],
    'Max':      [0.70, 0.15, 0.15],
    'Ajan':     [0.75, 0.12, 0.13],
    'Jasper':   [0.65, 0.15, 0.20],
    'Jannis':   [0.68, 0.12, 0.20],
    'Kuba':     [0.50, 0.15, 0.35],
    'Periklis': [0.55, 0.10, 0.35],
    'Adriel':   [0.45, 0.15, 0.40],
    'Quentin':  [0.50, 0.10, 0.40]
  };

  // Verhalten bei Anwesenheit [good, ok, bad]
  const BEHAV_PROFILES = {
    'Miko':     [0.85, 0.12, 0.03],
    'Simon':    [0.80, 0.15, 0.05],
    'Liam':     [0.82, 0.15, 0.03],
    'Max':      [0.60, 0.30, 0.10],
    'Ajan':     [0.65, 0.25, 0.10],
    'Jasper':   [0.55, 0.30, 0.15],
    'Jannis':   [0.50, 0.35, 0.15],
    'Kuba':     [0.40, 0.35, 0.25],
    'Periklis': [0.45, 0.35, 0.20],
    'Adriel':   [0.35, 0.40, 0.25],
    'Quentin':  [0.40, 0.35, 0.25]
  };

  // Bewertungen [fitness, technique] 1-5
  const RATING_PROFILES = {
    'Miko':     [5, 5],
    'Simon':    [5, 4],
    'Liam':     [4, 5],
    'Max':      [4, 4],
    'Ajan':     [4, 3],
    'Jasper':   [3, 4],
    'Jannis':   [3, 3],
    'Kuba':     [3, 2],
    'Periklis': [2, 3],
    'Adriel':   [2, 2],
    'Quentin':  [2, 2]
  };

  // Match-Spielstärke (spiel, zweikampf, verstaendnis) – pro Spieler
  const MATCH_SKILL = {
    'Miko':     [4.6, 4.3, 4.8],
    'Simon':    [4.5, 4.7, 4.3],
    'Liam':     [4.8, 4.2, 4.6],
    'Max':      [3.8, 4.0, 3.7],
    'Ajan':     [3.7, 3.5, 3.8],
    'Jasper':   [3.5, 3.8, 3.5],
    'Jannis':   [3.3, 3.5, 3.3],
    'Kuba':     [2.8, 3.0, 2.7],
    'Periklis': [2.7, 2.5, 2.8],
    'Adriel':   [2.3, 2.5, 2.3],
    'Quentin':  [2.5, 2.3, 2.5]
  };

  const GEGNER = [
    'SV Baden-Baden', 'VfB Rastatt', 'FC Oos', 'SG Ottersdorf',
    'SpVgg Illingen', 'SV Kuppenheim', 'FVW Daxlanden', 'VfB Bischweier',
    'SC Eisental', 'SV Hügelsheim', 'FV Schopp', 'SV Weitenung',
    'TSV Biberach', 'SSV Ettlingen', 'SV Kuppenheim', 'FV Mosbach'
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function rand() { return Math.random(); }

  function formatDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function genAttendance(playerName) {
    const p = ATT_PROFILES[playerName];
    const r = rand();
    if (r < p[0]) return 'yes';
    if (r < p[0] + p[1]) return 'late';
    return 'no';
  }

  function genBehavior(playerName) {
    const p = BEHAV_PROFILES[playerName];
    const r = rand();
    if (r < p[0]) return 'good';
    if (r < p[0] + p[1]) return 'ok';
    return 'bad';
  }

  function genMatchRating(playerName) {
    const base = MATCH_SKILL[playerName];
    const v = [0,0,0];
    for (let i = 0; i < 3; i++) {
      let val = base[i] + (rand() - 0.5) * 1.0;
      val = Math.max(1, Math.min(5, Math.round(val)));
      v[i] = val;
    }
    return { spiel: v[0], zweikampf: v[1], verstaendnis: v[2] };
  }

  window.seedSeason24_25 = function() {
    if (state.trainings.some(t => t.season === '24/25') || state.matches.some(m => m.season === '24/25')) {
      return alert('Saison 24/25 ist bereits geladen.');
    }

    const trainings = [];
    const matches = [];
    let pidIdx = 0;

    // ─── Spieler initial anlegen ──────────────────────────
    if (state.players.length === 0) {
      for (let i = 0; i < PLAYER_IDS.length; i++) {
        const rp = RATING_PROFILES[PLAYER_NAMES[i]];
        state.players.push({ id: PLAYER_IDS[i], name: PLAYER_NAMES[i], number: i+1, active: true, rating: { fitness: rp[0], technique: rp[1], matchPerf: 3 } });
      }
    }
    if (!state.settings.seasons.includes('24/25')) state.settings.seasons.push('24/25');

    // ─── Trainings generieren (Sep 2024 - Mai 2025) ─────
    const startDate = new Date(2024, 8, 3); // 3. Sep 2024
    const endDate = new Date(2025, 4, 31);  // 31. Mai 2025

    // Trainingstage: Di + Do
    function isTrainingDay(d) {
      const day = d.getDay();
      return day === 2 || day === 4; // Di=2, Do=4
    }

    let trainingId = 100000;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (!isTrainingDay(d)) continue;
      const dateStr = formatDate(d);
      const attendance = {};
      for (let i = 0; i < PLAYER_NAMES.length; i++) {
        const status = genAttendance(PLAYER_NAMES[i]);
        if (status === 'yes' || status === 'late') {
          attendance[PLAYER_IDS[i]] = { status, behavior: genBehavior(PLAYER_NAMES[i]) };
        } else {
          attendance[PLAYER_IDS[i]] = { status, behavior: '' };
        }
      }
      const goodCount = Object.values(attendance).filter(a => a.behavior === 'good').length;
      const totalWithBehav = Object.values(attendance).filter(a => a.behavior).length;
      const overall = totalWithBehav > 0 ? (goodCount / totalWithBehav > 0.6 ? 'good' : goodCount / totalWithBehav > 0.3 ? 'ok' : 'bad') : 'ok';
      trainings.push({ id: trainingId++, date: dateStr, season: '24/25', attendance, overall });
    }

    // ─── Spiele generieren (~alle 14 Tage Sa) ──────────
    let matchId = 200000;
    let gegnerIdx = 0;
    const matchDates = [];
    let cursor = new Date(2024, 8, 7); // erster Sa im Sep
    while (cursor <= endDate) {
      if (cursor.getDay() === 6) matchDates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 14);
    }
    // noch ein paar extra
    cursor = new Date(2024, 8, 8);
    for (let i = 0; i < 4 && cursor <= endDate; i++) {
      if (cursor.getDay() === 0 && !matchDates.some(m => Math.abs(m - cursor) < 86400000)) matchDates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 28);
    }
    matchDates.sort((a,b) => a-b);

    for (const md of matchDates) {
      const dateStr = formatDate(md);
      const opponent = GEGNER[gegnerIdx % GEGNER.length];
      gegnerIdx++;
      const isHome = gegnerIdx % 2 === 0;

      // Spieler-Zusagen – wer dabei ist
      const poll = {};
      const playerRatings = {};
      for (let i = 0; i < PLAYER_NAMES.length; i++) {
        const r = rand();
        // bessere Spieler sagen öfter zu
        const zusageWkt = i < 3 ? 0.95 : i < 7 ? 0.80 : 0.60;
        const vote = r < zusageWkt ? 'yes' : r < zusageWkt + 0.10 ? 'maybe' : 'no';
        poll[PLAYER_IDS[i]] = vote;
        if (vote === 'yes') {
          playerRatings[PLAYER_IDS[i]] = genMatchRating(PLAYER_NAMES[i]);
        }
      }

      matches.push({
        id: matchId++,
        date: dateStr,
        season: '24/25',
        opponent,
        isHome,
        location: isHome ? 'Sportplatz FVH' : opponent,
        time: '13:00',
        poll,
        playerRatings,
        lineup: null,
        tasks: { booth: [], cake: [], setup: [], teardown: [], laundry: [] }
      });
    }

    state.trainings.push(...trainings);
    state.matches.push(...matches);
    state.settings.season = '24/25';
    saveState();
    render();
  };

})();
