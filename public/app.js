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

// Optional.
// Later we can add id="lessonTitle"
// inside index.html.
const lessonTitleEl =
  $("lessonTitle");


// ==========================================
// LESSON SETTINGS
// ==========================================

const DEFAULT_LESSON_ID =
  "weekend";

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const requestedLessonId =
  urlParams.get("lesson") ||
  DEFAULT_LESSON_ID;


let activeLesson = null;

let lessonId =
  requestedLessonId;

let questionBank = [];

let totalTurns = 5;


// ==========================================
// SUCCESS TEXT
// ==========================================

const FIRST_TRY_SUCCESS = [
  "Nice!",
  "Great job!",
  "That sounds great!"
];

const RETRY_SUCCESS = [
  "Perfect!",
  "Well done!",
  "Much better!"
];

let lastSuccessText = "";


// ==========================================
// SUCCESS DING 🔔
// ==========================================

const successDing =
  new Audio(
    "/audio/weekend/effects/clean-ding.mp3"
  );

successDing.preload = "auto";
successDing.volume = 0.55;

let successDingUnlocked =
  false;


// ==========================================
// FINISH SOUND 🎉
// ==========================================

const finishSound =
  new Audio(
    "/audio/weekend/effects/finish-cheer.mp3"
  );

finishSound.preload = "auto";
finishSound.volume = 0.75;


// ==========================================
// QUESTION AUDIO PLAYER 🔊
// ==========================================

const questionPlayer =
  new Audio();

questionPlayer.preload =
  "auto";

questionPlayer.volume =
  1;


// ==========================================
// STATE
// ==========================================

let turn = 1;

let currentQuestion = "";

let nextQuestion = "";

let history = [];

let mediaRecorder = null;

let mediaStream = null;

let audioChunks = [];

let isRecording = false;

let isRetrying = false;

let pendingAnswer = null;


// ==========================================
// LOAD LESSON
// ==========================================

async function loadLesson() {

  micBtn.disabled = true;

  listenBtn.disabled = true;

  statusEl.textContent =
    "Loading lesson…";


  try {

    const response =
      await fetch(
        "/lessons.json",
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "Could not load lessons.json"
      );

    }


    const lessons =
      await response.json();


    let lesson =
      lessons[requestedLessonId];


    // If URL contains an unknown lesson,
    // safely fall back to Weekend.
    if (!lesson) {

      console.warn(
        `Lesson "${requestedLessonId}" not found. Using Weekend.`
      );


      lesson =
        lessons[
          DEFAULT_LESSON_ID
        ];


      lessonId =
        DEFAULT_LESSON_ID;

    }


    if (!lesson) {

      throw new Error(
        "Weekend lesson not found."
      );

    }


    if (
      !Array.isArray(
        lesson.questions
      ) ||
      lesson.questions.length === 0
    ) {

      throw new Error(
        "Lesson has no questions."
      );

    }


    activeLesson =
      lesson;


    questionBank =
      lesson.questions;


    totalTurns =
      Number(
        lesson.turns
      ) || 5;


    currentQuestion =
      lesson.openingQuestion ||
      questionBank[0].text;


    questionEl.textContent =
      currentQuestion;


    if (lessonTitleEl) {

      lessonTitleEl.textContent =
        lesson.title ||
        "Speaking Lab";

    }


    updateProgress();


    statusEl.textContent =
      "Tap the mic to answer";


    micBtn.disabled = false;

    listenBtn.disabled = false;


    console.log(
      "Lesson loaded:",
      lessonId
    );


  } catch (error) {

    console.error(
      "Lesson loading error:",
      error
    );


    statusEl.textContent =
      "Could not load this lesson. Please refresh the page.";


    micBtn.disabled = true;

    listenBtn.disabled = true;

  }

}


// ==========================================
// QUESTION HELPERS
// ==========================================

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


function getQuestionAudio(
  text
) {

  const normalized =
    normalizeQuestion(
      text
    );


  const match =
    questionBank.find(
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
// SAFE FALLBACK QUESTION
// ==========================================

function getFallbackQuestion() {

  const usedQuestions =
    new Set(
      history.map(
        (item) =>
          normalizeQuestion(
            item.question
          )
      )
    );


  const candidate =
    questionBank.find(
      (item) => {

        const normalized =
          normalizeQuestion(
            item.text
          );


        return (
          normalized !==
            normalizeQuestion(
              currentQuestion
            ) &&
          !usedQuestions.has(
            normalized
          )
        );

      }
    );


  return candidate
    ? candidate.text
    : currentQuestion;

}


// ==========================================
// PLAY QUESTION AUDIO 🔊
// ==========================================

async function speakQuestion(
  text
) {

  const audioPath =
    getQuestionAudio(
      text
    );


  if (!audioPath) {

    console.error(
      "Question audio not found:",
      text
    );

    return;

  }


  try {

    questionPlayer.pause();

    questionPlayer.currentTime =
      0;


    questionPlayer.src =
      audioPath;


    questionPlayer.load();


    await questionPlayer.play();


  } catch (error) {

    console.error(
      "Question audio play error:",
      error
    );

  }

}


function stopQuestionAudio() {

  try {

    questionPlayer.pause();

    questionPlayer.currentTime =
      0;

  } catch (error) {

    console.log(
      "Could not stop question audio:",
      error
    );

  }

}


// ==========================================
// UNLOCK SUCCESS DING
// ==========================================

async function unlockSuccessDing() {

  if (
    successDingUnlocked
  ) {

    return;

  }


  try {

    const oldVolume =
      successDing.volume;


    successDing.volume = 0;


    await successDing.play();


    successDing.pause();

    successDing.currentTime =
      0;


    successDing.volume =
      oldVolume;


    successDingUnlocked =
      true;


  } catch (error) {

    console.log(
      "Success ding not unlocked yet."
    );

  }

}


// ==========================================
// PLAY SUCCESS DING
// ==========================================

function playSuccessDing() {

  try {

    successDing.pause();

    successDing.currentTime =
      0;

    successDing.volume =
      0.55;


    successDing
      .play()
      .catch(
        (error) => {

          console.log(
            "Success ding blocked:",
            error
          );

        }
      );


  } catch (error) {

    console.log(
      "Success ding error:",
      error
    );

  }

}


// ==========================================
// PLAY FINISH SOUND
// ==========================================

function playFinishSound() {

  try {

    successDing.pause();

    successDing.currentTime =
      0;


    finishSound.pause();

    finishSound.currentTime =
      0;

    finishSound.volume =
      0.75;


    finishSound
      .play()
      .catch(
        (error) => {

          console.log(
            "Finish sound blocked:",
            error
          );

        }
      );


  } catch (error) {

    console.log(
      "Finish sound error:",
      error
    );

  }

}


// ==========================================
// SUCCESS TEXT PICKER
// ==========================================

function pickSuccessText(
  wasRetry
) {

  const choices =
    wasRetry
      ? RETRY_SUCCESS
      : FIRST_TRY_SUCCESS;


  let available =
    choices.filter(
      (text) =>
        text !== lastSuccessText
    );


  if (
    available.length === 0
  ) {

    available =
      choices;

  }


  const selected =
    available[
      Math.floor(
        Math.random() *
        available.length
      )
    ];


  lastSuccessText =
    selected;


  return selected;

}


// ==========================================
// LUXURY CONFETTI ✨
// TOP-DOWN ONLY
// ==========================================

function launchConfetti() {

  const colors = [
    "#D6B768",
    "#EFE1BB",
    "#EAC4C4",
    "#D4CEE9",
    "#C5D6CF",
    "#F7F4ED",
    "#FFFFFF"
  ];


  const container =
    document.createElement(
      "div"
    );


  Object.assign(
    container.style,
    {
      position: "fixed",
      inset: "0",
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "99999"
    }
  );


  document.body.appendChild(
    container
  );


  const isMobile =
    window.innerWidth <= 600;


  const totalPieces =
    isMobile
      ? 30
      : 42;


  for (
    let i = 0;
    i < totalPieces;
    i++
  ) {

    const piece =
      document.createElement(
        "div"
      );


    const width =
      4 +
      Math.random() * 5;


    const height =
      9 +
      Math.random() * 8;


    const startX =
      Math.random() *
      window.innerWidth;


    const drift =
      -90 +
      Math.random() * 180;


    const rotation =
      -360 +
      Math.random() * 720;


    const duration =
      5200 +
      Math.random() * 2500;


    const delay =
      Math.random() * 1700;


    const color =
      colors[
        Math.floor(
          Math.random() *
          colors.length
        )
      ];


    Object.assign(
      piece.style,
      {
        position: "absolute",

        left:
          `${startX}px`,

        top:
          "-35px",

        width:
          `${width}px`,

        height:
          `${height}px`,

        background:
          color,

        borderRadius:
          Math.random() > 0.85
            ? "50%"
            : "2px",

        opacity:
          "0",

        willChange:
          "transform, opacity"
      }
    );


    container.appendChild(
      piece
    );


    piece.animate(
      [
        {
          transform:
            "translate3d(0, -20px, 0) rotate(0deg)",

          opacity: 0
        },

        {
          transform:
            `translate3d(
              ${drift * 0.2}px,
              ${window.innerHeight * 0.18}px,
              0
            )
            rotate(
              ${rotation * 0.2}deg
            )`,

          opacity: 1,

          offset: 0.2
        },

        {
          transform:
            `translate3d(
              ${drift * 0.6}px,
              ${window.innerHeight * 0.6}px,
              0
            )
            rotate(
              ${rotation * 0.6}deg
            )`,

          opacity: 0.95,

          offset: 0.65
        },

        {
          transform:
            `translate3d(
              ${drift}px,
              ${window.innerHeight + 80}px,
              0
            )
            rotate(
              ${rotation}deg
            )`,

          opacity: 0
        }
      ],

      {
        duration,
        delay,

        easing:
          "cubic-bezier(0.25, 0.46, 0.45, 0.94)",

        fill:
          "forwards"
      }
    );

  }


  setTimeout(
    () => {

      container.remove();

    },

    10000
  );

}


// ==========================================
// CELEBRATE
// ==========================================

function celebrateCompletion() {

  playFinishSound();

  launchConfetti();

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

  tryAgainBtn.style.gridColumn =
    "1 / -1";


  continueBtn.style.display =
    "none";

}


function showSuccessLayout() {

  correctionHeading.style.display =
    "none";


  whyDivider.style.display =
    "none";

  whyLabel.style.display =
    "none";

  why.style.display =
    "none";


  tryAgainBtn.style.display =
    "none";


  continueBtn.style.display =
    "block";

  continueBtn.style.gridColumn =
    "1 / -1";

}


// ==========================================
// WORD DIFF
// ==========================================

function normalizeWord(
  word = ""
) {

  return String(word)
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
  correctedText
) {

  better.innerHTML = "";


  const originalWords =
    originalText
      .trim()
      .split(/\s+/)
      .filter(Boolean);


  const correctedWords =
    correctedText
      .trim()
      .split(/\s+/)
      .filter(Boolean);


  const m =
    originalWords.length;


  const n =
    correctedWords.length;


  const dp =
    Array.from(
      {
        length: m + 1
      },
      () =>
        Array(
          n + 1
        ).fill(0)
    );


  for (
    let i = m - 1;
    i >= 0;
    i--
  ) {

    for (
      let j = n - 1;
      j >= 0;
      j--
    ) {

      if (
        normalizeWord(
          originalWords[i]
        ) ===
        normalizeWord(
          correctedWords[j]
        )
      ) {

        dp[i][j] =
          dp[i + 1][j + 1] +
          1;

      }

      else {

        dp[i][j] =
          Math.max(
            dp[i + 1][j],
            dp[i][j + 1]
          );

      }

    }

  }


  const operations = [];


  let i = 0;

  let j = 0;


  while (
    i < m &&
    j < n
  ) {

    if (
      normalizeWord(
        originalWords[i]
      ) ===
      normalizeWord(
        correctedWords[j]
      )
    ) {

      operations.push({
        type: "same",
        text:
          correctedWords[j]
      });


      i++;
      j++;


      continue;

    }


    if (
      dp[i + 1][j] >=
      dp[i][j + 1]
    ) {

      operations.push({
        type: "removed",
        text:
          originalWords[i]
      });


      i++;

    }

    else {

      operations.push({
        type: "added",
        text:
          correctedWords[j]
      });


      j++;

    }

  }


  while (i < m) {

    operations.push({
      type: "removed",
      text:
        originalWords[i]
    });


    i++;

  }


  while (j < n) {

    operations.push({
      type: "added",
      text:
        correctedWords[j]
    });


    j++;

  }


  operations.forEach(
    (
      operation,
      index
    ) => {

      let className =
        "word-normal";


      if (
        operation.type ===
        "removed"
      ) {

        className =
          "word-removed";

      }


      if (
        operation.type ===
        "added"
      ) {

        className =
          "word-added";

      }


      better.appendChild(
        createWordSpan(
          operation.text,
          className
        )
      );


      if (
        index <
        operations.length - 1
      ) {

        better.appendChild(
          document.createTextNode(
            " "
          )
        );

      }

    }
  );

}


// ==========================================
// PROGRESS
// ==========================================

function updateProgress() {

  const steps =
    progressBar.querySelectorAll(
      ".progress-step"
    );


  steps.forEach(
    (step) => {

      const number =
        Number(
          step.dataset.step
        );


      if (
        number === turn
      ) {

        step.classList.add(
          "active"
        );

      }

      else {

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
// TRANSCRIBE
// ==========================================

async function transcribeAudio(
  audioBlob
) {

  const response =
    await fetch(
      "/transcribe",
      {
        method: "POST",

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
    data.transcript ||
    ""
  );

}


// ==========================================
// AI CORRECTION
// ==========================================

async function getAICorrection(
  transcript
) {

  const response =
    await fetch(
      "/correct",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            lesson_id:
              lessonId,

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
// SAVE TURN
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


  pendingAnswer = null;

}


// ==========================================
// RESET FEEDBACK
// ==========================================

function resetFeedbackUI() {

  feedback.style.display =
    "none";


  retryView.style.display =
    "none";


  youSaid.textContent = "—";

  better.textContent = "—";

  why.textContent = "—";


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

  tryAgainBtn.style.gridColumn =
    "auto";


  continueBtn.style.display =
    "block";

  continueBtn.style.gridColumn =
    "auto";

  continueBtn.disabled =
    false;

}


// ==========================================
// SHOW FEEDBACK
// ==========================================

async function showFeedback(
  transcript
) {

  speakArea.style.display =
    "none";


  retryView.style.display =
    "none";


  feedback.style.display =
    "block";


  youSaid.textContent =
    transcript;


  better.textContent =
    "Checking…";


  why.textContent =
    "กำลังตรวจคำตอบ…";


  continueBtn.style.display =
    "none";


  tryAgainBtn.style.display =
    "none";


  try {

    const result =
      await getAICorrection(
        transcript
      );


    nextQuestion =
      result.next_question ||
      "";


    // ======================================
    // IRRELEVANT
    // ======================================

    if (
      result.answer_relevant ===
      false
    ) {

      showCorrectionLayout();


      correctionHeading.textContent =
        "Try again 💬";


      better.textContent =
        "Answer the question above.";


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


      pendingAnswer = null;

      isRetrying = false;


      tryAgainBtn.textContent =
        "🎙 Answer again";


      tryAgainBtn.style.display =
        "block";


      continueBtn.style.display =
        "none";


      return;

    }


    // ======================================
    // CORRECTION NEEDED
    // ======================================

    if (
      result.correction_needed
    ) {

      showCorrectionLayout();


      renderCorrectionDiff(
        transcript,
        result.corrected_sentence
      );


      why.textContent =
        result.thai_explanation ||
        "ปรับนิดเดียวให้ประโยคฟังเป็นธรรมชาติมากขึ้นค่ะ";


      why.style.whiteSpace =
        "normal";


      pendingAnswer = {
        original:
          transcript,

        corrected:
          result.corrected_sentence ||
          transcript
      };


      tryAgainBtn.textContent =
        "🎙 Try again";


      tryAgainBtn.style.display =
        "block";


      continueBtn.style.display =
        "none";


      return;

    }


    // ======================================
    // CORRECT ✅
    // ======================================

    const wasRetry =
      isRetrying;


    showSuccessLayout();


    const successText =
      pickSuccessText(
        wasRetry
      );


    better.textContent =
      `${successText} ✅`;


    playSuccessDing();


    saveCurrentTurn(
      transcript,
      transcript
    );


    isRetrying = false;


    continueBtn.textContent =
      turn >= totalTurns
        ? "Finish →"
        : "Continue →";


    continueBtn.style.display =
      "block";


    continueBtn.disabled =
      false;


  } catch (error) {

    console.error(
      "Feedback error:",
      error
    );


    showCorrectionLayout();


    correctionHeading.textContent =
      "Try again";


    better.textContent =
      "Let's try again.";


    why.textContent =
      "ระบบตรวจคำตอบมีปัญหาชั่วคราว ลองพูดอีกครั้งค่ะ";


    tryAgainBtn.textContent =
      "🎙 Try again";


    continueBtn.style.display =
      "none";

  }

}


// ==========================================
// START RECORDING 🎙
// ==========================================

async function startRecording() {

  if (!activeLesson) {

    return;

  }


  try {

    stopQuestionAudio();


    unlockSuccessDing();


    audioChunks = [];


    mediaStream =
      await navigator
        .mediaDevices
        .getUserMedia({
          audio: true
        });


    let options = {};


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


    isRecording = true;


    micBtn.classList.add(
      "recording"
    );


    micBtn.textContent =
      "■";


    statusEl.textContent =
      isRetrying
        ? "Listening… say it again."
        : "Listening… take your time.";


  } catch (error) {

    console.error(
      "Microphone error:",
      error
    );


    isRecording = false;


    micBtn.classList.remove(
      "recording"
    );


    micBtn.textContent =
      "🎙";


    micBtn.disabled =
      false;


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


  isRecording = false;


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


  if (mediaStream) {

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
          type: mimeType
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


      speakArea.style.display =
        "block";


      return;

    }


    await showFeedback(
      transcript.trim()
    );


  } catch (error) {

    console.error(
      "Recording processing error:",
      error
    );


    statusEl.textContent =
      "I couldn't process that. Please try again.";


    speakArea.style.display =
      "block";


  } finally {

    micBtn.disabled =
      false;


    audioChunks = [];

  }

}


// ==========================================
// MIC
// ==========================================

micBtn.addEventListener(
  "click",
  () => {

    if (isRecording) {

      stopRecording();

    }

    else {

      startRecording();

    }

  }
);


// ==========================================
// LISTEN 🔊
// ==========================================

listenBtn.addEventListener(
  "click",
  async () => {

    if (!activeLesson) {

      return;

    }


    listenBtn.disabled =
      true;


    try {

      await speakQuestion(
        currentQuestion
      );

    }

    finally {

      listenBtn.disabled =
        false;

    }

  }
);


// ==========================================
// TRY AGAIN
// ==========================================

tryAgainBtn.addEventListener(
  "click",
  () => {

    speakArea.style.display =
      "block";


    feedback.style.display =
      "none";


    if (pendingAnswer) {

      isRetrying = true;


      retryView.style.display =
        "block";


      retrySentence.textContent =
        pendingAnswer.corrected;


      statusEl.textContent =
        "Tap the mic and say it again.";


      return;

    }


    isRetrying = false;


    retryView.style.display =
      "none";


    statusEl.textContent =
      "Answer the same question again.";

  }
);


// ==========================================
// COMPLETE 🎉
// ==========================================

function showCompleteScreen() {

  stopQuestionAudio();


  successDing.pause();

  successDing.currentTime =
    0;


  lessonCard.style.display =
    "none";


  progressBar.style.display =
    "none";


  completeScreen.style.display =
    "block";


  completedQuestions.textContent =
    String(
      totalTurns
    );


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  celebrateCompletion();

}


// ==========================================
// CONTINUE
// ==========================================

continueBtn.addEventListener(
  "click",
  async () => {

    if (pendingAnswer) {

      return;

    }


    // ======================================
    // FINISH
    // ======================================

    if (
      turn >= totalTurns
    ) {

      showCompleteScreen();

      return;

    }


    successDing.pause();

    successDing.currentTime =
      0;


    // ======================================
    // NEXT TURN
    // ======================================

    turn += 1;


    updateProgress();


    currentQuestion =
      nextQuestion ||
      getFallbackQuestion();


    questionEl.textContent =
      currentQuestion;


    nextQuestion = "";

    pendingAnswer = null;

    isRetrying = false;


    resetFeedbackUI();


    speakArea.style.display =
      "block";


    statusEl.textContent =
      "Tap the mic to answer";


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

    if (!activeLesson) {

      return;

    }


    stopQuestionAudio();


    successDing.pause();

    successDing.currentTime =
      0;


    finishSound.pause();

    finishSound.currentTime =
      0;


    turn = 1;


    currentQuestion =
      activeLesson.openingQuestion ||
      questionBank[0].text;


    nextQuestion = "";


    history = [];


    pendingAnswer = null;


    isRetrying = false;

    isRecording = false;


    lastSuccessText = "";


    questionEl.textContent =
      currentQuestion;


    progressBar.style.display =
      "flex";


    completeScreen.style.display =
      "none";


    lessonCard.style.display =
      "block";


    resetFeedbackUI();


    speakArea.style.display =
      "block";


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
      top: 0,
      behavior: "smooth"
    });

  }
);


// ==========================================
// INITIAL
// ==========================================

loadLesson();
