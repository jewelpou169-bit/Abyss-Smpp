// AbyssBot - AFK bot for an offline-mode server with AuthSmith
const mineflayer = require('mineflayer');
const nbt = require('prismarine-nbt');
const http = require('http');

// ---------- SETTINGS (change them in Railway > Variables, not here) ----------
const CFG = {
  host: process.env.SERVER_HOST || 'abysssmpp.mcsh.gg',
  port: parseInt(process.env.SERVER_PORT || '25565', 10),
  username: process.env.BOT_NAME || 'AbyssBot',
  password: process.env.BOT_PASSWORD || 'AbyssBot123',
  version: process.env.MC_VERSION || false // false = auto-detect
};

let bot = null;
let timers = [];
let attempts = 0;
let reconnectTimer = null;
let lastPacket = Date.now();
let dialogTry = 0;
let online = false;
const startedAt = Date.now();

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- STATUS PAGE (so Railway/you can check it) ----------
http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    bot: CFG.username,
    online,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    reconnectAttempts: attempts
  }));
}).listen(process.env.PORT || 3000, '0.0.0.0');

// ---------- HELPERS ----------
function clearTimers() {
  timers.forEach(t => { clearTimeout(t); clearInterval(t); });
  timers = [];
}

function scheduleReconnect(delay) {
  if (reconnectTimer) return;
  attempts++;
  const wait = delay || Math.min(5000 + attempts * 3000, 30000);
  log(`[Bot] Reconnecting in ${Math.round(wait / 1000)}s (attempt #${attempts})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    start();
  }, wait);
}

function restart(reason, delay) {
  log(`[Bot] Restarting: ${reason}`);
  online = false;
  clearTimers();
  const old = bot;
  bot = null;
  if (old) {
    try {
      old.removeAllListeners();
      old.on('error', () => {});
      old.end();
    } catch (e) {}
  }
  scheduleReconnect(delay);
}

// ---------- RAW PACKET HELPERS ----------
function varint(n) {
  const out = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n !== 0) b |= 0x80;
    out.push(b);
  } while (n !== 0);
  return Buffer.from(out);
}

// Network NBT (no root name), written by hand. Supports strings and int arrays.
function nbtName(str) {
  const b = Buffer.from(str, 'utf8');
  const len = Buffer.alloc(2);
  len.writeUInt16BE(b.length);
  return Buffer.concat([len, b]);
}

function buildPayload(tags) {
  const parts = [Buffer.from([0x0a])]; // compound, no name
  Object.keys(tags).forEach((k) => {
    const v = tags[k];
    if (Array.isArray(v) && v.every(x => typeof x === 'number')) {
      const head = Buffer.alloc(4);
      head.writeInt32BE(v.length);
      const ints = Buffer.alloc(v.length * 4);
      v.forEach((n, i) => ints.writeInt32BE(n | 0, i * 4));
      parts.push(Buffer.from([0x0b]), nbtName(k), head, ints);
    } else {
      parts.push(Buffer.from([0x08]), nbtName(k), nbtName(String(v)));
    }
  });
  parts.push(Buffer.from([0x00])); // end of compound
  return Buffer.concat(parts);
}

// Builds the "custom_click_action" packet by hand: id + length-prefixed NBT payload.
function sendCustomClick(b, id, tags, withBool) {
  let inner = buildPayload(tags);
  if (withBool) inner = Buffer.concat([Buffer.from([1]), inner]); // alternate format tried on retries

  // ask the library only for the packet number
  const probe = b._client.serializer.createPacketBuffer({
    name: 'custom_click_action',
    params: { id: 'a:b', payload: nbt.comp({}) }
  });
  let pid = 0, shift = 0, i = 0;
  for (;;) {
    const byte = probe[i++];
    pid |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) break;
    shift += 7;
  }

  const idBuf = Buffer.from(id, 'utf8');
  const body = Buffer.concat([varint(idBuf.length), idBuf, varint(inner.length), inner]);
  b._client.writeRaw(Buffer.concat([varint(pid), body]));
}

// ---------- AUTHSMITH LOGIN FORM (dialog) ----------
// AuthSmith shows a login form (dialog) instead of chat commands.
// This reads the form and fills in the password.
function handleDialog(b, data, state) {
  let d;
  try {
    d = nbt.simplify(data.dialog);
  } catch (e) {
    log('[Dialog] Could not read the form:', e.message);
    log('[Dialog] Raw:', JSON.stringify(data).slice(0, 800));
    return;
  }
  log('[Dialog] Form received:', JSON.stringify(d).slice(0, 1200));

  const textInputs = (d.inputs || []).filter(i => i && i.key && (!i.type || /text/.test(i.type)));
  const values = {};
  textInputs.forEach(i => { values[i.key] = CFG.password; });

  const button = d.yes || d.action || (d.actions || [])[0];
  const act = button && button.action;
  if (!act) {
    log('[Dialog] No button action found in the form.');
    return;
  }
  const type = String(act.type || '');

  setTimeout(() => {
    try {
      if (/custom/.test(type) && act.id) {
        const tags = {};
        // hidden values the server attached to the button (the callback id)
        Object.keys(act.additions || {}).forEach(k => { tags[k] = act.additions[k]; });
        Object.keys(values).forEach(k => { tags[k] = values[k]; });
        dialogTry++;
        const withBool = dialogTry % 2 === 0; // 1st try: plain, 2nd try: with extra byte, and so on
        sendCustomClick(b, act.id, tags, withBool);
        log(`[Dialog] Format used: ${withBool ? 'with' : 'without'} yes/no byte`);
        log(`[Dialog] Sent form answer (${Object.keys(values).length} field(s)) to ${act.id}`);
      } else if (/command/.test(type)) {
        let cmd = String(act.command || act.template || '');
        Object.keys(values).forEach(k => { cmd = cmd.split(`$(${k})`).join(values[k]); });
        cmd = cmd.replace(/^\//, '');
        if (state === 'play') {
          b.chat('/' + cmd);
          log('[Dialog] Ran command from form.');
        } else {
          log('[Dialog] Form wants a command but we are not in play state yet.');
        }
      } else {
        log('[Dialog] Unknown button type:', type);
      }
    } catch (e) {
      log('[Dialog] Failed to answer form:', e.message);
    }
  }, 500);
}

// ---------- BOT ----------
function start() {
  if (bot) return;
  log(`[Bot] Connecting to ${CFG.host}:${CFG.port} as ${CFG.username} (version: ${CFG.version || 'auto'})`);

  let b;
  try {
    b = mineflayer.createBot({
      host: CFG.host,
      port: CFG.port,
      username: CFG.username,
      auth: 'offline',
      version: CFG.version,
      hideErrors: false,
      checkTimeoutInterval: 120000
    });
  } catch (e) {
    log('[Bot] Failed to create bot:', e.message);
    scheduleReconnect();
    return;
  }
  bot = b;
  lastPacket = Date.now();

  // No spawn within 90s -> try again
  timers.push(setTimeout(() => {
    if (bot === b && !online) restart('no spawn after 90s');
  }, 90000));

  // Watch every packet (also finds the AuthSmith form)
  b._client.on('packet', (data, meta) => {
    lastPacket = Date.now();
    if (meta && /dialog/i.test(meta.name) && !/clear/i.test(meta.name)) {
      log(`[Dialog] Packet ${meta.state}/${meta.name}`);
      handleDialog(b, data, meta.state);
    }
  });

  // Backup: classic chat commands (used if the form is not shown)
  let tries = 0;
  let lastTry = 0;
  let loggedIn = false;
  const tryAuth = (cmd) => {
    const now = Date.now();
    if (loggedIn || tries >= 6 || now - lastTry < 3000) return;
    tries++;
    lastTry = now;
    b.chat(cmd);
    log('[Auth] Sent', cmd.split(' ')[0]);
  };

  b.on('messagestr', (msg) => {
    log('[Chat]', msg);
    const m = msg.toLowerCase();
    if (m.includes('success') || m.includes('logged in') || m.includes('welcome back') || m.includes('authenticated')) {
      loggedIn = true;
      return;
    }
    if (m.includes('/register') || m.includes('register')) tryAuth(`/register ${CFG.password} ${CFG.password}`);
    else if (m.includes('/login') || m.includes('log in') || m.includes('login')) tryAuth(`/login ${CFG.password}`);
  });

  b.once('spawn', () => {
    online = true;
    attempts = 0;
    log('[Bot] Spawned in the world!');

    // keep the bot active so it is not kicked for idling
    timers.push(setInterval(() => {
      if (bot !== b) return;
      try {
        b.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.6, true);
        b.setControlState('jump', true);
        setTimeout(() => { try { b.setControlState('jump', false); } catch (e) {} }, 300);
      } catch (e) {}
    }, 20000));

    // if the form never logged us in, try the commands once
    timers.push(setTimeout(() => tryAuth(`/login ${CFG.password}`), 8000));
  });

  b.on('kicked', (reason) => {
    const text = typeof reason === 'string' ? reason : JSON.stringify(reason);
    log('[Kick]', text.slice(0, 500));
    if (/already online/i.test(text)) {
      b.__kickDelay = 30000;
    }
  });

  b.on('error', (err) => {
    log('[Bot] Error:', err.message);
    if (/unsupported|version/i.test(err.message)) {
      log('[Hint] This Minecraft version may not be supported by mineflayer yet. Check for a newer mineflayer.');
    }
  });

  b.on('end', (reason) => {
    if (bot !== b) return;
    log('[Bot] Disconnected:', reason || 'unknown');
    restart('connection closed', b.__kickDelay);
  });
}

// ---------- NEVER DIE ----------
setInterval(() => {
  if (bot && online && Date.now() - lastPacket > 120000) {
    restart('no data from server for 2 minutes');
  }
}, 30000);

process.on('uncaughtException', (err) => {
  log('[FATAL]', err.message);
  if (bot) restart('crash: ' + err.message);
  else scheduleReconnect();
});
process.on('unhandledRejection', (r) => log('[FATAL] Rejection:', String(r)));
process.on('SIGTERM', () => process.exit(0));

log('='.repeat(40));
log('AbyssBot starting');
log('='.repeat(40));
start();
