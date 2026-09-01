const $ = (id) => document.getElementById(id);

const micBtn = $("mic");
const statusEl = $("status");
const feedback = $("feedback");
const youSaid = $("youSaid");
const better = $("better");
const why = $("why");
const questionEl = $("question");
const turnEl = $("turn");
const listenBtn = $("listen");
const hearCorrectionBtn = $("hearCorrection");
const tryAgainBtn = $("tryAgain");
const continueBtn = $("continueBtn");

const lessonCard = $("lessonCard");
const completeScreen = $("completeScreen");
const practiceAgainBtn = $("practiceAgain");
const completedQuestions = $("completedQuestions");

let turn = 1;

let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let isRecording = false;

let lastCorrected = "";
let nextQuestion = "";
let closingMessage = "";

let currentQuestion = "Hey! How was your weekend?";
let history = [];

let currentAudio = null;

let isRetrying = false;
let pendingAnswer = null;


// ==========================================
// ELEVENLABS TTS
// ==========================================

async function speak(text) {
  try {
    if (!text) return;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const response = await fetch("/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      console.error("TTS failed");

      statusEl.textContent =
        "Voice is unavailable right now.";

      return;
    }

    const audioBlob =
      await response.blob();

    const audioUrl =
      URL.createObjectURL(audioBlob);

    currentAudio =
      new Audio(audioUrl);

    currentAudio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };

    currentAudio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };

    await currentAudio.play();

  } catch (error) {
    console.error("Speak error:", error);
  }
}


// ==========================================
// SPEECH TO TEXT
// ==========================================

async function transcribeAudio(audioBlob) {
  const response =
    await fetch("/transcribe", {
      method: "POST",

      headers: {
        "Content-Type":
          audioBlob.type ||
          "application/octet-stream"
      },

      body: audioBlob
    });

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
      "Could not transcribe audio"
    );
  }

  return data.transcript || "";
}


// ==========================================
// GEMINI
// ==========================================

async function getAICorrection(transcript) {
  const response =
    await fetch("/correct", {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        transcript,
        turn,
        current_question:
          currentQuestion,
        history
      })
    });

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
      "Could not get AI correction"
    );
  }

  return data;
}


// ==========================================
// SAVE TURN ONCE
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
      correctedAnswer || answer
  });

  pendingAnswer = null;
}


// ==========================================
// SHOW FEEDBACK
// ==========================================

async function showFeedback(transcript) {

  youSaid.textContent =
    transcript;

  better.textContent =
    "Checking…";

  why.textContent =
    "Looking at your answer…";

  feedback.style.display =
    "block";

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

    lastCorrected =
      result.corrected_sentence ||
      transcript;

    nextQuestion =
      result.next_question || "";

    closingMessage =
      result.closing_message || "";


    // ======================================
    // ANSWER NOT RELEVANT
    // ======================================

    if (
      result.answer_relevant === false
    ) {

      better.textContent =
        "Let's try that question again 💬";

      let explanation =
        result.relevance_explanation ||
        "คำตอบนี้ยังไม่ตรงกับคำถามค่ะ";

      if (result.example_answer) {
        explanation +=
          `\n\nลองตอบแบบนี้ได้ เช่น: ${result.example_answer}`;
      }

      why.textContent =
        explanation;

      why.style.whiteSpace =
        "pre-line";

      statusEl.textContent =
        "Almost! Try answering this question.";

      continueBtn.style.display =
        "none";

      tryAgainBtn.textContent =
        "🎙️ Answer again";

      tryAgainBtn.style.fontWeight =
        "700";

      pendingAnswer = null;
      isRetrying = false;

      feedback.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });

      return;
    }


    // ======================================
    // RELEVANT + NEEDS CORRECTION
    // ======================================

    if (result.correction_needed) {

      better.textContent =
        result.corrected_sentence;

      why.textContent =
        result.thai_explanation ||
        "ปรับนิดเดียวให้ฟังเป็นธรรมชาติมากขึ้นค่ะ";

      why.style.whiteSpace =
        "normal";

      statusEl.textContent =
        "Good answer! Try the corrected version ✨";

      pendingAnswer = {
        original:
          transcript,

        corrected:
          result.corrected_sentence ||
          transcript
      };

      tryAgainBtn.textContent =
        "🎙️ Try again";

      tryAgainBtn.style.fontWeight =
        "700";

      continueBtn.style.display =
        "block";

      continueBtn.textContent =
        turn >= 5
          ? "Finish →"
          : "Continue →";

      continueBtn.disabled =
        false;

      feedback.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });

      return;
    }


    // ======================================
    // RELEVANT + CORRECT
    // ======================================

    better.textContent =
      "Sounds good! ✅";

    why.textContent =
      isRetrying
        ? "ดีมากค่ะ รอบนี้ประโยคฟังเป็นธรรมชาติแล้ว"
        : "ประโยคนี้เป็นธรรมชาติและตอบคำถามได้ดีค่ะ";

    why.style.whiteSpace =
      "normal";

    statusEl.textContent =
      isRetrying
        ? "Nice! That sounds better."
        : "Nice! Your answer works well.";


    if (isRetrying) {

      saveCurrentTurn(
        transcript,
        transcript
      );

      isRetrying = false;

    } else {

      saveCurrentTurn(
        transcript,
        result.corrected_sentence ||
        transcript
      );
    }


    tryAgainBtn.textContent =
      "🎙️ Try again";

    tryAgainBtn.style.fontWeight =
      "400";

    continueBtn.style.display =
      "block";

    continueBtn.textContent =
      turn >= 5
        ? "Finish →"
        : "Continue →";

    continueBtn.disabled =
      false;

  } catch (error) {

    console.error(error);

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
    behavior: "smooth",
    block: "nearest"
  });
}


// ==========================================
// START RECORDING
// ==========================================

async function startRecording() {
  try {

    feedback.style.display =
      "none";

    audioChunks = [];

    mediaStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: true
        });

    let options = {};

    if (
      MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus"
      )
    ) {

      options = {
        mimeType:
          "audio/webm;codecs=opus"
      };

    } else if (
      MediaRecorder.isTypeSupported(
        "audio/webm"
      )
    ) {

      options = {
        mimeType:
          "audio/webm"
      };

    } else if (
      MediaRecorder.isTypeSupported(
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
      "⏹️";

    statusEl.textContent =
      isRetrying
        ? "Try the sentence again. Take your time."
        : "Listening… take your time.";

  } catch (error) {

    console.error(error);

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
    "🎙️";

  micBtn.disabled =
    true;

  statusEl.textContent =
    "Got it! Checking your answer…";

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
// AFTER RECORDING
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
        "Recording was too short"
      );
    }


    const transcript =
      await transcribeAudio(
        audioBlob
      );


    if (!transcript.trim()) {

      statusEl.textContent =
        "I couldn't hear that. Try again.";

      micBtn.disabled =
        false;

      return;
    }


    statusEl.textContent =
      "Checking your answer…";


    await showFeedback(
      transcript.trim()
    );


  } catch (error) {

    console.error(error);

    statusEl.textContent =
      "I couldn't process that. Please try again.";

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
    } else {
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

    const originalText =
      listenBtn.textContent;

    listenBtn.textContent =
      "Loading…";


    await speak(
      currentQuestion
    );


    listenBtn.textContent =
      originalText;

    listenBtn.disabled =
      false;

  }
);


// ==========================================
// LISTEN CORRECTION
// ==========================================

hearCorrectionBtn.addEventListener(
  "click",
  async () => {

    if (!lastCorrected) {
      return;
    }

    hearCorrectionBtn.disabled =
      true;

    const originalText =
      hearCorrectionBtn.textContent;

    hearCorrectionBtn.textContent =
      "Loading…";


    await speak(
      lastCorrected
    );


    hearCorrectionBtn.textContent =
      originalText;

    hearCorrectionBtn.disabled =
      false;

  }
);


// ==========================================
// TRY AGAIN
// ==========================================

tryAgainBtn.addEventListener(
  "click",
  () => {

    if (pendingAnswer) {

      isRetrying =
        true;

      feedback.style.display =
        "none";

      statusEl.textContent =
        "Now say the corrected sentence in your own voice.";

      return;
    }


    isRetrying =
      false;

    feedback.style.display =
      "none";

    statusEl.textContent =
      "Answer the same question again when you're ready.";

  }
);


// ==========================================
// SHOW COMPLETE SCREEN
// ==========================================

async function showCompleteScreen() {

  lessonCard.style.display =
    "none";

  completeScreen.style.display =
    "block";

  completedQuestions.textContent =
    "5";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  if (closingMessage) {
    await speak(
      closingMessage
    );
  }
}


// ==========================================
// CONTINUE / FINISH
// ==========================================

continueBtn.addEventListener(
  "click",
  async () => {

    // Save corrected answer if learner
    // chooses Continue without retrying.
    if (pendingAnswer) {

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

    if (turn >= 5) {

      await showCompleteScreen();

      return;
    }


    // ======================================
    // NEXT TURN
    // ======================================

    turn += 1;

    turnEl.textContent =
      String(turn);

    currentQuestion =
      nextQuestion ||
      "Tell me a little more about your weekend.";

    questionEl.textContent =
      currentQuestion;

    feedback.style.display =
      "none";

    statusEl.textContent =
      "Your turn when you're ready.";

    lastCorrected =
      "";

    pendingAnswer =
      null;

    isRetrying =
      false;


    await speak(
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

    // Stop any playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }


    // Reset lesson state
    turn = 1;

    currentQuestion =
      "Hey! How was your weekend?";

    history = [];

    nextQuestion =
      "";

    closingMessage =
      "";

    lastCorrected =
      "";

    pendingAnswer =
      null;

    isRetrying =
      false;


    // Reset UI
    turnEl.textContent =
      "1";

    questionEl.textContent =
      currentQuestion;

    feedback.style.display =
      "none";

    completeScreen.style.display =
      "none";

    lessonCard.style.display =
      "block";

    micBtn.disabled =
      false;

    micBtn.style.opacity =
      "1";

    micBtn.textContent =
      "🎙️";

    micBtn.classList.remove(
      "recording"
    );

    tryAgainBtn.textContent =
      "🎙️ Try again";

    tryAgainBtn.style.fontWeight =
      "400";

    continueBtn.textContent =
      "Continue →";

    continueBtn.style.display =
      "block";

    continueBtn.disabled =
      false;

    statusEl.textContent =
      "Tap the microphone to answer.";

    youSaid.textContent =
      "—";

    better.textContent =
      "—";

    why.textContent =
      "—";


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }
);
