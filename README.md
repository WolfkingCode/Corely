<div align="center">

[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

**English · [فارسی](README.fa.md)**

</div>

---

# Corely — Personal Dashboard & Assistant

**Corely** is a modern, fast, and comprehensive personal dashboard desktop app featuring an RTL-first interface inspired by the Windows 11 Fluent design language. It allows you to organize and manage your daily tasks, habits, ideas, finances, files, and notes in an elegant, unified, and secure environment.

---

## 🧭 Main Sidebar Panels

1. **Home (`Home`):**
   - Accurate digital clock alongside Solar Hijri (Jalali) and Gregorian calendars.
   - Today's schedule and daily routine checklist.
   - Integrated Pomodoro focus timer.
   - Quick access to daily tasks (To-Do), shopping list, and habits tracker.
   - Monthly income/expense overview and savings goals progress.
   - Quick AI assistant prompt directly on the home page.

2. **AI Assistant (`AI Assistant`):**
   - AI chat and advisory with support for multiple conversation threads (Multi-Thread).
   - Rich Markdown rendering for formatted AI responses: headings, lists, code blocks, bold and italic text, links, and blockquotes.
   - Built-in **Function Calling** enabling the AI to automatically create and register tasks, shopping items, weekly schedules, financial transactions, and notes.

3. **Notes (`Notes`):**
   - Minimalist text editor with instant auto-save, word and character counters, and copy/download capabilities.
   - Colorful sticky notes board (Stickies) with pinning, filtering, and search functionality.

4. **Ideas (`Ideas`):**
   - Capture and organize ideas categorized by status (Not Started, In Progress, Completed).
   - Attach unlimited web links, files, and images featuring a dedicated gallery and full-screen lightbox viewer.

5. **Edit Assets (`Edit Assets`):**
   - Central repository to organize video editing and content creation assets (audio clips, green screens, stock footage, memes, sound effects, and images).
   - **Linked library:** files are never copied. They stay where they are on your disk and Corely only remembers their location, so even very large videos cost almost no extra space. Files are added through the system file/folder picker.
   - Small preview thumbnails are generated for each file and loaded lazily as you scroll (the list renders in chunks of 48).
   - If a linked file is moved, renamed or deleted, it is marked as "file not found" and you can relink it individually or by choosing the folder it now lives in.
   - **Categories:** in the video, sound and image tabs choose "All" or "Categories"; categories are shown as cards like packages, and you can add or delete your own. You pick the category when adding files.
   - **Packages:** group assets into packages (create, rename, delete), add files to a package directly from a card, or create a package from a folder on disk. An asset belongs to at most one package.
   - Categorization, tagging, bookmarking, and in-app playback (video seeking supported). Formats that Chromium cannot play (for example HEVC, ProRes, and some mkv/avi files) have no in-app preview and are opened with your default player instead.
   - Allowed extensions: video (mp4, webm, mov, mkv, avi, m4v), audio (mp3, wav, ogg, m4a, flac, aac), image (png, jpg, jpeg, gif, webp, bmp, avif). SVG is intentionally not allowed.

6. **Finance (`Finance`):**
   - Record and categorize income and expense transactions with intelligent category filters.
   - Monthly navigation, summary reporting, and automatic balance calculations.
   - Define custom savings goals with visual progress bars and pinned goal cards.

7. **Downloads (`Downloads`):**
   - Track and manage download links organized by category (video, audio, image, document, software).
   - Live speed indicators, progress bars, data usage stats, and status tracking for each item.

8. **DNS Changer (`DNS Changer`):**
   - Quick configuration and reference for anti-sanction/anti-censorship DNS servers (Shecan, Electro, etc.) and stable global providers (Cloudflare, Google, etc.).
   - Connection testing and operating system setup guide.

9. **Settings (`Settings`):**
   - Tabs: General, AI Assistant, Appearance, Backup, Notifications, System Stats.
   - Customize user profile name, interface language (English default, Persian RTL), audio/sound effects, and an option to hide financial amounts by default (privacy mode).
   - Configure AI providers (Google Gemini or OpenAI-compatible), API keys, and optional proxy.
   - JSON backup creation and restore of application data, settings, and images (see "Light backup" below).

---

## 🔎 Global Search

Press `Ctrl+K` (or use the magnifier button at the bottom of the sidebar) to search across the app's own sections and settings (for example, typing "language" shows where to change it), ideas, notes (line by line), tasks, shopping items, edit assets, packages, and finance records. Persian/Arabic letter variants, half-spaces (ZWNJ), and digits are normalized, and amounts are masked when privacy mode is on. Selecting a result takes you to the related section.

---

## ✨ Key Features

- **Custom Dual Themes:** Handcrafted Dark and Light themes with balanced contrast for eye-strain-free long sessions.
- **Bilingual (Default English & Persian RTL):** Full native support for English (LTR layout, default for fresh installs) and Persian (RTL layout).
- **Native Solar Hijri Calendar:** High-precision mathematical conversion between Gregorian and Solar Hijri dates without heavy external dependencies.
- **Offline-First & Local Data Privacy:**
  - All text data, state, and settings persist securely inside the local application storage (`localStorage`) on your device.
  - Images, attachments, and thumbnails are stored locally in the embedded `IndexedDB` database on your device to eliminate storage limitations. Large media files in "Edit Assets" are not copied at all: they stay on your disk and are only linked.
  - There is no Corely-operated server or tracking, and your data stays on this device. The only exception is the AI assistant: when you use it, your prompt and chat history (along with relevant context sent with the message) are sent directly to the service you configured (Gemini or an OpenAI-compatible service).
- **Light JSON Backup & Restore:** Export your data, transactions, notes, and IndexedDB images into a single JSON file and restore it. Linked media files are never included in a backup (only the library list and the small thumbnails), so after restoring on another device you need to relink the files. In the media store, only thumbnails and records up to 1 MB are exported; larger records are skipped and the app tells you how many were skipped. Restoring only adds to the media store and never clears it. Sensitive API keys are strictly excluded from backups for safety.
- **Smart Error Boundary:** Protects against unhandled application crashes or blank screens with retry triggers and detailed technical diagnostics.

---

## 🤖 AI Assistant Setup

Corely's AI assistant operates directly via Electron IPC inside the main desktop process without intermediate third-party servers:

- **Bring Your Own Key:** Every user provides their own API key in **Settings > AI Assistant**.
- **Supported Providers:**
  - **Google Gemini:** Uses the modern Google GenAI SDK (`@google/genai`).
  - **OpenAI-Compatible:** Connect to any service compatible with the OpenAI API format (e.g., OpenRouter, Groq, local models) by providing Base URL, API Key, and Model ID.
- **Local Storage Security:** Your API key is stored exclusively on your device and is never uploaded, tracked, or included in JSON backup exports.
- **Direct Provider Communication:** Prompts, chat history, and relevant message context are sent directly to your chosen provider (Gemini or OpenAI-compatible endpoint) without passing through any Corely-operated servers.
- **Resolving 403 Forbidden Errors:** If Google Gemini returns HTTP 403 in restricted geographic regions (such as Iran), you can resolve it in one of two ways:
  1. Enable a system-wide VPN in TUN/VPN mode.
  2. In **Settings > General > App proxy**, enable the switch and enter your VPN client's local HTTP proxy address (for example, `http://127.0.0.1:10808`). Currently this proxy is used for AI requests only. If disabled or left empty, Corely connects directly.

---

## 🪟 Windows Notes

- **DNS Changer Permissions:** Changing network adapter DNS on Windows requires administrative privileges. Corely prompts for a single User Account Control (UAC) elevation per app session using a dedicated helper (`electron/dns-helper.cjs`). When Corely closes, this background helper terminates automatically.
- **System Tray Integration:** Closing the main application window minimizes Corely directly to the Windows System Tray, allowing it to stay accessible in the background.
- **Run at Windows Startup:** Corely can automatically launch at Windows startup, but this is completely optional and must be explicitly enabled by the user in Settings.
- **Zero Disk Logging:** Corely does not write any log files or telemetry logs to your hard drive.

---

## 🛡️ Security

- **Strict Desktop Isolation:** Electron runs with `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- **IPC Origin Validation:** The IPC handlers strictly verify sender frames to ensure only requests originating from the trusted internal `app://corely` protocol are executed.
- **Content Security Policy (CSP):** A Content Security Policy defines which sources scripts, styles, and network content can be loaded from.
- **Safe External Navigation:** External hyperlinks and web addresses are intercepted and opened safely in your system's default web browser via `shell.openExternal`.
- **No Local Server / Open Ports:** Corely loads directly from internal packaged files using the custom `app://corely/` protocol. It never spins up an Express server, background HTTP daemon, or open network port.

---

## 🛠️ Tech Stack

- **Frontend:** React 19 + TypeScript
- **Build Tool:** Vite
- **Desktop Architecture:** Electron (secure IPC communication without local HTTP servers; custom `app://corely` protocol)
- **Styling:** Tailwind CSS v4
- **Animations:** Motion (Framer Motion)
- **Icons:** Lucide React
- **Artificial Intelligence:** Google GenAI SDK (`@google/genai`) and OpenAI-compatible REST API via `undici` with optional HTTP proxy

---

## 🌐 External Services Used

Corely connects to the internet only for a few specific online features. Only static files are downloaded and your data is not sent, though the destination server (such as Google for fonts) may see your IP address:

- **Vazirmatn Font:** Loaded from Google Fonts (`fonts.googleapis.com`). If internet access is unavailable or filtered, the app automatically falls back to system fonts without disruption.
- **Image Background Removal:** The `@imgly/background-removal` library dynamically downloads its AI model weights on demand from `staticimgly.com`.

---

## 📥 Download (Windows)

Download the latest installer (a file like `Corely Setup 1.0.0.exe`) from the **Releases** page of this repository, run it and follow the steps.

---

## 🚀 Installation & Setup Guide

### Prerequisites
- Node.js (version 20 or higher, required by dependencies such as `undici`)

### 1. Install Dependencies
```bash
npm install
```

### 2. UI Preview in Browser (Vite)
```bash
npm run dev
```
Starts the local Vite dev server for previewing the user interface in a web browser. Note: Desktop-exclusive features (such as AI IPC, DNS Changer, and System Tray) only function within Electron.

### 3. Run Desktop Application (Development)
```bash
npm run electron:dev
```
Builds the UI and launches the full desktop application within Electron.

### 4. Build for Production
```bash
npm run build
```
Compiles and packages the frontend code into the `dist/` directory.

### 5. Build Windows Installer
```bash
npm run dist:win
```
Generates a packaged Windows installer (`.exe`) using `electron-builder`. Note: A valid application icon at `build/icon.ico` is required for packaging.

---

## 📄 License

This project is licensed under the **Apache-2.0 License**. See the [LICENSE](LICENSE) file for complete details.
