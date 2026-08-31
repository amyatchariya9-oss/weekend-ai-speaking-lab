import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json({ limit: "1mb" }));

app.post("/correct", async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY"
      });
    }

    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({
        error: "Missing transcript"
      });
    }

    const prompt = `
You are an English speaking coach for Thai beginner learners.

The learner is practicing the lesson "My Weekend".

Analyze ONLY this learner sentence:

"${transcript}"

Your job:
1. Keep the learner's intended meaning.
2. Correct important grammar mistakes.
3. Make the sentence sound natural in everyday English.
4. Do NOT over-correct tiny mistakes if the sentence is already natural enough.
5. Give a short Thai explanation of WHY the correction is better.
6. If no meaningful correction is needed, return the original sentence unchanged and use an empty Thai explanation.

Return ONLY valid JSON.

Required fields:
- corrected_sentence: string
- thai_explanation: string
- correction_needed: boolean

Examples:

Input:
"I go shopping yesterday."

Output:
{
  "corrected_sentence": "I went shopping yesterday.",
  "thai_explanation": "มีคำว่า yesterday ซึ่งเป็นอดีต จึงใช้ went แทน go",
  "correction_needed": true
}

Input:
"I stayed home and watched Netflix."

Output:
{
  "corrected_sentence": "I stayed home and watched Netflix.",
  "thai_explanation": "",
  "correction_needed": false
}
`.trim();

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                corrected_sentence: {
                  type: "STRING"
                },
                thai_explanation: {
                  type: "STRING"
                },
                correction_needed: {
                  type: "BOOLEAN"
                }
              },
              required: [
                "corrected_sentence",
                "thai_explanation",
                "correction_needed"
              ]
            }
          }
        })
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini error:", data);

      return res.status(geminiResponse.status).json({
        error: "Gemini request failed",
        details: data
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({
        error: "Gemini returned no text"
      });
    }

    const result = JSON.parse(text);

    return res.json({
      transcript,
      corrected_sentence: result.corrected_sentence,
      thai_explanation: result.thai_explanation,
      correction_needed: result.correction_needed
    });
  } catch (error) {
    console.error("Correction error:", error);

    return res.status(500).json({
      error: "Could not correct sentence"
    });
  }
});

app.listen(port, () => {
  console.log(
    `Weekend AI Speaking Lab running at http://localhost:${port}`
  );
});
