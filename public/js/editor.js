import { escapeHtml } from "./api.js";

const VIZ_TEMPLATES = {
  array: {
    type: "array",
    input: [1, 2, 3],
    output: [2, 4, 6],
    label: "n => n * 2",
    highlightIndex: 1,
  },
  variables: {
    type: "variables",
    steps: [
      { vars: { x: 0 }, action: "Инициализация" },
      { vars: { x: 1 }, action: "x += 1" },
    ],
  },
  console: {
    type: "console",
    lines: ["> Hello", "> World"],
  },
  steps: {
    type: "steps",
    steps: [
      { label: "Шаг 1", array: [1, 2, 3] },
      { label: "Шаг 2", array: [2, 4, 6] },
    ],
  },
};

let blockCounter = 0;

export function createBlockEditor(container, initial = null) {
  blockCounter++;
  const id = blockCounter;
  const block = initial || {
    title: "",
    code: "",
    language: "javascript",
    explanation: "",
    visualization: { ...VIZ_TEMPLATES.array },
  };

  const div = document.createElement("div");
  div.className = "block-editor-item";
  div.dataset.blockId = id;
  div.innerHTML = `
    <h4>Блок кода #${id} <button type="button" class="btn btn-sm" data-remove style="float:right">Удалить</button></h4>
    <div class="form-group">
      <label>Заголовок блока</label>
      <input type="text" data-field="title" value="${escapeHtml(block.title)}" />
    </div>
    <div class="form-group">
      <label>Язык</label>
      <select data-field="language">
        <option value="javascript" ${block.language === "javascript" ? "selected" : ""}>JavaScript</option>
        <option value="python" ${block.language === "python" ? "selected" : ""}>Python</option>
        <option value="typescript" ${block.language === "typescript" ? "selected" : ""}>TypeScript</option>
      </select>
    </div>
    <div class="form-group">
      <label>Код</label>
      <textarea data-field="code" rows="8">${escapeHtml(block.code)}</textarea>
    </div>
    <div class="form-group">
      <label>Пояснение под кодом</label>
      <input type="text" data-field="explanation" value="${escapeHtml(block.explanation)}" />
    </div>
    <div class="form-group">
      <label>Тип визуализации</label>
      <select data-field="vizType">
        <option value="array">Массив (до → после)</option>
        <option value="variables">Переменные по шагам</option>
        <option value="console">Консоль</option>
        <option value="steps">Пошаговый массив</option>
      </select>
    </div>
    <div class="form-group">
      <label>JSON визуализации (можно править вручную)</label>
      <textarea data-field="vizJson" rows="10">${escapeHtml(JSON.stringify(block.visualization, null, 2))}</textarea>
    </div>
  `;

  div.querySelector("[data-remove]").addEventListener("click", () => div.remove());
  div.querySelector("[data-field=vizType]").addEventListener("change", (e) => {
    const tpl = VIZ_TEMPLATES[e.target.value];
    div.querySelector("[data-field=vizJson]").value = JSON.stringify(tpl, null, 2);
  });

  container.appendChild(div);
  return div;
}

export function collectBlocks(container) {
  const items = container.querySelectorAll(".block-editor-item");
  const blocks = [];
  items.forEach((div, i) => {
    let visualization;
    try {
      visualization = JSON.parse(div.querySelector("[data-field=vizJson]").value);
    } catch {
      throw new Error(`Блок #${i + 1}: невалидный JSON визуализации`);
    }
    blocks.push({
      id: `block-${i}`,
      title: div.querySelector('[data-field="title"]').value.trim(),
      code: div.querySelector('[data-field="code"]').value,
      language: div.querySelector('[data-field="language"]').value,
      explanation: div.querySelector('[data-field="explanation"]').value.trim(),
      visualization,
    });
  });
  return blocks;
}
