const STORAGE_KEY = 'desk_health_timers_v5';

function createDefaultTimers() {
  const now = Date.now();
  return [
    {
      id: 'stand-up-default',
      label: 'Get Up & Stretch',
      minutes: 45,
      accent: '#f97316',
      targetTimestamp: now + 45 * 60 * 1000,
      active: true,
      status: 'RUNNING' // 'RUNNING' | 'ALERTING'
    },
    {
      id: 'water-default',
      label: 'Hydration Break',
      minutes: 30,
      accent: '#0ea5e9',
      targetTimestamp: now + 30 * 60 * 1000,
      active: true,
      status: 'RUNNING'
    }
  ];
}

let timers = loadTimers();
let activeFiringTimer = null;
let deferredInstallPrompt = null;

window.addEventListener('DOMContentLoaded', () => {
  renderTimers();
  registerServiceWorker();
  setupEventListeners();

  // Run immediately on launch
  tick();

  // Check every second while open
  setInterval(tick, 1000);

  // Catch up and immediately fire pending notifications when returning
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      tick();
    }
  });

  window.addEventListener('focus', () => {
    tick();
  });
});

function loadTimers() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const fresh = createDefaultTimers();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    const fresh = createDefaultTimers();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    const fresh = createDefaultTimers();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

function saveTimers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
}

function tick() {
  const now = Date.now();
  let stateChanged = false;

  timers.forEach((t) => {
    if (!t.active) return;

    // Safety fallback
    if (!t.targetTimestamp) {
      t.targetTimestamp = now + t.minutes * 60 * 1000;
      t.status = 'RUNNING';
      stateChanged = true;
      return;
    }

    // Timer reached zero and hasn't triggered modal yet
    if (now >= t.targetTimestamp && t.status !== 'ALERTING') {
      t.status = 'ALERTING';
      triggerAlert(t);
      stateChanged = true;
    }
  });

  if (stateChanged) saveTimers();
  updateCountdownDisplays();
}

function triggerAlert(timer) {
  playAlertChime();
  document.title = `🔔 [${timer.label}] - Time's Up!`;

  // Fire system/lockscreen notification
  sendSystemNotification(timer);

  // Open modal and PAUSE this timer until user decides
  if (!activeFiringTimer) {
    activeFiringTimer = timer;
    const overlay = document.getElementById('alertOverlay');
    document.getElementById('alertTitle').textContent = timer.label;
    document.getElementById('alertMessage').textContent = `Interval of ${timer.minutes} min reached. Take a break!`;
    overlay.classList.remove('hidden');
  }
}

function sendSystemNotification(timer) {
  const title = timer.label;
  const options = {
    body: `Interval of ${timer.minutes}m reached. Time to take action!`,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    vibrate: [300, 100, 300, 100, 300],
    tag: timer.id,
    renotify: true
  };

  // Try service worker registration first (preferred on mobile Android)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, options);
    }).catch(() => {
      fallbackNotification(title, options);
    });
  } else {
    fallbackNotification(title, options);
  }
}

function fallbackNotification(title, options) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, options);
  }
}

function dismissAlert() {
  const overlay = document.getElementById('alertOverlay');
  overlay.classList.add('hidden');
  document.title = 'Desk & Health Tracker';

  // Reset the timer that was waiting on this modal to start fresh from now
  if (activeFiringTimer) {
    activeFiringTimer.status = 'RUNNING';
    activeFiringTimer.targetTimestamp = Date.now() + activeFiringTimer.minutes * 60 * 1000;
    saveTimers();
    activeFiringTimer = null;
  }

  // Check if any other timer was also alerting while this one was open
  const nextPending = timers.find((t) => t.status === 'ALERTING');
  if (nextPending) {
    triggerAlert(nextPending);
  }

  renderTimers();
}

function snoozeAlert(extraMinutes = 5) {
  const overlay = document.getElementById('alertOverlay');
  overlay.classList.add('hidden');
  document.title = 'Desk & Health Tracker';

  // Add 5 minutes from right now
  if (activeFiringTimer) {
    activeFiringTimer.status = 'RUNNING';
    activeFiringTimer.targetTimestamp = Date.now() + extraMinutes * 60 * 1000;
    saveTimers();
    activeFiringTimer = null;
  }

  const nextPending = timers.find((t) => t.status === 'ALERTING');
  if (nextPending) {
    triggerAlert(nextPending);
  }

  renderTimers();
}

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
      if (t.status === 'ALERTING') {
        el.textContent = 'DUE NOW';
        el.style.color = '#ef4444';
      } else {
        const diff = t.targetTimestamp - now;
        el.textContent = formatTimeLeft(diff);
        el.style.color = '';
      }
    }
  });
}

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
          <div class="card-actions-top">
            <button class="btn btn-secondary btn-small" onclick="openEditModal('${t.id}')">Edit</button>
            <button class="btn btn-danger btn-small" onclick="deleteTimer('${t.id}')">Delete</button>
          </div>
        </div>
        <div id="time-${t.id}" class="timer-remaining">--:--</div>
      </div>
      <div class="timer-footer">
        <span class="timer-meta">Interval: ${t.minutes} mins</span>
        <button class="btn btn-secondary btn-small" onclick="resetTimer('${t.id}')">Reset</button>
      </div>
    `;
    grid.appendChild(card);
  });
  updateCountdownDisplays();
}

window.resetTimer = function (id) {
  const t = timers.find((item) => item.id === id);
  if (t) {
    t.status = 'RUNNING';
    t.targetTimestamp = Date.now() + t.minutes * 60 * 1000;
    saveTimers();
    renderTimers();
  }
};

window.deleteTimer = function (id) {
  timers = timers.filter((item) => item.id !== id);
  if (activeFiringTimer && activeFiringTimer.id === id) {
    dismissAlert();
  }
  saveTimers();
  renderTimers();
};

window.openEditModal = function (id) {
  const t = timers.find((item) => item.id === id);
  if (!t) return;

  document.getElementById('editTimerId').value = t.id;
  document.getElementById('editTimerLabel').value = t.label;
  document.getElementById('editTimerMinutes').value = t.minutes;
  document.getElementById('editTimerColor').value = t.accent;
  document.getElementById('editModal').classList.remove('hidden');
};

function setupEventListeners() {
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
      active: true,
      status: 'RUNNING'
    });

    saveTimers();
    renderTimers();
    e.target.reset();
  });

  document.getElementById('editTimerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editTimerId').value;
    const label = document.getElementById('editTimerLabel').value.trim();
    const minutes = parseInt(document.getElementById('editTimerMinutes').value, 10);
    const accent = document.getElementById('editTimerColor').value;

    const t = timers.find((item) => item.id === id);
    if (t) {
      t.label = label;
      t.minutes = minutes;
      t.accent = accent;
      t.status = 'RUNNING';
      t.targetTimestamp = Date.now() + minutes * 60 * 1000;
      saveTimers();
      renderTimers();
    }
    document.getElementById('editModal').classList.add('hidden');
  });

  document.getElementById('closeEditModalBtn').addEventListener('click', () => {
    document.getElementById('editModal').classList.add('hidden');
  });

  document.getElementById('alertDismissBtn').addEventListener('click', dismissAlert);
  document.getElementById('alertSnoozeBtn').addEventListener('click', () => snoozeAlert(5));

  document.getElementById('enableNotifBtn').addEventListener('click', async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        alert('Alerts enabled! You will now receive system notifications on lock screen and background.');
      } else {
        alert('Notification permission was denied. Please allow it in browser settings.');
      }
    }
  });

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

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.log('SW registration error:', err));
  }
                                                                             }
