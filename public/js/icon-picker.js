export const ICON_GROUPS = [
  {
    name: "Языки и фреймворки",
    icons: ["🟨", "🐍", "💠", "🔩", "☕", "⚛️", "🦀", "📘", "💎", "🔷", "🟦", "🐹", "📗", "🔺"],
  },
  {
    name: "Разработка",
    icons: ["💻", "🖥️", "⌨️", "🧑‍💻", "🔧", "⚙️", "🛠️", "📦", "🗂️", "📁", "🧩", "🔗"],
  },
  {
    name: "Веб и UI",
    icons: ["🌐", "📱", "🎨", "🖼️", "✨", "🎯", "📐", "🧭"],
  },
  {
    name: "Данные",
    icons: ["📊", "🗄️", "🔢", "📈", "🧮", "🔍"],
  },
  {
    name: "Обучение",
    icons: ["📚", "🎓", "📝", "💡", "❓", "✅", "🏷️", "🚀", "⚡", "🔥", "⭐", "💬"],
  },
];

/**
 * @param {HTMLElement} container — элемент с data-icon-picker или обёртка
 * @param {HTMLInputElement} input — скрытое поле со значением emoji
 */
export function initIconPicker(container, input) {
  if (!container || !input) return;

  const preview = document.createElement("span");
  preview.className = "icon-picker-preview";
  preview.textContent = input.value || "📦";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "icon-picker-trigger";
  trigger.innerHTML = "";
  trigger.append(preview, document.createTextNode(" Выбрать иконку"));

  const menu = document.createElement("div");
  menu.className = "icon-picker-menu hidden";
  menu.setAttribute("role", "listbox");

  for (const group of ICON_GROUPS) {
    const groupEl = document.createElement("div");
    groupEl.className = "icon-picker-group";
    groupEl.innerHTML = `<p class="icon-picker-group-title">${group.name}</p>`;
    const grid = document.createElement("div");
    grid.className = "icon-picker-grid";
    for (const icon of group.icons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-picker-item";
      btn.textContent = icon;
      btn.title = icon;
      btn.setAttribute("role", "option");
      if (icon === input.value) btn.classList.add("selected");
      btn.addEventListener("click", () => select(icon));
      grid.appendChild(btn);
    }
    groupEl.appendChild(grid);
    menu.appendChild(groupEl);
  }

  const wrap = document.createElement("div");
  wrap.className = "icon-picker";
  wrap.append(trigger, menu);
  container.appendChild(wrap);

  function select(icon) {
    input.value = icon;
    preview.textContent = icon;
    menu.querySelectorAll(".icon-picker-item").forEach((el) => {
      el.classList.toggle("selected", el.textContent === icon);
    });
    closeMenu();
  }

  function openMenu() {
    const rect = trigger.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.width = `${Math.min(rect.width, 360)}px`;
    menu.style.right = "auto";
    menu.classList.remove("hidden");
    trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("click", onOutside);
    document.addEventListener("keydown", onEscape);
  }

  function closeMenu() {
    menu.classList.add("hidden");
    menu.style.position = "";
    menu.style.top = "";
    menu.style.left = "";
    menu.style.width = "";
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onOutside);
    document.removeEventListener("keydown", onEscape);
  }

  function onOutside(e) {
    if (!wrap.contains(e.target)) closeMenu();
  }

  function onEscape(e) {
    if (e.key === "Escape") closeMenu();
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.classList.contains("hidden")) openMenu();
    else closeMenu();
  });

  return { setValue(icon) { select(icon); }, close: closeMenu };
}
