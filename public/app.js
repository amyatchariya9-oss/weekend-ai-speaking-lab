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


let lastSuccessText =
  "";


// ==========================================
// CORRECT ANSWER DING 🔔
// ==========================================

const successDing =
  new Audio(
    "/audio/weekend/effects/clean-ding.mp3"
  );


successDing.preload =
  "auto";


successDing.volume =
  0.55;


let successDingUnlocked =
  false;


// ==========================================
// FINISH CELEBRATION SOUND 🎉
// ==========================================

const finishSound =
  new Audio(
    "/audio/weekend/effects/finish-cheer.mp3"
  );


finishSound.preload =
  "auto";


finishSound.volume =
  0.8;


let finishSoundUnlocked =
  false;


// ==========================================
// UNLOCK AUDIO FOR MOBILE
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


    successDing.volume =
      0;


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
      "Success ding waiting for user interaction."
    );

  }

}


async function unlockFinishSound() {

  if (
    finishSoundUnlocked
  ) {
    return;
  }


  try {

    const oldVolume =
      finishSound.volume;


    finishSound.volume =
      0;


    await finishSound.play();


    finishSound.pause();


    finishSound.currentTime =
      0;


    finishSound.volume =
      oldVolume;


    finishSoundUnlocked =
      true;


  } catch (error) {

    console.log(
      "Finish sound waiting for user interaction."
    );

  }

}


// ==========================================
// PLAY SOUNDS
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


function playFinishSound() {

  try {

    successDing.pause();


    finishSound.pause();


    finishSound.currentTime =
      0;


    finishSound.volume =
      0.8;


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
// CONFETTI 🎊
// ==========================================

function launchConfetti() {

  const colors = [
    "#E7C873", // soft gold
    "#F4E8C1", // champagne
    "#F3C6C6", // blush
    "#D9D2F2", // soft lavender
    "#BFD8D2", // muted mint
    "#FFFFFF"  // white
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


  // ========================================
  // LUXURY CONFETTI
  // ========================================

  const totalPieces =
    48;


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
      5 +
      Math.random() * 5;


    const height =
      9 +
      Math.random() * 8;


    const startX =
      Math.random() *
      window.innerWidth;


    const drift =
      -120 +
      Math.random() * 240;


    const rotation =
      -540 +
      Math.random() * 1080;


    const duration =
      4300 +
      Math.random() * 2400;


    const delay =
      Math.random() * 1200;


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
          "-30px",

        width:
          `${width}px`,

        height:
          `${height}px`,

        background:
          color,

        borderRadius:
          Math.random() > 0.75
            ? "50%"
            : "2px",

        opacity:
          "0",

        boxShadow:
          color === "#FFFFFF"
            ? "0 0 6px rgba(255,255,255,.5)"
            : "none",

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
            "translate3d(0,-20px,0) rotate(0deg)",

          opacity: 0
        },

        {
          transform:
            `translate3d(${drift * 0.25}px, ${window.innerHeight * 0.25}px, 0) rotate(${rotation * 0.25}deg)`,

          opacity: 1,

          offset: 0.25
        },

        {
          transform:
            `translate3d(${drift * 0.7}px, ${window.innerHeight * 0.65}px, 0) rotate(${rotation * 0.7}deg)`,

          opacity: 0.95,

          offset: 0.7
        },

        {
          transform:
            `translate3d(${drift}px, ${window.innerHeight + 80}px, 0) rotate(${rotation}deg)`,

          opacity: 0
        }
      ],

      {
        duration,
        delay,

        easing:
          "cubic-bezier(0.22, 0.61, 0.36, 1)",

        fill:
          "forwards"
      }
    );

  }


  setTimeout(
    () => {

      container.remove();

    },

    8500
  );

}
  // ========================================
  // CREATE ONE CONFETTI PIECE
  // ========================================

  function createPiece(
    originX,
    originY,
    direction
  ) {

    const piece =
      document.createElement(
        "div"
      );


    const width =
      5 +
      Math.random() * 8;


    const height =
      8 +
      Math.random() * 12;


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
        position:
          "absolute",

        left:
          `${originX}px`,

        top:
          `${originY}px`,

        width:
          `${width}px`,

        height:
          `${height}px`,

        background:
          color,

        borderRadius:
          Math.random() >
          0.65
            ? "50%"
            : "2px",

        opacity:
          "1",

        willChange:
          "transform, opacity"
      }
    );


    container.appendChild(
      piece
    );


    let xMovement;


    if (
      direction === "left"
    ) {

      xMovement =
        100 +
        Math.random() * 400;

    }

    else if (
      direction === "right"
    ) {

      xMovement =
        -100 -
        Math.random() * 400;

    }

    else {

      xMovement =
        -300 +
        Math.random() * 600;

    }


    const upMovement =
      220 +
      Math.random() * 420;


    const fallMovement =
      window.innerHeight +
      150;


    const rotation =
      -900 +
      Math.random() * 1800;


    const duration =
      1800 +
      Math.random() * 1600;


    piece.animate(
      [
        {
          transform:
            "translate3d(0, 0, 0) rotate(0deg)",

          opacity:
            1
        },

        {
          transform:
            `translate3d(${xMovement * 0.6}px, -${upMovement}px, 0) rotate(${rotation * 0.5}deg)`,

          opacity:
            1,

          offset:
            0.35
        },

        {
          transform:
            `translate3d(${xMovement}px, ${fallMovement}px, 0) rotate(${rotation}deg)`,

          opacity:
            0.85
        }
      ],

      {
        duration,

        easing:
          "cubic-bezier(0.18, 0.75, 0.25, 1)",

        fill:
          "forwards"
      }
    );

  }


  // ========================================
  // LEFT CANNON
  // ========================================

  for (
    let i = 0;
    i < 35;
    i++
  ) {

    setTimeout(
      () => {

        createPiece(
          20,
          window.innerHeight -
            40,
          "left"
        );

      },

      Math.random() *
        180
    );

  }


  // ========================================
  // RIGHT CANNON
  // ========================================

  for (
    let i = 0;
    i < 35;
    i++
  ) {

    setTimeout(
      () => {

        createPiece(
          window.innerWidth -
            20,

          window.innerHeight -
            40,

          "right"
        );

      },

      Math.random() *
        180
    );

  }


  // ========================================
  // CENTER BURST
  // ========================================

  for (
    let i = 0;
    i < 30;
    i++
  ) {

    setTimeout(
      () => {

        createPiece(
          window.innerWidth /
            2,

          window.innerHeight *
            0.65,

          "center"
        );

      },

      120 +
      Math.random() *
        220
    );

  }


  // Remove DOM after animation
  setTimeout(
    () => {

      container.remove();

    },

    4200
  );

}


// ==========================================
// CELEBRATION
// ==========================================

function celebrateCompletion() {

  playFinishSound();

  launchConfetti();

}

// ==========================================
// QUESTION AUDIO
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
        ) ===
        normalized
    );


  return match
    ? match.audio
    : null;

}


// ==========================================
// WRONG ANSWER LAYOUT
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


  // Cannot skip correction
  continueBtn.style.display =
    "none";

}


// ==========================================
// CORRECT ANSWER LAYOUT
// ==========================================

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
  correctedText
) {

  better.innerHTML =
    "";


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
        length:
          m + 1
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


  const operations =
    [];


  let i =
    0;


  let j =
    0;


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
        type:
          "same",

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
        type:
          "removed",

        text:
          originalWords[i]
      });


      i++;

    }

    else {

      operations.push({
        type:
          "added",

        text:
          correctedWords[j]
      });


      j++;

    }

  }


  while (
    i < m
  ) {

    operations.push({
      type:
        "removed",

      text:
        originalWords[i]
    });


    i++;

  }


  while (
    j < n
  ) {

    operations.push({
      type:
        "added",

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
        operations.length -
          1
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
// QUESTION AUDIO
// ==========================================

function stopCurrentAudio() {

  if (
    !currentAudio
  ) {
    return;
  }


  currentAudio.pause();


  currentAudio.currentTime =
    0;


  currentAudio =
    null;

}


async function speakQuestion(
  text
) {

  const audioPath =
    getQuestionAudio(
      text
    );


  if (
    !audioPath
  ) {

    console.error(
      "Question MP3 not found:",
      text
    );


    return;

  }


  try {

    stopCurrentAudio();


    currentAudio =
      new Audio(
        audioPath
      );


    currentAudio.preload =
      "auto";


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


  if (
    !response.ok
  ) {

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
// GEMINI
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


  if (
    !response.ok
  ) {

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


  pendingAnswer =
    null;

}


// ==========================================
// RESET FEEDBACK
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


      pendingAnswer =
        null;


      isRetrying =
        false;


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


    isRetrying =
      false;


    continueBtn.textContent =
      turn >= 5
        ? "Finish →"
        : "Continue →";


    continueBtn.style.display =
      "block";


    continueBtn.disabled =
      false;


  } catch (error) {

    console.error(
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
// START RECORDING
// ==========================================

async function startRecording() {

  try {

    stopCurrentAudio();


    // Unlock both effects
    // from a real user tap
    unlockSuccessDing();

    unlockFinishSound();


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
          event.data.size >
            0
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


    statusEl.textContent =
      isRetrying
        ? "Listening… say it again."
        : "Listening… take your time.";


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
      audioBlob.size <
      500
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
      error
    );


    statusEl.textContent =
      "I couldn't process that. Please try again.";


    speakArea.style.display =
      "block";


  } finally {

    micBtn.disabled =
      false;


    audioChunks =
      [];

  }

}


// ==========================================
// MIC
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
// LISTEN QUESTION
// ==========================================

listenBtn.addEventListener(
  "click",
  async () => {

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


    if (
      pendingAnswer
    ) {

      isRetrying =
        true;


      retryView.style.display =
        "block";


      retrySentence.textContent =
        pendingAnswer.corrected;


      statusEl.textContent =
        "Tap the mic and say it again.";


      return;

    }


    isRetrying =
      false;


    retryView.style.display =
      "none";


    statusEl.textContent =
      "Answer the same question again.";

  }
);


// ==========================================
// COMPLETE SCREEN 🎉
// ==========================================

function showCompleteScreen() {

  stopCurrentAudio();


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
    "5";


  window.scrollTo({
    top:
      0,

    behavior:
      "smooth"
  });


  // 🎉 Celebration starts here
  celebrateCompletion();

}


// ==========================================
// CONTINUE
// ==========================================

continueBtn.addEventListener(
  "click",
  async () => {

    // Cannot skip correction
    if (
      pendingAnswer
    ) {
      return;
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
    // NEXT QUESTION
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

    stopCurrentAudio();


    successDing.pause();


    successDing.currentTime =
      0;


    finishSound.pause();


    finishSound.currentTime =
      0;


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


    lastSuccessText =
      "";


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
      top:
        0,

      behavior:
        "smooth"
    });

  }
);


// ==========================================
// INITIAL
// ==========================================

updateProgress();
