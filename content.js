chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extract") {
    const text = extractPageContent();
    sendResponse({ text });
  }
  return true; // keeps the message channel open for async response
});

function extractPageContent() {
  // Clone the document so Readability doesn't modify the live page
  const docClone = document.cloneNode(true);
  const reader = new Readability(docClone);
  const article = reader.parse();

  if (article && article.textContent.trim().length > 200) {
    return article.textContent.trim().slice(0, 5000);
  } else {
    const candidates = [
      document.querySelector("article"),
      document.querySelector("main"),
      document.querySelector('[role="main"]'),
      document.querySelector(".post-content"),
      document.querySelector(".article-body"),
      document.body,
    ];

    const container = candidates.find(
      (el) => el && el.innerText.trim().length > 200,
    );

    if (!container) return "";

    const noise = container.querySelectorAll(
      'nav, header, footer, script, style, iframe, img, [aria-hidden="true"]',
    );

    noise.forEach((el) => el.remove());

    return container.innerText.trim().slice(0, 5000);
  }

  return document.body.innerText.trim().slice(0, 5000);
  // Try to find the main article content first
}
