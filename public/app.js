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
      body: JSON.stringify({
        text
      })
    });

    if (!response.ok) {
      console.error("TTS failed");
      statusEl.textContent =
        "Could not play the tutor voice.";
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
// SHOW FEEDBACK
// ==========================================

async function showFeedback(transcript) {
  youSaid.textContent =
    transcript;

  better.textContent =
    "Checking…";

  why.textContent =
    "AI is reviewing your answer…";

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
    // ANSWER DOES NOT MATCH THE QUESTION
    // ======================================

    if (result.answer_relevant === false) {

      better.textContent =
        "Try answering the question again 💬";

      let explanation =
        result.relevance_explanation ||
        "คำตอบนี้ยังไม่ตรงกับคำถามค่ะ";

      if (result.example_answer) {
        explanation +=
          `\n\nตัวอย่างคำตอบ: ${result.example_answer}`;
      }

      why.textContent =
        explanation;

      why.style.whiteSpace =
        "pre-line";

      statusEl.textContent =
        "Your English may be correct, but the answer doesn't match the question.";

      // Do NOT add this answer to conversation history
      // Do NOT move to the next turn

      continueBtn.style.display =
        "none";

      tryAgainBtn.textContent =
        "🎙️ Answer again";

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
        "มีจุดที่ปรับให้เป็นธรรมชาติมากขึ้นค่ะ";

      why.style.whiteSpace =
        "normal";

      statusEl.textContent =
        "Good answer! Here's a small correction.";

    }

    // ======================================
    // RELEVANT + CORRECT
    // ======================================

    else {

      better.textContent =
        "Sounds good! ✅";

      why.textContent =
        "ประโยคนี้ใช้ได้ดีแล้วค่ะ ไม่ต้องแก้อะไร";

      why.style.whiteSpace =
        "normal";

      statusEl.textContent =
        "Nice! Your answer was clear.";
    }


    // Only save answers that actually
    // responded to the question

    history.push({
      question:
        currentQuestion,

      answer:
        transcript,

      corrected_answer:
        result.corrected_sentence ||
        transcript
    });


    tryAgainBtn.textContent =
      "🎙️ Try again";

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
      "Could not check this answer.";

    why.textContent =
      "ลองพูดใหม่อีกครั้งค่ะ";

    statusEl.textContent =
      "AI correction error.";

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
      "Recording… take your time. Tap again when you're done.";

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
    "Got it! Transcribing your answer…";

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
        "I couldn't hear your answer. Please try again.";

      micBtn.disabled =
        false;

      return;
    }


    statusEl.textContent =
      "Transcript ready. Checking your answer…";


    await showFeedback(
      transcript.trim()
    );


  } catch (error) {

    console.error(error);

    statusEl.textContent =
      "I couldn't process the recording. Please try again.";

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
// LISTEN TO QUESTION
// ==========================================

listenBtn.addEventListener(
  "click",
  async () => {

    listenBtn.disabled =
      true;

    const originalText =
      listenBtn.textContent;

    listenBtn.textContent =
      "Loading voice…";


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
// LISTEN TO CORRECTION
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

    feedback.style.display =
      "none";

    statusEl.textContent =
      "Answer the same question again when you're ready.";

  }
);


// ==========================================
// CONTINUE
// ==========================================

continueBtn.addEventListener(
  "click",
  async () => {


    if (turn >= 5) {

      currentQuestion =
        closingMessage ||
        "Great job today! You finished your Weekend speaking practice.";


      questionEl.textContent =
        currentQuestion;


      feedback.style.display =
        "none";


      micBtn.disabled =
        true;


      micBtn.style.opacity =
        "0.45";


      statusEl.textContent =
        "Practice complete 🎉";


      await speak(
        currentQuestion
      );


      return;
    }


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
      "Tap the microphone when you're ready.";


    await speak(
      currentQuestion
    );

  }
);
