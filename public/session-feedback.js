// public/session-feedback.js
// Friendly Session Feedback for AI Speaking Lab
// Uses data from existing /correct calls.
// No extra Gemini request = no extra AI cost.

(() => {
  const originalFetch =
    window.fetch.bind(window);

  const acceptedAnswers =
    new Map();

  const corrections =
    new Map();

  let feedbackRendered =
    false;

  // ==========================================
  // HELPERS
  // ==========================================

  function cleanText(
    value = ""
  ) {
    return String(
      value || ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function parseRequestBody(
    options = {}
  ) {
    try {
      if (
        typeof options.body !==
        "string"
      ) {
        return {};
      }

      return JSON.parse(
        options.body
      );
    }

    catch {
      return {};
    }
  }

  function isCorrectEndpoint(
    input
  ) {
    const url =
      typeof input === "string"
        ? input
        : input?.url || "";

    return url.includes(
      "/correct"
    );
  }

  // ==========================================
  // SAVE EACH TURN
  // ==========================================

  function saveTurnFeedback(
    requestData,
    responseData
  ) {
    if (
      !requestData ||
      !responseData
    ) {
      return;
    }

    const turn =
      Number(
        requestData.turn
      ) || 0;

    if (!turn) {
      return;
    }

    const transcript =
      cleanText(
        requestData.transcript
      );

    const corrected =
      cleanText(
        responseData
          .corrected_sentence ||
        transcript
      );

    const thaiExplanation =
      cleanText(
        responseData
          .thai_explanation
      );

    // Help requests and unrelated answers
    // are not counted as completed turns.
    if (
      responseData
        .help_requested ||
      responseData
        .answer_relevant !== true
    ) {
      return;
    }

    // Save meaningful correction.
    if (
      responseData
        .correction_needed === true
    ) {
      corrections.set(
        turn,
        {
          original:
            transcript,

          corrected:
            corrected,

          explanation:
            thaiExplanation
        }
      );

      return;
    }

    // Relevant answer that passed.
    acceptedAnswers.set(
      turn,
      {
        question:
          cleanText(
            requestData
              .current_question
          ),

        answer:
          corrected ||
          transcript
      }
    );
  }

  // ==========================================
  // WATCH EXISTING /correct CALLS
  // ==========================================

  window.fetch =
    async (...args) => {

      const [
        input,
        options = {}
      ] = args;

      const response =
        await originalFetch(
          ...args
        );

      if (
        isCorrectEndpoint(
          input
        ) &&
        response.ok
      ) {
        const requestData =
          parseRequestBody(
            options
          );

        response
          .clone()
          .json()
          .then(
            (
              responseData
            ) => {
              saveTurnFeedback(
                requestData,
                responseData
              );
            }
          )
          .catch(
            () => {}
          );
      }

      return response;
    };

  // ==========================================
  // STYLES
  // ==========================================

  function injectStyles() {
    if (
      document.getElementById(
        "sessionFeedbackStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "sessionFeedbackStyles";

    style.textContent = `
      .session-feedback-card {
        margin-top: 18px;
        padding: 18px;
        border: 1px solid rgba(109, 105, 170, 0.16);
        border-radius: 20px;
        background: #faf9ff;
        text-align: left;
      }

      .session-feedback-eyebrow {
        margin-bottom: 14px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #7773aa;
      }

      .session-feedback-section
      + .session-feedback-section {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid rgba(72, 72, 98, 0.09);
      }

      .session-feedback-title {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-bottom: 7px;
        font-size: 14px;
        font-weight: 800;
        color: #292b40;
      }

      .session-feedback-text {
        font-size: 14px;
        line-height: 1.65;
        color: #595c72;
      }

      .session-feedback-phrases {
        display: grid;
        gap: 8px;
        margin-top: 8px;
      }

      .session-feedback-phrase {
        padding: 10px 12px;
        border-radius: 13px;
        background: #ffffff;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.45;
        color: #303249;
      }

      .session-feedback-correction {
        display: grid;
        gap: 10px;
        margin-top: 12px;
        padding: 13px;
        border-radius: 15px;
        background: #ffffff;
      }

      .session-feedback-mini-label {
        margin-bottom: 4px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.07em;
        color: #9294a8;
      }

      .session-feedback-old {
        font-size: 14px;
        line-height: 1.5;
        color: #696c80;
      }

      .session-feedback-new {
        padding: 9px 10px;
        border-radius: 11px;
        background: #f1f8f3;
        font-size: 14px;
        line-height: 1.5;
        color: #3f6858;
        font-weight: 800;
      }

      .session-feedback-ending {
        margin-top: 18px;
        padding-top: 15px;
        border-top: 1px solid rgba(72, 72, 98, 0.09);
        text-align: center;
        font-size: 14px;
        font-weight: 800;
        color: #706da6;
      }

      @media (max-width: 520px) {
        .session-feedback-card {
          padding: 16px;
          border-radius: 18px;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  // ==========================================
  // SESSION DATA
  // ==========================================

  function getAcceptedList() {
    return [
      ...acceptedAnswers
        .entries()
    ]
      .sort(
        (
          [turnA],
          [turnB]
        ) =>
          turnA - turnB
      )
      .map(
        ([, item]) =>
          item
      );
  }

  function getCorrectionList() {
    return [
      ...corrections
        .entries()
    ]
      .sort(
        (
          [turnA],
          [turnB]
        ) =>
          turnA - turnB
      )
      .map(
        ([, item]) =>
          item
      );
  }

  // ==========================================
  // NICE PHRASES
  // ==========================================

  function chooseNicePhrases() {
    const answers =
      getAcceptedList()
        .map(
          (item) =>
            item.answer
        )
        .filter(
          Boolean
        );

    const useful =
      answers.filter(
        (answer) => {
          const words =
            answer
              .split(
                /\s+/
              )
              .length;

          return words >= 3;
        }
      );

    const pool =
      useful.length > 0
        ? useful
        : answers;

    return pool.slice(
      0,
      2
    );
  }

  // ==========================================
  // FRIENDLY STRENGTH MESSAGE
  // ==========================================

  function getStrengthText() {
    const completed =
      acceptedAnswers.size;

    const correctionCount =
      corrections.size;

    if (
      completed >= 5 &&
      correctionCount === 0
    ) {
      return (
        "เก่งมาก! คุณตอบครบทั้ง 5 ข้อและสื่อสารได้ชัดเจนตลอด session 💛 " +
        "วันนี้ไม่มีจุดสำคัญที่ต้องแก้เลย"
      );
    }

    if (
      completed >= 5 &&
      correctionCount > 0
    ) {
      return (
        "เก่งมาก! คุณตอบครบทั้ง 5 ข้อและสื่อสารความหมายได้ชัดเจน 🌷 " +
        "มีบางจุดที่ลองปรับนิดหน่อย แล้วคุณก็พูดใหม่จนผ่านได้ดีมาก"
      );
    }

    if (
      completed > 0
    ) {
      return (
        `ทำได้ดีมาก! คุณสื่อสารคำตอบได้สำเร็จ ${completed} ช่วง 💛 ` +
        "และพยายามใช้ประโยคของตัวเองในการตอบ"
      );
    }

    return (
      "ทำได้ดีมากที่ฝึกพูดจนจบ session นี้ 💛"
    );
  }

  // ==========================================
  // ONE THING TO TRY NEXT
  // ==========================================

  function getImprovementData() {
    const list =
      getCorrectionList();

    if (
      list.length > 0
    ) {
      return {
        type:
          "correction",

        ...list[
          list.length - 1
        ]
      };
    }

    return {
      type:
        "tip",

      explanation:
        "วันนี้ไม่มีจุดสำคัญที่ต้องแก้เลยค่ะ 💛 " +
        "ครั้งหน้าลองเพิ่มรายละเอียดอีก 1 ประโยค " +
        "เพื่อให้คำตอบฟังเป็นธรรมชาติและต่อเนื่องขึ้นอีกนิด"
    };
  }

  // ==========================================
  // SECTION CREATOR
  // ==========================================

  function makeSection(
    icon,
    title,
    contentNode
  ) {
    const section =
      document.createElement(
        "div"
      );

    section.className =
      "session-feedback-section";

    const heading =
      document.createElement(
        "div"
      );

    heading.className =
      "session-feedback-title";

    heading.textContent =
      `${icon} ${title}`;

    section.appendChild(
      heading
    );

    section.appendChild(
      contentNode
    );

    return section;
  }

  // ==========================================
  // RENDER
  // ==========================================

  function renderSessionFeedback() {
    if (
      feedbackRendered
    ) {
      return;
    }

    const completeScreen =
      document.getElementById(
        "completeScreen"
      );

    if (
      !completeScreen
    ) {
      return;
    }

    const existing =
      document.getElementById(
        "sessionFeedbackCard"
      );

    if (
      existing
    ) {
      existing.remove();
    }

    const card =
      document.createElement(
        "div"
      );

    card.id =
      "sessionFeedbackCard";

    card.className =
      "session-feedback-card";

    // ======================================
    // HEADER
    // ======================================

    const eyebrow =
      document.createElement(
        "div"
      );

    eyebrow.className =
      "session-feedback-eyebrow";

    eyebrow.textContent =
      "SESSION FEEDBACK";

    card.appendChild(
      eyebrow
    );

    // ======================================
    // WHAT YOU DID WELL
    // ======================================

    const strengthText =
      document.createElement(
        "div"
      );

    strengthText.className =
      "session-feedback-text";

    strengthText.textContent =
      getStrengthText();

    card.appendChild(
      makeSection(
        "💛",
        "What you did well",
        strengthText
      )
    );

    // ======================================
    // NICE PHRASES
    // ======================================

    const phrasesWrap =
      document.createElement(
        "div"
      );

    phrasesWrap.className =
      "session-feedback-phrases";

    const phrases =
      chooseNicePhrases();

    if (
      phrases.length > 0
    ) {
      phrases.forEach(
        (phrase) => {

          const item =
            document.createElement(
              "div"
            );

          item.className =
            "session-feedback-phrase";

          item.textContent =
            `“${phrase}”`;

          phrasesWrap.appendChild(
            item
          );
        }
      );
    }

    else {
      const fallback =
        document.createElement(
          "div"
        );

      fallback.className =
        "session-feedback-text";

      fallback.textContent =
        "ทุกครั้งที่ลองพูด คุณกำลังสร้างความมั่นใจเพิ่มขึ้นค่ะ 💜";

      phrasesWrap.appendChild(
        fallback
      );
    }

    card.appendChild(
      makeSection(
        "💬",
        "Nice phrases you used",
        phrasesWrap
      )
    );

    // ======================================
    // ONE THING TO TRY NEXT
    // ======================================

    const improvement =
      getImprovementData();

    const improvementWrap =
      document.createElement(
        "div"
      );

    const explanation =
      document.createElement(
        "div"
      );

    explanation.className =
      "session-feedback-text";

    if (
      improvement.type ===
        "correction"
    ) {
      const originalExplanation =
        improvement.explanation ||
        "";

      explanation.textContent =
        originalExplanation
          ? (
              "ประโยคเดิมเข้าใจได้แล้วนะ 💛 " +
              "ถ้าอยากให้ฟังเป็นธรรมชาติขึ้นอีกนิด ลองแบบนี้ค่ะ " +
              originalExplanation
            )
          : (
              "ประโยคเดิมเข้าใจได้แล้วนะ 💛 " +
              "ถ้าอยากให้ฟังเป็นธรรมชาติขึ้นอีกนิด ลองแบบนี้ค่ะ"
            );
    }

    else {
      explanation.textContent =
        improvement.explanation;
    }

    improvementWrap.appendChild(
      explanation
    );

    // ======================================
    // FRIENDLY CORRECTION BOX
    // ======================================

    if (
      improvement.type ===
        "correction" &&
      improvement.original &&
      improvement.corrected &&
      improvement.original !==
        improvement.corrected
    ) {
      const correctionBox =
        document.createElement(
          "div"
        );

      correctionBox.className =
        "session-feedback-correction";

      // YOU SAID

      const oldWrap =
        document.createElement(
          "div"
        );

      const oldLabel =
        document.createElement(
          "div"
        );

      oldLabel.className =
        "session-feedback-mini-label";

      oldLabel.textContent =
        "YOU SAID";

      const oldSentence =
        document.createElement(
          "div"
        );

      oldSentence.className =
        "session-feedback-old";

      oldSentence.textContent =
        improvement.original;

      oldWrap.appendChild(
        oldLabel
      );

      oldWrap.appendChild(
        oldSentence
      );

      // TRY THIS

      const newWrap =
        document.createElement(
          "div"
        );

      const newLabel =
        document.createElement(
          "div"
        );

      newLabel.className =
        "session-feedback-mini-label";

      newLabel.textContent =
        "TRY THIS ✨";

      const newSentence =
        document.createElement(
          "div"
        );

      newSentence.className =
        "session-feedback-new";

      newSentence.textContent =
        improvement.corrected;

      newWrap.appendChild(
        newLabel
      );

      newWrap.appendChild(
        newSentence
      );

      correctionBox.appendChild(
        oldWrap
      );

      correctionBox.appendChild(
        newWrap
      );

      improvementWrap.appendChild(
        correctionBox
      );
    }

    card.appendChild(
      makeSection(
        "🌱",
        "One thing to try next",
        improvementWrap
      )
    );

    // ======================================
    // ENDING MESSAGE
    // ======================================

    const ending =
      document.createElement(
        "div"
      );

    ending.className =
      "session-feedback-ending";

    ending.textContent =
      "You’re doing great — keep speaking! 💜";

    card.appendChild(
      ending
    );

    // ======================================
    // INSERT BEFORE PRACTICE AGAIN
    // ======================================

    const practiceAgain =
      document.getElementById(
        "practiceAgain"
      );

    if (
      practiceAgain &&
      practiceAgain.parentNode ===
        completeScreen
    ) {
      completeScreen.insertBefore(
        card,
        practiceAgain
      );
    }

    else {
      completeScreen.appendChild(
        card
      );
    }

    feedbackRendered =
      true;
  }

  // ==========================================
  // COMPLETION CHECK
  // ==========================================

  function isVisible(
    element
  ) {
    if (
      !element
    ) {
      return false;
    }

    const style =
      window.getComputedStyle(
        element
      );

    return (
      style.display !==
        "none" &&
      style.visibility !==
        "hidden"
    );
  }

  function checkCompletion() {
    const completeScreen =
      document.getElementById(
        "completeScreen"
      );

    if (
      completeScreen &&
      isVisible(
        completeScreen
      )
    ) {
      renderSessionFeedback();
    }
  }

  // ==========================================
  // RESET
  // ==========================================

  function resetSessionFeedback() {
    acceptedAnswers.clear();

    corrections.clear();

    feedbackRendered =
      false;

    document
      .getElementById(
        "sessionFeedbackCard"
      )
      ?.remove();
  }

  // ==========================================
  // INIT
  // ==========================================

  function init() {
    injectStyles();

    const completeScreen =
      document.getElementById(
        "completeScreen"
      );

    if (
      completeScreen
    ) {
      const observer =
        new MutationObserver(
          checkCompletion
        );

      observer.observe(
        completeScreen,
        {
          attributes:
            true,

          attributeFilter: [
            "style",
            "class",
            "hidden"
          ]
        }
      );
    }

    const practiceAgain =
      document.getElementById(
        "practiceAgain"
      );

    practiceAgain
      ?.addEventListener(
        "click",
        () => {
          resetSessionFeedback();
        }
      );

    checkCompletion();
  }

  if (
    document.readyState ===
      "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once:
          true
      }
    );
  }

  else {
    init();
  }
})();
