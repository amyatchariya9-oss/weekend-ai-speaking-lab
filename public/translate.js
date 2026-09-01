const questionEl =
  document.getElementById("question");

if (questionEl) {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const lessonId =
    params.get("lesson") ||
    "weekend";

  let lessonsData = {};
  let vocabData = {};
  let currentTranslation = null;
  let lastQuestion = "";

  function injectStyles() {
    const style =
      document.createElement("style");

    style.textContent = `
      .question-translate-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .question-translate-row #question {
        flex: 1;
        min-width: 0;
      }

      .translate-btn {
        display: none;
        flex-shrink: 0;
        align-items: center;
        gap: 5px;
        margin-top: 2px;
        border: 0;
        background: transparent;
        padding: 5px 3px;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        color: #7375a8;
        cursor: pointer;
      }

      .translate-btn.show {
        display: inline-flex;
      }

      .translate-btn svg {
        width: 17px;
        height: 17px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .translate-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: flex-end;
        justify-content: center;
        padding: 18px;
        background: rgba(25, 27, 45, 0.3);
        backdrop-filter: blur(2px);
      }

      .translate-overlay.open {
        display: flex;
      }

      .translate-sheet {
        width: min(100%, 430px);
        padding: 21px;
        border-radius: 24px;
        background: #ffffff;
        box-shadow:
          0 22px 60px
          rgba(28, 31, 56, 0.2);
      }

      .translate-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }

      .translate-heading {
        font-size: 13px;
        font-weight: 800;
        color: #8a8da4;
      }

      .translate-close {
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 50%;
        background: #f3f3f8;
        color: #55586f;
        font-size: 20px;
        cursor: pointer;
      }

      .translate-english {
        margin-top: 18px;
        font-size: 19px;
        line-height: 1.5;
        font-weight: 700;
        color: #262942;
      }

      .translate-divider {
        height: 1px;
        margin: 16px 0;
        background: #ececf3;
      }

      .translate-thai {
        font-size: 17px;
        line-height: 1.6;
        color: #4f5269;
      }

      @media (max-width: 520px) {
        .question-translate-row {
          gap: 8px;
        }

        .translate-btn {
          font-size: 12px;
        }
      }

      @media (min-width: 700px) {
        .translate-overlay {
          align-items: center;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createQuestionRow() {
    if (
      questionEl.parentElement
        ?.classList.contains(
          "question-translate-row"
        )
    ) {
      return questionEl.parentElement;
    }

    const row =
      document.createElement("div");

    row.className =
      "question-translate-row";

    questionEl.parentNode.insertBefore(
      row,
      questionEl
    );

    row.appendChild(questionEl);

    return row;
  }

  function createTranslateButton() {
    let button =
      document.getElementById(
        "translateQuestionBtn"
      );

    if (button) {
      return button;
    }

    const row =
      createQuestionRow();

    button =
      document.createElement(
        "button"
      );

    button.id =
      "translateQuestionBtn";

    button.className =
      "translate-btn";

    button.type =
      "button";

    button.innerHTML = `
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M5 8l6 6"></path>
        <path d="M4 14l6-6 2-3"></path>
        <path d="M2 5h12"></path>
        <path d="M7 2h1"></path>
        <path d="M22 22l-5-10-5 10"></path>
        <path d="M14 18h6"></path>
      </svg>

      <span>แปล</span>
    `;

    button.addEventListener(
      "click",
      () => {
        if (
          !currentTranslation
            ?.questionThai
        ) {
          return;
        }

        openTranslation();
      }
    );

    row.appendChild(button);

    return button;
  }

  function createPopup() {
    let overlay =
      document.getElementById(
        "translateOverlay"
      );

    if (overlay) {
      return overlay;
    }

    overlay =
      document.createElement(
        "div"
      );

    overlay.id =
      "translateOverlay";

    overlay.className =
      "translate-overlay";

    overlay.innerHTML = `
      <div class="translate-sheet">

        <div class="translate-header">

          <div class="translate-heading">
            คำแปล
          </div>

          <button
            class="translate-close"
            id="translateClose"
            type="button"
            aria-label="Close"
          >
            ×
          </button>

        </div>

        <div
          class="translate-english"
          id="translateEnglish"
        ></div>

        <div
          class="translate-divider"
        ></div>

        <div
          class="translate-thai"
          id="translateThai"
        ></div>

      </div>
    `;

    document.body.appendChild(
      overlay
    );

    overlay
      .querySelector(
        "#translateClose"
      )
      .addEventListener(
        "click",
        closeTranslation
      );

    overlay.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          overlay
        ) {
          closeTranslation();
        }
      }
    );

    return overlay;
  }

  function closeTranslation() {
    document
      .getElementById(
        "translateOverlay"
      )
      ?.classList.remove(
        "open"
      );
  }

  function openTranslation() {
    const overlay =
      createPopup();

    overlay.querySelector(
      "#translateEnglish"
    ).textContent =
      getQuestionText();

    overlay.querySelector(
      "#translateThai"
    ).textContent =
      currentTranslation
        ?.questionThai ||
      "";

    overlay.classList.add(
      "open"
    );
  }

  function normalizeText(
    text = ""
  ) {
    return String(text)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function getQuestionText() {
    return questionEl.textContent
      .replace(/\s+/g, " ")
      .trim();
  }

  function findQuestionId(
    questionText
  ) {
    const questions =
      lessonsData?.[
        lessonId
      ]?.questions;

    if (
      !Array.isArray(
        questions
      )
    ) {
      return "";
    }

    const normalized =
      normalizeText(
        questionText
      );

    const match =
      questions.find(
        (question) =>
          normalizeText(
            question.text
          ) === normalized
      );

    return match?.id || "";
  }

  function updateTranslation() {
    const questionText =
      getQuestionText();

    if (
      !questionText ||
      questionText ===
        lastQuestion
    ) {
      return;
    }

    lastQuestion =
      questionText;

    const questionId =
      findQuestionId(
        questionText
      );

    currentTranslation =
      vocabData?.[
        lessonId
      ]?.[
        questionId
      ] || null;

    const button =
      createTranslateButton();

    if (
      currentTranslation
        ?.questionThai
    ) {
      button.classList.add(
        "show"
      );
    } else {
      button.classList.remove(
        "show"
      );
    }
  }

  async function initTranslate() {
    injectStyles();

    createQuestionRow();
    createTranslateButton();
    createPopup();

    try {
      const [
        lessonsResponse,
        vocabResponse
      ] =
        await Promise.all([
          fetch(
            "/lessons.json",
            {
              cache:
                "no-store"
            }
          ),

          fetch(
            "/vocab.json",
            {
              cache:
                "no-store"
            }
          )
        ]);

      if (
        !lessonsResponse.ok
      ) {
        throw new Error(
          "Could not load lessons.json"
        );
      }

      if (
        !vocabResponse.ok
      ) {
        throw new Error(
          "Could not load vocab.json"
        );
      }

      lessonsData =
        await lessonsResponse.json();

      vocabData =
        await vocabResponse.json();

      updateTranslation();

      const observer =
        new MutationObserver(
          () => {
            const questionText =
              getQuestionText();

            if (
              questionText !==
              lastQuestion
            ) {
              requestAnimationFrame(
                updateTranslation
              );
            }
          }
        );

      observer.observe(
        questionEl,
        {
          childList: true,
          characterData: true,
          subtree: true
        }
      );

    } catch (error) {
      console.error(
        "Translation error:",
        error
      );
    }
  }

  initTranslate();
}
