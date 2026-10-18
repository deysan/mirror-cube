import type { Face, Move } from "../puzzle/moves";
import type { StateErrorCode } from "../puzzle/validation";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "uk", label: "Українська" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

export interface Messages {
  readonly documentTitle: string;
  readonly documentDescription: string;
  readonly languageLabel: string;
  readonly heroTitle: string;
  readonly intro: string;
  readonly overviewLabel: string;
  readonly readyToTurn: string;
  readonly turning: string;
  readonly undoing: string;
  readonly scramble: string;
  readonly scrambling: string;
  readonly scrambleHint: string;
  readonly historyTitle: string;
  readonly historyCount: string;
  readonly historyEmpty: string;
  readonly historyHint: string;
  readonly undoLastMove: string;
  readonly solutionTitle: string;
  readonly findSolution: string;
  readonly cancelSearch: string;
  readonly searchHint: string;
  readonly searchIdle: string;
  readonly searchRunning: string;
  readonly searching: string;
  readonly searchCancelled: string;
  readonly searchSolved: string;
  readonly solutionCount: string;
  readonly solutionMoves: string;
  readonly solutionHint: string;
  readonly nextSolutionStep: string;
  readonly solutionStep: string;
  readonly solutionProgress: string;
  readonly solutionComplete: string;
  readonly playbackFailed: string;
  readonly playbackOrientation: string;
  readonly stepInProgress: string;
  readonly stepCompleted: string;
  readonly stepCurrent: string;
  readonly searchInvalid: string;
  readonly invalidCorner: string;
  readonly stateErrors: Readonly<Record<StateErrorCode, string>>;
  readonly searchLimit: string;
  readonly searchLimits: Readonly<Record<"depth" | "nodes" | "time", string>>;
  readonly searchError: string;
  readonly searchTimeout: string;
  readonly sceneLoading: string;
  readonly sceneFailed: string;
  readonly controlsTitle: string;
  readonly angleLabel: string;
  readonly faceLabel: string;
  readonly faceNames: Readonly<Record<Face, string>>;
  readonly turnOptions: Readonly<Record<Move["turns"], string>>;
  readonly directionHint: string;
  readonly orientationHint: string;
  readonly measurementsTitle: string;
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
  readonly sceneUnavailable: string;
}

export const messages = {
  en: {
    documentTitle: "MirrorCube — 2×2 Mirror Cube",
    documentDescription: "A step-by-step guide to solving the 2×2 Mirror Cube. Start by exploring its geometry.",
    languageLabel: "Interface language",
    heroTitle: "A different shape of puzzle.",
    intro: "The same finish. Eight different shapes. Turn one layer at a time and watch your Mirror Cube change shape.",
    overviewLabel: "Puzzle and turn controls",
    readyToTurn: "Ready to turn",
    turning: "Turning",
    undoing: "Undoing",
    scramble: "Scramble",
    scrambling: "Scrambling",
    scrambleHint: "Apply a random turn sequence to the current state without resetting the cube or history. Wait for the sequence to finish; then each turn can be undone.",
    historyTitle: "Move history",
    historyCount: "Recorded moves",
    historyEmpty: "No recorded moves. Complete a turn to add it here.",
    historyHint: "Latest first. Undo removes the last move after its inverse turn finishes. R′ means counterclockwise; R2 means a half-turn.",
    undoLastMove: "Undo last move",
    solutionTitle: "Solution",
    findSolution: "Find solution",
    cancelSearch: "Cancel search",
    searchHint: "Search from the current state without using move history. Turns are paused during search; the first search also prepares lookup tables.",
    searchIdle: "Ready to search once the 3D view is ready and all turns have finished.",
    searchRunning: "Finding a solution… You can cancel without changing the cube.",
    searching: "Finding solution",
    searchCancelled: "Search cancelled. The cube and history are unchanged.",
    searchSolved: "The cube is already solved. No moves are needed.",
    solutionCount: "Total solution moves",
    solutionMoves: "Solution moves in execution order",
    solutionHint: "Execute one step at a time. Completed steps enter history. A manual turn, undo, scramble, or new search clears this plan. A half-turn counts as one move.",
    nextSolutionStep: "Execute next step",
    solutionStep: "Solution step",
    solutionProgress: "Completed steps",
    solutionComplete: "Solution complete. The cube is solved.",
    playbackFailed: "Playback stopped: this solution does not match the current state. Find a new solution.",
    playbackOrientation: "Keep U on top, F toward you, and R on your right throughout the solution. In this view, F is the left visible side and R the right. View clockwise directly from the named face, including L, D, and B facing away from the camera.",
    stepInProgress: "Executing this step… Wait for the turn to finish.",
    stepCompleted: "Completed",
    stepCurrent: "Current step",
    searchInvalid: "Invalid puzzle state.",
    invalidCorner: "Corner entry",
    stateErrors: {
      structure: "The state data is incomplete or malformed.",
      "corner-count": "The state must contain exactly eight pieces.",
      "piece-id": "A piece identity is unknown.",
      "duplicate-piece": "A piece identity is repeated.",
      slot: "A piece position is invalid.",
      "duplicate-slot": "More than one piece occupies the same position.",
      orientation: "A piece orientation is not a proper face-aligned rotation.",
      pose: "A piece position and orientation disagree.",
      "twist-sum": "The corner twists cannot be reached with legal turns.",
    },
    searchLimit: "Search stopped before finding a solution. This does not mean the state is unsolvable.",
    searchLimits: { depth: "Move-depth limit reached.", nodes: "Search-node limit reached.", time: "Search-time limit reached." },
    searchError: "Could not run the solver. Try again. Manual turns are still available.",
    searchTimeout: "The solver did not respond in time. Try again. The cube and history are unchanged.",
    sceneLoading: "Loading 3D view…",
    sceneFailed: "3D view unavailable",
    controlsTitle: "Make a turn",
    angleLabel: "1. Choose direction and angle",
    faceLabel: "2. Choose a face to turn",
    faceNames: { U: "Top", D: "Bottom", L: "Left", R: "Right", F: "Front", B: "Back" },
    turnOptions: { 1: "90° clockwise", [-1]: "90° counterclockwise", 2: "180° half-turn" },
    directionHint: "Clockwise is viewed directly from the selected face, not from the camera. New turns are blocked while a layer is moving.",
    orientationHint: "Keep U on top, F toward you, and R on your right. In this view, F is the left visible side and R the right. L, D, and B face away from the camera.",
    measurementsTitle: "Dimensions when solved",
    viewLabel: "Fixed isometric view",
    caption: "During a turn, four pieces are highlighted in amber. Each piece keeps its own dimensions.",
    geometryEyebrow: "Meet the geometry",
    geometryTitle: "One cube. Eight distinct pieces.",
    geometryDescription: "Unlike a color-based cube, a Mirror Cube is solved by shape. All outer surfaces line up when the pieces are in place.",
    cubeEdge: "Cube edge",
    axisLayers: { x: "X layers", y: "Y layers", z: "Z layers" },
    millimeters: "mm",
    stageNote: "Manual turns, scrambling, history, animated undo, solution search, and step-by-step playback are available. Photo input is not available yet. Reloading resets the puzzle, history, and solution progress.",
    cubeTitle: "2×2 Mirror Cube",
    cubeDescription: "A fixed 3D isometric view of the puzzle. During a turn, four highlighted pieces rotate together; the other four remain still.",
    sceneUnavailable: "The 3D view is unavailable. Check WebGL 2 support and reload the page. Turn controls are disabled; completed turns are kept, and unfinished or queued turns are not applied.",
  },
  uk: {
    documentTitle: "MirrorCube — дзеркальний кубик 2×2",
    documentDescription: "Покрокова інструкція зі складання дзеркального кубика 2×2. Почніть зі знайомства з його геометрією.",
    languageLabel: "Мова інтерфейсу",
    heroTitle: "Головоломка, де головне — форма.",
    intro: "Однакове покриття. Вісім різних форм. Обертайте по одному шару й спостерігайте, як дзеркальний кубик змінює форму.",
    overviewLabel: "Кубик і керування поворотами",
    readyToTurn: "Готовий до повороту",
    turning: "Поворот",
    undoing: "Скасування",
    scramble: "Перемішати",
    scrambling: "Перемішування",
    scrambleHint: "Виконати випадкову послідовність поворотів від поточного стану без скидання кубика чи історії. Дочекайтеся завершення послідовності; після цього кожен хід можна скасувати.",
    historyTitle: "Історія ходів",
    historyCount: "Записані ходи",
    historyEmpty: "Записаних ходів немає. Завершіть поворот, щоб додати його сюди.",
    historyHint: "Новіші ходи зверху. Запис зникає після завершення зворотного повороту. R′ означає проти годинникової, R2 — півоберту.",
    undoLastMove: "Скасувати останній хід",
    solutionTitle: "Розв’язок",
    findSolution: "Знайти розв’язок",
    cancelSearch: "Скасувати пошук",
    searchHint: "Пошук від поточного стану без використання історії ходів. Під час пошуку повороти заблоковані; перший пошук також готує таблиці переходів.",
    searchIdle: "Пошук доступний після завантаження 3D-вигляду та завершення всіх поворотів.",
    searchRunning: "Шукаємо розв’язок… Пошук можна скасувати без зміни кубика.",
    searching: "Пошук розв’язку",
    searchCancelled: "Пошук скасовано. Кубик та історія не змінилися.",
    searchSolved: "Кубик уже складений. Ходи не потрібні.",
    solutionCount: "Усього ходів розв’язку",
    solutionMoves: "Ходи розв’язку в порядку виконання",
    solutionHint: "Виконуйте по одному кроку. Завершені кроки потрапляють до історії. Ручний поворот, скасування ходу, перемішування чи новий пошук очищує цей план. Півоберту рахується як один хід.",
    nextSolutionStep: "Виконати наступний крок",
    solutionStep: "Крок розв’язку",
    solutionProgress: "Завершено кроків",
    solutionComplete: "Розв’язок виконано. Кубик складений.",
    playbackFailed: "Відтворення зупинено: цей розв’язок не відповідає поточному стану. Знайдіть новий розв’язок.",
    playbackOrientation: "Протягом розв’язку тримайте U зверху, F до себе, а R праворуч. На зображенні F — ліва видима сторона, R — права. Напрямок за годинниковою визначайте, дивлячись прямо на названу грань, зокрема на L, D і B, спрямовані від камери.",
    stepInProgress: "Виконуємо цей крок… Дочекайтеся завершення повороту.",
    stepCompleted: "Завершено",
    stepCurrent: "Поточний крок",
    searchInvalid: "Некоректний стан кубика.",
    invalidCorner: "Запис деталі",
    stateErrors: {
      structure: "Дані стану неповні або мають неправильну структуру.",
      "corner-count": "Стан має містити рівно вісім деталей.",
      "piece-id": "Ідентифікатор деталі невідомий.",
      "duplicate-piece": "Ідентифікатор деталі повторюється.",
      slot: "Положення деталі некоректне.",
      "duplicate-slot": "Кілька деталей займають одне положення.",
      orientation: "Орієнтація деталі не є допустимим поворотом уздовж осей граней.",
      pose: "Положення та орієнтація деталі не узгоджуються.",
      "twist-sum": "Такого скручування кутів неможливо досягти допустимими поворотами.",
    },
    searchLimit: "Пошук зупинився до знаходження розв’язку. Це не означає, що стан неможливо скласти.",
    searchLimits: { depth: "Досягнуто ліміту глибини ходів.", nodes: "Досягнуто ліміту вузлів пошуку.", time: "Досягнуто ліміту часу пошуку." },
    searchError: "Не вдалося виконати пошук. Спробуйте ще раз. Ручні повороти залишаються доступними.",
    searchTimeout: "Пошук не відповів вчасно. Спробуйте ще раз. Кубик та історія не змінилися.",
    sceneLoading: "Завантаження 3D-вигляду…",
    sceneFailed: "3D-вигляд недоступний",
    controlsTitle: "Виконайте поворот",
    angleLabel: "1. Оберіть напрямок і кут",
    faceLabel: "2. Оберіть грань для повороту",
    faceNames: { U: "Верхня", D: "Нижня", L: "Ліва", R: "Права", F: "Передня", B: "Задня" },
    turnOptions: { 1: "90° за годинниковою", [-1]: "90° проти годинникової", 2: "180° — півоберту" },
    directionHint: "Напрямок визначаємо, дивлячись прямо на обрану грань, а не з боку камери. Поки шар рухається, нові повороти заблоковані.",
    orientationHint: "Тримайте U зверху, F до себе, а R праворуч. На зображенні F — ліва видима сторона, R — права. Грані L, D і B спрямовані від камери.",
    measurementsTitle: "Розміри у складеному стані",
    viewLabel: "Фіксований ізометричний вигляд",
    caption: "Під час повороту чотири деталі підсвічені бурштиновим кольором. Кожна деталь зберігає власні розміри.",
    geometryEyebrow: "Знайомство з геометрією",
    geometryTitle: "Один кубик. Вісім різних деталей.",
    geometryDescription: "На відміну від кольорового кубика, дзеркальний складають за формою. Коли деталі на своїх місцях, усі зовнішні поверхні розташовані врівень.",
    cubeEdge: "Ребро кубика",
    axisLayers: { x: "Шари по X", y: "Шари по Y", z: "Шари по Z" },
    millimeters: "мм",
    stageNote: "Доступні ручні повороти, перемішування, історія, анімоване скасування, пошук розв’язку та покрокове відтворення. Введення з фото ще недоступне. Перезавантаження скидає кубик, історію та прогрес розв’язку.",
    cubeTitle: "Дзеркальний кубик 2×2",
    cubeDescription: "Фіксований об’ємний ізометричний вигляд кубика. Під час повороту чотири підсвічені деталі обертаються разом, а решта чотири залишаються нерухомими.",
    sceneUnavailable: "Об’ємне відображення недоступне. Перевірте підтримку WebGL 2 та перезавантажте сторінку. Кнопки поворотів заблоковані; завершені ходи збережено, а незавершені й заплановані — не застосовано.",
  },
} as const satisfies Record<Language, Messages>;
