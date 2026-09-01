import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json({ limit: "1mb" }));


// ==========================================
// QUESTION BANK
// ==========================================
//
// Gemini is NOT allowed to create new questions.
// It may only choose one of these.
//
// This keeps tutor TTS predictable and reusable.

const QUESTION_BANK = {
  Q1: "Hey! How was your weekend?",
  Q2: "What did you do?",
  Q3: "Tell me more about it.",
  Q4: "Where did you go?",
  Q5: "Who were you with?",
  Q6: "What happened next?",
  Q7: "How did you feel?",
  Q8: "What did you like about it?",
  Q9: "What was the best part?",
  Q10: "Would you do it again?"
};


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


function getQuestionIdFromText(text = "") {

  const normalized =
    normalizeSpokenText(text);

  for (
    const [id, question]
    of Object.entries(QUESTION_BANK)
  ) {

    if (
      normalizeSpokenText(question) ===
      normalized
    ) {
      return id;
    }

  }

  return null;
}


function getUsedQuestionIds(
  currentQuestion,
  history = []
) {

  const used =
    new Set();


  const currentId =
    getQuestionIdFromText(
      currentQuestion
    );


  if (currentId) {
    used.add(currentId);
  }


  for (const item of history) {

    const id =
      getQuestionIdFromText(
        item?.question || ""
      );

    if (id) {
      used.add(id);
    }

  }


  return Array.from(used);
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

      if (
        !process.env.ELEVENLABS_API_KEY
      ) {

        return res
          .status(500)
          .json({
            error:
              "Missing ELEVENLABS_API_KEY"
          });

      }


      if (
        !req.body ||
        !req.body.length
      ) {

        return res
          .status(400)
          .json({
            error:
              "No audio received"
          });

      }


      const contentType =
        req.headers["content-type"] ||
        "audio/webm";


      let extension =
        "webm";


      if (
        contentType.includes("mp4")
      ) {
        extension = "m4a";
      }


      if (
        contentType.includes("mpeg")
      ) {
        extension = "mp3";
      }


      if (
        contentType.includes("wav")
      ) {
        extension = "wav";
      }


      const audioBlob =
        new Blob(
          [req.body],
          {
            type: contentType
          }
        );


      const formData =
        new FormData();


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
            method:
              "POST",

            headers: {
              "xi-api-key":
                process.env.ELEVENLABS_API_KEY
            },

            body:
              formData
          }
        );


      const data =
        await elevenResponse.json();


      if (
        !elevenResponse.ok
      ) {

        console.error(
          "ElevenLabs transcription error:",
          data
        );


        return res
          .status(
            elevenResponse.status
          )
          .json({
            error:
              "ElevenLabs transcription failed",

            details:
              data
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


      return res
        .status(500)
        .json({
          error:
            "Could not transcribe audio"
        });

    }

  }
);


// ==========================================
// ELEVENLABS TTS CACHE
// ==========================================
//
// Same text + same voice = generate once.
//
// After that:
// server reuses the existing MP3.
//
// Cache survives while this Render instance
// remains running.

const ttsCache =
  new Map();


const ttsInFlight =
  new Map();


const MAX_TTS_CACHE_ITEMS =
  200;


function saveTTSCache(
  key,
  audioBuffer
) {

  if (
    ttsCache.has(key)
  ) {
    ttsCache.delete(key);
  }


  ttsCache.set(
    key,
    audioBuffer
  );


  if (
    ttsCache.size >
    MAX_TTS_CACHE_ITEMS
  ) {

    const oldestKey =
      ttsCache
        .keys()
        .next()
        .value;


    ttsCache.delete(
      oldestKey
    );

  }

}


// ==========================================
// ELEVENLABS TEXT TO SPEECH
// ==========================================

app.post(
  "/tts",

  async (req, res) => {

    try {

      if (
        !process.env.ELEVENLABS_API_KEY
      ) {

        return res
          .status(500)
          .json({
            error:
              "Missing ELEVENLABS_API_KEY"
          });

      }


      const { text } =
        req.body;


      if (
        !text ||
        typeof text !== "string"
      ) {

        return res
          .status(400)
          .json({
            error:
              "Missing text"
          });

      }


      // Amy's cloned voice
      const voiceId =
        "4cQ2mfgiJ51P5DoueVge";


      const modelId =
        "eleven_multilingual_v2";


      const outputFormat =
        "mp3_44100_128";


      const cleanText =
        text.trim();


      const cacheKey =
        `${voiceId}|${modelId}|${outputFormat}|${cleanText}`;


      // ====================================
      // CACHE HIT
      // ====================================

      if (
        ttsCache.has(cacheKey)
      ) {

        console.log(
          "✅ TTS CACHE HIT:",
          cleanText
        );


        res.setHeader(
          "Content-Type",
          "audio/mpeg"
        );


        res.setHeader(
          "X-TTS-Cache",
          "HIT"
        );


        return res.send(
          ttsCache.get(cacheKey)
        );

      }


      // ====================================
      // SAME REQUEST ALREADY GENERATING
      // ====================================

      if (
        ttsInFlight.has(
          cacheKey
        )
      ) {

        console.log(
          "⏳ TTS SHARED REQUEST:",
          cleanText
        );


        const audioBuffer =
          await ttsInFlight.get(
            cacheKey
          );


        res.setHeader(
          "Content-Type",
          "audio/mpeg"
        );


        res.setHeader(
          "X-TTS-Cache",
          "SHARED"
        );


        return res.send(
          audioBuffer
        );

      }


      // ====================================
      // CACHE MISS
      // ====================================

      console.log(
        "💰 TTS CACHE MISS:",
        cleanText
      );


      const generateAudio =
        (async () => {

          const elevenResponse =
            await fetch(

              `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`,

              {
                method:
                  "POST",

                headers: {

                  "xi-api-key":
                    process.env.ELEVENLABS_API_KEY,

                  "Content-Type":
                    "application/json"

                },


                body:
                  JSON.stringify({

                    text:
                      cleanText,

                    model_id:
                      modelId,

                    voice_settings: {

                      stability:
                        0.45,

                      similarity_boost:
                        0.75,

                      style:
                        0.15,

                      use_speaker_boost:
                        true

                    }

                  })
              }

            );


          if (
            !elevenResponse.ok
          ) {

            const errorText =
              await elevenResponse.text();


            console.error(
              "ElevenLabs TTS error:",
              errorText
            );


            throw new Error(
              `ElevenLabs TTS failed: ${errorText}`
            );

          }


          const arrayBuffer =
            await elevenResponse
              .arrayBuffer();


          const audioBuffer =
            Buffer.from(
              arrayBuffer
            );


          saveTTSCache(
            cacheKey,
            audioBuffer
          );


          return audioBuffer;

        })();


      ttsInFlight.set(
        cacheKey,
        generateAudio
      );


      try {

        const audioBuffer =
          await generateAudio;


        res.setHeader(
          "Content-Type",
          "audio/mpeg"
        );


        res.setHeader(
          "X-TTS-Cache",
          "MISS"
        );


        return res.send(
          audioBuffer
        );


      } finally {

        ttsInFlight.delete(
          cacheKey
        );

      }


    } catch (error) {

      console.error(
        "TTS error:",
        error
      );


      return res
        .status(500)
        .json({
          error:
            "Could not generate speech"
        });

    }

  }
);


// ==========================================
// GEMINI
// CORRECTION + RELEVANCE + QUESTION PICKER
// ==========================================

app.post(
  "/correct",

  async (req, res) => {

    try {

      const {
        transcript,
        turn = 1,
        current_question = "",
        history = []
      } = req.body;


      if (
        !process.env.GEMINI_API_KEY
      ) {

        return res
          .status(500)
          .json({
            error:
              "Missing GEMINI_API_KEY"
          });

      }


      if (
        !transcript ||
        typeof transcript !== "string"
      ) {

        return res
          .status(400)
          .json({
            error:
              "Missing transcript"
          });

      }


      const isFinalTurn =
        Number(turn) >= 5;


      const usedQuestionIds =
        getUsedQuestionIds(
          current_question,
          history
        );


      const availableQuestionIds =
        Object
          .keys(QUESTION_BANK)
          .filter(
            (id) =>
              !usedQuestionIds.includes(id)
          );


      const questionBankText =
        Object
          .entries(QUESTION_BANK)
          .map(
            ([id, question]) =>
              `${id}: "${question}"`
          )
          .join("\n");


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


USED QUESTION IDS:
${JSON.stringify(usedQuestionIds)}


AVAILABLE QUESTION IDS:
${JSON.stringify(availableQuestionIds)}


QUESTION BANK:

${questionBankText}


==========================================
VERY IMPORTANT
==========================================

You are NOT allowed to write or invent a new tutor question.

You may ONLY choose a question ID
from QUESTION BANK.

Do not modify the wording of the question.

Do not combine questions.

Do not create a variation.

Your job is only to SELECT the most natural next question.


==========================================
1. ANSWER RELEVANCE
==========================================

answer_relevant = true when the learner:
- answers the current question
- gives clearly related information
- gives a natural short conversational answer


answer_relevant = false when:
- the answer is unrelated
- the learner changes topic completely
- the answer clearly does not respond to the question


Example:

Question:
"Did you enjoy it?"

Answer:
"Yes, I did."

Relevant.


Question:
"Did you enjoy it?"

Answer:
"I love vegetables."

Not relevant.


If answer_relevant = false:

- Do not praise the answer.
- Give a short Thai relevance_explanation.
- Explain what the current question is asking.
- Give ONE simple example_answer.
- next_question_id must be "".
- closing_message must be "".
- The learner must answer the SAME question again.


==========================================
2. SPOKEN ENGLISH CORRECTION
==========================================

This is SPOKEN English practice.

Only correct meaningful spoken mistakes such as:

- wrong tense
- wrong verb form
- missing important subject
- missing important verb
- incorrect sentence structure
- clearly unnatural word choice
- mistakes that affect spoken meaning


DO NOT correct:

- punctuation
- periods
- commas
- question marks
- exclamation marks
- capitalization
- written formatting
- speech-to-text sentence separation


VERY IMPORTANT:

If the original and corrected sentence
would sound identical when spoken:

correction_needed = false.


Example:

"I bought snacks and food"

and

"I bought snacks and food."

are the same spoken sentence.

Do NOT correct it.


Never claim a word was added
if that word already exists in the transcript.


Preserve the learner's meaning.

NEVER invent facts such as:

- places
- people
- colors
- objects
- activities
- times
- reasons
- opinions
- events


==========================================
3. THAI EXPLANATION
==========================================

When correction_needed = true:

- Explain only the real spoken correction.
- Keep it short.
- Beginner-friendly Thai.
- Do not explain punctuation.
- Do not invent corrections.
- Do not use "ครับ".
- Use friendly neutral Thai.


When correction_needed = false:

thai_explanation = "".


==========================================
4. CHOOSE NEXT QUESTION
==========================================

Only do this when:

answer_relevant = true

AND

this is NOT the final turn.


Choose ONE question ID
from AVAILABLE QUESTION IDS.


Choose the question that follows most naturally
from what the learner actually said.


Examples:

Learner:
"I went shopping."

Good choices:
Q4 "Where did you go?"
Q5 "Who were you with?"
Q3 "Tell me more about it."


Learner:
"I went to the beach with my boyfriend."

Do NOT choose:
Q5 "Who were you with?"

because they already said who they were with.

Better choices:
Q7 "How did you feel?"
Q8 "What did you like about it?"
Q9 "What was the best part?"


Learner:
"I stayed home and watched movies."

Good choices:
Q3 "Tell me more about it."
Q7 "How did you feel?"
Q9 "What was the best part?"


Do not choose a question
whose answer the learner already clearly gave.


Do not choose a USED question ID.


==========================================
5. ENDING
==========================================

If answer_relevant = false:

next_question_id = ""
closing_message = ""


If answer_relevant = true
and this is not the final turn:

Choose one available next_question_id.

closing_message = ""


If this is the final turn:

next_question_id = ""

Give a short friendly closing_message
in English.


==========================================
RETURN JSON
==========================================

Return ONLY valid JSON:

{
  "corrected_sentence": "string",
  "thai_explanation": "string",
  "correction_needed": true,
  "answer_relevant": true,
  "relevance_explanation": "string",
  "example_answer": "string",
  "next_question_id": "string",
  "closing_message": "string"
}
`.trim();


      const geminiResponse =
        await fetch(

          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",

          {
            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              "x-goog-api-key":
                process.env.GEMINI_API_KEY

            },


            body:
              JSON.stringify({

                contents: [
                  {
                    parts: [
                      {
                        text:
                          prompt
                      }
                    ]
                  }
                ],


                generationConfig: {

                  temperature:
                    0.05,

                  responseMimeType:
                    "application/json",

                  responseSchema: {

                    type:
                      "OBJECT",

                    properties: {

                      corrected_sentence: {
                        type:
                          "STRING"
                      },

                      thai_explanation: {
                        type:
                          "STRING"
                      },

                      correction_needed: {
                        type:
                          "BOOLEAN"
                      },

                      answer_relevant: {
                        type:
                          "BOOLEAN"
                      },

                      relevance_explanation: {
                        type:
                          "STRING"
                      },

                      example_answer: {
                        type:
                          "STRING"
                      },

                      next_question_id: {
                        type:
                          "STRING"
                      },

                      closing_message: {
                        type:
                          "STRING"
                      }

                    },


                    required: [
                      "corrected_sentence",
                      "thai_explanation",
                      "correction_needed",
                      "answer_relevant",
                      "relevance_explanation",
                      "example_answer",
                      "next_question_id",
                      "closing_message"
                    ]

                  }

                }

              })

          }

        );


      const data =
        await geminiResponse.json();


      if (
        !geminiResponse.ok
      ) {

        console.error(
          "Gemini error:",
          data
        );


        return res
          .status(
            geminiResponse.status
          )
          .json({

            error:
              "Gemini request failed",

            details:
              data

          });

      }


      const text =
        data
          ?.candidates?.[0]
          ?.content
          ?.parts?.[0]
          ?.text;


      if (!text) {

        return res
          .status(500)
          .json({
            error:
              "Gemini returned no text"
          });

      }


      const result =
        JSON.parse(text);


      // ======================================
      // HARD CORRECTION SAFETY
      // ======================================

      const originalNormalized =
        normalizeSpokenText(
          transcript
        );


      const correctedNormalized =
        normalizeSpokenText(
          result.corrected_sentence ||
          ""
        );


      let correctionNeeded =
        Boolean(
          result.correction_needed
        );


      let correctedSentence =
        result.corrected_sentence ||
        transcript;


      let thaiExplanation =
        result.thai_explanation ||
        "";


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


      // ======================================
      // VALIDATE QUESTION ID
      // ======================================

      let nextQuestionId =
        result.next_question_id ||
        "";


      let nextQuestion =
        "";


      if (
        !isFinalTurn &&
        result.answer_relevant === true
      ) {

        // Gemini selected something invalid
        // or already used
        if (
          !availableQuestionIds.includes(
            nextQuestionId
          )
        ) {

          nextQuestionId =
            availableQuestionIds[0] || "";

        }


        nextQuestion =
          QUESTION_BANK[
            nextQuestionId
          ] || "";

      }


      // Irrelevant answer:
      // learner stays on same question
      if (
        result.answer_relevant === false
      ) {

        nextQuestionId =
          "";

        nextQuestion =
          "";

      }


      // Final turn:
      // no more questions
      if (isFinalTurn) {

        nextQuestionId =
          "";

        nextQuestion =
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


        next_question_id:
          nextQuestionId,


        // App can still use next_question
        // exactly like before.
        next_question:
          nextQuestion,


        closing_message:
          result.closing_message

      });


    } catch (error) {

      console.error(
        "Correction error:",
        error
      );


      return res
        .status(500)
        .json({
          error:
            "Could not process learner answer"
        });

    }

  }
);


// ==========================================
// START SERVER
// ==========================================

app.listen(
  port,
  () => {

    console.log(
      `Weekend AI Speaking Lab running at http://localhost:${port}`
    );

  }
);
