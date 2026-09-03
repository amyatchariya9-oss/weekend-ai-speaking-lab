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
const LESSONS_PATH = path.join(
  PUBLIC_DIR,
  "lessons.json"
);


function loadLessons() {

  try {

    return JSON.parse(
      fs.readFileSync(
        LESSONS_PATH,
        "utf8"
      )
    );

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



// =====================================================
// CORS
// SHOPIFY / TEVELLO -> RENDER
// =====================================================

const ALLOWED_ORIGINS =
  new Set([
    "https://4demgz-pn.myshopify.com",
    "https://weekend-ai-speaking-lab.onrender.com",
    "http://localhost:3000",
    "http://localhost:3001"
  ]);


app.use(
  (req, res, next) => {

    const origin =
      req.headers.origin;


    if (
      origin &&
      ALLOWED_ORIGINS.has(
        origin
      )
    ) {

      res.setHeader(
        "Access-Control-Allow-Origin",
        origin
      );

    }


    res.setHeader(
      "Vary",
      "Origin"
    );


    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS"
    );


    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );


    if (
      req.method ===
      "OPTIONS"
    ) {

      return res
        .sendStatus(204);

    }


    next();

  }
);



app.use(
  express.static(
    PUBLIC_DIR
  )
);


app.use(
  express.json({
    limit:
      "1mb"
  })
);



// =====================================================
// HELPERS
// =====================================================

function getLesson(
  lessonId =
    "weekend"
) {

  return (
    LESSONS[
      lessonId
    ] ||
    null
  );

}



function normalizeSpokenText(
  text =
    ""
) {

  return String(
    text
  )
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
  text =
    ""
) {

  return String(
    text
  )
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
        ) ===
        normalized
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
    Array.isArray(
      history
    )
  ) {

    for (
      const item
      of history
    ) {

      const id =
        getQuestionIdFromText(
          lesson,
          item?.question
        );


      if (id) {

        used.add(
          id
        );

      }

    }

  }


  const currentId =
    getQuestionIdFromText(
      lesson,
      currentQuestion
    );


  if (
    currentId
  ) {

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


  return lesson
    .questions
    .map(
      (question) =>
        question.id
    )
    .filter(
      (id) =>
        !usedIds.has(
          id
        )
    );

}



// =====================================================
// GEMINI RESPONSE SCHEMA
// =====================================================

const RESPONSE_SCHEMA = {

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

};



// =====================================================
// GEMINI REQUEST
// =====================================================

async function askGemini({

  apiKey,
  prompt,
  temperature =
    0.2

}) {

  const response =
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

              temperature,


              responseMimeType:
                "application/json",


              responseSchema:
                RESPONSE_SCHEMA

            }

          })

      }

    );


  const data =
    await response
      .json();


  if (
    !response.ok
  ) {

    console.error(
      "Gemini API error:",
      data
    );


    throw new Error(

      data
        ?.error
        ?.message ||

      "Gemini request failed."

    );

  }


  const text =

    data
      ?.candidates
      ?.[0]
      ?.content
      ?.parts
      ?.[0]
      ?.text;


  if (
    !text
  ) {

    throw new Error(
      "Gemini returned no text."
    );

  }


  try {

    return JSON.parse(
      text
    );

  }

  catch (error) {

    console.error(
      "Gemini JSON parse error:",
      text
    );


    throw new Error(
      "Gemini returned invalid JSON."
    );

  }

}



// =====================================================
// NORMALIZE GEMINI RESULT
// =====================================================

function cleanResult(
  result,
  transcript
) {

  return {

    help_requested:
      result
        ?.help_requested ===
      true,


    help_explanation:
      String(
        result
          ?.help_explanation ||
        ""
      ).trim(),


    help_example:
      String(
        result
          ?.help_example ||
        ""
      ).trim(),


    answer_relevant:
      result
        ?.answer_relevant ===
      true,


    relevance_explanation:
      String(
        result
          ?.relevance_explanation ||
        ""
      ).trim(),


    example_answer:
      String(
        result
          ?.example_answer ||
        ""
      ).trim(),


    correction_needed:
      result
        ?.correction_needed ===
      true,


    corrected_sentence:
      String(
        result
          ?.corrected_sentence ||
        transcript
      ).trim(),


    thai_explanation:
      String(
        result
          ?.thai_explanation ||
        ""
      ).trim(),


    next_question_id:
      String(
        result
          ?.next_question_id ||
        ""
      ).trim()

  };

}



// =====================================================
// SPOKEN ENGLISH SAFETY
// Ignore punctuation-only changes
// =====================================================

function applySpokenCorrectionSafety(
  result,
  transcript
) {

  if (

    result.answer_relevant &&
    result.correction_needed

  ) {

    const original =
      normalizeSpokenText(
        transcript
      );


    const corrected =
      normalizeSpokenText(
        result
          .corrected_sentence
      );


    if (
      original ===
      corrected
    ) {

      result.correction_needed =
        false;


      result.corrected_sentence =
        transcript;


      result.thai_explanation =
        "";

    }

  }


  return result;

}



// =====================================================
// HEALTH
// =====================================================

app.get(

  "/health",

  (req, res) => {

    res.json({

      ok:
        true,


      lessons:
        Object.keys(
          LESSONS
        )

    });

  }

);



// =====================================================
// SPEECH TO TEXT
// ELEVENLABS SCRIBE V2
// =====================================================

app.post(

  "/transcribe",


  express.raw({

    type:
      "*/*",

    limit:
      "25mb"

  }),


  async (
    req,
    res
  ) => {

    try {

      const apiKey =

        process.env
          .ELEVENLABS_API_KEY;


      if (
        !apiKey
      ) {

        return res
          .status(
            500
          )
          .json({

            error:
              "ELEVENLABS_API_KEY is missing."

          });

      }


      if (

        !req.body ||
        req.body.length ===
          0

      ) {

        return res
          .status(
            400
          )
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

          [
            req.body
          ],

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
      // Do not force English.
      // Learners may speak Thai
      // when asking for help.

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
        await response
          .json();


      if (
        !response.ok
      ) {

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

              data
                ?.detail
                ?.message ||

              data
                ?.detail ||

              data
                ?.error ||

              "Speech recognition failed."

          });

      }


      return res.json({

        transcript:
          String(
            data
              ?.text ||
            ""
          ).trim()

      });

    }


    catch (error) {

      console.error(
        "Transcription error:",
        error
      );


      return res
        .status(
          500
        )
        .json({

          error:
            "Could not transcribe audio."

        });

    }

  }

);



// =====================================================
// PHOTO TALK MODE
// =====================================================

async function correctPhotoTalk({

  apiKey,

  transcript,

  question,

  photoContext,

  modelAnswer

}) {

  const prompt = `

You are a friendly English speaking coach for Thai beginner learners.

PRACTICE MODE:
Photo Talk


QUESTION:
${question}


PHOTO DESCRIPTION:
${photoContext}


ONE POSSIBLE MODEL ANSWER:
${modelAnswer}


LEARNER SAID:
${transcript}



================================================
GOAL
================================================

The learner looks at a photo and gives a plausible spoken answer.

There is NOT one fixed correct answer.

Different interpretations are okay when they reasonably fit the photo and question.

This is low-pressure speaking practice, not a writing exam.



================================================
RELEVANCE
================================================

answer_relevant = true when the learner:

- answers the question
- describes or interprets the photo plausibly
- gives a reasonable opinion based on the photo


answer_relevant = false ONLY when:

- the response clearly does not answer the question
- the response is clearly unrelated to the photo


If answer_relevant = false:

correction_needed = false

corrected_sentence =
the learner's original transcript

relevance_explanation =
short friendly Thai explaining what they should talk about

example_answer =
the supplied model answer

thai_explanation = ""



================================================
SPOKEN ENGLISH CORRECTION
================================================

If the answer is relevant,
correct ONLY genuine spoken-English errors.

Examples:

- wrong tense
- wrong verb form
- missing necessary preposition
- missing necessary article
- missing important subject
- missing important verb
- incorrect sentence structure
- clearly wrong word choice


DO NOT correct:

- punctuation
- capitalization
- commas
- periods
- speech-to-text formatting
- harmless conversational wording
- a correct sentence just because the model answer is different


Preserve the learner's intended meaning.

Make the SMALLEST correction necessary.

Do not invent details.

Do not make the learner sound unnecessarily advanced.



================================================
THAI EXPLANATION
VERY IMPORTANT
================================================

When correction_needed = true:

thai_explanation must explain the REAL grammar or language reason for each meaningful correction.

Keep the explanation:

- short
- beginner-friendly
- normally 1–2 short Thai sentences


CRITICAL:

NEVER invent a grammar reason from the topic.

A weekend by itself does NOT make a sentence past tense.

NEVER say:

“ใช้ past tense เพราะเป็นวันหยุด”

or

“ใช้ ate เพราะเกิดขึ้นใน weekend”


Use past tense when the QUESTION or MEANING refers to an event that already happened.


For example:

“What do you think they did this weekend?”

contains “did” and asks about a completed event.

So past forms such as:

went
ate
had
stayed
watched

are appropriate.


Explain the EXACT rule when relevant.



EXAMPLE 1

Learner:

They went park and eat food.


Correction:

They went to the park and ate some food.


Good Thai explanation:

ใช้ “went to the park” เพราะ go/went ตามด้วยสถานที่ใช้ to และใช้ “ate” แทน “eat” เพราะกำลังเล่าเหตุการณ์ที่เกิดขึ้นแล้วในอดีต



EXAMPLE 2

Learner:

They go to the park yesterday.


Correction:

They went to the park yesterday.


Good Thai explanation:

เปลี่ยน “go” เป็น “went” เพราะ yesterday บอกว่าเหตุการณ์เกิดขึ้นแล้วในอดีต



EXAMPLE 3

Learner:

They watched movie.


Correction:

They watched a movie.


Good Thai explanation:

ใช้ “a movie” เพราะ movie เป็นคำนามนับได้เอกพจน์ จึงต้องมี a/an นำหน้า



EXAMPLE 4

Learner:

They went park.


Correction:

They went to the park.


Good Thai explanation:

ใช้ “went to the park” เพราะ go/went ตามด้วยสถานที่ปกติใช้ to



DO NOT explain punctuation or capitalization.

DO NOT claim a word was added if the learner already said it.


If no meaningful correction is needed:

correction_needed = false

corrected_sentence =
learner's original transcript

thai_explanation = ""



================================================
OUTPUT
================================================

Always return:

help_requested = false

help_explanation = ""

help_example = ""

next_question_id = ""


Photo Talk does NOT choose the next photo.

The webpage controls Photo 1, Photo 2 and Photo 3.

example_answer should be the supplied model answer.

`.trim();


  let result =
    cleanResult(

      await askGemini({

        apiKey,

        prompt,

        temperature:
          0.1

      }),

      transcript

    );


  result.help_requested =
    false;


  result.help_explanation =
    "";


  result.help_example =
    "";


  result.next_question_id =
    "";


  if (
    !result.example_answer
  ) {

    result.example_answer =
      modelAnswer;

  }


  if (
    !result.answer_relevant
  ) {

    result.correction_needed =
      false;


    result.corrected_sentence =
      transcript;


    result.thai_explanation =
      "";

  }


  result =
    applySpokenCorrectionSafety(

      result,

      transcript

    );


  return result;

}



// =====================================================
// /correct
// AI SPEAKING + PHOTO TALK
// =====================================================

app.post(

  "/correct",

  async (
    req,
    res
  ) => {

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
          [],


        mode =
          "conversation",


        photo_context =
          "",


        model_answer =
          ""


      } =
        req.body ||
        {};


      const apiKey =

        process.env
          .GEMINI_API_KEY;


      if (
        !apiKey
      ) {

        return res
          .status(
            500
          )
          .json({

            error:
              "GEMINI_API_KEY is missing."

          });

      }


      const cleanTranscript =
        String(
          transcript
        ).trim();


      if (
        !cleanTranscript
      ) {

        return res
          .status(
            400
          )
          .json({

            error:
              "Transcript is empty."

          });

      }



      // =================================================
      // PHOTO TALK
      // Completely separate AI rules
      // =================================================

      if (
        mode ===
        "photo_talk"
      ) {

        const result =
          await correctPhotoTalk({

            apiKey,


            transcript:
              cleanTranscript,


            question:
              String(
                current_question ||
                ""
              ).trim(),


            photoContext:
              String(
                photo_context ||
                ""
              ).trim(),


            modelAnswer:
              String(
                model_answer ||
                ""
              ).trim()

          });


        return res.json({

          lesson_id,


          mode:
            "photo_talk",


          help_requested:
            false,


          help_explanation:
            "",


          help_example:
            "",


          answer_relevant:
            result
              .answer_relevant,


          relevance_explanation:
            result
              .relevance_explanation,


          example_answer:
            result
              .example_answer,


          correction_needed:
            result
              .correction_needed,


          corrected_sentence:
            result
              .corrected_sentence,


          thai_explanation:
            result
              .thai_explanation,


          next_question_id:
            "",


          next_question:
            ""

        });

      }



      // =================================================
      // EXISTING AI SPEAKING
      // =================================================

      const lesson =
        getLesson(
          lesson_id
        );


      if (
        !lesson
      ) {

        return res
          .status(
            400
          )
          .json({

            error:
              `Unknown lesson: ${lesson_id}`

          });

      }


      if (

        !Array.isArray(
          lesson.questions
        ) ||

        lesson
          .questions
          .length ===
          0

      ) {

        return res
          .status(
            500
          )
          .json({

            error:
              "This lesson has no questions."

          });

      }


      const totalTurns =
        Number(
          lesson.turns
        ) ||
        5;


      const isFinalTurn =

        Number(
          turn
        ) >=

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
          .join(
            "\n"
          );


      const availableQuestionList =

        availableQuestionIds
          .length >
        0

          ?

          availableQuestionIds

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

            .join(
              "\n"
            )

          :

          "NONE";


      const historyText =

        Array.isArray(
          history
        ) &&

        history.length >
        0

          ?

          history

            .map(
              (
                item,
                index
              ) =>

                [

                  `Turn ${index + 1}`,

                  `Question: ${item?.question || ""}`,

                  `Learner: ${item?.answer || ""}`,

                  `Final answer: ${
                    item?.corrected_answer ||
                    item?.answer ||
                    ""
                  }`

                ].join(
                  "\n"
                )

            )

            .join(
              "\n\n"
            )

          :

          "No previous turns.";



      // =================================================
      // LESSON 09
      // KEEP THE CONVERSATION GOING
      // =================================================

      const isKeepConversationGoing =

        lesson_id ===
        "keep-conversation-going";


      const lessonModeInstructions =

        isKeepConversationGoing

          ?

          `

================================================
LESSON 09 SPECIAL MODE:
KEEP THE CONVERSATION GOING
================================================

In this lesson, the coach line is a CONVERSATION PROMPT or STATEMENT.

It is NOT necessarily a question the learner must answer with personal information.

The learner's task is to respond in a way that keeps the conversation going.


A successful response can be:

- a natural reaction plus a follow-up question
- a short follow-up question
- a reaction that clearly invites the coach to continue


Examples:


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



A response such as:

Okay, cool.

That's nice.

Good.

I see.

can be natural English,

but by itself it ends the conversation.


For THIS lesson,
that is not successful enough.


If the learner keeps the conversation going:

answer_relevant = true


If the learner gives only a dead-end response:

answer_relevant = false

correction_needed = false

corrected_sentence =
learner's original transcript

next_question_id = ""


When answer_relevant = false:

- relevance_explanation must briefly explain in Thai that the goal is to react and/or ask a follow-up question so the conversation continues

- do NOT say “answer the question above”

- example_answer must be ONE natural English response to the coach's exact statement

- do NOT answer as if the learner were the coach

- do NOT invent personal information for the learner


If the learner asks for help:

- explain in Thai that the coach's line may be a statement or prompt

- explain that the learner should react or ask a follow-up question

- give ONE example that continues the coach's exact line

`

          :

          "";



      // =================================================
      // NORMAL AI SPEAKING PROMPT
      // =================================================

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
HELP REQUESTS
================================================

The learner is a Thai beginner.

The learner may ask for help in English, Thai, or mixed Thai/English.


Examples:

I don't understand.

I don't get it.

What does that mean?

Can you explain?

Can you explain the question?

I don't know how to answer.

I don't know what to say.

What should I say?

How do I answer this?


Thai examples:

ไม่เข้าใจ

ไม่เข้าใจคำถาม

แปลว่าอะไร

หมายความว่าอะไร

คำถามนี้แปลว่าอะไร

ตอบยังไง

ต้องตอบว่าอะไร

ไม่รู้จะตอบอะไร

ไม่รู้จะตอบยังไง

พูดยังไง


Mixed examples:

what kind แปลว่าอะไร

question นี้หมายความว่าอะไร

I don't understand คำถาม


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


This is NOT a wrong answer.


When help_requested = true:

1. Explain the CURRENT QUESTION in simple Thai.

2. If they asked about a word or phrase,
explain that phrase in Thai.

3. Give ONE simple English example answer.

4. Keep the explanation short.

5. Do NOT change to another question.

6. next_question_id = ""

7. correction_needed = false

8. answer_relevant = false

9. corrected_sentence =
learner's original transcript


The learner will answer the SAME question again.



${lessonModeInstructions}



================================================
NORMAL ANSWERS
================================================

If the learner is NOT asking for help:

help_requested = false

help_explanation = ""

help_example = ""



For normal question-based lessons:

decide whether the learner actually answered the CURRENT QUESTION.


For Lesson 09:

use the special instructions above.



If the answer is NOT relevant:

answer_relevant = false

correction_needed = false

corrected_sentence =
learner's original transcript

next_question_id = ""


For normal question-based lessons:

relevance_explanation =
short Thai explaining what the question is asking

example_answer =
ONE simple English example answer



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
- mistakes that make meaning confusing



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


NEVER invent:

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

corrected_sentence =
learner's original transcript

thai_explanation = ""



If a meaningful correction is needed:

correction_needed = true

corrected_sentence =
a natural corrected version

thai_explanation =
a SHORT beginner-friendly Thai explanation of the REAL language reason

next_question_id = ""



Do not give punctuation advice.

Do not give capitalization advice.

Do not claim you added a word if the learner already said that word.

Use friendly neutral Thai.

Do not use “ครับ”.



================================================
NEXT QUESTION
================================================

Only choose a next question if ALL are true:

- help_requested = false
- answer_relevant = true
- correction_needed = false
- this is NOT the final turn
- an unused question is available


The next_question_id MUST be selected ONLY from:

${availableQuestionIds.join(", ") || "NONE"}


Choose the question that follows the conversation naturally.

Do NOT ask something the learner has already clearly answered.

Do NOT invent a question.

Do NOT rewrite a question.

Return only the exact question ID.


Otherwise:

next_question_id = ""

`.trim();



      let result =
        cleanResult(

          await askGemini({

            apiKey,

            prompt,

            temperature:
              0.2

          }),

          cleanTranscript

        );



      // =================================================
      // HELP SAFETY
      // =================================================

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

          "คำถามนี้ยังไม่เข้าใจใช่ไหมคะ เดี๋ยวช่วยอธิบายให้ค่ะ";


        result.example_answer =

          result.help_example ||

          "";

      }



      // =================================================
      // PUNCTUATION / CASE SAFETY
      // =================================================

      result =
        applySpokenCorrectionSafety(

          result,

          cleanTranscript

        );



      // =================================================
      // IRRELEVANT SAFETY
      // =================================================

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



      // =================================================
      // CORRECTION SAFETY
      // =================================================

      if (
        result.correction_needed
      ) {

        result.next_question_id =
          "";

      }



      // =================================================
      // FINAL TURN
      // =================================================

      if (
        isFinalTurn
      ) {

        result.next_question_id =
          "";

      }



      // =================================================
      // NEXT QUESTION VALIDATION
      // =================================================

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



      // =================================================
      // SAFE FALLBACK
      // =================================================

      if (

        !result.help_requested &&

        result.answer_relevant &&

        !result.correction_needed &&

        !isFinalTurn &&

        !nextQuestionId &&

        availableQuestionIds.length >
          0

      ) {

        nextQuestionId =

          availableQuestionIds[
            0
          ];

      }



      // =================================================
      // ID -> QUESTION
      // =================================================

      let nextQuestion =
        "";


      if (
        nextQuestionId
      ) {

        nextQuestion =

          getQuestionById(

            lesson,

            nextQuestionId

          )
            ?.text ||

          "";

      }



      // =================================================
      // RETURN
      // =================================================

      return res.json({

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


      return res
        .status(
          500
        )
        .json({

          error:
            "Could not check answer."

        });

    }

  }

);



// =====================================================
// START SERVER
// =====================================================

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
