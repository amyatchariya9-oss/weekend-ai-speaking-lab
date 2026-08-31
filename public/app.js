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

const questions = [
  "Hey! How was your weekend?",
  "Nice! What did you do?",
  "Who did you go with?",
  "What was your favorite part?",
  "Would you do it again next weekend?"
];

let turn = 0;
let recognition = null;
let isListening = false;
let lastCorrected = "";

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.92;

  speechSynthesis.speak(utterance);
}

function localWeekendCorrection(text) {
  let corrected = text.trim();
  let explanation = "";
  let changed = false;

  const replacements = [
    {
      pattern: /\bI go\b/gi,
      replacement: "I went",
      why: "กำลังเล่าเรื่อง weekend ที่ผ่านมา จึงใช้ past tense: go → went"
    },
    {
      pattern: /\bit is good\b/gi,
      replacement: "it was good",
      why: "กำลังพูดถึง weekend ที่ผ่านมา จึงใช้ was แทน is"
    },
    {
      pattern: /\bit good\b/gi,
      replacement: "it was good",
      why: "ประโยคต้องมี verb และกำลังพูดถึงอดีต จึงใช้ “It was good.”"
    },
    {
      pattern: /\bI am go\b/gi,
      replacement: "I went",
      why: "ถ้าพูดถึงสิ่งที่ทำไปแล้ว ใช้ “I went …” ไม่ใช้ “I am go …”"
    }
  ];

  for (const rule of replacements) {
    if (rule.pattern.test(corrected)) {
      corrected = corrected.replace(rule.pattern, rule.replacement);

      if (!explanation) {
        explanation = rule.why;
      }

      changed = true;
    }
  }

  if (!changed) {
    explanation =
      "ประโยคนี้สื่อสารได้ดีแล้วค่ะ ยังไม่มีจุดสำคัญที่ต้องแก้ในรอบนี้";
  }

  return {
    corrected,
    explanation,
    changed
  };
}

function showFeedback(transcript) {
  const result = localWeekendCorrection(transcript);

  youSaid.textContent = transcript;
  better.textContent = result.corrected;
  why.textContent = result.explanation;

  lastCorrected = result.corrected;

  feedback.style.display = "block";

  statusEl.textContent = result.changed
    ? "มีจุดที่ปรับให้เป็นธรรมชาติมากขึ้น ดูด้านล่างได้เลย"
    : "Nice! Your answer was clear.";

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
    isListening = true;

    micBtn.classList.add("recording");

    statusEl.textContent =
      "Listening… speak now.";
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
  turn += 1;

  if (turn >= questions.length) {
    questionEl.textContent =
      "Great job today! You finished your Weekend speaking practice.";

    turnEl.textContent = "5";

    feedback.style.display = "none";

    micBtn.disabled = true;
    micBtn.style.opacity = "0.45";

    statusEl.textContent =
      "Practice complete 🎉";

    speak(questionEl.textContent);

    return;
  }

  turnEl.textContent =
    String(turn + 1);

  questionEl.textContent =
    questions[turn];

  feedback.style.display =
    "none";

  statusEl.textContent =
    "Tap the microphone to answer.";

  speak(questionEl.textContent);
});
