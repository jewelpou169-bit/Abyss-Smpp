const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const config = require('./settings.json');
const express = require('express');
const http = require('http');
const https = require('https');

// ============================================================
// EXPRESS SERVER - Keep Render/Aternos alive
// ============================================================
const app = express();
const PORT = process.env.PORT || 5000;

let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  errors: []
};

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${config.name} Status</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; overflow: hidden; }
          .container { background: #1e293b; padding: 40px; border-radius: 20px; box-shadow: 0 0 50px rgba(45, 212, 191, 0.2); text-align: center; width: 400px; border: 1px solid #334155; transition: box-shadow 0.3s ease; }
          h1 { margin-bottom: 30px; font-size: 24px; color: #ccfbf1; display: flex; align-items: center; justify-content: center; gap: 10px; }
          .stat-card { background: #0f172a; padding: 15px; margin: 15px 0; border-radius: 12px; border-left: 5px solid #2dd4bf; text-align: left; box-shadow: 5px 5px 15px rgba(0, 0, 0, 0.3); }
          .label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
          .value { font-size: 18px; font-weight: bold; color: #2dd4bf; margin-top: 5px; }
          .status-dot { height: 12px; width: 12px; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 10px currentColor; background-color: currentColor; }
          .pulse { animation: pulse 2s infinite; }
          @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
          .btn-guide { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #2dd4bf; color: #0f172a; text-decoration: none; border-radius: 8px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container" id="main-container">
          <h1><span id="live-indicator" class="status-dot pulse" style="color: #ef4444;"></span> ${config.name}</h1>
          <div class="stat-card"><div class="label">Status</div><div class="value" id="status-text">Connecting...</div></div>
          <div class="stat-card"><div class="label">Uptime</div><div class="value" id="uptime-text">0h 0m 0s</div></div>
          <div class="stat-card"><div class="label">Coordinates</div><div class="value" id="coords-text">Waiting...</div></div>
          <div class="stat-card"><div class="label">Server</div><div class="value">${config.server.ip}</div></div>
          <a href="/tutorial" class="btn-guide">View Setup Guide</a>
        </div>
        <script>
          const formatUptime = (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return \`\${h}h \${m}m \${s}s\`;
          };
          const updateStats = async () => {
            try {
              const res = await fetch('/health');
              const data = await res.json();
              const statusText = document.getElementById('status-text');
              const liveDot = document.getElementById('live-indicator');
              if (data.status === 'connected') {
                statusText.innerText = 'Online & Running';
                statusText.style.color = '#2dd4bf';
                liveDot.style.color = '#4ade80';
              } else {
                statusText.innerText = 'Reconnecting...';
                statusText.style.color = '#f87171';
                liveDot.style.color = '#f87171';
              }
              document.getElementById('uptime-text').innerText = formatUptime(data.uptime);
              document.getElementById('coords-text').innerText = data.coords
                ? \`\${Math.floor(data.coords.x)}, \${Math.floor(data.coords.y)}, \${Math.floor(data.coords.z)}\`
                : 'Unknown Location';
            } catch (e) {
              document.getElementById('status-text').innerText = 'System Offline';
              document.getElementById('live-indicator').style.color = '#64748b';
            }
          };
          setInterval(updateStats, 1000);
          updateStats();
        </script>
      </body>
    </html>
  `);
});

app.get('/tutorial', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>${config.name} - Setup Guide</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #cbd5e1; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
          h1, h2 { color: #2dd4bf; }
          .card { background: #1e293b; padding: 25px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #334155; }
          a { color: #38bdf8; text-decoration: none; }
          code { background: #334155; padding: 2px 6px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <a href="/">Back to Dashboard</a>
        <h1>Setup Guide</h1>
        <div class="card"><h2>Step 1: Aternos</h2><ol>
          <li>Install <strong>Paper</strong> software.</li>
          <li>Turn on <strong>Cracked</strong> mode.</li>
          <li>Plugins: <code>ViaVersion</code>, <code>ViaBackwards</code>, <code>ViaRewind</code>.</li></ol></div>
        <div class="card"><h2>Step 2: GitHub</h2><ol>
          <li>Edit <code>settings.json</code> with your IP/Port.</li>
          <li>Upload all files to a GitHub repo.</li></ol></div>
        <div class="card"><h2>Step 3: Render</h2><ol>
          <li>Create a Web Service and connect GitHub.</li>
          <li>Build: <code>npm install</code></li>
          <li>Start: <code>npm start</code></li></ol></div>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({
    status: botState.connected ? 'connected' : 'disconnected',
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: (bot && bot.entity) ? bot.entity.position : null,
    lastActivity: botState.lastActivity,
    reconnectAttempts: botState.reconnectAttempts,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
  });
});

app.get('/ping', (req, res) => res.send('pong'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] HTTP server started on port ${PORT}`);
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

// ============================================================
// SELF-PING - Prevent Render from sleeping
// ============================================================
const SELF_PING_INTERVAL = 10 * 60 * 1000;

function startSelfPing() {
  setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(`${url}/ping`, () => {}).on('error', (err) => {
      console.log(`[KeepAlive] Self-ping failed: ${err.message}`);
    });
  }, SELF_PING_INTERVAL);
  console.log('[KeepAlive] Self-ping system started (every 10 min)');
}
startSelfPing();

setInterval(() => {
  const heapMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  console.log(`[Memory] Heap: ${heapMB} MB`);
}, 5 * 60 * 1000);

// ============================================================
// BOT CREATION WITH RECONNECTION LOGIC
// ============================================================
let bot = null;
let activeIntervals = [];
let reconnectTimeout = null;
let isReconnecting = false;

const setupLeaveRejoin = require('./leaveRejoin');

function clearAllIntervals() {
  activeIntervals.forEach(id => clearInterval(id));
  activeIntervals = [];
}

function addInterval(callback, delay) {
  const id = setInterval(callback, delay);
  activeIntervals.push(id);
  return id;
}

function getReconnectDelay() {
  const baseDelay = config.utils['auto-reconnect-delay'] || 2000;
  const maxDelay = config.utils['max-reconnect-delay'] || 15000;
  return Math.min(baseDelay + (botState.reconnectAttempts * 1000), maxDelay);
}

function createBot() {
  if (isReconnecting) {
    console.log('[Bot] Already reconnecting, skipping...');
    return;
  }

  if (bot) {
    clearAllIntervals();
    try {
      bot.removeAllListeners();
      bot.end();
    } catch (e) {
      console.log('[Cleanup] Error ending previous bot:', e.message);
    }
    bot = null;
  }

  console.log(`[Bot] Connecting to ${config.server.ip}:${config.server.port}`);

  try {
    bot = mineflayer.createBot({
      username: config['bot-account'].username,
      password: config['bot-account'].password || undefined,
      auth: config['bot-account'].type,
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
      hideErrors: false,
      checkTimeoutInterval: 120000
    });

    bot.loadPlugin(pathfinder);

    // ---------- AUTH ----------
    const PASS = 'Perzuu';
    let tries = 0;
    let lastTry = 0;

    function tryAuth(cmd) {
      const now = Date.now();
      if (tries >= 6 || now - lastTry < 2500) return;
      tries++;
      lastTry = now;
      bot.chat(cmd);
      console.log('[Auth] Sent:', cmd.split(' ')[0]);
    }

    // Shows EVERY server message so we can see what AuthSmith says
    bot.on('messagestr', (msg) => {
      console.log('[Chat]', msg);
      const m = msg.toLowerCase();
      if (m.includes('success') || m.includes('logged in') || m.includes('welcome back')) {
        tries = 99; // done, stop sending
        return;
      }
      if (m.includes('register') || m.includes('not registered') || m.includes('create an account')) {
        tryAuth(`/register ${PASS} ${PASS}`);
      } else if (m.includes('log in') || m.includes('login') || m.includes('password')) {
        tryAuth(`/login ${PASS}`);
      }
    });

    // Don't wait for a message: try right after joining
    bot.once('login', () => {
      console.log('[Bot] Joined, authenticating soon...');
      setTimeout(() => tryAuth(`/login ${PASS}`), 2500);
      setTimeout(() => tryAuth(`/register ${PASS} ${PASS}`), 6000);
    });

    const connectionTimeout = setTimeout(() => {
      if (!botState.connected) {
        console.log('[Bot] Connection timeout - no spawn received');
        scheduleReconnect();
      }
    }, 60000);

    bot.once('spawn', () => {
      clearTimeout(connectionTimeout);
      botState.connected = true;
      botState.lastActivity = Date.now();
      botState.reconnectAttempts = 0;
      isReconnecting = false;

      console.log('[Bot] [+] Successfully spawned on server!');

      if (config.discord && config.discord.events && config.discord.events.connect) {
        sendDiscordWebhook(`[+] **Connected** to \`${config.server.ip}\``, 0x4ade80);
      }

      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);

      initializeModules(bot, mcData, defaultMove);
      setupLeaveRejoin(bot, createBot);

      setTimeout(() => {
        if (bot && botState.connected) {
          bot.chat('/gamerule sendCommandFeedback false');
          bot.chat('/gamemode creative');
        }
      }, 3000);
    });

    bot.on('end', (reason) => {
      console.log(`[Bot] Disconnected: ${reason || 'Unknown reason'}`);
      botState.connected = false;
      clearAllIntervals();

      if (config.discord && config.discord.events && config.discord.events.disconnect && reason !== 'Periodic Rejoin') {
        sendDiscordWebhook(`[-] **Disconnected**: ${reason || 'Unknown'}`, 0xf87171);
      }

      if (config.utils['auto-reconnect']) {
        scheduleReconnect();
      }
    });

    bot.on('kicked', (reason) => {
      console.log('[KICK]', typeof reason === 'string' ? reason : JSON.stringify(reason, null, 2));
    });

    bot.on('error', (err) => {
      console.log(`[Bot] Error: ${err.message}`);
      botState.errors.push({ type: 'error', message: err.message, time: Date.now() });
    });

  } catch (err) {
    console.log(`[Bot] Failed to create bot: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (isReconnecting) return;

  isReconnecting = true;
  botState.reconnectAttempts++;

  const delay = getReconnectDelay();
  console.log(`[Bot] Reconnecting in ${delay / 1000}s (attempt #${botState.reconnectAttempts})`);

  reconnectTimeout = setTimeout(() => {
    isReconnecting = false;
    createBot();
  }, delay);
}

// ============================================================
// MODULE INITIALIZATION
// ============================================================
function initializeModules(bot, mcData, defaultMove) {
  console.log('[Modules] Initializing all modules...');

  if (config.position.enabled) {
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
  }

  if (config.utils['anti-afk'].enabled) {
    addInterval(() => {
      if (bot && botState.connected) {
        bot.setControlState('jump', true);
        setTimeout(() => {
          if (bot) bot.setControlState('jump', false);
        }, 100);
        botState.lastActivity = Date.now();
      }
    }, 30000); // every 30 seconds

    if (config.utils['anti-afk'].sneak) {
      bot.setControlState('sneak', true);
    }
  }

  if (config.movement['circle-walk'].enabled) startCircleWalk(bot, defaultMove);
  if (config.movement['random-jump'].enabled) startRandomJump(bot);
  if (config.movement['look-around'].enabled) startLookAround(bot);

  if (config.modules.avoidMobs) avoidMobs(bot);
  if (config.modules.combat) combatModule(bot, mcData);
  if (config.modules.beds) bedModule(bot, mcData);
  if (config.modules.chat) chatModule(bot);

  console.log('[Modules] All modules initialized!');
}

// ============================================================
// MOVEMENT HELPERS
// ============================================================
function startCircleWalk(bot, defaultMove) {
  const radius = config.movement['circle-walk'].radius;
  let angle = 0;
  let lastPathTime = 0;

  addInterval(() => {
    if (!bot || !botState.connected) return;

    const now = Date.now();
    if (now - lastPathTime < 2000) return;
    lastPathTime = now;

    try {
      const x = bot.entity.position.x + Math.cos(angle) * radius;
      const z = bot.entity.position.z + Math.sin(angle) * radius;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(Math.floor(x), Math.floor(bot.entity.position.y), Math.floor(z)));
      angle += Math.PI / 4;
      botState.lastActivity = Date.now();
    } catch (e) {
      console.log('[CircleWalk] Error:', e.message);
    }
  }, config.movement['circle-walk'].speed);
}

function startRandomJump(bot) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      bot.setControlState('jump', true);
      setTimeout(() => {
        if (bot) bot.setControlState('jump', false);
      }, 300);
      botState.lastActivity = Date.now();
    } catch (e) {
      console.log('[RandomJump] Error:', e.message);
    }
  }, config.movement['random-jump'].interval);
}

function startLookAround(bot) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI / 4;
      bot.look(yaw, pitch, true);
      botState.lastActivity = Date.now();
    } catch (e) {
      console.log('[LookAround] Error:', e.message);
    }
  }, config.movement['look-around'].interval);
}

// ============================================================
// CUSTOM MODULES
// ============================================================
function avoidMobs(bot) {
  const safeDistance = 5;
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      const entities = Object.values(bot.entities).filter(e =>
        e.type === 'mob' || (e.type === 'player' && e.username !== bot.username)
      );
      for (const e of entities) {
        if (!e.position) continue;
        if (bot.entity.position.distanceTo(e.position) < safeDistance) {
          bot.setControlState('back', true);
          setTimeout(() => {
            if (bot) bot.setControlState('back', false);
          }, 500);
          break;
        }
      }
    } catch (e) {
      console.log('[AvoidMobs] Error:', e.message);
    }
  }, 2000);
}

function combatModule(bot, mcData) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      if (config.combat['attack-mobs']) {
        const mobs = Object.values(bot.entities).filter(e =>
          e.type === 'mob' && e.position &&
          bot.entity.position.distanceTo(e.position) < 4
        );
        if (mobs.length > 0) bot.attack(mobs[0]);
      }
    } catch (e) {
      console.log('[Combat] Error:', e.message);
    }
  }, 1500);

  bot.on('health', () => {
    if (!config.combat['auto-eat']) return;
    try {
      if (bot.food < 14) {
        const food = bot.inventory.items().find(i => {
          const itemData = mcData.itemsByName[i.name];
          return itemData && itemData.food;
        });
        if (food) {
          bot.equip(food, 'hand')
            .then(() => bot.consume())
            .catch(e => console.log('[AutoEat] Error:', e.message));
        }
      }
    } catch (e) {
      console.log('[AutoEat] Error:', e.message);
    }
  });
}

function bedModule(bot, mcData) {
  addInterval(async () => {
    if (!bot || !botState.connected) return;
    try {
      const isNight = bot.time.timeOfDay >= 12500 && bot.time.timeOfDay <= 23500;
      if (config.beds['place-night'] && isNight && !bot.isSleeping) {
        const bedBlock = bot.findBlock({
          matching: block => block.name.includes('bed'),
          maxDistance: 8
        });
        if (bedBlock) {
          try {
            await bot.sleep(bedBlock);
            console.log('[Bed] Sleeping...');
          } catch (e) {}
        }
      }
    } catch (e) {
      console.log('[Bed] Error:', e.message);
    }
  }, 10000);
}

function chatModule(bot) {
  bot.on('chat', (username, message) => {
    if (!bot || username === bot.username) return;
    try {
      if (config.chat.respond) {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
          bot.chat(`Hello, ${username}!`);
        }
        if (message.startsWith('!tp ')) {
          const target = message.split(' ')[1];
          if (target) bot.chat(`/tp ${target}`);
        }
      }
    } catch (e) {
      console.log('[Chat] Error:', e.message);
    }
  });
}

// ============================================================
// CONSOLE COMMANDS
// ============================================================
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  if (!bot || !botState.connected) {
    console.log('[Console] Bot not connected');
    return;
  }

  const trimmed = line.trim();
  if (trimmed.startsWith('say ')) {
    bot.chat(trimmed.slice(4));
  } else if (trimmed.startsWith('cmd ')) {
    bot.chat('/' + trimmed.slice(4));
  } else if (trimmed === 'status') {
    console.log(`Connected: ${botState.connected}, Uptime: ${formatUptime(Math.floor((Date.now() - botState.startTime) / 1000))}`);
  } else if (trimmed === 'reconnect') {
    console.log('[Console] Manual reconnect requested');
    bot.end();
  } else {
    bot.chat(trimmed);
  }
});

// ============================================================
// DISCORD WEBHOOK INTEGRATION
// ============================================================
function sendDiscordWebhook(content, color = 0x0099ff) {
  if (!config.discord || !config.discord.enabled || !config.discord.webhookUrl || config.discord.webhookUrl.includes('YOUR_DISCORD')) return;

  const urlParts = new URL(config.discord.webhookUrl);
  const protocol = urlParts.protocol === 'https:' ? https : http;

  const payload = JSON.stringify({
    username: config.name,
    embeds: [{
      description: content,
      color: color,
      timestamp: new Date().toISOString(),
      footer: { text: 'Slobos AFK Bot' }
    }]
  });

  const options = {
    hostname: urlParts.hostname,
    port: 443,
    path: urlParts.pathname + urlParts.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = protocol.request(options, () => {});
  req.on('error', (e) => console.log(`[Discord] Error sending webhook: ${e.message}`));
  req.write(payload);
  req.end();
}

// ============================================================
// CRASH RECOVERY
// ============================================================
process.on('uncaughtException', (err) => {
  console.log(`[FATAL] Uncaught Exception: ${err.message}`);
  botState.errors.push({ type: 'uncaught', message: err.message, time: Date.now() });

  if (config.utils['auto-reconnect']) {
    clearAllIntervals();
    setTimeout(() => scheduleReconnect(), 1000);
  }
});

process.on('unhandledRejection', (reason) => {
  console.log(`[FATAL] Unhandled Rejection: ${reason}`);
  botState.errors.push({ type: 'rejection', message: String(reason), time: Date.now() });
});

process.on('SIGTERM', () => {
  console.log('[System] SIGTERM received. Exiting...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[System] Manual stop requested. Exiting...');
  process.exit(0);
});

// ============================================================
// START THE BOT
// ============================================================
console.log('='.repeat(50));
console.log('  Minecraft AFK Bot v2.4 - Auth Fix');
console.log('='.repeat(50));
console.log(`Server: ${config.server.ip}:${config.server.port}`);
console.log(`Version: ${config.server.version}`);
console.log(`Auto-Reconnect: ${config.utils['auto-reconnect'] ? 'Enabled' : 'Disabled'}`);
console.log('='.repeat(50));

createBot();
