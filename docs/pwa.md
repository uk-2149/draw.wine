# Progressive Web App (PWA)

## Overview

draw.wine is installable as a PWA on desktop and mobile devices. This provides an app-like experience with its own window, icon, and offline capabilities.

## Install Prompt

The install flow is managed by `usePWAInstall` hook:

1. **Global listener** captures the `beforeinstallprompt` event (fired by the browser when PWA criteria are met)
2. The deferred prompt is stored globally so it persists across component re-mounts
3. `InstallButton` component conditionally renders when `canInstall` is true
4. On click, `prompt()` is called and the user sees the browser's native install dialog
5. After install, `appinstalled` event clears the prompt

## Architecture

```
usePWAInstall.ts
├── initPWAInstall()         — one-time global event listener setup
├── globalDeferredPrompt     — shared prompt instance
├── globalListeners          — Set of subscriber callbacks
└── usePWAInstall() hook
    ├── canInstall: boolean  — whether install prompt is available
    └── install()            — trigger the install dialog
```

The hook uses a **global singleton pattern** rather than component state to ensure the `beforeinstallprompt` event is never missed, even if the install button component mounts late.

## InstallButton Component

Located at `components/custom/general/InstallButton.tsx`:
- Only visible when `canInstall` is true
- Renders in the top-right toolbar area
- After successful installation, the button disappears
