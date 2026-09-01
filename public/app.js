const $ = (id) =>
  document.getElementById(id);


// ==========================================
// ELEMENTS
// ==========================================

const micBtn = $("mic");
const statusEl = $("status");

const feedback = $("feedback");
const youSaid = $("youSaid");
const better = $("better");
const why = $("why");

const questionEl = $("question");
const turnEl = $("turn");
const listenBtn = $("listen");

const tryAgainBtn = $("tryAgain");
const continueBtn = $("continueBtn");

const lessonCard = $("lessonCard");

const completeScreen =
  $("completeScreen");

const practiceAgainBtn =
  $("practiceAgain");

const completedQuestions =
  $("completedQuestions");

const progressBar =
  $("progressBar");

const retryView =
  $("retryView");

const retrySentence =
  $("retrySentence");


// ==========================================
// QUESTION BANK AUDIO
// ==========================================
//
// These are STATIC MP3 files.
//
// They DO NOT call ElevenLabs.
//
// public/audio/weekend/q1.mp3
// ...
// public/audio/weekend/q10.mp3

const QUESTION_AUDIO = [

  {
    text:
      "Hey! How was your weekend?",

    audio:
      "/audio/weekend/q1.mp3"
  },

  {
    text:
      "What did you do?",

    audio:
      "/audio/weekend/q2.mp3"
  },

  {
    text:
      "Tell me more about it.",

    audio:
      "/audio/weekend/q3.mp3"
  },

  {
    text:
      "Where did you go?",

    audio:
      "/audio/weekend/q4.mp3"
  },

  {
    text:
      "Who were you with?",

    audio:
      "/audio/weekend/q5.mp3"
  },

  {
    text:
      "What happened next?",

    audio:
      "/audio/weekend/q6.mp3"
  },

  {
    text:
      "How did you feel?",

    audio:
      "/audio/weekend/q7.mp3"
  },

  {
    text:
      "What did you like about it?",

    audio:
      "/audio/weekend/q8.mp3"
  },

  {
    text:
      "What was the best part?",

    audio:
      "/audio/weekend/q9.mp3"
  },

  {
    text:
      "Would you do it again?",

    audio:
      "/audio/weekend/q10.mp3"
  }

];


// ==========================================
// STATE
// ==========================================

let turn = 1;

let currentQuestion =
  "Hey! How was your weekend?";

let nextQuestion = "";

let history = [];


let mediaRecorder = null;
let mediaStream = null;

let audioChunks = [];

let isRecording = false;

let currentAudio = null;


// True when learner pressed
// Try again after a correction.
let isRetrying = false;


// Keeps the correction until
// learner retries or continues.
let pendingAnswer = null;


// ==========================================
// NORMALIZE QUESTION
// ==========================================

function normalizeQuestion(
  text = ""
) {

  return text
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

}


// ==========================================
// FIND STATIC AUDIO
// ==========================================

function getQuestionAudio(
  text
) {

  const normalized =
    normalizeQuestion(text);


  const match =
    QUESTION_AUDIO.find(
      (item) =>

        normalizeQuestion(
          item.text
        ) === normalized
    );


  return match
    ? match.audio
    : null;

}


// ==========================================
// STOP CURRENT AUDIO
// ==========================================

function stopCurrentAudio() {

  if (!currentAudio) {
    return;
  }


  currentAudio.pause();

  currentAudio.currentTime =
    0;

  currentAudio =
    null;

}


// ==========================================
// PLAY STATIC QUESTION AUDIO
// ==========================================
//
// IMPORTANT:
//
// This does NOT call /tts.
//
// Therefore tutor questions
// do not spend ElevenLabs TTS credits.

async function speakQuestion(
  text
) {

  try {

    const audioPath =
      getQuestionAudio(
        text
      );


    if (!audioPath) {

      console.error(
        "No saved audio for:",
        text
      );


      statusEl.textContent =
        "Question audio unavailable.";


      return;

    }


    stopCurrentAudio();


    currentAudio =
      new Audio(
        audioPath
      );


    currentAudio.onended =
      () => {

        currentAudio =
          null;

      };


    currentAudio.onerror =
      () => {

        console.error(
          "Could not play:",
          audioPath
        );


        currentAudio =
          null;


        statusEl.textContent =
          "Question audio unavailable.";

      };


    await currentAudio.play();


  } catch (error) {

    console.error(
      "Question audio error:",
      error
    );

  }

}


// ==========================================
// UPDATE PROGRESS
// ==========================================

function updateProgress() {

  const steps =
    progressBar.querySelectorAll(
      ".progress-step"
    );


  steps.forEach(
    (step) => {

      const stepNumber =
        Number(
          step.dataset.step
        );


      if (
        stepNumber === turn
      ) {

        step.classList.add(
          "active"
        );

      } else {

        step.classList.remove(
          "active"
        );

      }

    }
  );


  turnEl.textContent =
    String(turn);

}


// ==========================================
// SPEECH TO TEXT
// ==========================================

async function transcribeAudio(
  audioBlob
) {

  const response =
    await fetch(
      "/transcribe",
      {

        method:
          "POST",

        headers: {

          "Content-Type":
            audioBlob.type ||
            "application/octet-stream"

        },

        body:
          audioBlob

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data?.error ||
      "Could not transcribe audio"
    );

  }


  return (
    data.transcript || ""
  );

}


// ==========================================
// GEMINI CORRECTION
// ==========================================

async function getAICorrection(
  transcript
) {

  const response =
    await fetch(
      "/correct",
      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify({

            transcript,

            turn,

            current_question:
              currentQuestion,

            history

          })

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data?.error ||
      "Could not check answer"
    );

  }


  return data;

}


// ==========================================
// SAVE CURRENT TURN
// ==========================================

function saveCurrentTurn(
  answer,
  correctedAnswer
) {

  history.push({

    question:
      currentQuestion,

    answer,

    corrected_answer:
      correctedAnswer ||
      answer

  });


  pendingAnswer =
    null;

}


// ==========================================
// RESET FEEDBACK DISPLAY
// ==========================================

function resetFeedbackUI() {

  feedback.style.display =
    "none";


  retryView.style.display =
    "none";


  youSaid.textContent =
    "—";


  better.textContent =
    "—";


  why.textContent =
    "—";

}


// ==========================================
// SHOW FEEDBACK
// ==========================================

async function showFeedback(
  transcript
) {

  retryView.style.display =
    "none";


  feedback.style.display =
    "block";


  youSaid.textContent =
    transcript;


  better.textContent =
    "Checking…";


  why.textContent =
    "กำลังตรวจคำตอบของคุณ…";


  statusEl.textContent =
    "Checking your answer…";


  continueBtn.disabled =
    true;


  continueBtn.style.display =
    "block";


  continueBtn.textContent =
    "Checking…";


  try {

    const result =
      await getAICorrection(
        transcript
      );


    nextQuestion =
      result.next_question || "";


    // ======================================
    // ANSWER NOT RELEVANT
    // ======================================

    if (
      result.answer_relevant ===
      false
    ) {

      better.textContent =
        "Let's try that question again 💬";


      let explanation =
        result.relevance_explanation ||
        "คำตอบนี้ยังไม่ตรงกับคำถามค่ะ";


      if (
        result.example_answer
      ) {

        explanation +=
          `\n\nตัวอย่าง: ${result.example_answer}`;

      }


      why.textContent =
        explanation;


      why.style.whiteSpace =
        "pre-line";


      statusEl.textContent =
        "Try answering the same question again.";


      pendingAnswer =
        null;


      isRetrying =
        false;


      continueBtn.style.display =
        "none";


      tryAgainBtn.textContent =
        "🎙 Answer again";


      feedback.scrollIntoView({

        behavior:
          "smooth",

        block:
          "nearest"

      });


      return;

    }


    // ======================================
    // CORRECTION NEEDED
    // ======================================

    if (
      result.correction_needed
    ) {

      better.textContent =
        result.corrected_sentence;


      why.textContent =
        result.thai_explanation ||
        "ปรับนิดเดียวให้ประโยคฟังเป็นธรรมชาติมากขึ้นค่ะ";


      why.style.whiteSpace =
        "normal";


      statusEl.textContent =
        "Nice try! Let's make it even better ✨";


      pendingAnswer = {

        original:
          transcript,

        corrected:
          result.corrected_sentence ||
          transcript

      };


      tryAgainBtn.textContent =
        "🎙 Try again";


      continueBtn.style.display =
        "block";


      continueBtn.textContent =
        turn >= 5
          ? "Finish →"
          : "Continue →";


      continueBtn.disabled =
        false;


      feedback.scrollIntoView({

        behavior:
          "smooth",

        block:
          "nearest"

      });


      return;

    }


    // ======================================
    // CORRECT ANSWER
    // ======================================

    better.textContent =
      "Sounds good! ✅";


    why.textContent =
      isRetrying

        ? "ดีมากค่ะ รอบนี้ประโยคถูกต้องและฟังเป็นธรรมชาติแล้ว"

        : "ประโยคนี้เป็นธรรมชาติและตอบคำถามได้ดีค่ะ";


    why.style.whiteSpace =
      "normal";


    statusEl.textContent =
      isRetrying

        ? "Great! That sounds natural 👏"

        : "Nice! Your answer works well.";


    // --------------------------------------
    // SAVE ONLY ONE FINAL ANSWER
    // --------------------------------------

    if (
      isRetrying
    ) {

      saveCurrentTurn(
        transcript,
        transcript
      );


      isRetrying =
        false;

    }

    else {

      saveCurrentTurn(

        transcript,

        result.corrected_sentence ||
        transcript

      );

    }


    tryAgainBtn.textContent =
      "🎙 Try again";


    continueBtn.style.display =
      "block";


    continueBtn.textContent =
      turn >= 5
        ? "Finish →"
        : "Continue →";


    continueBtn.disabled =
      false;


  } catch (error) {

    console.error(
      error
    );


    better.textContent =
      "Let's try again.";


    why.textContent =
      "ระบบตรวจคำตอบมีปัญหาชั่วคราว ลองพูดอีกครั้งค่ะ";


    statusEl.textContent =
      "Something went wrong.";


    continueBtn.disabled =
      true;

  }


  feedback.scrollIntoView({

    behavior:
      "smooth",

    block:
      "nearest"

  });

}


// ==========================================
// START RECORDING
// ==========================================

async function startRecording() {

  try {

    audioChunks =
      [];


    mediaStream =
      await navigator
        .mediaDevices
        .getUserMedia({

          audio:
            true

        });


    let options =
      {};


    if (
      MediaRecorder
        .isTypeSupported(
          "audio/webm;codecs=opus"
        )
    ) {

      options = {

        mimeType:
          "audio/webm;codecs=opus"

      };

    }

    else if (
      MediaRecorder
        .isTypeSupported(
          "audio/webm"
        )
    ) {

      options = {

        mimeType:
          "audio/webm"

      };

    }

    else if (
      MediaRecorder
        .isTypeSupported(
          "audio/mp4"
        )
    ) {

      options = {

        mimeType:
          "audio/mp4"

      };

    }


    mediaRecorder =
      new MediaRecorder(

        mediaStream,

        options

      );


    mediaRecorder.ondataavailable =
      (event) => {

        if (
          event.data &&
          event.data.size > 0
        ) {

          audioChunks.push(
            event.data
          );

        }

      };


    mediaRecorder.onstop =
      handleRecordingFinished;


    mediaRecorder.start();


    isRecording =
      true;


    micBtn.classList.add(
      "recording"
    );


    micBtn.textContent =
      "■";


    if (
      isRetrying
    ) {

      retryView.style.display =
        "block";


      feedback.style.display =
        "none";


      statusEl.textContent =
        "Listening… say the corrected sentence.";

    }

    else {

      statusEl.textContent =
        "Listening… take your time.";

    }


  } catch (error) {

    console.error(
      error
    );


    statusEl.textContent =
      "Please allow microphone access and try again.";

  }

}


// ==========================================
// STOP RECORDING
// ==========================================

function stopRecording() {

  if (
    !mediaRecorder ||
    mediaRecorder.state ===
      "inactive"
  ) {

    return;

  }


  isRecording =
    false;


  micBtn.classList.remove(
    "recording"
  );


  micBtn.textContent =
    "🎙";


  micBtn.disabled =
    true;


  statusEl.textContent =
    "Checking your answer…";


  mediaRecorder.stop();


  if (
    mediaStream
  ) {

    mediaStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

  }

}


// ==========================================
// RECORDING FINISHED
// ==========================================

async function handleRecordingFinished() {

  try {

    const mimeType =
      mediaRecorder?.mimeType ||
      audioChunks?.[0]?.type ||
      "audio/webm";


    const audioBlob =
      new Blob(

        audioChunks,

        {
          type:
            mimeType
        }

      );


    if (
      audioBlob.size < 500
    ) {

      throw new Error(
        "Recording too short"
      );

    }


    const transcript =
      await transcribeAudio(
        audioBlob
      );


    if (
      !transcript.trim()
    ) {

      statusEl.textContent =
        "I couldn't hear that. Try again.";


      micBtn.disabled =
        false;


      return;

    }


    await showFeedback(
      transcript.trim()
    );


  } catch (error) {

    console.error(
      error
    );


    statusEl.textContent =
      "I couldn't process that. Please try again.";


  } finally {

    micBtn.disabled =
      false;


    audioChunks =
      [];

  }

}


// ==========================================
// MIC BUTTON
// ==========================================

micBtn.addEventListener(
  "click",
  () => {

    if (
      isRecording
    ) {

      stopRecording();

    }

    else {

      startRecording();

    }

  }
);


// ==========================================
// LISTEN TO QUESTION
// ==========================================
//
// STATIC MP3.
//
// NO ElevenLabs TTS charge.

listenBtn.addEventListener(
  "click",
  async () => {

    listenBtn.disabled =
      true;


    const originalText =
      listenBtn.textContent;


    listenBtn.textContent =
      "…";


    await speakQuestion(
      currentQuestion
    );


    listenBtn.textContent =
      originalText;


    listenBtn.disabled =
      false;

  }
);


// ==========================================
// TRY AGAIN
// ==========================================

tryAgainBtn.addEventListener(
  "click",
  () => {

    // ======================================
    // RETRY A CORRECTED SENTENCE
    // ======================================

    if (
      pendingAnswer
    ) {

      isRetrying =
        true;


      feedback.style.display =
        "none";


      retryView.style.display =
        "block";


      retrySentence.textContent =
        pendingAnswer.corrected;


      statusEl.textContent =
        "Tap the mic and say it again.";


      return;

    }


    // ======================================
    // WRONG TOPIC / ANSWER AGAIN
    // ======================================

    isRetrying =
      false;


    feedback.style.display =
      "none";


    retryView.style.display =
      "none";


    statusEl.textContent =
      "Answer the same question again.";

  }
);


// ==========================================
// COMPLETE SCREEN
// ==========================================

function showCompleteScreen() {

  stopCurrentAudio();


  lessonCard.style.display =
    "none";


  progressBar.style.display =
    "none";


  completeScreen.style.display =
    "block";


  completedQuestions.textContent =
    "5";


  window.scrollTo({

    top:
      0,

    behavior:
      "smooth"

  });


  // IMPORTANT:
  //
  // No ElevenLabs TTS here.
  //
  // This keeps the ending free too.

}


// ==========================================
// CONTINUE / FINISH
// ==========================================

continueBtn.addEventListener(
  "click",
  async () => {

    // --------------------------------------
    // Learner had correction
    // but chose Continue instead.
    // Save it once.
    // --------------------------------------

    if (
      pendingAnswer
    ) {

      saveCurrentTurn(

        pendingAnswer.original,

        pendingAnswer.corrected

      );


      isRetrying =
        false;

    }


    // ======================================
    // FINISH
    // ======================================

    if (
      turn >= 5
    ) {

      showCompleteScreen();

      return;

    }


    // ======================================
    // NEXT TURN
    // ======================================

    turn +=
      1;


    updateProgress();


    currentQuestion =
      nextQuestion ||
      "Tell me more about it.";


    questionEl.textContent =
      currentQuestion;


    nextQuestion =
      "";


    pendingAnswer =
      null;


    isRetrying =
      false;


    resetFeedbackUI();


    statusEl.textContent =
      "Tap the mic to answer";


    // --------------------------------------
    // Static saved MP3
    // --------------------------------------

    await speakQuestion(
      currentQuestion
    );

  }
);


// ==========================================
// PRACTICE AGAIN
// ==========================================

practiceAgainBtn.addEventListener(
  "click",
  () => {

    stopCurrentAudio();


    turn =
      1;


    currentQuestion =
      "Hey! How was your weekend?";


    nextQuestion =
      "";


    history =
      [];


    pendingAnswer =
      null;


    isRetrying =
      false;


    isRecording =
      false;


    questionEl.textContent =
      currentQuestion;


    progressBar.style.display =
      "flex";


    completeScreen.style.display =
      "none";


    lessonCard.style.display =
      "block";


    resetFeedbackUI();


    micBtn.disabled =
      false;


    micBtn.textContent =
      "🎙";


    micBtn.classList.remove(
      "recording"
    );


    continueBtn.style.display =
      "block";


    continueBtn.disabled =
      false;


    continueBtn.textContent =
      "Continue →";


    tryAgainBtn.textContent =
      "🎙 Try again";


    statusEl.textContent =
      "Tap the mic to answer";


    updateProgress();


    window.scrollTo({

      top:
        0,

      behavior:
        "smooth"

    });

  }
);


// ==========================================
// INITIAL UI
// ==========================================

updateProgress();
