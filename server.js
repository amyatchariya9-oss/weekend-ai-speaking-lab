import "dotenv/config";

import express from "express";
import fs from "fs";
import path from "path";

import {
  fileURLToPath
} from "url";


// ==========================================
// APP
// ==========================================

const app = express();

const PORT =
  process.env.PORT || 3000;


// ==========================================
// PATHS
// ==========================================

const __filename =
  fileURLToPath(
    import.meta.url
  );

const __dirname =
  path.dirname(
    __filename
  );

const PUBLIC_DIR =
  path.join(
    __dirname,
    "public"
  );

const LESSONS_PATH =
  path.join(
    PUBLIC_DIR,
    "lessons.json"
  );


// ==========================================
// LOAD LESSONS
// ==========================================

function loadLessons() {

  try {

    const raw =
      fs.readFileSync(
        LESSONS_PATH,
        "utf8"
      );


    return JSON.parse(raw);

  }

  catch (error) {

    console.error(
      "Could not load lessons.json:",
      error
    );


    return {};

  }

}


const LESSONS =
  loadLessons();


// ==========================================
// MIDDLEWARE
// ==========================================

app.use(
  express.static(
    PUBLIC_DIR
  )
);


app.use(
  express.json({
    limit: "1mb"
  })
);


// ==========================================
// HELPERS
// ==========================================

function getLesson(
  lessonId = "weekend"
) {

  return (
    LESSONS[lessonId] ||
    null
  );

}


function normalizeSpokenText(
  text = ""
) {

  return String(text)
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function normalizeQuestion(
  text = ""
) {

  return String(text)
    .toLowerCase()
    .replace(
      /[.,!?;:'"]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function getQuestionById(
  lesson,
  questionId
) {

  if (
    !lesson ||
    !Array.isArray(
      lesson.questions
    )
  ) {

    return null;

  }


  return (
    lesson.questions.find(
      (question) =>
        question.id ===
        questionId
    ) ||
    null
  );

}


function getQuestionIdFromText(
  lesson,
  text
) {

  if (
    !lesson ||
    !Array.isArray(
      lesson.questions
    )
  ) {

    return null;

  }


  const normalized =
    normalizeQuestion(
      text
    );


  const match =
    lesson.questions.find(
      (question) =>
        normalizeQuestion(
          question.text
        ) === normalized
    );


  return match
    ? match.id
    : null;

}


function getUsedQuestionIds(
  lesson,
  history,
  currentQuestion
) {

  const used =
    new Set();


  if (
    Array.isArray(history)
  ) {

    for (
      const item of history
    ) {

      const id =
        getQuestionIdFromText(
          lesson,
          item?.question
        );


      if (id) {

        used.add(id);

      }

    }

  }


  const currentId =
    getQuestionIdFromText(
      lesson,
      currentQuestion
    );


  if (currentId) {

    used.add(
      currentId
    );

  }


  return used;

}


function getAvailableQuestionIds(
  lesson,
  usedIds
) {

  if (
    !lesson ||
    !Array.isArray(
      lesson.questions
    )
  ) {

    return [];

  }


  return lesson.questions
    .map(
      (question) =>
        question.id
    )
    .filter(
      (id) =>
        !usedIds.has(id)
    );

}


// ==========================================
// HEALTH
// ==========================================

app.get(
  "/health",
  (req, res) => {

    res.json({

      ok: true,

      lessons:
        Object.keys(
          LESSONS
        )

    });

  }
);


// ==========================================
// SPEECH TO TEXT
// ELEVENLABS SCRIBE V2
// ==========================================

app.post(
  "/transcribe",

  express.raw({
    type: "*/*",
    limit: "25mb"
  }),

  async (req, res) => {

    try {

      const apiKey =
        process.env
          .ELEVENLABS_API_KEY;


      if (!apiKey) {

        return res
          .status(500)
          .json({
            error:
              "ELEVENLABS_API_KEY is missing."
          });

      }


      if (
        !req.body ||
        req.body.length === 0
      ) {

        return res
          .status(400)
          .json({
            error:
              "No audio received."
          });

      }


      const contentType =
        req.headers[
          "content-type"
        ] ||
        "audio/webm";


      let extension =
        "webm";


      if (
        contentType.includes(
          "mp4"
        )
      ) {

        extension = "mp4";

      }

      else if (
        contentType.includes(
          "mpeg"
        ) ||
        contentType.includes(
          "mp3"
        )
      ) {

        extension = "mp3";

      }

      else if (
        contentType.includes(
          "wav"
        )
      ) {

        extension = "wav";

      }

      else if (
        contentType.includes(
          "m4a"
        )
      ) {

        extension = "m4a";

      }


      const formData =
        new FormData();


      const audioBlob =
        new Blob(
          [req.body],
          {
            type:
              contentType
          }
        );


      formData.append(
        "file",
        audioBlob,
        `recording.${extension}`
      );


      formData.append(
        "model_id",
        "scribe_v2"
      );


      // IMPORTANT:
      // Do NOT force language_code="eng".
      // Students may speak Thai
      // when asking for help.


      formData.append(
        "tag_audio_events",
        "false"
      );


      const response =
        await fetch(
          "https://api.elevenlabs.io/v1/speech-to-text",
          {
            method: "POST",

            headers: {
              "xi-api-key":
                apiKey
            },

            body:
              formData
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        console.error(
          "ElevenLabs error:",
          data
        );


        return res
          .status(
            response.status
          )
          .json({
            error:
              data?.detail?.message ||
              data?.detail ||
              data?.error ||
              "Speech recognition failed."
          });

      }


      const transcript =
        String(
          data?.text ||
          ""
        ).trim();


      res.json({
        transcript
      });

    }

    catch (error) {

      console.error(
        "Transcription error:",
        error
      );


      res
        .status(500)
        .json({
          error:
            "Could not transcribe audio."
        });

    }

  }
);


// ==========================================
// AI CORRECTION + HELP
// ==========================================

app.post(
  "/correct",

  async (req, res) => {

    try {

      const {

        lesson_id =
          "weekend",

        transcript =
          "",

        turn =
          1,

        current_question =
          "",

        history =
          []

      } =
        req.body || {};


      // ======================================
      // API KEY
      // ======================================

      const apiKey =
        process.env
          .GEMINI_API_KEY;


      if (!apiKey) {

        return res
          .status(500)
          .json({
            error:
              "GEMINI_API_KEY is missing."
          });

      }


      // ======================================
      // LESSON
      // ======================================

      const lesson =
        getLesson(
          lesson_id
        );


      if (!lesson) {

        return res
          .status(400)
          .json({
            error:
              `Unknown lesson: ${lesson_id}`
          });

      }


      if (
        !Array.isArray(
          lesson.questions
        ) ||
        lesson.questions.length === 0
      ) {

        return res
          .status(500)
          .json({
            error:
              "This lesson has no questions."
          });

      }


      // ======================================
      // TRANSCRIPT
      // ======================================

      const cleanTranscript =
        String(
          transcript
        ).trim();


      if (!cleanTranscript) {

        return res
          .status(400)
          .json({
            error:
              "Transcript is empty."
          });

      }


      // ======================================
      // LESSON STATE
      // ======================================

      const totalTurns =
        Number(
          lesson.turns
        ) || 5;


      const isFinalTurn =
        Number(turn) >=
        totalTurns;


      const usedQuestionIds =
        getUsedQuestionIds(
          lesson,
          history,
          current_question
        );


      const availableQuestionIds =
        getAvailableQuestionIds(
          lesson,
          usedQuestionIds
        );


      const questionList =
        lesson.questions
          .map(
            (question) =>
              `${question.id}: ${question.text}`
          )
          .join("\n");


      const availableQuestionList =
        availableQuestionIds.length > 0
          ? availableQuestionIds
              .map(
                (id) => {

                  const question =
                    getQuestionById(
                      lesson,
                      id
                    );


                  return (
                    `${id}: ${question?.text || ""}`
                  );

                }
              )
              .join("\n")

          : "NONE";


      const historyText =
        Array.isArray(history) &&
        history.length > 0

          ? history
              .map(
                (
                  item,
                  index
                ) => {

                  return [
                    `Turn ${index + 1}`,
                    `Question: ${item?.question || ""}`,
                    `Learner: ${item?.answer || ""}`,
                    `Final answer: ${item?.corrected_answer || item?.answer || ""}`
                  ].join("\n");

                }
              )
              .join("\n\n")

          : "No previous turns.";


// ==========================================
// GEMINI PROMPT
// ==========================================

const prompt = `
You are a friendly English speaking coach for Thai beginner learners.

COURSE:
Real English: Everyday Conversations

CURRENT LESSON:
${lesson.title || lesson_id}

CURRENT TURN:
${turn} of ${totalTurns}

CURRENT QUESTION:
${current_question}

LEARNER SAID:
${cleanTranscript}


QUESTION BANK:
${questionList}


QUESTIONS AVAILABLE FOR THE NEXT TURN:
${availableQuestionList}


PREVIOUS CONVERSATION:
${historyText}


================================================
VERY IMPORTANT: HELP REQUESTS
================================================

The learner is a Thai beginner.

The learner may ask for help in ENGLISH OR THAI.

Examples include, but are NOT limited to:

English:
- I don't understand.
- I don't get it.
- What does that mean?
- What does "what kind" mean?
- Can you explain?
- Can you explain the question?
- I don't know how to answer.
- I don't know what to say.
- I can't answer.
- What should I say?
- How do I answer this?

Thai:
- ไม่เข้าใจ
- ไม่เข้าใจคำถาม
- แปลว่าอะไร
- หมายความว่าอะไร
- คำถามนี้แปลว่าอะไร
- คำถามนี้หมายความว่าอะไร
- ตอบยังไง
- ต้องตอบว่าอะไร
- ไม่รู้จะตอบอะไร
- ไม่รู้จะตอบยังไง
- พูดยังไง
- ไม่รู้พูดว่าอะไร

The learner may also mix Thai and English.

Examples:
- what kind แปลว่าอะไร
- question นี้หมายความว่าอะไร
- I don't understand คำถาม
- คำนี้แปลว่าอะไร

Do NOT require an exact phrase.

Use the meaning and intention of what the learner said.

If the learner is clearly:
- asking what the question means
- asking what a word or phrase means
- asking how to answer
- saying they do not understand
- saying they do not know what to say

then:

help_requested = true

THIS IS NOT A WRONG ANSWER.

When help_requested = true:

1. Explain the CURRENT QUESTION in simple Thai.

2. If the learner asked about a specific English word or phrase,
explain that word or phrase in Thai.

3. If there is an important phrase in the question that a beginner
may not understand, explain it briefly.

4. Give ONE simple English example answer.

5. Keep the explanation short and beginner-friendly.

6. Do NOT change to another question.

7. next_question_id MUST be "".

8. correction_needed MUST be false.

9. answer_relevant MUST be false.

10. corrected_sentence must remain the learner's original transcript.

The learner will answer the SAME question again.


EXAMPLE:

CURRENT QUESTION:
What kind of food do you like?

LEARNER:
what kind แปลว่าอะไร

GOOD HELP:

help_explanation:
คำถามนี้หมายถึง “คุณชอบอาหารประเภทไหน?”
“What kind of” แปลว่า “ประเภทไหน / แบบไหน”

help_example:
I like Thai food.


ANOTHER EXAMPLE:

CURRENT QUESTION:
How would you describe yourself?

LEARNER:
ไม่รู้จะตอบยังไง

GOOD HELP:

help_explanation:
คำถามนี้ถามว่า “คุณจะอธิบายว่าตัวเองเป็นคนแบบไหน?”
ลองพูดถึงนิสัยของตัวเอง เช่น friendly, shy, funny หรือ hardworking

help_example:
I'm friendly and a little shy.


================================================
NORMAL ANSWERS
================================================

If the learner is NOT asking for help:

help_requested = false
help_explanation = ""
help_example = ""


Decide whether the learner actually answered the CURRENT QUESTION.

If the answer is NOT relevant:

answer_relevant = false
correction_needed = false
corrected_sentence = learner's original transcript
next_question_id = ""

Give a short Thai explanation of what the question is asking.

Give ONE simple English example answer.


================================================
SPOKEN ENGLISH CORRECTION
================================================

If the answer IS relevant:

answer_relevant = true

This is SPOKEN English.

Evaluate what the learner SAID,
not written punctuation or formatting.

Correct meaningful spoken problems such as:

- incorrect tense
- incorrect verb form
- missing important subject
- missing important verb
- incorrect sentence structure
- clearly unnatural word choice
- mistakes that make the meaning confusing


DO NOT correct:

- punctuation
- capitalization
- commas
- periods
- question marks
- transcript formatting
- harmless spoken-English informality
- natural conversational fragments
  when the meaning is clear


IMPORTANT:

Preserve the learner's intended meaning.

NEVER invent information.

Do NOT invent:

- colors
- places
- people
- activities
- objects
- dates
- times
- reasons
- opinions
- events


If the learner's spoken English is already natural:

correction_needed = false
corrected_sentence = learner's original transcript
thai_explanation = ""


If a meaningful correction is needed:

correction_needed = true
corrected_sentence = a natural corrected version
thai_explanation = a SHORT beginner-friendly Thai explanation
next_question_id = ""


Do not give punctuation advice.

Do not give capitalization advice.

Do not claim you added a word
if the learner already said that word.

Use friendly neutral Thai.

Do not use "ครับ".


================================================
NEXT QUESTION
================================================

Only choose a next question if ALL are true:

- help_requested = false
- answer_relevant = true
- correction_needed = false
- this is NOT the final turn
- an unused question is available


The next question MUST be selected ONLY from:

${availableQuestionIds.join(", ") || "NONE"}


Choose the question that follows the conversation naturally.

Do NOT ask something the learner has already clearly answered.

Do NOT invent a question.

Do NOT rewrite a question.

Return only the exact question ID.


If:
- help was requested
- the answer was irrelevant
- correction is needed
- this is the final turn
- no question is available

then:

next_question_id = ""
`;


// ==========================================
// GEMINI REQUEST
// ==========================================

      const geminiResponse =
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                contents: [
                  {
                    role:
                      "user",

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
                    0.2,

                  responseMimeType:
                    "application/json",

                  responseSchema: {

                    type:
                      "OBJECT",

                    properties: {

                      help_requested: {
                        type:
                          "BOOLEAN"
                      },

                      help_explanation: {
                        type:
                          "STRING"
                      },

                      help_example: {
                        type:
                          "STRING"
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

                      correction_needed: {
                        type:
                          "BOOLEAN"
                      },

                      corrected_sentence: {
                        type:
                          "STRING"
                      },

                      thai_explanation: {
                        type:
                          "STRING"
                      },

                      next_question_id: {
                        type:
                          "STRING"
                      }

                    },

                    required: [

                      "help_requested",
                      "help_explanation",
                      "help_example",

                      "answer_relevant",
                      "relevance_explanation",
                      "example_answer",

                      "correction_needed",
                      "corrected_sentence",
                      "thai_explanation",

                      "next_question_id"

                    ]
                  }
                }
              })
          }
        );


      const geminiData =
        await geminiResponse.json();


      if (!geminiResponse.ok) {

        console.error(
          "Gemini API error:",
          geminiData
        );


        return res
          .status(
            geminiResponse.status
          )
          .json({
            error:
              geminiData?.error?.message ||
              "Gemini request failed."
          });

      }


// ==========================================
// READ GEMINI JSON
// ==========================================

      const modelText =
        geminiData
          ?.candidates
          ?.[0]
          ?.content
          ?.parts
          ?.[0]
          ?.text;


      if (!modelText) {

        throw new Error(
          "Gemini returned no text."
        );

      }


      let result;


      try {

        result =
          JSON.parse(
            modelText
          );

      }

      catch (error) {

        console.error(
          "Gemini JSON parse error:",
          modelText
        );


        throw new Error(
          "Gemini returned invalid JSON."
        );

      }


// ==========================================
// NORMALIZE
// ==========================================

      result.help_requested =
        result.help_requested ===
        true;


      result.help_explanation =
        String(
          result.help_explanation ||
          ""
        ).trim();


      result.help_example =
        String(
          result.help_example ||
          ""
        ).trim();


      result.answer_relevant =
        result.answer_relevant ===
        true;


      result.relevance_explanation =
        String(
          result.relevance_explanation ||
          ""
        ).trim();


      result.example_answer =
        String(
          result.example_answer ||
          ""
        ).trim();


      result.correction_needed =
        result.correction_needed ===
        true;


      result.corrected_sentence =
        String(
          result.corrected_sentence ||
          cleanTranscript
        ).trim();


      result.thai_explanation =
        String(
          result.thai_explanation ||
          ""
        ).trim();


      result.next_question_id =
        String(
          result.next_question_id ||
          ""
        ).trim();


// ==========================================
// HELP SAFETY
// ==========================================

      if (
        result.help_requested
      ) {

        result.answer_relevant =
          false;


        result.correction_needed =
          false;


        result.corrected_sentence =
          cleanTranscript;


        result.next_question_id =
          "";


        // Backwards compatibility:
        // Current app.js already knows how
        // to display these fields.

        result.relevance_explanation =
          result.help_explanation ||
          "คำถามนี้ยังไม่เข้าใจใช่ไหมคะ เดี๋ยวช่วยอธิบายให้ค่ะ";


        result.example_answer =
          result.help_example ||
          "";

      }


// ==========================================
// PUNCTUATION / CASE SAFETY
// ==========================================

      if (
        !result.help_requested &&
        result.answer_relevant &&
        result.correction_needed
      ) {

        const originalNormalized =
          normalizeSpokenText(
            cleanTranscript
          );


        const correctedNormalized =
          normalizeSpokenText(
            result.corrected_sentence
          );


        if (
          originalNormalized ===
          correctedNormalized
        ) {

          result.correction_needed =
            false;


          result.corrected_sentence =
            cleanTranscript;


          result.thai_explanation =
            "";

        }

      }


// ==========================================
// IRRELEVANT SAFETY
// ==========================================

      if (
        !result.help_requested &&
        !result.answer_relevant
      ) {

        result.correction_needed =
          false;


        result.corrected_sentence =
          cleanTranscript;


        result.next_question_id =
          "";

      }


// ==========================================
// CORRECTION SAFETY
// ==========================================

      if (
        result.correction_needed
      ) {

        result.next_question_id =
          "";

      }


// ==========================================
// FINAL TURN
// ==========================================

      if (isFinalTurn) {

        result.next_question_id =
          "";

      }


// ==========================================
// NEXT QUESTION VALIDATION
// ==========================================

      let nextQuestionId =
        result.next_question_id;


      if (
        nextQuestionId &&
        !availableQuestionIds.includes(
          nextQuestionId
        )
      ) {

        console.warn(
          "Invalid next question:",
          nextQuestionId
        );


        nextQuestionId =
          "";

      }


// ==========================================
// SAFE FALLBACK
// ==========================================

      if (
        !result.help_requested &&
        result.answer_relevant &&
        !result.correction_needed &&
        !isFinalTurn &&
        !nextQuestionId &&
        availableQuestionIds.length > 0
      ) {

        nextQuestionId =
          availableQuestionIds[0];

      }


// ==========================================
// ID -> QUESTION
// ==========================================

      let nextQuestion =
        "";


      if (nextQuestionId) {

        const object =
          getQuestionById(
            lesson,
            nextQuestionId
          );


        nextQuestion =
          object?.text ||
          "";

      }


// ==========================================
// RETURN
// ==========================================

      res.json({

        lesson_id,

        help_requested:
          result.help_requested,

        help_explanation:
          result.help_explanation,

        help_example:
          result.help_example,

        answer_relevant:
          result.answer_relevant,

        relevance_explanation:
          result.relevance_explanation,

        example_answer:
          result.example_answer,

        correction_needed:
          result.correction_needed,

        corrected_sentence:
          result.corrected_sentence,

        thai_explanation:
          result.thai_explanation,

        next_question_id:
          nextQuestionId,

        next_question:
          nextQuestion

      });

    }

    catch (error) {

      console.error(
        "Correction error:",
        error
      );


      res
        .status(500)
        .json({
          error:
            "Could not check answer."
        });

    }

  }
);


// ==========================================
// START SERVER
// ==========================================

app.listen(
  PORT,
  () => {

    console.log(
      `Speaking Lab running on port ${PORT}`
    );


    console.log(
      "Loaded lessons:",
      Object.keys(
        LESSONS
      )
    );

  }
);
