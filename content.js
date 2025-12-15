// Dopamine Detox - Content Script
// Applies visual filter and blocks video autoplay based on settings

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
    pausedUntil: null
  };

  let settings = { ...DEFAULT_SETTINGS };
  let isBlockedSite = false;
  let filterActive = false;

  // Track videos user has manually interacted with
  const userAllowedVideos = new WeakSet();

  // Track videos currently being interacted with (for click-to-play detection)
  let recentUserInteraction = false;
  let interactionTimeout = null;

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
      console.error('[Dopamine Detox] Error showing modal:', err);
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

  // Check if extension is currently active (not paused)
  function isActive() {
    if (!settings.enabled) return false;
    if (settings.pausedUntil && Date.now() < settings.pausedUntil) return false;
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
      console.log('[Dopamine Detox] Filter active - stay focused!');
    } else if (!shouldFilter && filterActive) {
      // Remove filter
      html.style.removeProperty('filter');
      html.style.removeProperty('-webkit-filter');
      filterActive = false;
      console.log('[Dopamine Detox] Filter removed');
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

  // Track user interactions globally to detect intentional plays
  function setupInteractionTracking() {
    // Any click/touch means user is actively interacting
    const markInteraction = (e) => {
      if (e.isTrusted) {
        recentUserInteraction = true;
        clearTimeout(interactionTimeout);
        // Reset after 500ms - enough time for the play() call to fire
        interactionTimeout = setTimeout(() => {
          recentUserInteraction = false;
        }, 500);
      }
    };

    document.addEventListener('click', markInteraction, true);
    document.addEventListener('touchstart', markInteraction, true);
    document.addEventListener('keydown', (e) => {
      // Space or Enter could be play triggers
      if (e.isTrusted && (e.key === ' ' || e.key === 'Enter')) {
        markInteraction(e);
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

      // If there was a recent user interaction, show math challenge
      if (recentUserInteraction) {
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

      // Only show modal if there was recent user interaction (user clicked play)
      if (recentUserInteraction) {
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
