require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cors = require('cors');

process.on('uncaughtException', (err) => {
  console.error(`[CRASH] uncaughtException: ${err.message}`, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error(`[CRASH] unhandledRejection: ${reason}`, reason?.stack);
});

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'polls.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Telegram Bot ──────────────────────────────────────────
let bot = null;
let botReady = false;

function initBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('  ⚠️  TELEGRAM_BOT_TOKEN nicht gesetzt – Bot deaktiviert');
    console.log('     Setze die Umgebungsvariable oder .env Datei');
    return;
  }
  try {
    const TelegramBot = require('node-telegram-bot-api');
    bot = new TelegramBot(token, { polling: true });

    bot.on('polling_error', (err) => {
      console.error('  Bot Polling Error:', err.message);
    });

    bot.on('error', (err) => {
      console.error('  Bot Error:', err.message);
    });

    bot.on('poll_answer', (answer) => {
      // answer: { poll_id, user: {id,first_name,last_name,username}, option_ids: [0,1,...] }
      savePollAnswer(answer);
    });

    bot.on('message', (msg) => {
      if (msg.text === '/start') {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
          '⚽ FVH D-Jugend Bot aktiv!\n\n' +
          'Dieser Bot wird vom FVH D-Jugend Manager gesteuert.\n' +
          'Umfragen werden automatisch erstellt und ausgewertet.'
        );
      }
    });

    botReady = true;
    console.log('  ✅ Telegram Bot aktiv');
  } catch (err) {
    console.error('  ❌ Bot Init Fehler:', err.message);
  }
}

// ─── Daten-Speicher (polls.json) ──────────────────────────
function loadPolls() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) { console.error('Fehler beim Laden:', e.message); }
  return { polls: [], answers: [] };
}

function savePolls(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.error('Fehler beim Speichern:', e.message); }
}

function savePollAnswer(answer) {
  const data = loadPolls();
  // Prüfe ob Antwort bereits existiert (aktualisieren)
  const existing = data.answers.find(a => a.poll_id === answer.poll_id && a.user.id === answer.user.id);
  if (existing) {
    existing.option_ids = answer.option_ids;
    existing.updated_at = new Date().toISOString();
  } else {
    data.answers.push({
      poll_id: answer.poll_id,
      user: answer.user,
      option_ids: answer.option_ids,
      created_at: new Date().toISOString()
    });
  }
  savePolls(data);
}

function getTelegramGroupId() {
  try {
    if (fs.existsSync(path.join(__dirname, '.group'))) {
      return fs.readFileSync(path.join(__dirname, '.group'), 'utf8').trim();
    }
  } catch (e) {}
  return process.env.TELEGRAM_GROUP_ID || null;
}

function saveTelegramGroupId(chatId) {
  fs.writeFileSync(path.join(__dirname, '.group'), String(chatId));
}

// ─── API Routes ─────────────────────────────────────────────

// Bot-Status abfragen
app.get('/api/bot/status', (req, res) => {
  const groupId = getTelegramGroupId();
  res.json({
    botReady,
    hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
    groupId: groupId || null
  });
});

// Bot-Gruppe setzen (wird beim ersten /start gesetzt)
app.post('/api/bot/group', (req, res) => {
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ error: 'chatId fehlt' });
  saveTelegramGroupId(chatId);
  res.json({ success: true });
});

// Umfrage erstellen + via Bot versenden
app.post('/api/poll/create', async (req, res) => {
  const { matchId, opponent, date, time, options, type } = req.body;
  // options = ['Max', 'Tim', 'Luca', ...] (Spielernamen)
  // type = 'spieler' | 'kuchen' | 'helfer'

  if (!bot || !botReady) {
    return res.status(503).json({ error: 'Bot nicht verfügbar' });
  }
  if (!options || options.length === 0) {
    return res.status(400).json({ error: 'Keine Optionen' });
  }

  const groupId = getTelegramGroupId();
  if (!groupId) {
    return res.status(400).json({ error: 'Keine Telegram-Gruppe konfiguriert. Nachricht mit /start an Bot senden.' });
  }

  const titles = {
    spieler: `📋 Wer ist dabei? ${opponent} (${date}${time ? ' um ' + time : ''})`,
    kuchen: '🧁 Wer bringt Kuchen mit?',
    helfer: '🔧 Wer hilft?'
  };
  const question = titles[type] || `📋 Umfrage: ${opponent}`;

  try {
    const msg = await bot.sendPoll(groupId, question, options, {
      is_anonymous: false,
      allows_multiple_answers: type !== 'spieler',
      open_period: 86400 // 24 Stunden
    });

    const data = loadPolls();
    data.polls.push({
      poll_id: msg.poll.id,
      matchId: String(matchId),
      message_id: msg.message_id,
      chat_id: groupId,
      type: type || 'spieler',
      question,
      options,
      created_at: new Date().toISOString()
    });
    savePolls(data);

    res.json({ success: true, poll_id: msg.poll.id, message_id: msg.message_id });
  } catch (err) {
    console.error('Poll Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Umfrage-Ergebnisse abrufen
app.get('/api/poll/results/:matchId', (req, res) => {
  const data = loadPolls();
  const matchPolls = data.polls.filter(p => p.matchId === String(req.params.matchId));
  const results = matchPolls.map(poll => {
    const pollAnswers = data.answers.filter(a => a.poll_id === poll.poll_id);
    const votes = {};
    poll.options.forEach((opt, idx) => {
      const voters = pollAnswers.filter(a => a.option_ids.includes(idx)).map(a => a.user);
      votes[opt] = voters;
    });
    return { ...poll, votes, total_voters: pollAnswers.length };
  });
  res.json(results);
});

// Alle gemerkten Umfragen löschen
app.delete('/api/poll/clear/:matchId', (req, res) => {
  const data = loadPolls();
  data.polls = data.polls.filter(p => p.matchId !== String(req.params.matchId));
  data.answers = data.answers.filter(a => !data.polls.some(p => p.poll_id === a.poll_id));
  savePolls(data);
  res.json({ success: true });
});

// ─── Frontend Catch-all ────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ─────────────────────────────────────────────────
initBot();

// Bot-Gruppe automatisch aus Datei laden beim Start
const savedGroup = getTelegramGroupId();
if (savedGroup) {
  console.log(`  📱 Telegram-Gruppe: ${savedGroup}`);
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('');
  console.log('  ⚽ FVH D-Jugend Manager');
  console.log('  ──────────────────────');
  console.log(`  PC:     http://localhost:${PORT}`);
  console.log(`  Handy:  http://${ip}:${PORT}`);
  console.log(`  🗄  API aktiv unter /api`);
  console.log('');
});

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}
