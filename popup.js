// Grab all the elements we need
const summarizeBtn = document.getElementById("summarize-btn");
const clearBtn = document.getElementById("clear-btn");
const pageTitle = document.getElementById("page-title");
const loading = document.getElementById("loading");
const result = document.getElementById("result");
const summaryOutput = document.getElementById("summary-output");
const error = document.getElementById("error");
const errorMessage = document.getElementById("error-message");
const copyBtn = document.getElementById("copy-btn");
const themeToggle = document.getElementById("theme-toggle");

// When the popup opens, show the current page title
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  pageTitle.textContent = tabs[0].title;
});

// Handle summarize button click
summarizeBtn.addEventListener("click", () => {
  showState("loading");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;

    // Step 1: Inject content script into the page
    chrome.scripting.executeScript(
      { target: { tabId }, files: ["Readability.js", "content.js"] },
      () => {
        // Step 2: Ask content script to extract the text
        chrome.tabs.sendMessage(tabId, { action: "extract" }, (response) => {
          if (!response || !response.text) {
            showError("Could not extract page content.");
            return;
          }

          // Step 3: Send text to background worker for AI summarization
          chrome.runtime.sendMessage(
            { action: "summarize", text: response.text, url: tabs[0].url },
            (summary) => {
              if (summary.error) {
                showError(summary.error);
                return;
              }
              showResult(summary.result);
            },
          );
        });
      },
    );
  });
});

// Handle clear button
clearBtn.addEventListener("click", () => {
  summaryOutput.innerHTML = "";
  showState("idle");
});

// Copy summary text
copyBtn.addEventListener("click", () => {
  const text = summaryOutput.innerText;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy";
    }, 2000);
  });
});

// Toggle dark/light theme
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "☀️" : "🌙";
  chrome.storage.local.set({ theme: isDark ? "dark" : "light" });
});

// Load saved theme on popup open
chrome.storage.local.get("theme", (data) => {
  if (data.theme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️";
  }
});

function sanitizeHTML(html) {
  const allowed = ["h3", "ul", "li", "p", "strong", "em", "br"];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove any element not in the allowed list
  doc.body.querySelectorAll("*").forEach((el) => {
    if (!allowed.includes(el.tagName.toLowerCase())) {
      el.replaceWith(...el.childNodes); // unwrap, keep text
    }

    // Remove all event attributes like onclick, onload etc
    [...el.attributes].forEach((attr) => {
      if (attr.name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}

// Helper: control which section is visible
function showState(state) {
  loading.classList.add("hidden");
  result.classList.add("hidden");
  error.classList.add("hidden");

  if (state === "loading") {
    loading.classList.remove("hidden");
    summarizeBtn.disabled = true;
    clearBtn.disabled = true;
    summarizeBtn.textContent = "Summarizing...";
  }
  if (state === "result") {
    summarizeBtn.disabled = false;
    clearBtn.disabled = false;
    result.classList.remove("hidden");
    summarizeBtn.textContent = "Summarize Page";
  }
  if (state === "error") {
    summarizeBtn.disabled = false;
    clearBtn.disabled = true;
    error.classList.remove("hidden");
    summarizeBtn.textContent = "Summarize Page";
  }
}

function showError(msg) {
  errorMessage.textContent = msg;
  showState("error");
}

function showResult(text) {
  summaryOutput.innerHTML = sanitizeHTML(text);
  showState("result");
}
