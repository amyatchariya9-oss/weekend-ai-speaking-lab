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

let recognition = null;
let isRecording = false;
let accumulatedTranscript = "";

let lastCorrected = "";
let nextQuestion = "";
let closingMessage = "";

let currentQuestion = "Hey! How was your weekend?";
let history = [];

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.92;

  speechSynthesis.speak(utterance);
}

async function getAICorrection(transcript) {
  const response = await fetch("/correct", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      transcript,
      turn,
      current_question: currentQuestion,
      history
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error || "Could not get AI correction"
    );
  }

  return data;
}

async function showFeedback(transcript) {
  youSaid.textContent = transcript;
  better.textContent = "Checking…";
  why.textContent = "AI is reviewing your sentence…";

  feedback.style.display = "block";
  statusEl.textContent = "Checking your English…";

  continueBtn.disabled = true;
  continueBtn.textContent = "Checking…";

  try {
    const result = await getAICorrection(transcript);

    lastCorrected =
      result.corrected_sentence || transcript;

    nextQuestion =
      result.next_question || "";

    closingMessage =
      result.closing_message || "";

    if (result.correction_needed) {
      better.textContent =
        result.corrected_sentence;

      why.textContent =
        result.thai_explanation ||
        "มีจุดที่ปรับให้เป็นธรรมชาติมากขึ้นค่ะ";

      statusEl.textContent =
        "มีจุดที่ปรับให้เป็นธรรมชาติมากขึ้น ดูด้านล่างได้เลย";
    } else {
      better.textContent =
        "Sounds good! ✅";

      why.textContent =
        "ประโยคนี้ใช้ได้ดีแล้วค่ะ ไม่ต้องแก้อะไร";

      statusEl.textContent =
        "Nice! Your answer was clear.";
    }

    history.push({
      question: currentQuestion,
      answer: transcript,
      corrected_answer:
        result.corrected_sentence || transcript
    });

    continueBtn.textContent =
      turn >= 5 ? "Finish →" : "Continue →";

    continueBtn.disabled = false;

  } catch (error) {
    console.error(error);

    better.textContent =
      "Could not check this sentence.";

    why.textContent =
      "ตอนนี้ AI correction มีปัญหาชั่วคราว ลองใหม่อีกครั้งได้ค่ะ";

    statusEl.textContent =
      "AI correction error.";

    continueBtn.disabled = true;
  }

  feedback.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

function createRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  const r = new SpeechRecognition();

  r.lang = "en-US";
  r.interimResults = false;
  r.continuous = false;
  r.maxAlternatives = 1;

  r.onstart = () => {
    if (isRecording) {
      statusEl.textContent =
        "Listening… take your time. Tap Done when you finish.";
    }
  };

  r.onresult = (event) => {
    const transcript =
      event.results[0][0].transcript.trim();

    if (transcript) {
      accumulatedTranscript +=
        (accumulatedTranscript ? " " : "") + transcript;

      statusEl.textContent =
        `I heard: "${accumulatedTranscript}" — keep speaking or tap Done.`;
    }
  };

  r.onerror = (event) => {
    if (
      event.error !== "no-speech" &&
      event.error !== "aborted"
    ) {
      console.error(
        "Speech recognition error:",
        event.error
      );
    }

    if (event.error === "not-allowed") {
      isRecording = false;

      micBtn.classList.remove("recording");
      micBtn.textContent = "🎙️";

      statusEl.textContent =
        "Please allow microphone access in your browser.";
    }
  };

  r.onend = () => {
    /*
      Chrome may automatically stop recognition
      when the learner pauses.

      If the learner has NOT pressed Done,
      automatically start listening again.
    */

    if (isRecording) {
      setTimeout(() => {
        try {
          recognition.start();
        } catch (error) {
          console.log(
            "Waiting to restart microphone…"
          );
        }
      }, 250);
    }
  };

  return r;
}

recognition = createRecognition();

function startRecording() {
  if (!recognition) {
    statusEl.textContent =
      "This browser does not support speech recognition. Please use Chrome.";
    return;
  }

  accumulatedTranscript = "";
  isRecording = true;

  feedback.style.display = "none";

  micBtn.classList.add("recording");
  micBtn.textContent = "⏹️";

  statusEl.textContent =
    "Listening… take your time. Tap Done when you finish.";

  try {
    recognition.start();
  } catch (error) {
    console.error(error);
  }
}

function finishRecording() {
  isRecording = false;

  micBtn.classList.remove("recording");
  micBtn.textContent = "🎙️";

  try {
    recognition.stop();
  } catch (error) {
    console.log("Recognition already stopped.");
  }

  const finalTranscript =
    accumulatedTranscript.trim();

  if (!finalTranscript) {
    statusEl.textContent =
      "I didn’t hear anything. Tap the microphone and try again.";
    return;
  }

  statusEl.textContent =
    "Got it! Checking your English…";

  showFeedback(finalTranscript);
}

micBtn.addEventListener("click", () => {
  if (isRecording) {
    finishRecording();
  } else {
    startRecording();
  }
});

listenBtn.addEventListener("click", () => {
  speak(currentQuestion);
});

hearCorrectionBtn.addEventListener("click", () => {
  if (lastCorrected) {
    speak(lastCorrected);
  }
});

tryAgainBtn.addEventListener("click", () => {
  feedback.style.display = "none";

  accumulatedTranscript = "";

  statusEl.textContent =
    "Tap the microphone when you're ready to try again.";
});

continueBtn.addEventListener("click", () => {
  accumulatedTranscript = "";

  if (turn >= 5) {
    currentQuestion =
      closingMessage ||
      "Great job today! You finished your Weekend speaking practice.";

    questionEl.textContent =
      currentQuestion;

    feedback.style.display =
      "none";

    micBtn.disabled = true;
    micBtn.style.opacity = "0.45";

    statusEl.textContent =
      "Practice complete 🎉";

    speak(currentQuestion);

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

  speak(currentQuestion);
});
