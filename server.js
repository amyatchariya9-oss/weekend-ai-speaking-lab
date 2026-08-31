import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json({ limit: "1mb" }));


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
      "jqcCZkN6Knx8BJ5TBdYR";

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
// GEMINI CORRECTION + NEXT QUESTION
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

Your job has TWO parts:
1. Evaluate the learner's spoken English.
2. Continue the conversation naturally.

CORRECTION RULES:
- Preserve the learner's intended meaning.
- NEVER invent facts the learner did not say.
- NEVER invent colors, places, people, activities, objects, times, reasons, or opinions.
- Do not change factual meaning.
- Do not guess missing information.
- Correct only mistakes you can confidently identify.

Only correct meaningful SPOKEN English mistakes such as:
- wrong tense
- wrong verb form
- missing an important verb
- incorrect sentence structure
- unnatural word choice
- errors that make the spoken meaning unclear

Do NOT correct or comment on:
- punctuation
- commas
- periods
- capitalization
- written formatting
- sentence separation caused by speech-to-text

If the learner's spoken English is understandable and natural enough,
set correction_needed to false.

THAI EXPLANATION:
When correction_needed is true:
- Explain the important correction briefly in Thai.
- Keep it beginner-friendly.
- Explain spoken grammar, not writing rules.

When correction_needed is false:
- thai_explanation must be an empty string.

NEXT QUESTION:
Use the CURRENT QUESTION, CURRENT ANSWER, and PREVIOUS CONVERSATION.

The next question must:
- follow naturally from what the learner actually said
- stay related to their weekend
- be easy for a beginner
- ask only ONE thing
- sound like a real conversation

Do NOT ask strange definition questions such as:
"What is black?"
"What is shopping?"
"What is tired?"

Instead ask about the learner's experience.

Examples:

Learner:
"I went shopping with my friends."

Good:
"What did you buy?"

Learner:
"I bought a black bag."

Good:
"Where did you buy it?"

Learner:
"My car is black."

Good:
"Where did you drive?"

Learner:
"I stayed home because I was tired."

Good:
"What did you do at home?"

ENDING:

${
  isFinalTurn
    ? `
This is the final learner answer.
Set next_question to an empty string.
Give a short friendly closing_message in English.
`
    : `
Create ONE natural next_question.
Set closing_message to an empty string.
`
}

Return ONLY valid JSON:

{
  "corrected_sentence": "string",
  "thai_explanation": "string",
  "correction_needed": true,
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
              temperature: 0.2,

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

    return res.json({
      transcript,

      corrected_sentence:
        result.corrected_sentence,

      thai_explanation:
        result.thai_explanation,

      correction_needed:
        result.correction_needed,

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
