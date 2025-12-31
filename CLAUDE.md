# REJECT BRAINROT

A Chrome extension that makes distracting sites ugly and forces you to do math before watching videos. Self-imposed parental controls for the terminally online.

## What It Does

When you visit distracting sites (Twitter/X, YouTube, Instagram, TikTok, Reddit, etc.), the extension:
1. Applies a **visual filter** (red tint or grayscale) to make the site less appealing
2. **Blocks video autoplay** - no more infinite scrolling through autoplaying videos
3. **Requires a math challenge** to manually play any video - creates friction to break autopilot habits
4. Reduces brightness and contrast to minimize visual stimulation
5. **Schedule-based activation** - filters only active during configured hours (default: 4am-9pm)
6. **Intentionality prompts** - for configured sites (default: Twitter, YouTube), requires stating your purpose and time limit before entry; auto-closes tabs when time expires

## How It Works

- **Content Script** (`content.js`): Injected into every page and iframe, checks if the current site is in the blocked list, applies CSS filters, blocks video autoplay, shows the math challenge modal when user tries to play a video, and displays the intentionality overlay for configured sites
- **Side Panel** (`sidepanel.js/html/css`): Settings UI accessible by clicking the extension icon, includes schedule configuration and intentionality site management
- **Background Worker** (`background.js`): Manages alarms for auto-re-enabling after breaks, tracks intentionality sessions, handles auto-closing tabs when session expires, broadcasts settings changes to all tabs
- **Storage**: Uses `chrome.storage.sync` to persist settings across devices (schedule settings, intentionality sites, etc.)

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

### Schedule System
Filters are only active during configured hours:
- **Default schedule**: 4:00 AM to 9:00 PM (filters active)
- **Outside schedule hours**: Filters automatically disabled, status shows "Off (outside schedule)"
- **Configurable**: Toggle schedule on/off, set custom start/end times via sidepanel
- **24-hour support**: Schedule can span midnight (e.g., 9 PM to 4 AM means filters OFF during those hours)

### Intentionality System
For designated high-distraction sites, requires mindful engagement before access:

**Configured Sites** (default: x.com, twitter.com, youtube.com):
- Separate list from blocked sites
- Add/remove sites without challenge

**Intentionality Flow**:
1. **Navigate to intentionality site** → Full-page overlay blocks content
2. **State your purpose**: Text field asking "Why are you opening this site?"
3. **Set time limit**: Custom minutes (1-120) for intended usage
4. **20-second wait**: Rotating encouragement quotes while you reflect
5. **Enter or Quit**: "Quit" closes the tab, "Enter Site" starts session

**Session Tracking**:
- Once entered, all tabs of that site during the session are tracked
- Opening new tabs of the same site doesn't require new intentionality check
- Background worker manages session state and tab tracking

**Auto-Close**:
- When time limit expires, ALL tabs of that site are automatically closed
- No warning before closing
- Encourages sticking to stated intentions

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
- `alarms`: Auto-re-enable after timed breaks, check intentionality session expiry
- `sidePanel`: Display settings in Chrome's side panel
- `tabs`: Close tabs when intentionality session expires
