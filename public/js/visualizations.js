import { escapeHtml } from "./api.js";

export function renderVisualization(viz, container) {
  if (!viz || !viz.type) {
    container.innerHTML = '<p class="empty-state">Визуализация не задана</p>';
    return;
  }

  switch (viz.type) {
    case "array":
      renderArrayViz(viz, container);
      break;
    case "variables":
      renderVariablesViz(viz, container);
      break;
    case "console":
      renderConsoleViz(viz, container);
      break;
    case "steps":
      renderStepsViz(viz, container);
      break;
    default:
      container.innerHTML = `<p class="empty-state">Тип «${escapeHtml(viz.type)}» пока не поддерживается</p>`;
  }
}

function renderArrayViz(viz, container) {
  const inputCells = viz.input
    .map((n, i) => `<div class="array-cell${i === viz.highlightIndex ? " highlight" : ""}">${n}</div>`)
    .join("");
  const outputCells = (viz.output || [])
    .map((n, i) => `<div class="array-cell${i === viz.highlightIndex ? " highlight" : ""}">${n}</div>`)
    .join("");

  container.innerHTML = `
    <div class="viz-label">Что происходит</div>
    <div class="array-viz">
      <div>${inputCells}</div>
      ${viz.label ? `<span class="array-fn">${escapeHtml(viz.label)}</span>` : ""}
      <span class="array-arrow">→</span>
      <div>${outputCells}</div>
    </div>
    <p style="margin:0.75rem 0 0;color:var(--text-muted);font-size:0.85rem">
      Исходный массив не изменяется — создаётся новый с преобразованными значениями.
    </p>
  `;
}

function renderVariablesViz(viz, container) {
  let step = 0;
  const steps = viz.steps || [];

  function draw() {
    const s = steps[step] || { vars: {}, action: "" };
    const rows = Object.entries(s.vars)
      .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`)
      .join("");

    container.innerHTML = `
      <div class="viz-label">Состояние переменных · шаг ${step + 1}/${steps.length}</div>
      <table class="vars-table">
        <thead><tr><th>Имя</th><th>Значение</th></tr></thead>
        <tbody>${rows || "<tr><td colspan=2>—</td></tr>"}</tbody>
      </table>
      ${s.action ? `<div class="vars-action">${escapeHtml(s.action)}</div>` : ""}
      <div class="step-controls">
        <button type="button" class="btn btn-sm" data-prev ${step === 0 ? "disabled" : ""}>← Назад</button>
        <div class="step-dots">${steps.map((_, i) => `<span class="step-dot${i === step ? " active" : ""}"></span>`).join("")}</div>
        <button type="button" class="btn btn-sm btn-primary" data-next>${step >= steps.length - 1 ? "Сначала" : "Далее →"}</button>
      </div>
    `;

    container.querySelector("[data-prev]")?.addEventListener("click", () => {
      if (step > 0) {
        step--;
        draw();
      }
    });
    container.querySelector("[data-next]")?.addEventListener("click", () => {
      step = step >= steps.length - 1 ? 0 : step + 1;
      draw();
    });
  }

  draw();
}

function renderConsoleViz(viz, container) {
  container.innerHTML = `
    <div class="viz-label">Вывод в консоль</div>
    <div class="console-viz" id="console-out"></div>
    <button type="button" class="btn btn-sm" style="margin-top:0.6rem" data-replay>Повторить</button>
  `;
  const out = container.querySelector("#console-out");

  function play() {
    out.innerHTML = "";
    (viz.lines || []).forEach((line, i) => {
      setTimeout(() => {
        const el = document.createElement("div");
        el.className = "console-line";
        el.textContent = line;
        out.appendChild(el);
      }, i * 400);
    });
  }

  play();
  container.querySelector("[data-replay]")?.addEventListener("click", play);
}

function renderStepsViz(viz, container) {
  let step = 0;
  const steps = viz.steps || [];

  function draw() {
    const s = steps[step] || {};
    let arrayHtml = "";
    if (s.array) {
      arrayHtml = `<div class="array-viz">${s.array.map((n) => `<div class="array-cell">${n}</div>`).join("")}</div>`;
    }
    let filteredHtml = "";
    if (s.filtered?.length) {
      filteredHtml = `<p style="font-size:0.85rem;color:var(--text-muted)">Отброшено: ${s.filtered.join(", ")}</p>`;
    }

    container.innerHTML = `
      <div class="viz-label">${escapeHtml(s.label || `Шаг ${step + 1}`)}</div>
      ${arrayHtml}
      ${filteredHtml}
      <div class="step-controls">
        <button type="button" class="btn btn-sm" data-prev ${step === 0 ? "disabled" : ""}>←</button>
        <div class="step-dots">${steps.map((_, i) => `<span class="step-dot${i === step ? " active" : ""}"></span>`).join("")}</div>
        <button type="button" class="btn btn-sm btn-primary" data-next>${step >= steps.length - 1 ? "↺" : "→"}</button>
      </div>
    `;

    container.querySelector("[data-prev]")?.addEventListener("click", () => {
      if (step > 0) {
        step--;
        draw();
      }
    });
    container.querySelector("[data-next]")?.addEventListener("click", () => {
      step = step >= steps.length - 1 ? 0 : step + 1;
      draw();
    });
  }

  draw();
}

export function renderCodeBlock(block, index) {
  const lang = block.language || "javascript";
  const { highlightCode } = window.__devwiki || {};
  const codeHtml =
    typeof highlightCode === "function"
      ? highlightCode(block.code, lang)
      : block.code.replace(/</g, "&lt;");

  return `
    <article class="code-block" id="block-${index}">
      <div class="code-block-header">
        <strong>${escapeHtml(block.title || `Фрагмент ${index + 1}`)}</strong>
        <span class="lang">${escapeHtml(lang)}</span>
      </div>
      <pre class="code"><code>${codeHtml}</code></pre>
      ${block.explanation ? `<div class="block-explanation">${escapeHtml(block.explanation)}</div>` : ""}
      <div class="viz-panel" data-viz-index="${index}"></div>
    </article>
  `;
}
