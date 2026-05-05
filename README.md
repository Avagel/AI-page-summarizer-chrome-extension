# PageLens — AI Page Summarizer

> Instantly summarize any webpage using AI. Extract key insights, bullet points, and estimated reading time in seconds.

---

## Table of Contents

- [Features](#features)
- [Setup Instructions](#setup-instructions)
- [Architecture](#architecture)
- [AI Integration](#ai-integration)
- [Security Decisions](#security-decisions)
- [Trade-offs](#trade-offs)

---

## Features

- One-click AI-powered page summarization
- Bullet-point summary and key insights
- Estimated reading time
- Summary caching — no duplicate API calls
- Dark / light theme toggle
- Copy summary to clipboard
- Keyboard accessible (Enter to summarize, Escape to clear)
- XSS protection on all injected content

---

## Setup Instructions

### Prerequisites

- Google Chrome browser
- Node.js installed — [nodejs.org](https://nodejs.org)
- A Gemini API key — get one free at [aistudio.google.com](https://aistudio.google.com)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/page-summarizer.git
cd page-summarizer
```

### 2. Set Up the Backend Server

```bash
cd server
npm install
```

Create a `.env` file inside the `server` folder:

```
GEMINI_API_KEY=your-gemini-api-key-here
```

Start the server:

```bash
node index.js
```

The server runs on `http://localhost:3000` by default.

### 3. Load the Extension in Chrome

- Open Chrome and navigate to `chrome://extensions`
- Enable **Developer Mode** using the toggle in the top right
- Click **Load Unpacked**
- Select the `page-summarizer` folder

### 4. Use the Extension

- Make sure the backend server is running
- Navigate to any article or webpage
- Click the **PageLens icon** in your Chrome toolbar
- Click **Summarize Page** or press `Enter`
- Your summary appears within seconds

> **Note:** The backend server must be running for the extension to work. This extension is for local use only and is not published to the Chrome Web Store.

---

## Architecture

PageLens is split into two parts — a **Chrome Extension** (frontend) and a **local backend server** that handles all AI communication.

```
┌─────────────────────────────────────────────┐
│                  popup.html                 │
│        User interface — button, output,     │
│        theme toggle, copy button            │
└────────────────────┬────────────────────────┘
                     │ chrome.runtime.sendMessage
                     ▼
┌─────────────────────────────────────────────┐
│              service-worker.js              │
│   Receives messages, checks cache, sends    │
│   HTTP request to local backend server      │
└────────────────────┬────────────────────────┘
                     │ fetch POST /summarize
                     ▼
┌─────────────────────────────────────────────┐
│            Backend Server (Node.js)         │
│   Receives text, calls Gemini API securely, │
│   returns summary to the extension          │
└────────────────────┬────────────────────────┘
                     │ Gemini REST API
                     ▼
┌─────────────────────────────────────────────┐
│           Google Gemini 1.5 Flash           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│            chrome.storage.local             │
│   Caches summaries keyed by page URL        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                 content.js                  │
│   Injected into active tab on demand —      │
│   extracts readable text from the page      │
└─────────────────────────────────────────────┘
```

### File Structure

```
page-summarizer/
├── manifest.json          # Extension config — permissions, MV3 setup
├── popup.html             # UI markup
├── popup.css              # UI styles, dark mode, animations
├── popup.js               # UI logic — state management, messaging
├── content.js             # Injected into webpage — extracts text
├── service-worker.js      # Background — caching, proxies to backend
├── .gitignore
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── server/
    ├── index.js           # Express server — receives text, calls Gemini
    ├── .env               # API key (gitignored)
    ├── .env.example       # Template for contributors
    └── package.json
```

### Message Flow

1. User clicks **Summarize Page** in the popup
2. `popup.js` injects `content.js` into the active tab
3. `content.js` extracts readable text and returns it to `popup.js`
4. `popup.js` sends the text and page URL to `service-worker.js`
5. `service-worker.js` checks `chrome.storage.local` for a cached summary
6. If no cache — it sends a `POST /summarize` request to the local backend
7. The backend calls the Gemini API using the server-side API key
8. The summary is returned to `service-worker.js`, cached, and sent back to `popup.js`
9. `popup.js` sanitizes and renders the summary in the UI

---

## AI Integration

PageLens uses the **Google Gemini 1.5 Flash** model via a local backend server.

### Why Gemini 1.5 Flash?

- Fast response times suitable for a browser extension
- Generous free tier for development and personal use
- Strong instruction-following for structured HTML output

### How It Works

The backend receives the extracted page text and forwards it to Gemini with a structured prompt:

```
You are a helpful assistant. Summarize the following webpage content.
Return your response in this exact HTML format:

<h3>Summary</h3>
<ul><li>...</li></ul>

<h3>Key Insights</h3>
<ul><li>...</li></ul>

<p><strong>Estimated Reading Time:</strong> X minutes</p>
```

Asking for HTML output means the summary renders with proper formatting directly in the popup.

### API Endpoint Used

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=API_KEY
```

### Caching

Summaries are cached in `chrome.storage.local` using the page URL as the key. Repeat visits to the same page return the cached summary instantly with no API call made.

---

## Security Decisions

### API Key Stored on the Server

The Gemini API key lives exclusively in the backend server's `.env` file — never in the extension files. This means:

- The key is never shipped with the extension
- It cannot be read from `chrome://extensions` or the browser DevTools
- It is excluded from version control via `.gitignore`

A `.env.example` file is committed to the repository so contributors know what to configure without exposing the real key.

### No API Key in the Extension

Previous versions of this extension passed the API key through `config.js` inside the extension folder. This was refactored to route all AI calls through the backend server so the key never touches the client at any point.

### XSS Prevention

All AI output is passed through a sanitizer before being injected into the popup via `innerHTML`:

- Only safe tags are allowed: `h3`, `ul`, `li`, `p`, `strong`, `em`, `br`
- All `on*` event attributes (e.g. `onclick`, `onload`) are stripped
- Unrecognised elements are unwrapped — text content is preserved but the tag is removed

### Content Security Policy

The manifest includes a strict CSP that blocks inline scripts and limits resource loading to the extension itself:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

### Minimal Permissions

PageLens requests only the permissions it needs:

| Permission | Reason |
|---|---|
| `activeTab` | Access the current tab when the user clicks the icon |
| `scripting` | Inject content.js into the active tab on demand |
| `storage` | Cache summaries locally |

No `tabs`, `history`, `cookies`, or broad host permissions are requested.

### Message Validation

All messages between the popup, content script, and service worker are validated by checking the `action` field before processing. Unexpected messages are silently ignored.

---

## Trade-offs

### Backend Proxy vs Direct API Call

**Decision:** All AI calls are routed through a local Node.js backend server instead of calling the Gemini API directly from the service worker.

**Why:** The API key never exists in the extension files. This is a significantly more secure architecture — the key cannot be extracted from the installed extension by any user.

**Downside:** The backend server must be running for the extension to work. This adds a setup step and means the extension cannot function standalone without starting the server first.

### Programmatic Injection vs Declarative Content Scripts

**Decision:** `content.js` is injected on demand via `chrome.scripting.executeScript` rather than declared in `manifest.json`.

**Why:** The script only runs when the user actively requests a summary, reducing performance impact on every page load.

**Downside:** Requires a small delay after injection to ensure the message listener is registered before messaging the content script.

### Text Truncation at 5000 Characters

**Decision:** Page content is capped at 5000 characters before being sent to the backend.

**Why:** Keeps API costs low and response times fast. Most articles can be summarized accurately from their opening content.

**Downside:** Very long technical documents or research papers may lose important context that appears further down the page.

### Manual DOM Extraction vs Readability Parser

**Decision:** Content extraction uses manual DOM heuristics — targeting `article`, `main`, and `[role="main"]` — rather than a full library like Mozilla's Readability.js.

**Why:** Keeps the extension lightweight with zero external dependencies.

**Downside:** Extraction quality may vary on complex or unconventional page layouts. Integrating Readability.js would improve accuracy significantly on news sites and blogs.

---

## Local Extension Notice

This extension is intended for local development and personal use. It is not published to the Chrome Web Store. Follow the [Setup Instructions](#setup-instructions) to run it locally with the backend server.

---

## License

MIT
