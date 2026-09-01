import "dotenv/config";
import express from "express";

const app = express();

const port =
  process.env.PORT || 3000;


// ==========================================
// STATIC FILES + JSON
// ==========================================

app.use(
  express.static("public")
);

app.use(
  express.json({
    limit: "1mb"
  })
);


// ==========================================
// FIXED QUESTION BANK
// ==========================================
//
// IMPORTANT:
// Gemini is NOT allowed to create
// new tutor questions.
//
// It only chooses one of these IDs.
// ==========================================

const QUESTION_BANK = {

  Q1:
    "Hey! How was your weekend?",

  Q2:
    "What did you do?",

  Q3:
    "Tell me more about it.",

  Q4:
    "Where did you go?",

  Q5:
    "Who were you with?",

  Q6:
    "What happened next?",

  Q7:
    "How did you feel?",

  Q8:
    "What did you like about it?",

  Q9:
    "What was the best part?",

  Q10:
    "Would you do it again?"

};


// ==========================================
// HELPERS
// ==========================================

function normalizeSpokenText(
  text = ""
) {

  return String(text)
    .toLowerCase()
    .replace(
      /[.,!?;:'"()[\]{}]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


// ==========================================
// FIND QUESTION ID FROM TEXT
// ==========================================

function getQuestionIdFromText(
  questionText = ""
) {

  const normalized =
    normalizeSpokenText(
      questionText
    );


  for (
    const [
      id,
      text
    ]
    of Object.entries(
      QUESTION_BANK
    )
  ) {

    if (
      normalizeSpokenText(
        text
      ) === normalized
    ) {

      return id;

    }

  }


  return null;

}


// ==========================================
// GET QUESTIONS ALREADY USED
// ==========================================

function getUsedQuestionIds(
  currentQuestion,
  history = []
) {

  const used =
    new Set();


  // Current question
  const currentId =
    getQuestionIdFromText(
      currentQuestion
    );


  if (currentId) {

    used.add(
      currentId
    );

  }


  // Previous questions
  if (
    Array.isArray(
      history
    )
  ) {

    history.forEach(
      (item) => {

        const id =
          getQuestionIdFromText(
            item?.question || ""
          );


        if (id) {

          used.add(id);

        }

      }
    );

  }


  return used;

}


// ==========================================
// ELEVENLABS SPEECH TO TEXT
// ==========================================
//
// This is the ONLY ElevenLabs API
// used by the app now.
//
// Tutor voices and success voices
// are static MP3 files.
//
// ==========================================

app.post(
  "/transcribe",

  express.raw({

    type: [
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "audio/x-m4a",
      "application/octet-stream"
    ],

    limit:
      "25mb"

  }),

  async (
    req,
    res
  ) => {

    try {

      // ======================================
      // API KEY
      // ======================================

      if (
        !process.env
          .ELEVENLABS_API_KEY
      ) {

        return res
          .status(500)
          .json({

            error:
              "Missing ELEVENLABS_API_KEY"

          });

      }


      // ======================================
      // AUDIO CHECK
      // ======================================

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


      // ======================================
      // FILE TYPE
      // ======================================

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
        ) ||
        contentType.includes(
          "m4a"
        )
      ) {

        extension =
          "m4a";

      }


      if (
        contentType.includes(
          "mpeg"
        )
      ) {

        extension =
          "mp3";

      }


      if (
        contentType.includes(
          "wav"
        )
      ) {

        extension =
          "wav";

      }


      // ======================================
      // CREATE AUDIO FILE
      // ======================================

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


      // ======================================
      // ELEVENLABS STT
      // ======================================

      const elevenResponse =
        await fetch(

          "https://api.elevenlabs.io/v1/speech-to-text",

          {

            method:
              "POST",

            headers: {

              "xi-api-key":
                process.env
                  .ELEVENLABS_API_KEY

            },

            body:
              formData

          }

        );


      const data =
        await elevenResponse
          .json();


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


      // ======================================
      // TRANSCRIPT
      // ======================================

      const transcript =
        data?.text?.trim() ||
        "";


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
// IMPORTANT
// ==========================================
//
// There is intentionally NO /tts endpoint.
//
// Questions:
// public/audio/weekend/q1.mp3 - q10.mp3
//
// Success voices:
// public/audio/weekend/success/
//
// This prevents unnecessary
// ElevenLabs TTS credit usage.
//
// ==========================================


// ==========================================
// GEMINI CORRECTION
// ==========================================

app.post(
  "/correct",

  async (
    req,
    res
  ) => {

    try {

      const {

        transcript,

        turn = 1,

        current_question = "",

        history = []

      } = req.body;


      // ======================================
      // API KEY
      // ======================================

      if (
        !process.env
          .GEMINI_API_KEY
      ) {

        return res
          .status(500)
          .json({

            error:
              "Missing GEMINI_API_KEY"

          });

      }


      // ======================================
      // TRANSCRIPT VALIDATION
      // ======================================

      if (
        !transcript ||
        typeof transcript !==
          "string"
      ) {

        return res
          .status(400)
          .json({

            error:
              "Missing transcript"

          });

      }


      // ======================================
      // TURN
      // ======================================

      const numericTurn =
        Number(turn) || 1;


      const isFinalTurn =
        numericTurn >= 5;


      // ======================================
      // USED QUESTIONS
      // ======================================

      const usedQuestionIds =
        getUsedQuestionIds(

          current_question,

          history

        );


      // ======================================
      // AVAILABLE QUESTIONS
      // ======================================

      const availableQuestionIds =
        Object.keys(
          QUESTION_BANK
        ).filter(
          (id) =>
            !usedQuestionIds
              .has(id)
        );


      const availableQuestions =
        availableQuestionIds
          .map(
            (id) =>
              `${id}: "${QUESTION_BANK[id]}"`
          )
          .join("\n");


      // ======================================
      // PROMPT
      // ======================================

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
${numericTurn} of 5


==========================================
CORE RULE
==========================================

This is SPOKEN English practice.

It is NOT writing practice.

Evaluate:

1. Whether the learner answered the question.
2. Whether there is a meaningful spoken-English mistake.


==========================================
ANSWER RELEVANCE
==========================================

answer_relevant = true when the learner:

- directly answers the question
- gives information that clearly responds to the question
- gives a natural short conversational answer
- gives a short answer that makes sense in context

Short beginner answers are allowed.

Examples:

Question:
"How was your weekend?"

"It was good."
answer_relevant = true


Question:
"What did you do?"

"I stayed home."
answer_relevant = true


Question:
"Where did you go?"

"With my boyfriend."
answer_relevant = false


Question:
"What did you do?"

"I love vegetables."
answer_relevant = false


If answer_relevant = false:

- Do NOT praise the learner.
- correction_needed should normally be false unless the answer itself contains an obvious meaningful spoken error.
- relevance_explanation must briefly explain in Thai what the question is asking.
- Give ONE simple example_answer.
- Never pretend the example is something the learner actually did.
- next_question_id MUST be "".


==========================================
SPOKEN CORRECTION RULES
==========================================

Only correct meaningful SPOKEN mistakes.

Correct things such as:

- wrong tense
- wrong verb form
- missing important subject
- missing important verb
- incorrect sentence structure
- clearly unnatural word choice
- grammar mistakes that affect spoken English


DO NOT correct:

- punctuation
- periods
- commas
- exclamation marks
- question marks
- capitalization
- written formatting
- speech-to-text sentence separation


VERY IMPORTANT:

If the original answer and corrected sentence would sound the same when spoken:

correction_needed MUST be false.


Example:

Original:
"I bought snacks and food"

Corrected:
"I bought snacks and food."

This is NOT a correction.


Original:
"i went shopping"

Corrected:
"I went shopping."

This is NOT a correction.


==========================================
DO NOT INVENT INFORMATION
==========================================

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


Example:

Learner:
"I go shopping."

Allowed correction:
"I went shopping."

NOT allowed:
"I went shopping at the mall with my boyfriend."


==========================================
THAI EXPLANATION
==========================================

If correction_needed = true:

- explain only the REAL spoken mistake
- explain briefly
- use beginner-friendly Thai
- do not explain punctuation
- do not invent a correction
- do not use "ครับ"
- friendly neutral Thai is preferred


If correction_needed = false:

thai_explanation MUST be "".


==========================================
NEXT QUESTION
==========================================

You are NOT allowed to write a new tutor question.

You may ONLY select one ID from the available fixed question bank below.

AVAILABLE QUESTIONS:

${availableQuestions || "NONE"}


Choose the question that follows most naturally from what the learner ACTUALLY said.

Do NOT ask something the learner already answered.

Do NOT repeat a used question.

Do NOT invent a new question.

Do NOT modify the wording.

Return only the question ID.


Examples of natural selection:

If learner says:
"I went shopping."

A natural choice could be:
Q4: "Where did you go?"

or:
Q5: "Who were you with?"


If learner says:
"I went to the beach with my boyfriend."

Do NOT choose:
"Where did you go?"

Do NOT choose:
"Who were you with?"

because both were already answered.

A better available question could be:
Q7: "How did you feel?"

or:
Q9: "What was the best part?"


If the current answer needs correction:

next_question_id MUST be "".

The learner must try the same question again first.


If answer_relevant = false:

next_question_id MUST be "".


If this is turn 5:

next_question_id MUST be "".


==========================================
ENDING
==========================================

If this is NOT the final turn:

closing_message MUST be "".


If this IS the final turn
AND the answer is relevant
AND correction_needed = false:

next_question_id MUST be "".

closing_message may be one short friendly English sentence.


If the final answer still needs correction:

closing_message MUST be "".


==========================================
OUTPUT
==========================================

Return ONLY valid JSON.

Use this structure:

{
  "corrected_sentence": "string",
  "thai_explanation": "string",
  "correction_needed": true,
  "answer_relevant": true,
  "relevance_explanation": "string",
  "example_answer": "string",
  "next_question_id": "Q1",
  "closing_message": "string"
}
`.trim();


      // ======================================
      // GEMINI REQUEST
      // ======================================

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
                process.env
                  .GEMINI_API_KEY

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


      const geminiData =
        await geminiResponse
          .json();


      // ======================================
      // GEMINI ERROR
      // ======================================

      if (
        !geminiResponse.ok
      ) {

        console.error(
          "Gemini error:",
          geminiData
        );


        return res
          .status(
            geminiResponse.status
          )
          .json({

            error:
              "Gemini request failed",

            details:
              geminiData

          });

      }


      // ======================================
      // READ JSON TEXT
      // ======================================

      const text =
        geminiData
          ?.candidates?.[0]
          ?.content?.parts?.[0]
          ?.text;


      if (!text) {

        return res
          .status(500)
          .json({

            error:
              "Gemini returned no text"

          });

      }


      let result;


      try {

        result =
          JSON.parse(text);

      } catch (error) {

        console.error(
          "Gemini JSON parse error:",
          text
        );


        return res
          .status(500)
          .json({

            error:
              "Gemini returned invalid JSON"

          });

      }


      // ======================================
      // HARD SAFETY:
      // PUNCTUATION / CAPITALIZATION
      // ==========================================

      const originalNormalized =
        normalizeSpokenText(
          transcript
        );


      const correctedNormalized =
        normalizeSpokenText(
          result
            .corrected_sentence ||
          ""
        );


      let correctionNeeded =
        Boolean(
          result
            .correction_needed
        );


      let correctedSentence =
        result
          .corrected_sentence ||
        transcript;


      let thaiExplanation =
        result
          .thai_explanation ||
        "";


      // If spoken result is identical,
      // there is NO correction.
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
      // RELEVANCE
      // ======================================

      const answerRelevant =
        result
          .answer_relevant ===
        true;


      // ======================================
      // VALIDATE NEXT QUESTION
      // ======================================

      let nextQuestionId =
        String(
          result
            .next_question_id ||
          ""
        )
          .trim()
          .toUpperCase();


      let nextQuestion =
        "";


      // No next question if:
      // - irrelevant
      // - correction required
      // - final turn
      if (
        !answerRelevant ||
        correctionNeeded ||
        isFinalTurn
      ) {

        nextQuestionId =
          "";

      }


      // ======================================
      // VALID QUESTION ID
      // ======================================

      if (nextQuestionId) {

        const valid =
          Object.prototype
            .hasOwnProperty
            .call(
              QUESTION_BANK,
              nextQuestionId
            );


        const alreadyUsed =
          usedQuestionIds
            .has(
              nextQuestionId
            );


        if (
          !valid ||
          alreadyUsed
        ) {

          nextQuestionId =
            "";

        }

      }


      // ======================================
      // FALLBACK QUESTION
      // ======================================
      //
      // If Gemini fails to select a valid
      // available question, use the first
      // unused fixed question.
      //
      // Still NO AI-generated question.
      // ======================================

      if (
        answerRelevant &&
        !correctionNeeded &&
        !isFinalTurn &&
        !nextQuestionId
      ) {

        const fallbackId =
          availableQuestionIds[0];


        if (fallbackId) {

          nextQuestionId =
            fallbackId;

        }

      }


      // ======================================
      // MAP ID TO EXACT QUESTION TEXT
      // ======================================

      if (
        nextQuestionId &&
        QUESTION_BANK[
          nextQuestionId
        ]
      ) {

        nextQuestion =
          QUESTION_BANK[
            nextQuestionId
          ];

      }


      // ======================================
      // CLEAN IRRELEVANT FEEDBACK
      // ======================================

      let relevanceExplanation =
        result
          .relevance_explanation ||
        "";


      let exampleAnswer =
        result
          .example_answer ||
        "";


      if (answerRelevant) {

        relevanceExplanation =
          "";

        exampleAnswer =
          "";

      }


      // ======================================
      // CLOSING MESSAGE
      // ======================================

      let closingMessage =
        result
          .closing_message ||
        "";


      if (
        !isFinalTurn ||
        !answerRelevant ||
        correctionNeeded
      ) {

        closingMessage =
          "";

      }


      // ======================================
      // RESPONSE
      // ======================================

      return res.json({

        transcript,


        corrected_sentence:
          correctedSentence,


        thai_explanation:
          thaiExplanation,


        correction_needed:
          correctionNeeded,


        answer_relevant:
          answerRelevant,


        relevance_explanation:
          relevanceExplanation,


        example_answer:
          exampleAnswer,


        next_question_id:
          nextQuestionId,


        // Frontend currently uses this.
        next_question:
          nextQuestion,


        closing_message:
          closingMessage

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
      `Weekend AI Speaking Lab running on port ${port}`
    );

  }
);
