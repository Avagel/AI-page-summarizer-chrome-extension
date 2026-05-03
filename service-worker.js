importScripts("config.js");

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "summarize") {
    try {
      const summary = await handleWithCache(message.text, message.url);
      sendResponse({ result: summary });
    } catch (error) {
      console.log("Error in summarization:", error);
      sendResponse({ error: "Error occurred while summarizing the text." });
    }
  }
  return true;
});

async function handleWithCache(text, url) {
  const cached = await getFromCache(url);
  if (cached) {
    console.log("Cache hit for URL:", url);
    return cached;
  }

  // No cache — call the AI
  const summary = await handleSummarization(text);

  // Save it for next time
  await saveToCache(url, summary);

  return summary;
}

function getFromCache(url) {
  return new Promise((resolve) => {
    chrome.storage.local.get(url, (result) => {
      resolve(result[url] || null);
    });
  });
}

async function saveToCache(url, summary) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [url]: summary }, resolve);
  });
}

async function handleSummarization(text) {
  const prompt = `
    You are a helpful assistant. Summarize the following webpage content.
    Return your response in this exact HTML format:
    <h3>Summary</h3>
    <ul>
      <li>bullet point 1</li>
    </ul>
    <h3>Key Insights</h3>
    <ul>
      <li>insight 1</li>
    </ul>
    <p><strong>Estimated Reading Time:</strong> X minutes</p>

    Page content:
    ${text}
  `;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("API response:", data);

  return data.candidates[0].content.parts[0].text;
}

// model: "gemini-3-flash-preview",
