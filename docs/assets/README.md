# Recall - Visual Assets

This directory contains visual assets for the Recall project documentation and marketing materials.

## Screenshots

Generated using the automated screenshot script (`scripts/capture-screenshots.js`):

- **session-list.png** (1600x1000px) - Main session list view showing multi-agent support
- **session-player.png** (1600x1000px) - Session player with timeline and playback controls
- **chat-view.png** (1600x1000px) - Conversational chat view mode
- **work-units.png** (1600x1000px) - Work Units dashboard

## Social Media

- **og-image.png** (1200x630px) - Open Graph social preview image for GitHub/Twitter/etc.

## Generating Screenshots

To regenerate screenshots:

```bash
# 1. Install Playwright (if not already installed)
npm install -D playwright

# 2. Start Recall server
npm start

# 3. Run screenshot script (in another terminal)
node scripts/capture-screenshots.js
```

## Image Optimization

Before committing, optimize images to reduce file size:

```bash
# Using ImageOptim (Mac)
# Drag and drop PNG files to ImageOptim app

# Or using command line tools
pngquant --quality=80-95 *.png
optipng -o7 *.png
```
