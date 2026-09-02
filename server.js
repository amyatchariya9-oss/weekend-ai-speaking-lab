import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");
const LESSONS_PATH = path.join(PUBLIC_DIR, "lessons.json");

function loadLessons() {
  try {
    return JSON.parse(
      fs.readFileSync(
        LESSONS_PATH,
        "utf8"
      )
    );
  } catch (error) {
    console.error(
      "Could not load lessons.json:",
      error
    );

    return {};
  }
}

const LESSONS = loadLessons();

// ==========================================
// CORS — SHOPIFY / TEVELLO
// ==========================================

const ALLOWED_ORIGINS = new Set([
  "https://4demgz-pn.myshopify.com",
  "https://weekend-ai-speaking-lab.onrender.com",
  "http://localhost:3000"
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (
    origin &&
    ALLOWED_ORIGINS.has(origin)
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );

    res.setHeader(
      "Vary",
      "Origin"
    );
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(
  express.static(PUBLIC_DIR)
);

app.use(
  express.json({
    limit: "1mb"
  })
);

function getLesson(
  lessonId = "weekend"
) {
  return LESSONS[lessonId] || null;
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
        question.id === questionId
    ) || null
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
    normalizeQuestion(text);

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
  const used = new Set();

  if (Array.isArray(history)) {
    for (const item of history) {
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
    used.add(currentId);
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

app.get(
  "/health",
  (req, res) => {
    res.json({
      ok: true,
      lessons:
        Object.keys(LESSONS)
    });
  }
);

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
      } else if (
        contentType.includes(
          "mpeg"
        ) ||
        contentType.includes(
          "mp3"
        )
      ) {
        extension =
          "mp3";
      } else if (
        contentType.includes(
          "wav"
        )
      ) {
        extension =
          "wav";
      } else if (
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

      // Do NOT force English.
      // Students may ask for help in Thai.

      formData.append(
        "tag_audio_events",
        "false"
      );

      const response =
        await fetch(
          "https://api.elevenlabs.io/v1/speech-to-text",
          {
            method:
              "POST",

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

      res.json({
        transcript:
          String(
            data?.text ||
            ""
          ).trim()
      });

    } catch (error) {
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
                ) =>
                  [
                    `Turn ${index + 1}`,
                    `Coach: ${item?.question || ""}`,
                    `Learner: ${item?.answer || ""}`,
                    `Final answer: ${
                      item?.corrected_answer ||
                      item?.answer ||
                      ""
                    }`
                  ].join("\n")
              )
              .join("\n\n")
          : "No previous turns.";

      const isKeepConversationGoing =
        lesson_id ===
        "keep-conversation-going";

      const lessonModeInstructions =
        isKeepConversationGoing
          ? `
================================================
LESSON 09 SPECIAL MODE: KEEP THE CONVERSATION GOING
================================================

IMPORTANT:

In this lesson,
CURRENT COACH LINE is a conversation prompt or statement.

It is NOT a question
the learner must answer
with personal information.

The learner's goal is to respond
in a way that keeps the conversation going.

A successful response can be:

- a natural reaction
  plus a follow-up question

- a short follow-up question

- a reaction that clearly invites
  the coach to continue


EXAMPLES:

Coach:
I tried something new yesterday.

Good:
Oh really? What did you try?

Good:
Nice! What was it?

Good:
Really? Tell me more.


Coach:
I didn't sleep very well last night.

Good:
Oh no. How come?

Good:
Really? What happened?


Coach:
I'm thinking about going somewhere this weekend.

Good:
Oh nice! Where are you thinking of going?


IMPORTANT:

A response such as:

"Okay, cool"

"That's nice"

"Good"

"I see"

can be natural English.

But by itself,
it ends the conversation.

For THIS lesson,
that is not successful enough.


If the learner keeps
the conversation going:

answer_relevant = true


If the learner gives
only a dead-end response:

answer_relevant = false

correction_needed = false

corrected_sentence =
learner's original transcript

next_question_id = ""


When answer_relevant = false
in Lesson 09:

- relevance_explanation must briefly
  explain in Thai that the goal
  is to react and/or ask
  a follow-up question
  so the conversation continues.

- NEVER say:
  "Answer the question above"

  because the coach did NOT ask
  a question.

- example_answer must be ONE
  natural English response
  to the coach's exact statement
  that keeps the conversation going.

- Do NOT answer
  as if the learner were the coach.

- Do NOT invent
  personal information
  for the learner.


If the learner asks for help
in Lesson 09:

- explain in Thai
  that the coach's line
  is a statement or prompt

- explain that the learner
  should react or ask
  a follow-up question

- give ONE example
  that continues
  the coach's exact line

- do NOT describe
  the coach's line
  as a question
`
          : "";

      const prompt = `
You are a friendly English speaking coach
for Thai beginner learners.

COURSE:

Real English: Everyday Conversations


CURRENT LESSON:

${lesson.title || lesson_id}


CURRENT TURN:

${turn} of ${totalTurns}


CURRENT COACH LINE:

${current_question}


LEARNER SAID:

${cleanTranscript}


QUESTION / PROMPT BANK:

${questionList}


AVAILABLE FOR THE NEXT TURN:

${availableQuestionList}


PREVIOUS CONVERSATION:

${historyText}


================================================
VERY IMPORTANT: HELP REQUESTS
================================================

The learner may ask for help
in English,
Thai,
or mixed Thai/English.

Do NOT require
an exact phrase.

Use the learner's meaning
and intention.


Examples include:

- I don't understand.

- What does that mean?

- Can you explain?

- I don't know how to answer.

- What should I say?

- ไม่เข้าใจ

- แปลว่าอะไร

- หมายความว่าอะไร

- ตอบยังไง

- ไม่รู้จะตอบอะไร

- what kind แปลว่าอะไร


If the learner is clearly:

- asking what the coach line means

- asking what a word
  or phrase means

- asking how to respond

- saying they do not understand

- saying they do not know
  what to say

then:

help_requested = true

answer_relevant = false

correction_needed = false

corrected_sentence =
learner's original transcript

next_question_id = ""


When help_requested = true:

1.
Explain the CURRENT COACH LINE
in simple Thai.

2.
If the learner asked
about a specific English word
or phrase,
explain it in Thai.

3.
Briefly explain
any important beginner-level phrase
if useful.

4.
Give ONE simple English
example response.

5.
Keep it short
and beginner-friendly.

6.
Keep the learner
on the SAME coach line.


For normal
question-based lessons:

the example should answer
the question.


For Lesson 09:

follow the special
Lesson 09 instructions below.


${lessonModeInstructions}


================================================
NORMAL ANSWERS
================================================

If the learner is NOT
asking for help:

help_requested = false

help_explanation = ""

help_example = ""


For normal
question-based lessons:

Decide whether
the learner actually answered
the CURRENT COACH LINE.


If the answer
is not relevant:

answer_relevant = false

correction_needed = false

corrected_sentence =
learner's original transcript

next_question_id = ""

relevance_explanation =
a short beginner-friendly
Thai explanation
of what the question is asking

example_answer =
ONE simple English
example answer


For Lesson 09:

Use ONLY
the Lesson 09
special relevance rules above.

Do NOT treat
the coach's statement
as a question.


================================================
SPOKEN ENGLISH CORRECTION
================================================

If the response is relevant:

answer_relevant = true


Evaluate SPOKEN English,
not writing.


Correct meaningful
spoken problems only,
such as:

- incorrect tense

- incorrect verb form

- missing important subject
  or verb

- incorrect sentence structure

- clearly unnatural word choice

- mistakes that make meaning confusing


DO NOT correct:

- punctuation

- capitalization

- commas or periods

- question marks

- transcript formatting

- harmless spoken-English informality

- natural conversational fragments
  when meaning is clear


Preserve
the learner's intended meaning.


NEVER invent:

- information

- reasons

- places

- people

- activities

- times

- dates

- opinions

- events


If the learner's spoken English
is already natural:

correction_needed = false

corrected_sentence =
learner's original transcript

thai_explanation = ""


If a meaningful correction
is needed:

correction_needed = true

corrected_sentence =
a natural corrected version

thai_explanation =
a SHORT
beginner-friendly
Thai explanation

next_question_id = ""


Do not use "ครับ"
in Thai explanations.


================================================
NEXT QUESTION / PROMPT
================================================

Only choose a next item
if ALL are true:

- help_requested = false

- answer_relevant = true

- correction_needed = false

- this is NOT the final turn

- an unused item is available


The next item MUST be selected
ONLY from these IDs:

${availableQuestionIds.join(", ") || "NONE"}


Choose the item
that follows
the conversation naturally.


Do NOT ask or prompt something
the learner has already
clearly covered.


Do NOT invent
a new item.


Do NOT rewrite
an item.


Return only
the exact ID.


If:

- help was requested

- the response was irrelevant

- correction is needed

- this is the final turn

- no item is available

then:

next_question_id = ""
`;

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
              geminiData
                ?.error
                ?.message ||
              "Gemini request failed."
          });
      }

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
      } catch (error) {
        console.error(
          "Gemini JSON parse error:",
          modelText
        );

        throw new Error(
          "Gemini returned invalid JSON."
        );
      }

      result.help_requested =
        result.help_requested === true;

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
        result.answer_relevant === true;

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
        result.correction_needed === true;

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

        result.relevance_explanation =
          result.help_explanation ||
          "ยังไม่เข้าใจใช่ไหมคะ เดี๋ยวช่วยอธิบายให้ค่ะ";

        result.example_answer =
          result.help_example ||
          "";
      }

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

      if (
        result.correction_needed
      ) {
        result.next_question_id =
          "";
      }

      if (
        isFinalTurn
      ) {
        result.next_question_id =
          "";
      }

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

      let nextQuestion =
        "";

      if (
        nextQuestionId
      ) {
        const object =
          getQuestionById(
            lesson,
            nextQuestionId
          );

        nextQuestion =
          object?.text ||
          "";
      }

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

    } catch (error) {
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

app.listen(
  PORT,
  () => {
    console.log(
      `Speaking Lab running on port ${PORT}`
    );

    console.log(
      "Loaded lessons:",
      Object.keys(LESSONS)
    );
  }
);
