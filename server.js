import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json({ limit: "1mb" }));

app.post("/correct", async (req, res) => {
  try {
    const { transcript, turn = 1 } = req.body;

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

    const isFinalTurn = Number(turn) >= 5;

    const prompt = `
You are an English speaking coach for Thai beginner learners.

LESSON:
My Weekend

LEARNER ANSWER:
"${transcript}"

CURRENT TURN:
${turn} of 5

Your tasks:

1. Keep the learner's intended meaning.
2. Correct only meaningful SPOKEN English mistakes.
3. Make the sentence sound natural in everyday spoken English.
4. Do not over-correct tiny mistakes if the learner is understandable and sounds natural enough.

IMPORTANT: This is SPOKEN English practice, not writing practice.

Do NOT correct or comment on:
- punctuation
- commas
- periods
- capitalization
- spelling-style formatting
- sentence separation caused only by speech-to-text transcription

Never mark punctuation or capitalization as a correction.

Only correct mistakes that matter when spoken aloud, such as:
- wrong tense
- wrong verb form
- missing an important verb
- incorrect sentence structure
- unnatural word choice
- mistakes that change or confuse the meaning

If the learner's spoken English sounds natural and understandable, set correction_needed to false even if the transcript has no punctuation.

5. Give a short beginner-friendly Thai explanation only when a meaningful spoken-English correction is needed.

Never mention punctuation, commas, periods, capitalization, spelling-style formatting, or writing rules in the Thai explanation.

6. Create ONE short, natural follow-up question based directly on what the learner actually said.
7. Do not ask a generic scripted question if a more relevant follow-up is possible.
8. Keep the next question simple enough for a beginner.
9. Ask only ONE question at a time.

FOLLOW-UP EXAMPLES:

Learner:
"I went shopping with my friends."

Good next question:
"What did you buy?"

Learner:
"I stayed home because I was tired."

Good next question:
"What did you do at home?"

Learner:
"I watched a movie."

Good next question:
"What movie did you watch?"

Learner:
"I went to a cafe with my boyfriend."

Good next question:
"What did you have at the cafe?"

Learner:
"Good."

Good next question:
"What did you do?"

ENDING RULE:

${isFinalTurn
  ? `This is the final learner answer.
Do NOT ask another question.
Set next_question to an empty string.
Create a short, warm closing_message in English.`
  : `This is not the final turn.
Create ONE natural next_question based on the learner's answer.
Set closing_message to an empty string.`}

Return ONLY valid JSON with exactly these fields:

{
  "corrected_sentence": "string",
  "thai_explanation": "string",
  "correction_needed": true,
  "next_question": "string",
  "closing_message": "string"
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
            temperature: 0.35,
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
                },
                next_question: {
                  type: "STRING"
                },
                closing_message: {
                  type: "STRING"
                }
              },
              required: [
                "corrected_sentence",
                "thai_explanation",
                "correction_needed",
                "next_question",
                "closing_message"
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
      correction_needed: result.correction_needed,
      next_question: result.next_question,
      closing_message: result.closing_message
    });
  } catch (error) {
    console.error("Correction error:", error);

    return res.status(500).json({
      error: "Could not process learner answer"
    });
  }
});

app.listen(port, () => {
  console.log(
    `Weekend AI Speaking Lab running at http://localhost:${port}`
  );
});
