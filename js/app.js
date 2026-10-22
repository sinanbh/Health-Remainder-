const STORAGE_KEY = 'desk_health_timers_v1';

// Default starter timers if storage is empty
const DEFAULT_TIMERS = [
  {
    id: 'stand-up-default',
    label: 'Get Up & Stretch',
    minutes: 45,
    accent: '#f97316',
    targetTimestamp: Date.now() + 45 * 60 * 1000,
    active: true
  },
  {
    id: 'water-default',
    label: 'Hydration Break',
    minutes: 30,
    accent: '#0ea5e9',
    targetTimestamp: Date.now() + 30 * 60 * 1000,
    active: true
  }
];

let timers = loadTimers();
let activeFiringTimer = null;
let deferredInstallPrompt = null;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  renderTimers();
  registerServiceWorker();
  setupEventListeners();

  // Tick every second
  setInterval(tick, 1000);
});

// Load / Save localStorage
function loadTimers() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_TIMERS;
  try {
    return JSON.parse(saved);
  } catch {
    return DEFAULT_TIMERS;
  }
}

function saveTimers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
}

// Timer Loop
function tick() {
  const now = Date.now();
  let stateChanged = false;

  timers.forEach((t) => {
    if (!t.active) return;

    if (now >= t.targetTimestamp && !activeFiringTimer) {
      triggerAlert(t);
      // Advance to next cycle automatically
      t.targetTimestamp = Date.now() + t.minutes * 60 * 1000;
      stateChanged = true;
    }
  });

  if (stateChanged) saveTimers();
  updateCountdownDisplays();
}

// Visual and Sound Alert
function triggerAlert(timer) {
  activeFiringTimer = timer;

  // 1. Play Tone
  playAlertChime();

  // 2. Browser Tab Title change
  document.title = `🔔 [${timer.label}] - Time's Up!`;

  // 3. Native Desktop Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(timer.label, {
      body: `Reminder interval reached (${timer.minutes}m). Get moving!`,
      icon: 'icons/icon-192.png'
    });
  }

  // 4. In-App Pulsing Overlay
  const overlay = document.getElementById('alertOverlay');
  document.getElementById('alertTitle').textContent = timer.label;
  document.getElementById('alertMessage').textContent = `Interval of ${timer.minutes} min reached. Take a break!`;
  overlay.classList.remove('hidden');
}

// Dismiss or Snooze
function dismissAlert() {
  document.getElementById('alertOverlay').classList.add('hidden');
  document.title = 'Desk & Health Tracker';
  activeFiringTimer = null;
}

function snoozeAlert(extraMinutes = 5) {
  if (activeFiringTimer) {
    activeFiringTimer.targetTimestamp = Date.now() + extraMinutes * 60 * 1000;
    saveTimers();
  }
  dismissAlert();
  renderTimers();
}

// Formatting
function formatTimeLeft(ms) {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateCountdownDisplays() {
  const now = Date.now();
  timers.forEach((t) => {
    const el = document.getElementById(`time-${t.id}`);
    if (el) {
      const diff = t.targetTimestamp - now;
      el.textContent = formatTimeLeft(diff);
    }
  });
}

// DOM Rendering
function renderTimers() {
  const grid = document.getElementById('timerGrid');
  grid.innerHTML = '';

  timers.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'timer-card';
    card.innerHTML = `
      <div class="timer-card-accent" style="background-color: ${t.accent};"></div>
      <div>
        <div class="timer-card-head">
          <span class="timer-title">${t.label}</span>
          <button class="btn btn-danger" onclick="deleteTimer('${t.id}')">Delete</button>
        </div>
        <div id="time-${t.id}" class="timer-remaining">--:--</div>
      </div>
      <div class="timer-footer">
        <span class="timer-meta">Interval: ${t.minutes} mins</span>
        <button class="btn btn-secondary" onclick="resetTimer('${t.id}')">Reset</button>
      </div>
    `;
    grid.appendChild(card);
  });
  updateCountdownDisplays();
}

// Timer Actions
window.resetTimer = function (id) {
  const t = timers.find((item) => item.id === id);
  if (t) {
    t.targetTimestamp = Date.now() + t.minutes * 60 * 1000;
    saveTimers();
    updateCountdownDisplays();
  }
};

window.deleteTimer = function (id) {
  timers = timers.filter((item) => item.id !== id);
  saveTimers();
  renderTimers();
};

// UI Handlers & Setup
function setupEventListeners() {
  // New timer form
  document.getElementById('newTimerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const label = document.getElementById('timerLabel').value.trim();
    const minutes = parseInt(document.getElementById('timerMinutes').value, 10);
    const accent = document.getElementById('timerColor').value;

    if (!label || isNaN(minutes) || minutes <= 0) return;

    timers.push({
      id: 'timer-' + Date.now(),
      label,
      minutes,
      accent,
      targetTimestamp: Date.now() + minutes * 60 * 1000,
      active: true
    });

    saveTimers();
    renderTimers();
    e.target.reset();
  });

  // Alert modal buttons
  document.getElementById('alertDismissBtn').addEventListener('click', dismissAlert);
  document.getElementById('alertSnoozeBtn').addEventListener('click', () => snoozeAlert(5));

  // Notification button
  document.getElementById('enableNotifBtn').addEventListener('click', () => {
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          alert('Desktop notifications are enabled.');
        }
      });
    }
  });

  // PWA Install banner handling
  const installBtn = document.getElementById('installAppBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.classList.remove('hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      installBtn.classList.add('hidden');
    }
    deferredInstallPrompt = null;
  });
}

// Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.log('SW registration error:', err));
  }
  }
