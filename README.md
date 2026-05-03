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
- A Gemini API key — get one free at [aistudio.google.com](https://aistudio.google.com)
- Generate an API key from above and copy it. it'll be needed later on.

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-username/page-summarizer.git
cd page-summarizer
```

2. **Add your API key**

Copy the example config file and add your key:

```bash
cp config.example.js config.js
```

Open `config.js` and replace the placeholder:

```javascript
const API_KEY = "your-gemini-api-key-here";
```

3. **Load the extension in Chrome**

- Open Chrome and navigate to `chrome://extensions`
- Enable **Developer Mode** using the toggle in the top right
- Click **Load Unpacked**
- Select the `page-summarizer` folder

4. **Use the extension**

- Navigate to any article or webpage
- Click the **PageLens icon** in your Chrome toolbar
- Click **Summarize Page** or press `Enter`
- Your summary appears within seconds

> **Note:** This extension is for local use only and is not published to the Chrome Web Store.

---

## Architecture

PageLens follows the **Manifest V3** Chrome Extension architecture, which separates responsibilities across four distinct layers:

```
┌─────────────────────────────────────────────┐
│                  popup.html                 │
│         User interface — button, output,    │
│         theme toggle, copy button           │
└────────────────────┬────────────────────────┘
                     │ chrome.runtime.sendMessage
                     ▼
┌─────────────────────────────────────────────┐
│              service-worker.js              │
│    Background worker — receives messages,   │
│    checks cache, calls Gemini API           │
└────────────────────┬────────────────────────┘
                     │ chrome.storage.local
                     ▼
┌─────────────────────────────────────────────┐
│            chrome.storage.local             │
│    Caches summaries keyed by page URL       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                 content.js                  │
│    Injected into active tab on demand —     │
│    extracts readable text from the page     │
└─────────────────────────────────────────────┘
```

### File Structure

```
page-summarizer/
├── manifest.json        # Extension config — permissions, MV3 setup
├── popup.html           # UI markup
├── popup.css            # UI styles, dark mode, animations
├── popup.js             # UI logic — state management, messaging
├── content.js           # Injected into webpage — extracts text
├── service-worker.js    # Background — AI calls, caching
├── config.js            # API key (gitignored)
├── config.example.js    # Template for new contributors
├── .gitignore           # Excludes config.js from version control
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

### Message Flow

1. User clicks **Summarize Page** in the popup
2. `popup.js` injects `content.js` into the active tab via `chrome.scripting.executeScript`
3. `popup.js` sends an `extract` message to `content.js`
4. `content.js` extracts the readable text and sends it back
5. `popup.js` forwards the text and page URL to `service-worker.js`
6. `service-worker.js` checks `chrome.storage.local` for a cached summary
7. If no cache — it calls the Gemini API and stores the result
8. The summary is returned to `popup.js` and rendered in the UI

---

## AI Integration

PageLens uses the **Google Gemini 1.5 Flash** model via the Gemini REST API.

### Why Gemini 1.5 Flash?

- Fast response times suitable for a browser extension
- Generous free tier for development and personal use
- Strong instruction-following for structured HTML output

### How It Works

The extracted page text is sent to Gemini with a structured prompt that instructs the model to return a formatted HTML response:

```
You are a helpful assistant. Summarize the following webpage content.
Return your response in this exact HTML format:

<h3>Summary</h3>
<ul><li>...</li></ul>

<h3>Key Insights</h3>
<ul><li>...</li></ul>

<p><strong>Estimated Reading Time:</strong> X minutes</p>
```

The response is then sanitized and injected into the popup UI.

### API Endpoint

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=API_KEY
```

### Caching

Summaries are cached in `chrome.storage.local` using the page URL as the key. On repeat visits to the same page, the cached summary is returned instantly without making an API call.

---

## Security Decisions

### API Key Protection

The API key is stored in `config.js` which is listed in `.gitignore`. It is never exposed in `popup.js` or `content.js`. All API calls are made exclusively from `service-worker.js` — the background layer that users cannot inspect through the page DevTools.

A `config.example.js` file is committed to the repository as a template so contributors know what is required without exposing the real key.

### XSS Prevention

The AI response is HTML that gets injected into the popup. To prevent malicious content from executing, all AI output is passed through a sanitizer before rendering:

- Only safe tags are allowed: `h3`, `ul`, `li`, `p`, `strong`, `em`, `br`
- All `on*` event attributes (e.g. `onclick`, `onload`) are stripped
- Any unrecognised elements are unwrapped — their text content is preserved but the tag is removed

### Content Security Policy

The manifest includes a strict CSP that prevents inline scripts and restricts resource loading to the extension itself:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

### Minimal Permissions

PageLens requests only the permissions it needs:

| Permission  | Reason                                               |
| ----------- | ---------------------------------------------------- |
| `activeTab` | Access the current tab when the user clicks the icon |
| `scripting` | Inject content.js into the active tab                |
| `storage`   | Cache summaries locally                              |

No `tabs`, `history`, `cookies`, or broad host permissions are requested.

### Message Validation

All messages between popup, content script, and service worker are validated by checking the `action` field before processing. Unexpected messages are ignored.

---

## Trade-offs

### Direct API Call vs Proxy Server

**Decision:** API calls are made directly from the service worker rather than routing through a backend proxy.

**Why:** This keeps the extension self-contained with no server dependency. For a local extension this is the right trade-off — a proxy server would add infrastructure complexity and cost.

**Downside:** The API key lives on the client. It is protected by `.gitignore` and not accessible from content scripts or the page, but a determined user could find it by inspecting the extension files locally.

### Programmatic Injection vs Declarative Content Scripts

**Decision:** `content.js` is injected on demand via `chrome.scripting.executeScript` rather than declared in `manifest.json`.

**Why:** The script only runs when the user actively requests a summary, reducing performance impact on every page load.

**Downside:** Requires a small `setTimeout` delay after injection to ensure the message listener is ready before messaging.

### Text Truncation at 5000 Characters

**Decision:** Page content is capped at 5000 characters before being sent to the AI.

**Why:** Keeps API costs low and response times fast. Most articles can be summarized accurately from their first 5000 characters.

**Downside:** Very long technical documents or research papers may lose important content that appears later in the page.

### No Readability Parser

**Decision:** Content extraction uses manual DOM heuristics rather than a full readability library like Mozilla's Readability.js.

**Why:** Keeps the extension lightweight with no external dependencies.

**Downside:** Extraction quality may vary on complex page layouts. Integrating Readability.js would significantly improve accuracy on news sites and blogs.

---

## Local Extension Notice

This extension is intended for local development and personal use. It is not published to the Chrome Web Store. To use it, follow the [Setup Instructions](#setup-instructions) above to load it as an unpacked extension in Developer Mode.

---

## License

MIT
