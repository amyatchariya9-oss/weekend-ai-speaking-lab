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
const completeScreen = $("completeScreen");

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

const speakArea =
  document.querySelector(
    ".speak-area"
  );

const correctionHeading =
  document.querySelector(
    ".correction-heading"
  );

const whyDivider =
  document.querySelector(
    ".why-divider"
  );

const whyLabel =
  document.querySelector(
    ".why-label"
  );


// ==========================================
// SUCCESS SOUND ✅
// STATIC FILE = NO ELEVENLABS CREDIT
// ==========================================

const successSound =
  new Audio(
    "/audio/weekend/effects/correct-success.mp3"
  );

successSound.preload =
  "auto";

let successSoundUnlocked =
  false;


// iPhone / Safari:
// unlock sound on the learner's first tap
async function unlockSuccessSound() {

  if (successSoundUnlocked) {
    return;
  }

  try {

    const oldVolume =
      successSound.volume;

    successSound.volume =
      0;

    await successSound.play();

    successSound.pause();

    successSound.currentTime =
      0;

    successSound.volume =
      oldVolume;

    successSoundUnlocked =
      true;

  } catch (error) {

    console.log(
      "Success sound will unlock on another tap."
    );

  }

}


function playSuccessSound() {

  try {

    successSound.pause();

    successSound.currentTime =
      0;

    successSound.volume =
      0.55;

    successSound
      .play()
      .catch(
        (error) => {

          console.log(
            "Success sound blocked:",
            error
          );

        }
      );

  } catch (error) {

    console.log(
      "Success sound error:",
      error
    );

  }

}


// ==========================================
// QUESTION AUDIO
// STATIC MP3 FILES
// ==========================================

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

let turn =
  1;

let currentQuestion =
  "Hey! How was your weekend?";

let nextQuestion =
  "";

let history =
  [];

let mediaRecorder =
  null;

let mediaStream =
  null;

let audioChunks =
  [];

let isRecording =
  false;

let currentAudio =
  null;

let isRetrying =
  false;

let pendingAnswer =
  null;


// ==========================================
// QUESTION HELPERS
// ==========================================

function normalizeQuestion(
  text = ""
) {

  return text
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


function getQuestionAudio(
  text
) {

  const normalized =
    normalizeQuestion(
      text
    );


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
// FEEDBACK LAYOUTS
// ==========================================

function showCorrectionLayout() {

  correctionHeading.style.display =
    "block";

  correctionHeading.textContent =
    "Better ✨";


  whyDivider.style.display =
    "block";

  whyLabel.style.display =
    "block";

  why.style.display =
    "block";


  tryAgainBtn.style.display =
    "block";


  continueBtn.style.display =
    "block";

  continueBtn.style.gridColumn =
    "auto";

}


function showSuccessLayout() {

  // No "Better"
  correctionHeading.style.display =
    "none";


  // No WHY section
  whyDivider.style.display =
    "none";

  whyLabel.style.display =
    "none";

  why.style.display =
    "none";


  // Correct already:
  // no Try again
  tryAgainBtn.style.display =
    "none";


  // Continue full width
  continueBtn.style.display =
    "block";

  continueBtn.style.gridColumn =
    "1 / -1";

}


// ==========================================
// CORRECTION DIFF
// ==========================================

function normalizeWord(
  word = ""
) {

  return word
    .toLowerCase()
    .replace(
      /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
      ""
    );

}


function createWordSpan(
  text,
  className
) {

  const span =
    document.createElement(
      "span"
    );

  span.textContent =
    text;

  span.className =
    className;

  return span;

}


function renderCorrectionDiff(
  originalText,
 
