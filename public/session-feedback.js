// public/session-feedback.js
// Session Feedback for AI Speaking Lab
// ใช้ข้อมูลจาก /correct ที่มีอยู่แล้ว
// ไม่เรียก Gemini เพิ่ม = ไม่เพิ่มค่า API

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

    // ไม่เก็บ help request
    // และไม่เก็บคำตอบที่ไม่เกี่ยวข้อง
    if (
      responseData
        .help_requested ||
      responseData
        .answer_relevant !== true
    ) {
      return;
    }

    // ถ้ามี meaningful correction
    // เก็บ correction ไว้
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

    // ถ้าตอบผ่านแล้ว
    // ถือเป็น final accepted answer
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
  // WATCH /correct
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
        line-height: 1.6;
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
        margin-top: 10px;
        padding: 12px;
        border-radius: 14px;
        background: #ffffff;
      }

      .session-feedback-old {
        font-size: 14px;
        line-height: 1.5;
        color: #8a6470;
        text-decoration: line-through;
        text-decoration-thickness: 1px;
      }

      .session-feedback-new {
        margin-top: 5px;
        font-size: 14px;
        line-height: 1.5;
        color: #3f6858;
        font-weight: 800;
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
  // WHAT YOU DID WELL
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
        "คุณตอบครบทุกข้อได้ชัดเจน " +
        "และวันนี้ไม่มีข้อผิดพลาดสำคัญที่ต้องให้แก้เลย"
      );
    }

    if (
      completed >= 5 &&
      correctionCount > 0
    ) {
      return (
        "คุณตอบครบทุกข้อ และตอนที่มีจุดต้องแก้ " +
        "คุณลองพูดใหม่จนผ่านได้ — นี่คือการฝึกที่ดีมาก"
      );
    }

    if (
      completed > 0
    ) {
      return (
        `คุณสื่อสารคำตอบได้สำเร็จ ${completed} ช่วง ` +
        "และพยายามตอบด้วยประโยคของตัวเอง"
      );
    }

    return (
      "คุณฝึกพูดจนจบ session ได้สำเร็จ"
    );
  }

  // ==========================================
  // ONE THING TO IMPROVE
  // ==========================================

  function getImprovementData() {
    const list =
      getCorrectionList();

    if (
      list.length > 0
    ) {
      // ใช้ correction ล่าสุด
      // ที่เกิดขึ้นจริงใน session
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
        "วันนี้ไม่มีข้อผิดพลาดสำคัญที่ระบบต้องให้แก้ " +
        "ครั้งต่อไปลองเพิ่มรายละเอียดอีก 1 ประโยค " +
        "เพื่อให้คำตอบเป็นธรรมชาติและต่อเนื่องขึ้น"
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
  // RENDER FEEDBACK
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
        "✅",
        "What you did well",
        strengthText
      )
    );

    // ======================================
    // NICE PHRASES YOU USED
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
        "ลองพูดอีกครั้งเพื่อเก็บประโยคเด่นจาก session นี้";

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
    // ONE THING TO IMPROVE
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

    explanation.textContent =
      improvement.explanation ||
      "ลองขยายคำตอบให้มีรายละเอียดเพิ่มขึ้นอีกนิด";

    improvementWrap.appendChild(
      explanation
    );

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

      const oldSentence =
        document.createElement(
          "div"
        );

      oldSentence.className =
        "session-feedback-old";

      oldSentence.textContent =
        improvement.original;

      const newSentence =
        document.createElement(
          "div"
        );

      newSentence.className =
        "session-feedback-new";

      newSentence.textContent =
        `→ ${improvement.corrected}`;

      correctionBox.appendChild(
        oldSentence
      );

      correctionBox.appendChild(
        newSentence
      );

      improvementWrap.appendChild(
        correctionBox
      );
    }

    card.appendChild(
      makeSection(
        "✨",
        "One thing to improve",
        improvementWrap
      )
    );

    // ======================================
    // INSERT BEFORE PRACTICE AGAIN BUTTON
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
