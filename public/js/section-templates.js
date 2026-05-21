/** Шаблоны разделов и языки блоков кода */
export const SECTION_PRESETS = {
  cpp: {
    title: "C++",
    slug: "cpp",
    icon: "💠",
    description: "Современный C++: STL, ООП, память и идиомы",
    defaultLanguage: "cpp",
  },
  c: {
    title: "C",
    slug: "c",
    icon: "🔩",
    description: "Классический C: указатели, структуры, стандартная библиотека",
    defaultLanguage: "c",
  },
  javascript: {
    title: "JavaScript",
    slug: "javascript",
    icon: "🟨",
    description: "Язык веба: от основ до паттернов",
    defaultLanguage: "javascript",
  },
  python: {
    title: "Python",
    slug: "python",
    icon: "🐍",
    description: "Читаемый синтаксис и стандартная библиотека",
    defaultLanguage: "python",
  },
  react: {
    title: "React",
    slug: "react",
    icon: "⚛️",
    description: "Компоненты, хуки и состояние UI",
    defaultLanguage: "javascript",
  },
};

export const CODE_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
];

export function defaultLanguageForSection(sectionSlug) {
  const preset = SECTION_PRESETS[sectionSlug];
  if (preset?.defaultLanguage) return preset.defaultLanguage;
  return "javascript";
}
