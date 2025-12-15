# Dopamine Detox

A Chrome extension that applies visual filters to distracting websites to reduce dopamine-driven scrolling and help you stay focused.

## What It Does

When you visit distracting sites (Twitter/X, YouTube, Instagram, TikTok, Reddit, etc.), the extension:
1. Applies a **visual filter** (red tint or grayscale) to make the site less appealing
2. **Blocks video autoplay** - no more infinite scrolling through autoplaying videos
3. **Requires a math challenge** to manually play any video - creates friction to break autopilot habits
4. Reduces brightness and contrast to minimize visual stimulation

## How It Works

- **Content Script** (`content.js`): Injected into every page and iframe, checks if the current site is in the blocked list, applies CSS filters, blocks video autoplay, and shows the math challenge modal when user tries to play a video
- **Side Panel** (`sidepanel.js/html/css`): Settings UI accessible by clicking the extension icon
- **Background Worker** (`background.js`): Manages alarms for auto-re-enabling after breaks, broadcasts settings changes to all tabs
- **Storage**: Uses `chrome.storage.sync` to persist settings across devices

## Features

### Visual Filters
- **Two filter types**: Red (sepia-based) or Grayscale
- **Three intensity levels**:
  - Low: Subtle, mostly visible
  - Medium: Moderate filter with reduced brightness (default)
  - High: Maximum filter, very dim and unpleasant

### Site Management
- Default blocked sites: x.com, twitter.com, youtube.com, instagram.com, facebook.com, tiktok.com, reddit.com, twitch.tv, snapchat.com, pinterest.com
- Add custom sites via the sidebar
- Removing a site requires solving a math problem (prevents impulsive unblocking)

### Video Autoplay Blocking
- Automatically pauses videos that start without user interaction (e.g., Twitter feed videos, YouTube hover previews)
- Works in iframes and across all frames on the page
- Uses multiple interception methods for maximum compatibility:
  - Click interception on video elements and player controls
  - Play event listeners as backup
  - Prototype interception for additional coverage

### Video Unlock Challenge
When you try to play a video manually, a **math challenge modal** appears:
- Solve a math problem to unlock the video
- Same 6 problem types as the break challenge (multiplication, percentages, etc.)
- Creates friction to break autopilot clicking habits
- Cancel or click outside to keep the video locked
- Once unlocked, the video plays normally without further challenges

### Break System
Two break options, both require completing a **3-step challenge**:
1. **5 minute break**: Temporarily disables filters, auto-re-enables after 5 minutes
2. **Done for today**: Disables until 4:00 AM (accounts for night owls)

### Focus Challenge (to disable)
Three sequential steps designed to create friction and break the dopamine loop:

1. **Math Problem** (6 types):
   - Multiplication (e.g., `23 × 7`)
   - Addition/subtraction chains (e.g., `75 + 23 − 12`)
   - Percentages (e.g., `25% of 80`)
   - Division (e.g., `144 ÷ 12`)
   - Squares (e.g., `13²`)
   - Order of operations (e.g., `(8 + 5) × 4`)

2. **Typing Test**: Type a motivational affirmation exactly as shown (20 unique prompts). Errors are highlighted and must be corrected.

3. **30-Second Wait**: Displays rotating encouragement messages (30 unique quotes) with facts about attention, social media, and focus.

### End Break Early
If you change your mind during a break, an "End Break Early" button appears to immediately re-enable the filters.

## File Structure

```
/
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker for alarms and message passing
├── content.js          # Injected script for filters, video blocking, and unlock modal
├── filter.css          # Base CSS for filter inheritance
├── sidepanel.html      # Settings UI markup (active)
├── sidepanel.css       # Settings UI styles (dark theme)
├── sidepanel.js        # Settings logic, challenge system
├── popup.html          # Alternative popup UI (not currently used)
├── popup.css           # Popup styles
├── popup.js            # Popup logic
├── icons/              # Extension icons (16, 48, 128px)
├── README.md           # User-facing documentation
├── LICENSE             # MIT license
├── .gitignore          # Git ignore rules
└── CLAUDE.md           # Developer documentation (this file)
```

## Installation

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension directory

## Permissions Used

- `storage`: Save settings across sessions
- `alarms`: Auto-re-enable after timed breaks
- `sidePanel`: Display settings in Chrome's side panel
