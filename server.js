import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json({ limit: "1mb" }));


// ==========================================
// HELPERS
// ==========================================

function normalizeSpokenText(text = "") {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


// ==========================================
// ELEVENLABS SPEECH TO TEXT
// ==========================================

app.post(
  "/transcribe",
  express.raw({
    type: [
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "application/octet-stream"
    ],
    limit: "25mb"
  }),
  async (req, res) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        return res.status(500).json({
          error: "Missing ELEVENLABS_API_KEY"
        });
      }

      if (!req.body || !req.body.length) {
        return res.status(400).json({
          error: "No audio received"
        });
      }

      const contentType =
        req.headers["content-type"] || "audio/webm";

      let extension = "webm";

      if (contentType.includes("mp4")) {
        extension = "m4a";
      }

      if (contentType.includes("mpeg")) {
        extension = "mp3";
      }

      if (contentType.includes("wav")) {
        extension = "wav";
      }

      const audioBlob = new Blob(
        [req.body],
        { type: contentType }
      );

      const formData = new FormData();

      formData.append(
        "file",
        audioBlob,
        `answer.${extension}`
      );

      formData.append(
        "model_id",
        "scribe_v2"
      );

      formData.append(
        "language_code",
        "eng"
      );

      formData.append(
        "tag_audio_events",
        "false"
      );

      const elevenResponse =
        await fetch(
          "https://api.elevenlabs.io/v1/speech-to-text",
          {
            method: "POST",

            headers: {
              "xi-api-key":
                process.env.ELEVENLABS_API_KEY
            },

            body: formData
          }
        );

      const data =
        await elevenResponse.json();

      if (!elevenResponse.ok) {
        console.error(
          "ElevenLabs transcription error:",
          data
        );

        return res
          .status(elevenResponse.status)
          .json({
            error:
              "ElevenLabs transcription failed",

            details: data
          });
      }

      const transcript =
        data?.text?.trim() || "";

      return res.json({
        transcript
      });

    } catch (error) {
      console.error(
        "Transcription error:",
        error
      );

      return res.status(500).json({
        error:
          "Could not transcribe audio"
      });
    }
  }
);


// ==========================================
// ELEVENLABS TEXT TO SPEECH
// ==========================================

app.post("/tts", async (req, res) => {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(500).json({
        error: "Missing ELEVENLABS_API_KEY"
      });
    }

    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Missing text"
      });
    }

    const voiceId =
      "4cQ2mfgiJ51P5DoueVge";

    const elevenResponse =
      await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",

          headers: {
            "xi-api-key":
              process.env.ELEVENLABS_API_KEY,

            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            text,

            model_id:
              "eleven_multilingual_v2",

            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.75,
              style: 0.15,
              use_speaker_boost: true
            }
          })
        }
      );

    if (!elevenResponse.ok) {
      const errorText =
        await elevenResponse.text();

      console.error(
        "ElevenLabs TTS error:",
        errorText
      );

      return res
        .status(elevenResponse.status)
        .json({
          error:
            "ElevenLabs TTS failed",

          details: errorText
        });
    }

    const audioBuffer =
      await elevenResponse.arrayBuffer();

    res.setHeader(
      "Content-Type",
      "audio/mpeg"
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res.send(
      Buffer.from(audioBuffer)
    );

  } catch (error) {
    console.error(
      "TTS error:",
      error
    );

    return res.status(500).json({
      error:
        "Could not generate speech"
    });
  }
});


// ==========================================
// GEMINI CORRECTION + RELEVANCE
// ==========================================

app.post("/correct", async (req, res) => {
  try {
    const {
      transcript,
      turn = 1,
      current_question = "",
      history = []
    } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY"
      });
    }

    if (
      !transcript ||
      typeof transcript !== "string"
    ) {
      return res.status(400).json({
        error: "Missing transcript"
      });
    }

    const isFinalTurn =
      Number(turn) >= 5;

    const prompt = `
You are an English speaking coach for Thai beginner learners.

LESSON:
My Weekend

CURRENT QUESTION:
"${current_question}"

PREVIOUS CONVERSATION:
${JSON.stringify(history)}

LEARNER'S CURRENT SPOKEN ANSWER:
"${transcript}"

CURRENT TURN:
${turn} of 5


IMPORTANT:
This is SPOKEN English practice, not writing practice.

You must evaluate TWO things:

1. LANGUAGE QUALITY
2. ANSWER RELEVANCE


==========================================
ANSWER RELEVANCE
==========================================

answer_relevant = true when the learner:
- directly answers the question
- gives information that clearly responds to the question
- gives a natural short conversational answer

answer_relevant = false when the learner:
- says something unrelated
- changes topic completely
- gives an answer that clearly does not respond to what was asked

Example:

Question:
"Did you win the game?"

"I love vegetables."
answer_relevant = false

"Yes, I did."
answer_relevant = true

"No, we lost."
answer_relevant = true


If answer_relevant = false:

- Do not praise the answer as correct.
- relevance_explanation must be short Thai.
- Explain what the question is asking.
- Give ONE simple example_answer.
- Never pretend the example answer is something the learner actually did.
- next_question must be empty.
- closing_message must be empty.


==========================================
SPOKEN CORRECTION RULES
==========================================

Only correct meaningful SPOKEN mistakes.

Correct things like:
- wrong tense
- wrong verb form
- missing important subject or verb
- incorrect sentence structure
- clearly unnatural word choice
- grammar errors that affect spoken English

DO NOT correct:
- punctuation
- periods
- commas
- exclamation marks
- question marks
- capitalization
- written formatting
- sentence separation created by speech-to-text

VERY IMPORTANT:

If the original answer and corrected sentence
would sound IDENTICAL when spoken,
correction_needed MUST be false.

Example:

Original:
"I bought snacks and food"

Corrected:
"I bought snacks and food."

This is NOT a correction.
correction_needed = false.

Original:
"i went shopping"

Corrected:
"I went shopping."

This is NOT a correction.
correction_needed = false.


NEVER claim that a word was added,
removed, or changed if that word already appears
in the learner's transcript.

Example:

If learner said:
"I bought snacks and food"

DO NOT say:
"เพิ่ม I"
DO NOT say:
"เพิ่ม bought"

because both words are already present.


Preserve the learner's intended meaning.

NEVER invent:
- places
- people
- colors
- objects
- activities
- times
- reasons
- opinions
- events

Do not guess missing personal information.


==========================================
THAI EXPLANATION
==========================================

When correction_needed = true:

- Explain only the REAL spoken correction.
- Keep it short.
- Use beginner-friendly Thai.
- Do not explain punctuation.
- Do not invent corrections.
- Do not use "ครับ".
- Use neutral friendly Thai such as "ค่ะ" or no ending particle.

When correction_needed = false:

thai_explanation must be an empty string.


==========================================
NEXT QUESTION
==========================================

Only create next_question when
answer_relevant = true.

It must:
- follow naturally from what the learner actually said
- stay related to the weekend conversation
- ask only ONE thing
- be beginner-friendly
- sound natural

Do not ask definition questions.

Examples:

"I went shopping with my friends."
→ "What did you buy?"

"I bought a black bag."
→ "Where did you buy it?"

"I stayed home because I was tired."
→ "What did you do at home?"


==========================================
ENDING
==========================================

If answer_relevant = false:
- next_question = ""
- closing_message = ""

If answer_relevant = true:
${
  isFinalTurn
    ? `
This is the final answer.
Set next_question to "".
Give a short friendly closing_message in English.
`
    : `
Create ONE natural next_question.
Set closing_message to "".
`
}


Return ONLY valid JSON:

{
  "corrected_sentence": "string",
  "thai_explanation": "string",
  "correction_needed": true,
  "answer_relevant": true,
  "relevance_explanation": "string",
  "example_answer": "string",
  "next_question": "string",
  "closing_message": "string"
}
`.trim();


    const geminiResponse =
      await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-goog-api-key":
              process.env.GEMINI_API_KEY
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
              temperature: 0.05,

              responseMimeType:
                "application/json",

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

                  answer_relevant: {
                    type: "BOOLEAN"
                  },

                  relevance_explanation: {
                    type: "STRING"
                  },

                  example_answer: {
                    type: "STRING"
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
                  "answer_relevant",
                  "relevance_explanation",
                  "example_answer",
                  "next_question",
                  "closing_message"
                ]
              }
            }
          })
        }
      );


    const data =
      await geminiResponse.json();


    if (!geminiResponse.ok) {
      console.error(
        "Gemini error:",
        data
      );

      return res
        .status(geminiResponse.status)
        .json({
          error:
            "Gemini request failed",

          details: data
        });
    }


    const text =
      data?.candidates?.[0]
        ?.content?.parts?.[0]?.text;


    if (!text) {
      return res.status(500).json({
        error:
          "Gemini returned no text"
      });
    }


    const result =
      JSON.parse(text);


    // ======================================
    // HARD SAFETY CHECK
    // Ignore punctuation/capitalization-only
    // changes even if Gemini gets it wrong.
    // ======================================

    const originalNormalized =
      normalizeSpokenText(
        transcript
      );

    const correctedNormalized =
      normalizeSpokenText(
        result.corrected_sentence || ""
      );


    let correctionNeeded =
      Boolean(
        result.correction_needed
      );

    let correctedSentence =
      result.corrected_sentence ||
      transcript;

    let thaiExplanation =
      result.thai_explanation || "";


    if (
      originalNormalized ===
      correctedNormalized
    ) {
      correctionNeeded =
        false;

      correctedSentence =
        transcript;

      thaiExplanation =
        "";
    }


    return res.json({
      transcript,

      corrected_sentence:
        correctedSentence,

      thai_explanation:
        thaiExplanation,

      correction_needed:
        correctionNeeded,

      answer_relevant:
        result.answer_relevant,

      relevance_explanation:
        result.relevance_explanation,

      example_answer:
        result.example_answer,

      next_question:
        result.next_question,

      closing_message:
        result.closing_message
    });

  } catch (error) {
    console.error(
      "Correction error:",
      error
    );

    return res.status(500).json({
      error:
        "Could not process learner answer"
    });
  }
});


app.listen(port, () => {
  console.log(
    `Weekend AI Speaking Lab running at http://localhost:${port}`
  );
});
