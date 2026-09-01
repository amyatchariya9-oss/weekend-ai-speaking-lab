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


    const lessons =
      JSON.parse(raw);


    return lessons;

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
// HEALTH CHECK
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

        extension =
          "mp4";

      }

      else if (
        contentType.includes(
          "mpeg"
        ) ||
        contentType.includes(
          "mp3"
        )
      ) {

        extension =
          "mp3";

      }

      else if (
        contentType.includes(
          "wav"
        )
      ) {

        extension =
          "wav";

      }

      else if (
        contentType.includes(
          "m4a"
        )
      ) {

        extension =
          "m4a";

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


      formData.append(
        "language_code",
        "eng"
      );


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
// AI CORRECTION
// GEMINI
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
      // GET LESSON
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
        lesson.questions.length ===
          0
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
      // LESSON INFO
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
        availableQuestionIds.length >
        0
          ? availableQuestionIds
              .map(
                (id) => {

                  const question =
                    getQuestionById(
                      lesson,
                      id
                    );


                  return `${id}: ${question?.text || ""}`;

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


      // ======================================
      // PROMPT
      // ======================================

      const prompt = `
You are a friendly English speaking coach for Thai beginner learners.

COURSE:
Real English: Everyday Conversations

CURRENT LESSON:
${lesson.title || lesson_id}

THIS IS SPOKEN ENGLISH.
Evaluate what the learner SAID, not written punctuation or formatting.

CURRENT TURN:
${turn} of ${totalTurns}

CURRENT QUESTION:
${current_question}

LEARNER SAID:
${cleanTranscript}


QUESTION BANK FOR THIS LESSON:
${questionList}


QUESTIONS STILL AVAILABLE FOR THE NEXT TURN:
${availableQuestionList}


PREVIOUS CONVERSATION:
${historyText}


YOUR JOB:

1. Decide whether the learner's answer is relevant to the CURRENT QUESTION.

2. If it is NOT relevant:
- answer_relevant = false
- explain briefly in Thai what the current question is asking
- give ONE very simple English example answer
- correction_needed = false
- corrected_sentence = learner's original transcript
- next_question_id = ""
- The learner must answer the SAME question again.

3. If the answer IS relevant:
- answer_relevant = true
- check only meaningful SPOKEN English problems.

Correct things such as:
- incorrect tense
- incorrect verb form
- missing important subject or verb
- clearly incorrect sentence structure
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
- natural conversational fragments when the meaning is clear

IMPORTANT:
Preserve the learner's intended meaning.

NEVER invent details the learner did not say.

Do not invent:
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

If the learner's sentence is already natural spoken English:
- correction_needed = false
- corrected_sentence = the learner's original transcript
- thai_explanation = ""

If a meaningful correction is needed:
- correction_needed = true
- corrected_sentence = a natural corrected version
- thai_explanation = a SHORT, beginner-friendly explanation in Thai
- next_question_id = ""

Do not give punctuation or capitalization advice.

Do not say a word was "added" if the learner already said that word.

Use friendly neutral Thai.
Do not use "ครับ".


NEXT QUESTION RULES:

Only choose a next question when ALL are true:
- answer_relevant = true
- correction_needed = false
- this is NOT the final turn
- at least one unused question is available

The next question MUST be chosen ONLY from:
${availableQuestionIds.join(", ") || "NONE"}

Choose the question that follows the conversation most naturally.

Do NOT ask for information the learner has already clearly given.

Do NOT create your own question.

Do NOT rewrite a question.

Return only its exact question ID.

If:
- the answer is irrelevant
- correction is needed
- this is the final turn
- or no unused questions remain

then next_question_id MUST be "".
`;


      // ======================================
      // GEMINI REQUEST
      // ======================================

      const geminiResponse =
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                contents: [
                  {
                    role: "user",

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


      // ======================================
      // READ GEMINI JSON
      // ======================================

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


      // ======================================
      // NORMALIZE RESULT
      // ======================================

      result.answer_relevant =
        result.answer_relevant ===
        true;


      result.correction_needed =
        result.correction_needed ===
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


      // ======================================
      // HARD SAFETY:
      // PUNCTUATION / CASE ONLY
      // ======================================

      if (
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


      // ======================================
      // IRRELEVANT ANSWER SAFETY
      // ======================================

      if (
        !result.answer_relevant
      ) {

        result.correction_needed =
          false;


        result.corrected_sentence =
          cleanTranscript;


        result.next_question_id =
          "";

      }


      // ======================================
      // CORRECTION SAFETY
      // ======================================

      if (
        result.correction_needed
      ) {

        result.next_question_id =
          "";

      }


      // ======================================
      // FINAL TURN SAFETY
      // ======================================

      if (isFinalTurn) {

        result.next_question_id =
          "";

      }


      // ======================================
      // NEXT QUESTION VALIDATION
      // ======================================

      let nextQuestionId =
        result.next_question_id;


      if (
        nextQuestionId &&
        !availableQuestionIds.includes(
          nextQuestionId
        )
      ) {

        console.warn(
          "Gemini selected invalid or used question:",
          nextQuestionId
        );


        nextQuestionId =
          "";

      }


      // ======================================
      // SAFE FALLBACK
      // ======================================

      if (
        result.answer_relevant &&
        !result.correction_needed &&
        !isFinalTurn &&
        !nextQuestionId &&
        availableQuestionIds.length >
          0
      ) {

        nextQuestionId =
          availableQuestionIds[0];

      }


      // ======================================
      // MAP ID -> EXACT QUESTION
      // ======================================

      let nextQuestion =
        "";


      if (nextQuestionId) {

        const nextQuestionObject =
          getQuestionById(
            lesson,
            nextQuestionId
          );


        nextQuestion =
          nextQuestionObject?.text ||
          "";

      }


      // ======================================
      // RETURN TO FRONTEND
      // ======================================

      res.json({

        lesson_id,

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
