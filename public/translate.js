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
  let currentVocabEntry = null;
  let lastRenderedQuestion = "";

  const typeLabels = {
    noun: "noun · คำนาม",
    verb: "verb · คำกริยา",
    adjective:
      "adjective · คำคุณศัพท์",
    adverb:
      "adverb · คำวิเศษณ์",
    phrase: "phrase · วลี",
    expression:
      "expression · สำนวน / วลี"
  };

  function injectStyles() {
    const style =
      document.createElement("style");

    style.textContent = `
      .tap-vocab {
        cursor: pointer;
        border-bottom: 1.5px dashed currentColor;
        padding-bottom: 1px;
      }

      .translate-question-btn {
        display: none;
        margin-top: 10px;
        padding: 7px 11px;
        border: 0;
        background: transparent;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        color: #6f72a8;
        cursor: pointer;
      }

      .translate-question-btn.show {
        display: inline-flex;
      }

      .translate-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: flex-end;
        justify-content: center;
        padding: 18px;
        background: rgba(25, 27, 45, 0.32);
        backdrop-filter: blur(2px);
      }

      .translate-overlay.open {
        display: flex;
      }

      .translate-sheet {
        width: min(100%, 440px);
        border-radius: 24px;
        background: white;
        box-shadow:
          0 22px 60px
          rgba(28, 31, 56, 0.22);
        padding: 20px;
      }

      .translate-head {
        display: flex;
        justify-content: space-between;
        gap: 14px;
      }

      .translate-word {
        margin: 0;
        font-size: 24px;
        color: #20233f;
      }

      .translate-close {
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 50%;
        background: #f3f3f8;
        font-size: 20px;
        cursor: pointer;
      }

      .translate-type {
        margin-top: 5px;
        font-size: 12px;
        font-weight: 700;
        color: #8a8da6;
      }

      .translate-thai {
        margin-top: 14px;
        font-size: 18px;
        line-height: 1.55;
        font-weight: 700;
        color: #333650;
      }

      .translate-divider {
        height: 1px;
        margin: 17px 0;
        background: #ececf3;
      }

      .translate-label {
        font-size: 11px;
        font-weight: 800;
        color: #9a9cb0;
      }

      .translate-example {
        margin-top: 6px;
        font-size: 16px;
        line-height: 1.5;
      }

      .translate-example-thai {
        margin-top: 5px;
        font-size: 14px;
        color: #70738a;
      }

      .translate-question-en {
        margin-top: 8px;
        font-size: 17px;
        line-height: 1.5;
        font-weight: 400;
      }

      @media (min-width: 700px) {
        .translate-overlay {
          align-items: center;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createTranslateButton() {
    let button =
      document.getElementById(
        "translateQuestionBtn"
      );

    if (button) {
      return button;
    }

    button =
      document.createElement(
        "button"
      );

    button.id =
      "translateQuestionBtn";

    button.className =
      "translate-question-btn";

    button.type =
      "button";

    button.textContent =
      "ดูคำแปลทั้งคำถาม";

    questionEl.insertAdjacentElement(
      "afterend",
      button
    );

    button.addEventListener(
      "click",
      () => {
        if (
          !currentVocabEntry
            ?.questionThai
        ) {
          return;
        }

        openQuestionTranslation(
          getPlainQuestionText(),
          currentVocabEntry
            .questionThai
        );
      }
    );

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
        <div class="translate-head">
          <div>
            <h3
              class="translate-word"
              id="translateTitle"
            ></h3>

            <div
              class="translate-type"
              id="translateType"
            ></div>
          </div>

          <button
            class="translate-close"
            id="translateClose"
            type="button"
          >
            ×
          </button>
        </div>

        <div
          class="translate-thai"
          id="translateThai"
        ></div>

        <div id="translateExampleBlock">
          <div
            class="translate-divider"
          ></div>

          <div
            class="translate-label"
          >
            EXAMPLE
          </div>

          <div
            class="translate-example"
            id="translateExample"
          ></div>

          <div
            class="translate-example-thai"
            id="translateExampleThai"
          ></div>
        </div>
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
        closePopup
      );

    overlay.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          overlay
        ) {
          closePopup();
        }
      }
    );

    return overlay;
  }

  function closePopup() {
    document
      .getElementById(
        "translateOverlay"
      )
      ?.classList.remove(
        "open"
      );
  }

  function openPopup(vocab) {
    const overlay =
      createPopup();

    overlay.querySelector(
      "#translateTitle"
    ).textContent =
      vocab.text || "";

    overlay.querySelector(
      "#translateType"
    ).textContent =
      typeLabels[
        vocab.type
      ] ||
      vocab.type ||
      "";

    overlay.querySelector(
      "#translateThai"
    ).textContent =
      vocab.thai || "";

    overlay.querySelector(
      "#translateExample"
    ).textContent =
      vocab.example || "";

    overlay.querySelector(
      "#translateExampleThai"
    ).textContent =
      vocab.exampleThai || "";

    overlay.querySelector(
      "#translateExampleBlock"
    ).style.display =
      vocab.example ||
      vocab.exampleThai
        ? "block"
        : "none";

    overlay.classList.add(
      "open"
    );
  }

  function openQuestionTranslation(
    english,
    thai
  ) {
    const overlay =
      createPopup();

    overlay.querySelector(
      "#translateTitle"
    ).textContent =
      "แปลทั้งคำถาม";

    overlay.querySelector(
      "#translateType"
    ).textContent = "";

    const thaiContainer =
      overlay.querySelector(
        "#translateThai"
      );

    thaiContainer.innerHTML =
      "";

    const englishEl =
      document.createElement(
        "div"
      );

    englishEl.className =
      "translate-question-en";

    englishEl.textContent =
      english;

    const thaiEl =
      document.createElement(
        "div"
      );

    thaiEl.className =
      "translate-thai";

    thaiEl.textContent =
      thai;

    thaiContainer.appendChild(
      englishEl
    );

    thaiContainer.appendChild(
      thaiEl
    );

    overlay.querySelector(
      "#translateExampleBlock"
    ).style.display =
      "none";

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

  function getPlainQuestionText() {
    return questionEl.textContent
      .replace(/\s+/g, " ")
      .trim();
  }

  function findQuestionId(
    text
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
      normalizeText(text);

    const match =
      questions.find(
        (question) =>
          normalizeText(
            question.text
          ) === normalized
      );

    return match?.id || "";
  }

  function escapeRegExp(
    text
  ) {
    return text.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
  }

  function renderQuestion() {
    const questionText =
      getPlainQuestionText();

    if (!questionText) {
      return;
    }

    /*
      If this exact question has
      already been decorated,
      do nothing.

      This prevents the
      MutationObserver from
      repeatedly rendering itself.
    */
    if (
      questionText ===
        lastRenderedQuestion &&
      questionEl.querySelector(
        ".tap-vocab"
      )
    ) {
      return;
    }

    const questionId =
      findQuestionId(
        questionText
      );

    currentVocabEntry =
      vocabData?.[
        lessonId
      ]?.[
        questionId
      ] || null;

    const button =
      createTranslateButton();

    if (
      !currentVocabEntry
    ) {
      button.classList.remove(
        "show"
      );

      lastRenderedQuestion =
        questionText;

      return;
    }

    if (
      currentVocabEntry
        .questionThai
    ) {
      button.classList.add(
        "show"
      );
    } else {
      button.classList.remove(
        "show"
      );
    }

    const vocabList =
      Array.isArray(
        currentVocabEntry
          .vocab
      )
        ? currentVocabEntry
            .vocab
        : [];

    if (
      vocabList.length === 0
    ) {
      lastRenderedQuestion =
        questionText;

      return;
    }

    let html =
      questionText;

    const sorted =
      [...vocabList].sort(
        (a, b) =>
          String(
            b.text
          ).length -
          String(
            a.text
          ).length
      );

    for (
      const vocab
      of sorted
    ) {
      if (!vocab.text) {
        continue;
      }

      const escaped =
        escapeRegExp(
          vocab.text
        );

      const regex =
        new RegExp(
          `(${escaped})`,
          "i"
        );

      html =
        html.replace(
          regex,
          `<span
            class="tap-vocab"
            data-vocab="${encodeURIComponent(
              vocab.text
            )}"
          >$1</span>`
        );
    }

    questionEl.innerHTML =
      html;

    questionEl
      .querySelectorAll(
        ".tap-vocab"
      )
      .forEach(
        (element) => {
          element.addEventListener(
            "click",
            () => {
              const text =
                decodeURIComponent(
                  element
                    .dataset
                    .vocab
                );

              const vocab =
                vocabList.find(
                  (item) =>
                    item.text ===
                    text
                );

              if (vocab) {
                openPopup(
                  vocab
                );
              }
            }
          );
        }
      );

    lastRenderedQuestion =
      questionText;
  }

  async function initTranslate() {
    injectStyles();

    createPopup();

    createTranslateButton();

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
        await lessonsResponse
          .json();

      vocabData =
        await vocabResponse
          .json();

      renderQuestion();

      const observer =
        new MutationObserver(
          () => {
            const text =
              getPlainQuestionText();

            /*
              Only render again
              when app.js changes
              to a genuinely
              different question.
            */
            if (
              text !==
              lastRenderedQuestion
            ) {
              requestAnimationFrame(
                renderQuestion
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
        "Tap-to-Translate error:",
        error
      );
    }
  }

  initTranslate();
}
