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
let isListening = false;
let lastCorrected = "";
let nextQuestion = "";
let closingMessage = "";

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
      turn
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Could not get AI correction");
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

    lastCorrected = result.corrected_sentence;
    nextQuestion = result.next_question || "";
    closingMessage = result.closing_message || "";

    if (result.correction_needed) {
      better.textContent = result.corrected_sentence;

      why.textContent =
        result.thai_explanation ||
        "มีจุดที่ปรับให้เป็นธรรมชาติมากขึ้นค่ะ";

      statusEl.textContent =
        "มีจุดที่ปรับให้เป็นธรรมชาติมากขึ้น ดูด้านล่างได้เลย";
    } else {
      better.textContent = "Sounds good! ✅";

      why.textContent =
        "ประโยคนี้ใช้ได้ดีแล้วค่ะ ไม่ต้องแก้อะไร";

      statusEl.textContent =
        "Nice! Your answer was clear.";
    }

    continueBtn.textContent =
      turn >= 5 ? "Finish →" : "Continue →";

    continueBtn.disabled = false;

  } catch (error) {
    console.error(error);

    better.textContent = "Could not check this sentence.";
    why.textContent =
      "ตอนนี้ AI correction มีปัญหาชั่วคราว ลองใหม่อีกครั้งได้ค่ะ";

    statusEl.textContent = "AI correction error.";
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

  if (!SpeechRecognition) return null;

  const r = new SpeechRecognition();

  r.lang = "en-US";
  r.interimResults = false;
  r.continuous = false;
  r.maxAlternatives = 1;

  r.onstart = () => {
    isListening = true;
    micBtn.classList.add("recording");
    statusEl.textContent = "Listening… speak now.";
  };

  r.onresult = (event) => {
    const transcript =
      event.results[0][0].transcript.trim();

    if (transcript) {
      showFeedback(transcript);
    } else {
      statusEl.textContent =
        "I didn’t catch that. Tap the mic and try again.";
    }
  };

  r.onerror = (event) => {
    if (event.error === "no-speech") {
      statusEl.textContent =
        "I didn’t hear anything. Tap the mic when you're ready.";
    } else if (event.error === "not-allowed") {
      statusEl.textContent =
        "Please allow microphone access in your browser.";
    } else {
      statusEl.textContent =
        "Microphone error. Please try again.";
    }
  };

  r.onend = () => {
    isListening = false;
    micBtn.classList.remove("recording");
  };

  return r;
}

recognition = createRecognition();

micBtn.addEventListener("click", () => {
  feedback.style.display = "none";

  if (!recognition) {
    statusEl.textContent =
      "This browser does not support speech recognition. Please try Chrome.";
    return;
  }

  if (isListening) {
    recognition.stop();
    return;
  }

  try {
    recognition.start();
  } catch (error) {
    console.error(error);
  }
});

listenBtn.addEventListener("click", () => {
  speak(questionEl.textContent);
});

hearCorrectionBtn.addEventListener("click", () => {
  if (lastCorrected) {
    speak(lastCorrected);
  }
});

tryAgainBtn.addEventListener("click", () => {
  feedback.style.display = "none";
  statusEl.textContent =
    "Tap the microphone and say it again.";
});

continueBtn.addEventListener("click", () => {
  if (turn >= 5) {
    questionEl.textContent =
      closingMessage ||
      "Great job today! You finished your Weekend speaking practice.";

    feedback.style.display = "none";

    micBtn.disabled = true;
    micBtn.style.opacity = "0.45";

    statusEl.textContent = "Practice complete 🎉";

    speak(questionEl.textContent);
    return;
  }

  turn += 1;

  turnEl.textContent = String(turn);

  questionEl.textContent =
    nextQuestion ||
    "Tell me a little more about your weekend.";

  feedback.style.display = "none";

  statusEl.textContent =
    "Tap the microphone to answer.";

  speak(questionEl.textContent);
});
