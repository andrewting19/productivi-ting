// REJECT BRAINROT - Side Panel Logic

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

// Intensity descriptions
const INTENSITY_HINTS = {
  low: 'Subtle filter, mostly visible',
  medium: 'Moderate filter with reduced brightness',
  high: 'Maximum filter, very dim and unpleasant'
};

// Encouragement messages for the wait timer (30 total)
const ENCOURAGEMENTS = [
  "You installed this extension for a reason. Remember what it was.",
  "Nothing on that site has changed in the last 30 seconds.",
  "The scroll you're craving will feel empty 10 seconds after you do it.",
  "You've seen this exact dopamine loop a thousand times. You know how it ends.",
  "That thing you've been putting off? This is a good time for it.",
  "The content isn't going anywhere. It'll be just as mediocre later.",
  "You don't actually want to scroll. You want to avoid something else.",
  "This restless feeling is temporary. Giving in makes it come back stronger.",
  "Most of what you'd see isn't even good. You know this.",
  "30 seconds of discomfort vs. an hour you won't get back.",
  "The algorithm is testing how cheaply it can buy your time.",
  "You're not missing anything. It's the same takes as yesterday.",
  "This is just a craving. You don't have to act on cravings.",
  "How many times have you scrolled for 'just a minute'?",
  "The thing you'd see first wouldn't even be interesting.",
  "Your brain is throwing a small tantrum. It'll pass.",
  "Every app on that site wants you to stay forever. That's the whole business model.",
  "You're experiencing a trained response. You can untrain it.",
  "What were you actually trying to do before you wanted to check?",
  "Boredom isn't an emergency. It's just a feeling.",
  "The people posting are also procrastinating.",
  "You could just... go back to what you were doing.",
  "That itch to check isn't information. It's habit.",
  "The feed is designed to feel urgent. Nothing on it is.",
  "You've already seen the best posts. Now it's just the algorithm scraping the barrel.",
  "This discomfort is what breaking a habit feels like.",
  "The notifications will still be there. They always are.",
  "You're 30 seconds away from not caring that you didn't check.",
  "Imagine explaining what you were about to spend an hour doing.",
  "The only prize for checking is wanting to check again sooner."
];

// Typing prompts - confrontational affirmations (20 total)
const TYPING_PROMPTS = [
  "I am about to mass-consume content that I will not remember in an hour, and I am admitting that out loud.",
  "I was about to scroll through the same recycled content I have already seen a hundred times before.",
  "I do not need constant stimulation to be okay. I am comfortable with stillness.",
  "I am choosing to rot my brain with low-effort content instead of doing literally anything else.",
  "The next ten posts I would see are not going to improve my life in any measurable way.",
  "Every time I resist distraction, I strengthen my ability to choose what deserves my attention.",
  "I am more than a consumer of content. I am a creator of my own life and my own meaning.",
  "The discomfort I feel right now is my brain healing from overstimulation. I welcome it.",
  "I am voluntarily feeding my mind to an algorithm that sees me as a product to monetize.",
  "I was about to spend an hour watching strangers perform for my attention, and that is a choice I am making.",
  "I will not let an app dictate how I spend my most precious and irreplaceable resource: time.",
  "The content I crave is designed to be forgotten immediately so I will crave more of it.",
  "I am practicing the skill of being bored, and it is making me more creative and more free.",
  "I am aware that I am addicted to novelty and that this addiction is being deliberately exploited.",
  "I am reclaiming my mind from those who profit from my distraction and my anxiety.",
  "Peace comes from presence, not from the next post, video, or notification.",
  "I trust myself to handle missing out. Nothing in this feed is more important than my real life.",
  "My attention is not a product to be harvested and sold. Today, I take it back.",
  "I am choosing temporary discomfort now over the long-term regret of wasted time.",
  "The person I want to become does not spend hours scrolling. I am becoming that person right now."
];

// State
let settings = { ...DEFAULT_SETTINGS };
let challengeState = {
  type: null,
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

  // Periodic check for pause expiry
  setInterval(checkPauseStatus, 10000);
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

  // Update intensity hint
  document.getElementById('intensity-hint').textContent = INTENSITY_HINTS[settings.intensity];

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
  const endBreakBtn = document.getElementById('end-break-btn');

  // Check if paused
  const isPaused = settings.pausedUntil && Date.now() < settings.pausedUntil;
  const isDisabledForDay = !settings.enabled;

  if (isPaused) {
    const remaining = Math.max(0, settings.pausedUntil - Date.now());
    dot.className = 'status-dot paused';
    const mins = Math.ceil(remaining / 60000);
    text.textContent = `Paused (${mins} min left)`;
    endBreakBtn.classList.remove('hidden');
    return;
  } else if (settings.pausedUntil && Date.now() >= settings.pausedUntil) {
    // Pause expired
    settings.pausedUntil = null;
    settings.enabled = true;
    saveSettings();
  }

  if (isDisabledForDay) {
    dot.className = 'status-dot paused';
    text.textContent = 'Disabled for today';
    endBreakBtn.classList.remove('hidden');
  } else {
    dot.className = 'status-dot active';
    text.textContent = 'Active';
    endBreakBtn.classList.add('hidden');
  }
}

// Check if pause has expired
function checkPauseStatus() {
  if (settings.pausedUntil && Date.now() >= settings.pausedUntil) {
    settings.pausedUntil = null;
    settings.enabled = true;
    saveSettings();
    notifyContentScripts();
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

  // End break early button
  document.getElementById('end-break-btn').addEventListener('click', endBreakEarly);

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

  // Reset UI
  resetChallengeUI();

  document.getElementById('math-problem').textContent = challengeState.mathAnswer.question;
  document.getElementById('typing-prompt').textContent = challengeState.typingTarget;

  const introText = duration === 'end'
    ? 'Complete these steps to disable for today.'
    : 'Complete these steps to take a 5 minute break.';
  document.getElementById('challenge-intro').textContent = introText;

  // Update progress
  updateProgress(1);

  showView('challenge');
  document.getElementById('math-answer').focus();
}

// Reset challenge UI
function resetChallengeUI() {
  document.getElementById('step-math').classList.remove('hidden');
  document.getElementById('step-typing').classList.add('hidden');
  document.getElementById('step-wait').classList.add('hidden');
  document.getElementById('step-success').classList.add('hidden');

  document.getElementById('math-answer').value = '';
  document.getElementById('math-feedback').textContent = '';
  document.getElementById('math-feedback').className = 'feedback';

  document.getElementById('typing-input').value = '';
  document.getElementById('typing-input').className = '';
  document.getElementById('typing-feedback').textContent = '';

  document.getElementById('timer-count').textContent = '30';
  document.getElementById('timer-progress').style.strokeDashoffset = '0';

  // Reset progress indicators
  ['prog-math', 'prog-typing', 'prog-wait'].forEach(id => {
    document.getElementById(id).className = 'progress-step';
  });
}

// Update progress bar
function updateProgress(step) {
  const steps = ['prog-math', 'prog-typing', 'prog-wait'];
  steps.forEach((id, i) => {
    const el = document.getElementById(id);
    if (i + 1 < step) {
      el.className = 'progress-step completed';
    } else if (i + 1 === step) {
      el.className = 'progress-step active';
    } else {
      el.className = 'progress-step';
    }
  });
}

// Generate a math problem (6 types)
function generateMathProblem() {
  const types = ['multiply', 'add-subtract', 'percentage', 'division', 'square', 'order-of-ops'];
  const type = types[Math.floor(Math.random() * types.length)];

  let question, answer;

  switch (type) {
    case 'multiply':
      // Two numbers: 12-31 × 3-11
      const a = Math.floor(Math.random() * 20) + 12;
      const b = Math.floor(Math.random() * 9) + 3;
      question = `${a} × ${b} = ?`;
      answer = a * b;
      break;

    case 'add-subtract':
      // Chain: 50-99 + 10-39 - 5-24
      const n1 = Math.floor(Math.random() * 50) + 50;
      const n2 = Math.floor(Math.random() * 30) + 10;
      const n3 = Math.floor(Math.random() * 20) + 5;
      question = `${n1} + ${n2} − ${n3} = ?`;
      answer = n1 + n2 - n3;
      break;

    case 'percentage':
      // Simple percentages of round numbers
      const percent = [10, 15, 20, 25, 30, 50][Math.floor(Math.random() * 6)];
      const base = Math.floor(Math.random() * 10) * 20 + 40;
      question = `${percent}% of ${base} = ?`;
      answer = (percent / 100) * base;
      break;

    case 'division':
      // Division with clean results: generate answer first, then multiply
      const divisor = Math.floor(Math.random() * 10) + 3; // 3-12
      const quotient = Math.floor(Math.random() * 15) + 5; // 5-19
      const dividend = divisor * quotient;
      question = `${dividend} ÷ ${divisor} = ?`;
      answer = quotient;
      break;

    case 'square':
      // Squares of 11-19 (requires mental math skill)
      const sqNum = Math.floor(Math.random() * 9) + 11;
      question = `${sqNum}² = ?`;
      answer = sqNum * sqNum;
      break;

    case 'order-of-ops':
      // (a + b) × c or a × b + c patterns
      const x = Math.floor(Math.random() * 10) + 5;  // 5-14
      const y = Math.floor(Math.random() * 10) + 3;  // 3-12
      const z = Math.floor(Math.random() * 6) + 2;   // 2-7
      if (Math.random() < 0.5) {
        question = `(${x} + ${y}) × ${z} = ?`;
        answer = (x + y) * z;
      } else {
        question = `${z} × ${x} + ${y} = ?`;
        answer = z * x + y;
      }
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

    setTimeout(() => {
      document.getElementById('step-math').classList.add('hidden');
      document.getElementById('step-typing').classList.remove('hidden');
      updateProgress(2);
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

  if (target.startsWith(typed)) {
    input.classList.remove('has-error');

    if (typed === target) {
      input.classList.add('correct');
      feedback.textContent = 'Perfect!';
      feedback.className = 'feedback success';

      setTimeout(() => {
        document.getElementById('step-typing').classList.add('hidden');
        document.getElementById('step-wait').classList.remove('hidden');
        updateProgress(3);
        startWaitTimer();
      }, 500);
    } else {
      feedback.textContent = `${typed.length}/${target.length} characters`;
      feedback.className = 'feedback';
    }
  } else {
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

// Start wait timer with ring animation
function startWaitTimer() {
  const TOTAL_SECONDS = 30;
  let seconds = TOTAL_SECONDS;
  const countEl = document.getElementById('timer-count');
  const progressEl = document.getElementById('timer-progress');
  const encourageEl = document.getElementById('encouragement');
  const circumference = 283; // 2 * PI * 45

  encourageEl.textContent = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];

  const interval = setInterval(() => {
    seconds--;
    countEl.textContent = seconds;

    // Update ring progress
    const offset = circumference * (1 - seconds / TOTAL_SECONDS);
    progressEl.style.strokeDashoffset = offset;

    // Change encouragement every 6 seconds (5 messages over 30 seconds)
    if (seconds % 6 === 0 && seconds > 0) {
      encourageEl.textContent = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    }

    if (seconds <= 0) {
      clearInterval(interval);

      const successMsg = challengeState.duration === 'end'
        ? 'You can now disable the extension for the rest of today.'
        : 'You can now take a 5 minute break. Use it wisely!';
      document.getElementById('success-message').textContent = successMsg;

      document.getElementById('step-wait').classList.add('hidden');
      document.getElementById('step-success').classList.remove('hidden');
    }
  }, 1000);
}

// Confirm break
function confirmBreak() {
  if (challengeState.duration === 'end') {
    // Disable until 4am (for night owls)
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(4, 0, 0, 0);
    // If it's already past 4am, set to 4am tomorrow
    if (now.getHours() >= 4) {
      nextReset.setDate(nextReset.getDate() + 1);
    }
    settings.pausedUntil = nextReset.getTime();
    settings.enabled = false;
  } else {
    settings.pausedUntil = Date.now() + (5 * 60 * 1000);
  }

  saveSettings();
  notifyContentScripts();
  showView('settings');
  renderSettings();
}

// End break early - re-enable the extension
function endBreakEarly() {
  settings.pausedUntil = null;
  settings.enabled = true;
  saveSettings();
  notifyContentScripts();
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
  document.getElementById('remove-math-answer').focus();
}

// Check remove math answer
function checkRemoveMath() {
  const input = document.getElementById('remove-math-answer');
  const feedback = document.getElementById('remove-feedback');
  const userAnswer = parseFloat(input.value);

  if (userAnswer === challengeState.mathAnswer.answer) {
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
