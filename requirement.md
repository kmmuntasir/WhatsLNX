Product Requirements Document: WhatsLNX
1. Project Overview
Project Name: WhatsLNX

Repository: https://github.com/kmmuntasir/WhatsLNX

Creator: Muntasir Billah Munna

Target Platform: Linux Desktop (Primary focus: Ubuntu 24.04/26.04, with universal support via AppImage/Snap/Flatpak) Ubuntu, Linux Mint, Elementary OS and other Debian based distros are mandatory to work on. Arch, Fedora, and other distros are optional but encouraged.

Core Philosophy: A minimalist, highly performant Electron wrapper for WhatsApp Web that prioritizes system-native behavior, Wayland compatibility, and flawless WebRTC (audio/video calling) support.

2. Problem Statement
Current unofficial WhatsApp Linux clients (like Whatsdesk or Whatsie) fail to provide a modern, native-feeling experience on contemporary Linux distributions. They suffer from:

Wayland Incompatibility: Frequent crashes or segmentation faults on modern desktop environments.

WebRTC Failures: Broken or improperly sandboxed audio/video calling capabilities.

Poor Desktop Integration: Failure to utilize native xdg-desktop-portal dialogs for file transfers, leading to jarring, custom-built UI popups.

Theme Desync: Inability to automatically detect and switch between the OS's light and dark color schemes.

Font Control: Inconsistent font rendering that doesn't match the user's system settings, leading to a jarring user experience.

WhatsLNX solves these issues by leveraging modern Electron configurations, injecting system-aware scripts, and strictly respecting Linux desktop environment standards.

3. Technical Stack
Core Framework: Electron (Latest stable build)

Language: JavaScript / TypeScript (Node.js)

Frontend UI: Pure injected CSS/JS (No heavy frontend frameworks; we are wrapping web.whatsapp.com)

Build/Packaging Tool: electron-builder (Targeting Snap, AppImage, and DEB)

4. Core Functional Requirements
4.1. The Wrapper Engine
Target URL: The application must securely load [https://web.web.whatsapp.com](https://web.web.whatsapp.com).

User-Agent Spoofing: Must identify as a standard Linux Chrome browser to prevent WhatsApp from blocking desktop-specific features (like calling).

Session Persistence: Must retain login states, cookies, and local storage between application restarts.

4.2. Media & WebRTC (Audio/Video Calling)
Permissions: The main process must automatically approve media (camera and microphone) requests from the webview.

Sandboxing: Must successfully bridge the hardware camera/mic through the Snap/AppImage sandbox to the Electron process without requiring manual terminal commands from the user.

4.3. System Notifications
Native Bubbles: Must intercept web notifications and push them to the native Linux notification daemon (e.g., GNOME notifications) using standard DBus APIs.

Tray Icon Integration: Must feature a system tray icon that indicates unread message counts and allows the app to run minimized in the background.

5. OS Integration & "Native Feel" Requirements
5.1. Wayland Support
Launch Flags: The application must programmatically append --ozone-platform-hint=auto and --enable-features=WaylandWindowDecorations on Linux environments to prevent XWayland bridging and segmentation faults.

5.2. Native Portals (xdg-desktop-portal)
Download Interception: Instead of using customized Electron or web dialogs, all file downloads must trigger the system's native save dialog.

File Uploads: Clicking the attachment icon must open the native GTK/Qt file picker based on the user's desktop environment.

5.3. Dynamic Theming
System Sync: The application must monitor the OS prefers-color-scheme state.

DOM Injection: When the OS switches from light to dark mode, a preload script must instantly toggle the .dark class within the WhatsApp DOM without requiring an app restart.

6. Non-Functional Requirements
Memory Efficiency: Must utilize WebContentsView or aggressively garbage-collect background processes to maintain a smaller memory footprint than a standard Chrome tab.

Single Instance Lock: Must prevent multiple instances of WhatsLNX from running simultaneously to avoid session corruption.

Startup Speed: The app must render the window within 2 seconds of the user clicking the desktop icon.

7. Packaging & Distribution Strategy
To ensure maximum compatibility across distros without the WebKit bugs associated with Tauri:

AppImage: The primary portable release for immediate, install-free execution on any distro.

Snap Package: Pre-configured with the camera, audio-record, and desktop plugs permanently connected so users do not face the permission errors you encountered with Whatsdesk.

Debian Package (.deb): Specifically compiled for native integration on Ubuntu/Debian systems.
