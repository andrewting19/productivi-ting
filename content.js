// REJECT BRAINROT - Content Script
// Applies visual filter, blocks video autoplay, and shows intentionality overlay

(function() {
  'use strict';

  // Filter configurations
  const FILTERS = {
    red: {
      low: 'sepia(80%) saturate(200%) hue-rotate(-20deg) brightness(0.95) contrast(0.95)',
      medium: 'sepia(100%) saturate(300%) hue-rotate(-30deg) brightness(0.8) contrast(0.85)',
      high: 'sepia(100%) saturate(400%) hue-rotate(-40deg) brightness(0.6) contrast(0.75)'
    },
    grayscale: {
      low: 'grayscale(70%) brightness(0.95)',
      medium: 'grayscale(100%) brightness(0.85) contrast(0.9)',
      high: 'grayscale(100%) brightness(0.6) contrast(0.8)'
    }
  };

  // Encouragement messages for the intentionality wait timer
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
    "20 seconds of discomfort vs. an hour you won't get back.",
    "The algorithm is testing how cheaply it can buy your time.",
    "You're not missing anything. It's the same takes as yesterday.",
    "This is just a craving. You don't have to act on cravings.",
    "How many times have you scrolled for 'just a minute'?",
    "The thing you'd see first wouldn't even be interesting.",
    "Your brain is throwing a small tantrum. It'll pass.",
    "Every app on that site wants you to stay forever. That's the whole business model.",
    "You're experiencing a trained response. You can untrain it.",
    "What were you actually trying to do before you wanted to check?",
    "Boredom isn't an emergency. It's just a feeling."
  ];

  // Default settings
  const DEFAULT_SETTINGS = {
    filterType: 'red',
    intensity: 'medium',
    sites: [
      'x.com', 'twitter.com', 'youtube.com', 'instagram.com',
      'facebook.com', 'tiktok.com', 'reddit.com', 'twitch.tv',
      'snapchat.com', 'pinterest.com'
    ],
    enabled: true,
    pausedUntil: null,
    scheduleEnabled: true,
    scheduleStart: 4,
    scheduleEnd: 21,
    intentionalitySites: ['x.com', 'twitter.com', 'youtube.com']
  };

  let settings = { ...DEFAULT_SETTINGS };
  let isBlockedSite = false;
  let filterActive = false;
  let intentionalityShown = false;
  let intentionalityPassed = false;

  // Track videos user has manually interacted with (solved math problem)
  const userAllowedVideos = new WeakSet();

  // Track specific videos user has recently clicked on (for click-to-play detection)
  // This is video-specific, not global, to avoid false positives from unrelated clicks
  const recentlyInteractedVideos = new WeakSet();
  const interactionTimeouts = new WeakMap();

  // Pending video waiting to be unlocked via math challenge
  let pendingVideo = null;
  let currentMathAnswer = null;

  // Generate a math problem (copied from sidepanel.js)
  function generateMathProblem() {
    const types = ['multiply', 'add-subtract', 'percentage', 'division', 'square', 'order-of-ops'];
    const type = types[Math.floor(Math.random() * types.length)];

    let question, answer;

    switch (type) {
      case 'multiply':
        const a = Math.floor(Math.random() * 20) + 12;
        const b = Math.floor(Math.random() * 9) + 3;
        question = `${a} × ${b} = ?`;
        answer = a * b;
        break;

      case 'add-subtract':
        const n1 = Math.floor(Math.random() * 50) + 50;
        const n2 = Math.floor(Math.random() * 30) + 10;
        const n3 = Math.floor(Math.random() * 20) + 5;
        question = `${n1} + ${n2} − ${n3} = ?`;
        answer = n1 + n2 - n3;
        break;

      case 'percentage':
        const percent = [10, 15, 20, 25, 30, 50][Math.floor(Math.random() * 6)];
        const base = Math.floor(Math.random() * 10) * 20 + 40;
        question = `${percent}% of ${base} = ?`;
        answer = (percent / 100) * base;
        break;

      case 'division':
        const divisor = Math.floor(Math.random() * 10) + 3;
        const quotient = Math.floor(Math.random() * 15) + 5;
        const dividend = divisor * quotient;
        question = `${dividend} ÷ ${divisor} = ?`;
        answer = quotient;
        break;

      case 'square':
        const sqNum = Math.floor(Math.random() * 9) + 11;
        question = `${sqNum}² = ?`;
        answer = sqNum * sqNum;
        break;

      case 'order-of-ops':
        const x = Math.floor(Math.random() * 10) + 5;
        const y = Math.floor(Math.random() * 10) + 3;
        const z = Math.floor(Math.random() * 6) + 2;
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

  // Create and inject the modal styles
  function injectModalStyles() {
    if (document.getElementById('detox-modal-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'detox-modal-styles';
    styles.textContent = `
      #detox-video-modal-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0, 0, 0, 0.85) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      #detox-video-modal {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%) !important;
        border-radius: 16px !important;
        padding: 32px !important;
        max-width: 400px !important;
        width: 90% !important;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        text-align: center !important;
        animation: detoxModalSlideIn 0.3s ease !important;
      }

      @keyframes detoxModalSlideIn {
        from {
          opacity: 0;
          transform: scale(0.9) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      #detox-video-modal h2 {
        color: #fff !important;
        font-size: 20px !important;
        font-weight: 600 !important;
        margin: 0 0 8px 0 !important;
      }

      #detox-video-modal p {
        color: rgba(255, 255, 255, 0.7) !important;
        font-size: 14px !important;
        margin: 0 0 24px 0 !important;
        line-height: 1.5 !important;
      }

      #detox-math-question {
        background: rgba(255, 255, 255, 0.1) !important;
        border-radius: 12px !important;
        padding: 20px !important;
        margin-bottom: 20px !important;
      }

      #detox-math-question span {
        color: #fff !important;
        font-size: 28px !important;
        font-weight: 700 !important;
        font-family: 'SF Mono', Monaco, monospace !important;
      }

      #detox-math-input {
        width: 100% !important;
        padding: 14px 16px !important;
        font-size: 18px !important;
        border: 2px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 10px !important;
        background: rgba(255, 255, 255, 0.05) !important;
        color: #fff !important;
        text-align: center !important;
        outline: none !important;
        box-sizing: border-box !important;
        transition: border-color 0.2s !important;
      }

      #detox-math-input:focus {
        border-color: #667eea !important;
      }

      #detox-math-input::placeholder {
        color: rgba(255, 255, 255, 0.4) !important;
      }

      #detox-modal-feedback {
        min-height: 24px !important;
        margin: 12px 0 !important;
        font-size: 14px !important;
        font-weight: 500 !important;
      }

      #detox-modal-feedback.error {
        color: #f87171 !important;
      }

      #detox-modal-feedback.success {
        color: #4ade80 !important;
      }

      #detox-modal-buttons {
        display: flex !important;
        gap: 12px !important;
        margin-top: 20px !important;
      }

      #detox-modal-buttons button {
        flex: 1 !important;
        padding: 12px 20px !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        border-radius: 10px !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        border: none !important;
      }

      #detox-submit-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: #fff !important;
      }

      #detox-submit-btn:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
      }

      #detox-cancel-btn {
        background: rgba(255, 255, 255, 0.1) !important;
        color: rgba(255, 255, 255, 0.8) !important;
      }

      #detox-cancel-btn:hover {
        background: rgba(255, 255, 255, 0.15) !important;
      }
    `;
    document.head.appendChild(styles);
  }

  // Callback to run when modal is solved successfully
  let onModalSuccess = null;

  // Show the math challenge modal
  function showVideoModal(video, onSuccess) {
    // Don't show multiple modals
    if (document.getElementById('detox-video-modal-overlay')) {
      return;
    }

    onModalSuccess = onSuccess;

    try {
      injectModalStyles();

      const problem = generateMathProblem();
      currentMathAnswer = problem.answer;

      const overlay = document.createElement('div');
      overlay.id = 'detox-video-modal-overlay';
      overlay.innerHTML = `
        <div id="detox-video-modal">
          <h2>Want to watch this video?</h2>
          <p>Solve this quick math problem to unlock it.<br>This helps break the autopilot scrolling habit.</p>
          <div id="detox-math-question">
            <span>${problem.question}</span>
          </div>
          <input type="text" id="detox-math-input" placeholder="Your answer" autocomplete="off">
          <div id="detox-modal-feedback"></div>
          <div id="detox-modal-buttons">
            <button id="detox-cancel-btn">Cancel</button>
            <button id="detox-submit-btn">Unlock</button>
          </div>
        </div>
      `;

      // Click on overlay (outside modal) = cancel
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(false);
        }
      });

      document.body.appendChild(overlay);

      const input = document.getElementById('detox-math-input');
      const submitBtn = document.getElementById('detox-submit-btn');
      const cancelBtn = document.getElementById('detox-cancel-btn');
      const feedback = document.getElementById('detox-modal-feedback');

      // Focus input
      setTimeout(() => input.focus(), 100);

      // Submit handler
      const handleSubmit = () => {
        const userAnswer = parseFloat(input.value);
        if (userAnswer === currentMathAnswer) {
          feedback.textContent = 'Correct!';
          feedback.className = 'success';
          setTimeout(() => closeModal(true), 400);
        } else {
          feedback.textContent = 'Incorrect, try again!';
          feedback.className = 'error';
          input.value = '';
          input.focus();
        }
      };

      submitBtn.addEventListener('click', handleSubmit);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSubmit();
      });

      cancelBtn.addEventListener('click', () => closeModal(false));

    } catch (err) {
      console.error('[REJECT BRAINROT] Error showing modal:', err);
    }
  }

  // Close the modal
  function closeModal(success) {
    const overlay = document.getElementById('detox-video-modal-overlay');
    if (overlay) {
      overlay.remove();
    }

    if (success && pendingVideo) {
      userAllowedVideos.add(pendingVideo);

      if (onModalSuccess) {
        onModalSuccess();
      }
    }

    pendingVideo = null;
    currentMathAnswer = null;
    onModalSuccess = null;
  }

  // Check if current site requires intentionality check
  function requiresIntentionality() {
    const host = getCurrentHost();
    const intentionalitySites = settings.intentionalitySites || [];
    return intentionalitySites.some(site => {
      const normalizedSite = site.replace(/^www\./, '');
      return host === normalizedSite || host.endsWith('.' + normalizedSite);
    });
  }

  // Inject intentionality overlay styles
  function injectIntentionalityStyles() {
    if (document.getElementById('detox-intentionality-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'detox-intentionality-styles';
    styles.textContent = `
      #detox-intentionality-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      #detox-intentionality-container {
        max-width: 500px !important;
        width: 90% !important;
        padding: 40px !important;
        text-align: center !important;
      }

      #detox-intentionality-container h1 {
        color: #fff !important;
        font-size: 28px !important;
        font-weight: 700 !important;
        margin: 0 0 8px 0 !important;
      }

      #detox-intentionality-container .site-name {
        color: #667eea !important;
        font-size: 18px !important;
        margin-bottom: 32px !important;
      }

      #detox-intentionality-container .form-section {
        margin-bottom: 24px !important;
        text-align: left !important;
      }

      #detox-intentionality-container label {
        display: block !important;
        color: rgba(255, 255, 255, 0.7) !important;
        font-size: 14px !important;
        margin-bottom: 8px !important;
      }

      #detox-intentionality-container textarea,
      #detox-intentionality-container input {
        width: 100% !important;
        padding: 14px 16px !important;
        font-size: 16px !important;
        border: 2px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 10px !important;
        background: rgba(255, 255, 255, 0.05) !important;
        color: #fff !important;
        outline: none !important;
        box-sizing: border-box !important;
        transition: border-color 0.2s !important;
      }

      #detox-intentionality-container textarea {
        height: 80px !important;
        resize: none !important;
      }

      #detox-intentionality-container textarea:focus,
      #detox-intentionality-container input:focus {
        border-color: #667eea !important;
      }

      #detox-intentionality-container textarea::placeholder,
      #detox-intentionality-container input::placeholder {
        color: rgba(255, 255, 255, 0.3) !important;
      }

      #detox-intentionality-container .time-hint {
        color: rgba(255, 255, 255, 0.4) !important;
        font-size: 12px !important;
        margin-top: 6px !important;
      }

      #detox-intentionality-container .wait-section {
        margin: 32px 0 !important;
      }

      #detox-intentionality-container .timer-ring-container {
        position: relative !important;
        width: 120px !important;
        height: 120px !important;
        margin: 0 auto 20px !important;
      }

      #detox-intentionality-container .timer-ring {
        width: 100% !important;
        height: 100% !important;
        transform: rotate(-90deg) !important;
      }

      #detox-intentionality-container .timer-ring-bg {
        fill: none !important;
        stroke: rgba(255, 255, 255, 0.1) !important;
        stroke-width: 6 !important;
      }

      #detox-intentionality-container .timer-ring-progress {
        fill: none !important;
        stroke: #667eea !important;
        stroke-width: 6 !important;
        stroke-linecap: round !important;
        stroke-dasharray: 283 !important;
        stroke-dashoffset: 0 !important;
        transition: stroke-dashoffset 1s linear !important;
      }

      #detox-intentionality-container .timer-text {
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        text-align: center !important;
      }

      #detox-intentionality-container .timer-count {
        font-size: 32px !important;
        font-weight: 700 !important;
        color: #fff !important;
        display: block !important;
      }

      #detox-intentionality-container .timer-label {
        font-size: 11px !important;
        color: rgba(255, 255, 255, 0.5) !important;
      }

      #detox-intentionality-container .encouragement {
        color: rgba(255, 255, 255, 0.8) !important;
        font-size: 15px !important;
        line-height: 1.6 !important;
        padding: 16px !important;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)) !important;
        border-radius: 12px !important;
        min-height: 60px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      #detox-intentionality-container .button-group {
        display: flex !important;
        gap: 12px !important;
        margin-top: 24px !important;
      }

      #detox-intentionality-container button {
        flex: 1 !important;
        padding: 14px 24px !important;
        font-size: 15px !important;
        font-weight: 600 !important;
        border-radius: 10px !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        border: none !important;
      }

      #detox-intentionality-container .enter-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: #fff !important;
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }

      #detox-intentionality-container .enter-btn.ready {
        opacity: 1 !important;
        cursor: pointer !important;
      }

      #detox-intentionality-container .enter-btn.ready:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4) !important;
      }

      #detox-intentionality-container .quit-btn {
        background: rgba(255, 255, 255, 0.1) !important;
        color: rgba(255, 255, 255, 0.8) !important;
      }

      #detox-intentionality-container .quit-btn:hover {
        background: rgba(239, 68, 68, 0.2) !important;
        color: #f87171 !important;
      }

      #detox-intentionality-container .form-hidden {
        display: none !important;
      }
    `;
    document.head.appendChild(styles);
  }

  // Show intentionality overlay
  function showIntentionalityOverlay() {
    if (intentionalityShown || document.getElementById('detox-intentionality-overlay')) {
      return;
    }

    intentionalityShown = true;
    injectIntentionalityStyles();

    const host = getCurrentHost();
    const overlay = document.createElement('div');
    overlay.id = 'detox-intentionality-overlay';
    overlay.innerHTML = `
      <div id="detox-intentionality-container">
        <h1>Before you enter...</h1>
        <div class="site-name">${host}</div>

        <div id="intentionality-form">
          <div class="form-section">
            <label for="detox-reason">Why are you opening this site?</label>
            <textarea id="detox-reason" placeholder="Be honest with yourself..."></textarea>
          </div>

          <div class="form-section">
            <label for="detox-duration">How many minutes do you intend to spend?</label>
            <input type="number" id="detox-duration" placeholder="e.g., 10" min="1" max="120">
            <div class="time-hint">The tab will automatically close after this time.</div>
          </div>
        </div>

        <div id="intentionality-wait" class="wait-section form-hidden">
          <div class="timer-ring-container">
            <svg class="timer-ring" viewBox="0 0 100 100">
              <circle class="timer-ring-bg" cx="50" cy="50" r="45"/>
              <circle class="timer-ring-progress" id="intentionality-progress" cx="50" cy="50" r="45"/>
            </svg>
            <div class="timer-text">
              <span class="timer-count" id="intentionality-count">20</span>
              <span class="timer-label">seconds</span>
            </div>
          </div>
          <div class="encouragement" id="intentionality-encouragement"></div>
        </div>

        <div class="button-group">
          <button class="quit-btn" id="intentionality-quit">Quit</button>
          <button class="enter-btn" id="intentionality-enter">Continue</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Prevent scrolling
    document.body.style.overflow = 'hidden';

    const reasonInput = document.getElementById('detox-reason');
    const durationInput = document.getElementById('detox-duration');
    const enterBtn = document.getElementById('intentionality-enter');
    const quitBtn = document.getElementById('intentionality-quit');
    const formSection = document.getElementById('intentionality-form');
    const waitSection = document.getElementById('intentionality-wait');

    let waitStarted = false;
    let waitComplete = false;
    let submittedReason = '';
    let submittedDuration = 0;

    // Check form validity
    const checkFormValidity = () => {
      const reason = reasonInput.value.trim();
      const duration = parseInt(durationInput.value);
      const isValid = reason.length > 0 && duration > 0 && duration <= 120;

      if (isValid && !waitStarted) {
        enterBtn.classList.add('ready');
        enterBtn.textContent = 'Continue';
      } else if (!waitComplete) {
        enterBtn.classList.remove('ready');
      }
    };

    reasonInput.addEventListener('input', checkFormValidity);
    durationInput.addEventListener('input', checkFormValidity);

    // Handle continue button
    enterBtn.addEventListener('click', () => {
      const reason = reasonInput.value.trim();
      const duration = parseInt(durationInput.value);

      if (!waitStarted && reason.length > 0 && duration > 0 && duration <= 120) {
        // Start wait timer
        submittedReason = reason;
        submittedDuration = duration;
        waitStarted = true;

        formSection.classList.add('form-hidden');
        waitSection.classList.remove('form-hidden');
        enterBtn.classList.remove('ready');
        enterBtn.textContent = 'Wait...';

        startIntentionalityTimer(() => {
          waitComplete = true;
          enterBtn.classList.add('ready');
          enterBtn.textContent = 'Enter Site';
        });
      } else if (waitComplete) {
        // Start session and allow entry
        completeIntentionality(submittedReason, submittedDuration);
      }
    });

    // Handle quit button
    quitBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'closeTab' });
    });

    // Focus on reason input
    setTimeout(() => reasonInput.focus(), 100);
  }

  // Start the 20 second wait timer
  function startIntentionalityTimer(onComplete) {
    const TOTAL_SECONDS = 20;
    let seconds = TOTAL_SECONDS;
    const countEl = document.getElementById('intentionality-count');
    const progressEl = document.getElementById('intentionality-progress');
    const encourageEl = document.getElementById('intentionality-encouragement');
    const circumference = 283;

    encourageEl.textContent = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];

    const interval = setInterval(() => {
      seconds--;
      countEl.textContent = seconds;

      const offset = circumference * (1 - seconds / TOTAL_SECONDS);
      progressEl.style.strokeDashoffset = offset;

      // Change encouragement every 5 seconds
      if (seconds % 5 === 0 && seconds > 0) {
        encourageEl.textContent = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
      }

      if (seconds <= 0) {
        clearInterval(interval);
        onComplete();
      }
    }, 1000);
  }

  // Complete intentionality and allow entry
  function completeIntentionality(reason, duration) {
    const hostname = window.location.hostname;

    chrome.runtime.sendMessage({
      type: 'startIntentionalitySession',
      hostname,
      duration,
      reason
    }, (response) => {
      // Check for runtime errors
      if (chrome.runtime.lastError) {
        console.error('[REJECT BRAINROT] Error starting session:', chrome.runtime.lastError);
      }

      // Allow entry even if session tracking fails (graceful degradation)
      // The filters will still work, just won't auto-close
      intentionalityPassed = true;
      removeIntentionalityOverlay();

      // Now initialize filters and video blocking
      updateFilter();
      killVideos();

      if (document.documentElement) {
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['style', 'class'],
          childList: true,
          subtree: true
        });
      }

      if (response && response.success) {
        console.log('[REJECT BRAINROT] Session started, will auto-close at', new Date(response.expiresAt));
      } else {
        console.warn('[REJECT BRAINROT] Session tracking not active - tabs will not auto-close');
      }
    });
  }

  // Remove intentionality overlay
  function removeIntentionalityOverlay() {
    const overlay = document.getElementById('detox-intentionality-overlay');
    if (overlay) {
      overlay.remove();
    }
    document.body.style.overflow = '';
  }

  // Check with background if we have an active session
  async function checkIntentionalitySession() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'checkIntentionalitySession',
        hostname: window.location.hostname
      }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ hasSession: false });
          return;
        }
        resolve(response || { hasSession: false });
      });
    });
  }

  // Get current hostname
  function getCurrentHost() {
    return window.location.hostname.replace(/^www\./, '');
  }

  // Check if current site should be filtered
  function checkIfBlocked() {
    const host = getCurrentHost();
    return settings.sites.some(site => {
      // Match exact or subdomain
      return host === site || host.endsWith('.' + site);
    });
  }

  // Check if current time is within schedule
  function isWithinSchedule() {
    if (!settings.scheduleEnabled) return true; // Schedule disabled, always active

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const startTime = (settings.scheduleStart || 4) * 60;
    const endTime = (settings.scheduleEnd || 21) * 60;

    // Handle schedule that spans midnight
    if (startTime <= endTime) {
      // Normal case: e.g., 4am to 9pm
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Spans midnight: e.g., 9pm to 4am (inverted)
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  // Check if extension is currently active (not paused and within schedule)
  function isActive() {
    if (!settings.enabled) return false;
    if (settings.pausedUntil && Date.now() < settings.pausedUntil) return false;
    if (!isWithinSchedule()) return false;
    return true;
  }

  // Get the current filter string
  function getCurrentFilter() {
    const type = settings.filterType || 'red';
    const intensity = settings.intensity || 'medium';
    return FILTERS[type][intensity];
  }

  // Apply or remove filter
  function updateFilter() {
    isBlockedSite = checkIfBlocked();
    const shouldFilter = isBlockedSite && isActive();

    const html = document.documentElement;
    if (!html) return;

    if (shouldFilter && !filterActive) {
      // Apply filter
      const filter = getCurrentFilter();
      html.style.setProperty('filter', filter, 'important');
      html.style.setProperty('-webkit-filter', filter, 'important');
      filterActive = true;
      console.log('[REJECT BRAINROT] Filter active - stay focused!');
    } else if (!shouldFilter && filterActive) {
      // Remove filter
      html.style.removeProperty('filter');
      html.style.removeProperty('-webkit-filter');
      filterActive = false;
      console.log('[REJECT BRAINROT] Filter removed');
    } else if (shouldFilter && filterActive) {
      // Update filter (settings may have changed)
      const filter = getCurrentFilter();
      html.style.setProperty('filter', filter, 'important');
      html.style.setProperty('-webkit-filter', filter, 'important');
    }
  }

  // Ensure filter stays applied (sites may try to remove it)
  function ensureFilter() {
    if (!isBlockedSite || !isActive()) return;

    const html = document.documentElement;
    if (html && !html.style.filter) {
      const filter = getCurrentFilter();
      html.style.setProperty('filter', filter, 'important');
      html.style.setProperty('-webkit-filter', filter, 'important');
    }
  }

  // Find the video element related to a click target (if any)
  function findRelatedVideo(element) {
    if (!element) return null;

    // If clicked element IS a video, return it
    if (element.tagName === 'VIDEO') {
      return element;
    }

    // Walk up the DOM to find a video container, then find the video inside
    let current = element;
    const maxDepth = 15; // Don't traverse too far

    for (let i = 0; i < maxDepth && current && current !== document.body; i++) {
      // Check for common video player containers by class/attribute
      const isPlayerContainer = current.classList && (
        current.classList.contains('html5-video-player') ||      // YouTube
        current.classList.contains('video-player') ||            // Generic
        current.classList.contains('ytp-player') ||              // YouTube
        current.classList.contains('html5-video-container') ||   // YouTube
        current.classList.contains('video-js') ||                // Video.js
        current.classList.contains('jw-video') ||                // JW Player
        current.classList.contains('vjs-tech')                   // Video.js
      );

      // Twitter-specific: data-testid attributes
      const testId = current.getAttribute && current.getAttribute('data-testid');
      const isTwitterVideo = testId && (
        testId.includes('video') ||
        testId.includes('Video') ||
        testId === 'videoPlayer' ||
        testId === 'videoComponent'
      );

      // Check if this element contains a video
      if (isPlayerContainer || isTwitterVideo) {
        const video = current.querySelector('video');
        if (video) return video;
      }

      // Also check if parent has a video as direct child (common pattern)
      if (current.parentElement) {
        const siblingVideo = current.parentElement.querySelector(':scope > video');
        if (siblingVideo) return siblingVideo;
      }

      current = current.parentElement;
    }

    // Last resort: check if click was inside any element that contains a video nearby
    // This catches clicks on custom play buttons that are siblings of video elements
    const closestContainer = element.closest('[class*="video"], [class*="player"], [data-testid*="video"]');
    if (closestContainer) {
      const video = closestContainer.querySelector('video');
      if (video) return video;
    }

    return null;
  }

  // Track user interactions with SPECIFIC videos to detect intentional plays
  // This prevents false positives when user clicks elsewhere on the page
  function setupInteractionTracking() {
    const markVideoInteraction = (e) => {
      if (!e.isTrusted) return;

      // Find if this click/touch was on or inside a video player
      const video = findRelatedVideo(e.target);
      if (!video) return; // Click wasn't related to any video

      // Mark this specific video as recently interacted with
      recentlyInteractedVideos.add(video);

      // Clear any existing timeout for this video
      const existingTimeout = interactionTimeouts.get(video);
      if (existingTimeout) clearTimeout(existingTimeout);

      // Remove from set after 500ms
      const timeout = setTimeout(() => {
        recentlyInteractedVideos.delete(video);
        interactionTimeouts.delete(video);
      }, 500);
      interactionTimeouts.set(video, timeout);
    };

    document.addEventListener('click', markVideoInteraction, true);
    document.addEventListener('touchstart', markVideoInteraction, true);
    document.addEventListener('keydown', (e) => {
      // Space or Enter while focused on a video element
      if (e.isTrusted && (e.key === ' ' || e.key === 'Enter')) {
        const video = findRelatedVideo(e.target);
        if (video) {
          recentlyInteractedVideos.add(video);
          const existingTimeout = interactionTimeouts.get(video);
          if (existingTimeout) clearTimeout(existingTimeout);
          const timeout = setTimeout(() => {
            recentlyInteractedVideos.delete(video);
            interactionTimeouts.delete(video);
          }, 500);
          interactionTimeouts.set(video, timeout);
        }
      }
    }, true);
  }

  // Intercept HTMLVideoElement.prototype.play to block autoplay at the source
  // (Backup for sites where click interception doesn't work)
  function interceptVideoPlay() {
    const originalPlay = HTMLVideoElement.prototype.play;

    HTMLVideoElement.prototype.play = function() {
      const video = this;

      // If not on a blocked site or extension is paused, allow all plays
      if (!checkIfBlocked() || !isActive()) {
        return originalPlay.call(video);
      }

      // If user has explicitly allowed this video (solved math problem), let it play
      if (userAllowedVideos.has(video)) {
        return originalPlay.call(video);
      }

      // Only show modal if user specifically interacted with THIS video
      if (recentlyInteractedVideos.has(video)) {
        showVideoModalForElement(video);
        return Promise.resolve();
      }

      // Otherwise, this is an autoplay attempt - block it silently
      return Promise.resolve();
    };
  }

  // Set up video elements (remove autoplay attributes, add click interceptors)
  function processVideos() {
    const currentlyBlocked = checkIfBlocked();
    if (!currentlyBlocked || !isActive()) return;

    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      // Remove autoplay attribute
      video.removeAttribute('autoplay');
      video.autoplay = false;

      // Pause any currently autoplaying videos that weren't user-initiated
      if (!video.paused && !userAllowedVideos.has(video)) {
        video.pause();
      }

      // Add click interceptor to video and its container (for custom players like YouTube)
      setupVideoClickInterceptor(video);
    });

    // YouTube-specific: also intercept clicks on the player overlay
    document.querySelectorAll('.html5-video-player, .ytp-cued-thumbnail-overlay').forEach(el => {
      setupPlayerClickInterceptor(el);
    });
  }

  // Intercept clicks on video elements
  function setupVideoClickInterceptor(video) {
    if (video.dataset.detoxClickIntercepted) return;
    video.dataset.detoxClickIntercepted = 'true';

    video.addEventListener('click', handleVideoClick, true);
    video.addEventListener('play', handleVideoPlayEvent, true);
  }

  // Intercept clicks on player containers (YouTube, etc.)
  function setupPlayerClickInterceptor(player) {
    if (player.dataset.detoxClickIntercepted) return;
    player.dataset.detoxClickIntercepted = 'true';

    player.addEventListener('click', handlePlayerClick, true);
  }

  // Handle click on video element itself
  function handleVideoClick(e) {
    const video = e.currentTarget;
    if (!checkIfBlocked() || !isActive()) return;
    if (userAllowedVideos.has(video)) return;

    // Prevent the click from reaching the player
    e.stopPropagation();
    e.preventDefault();

    // Show the math modal
    showVideoModalForElement(video);
  }

  // Handle click on player container
  function handlePlayerClick(e) {
    if (!checkIfBlocked() || !isActive()) return;

    // Find the video inside this player
    const player = e.currentTarget;
    const video = player.querySelector('video');

    if (!video) return;
    if (userAllowedVideos.has(video)) return;

    // Only intercept if clicking on play-related elements
    const target = e.target;
    const isPlayClick = target.closest('.ytp-play-button, .ytp-large-play-button, .ytp-cued-thumbnail-overlay, .ytp-thumbnail');

    if (isPlayClick || target === player) {
      e.stopPropagation();
      e.preventDefault();
      showVideoModalForElement(video);
    }
  }

  // Handle when video starts playing (backup catch)
  function handleVideoPlayEvent(e) {
    const video = e.currentTarget;
    if (!checkIfBlocked() || !isActive()) return;

    if (!userAllowedVideos.has(video)) {
      video.pause();

      // Only show modal if user specifically clicked on THIS video
      if (recentlyInteractedVideos.has(video)) {
        showVideoModalForElement(video);
      }
    }
  }

  // Show modal and handle unlock for a specific video
  function showVideoModalForElement(video) {
    // Don't show if modal already open
    if (document.getElementById('detox-video-modal-overlay')) {
      return;
    }

    // Store reference to this video for when modal completes
    pendingVideo = video;

    showVideoModal(video, () => {
      // This callback is called when user solves the problem
      video.play();
    });
  }

  // Legacy killVideos function name for compatibility
  function killVideos() {
    processVideos();
  }

  // Load settings from storage
  function loadSettings() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get('detoxSettings', (result) => {
          if (result.detoxSettings) {
            settings = { ...DEFAULT_SETTINGS, ...result.detoxSettings };
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Listen for settings changes
  function setupMessageListener() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'settingsUpdate') {
          settings = { ...DEFAULT_SETTINGS, ...message.settings };
          updateFilter();
        }
      });
    }
  }

  // Watch for DOM changes (new videos, style removals)
  const observer = new MutationObserver((mutations) => {
    let checkVideosNeeded = false;

    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        ensureFilter();
      }
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        checkVideosNeeded = true;
      }
    }

    if (checkVideosNeeded) {
      killVideos();
    }
  });

  // Initialize
  async function init() {
    await loadSettings();
    setupMessageListener();
    setupInteractionTracking();

    // Check if this is an intentionality site and we don't have an active session
    if (isActive() && requiresIntentionality()) {
      const sessionInfo = await checkIntentionalitySession();
      if (!sessionInfo.hasSession) {
        // Show intentionality overlay before allowing access
        showIntentionalityOverlay();
        return; // Don't apply filters yet, wait for user to complete intentionality
      } else {
        intentionalityPassed = true;
      }
    }

    updateFilter();
    killVideos();

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        childList: true,
        subtree: true
      });
    }
  }

  // Intercept video play IMMEDIATELY (before DOM is ready)
  // This must happen as early as possible to catch all play() calls
  interceptVideoPlay();

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also run immediately for early loads
  loadSettings().then(() => {
    updateFilter();
  });

  // Periodic check (backup for aggressive sites)
  setInterval(() => {
    ensureFilter();
    killVideos();
  }, 500);

  // Re-check when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadSettings().then(() => {
        updateFilter();
      });
    }
  });
})();
