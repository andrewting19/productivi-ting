// REJECT BRAINROT - Background Service Worker

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Enable side panel to open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Listen for settings changes from side panel
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
});

// Check for expired pauses on startup and periodically
chrome.alarms.create('checkPause', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
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
        pausedUntil: null
      };
      chrome.storage.sync.set({ detoxSettings: defaults });
    }
  });
});
