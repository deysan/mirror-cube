export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "uk", label: "Українська" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

interface Messages {
  readonly documentTitle: string;
  readonly documentDescription: string;
  readonly languageLabel: string;
  readonly heroTitle: string;
  readonly intro: string;
  readonly overviewLabel: string;
  readonly solvedState: string;
  readonly viewLabel: string;
  readonly caption: string;
  readonly geometryEyebrow: string;
  readonly geometryTitle: string;
  readonly geometryDescription: string;
  readonly cubeEdge: string;
  readonly axisLayers: Readonly<Record<"x" | "y" | "z", string>>;
  readonly millimeters: string;
  readonly stageNote: string;
  readonly cubeTitle: string;
  readonly cubeDescription: string;
}

export const messages = {
  en: {
    documentTitle: "MirrorCube — 2×2 Mirror Cube",
    documentDescription: "A step-by-step guide to solving the 2×2 Mirror Cube. Start by exploring its geometry.",
    languageLabel: "Interface language",
    heroTitle: "A different shape of puzzle.",
    intro: "The same finish. Eight different shapes. Get to know your Mirror Cube, starting with its solved form.",
    overviewLabel: "Solved puzzle overview",
    solvedState: "Solved state",
    viewLabel: "Fixed isometric view",
    caption: "The lines are not centered — each piece has its own dimensions.",
    geometryEyebrow: "Meet the geometry",
    geometryTitle: "One cube. Eight distinct pieces.",
    geometryDescription: "Unlike a color-based cube, a Mirror Cube is solved by shape. All outer surfaces line up when the pieces are in place.",
    cubeEdge: "Cube edge",
    axisLayers: { x: "X layers", y: "Y layers", z: "Z layers" },
    millimeters: "mm",
    stageNote: "This first view shows the solved geometry. Turns and step-by-step instructions are not available yet.",
    cubeTitle: "Solved 2×2 Mirror Cube",
    cubeDescription: "An isometric view of the top and two sides. Unequal divisions show the different piece dimensions. The puzzle is static and cannot be turned yet.",
  },
  uk: {
    documentTitle: "MirrorCube — дзеркальний кубик 2×2",
    documentDescription: "Покрокова інструкція зі складання дзеркального кубика 2×2. Почніть зі знайомства з його геометрією.",
    languageLabel: "Мова інтерфейсу",
    heroTitle: "Головоломка, де головне — форма.",
    intro: "Однакове покриття. Вісім різних форм. Познайомтеся зі своїм дзеркальним кубиком, починаючи зі складеного стану.",
    overviewLabel: "Огляд складеного кубика",
    solvedState: "Складений стан",
    viewLabel: "Фіксований ізометричний вигляд",
    caption: "Лінії поділу зміщені від центру — кожна деталь має власні розміри.",
    geometryEyebrow: "Знайомство з геометрією",
    geometryTitle: "Один кубик. Вісім різних деталей.",
    geometryDescription: "На відміну від кольорового кубика, дзеркальний складають за формою. Коли деталі на своїх місцях, усі зовнішні поверхні розташовані врівень.",
    cubeEdge: "Ребро кубика",
    axisLayers: { x: "Шари по X", y: "Шари по Y", z: "Шари по Z" },
    millimeters: "мм",
    stageNote: "Зараз показано геометрію складеного кубика. Повороти та покрокові інструкції ще недоступні.",
    cubeTitle: "Складений дзеркальний кубик 2×2",
    cubeDescription: "Ізометричний вигляд верхньої та двох бічних поверхонь. Нерівні поділи показують різні розміри деталей. Кубик нерухомий: повороти ще недоступні.",
  },
} as const satisfies Record<Language, Messages>;
