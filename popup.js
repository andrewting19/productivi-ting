// REJECT BRAINROT - Popup Logic

// Default settings
const DEFAULT_SETTINGS = {
  filterType: 'red',
  intensity: 'medium',
  sites: [
    'x.com',
    'twitter.com',
    'youtube.com',
    'instagram.com',
    'facebook.com',
    'tiktok.com',
    'reddit.com',
    'twitch.tv',
    'snapchat.com',
    'pinterest.com'
  ],
  enabled: true,
  pausedUntil: null
};

// Encouragement messages for the wait timer
const ENCOURAGEMENTS = [
  "Your future self will thank you for staying focused today.",
  "The average person spends 2.5 hours daily on social media. That's 38 days per year.",
  "Deep work requires deep focus. You're building that muscle right now.",
  "Dopamine from scrolling is borrowed happiness. Real satisfaction comes from accomplishment.",
  "Every minute you resist distraction is a minute invested in your goals.",
  "Studies show it takes 23 minutes to refocus after a distraction. Is it worth it?",
  "You're not missing out. The feed will always be there. Your time won't.",
  "Boredom is the birthplace of creativity. Embrace it.",
  "The urge to scroll will pass. Sit with it for a moment.",
  "What could you accomplish with an extra hour of focus today?",
  "Social media is designed to be addictive. You're taking back control.",
  "Small moments of discipline compound into life-changing results.",
  "Your attention is valuable. Spend it on what matters to you.",
  "This feeling of wanting to scroll? It's just your brain seeking easy dopamine.",
  "You've already come this far. Keep going."
];

// Typing prompts - positive affirmations
const TYPING_PROMPTS = [
  "I am in control of my attention and I choose to spend it wisely on things that matter to me.",
  "My focus is a superpower. I will not give it away to algorithms designed to exploit me.",
  "I do not need constant stimulation to be okay. I am comfortable with stillness.",
  "The work I do when focused is more valuable than hours of distracted effort.",
  "I am building the life I want, one focused moment at a time."
];

// State
let settings = { ...DEFAULT_SETTINGS };
let challengeState = {
  type: null, // 'break' or 'remove'
  duration: null,
  siteToRemove: null,
  mathAnswer: null,
  typingTarget: null,
  currentStep: 0
};

// DOM elements
const views = {
  settings: document.getElementById('settings-view'),
  challenge: document.getElementById('challenge-view'),
  removeChallenge: document.getElementById('remove-challenge-view')
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  renderSettings();
  setupEventListeners();
  checkPauseStatus();
});

// Load settings from storage
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('detoxSettings', (result) => {
      if (result.detoxSettings) {
        settings = { ...DEFAULT_SETTINGS, ...result.detoxSettings };
      }
      resolve();
    });
  });
}

// Save settings to storage
async function saveSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ detoxSettings: settings }, resolve);
  });
}

// Render settings UI
function renderSettings() {
  // Filter type buttons
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === settings.filterType);
  });

  // Intensity buttons
  document.querySelectorAll('[data-intensity]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.intensity === settings.intensity);
  });

  // Site list
  renderSiteList();

  // Status
  updateStatus();
}

// Render site list
function renderSiteList() {
  const list = document.getElementById('site-list');
  list.innerHTML = settings.sites.map(site => `
    <div class="site-item" data-site="${site}">
      <span>${site}</span>
      <button title="Remove site">×</button>
    </div>
  `).join('');
}

// Update status bar
function updateStatus() {
  const dot = document.querySelector('.status-dot');
  const text = document.getElementById('status-text');

  if (settings.pausedUntil) {
    const remaining = Math.max(0, settings.pausedUntil - Date.now());
    if (remaining > 0) {
      dot.className = 'status-dot paused';
      const mins = Math.ceil(remaining / 60000);
      text.textContent = `Paused (${mins} min left)`;
      return;
    } else {
      // Pause expired
      settings.pausedUntil = null;
      saveSettings();
    }
  }

  if (settings.enabled) {
    dot.className = 'status-dot active';
    text.textContent = 'Active';
  } else {
    dot.className = 'status-dot paused';
    text.textContent = 'Disabled for today';
  }
}

// Check if pause has expired
function checkPauseStatus() {
  if (settings.pausedUntil && Date.now() >= settings.pausedUntil) {
    settings.pausedUntil = null;
    settings.enabled = true;
    saveSettings();
  }
  updateStatus();
}

// Setup event listeners
function setupEventListeners() {
  // Filter type
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      settings.filterType = btn.dataset.filter;
      saveSettings();
      renderSettings();
      notifyContentScripts();
    });
  });

  // Intensity
  document.querySelectorAll('[data-intensity]').forEach(btn => {
    btn.addEventListener('click', () => {
      settings.intensity = btn.dataset.intensity;
      saveSettings();
      renderSettings();
      notifyContentScripts();
    });
  });

  // Add site
  document.getElementById('add-site-btn').addEventListener('click', addSite);
  document.getElementById('new-site').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSite();
  });

  // Remove site (delegated)
  document.getElementById('site-list').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      const site = e.target.closest('.site-item').dataset.site;
      startRemoveChallenge(site);
    }
  });

  // Break buttons
  document.querySelectorAll('.break-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const duration = btn.dataset.duration;
      startBreakChallenge(duration);
    });
  });

  // Challenge events
  document.getElementById('math-submit').addEventListener('click', checkMathAnswer);
  document.getElementById('math-answer').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkMathAnswer();
  });

  document.getElementById('typing-input').addEventListener('input', checkTyping);

  document.getElementById('challenge-cancel').addEventListener('click', () => showView('settings'));
  document.getElementById('confirm-break').addEventListener('click', confirmBreak);
  document.getElementById('cancel-break').addEventListener('click', () => showView('settings'));

  // Remove challenge events
  document.getElementById('remove-math-submit').addEventListener('click', checkRemoveMath);
  document.getElementById('remove-math-answer').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkRemoveMath();
  });
  document.getElementById('remove-cancel').addEventListener('click', () => showView('settings'));
}

// Add a new site
function addSite() {
  const input = document.getElementById('new-site');
  let site = input.value.trim().toLowerCase();

  // Clean up the URL
  site = site.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

  if (site && !settings.sites.includes(site)) {
    settings.sites.push(site);
    saveSettings();
    renderSiteList();
    notifyContentScripts();
  }

  input.value = '';
}

// Start break challenge
function startBreakChallenge(duration) {
  challengeState = {
    type: 'break',
    duration: duration,
    currentStep: 0,
    mathAnswer: generateMathProblem(),
    typingTarget: TYPING_PROMPTS[Math.floor(Math.random() * TYPING_PROMPTS.length)]
  };

  // Reset challenge UI
  document.getElementById('step-math').classList.remove('completed', 'hidden');
  document.getElementById('step-typing').classList.add('hidden');
  document.getElementById('step-typing').classList.remove('completed');
  document.getElementById('step-wait').classList.add('hidden');
  document.getElementById('step-wait').classList.remove('completed');
  document.getElementById('step-success').classList.add('hidden');

  document.getElementById('math-problem').textContent = challengeState.mathAnswer.question;
  document.getElementById('math-answer').value = '';
  document.getElementById('math-feedback').textContent = '';
  document.getElementById('math-feedback').className = 'feedback';

  document.getElementById('typing-prompt').textContent = challengeState.typingTarget;
  document.getElementById('typing-input').value = '';
  document.getElementById('typing-input').className = '';
  document.getElementById('typing-feedback').textContent = '';

  const introText = duration === 'end'
    ? 'Complete these steps to disable for today.'
    : 'Complete these steps to take a 5 minute break.';
  document.getElementById('challenge-intro').textContent = introText;

  showView('challenge');
}

// Generate a math problem (doable in head but requires thought)
function generateMathProblem() {
  const types = ['multiply', 'add-subtract', 'percentage'];
  const type = types[Math.floor(Math.random() * types.length)];

  let question, answer;

  switch (type) {
    case 'multiply':
      // Two 2-digit numbers, but not too hard
      const a = Math.floor(Math.random() * 20) + 12; // 12-31
      const b = Math.floor(Math.random() * 9) + 3;   // 3-11
      question = `${a} × ${b} = ?`;
      answer = a * b;
      break;

    case 'add-subtract':
      // Chain of additions/subtractions
      const n1 = Math.floor(Math.random() * 50) + 50;  // 50-99
      const n2 = Math.floor(Math.random() * 30) + 10;  // 10-39
      const n3 = Math.floor(Math.random() * 20) + 5;   // 5-24
      question = `${n1} + ${n2} - ${n3} = ?`;
      answer = n1 + n2 - n3;
      break;

    case 'percentage':
      // Simple percentage
      const percent = [10, 15, 20, 25][Math.floor(Math.random() * 4)];
      const base = Math.floor(Math.random() * 10) * 20 + 40; // 40, 60, 80, ... 220
      question = `${percent}% of ${base} = ?`;
      answer = (percent / 100) * base;
      break;
  }

  return { question, answer };
}

// Check math answer
function checkMathAnswer() {
  const input = document.getElementById('math-answer');
  const feedback = document.getElementById('math-feedback');
  const userAnswer = parseFloat(input.value);

  if (userAnswer === challengeState.mathAnswer.answer) {
    feedback.textContent = 'Correct!';
    feedback.className = 'feedback success';
    document.getElementById('step-math').classList.add('completed');

    // Move to typing step
    setTimeout(() => {
      document.getElementById('step-typing').classList.remove('hidden');
      document.getElementById('typing-input').focus();
    }, 500);
  } else {
    feedback.textContent = 'Not quite. Try again!';
    feedback.className = 'feedback error';
    input.value = '';
    input.focus();
  }
}

// Check typing
function checkTyping() {
  const input = document.getElementById('typing-input');
  const feedback = document.getElementById('typing-feedback');
  const target = challengeState.typingTarget;
  const typed = input.value;

  // Check if what's typed so far matches
  if (target.startsWith(typed)) {
    input.classList.remove('has-error');

    if (typed === target) {
      // Complete!
      input.classList.add('correct');
      feedback.textContent = 'Perfect!';
      feedback.className = 'feedback success';
      document.getElementById('step-typing').classList.add('completed');

      // Move to wait step
      setTimeout(() => {
        document.getElementById('step-wait').classList.remove('hidden');
        startWaitTimer();
      }, 500);
    } else {
      feedback.textContent = `${typed.length}/${target.length} characters`;
      feedback.className = 'feedback';
    }
  } else {
    // Error - find where it went wrong
    input.classList.add('has-error');
    input.classList.remove('correct');

    let errorPos = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] !== target[i]) {
        errorPos = i;
        break;
      }
    }

    feedback.textContent = `Error at position ${errorPos + 1}. Check your typing.`;
    feedback.className = 'feedback error';
  }
}

// Start wait timer
function startWaitTimer() {
  let seconds = 15;
  const countEl = document.getElementById('timer-count');
  const encourageEl = document.getElementById('encouragement');

  // Show first encouragement
  encourageEl.textContent = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];

  const interval = setInterval(() => {
    seconds--;
    countEl.textContent = seconds;

    // Change encouragement every 5 seconds
    if (seconds % 5 === 0 && seconds > 0) {
      encourageEl.textContent = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    }

    if (seconds <= 0) {
      clearInterval(interval);
      document.getElementById('step-wait').classList.add('completed');

      // Show success
      const successMsg = challengeState.duration === 'end'
        ? 'You can now disable the extension for the rest of today.'
        : 'You can now take a 5 minute break. Use it wisely!';
      document.getElementById('success-message').textContent = successMsg;
      document.getElementById('step-success').classList.remove('hidden');
    }
  }, 1000);
}

// Confirm break
function confirmBreak() {
  if (challengeState.duration === 'end') {
    // Disable for today (until midnight)
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    settings.pausedUntil = midnight.getTime();
    settings.enabled = false;
  } else {
    // 5 minute break
    settings.pausedUntil = Date.now() + (5 * 60 * 1000);
  }

  saveSettings();
  notifyContentScripts();
  showView('settings');
  renderSettings();
}

// Start remove site challenge
function startRemoveChallenge(site) {
  challengeState = {
    type: 'remove',
    siteToRemove: site,
    mathAnswer: generateMathProblem()
  };

  document.getElementById('site-to-remove').textContent = site;
  document.getElementById('remove-math-problem').textContent = challengeState.mathAnswer.question;
  document.getElementById('remove-math-answer').value = '';
  document.getElementById('remove-feedback').textContent = '';
  document.getElementById('remove-feedback').className = 'feedback';

  showView('removeChallenge');
}

// Check remove math answer
function checkRemoveMath() {
  const input = document.getElementById('remove-math-answer');
  const feedback = document.getElementById('remove-feedback');
  const userAnswer = parseFloat(input.value);

  if (userAnswer === challengeState.mathAnswer.answer) {
    // Remove the site
    settings.sites = settings.sites.filter(s => s !== challengeState.siteToRemove);
    saveSettings();
    notifyContentScripts();
    showView('settings');
    renderSiteList();
  } else {
    feedback.textContent = 'Incorrect. Try again!';
    feedback.className = 'feedback error';
    input.value = '';
    input.focus();
  }
}

// Show a view
function showView(view) {
  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[view].classList.remove('hidden');
}

// Notify content scripts of settings change
function notifyContentScripts() {
  chrome.runtime.sendMessage({ type: 'settingsChanged', settings });
}
