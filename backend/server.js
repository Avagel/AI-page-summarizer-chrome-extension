const express = require("express");
const rateLimiter = require("./rateLimiter.js");
require("dotenv").config(); // ✅ correct
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", rateLimiter);
// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});
const API_KEY = process.env.API_KEY;
// Your proxy route
app.post("/api/prompt", async (req, res) => {
  const { prompt } = req.body;
  //   res.json("jimmi lims");
  try {
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
      const text = await response.text();
      console.error("API ERROR BODY:", text);

      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    console.log(data);
    res.json(data.candidates[0].content.parts[0].text);
  } catch (error) {
    throw new Error(error);
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
