// REJECT BRAINROT - Background Service Worker

// Active intentionality sessions: { site: { expiresAt: timestamp, tabIds: [tabId, ...], reason: string } }
// Stored in session storage (not synced, per-browser)
let activeSessions = {};

// Default settings (must match content.js and sidepanel.js)
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

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Enable side panel to open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Check if current time is within schedule
function isWithinSchedule(settings) {
  if (!settings.scheduleEnabled) return true; // Schedule disabled, always active

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const startTime = settings.scheduleStart * 60; // scheduleStart is hour (e.g., 4 for 4am)
  const endTime = settings.scheduleEnd * 60; // scheduleEnd is hour (e.g., 21 for 9pm)

  // Handle schedule that spans midnight
  if (startTime <= endTime) {
    // Normal case: e.g., 4am to 9pm
    return currentTime >= startTime && currentTime < endTime;
  } else {
    // Spans midnight: e.g., 9pm to 4am (inverted - this means OFF during this time)
    return currentTime >= startTime || currentTime < endTime;
  }
}

// Normalize hostname for matching
function normalizeHost(hostname) {
  return hostname.replace(/^www\./, '').toLowerCase();
}

// Check if a hostname matches a site pattern
function hostMatchesSite(hostname, site) {
  const normalizedHost = normalizeHost(hostname);
  const normalizedSite = normalizeHost(site);
  return normalizedHost === normalizedSite || normalizedHost.endsWith('.' + normalizedSite);
}

// Get the site key for a hostname (for session tracking)
function getSiteKeyForHost(hostname, intentionalitySites) {
  const normalizedHost = normalizeHost(hostname);
  for (const site of intentionalitySites) {
    if (hostMatchesSite(normalizedHost, site)) {
      return normalizeHost(site);
    }
  }
  return null;
}

// Listen for messages from content scripts and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'settingsChanged') {
    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'settingsUpdate',
          settings: message.settings
        }).catch(() => {
          // Tab might not have content script, ignore
        });
      });
    });
  }

  // Check if site has active intentionality session
  if (message.type === 'checkIntentionalitySession') {
    const { hostname } = message;
    chrome.storage.sync.get('detoxSettings', (result) => {
      const settings = { ...DEFAULT_SETTINGS, ...result.detoxSettings };
      const intentionalitySites = settings.intentionalitySites;
      const siteKey = getSiteKeyForHost(hostname, intentionalitySites);

      if (siteKey && activeSessions[siteKey]) {
        const session = activeSessions[siteKey];
        if (Date.now() < session.expiresAt) {
          // Session still valid, add this tab to tracking
          if (sender.tab && !session.tabIds.includes(sender.tab.id)) {
            session.tabIds.push(sender.tab.id);
          }
          sendResponse({ hasSession: true, expiresAt: session.expiresAt, reason: session.reason });
          return;
        } else {
          // Session expired, clean up
          delete activeSessions[siteKey];
        }
      }
      sendResponse({ hasSession: false });
    });
    return true; // Keep message channel open for async response
  }

  // Start intentionality session
  if (message.type === 'startIntentionalitySession') {
    const { hostname, duration, reason } = message;
    chrome.storage.sync.get('detoxSettings', (result) => {
      const settings = { ...DEFAULT_SETTINGS, ...result.detoxSettings };
      const intentionalitySites = settings.intentionalitySites;
      const siteKey = getSiteKeyForHost(hostname, intentionalitySites);

      if (siteKey) {
        const expiresAt = Date.now() + (duration * 60 * 1000);
        activeSessions[siteKey] = {
          expiresAt,
          tabIds: sender.tab ? [sender.tab.id] : [],
          reason
        };

        // Create alarm to close tabs when session expires
        chrome.alarms.create(`intentionality_${siteKey}`, { when: expiresAt });

        sendResponse({ success: true, expiresAt });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }

  // Close tab (quit from intentionality form)
  if (message.type === 'closeTab') {
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id).catch(() => {});
    }
    sendResponse({ success: true });
    return true;
  }
});

// Check for expired pauses and sessions periodically
chrome.alarms.create('checkPause', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  // Handle pause expiry
  if (alarm.name === 'checkPause') {
    chrome.storage.sync.get('detoxSettings', (result) => {
      if (result.detoxSettings && result.detoxSettings.pausedUntil) {
        if (Date.now() >= result.detoxSettings.pausedUntil) {
          // Pause expired, re-enable
          const settings = result.detoxSettings;
          settings.pausedUntil = null;
          settings.enabled = true;
          chrome.storage.sync.set({ detoxSettings: settings });

          // Notify all tabs
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, {
                type: 'settingsUpdate',
                settings: settings
              }).catch(() => {});
            });
          });
        }
      }
    });
  }

  // Handle intentionality session expiry
  if (alarm.name.startsWith('intentionality_')) {
    const siteKey = alarm.name.replace('intentionality_', '');
    const session = activeSessions[siteKey];

    if (session) {
      // Close all tabs in this session
      const tabIds = session.tabIds.filter(id => id);
      if (tabIds.length > 0) {
        chrome.tabs.remove(tabIds).catch(() => {});
      }
      delete activeSessions[siteKey];
    }
  }
});

// Clean up session tracking when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const siteKey in activeSessions) {
    const session = activeSessions[siteKey];
    const index = session.tabIds.indexOf(tabId);
    if (index > -1) {
      session.tabIds.splice(index, 1);
    }
  }
});

// On install, set default settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('detoxSettings', (result) => {
    if (!result.detoxSettings) {
      const defaults = {
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
        pausedUntil: null,
        // Schedule settings (filters active during this time)
        scheduleEnabled: true,
        scheduleStart: 4,  // 4am
        scheduleEnd: 21,   // 9pm
        // Intentionality sites (require reason + time commitment)
        intentionalitySites: ['x.com', 'twitter.com', 'youtube.com']
      };
      chrome.storage.sync.set({ detoxSettings: defaults });
    } else {
      // Migration: add new settings if missing
      const settings = result.detoxSettings;
      let needsSave = false;

      if (settings.scheduleEnabled === undefined) {
        settings.scheduleEnabled = true;
        settings.scheduleStart = 4;
        settings.scheduleEnd = 21;
        needsSave = true;
      }

      if (settings.intentionalitySites === undefined) {
        settings.intentionalitySites = ['x.com', 'twitter.com', 'youtube.com'];
        needsSave = true;
      }

      if (needsSave) {
        chrome.storage.sync.set({ detoxSettings: settings });
      }
    }
  });
});
