# Dopamine Detox

A Chrome extension that applies visual filters to distracting websites and blocks video autoplay to help you stay focused and break the dopamine-driven scrolling habit.

## Features

- **Visual Filters**: Apply red tint or grayscale filters to make distracting sites less appealing
- **Video Autoplay Blocking**: Automatically pauses videos on Twitter, YouTube, Instagram, etc.
- **Video Unlock Challenge**: Solve a math problem to watch any video - creates friction to break autopilot habits
- **Configurable Site List**: Add or remove sites from the block list (removal requires a math challenge)
- **Break System**: Take timed breaks after completing a 3-step focus challenge

## Installation

1. Clone this repository or download the ZIP
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the extension directory

## How It Works

When you visit a blocked site:
1. A visual filter (red or grayscale) is applied to make the page less appealing
2. All video autoplay is blocked - no more infinite scrolling through autoplaying content
3. Clicking play on any video triggers a math challenge modal
4. Solve the math problem to unlock and watch the video
5. Once unlocked, that video plays normally without further challenges

## Default Blocked Sites

- x.com / twitter.com
- youtube.com
- instagram.com
- facebook.com
- tiktok.com
- reddit.com
- twitch.tv
- snapchat.com
- pinterest.com

You can add custom sites or remove existing ones via the side panel settings.

## Taking a Break

Click the extension icon to open the side panel, then choose:
- **5 minute break**: Complete a 3-step challenge, filters disabled for 5 minutes
- **Done for today**: Complete the challenge, disabled until 4 AM

The challenge includes:
1. A math problem (multiplication, percentages, division, etc.)
2. Typing a motivational affirmation exactly as shown
3. A 30-second wait with encouragement messages

## File Structure

```
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker for alarms and messaging
├── content.js          # Filters, video blocking, and unlock modal
├── filter.css          # Base CSS for filter inheritance
├── sidepanel.*         # Settings UI (HTML, CSS, JS)
├── popup.*             # Alternative popup UI (not currently active)
├── icons/              # Extension icons (16, 48, 128px)
└── CLAUDE.md           # Detailed developer documentation
```

## Permissions

- `storage`: Save settings across sessions
- `alarms`: Auto-re-enable after timed breaks
- `sidePanel`: Display settings in Chrome's side panel

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT - see [LICENSE](LICENSE) for details.
