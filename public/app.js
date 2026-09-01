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
// STATIC FILE
// NO ELEVENLABS
// ==========================================

const successSound =
  new Audio(
    "/audio/weekend/effects/correct-success.mp3"
  );

successSound.preload =
  "auto";

successSound.volume =
  0.55;

let successSoundUnlocked =
  false;


// ==========================================
// UNLOCK SUCCESS SOUND
// FOR iPHONE / SAFARI
// ==========================================

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
      "Success sound not unlocked yet."
    );

  }

}


// ==========================================
// PLAY SUCCESS SOUND
// ==========================================

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
// NO ELEVENLABS
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


// ==========================================
// FIND AUDIO FOR QUESTION
// ==========================================

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
// FEEDBACK LAYOUT
// CORRECTION
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


// ==========================================
// FEEDBACK LAYOUT
// SUCCESS
// ==========================================

function showSuccessLayout() {

  // Remove Better heading
  correctionHeading.style.display =
    "none";


  // Remove WHY section
  whyDivider.style.display =
    "none";


  whyLabel.style.display =
    "none";


  why.style.display =
    "none";


  // No Try again
  tryAgainBtn.style.display =
    "none";


  // Continue full width
  continueBtn.style.display =
    "block";


  continueBtn.style.gridColumn =
    "1 / -1";

}


// ==========================================
// NORMALIZE WORD
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


// ==========================================
// CREATE WORD SPAN
// ==========================================

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


// ==========================================
// CORRECTION DIFF
//
// Example:
//
// I stay home
//
// becomes
//
// I  stay  stayed  home
//    red   blue
// ==========================================

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


  // ----------------------------------------
  // LCS TABLE
  // ----------------------------------------

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
          dp[i + 1][j + 1] + 1;


      } else {

        dp[i][j] =
          Math.max(
            dp[i + 1][j],
            dp[i][j + 1]
          );

      }

    }

  }


  // ----------------------------------------
  // BUILD OPERATIONS
  // ----------------------------------------

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


    } else {

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


  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  operations.forEach(
    (operation, index) => {

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
// STOP QUESTION AUDIO
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
// PLAY QUESTION AUDIO
//
// IMPORTANT:
//
// This plays q1-q10 directly.
//
// It does NOT touch the success sound.
// It does NOT call ElevenLabs.
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
      "Question MP3 not found:",
      text
    );


    return;

  }


  try {

    stopCurrentAudio();


    const questionAudio =
      new Audio();


    questionAudio.src =
      audioPath;


    questionAudio.preload =
      "auto";


    currentAudio =
      questionAudio;


    currentAudio.onended =
      () => {

        currentAudio =
          null;

      };


    currentAudio.onerror =
      (event) => {

        console.error(
          "Could not play question audio:",
          audioPath,
          event
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


  showCorrectionLayout();


  continueBtn.disabled =
    false;


  continueBtn.style.display =
    "block";

}


// ==========================================
// SHOW FEEDBACK
// ==========================================

async function showFeedback(
  transcript
) {

  // Hide microphone while
  // learner reviews feedback
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


  continueBtn.disabled =
    true;


  try {

    const result =
      await getAICorrection(
        transcript
      );


    nextQuestion =
      result.next_question ||
      "";


    // ======================================
    // ANSWER NOT RELEVANT
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


      continueBtn.style.display =
        "none";


      tryAgainBtn.style.display =
        "block";


      tryAgainBtn.textContent =
        "🎙 Answer again";


      return;

    }


    // ======================================
    // NEEDS CORRECTION
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


      tryAgainBtn.style.display =
        "block";


      tryAgainBtn.textContent =
        "🎙 Try again";


      continueBtn.style.display =
        "block";


      continueBtn.style.gridColumn =
        "auto";


      continueBtn.textContent =
        turn >= 5
          ? "Finish →"
          : "Continue →";


      continueBtn.disabled =
        false;


      return;

    }


    // ======================================
    // CORRECT ANSWER ✅
    // ======================================

    showSuccessLayout();


    better.textContent =
      "Well done! ✅";


    // FREE SUCCESS SOUND
    playSuccessSound();


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


    continueBtn.disabled =
      false;


  } catch (error) {

    console.error(
      error
    );


    showCorrectionLayout();


    better.textContent =
      "Let's try again.";


    why.textContent =
      "ระบบตรวจคำตอบมีปัญหาชั่วคราว ลองพูดอีกครั้งค่ะ";


    continueBtn.disabled =
      true;

  }

}


// ==========================================
// START RECORDING
// ==========================================

async function startRecording() {

  try {

    // Only unlock the success sound
    // when learner touches the mic.
    //
    // Do NOT do this on Listen question.

    unlockSuccessSound();


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
// MIC BUTTON
// ==========================================

micBtn.addEventListener(
  "click",
  () => {

    if (
      isRecording
    ) {

      stopRecording();


    } else {

      startRecording();

    }

  }
);


// ==========================================
// LISTEN TO QUESTION
//
// IMPORTANT:
//
// NO unlockSuccessSound here.
// This button ONLY plays q1-q10.
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


    } catch (error) {

      console.error(
        "Listen error:",
        error
      );


    } finally {

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

    // Bring microphone back
    speakArea.style.display =
      "block";


    // ======================================
    // CORRECTED SENTENCE RETRY
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
    // ANSWER SAME QUESTION AGAIN
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

}


// ==========================================
// CONTINUE
// ==========================================

continueBtn.addEventListener(
  "click",
  async () => {

    // --------------------------------------
    // Student had correction
    // but skipped retry
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


    // Bring mic back
    speakArea.style.display =
      "block";


    statusEl.textContent =
      "Tap the mic to answer";


    // Automatically play
    // the next saved MP3
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
