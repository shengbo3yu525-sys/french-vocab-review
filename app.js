const FSRS_API = window.FSRS;
const Rating = FSRS_API.Rating;

const DB_NAME = "french-a1-review";
const DB_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_SETTINGS = {
  newLimit: 20,
  retention: 0.9,
  voiceName: "",
  unitFilter: "all",
};

const MODE_LABELS = {
  mixed: "综合练习",
  "fr-zh": "法译中填空",
  "zh-fr": "中译法",
  listen: "听写",
  ipa: "看音标",
  gender: "阴阳性 / 冠词",
  pos: "词性",
};

const ALL_MODES = ["zh-fr", "listen"];

const POS_LABELS = {
  "n.m.": "阳性名词",
  "n.f.": "阴性名词",
  "n.m.pl.": "阳性复数名词",
  "n.f.pl.": "阴性复数名词",
  "n.inv.m.": "不变阳性名词",
  "v.t.": "及物动词",
  "v.i.": "不及物动词",
  "v.t.ind.": "间接及物动词",
  "v.t.dir.": "直接及物动词",
  "v.pr.": "反身动词",
  "v.pron.": "反身动词",
  "v.impers.": "无人称动词",
  "adv.": "副词",
  "adv.interr.": "疑问副词",
  "adj.": "形容词",
  "adj.m.": "阳性形容词",
  "adj.f.": "阴性形容词",
  "prep.": "介词",
  "conj.": "连词",
  "pron.": "代词",
  "pron.pers.": "人称代词",
  "pron.pres.": "人称代词",
  "pron.indef.": "不定代词",
  "pron.interr.": "疑问代词",
  "interj.": "感叹词",
  "adj.interr.m.": "阳性疑问形容词",
  "adj.interr.f.": "阴性疑问形容词",
  "adj.exclam.m.": "阳性感叹形容词",
  "adj.exclam.f.": "阴性感叹形容词",
  "adj.num.ord.": "序数形容词",
  "loc.": "固定短语",
  "loc.adv.": "副词短语",
  "loc.prep.": "介词短语",
  "loc.adj.": "形容词短语",
  "prés.": "展示词",
  "n.": "名词",
  "det.": "限定词",
  "indef.pl.": "不定复数",
};

const el = (id) => document.getElementById(id);
const ui = {
  dashboard: el("dashboard-screen"),
  study: el("study-screen"),
  title: el("screen-title"),
  settingsButton: el("settings-button"),
  due: el("due-count"),
  pendingCount: el("new-count"),
  seen: el("seen-count"),
  accuracy: el("accuracy-count"),
  resumePanel: el("resume-panel"),
  resumeCopy: el("resume-copy"),
  resumeButton: el("resume-button"),
  startButton: el("start-button"),
  wrongButton: el("wrong-button"),
  randomButton: el("random-button"),
  errorButton: el("error-button"),
  unitFilter: el("unit-filter"),
  errorTypeFilter: el("error-type-filter"),
  todayCompleted: el("today-completed"),
  posStats: el("pos-stats"),
  modeStats: el("mode-stats"),
  previousButton: el("previous-button"),
  pauseButton: el("pause-button"),
  endButton: el("end-button"),
  sessionMode: el("session-mode"),
  sessionPosition: el("session-position"),
  progressFill: el("progress-fill"),
  progressMarker: el("progress-marker"),
  unitBadge: el("unit-badge"),
  levelBadge: el("level-badge"),
  direction: el("question-direction"),
  questionText: el("question-text"),
  hint: el("question-hint"),
  speakButton: el("speak-button"),
  options: el("options"),
  typingForm: el("typing-form"),
  meaningField: el("meaning-field"),
  meaningInput: el("meaning-input"),
  posSelector: el("pos-selector"),
  posOptions: el("pos-options"),
  genderTestGroup: el("gender-test-group"),
  genderTestOptions: el("gender-test-options"),
  answerInput: el("answer-input"),
  revealButton: el("reveal-button"),
  answerPanel: el("answer-panel"),
  feedback: el("feedback"),
  overrideCorrectButton: el("override-correct-button"),
  answerWord: el("answer-word"),
  answerIpa: el("answer-ipa"),
  answerChinese: el("answer-chinese"),
  answerPos: el("answer-pos"),
  answerSpeakButton: el("answer-speak-button"),
  historyNav: el("history-nav"),
  historyOlder: el("history-older"),
  historyNewer: el("history-newer"),
  historyReturn: el("history-return"),
  historyPosition: el("history-position"),
  ratingPanel: el("rating-panel"),
  settingsDialog: el("settings-dialog"),
  summaryDialog: el("summary-dialog"),
  newLimit: el("new-limit-select"),
  retention: el("retention-select"),
  voice: el("voice-select"),
  installButton: el("install-button"),
  exportButton: el("export-button"),
  importButton: el("import-button"),
  importFile: el("import-file"),
  resetButton: el("reset-button"),
  summaryAnswered: el("summary-answered"),
  summaryCorrect: el("summary-correct"),
  summaryCopy: el("summary-copy"),
  summaryClose: el("summary-close"),
  toast: el("toast"),
};

const app = {
  cards: [],
  byId: new Map(),
  progress: new Map(),
  settings: { ...DEFAULT_SETTINGS },
  session: null,
  scheduler: null,
  question: null,
  deferredInstallPrompt: null,
  db: null,
  toastTimer: null,
  historyIndex: null,
  touchStart: null,
  draftTimer: null,
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("progress")) {
        db.createObjectStore("progress", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbRequest(storeName, mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = app.db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putProgress(record) {
  app.progress.set(record.id, record);
  await dbRequest("progress", "readwrite", (store) => store.put(record));
}

async function saveMeta(key, value) {
  await dbRequest("meta", "readwrite", (store) => store.put({ key, value }));
}

async function loadState() {
  app.db = await openDatabase();
  const response = await fetch("./data/vocab.json");
  if (!response.ok) {
    throw new Error("词表加载失败");
  }
  const data = await response.json();
  app.cards = data.cards;
  app.byId = new Map(app.cards.map((card) => [card.id, card]));

  const progressRows = await dbRequest("progress", "readonly", (store) =>
    store.getAll(),
  );
  for (const row of progressRows) {
    app.progress.set(row.id, hydrateProgress(row));
  }

  const settingsRow = await dbRequest("meta", "readonly", (store) =>
    store.get("settings"),
  );
  app.settings = { ...DEFAULT_SETTINGS, ...(settingsRow?.value || {}) };

  const sessionRow = await dbRequest("meta", "readonly", (store) =>
    store.get("session"),
  );
  app.session = sessionRow?.value
    ? {
        requeued: [],
        currentMode: null,
        currentOptions: null,
        history: [],
        draft: null,
        ...sessionRow.value,
        mode: "mixed",
      }
    : null;
  createScheduler();
}

function hydrateProgress(row) {
  if (!row?.fsrsCard) return row;
  return {
    ...row,
    fsrsCard: {
      ...row.fsrsCard,
      due: new Date(row.fsrsCard.due),
      last_review: row.fsrsCard.last_review
        ? new Date(row.fsrsCard.last_review)
        : undefined,
    },
    reviews: (row.reviews || []).map((review) => ({
      ...review,
      at: new Date(review.at),
    })),
  };
}

function createScheduler() {
  app.scheduler = FSRS_API.fsrs({
    request_retention: Number(app.settings.retention) || 0.9,
    maximum_interval: 3650,
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: ["1m", "10m"],
    relearning_steps: ["10m"],
  });
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function seededShuffle(items, seedText) {
  const copy = [...items];
  let seed = hashString(seedText) || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const other = seed % (index + 1);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function localDayKey(date) {
  return todayKey(new Date(date));
}

function dueIds(now = new Date()) {
  return [...app.progress.values()]
    .filter((row) => row.fsrsCard && new Date(row.fsrsCard.due) <= now)
    .filter((row) => {
      const card = app.byId.get(row.id);
      return (
        card &&
        (app.settings.unitFilter === "all" ||
          card.unit === app.settings.unitFilter)
      );
    })
    .sort((a, b) => new Date(a.fsrsCard.due) - new Date(b.fsrsCard.due))
    .map((row) => row.id);
}

function pendingCards() {
  return app.cards.filter(
    (card) =>
      !app.progress.has(card.id) &&
      (app.settings.unitFilter === "all" ||
        card.unit === app.settings.unitFilter),
  );
}

function familiesAnsweredToday() {
  const today = todayKey();
  return new Set(
    [...app.progress.values()]
      .filter((row) => row.lastAnswered && localDayKey(row.lastAnswered) === today)
      .map((row) => app.byId.get(row.id)?.family)
      .filter(Boolean),
  );
}

function oneCardPerFamily(
  ids,
  limit = Infinity,
  { preferUnseen = false } = {},
) {
  const blocked = familiesAnsweredToday();
  const chosen = new Set();
  const output = [];
  for (const id of ids) {
    const card = app.byId.get(id);
    if (!card || blocked.has(card.family) || chosen.has(card.family)) continue;
    chosen.add(card.family);
    const representativeId =
      (preferUnseen &&
        ids.find((candidateId) => {
          const candidate = app.byId.get(candidateId);
          return (
            candidate?.family === card.family &&
            !app.progress.has(candidateId)
          );
        })) ||
      id;
    output.push(representativeId);
    if (output.length >= limit) break;
  }
  return output;
}

function sessionIsActive() {
  return Boolean(
    app.session &&
      Array.isArray(app.session.queue) &&
      app.session.position < app.session.queue.length,
  );
}

function updateDashboard() {
  const now = new Date();
  const due = dueIds(now).length;
  const unseen = pendingCards().length;
  const attempts = [...app.progress.values()].reduce(
    (sum, row) => sum + (row.attempts || 0),
    0,
  );
  const correct = [...app.progress.values()].reduce(
    (sum, row) => sum + (row.correct || 0),
    0,
  );
  ui.due.textContent = String(due);
  ui.pendingCount.textContent = String(unseen);
  ui.seen.textContent = String(app.progress.size);
  ui.accuracy.textContent = attempts ? `${Math.round((correct / attempts) * 100)}%` : "—";

  if (sessionIsActive()) {
    const remaining = app.session.queue.length - app.session.position;
    ui.resumePanel.classList.remove("hidden");
    ui.resumeCopy.textContent = `还剩 ${remaining} 张`;
  } else {
    ui.resumePanel.classList.add("hidden");
  }
  renderAnalytics();
}

function showDashboard() {
  app.question = null;
  app.historyIndex = null;
  ui.study.classList.add("hidden");
  ui.dashboard.classList.remove("hidden");
  ui.title.textContent = "词汇复习";
  updateDashboard();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function allReviewEntries() {
  return [...app.progress.values()].flatMap((row) => {
    const card = app.byId.get(row.id);
    return (row.reviews || []).map((review) => ({ ...review, card }));
  });
}

function ratio(count, total) {
  return total ? `${Math.round((count / total) * 100)}%` : "—";
}

function renderMetricRows(container, rows) {
  container.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("span");
    empty.textContent = "暂无数据";
    container.append(empty);
    return;
  }
  for (const [label, correct, total] of rows) {
    const row = document.createElement("div");
    row.className = "metric-row";
    const name = document.createElement("span");
    name.textContent = label;
    const value = document.createElement("strong");
    value.textContent = `${ratio(correct, total)} (${total})`;
    row.append(name, value);
    container.append(row);
  }
}

function renderAnalytics() {
  const reviews = allReviewEntries();
  const today = todayKey();
  ui.todayCompleted.textContent = String(
    reviews.filter((review) => localDayKey(review.at) === today).length,
  );

  const modeMap = new Map();
  for (const review of reviews) {
    const key = review.mode || "unknown";
    const current = modeMap.get(key) || { correct: 0, total: 0 };
    current.total += 1;
    if (review.correct) current.correct += 1;
    modeMap.set(key, current);
  }
  renderMetricRows(
    ui.modeStats,
    [...modeMap.entries()]
      .map(([mode, stats]) => [
        MODE_LABELS[mode] || mode,
        stats.correct,
        stats.total,
      ])
      .sort((a, b) => b[2] - a[2]),
  );

  const posMap = new Map();
  for (const review of reviews) {
    for (const pos of review.card?.partOfSpeechKinds || []) {
      const current = posMap.get(pos) || { correct: 0, total: 0 };
      current.total += 1;
      if (review.correct) current.correct += 1;
      posMap.set(pos, current);
    }
  }
  renderMetricRows(
    ui.posStats,
    [...posMap.entries()]
      .map(([pos, stats]) => [pos, stats.correct, stats.total])
      .sort((a, b) => b[2] - a[2]),
  );
}

function modeAccuracy() {
  const map = new Map();
  for (const review of allReviewEntries()) {
    const current = map.get(review.mode) || { correct: 0, total: 0 };
    current.total += 1;
    if (review.correct) current.correct += 1;
    map.set(review.mode, current);
  }
  return map;
}

function weightedMixedMode(card, seed) {
  const modes = ALL_MODES.filter((mode) => supportedMode(card, mode));
  const stats = modeAccuracy();
  const baseWeights = {
    "zh-fr": 1.5,
    listen: 1,
  };
  const weights = modes.map((mode) => {
    const info = stats.get(mode);
    if (!info || info.total < 2) return baseWeights[mode] || 1;
    const accuracy = info.correct / info.total;
    return (baseWeights[mode] || 1) * (1 + Math.max(0, 1 - accuracy) * 1.6);
  });
  let point = hashString(`${card.id}:${seed}:weighted`) % Math.max(1, Math.round(weights.reduce((a, b) => a + b, 0) * 100));
  for (let index = 0; index < modes.length; index += 1) {
    const width = Math.round(weights[index] * 100);
    if (point < width) return modes[index];
    point -= width;
  }
  return modes[modes.length - 1];
}

function chooseMixedMode(card, seed) {
  return weightedMixedMode(card, seed);
}

async function startSession(kind) {
  if (sessionIsActive()) {
    showToast("已恢复未完成的复习。");
    await renderCurrentQuestion();
    return;
  }
  const now = new Date();
  let ids = [];
  const limit = Number(app.settings.newLimit);

  if (kind === "wrong") {
    const candidates = [...app.progress.values()]
      .filter((row) => row.wrongCount > 0)
      .filter((row) => {
        const card = app.byId.get(row.id);
        return (
          card &&
          (app.settings.unitFilter === "all" ||
            card.unit === app.settings.unitFilter)
        );
      })
      .sort((a, b) => b.wrongCount - a.wrongCount)
      .map((row) => row.id);
    ids = oneCardPerFamily(candidates, 40);
  } else if (kind === "error") {
    const errorType = ui.errorTypeFilter.value;
    const candidates = [...app.progress.values()]
      .filter(
        (row) =>
          row.lastErrorType === errorType ||
          (row.errorCounts?.[errorType] || 0) > 0,
      )
      .filter((row) => {
        const card = app.byId.get(row.id);
        return (
          card &&
          (app.settings.unitFilter === "all" ||
            card.unit === app.settings.unitFilter)
        );
      })
      .sort(
        (a, b) =>
          (b.errorCounts?.[errorType] || 0) -
          (a.errorCounts?.[errorType] || 0),
      )
      .map((row) => row.id);
    ids = oneCardPerFamily(candidates, 40);
  } else if (kind === "random") {
    const candidates = seededShuffle(
      app.cards.filter(
        (card) =>
          app.settings.unitFilter === "all" ||
          card.unit === app.settings.unitFilter,
      ),
      String(now.getTime()),
    ).map((card) => card.id);
    ids = oneCardPerFamily(candidates, 30);
  } else {
    const due = dueIds(now);
    const unseen = pendingCards().map((card) => card.id);
    ids = oneCardPerFamily([...due, ...unseen], limit, {
      preferUnseen: true,
    });
  }

  if (!ids.length) {
    showToast("今天没有到期卡片，可以先随机复习。");
    return;
  }

  app.session = {
    id: createId(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    day: todayKey(now),
    kind,
    mode: "mixed",
    queue: ids,
    position: 0,
    answered: 0,
    correct: 0,
    currentMode: null,
    currentOptions: null,
    result: null,
    requeued: [],
    history: [],
    draft: null,
  };
  await saveMeta("session", app.session);
  await renderCurrentQuestion();
}

async function renderCurrentQuestion() {
  if (!sessionIsActive()) {
    await finishSession();
    return;
  }
  const cardId = app.session.queue[app.session.position];
  const card = app.byId.get(cardId);
  if (!card) {
    app.session.position += 1;
    await saveMeta("session", app.session);
    return renderCurrentQuestion();
  }
  if (familiesAnsweredToday().has(card.family)) {
    app.session.position += 1;
    await saveMeta("session", app.session);
    return renderCurrentQuestion();
  }

  app.question = {
    card,
    mode:
      app.session.currentMode || chooseMixedMode(card, app.session.position),
    options: app.session.currentOptions,
    selectedPos: [],
    selectedGenders: {},
    answered: false,
    result: null,
    errorType: null,
  };
  if (!supportedMode(card, app.session.currentMode)) {
    app.session.currentMode = null;
    app.session.currentOptions = null;
    app.question.mode = chooseMixedMode(card, app.session.position);
  }
  app.session.currentMode = app.question.mode;
  app.session.result = null;

  if (!supportedMode(card, app.question.mode)) {
    app.question.mode = chooseMixedMode(card, app.session.position + 17);
    app.session.currentMode = app.question.mode;
    app.session.currentOptions = null;
  }

  await saveMeta("session", app.session);
  renderQuestion();
}

function supportedMode(card, mode) {
  if (!ALL_MODES.includes(mode)) return false;
  if (mode === "ipa") return Boolean(card.ipa);
  return true;
}

function renderQuestion() {
  const { card, mode } = app.question;
  app.historyIndex = null;
  ui.dashboard.classList.add("hidden");
  ui.study.classList.remove("hidden");
  ui.title.textContent = MODE_LABELS[mode] || "综合练习";
  ui.sessionMode.textContent = MODE_LABELS[app.session.mode] || "综合练习";
  ui.sessionPosition.textContent = `STOP ${app.session.position + 1} / ${app.session.queue.length}`;
  const progress = (app.session.position / app.session.queue.length) * 100;
  ui.progressFill.style.width = `${progress}%`;
  ui.progressMarker.style.left = `${progress}%`;
  ui.unitBadge.textContent = card.unit || "A1";
  ui.levelBadge.textContent =
    mode === "mixed" ? "混合考察" : `本轮：${MODE_LABELS[mode]}`;
  ui.answerPanel.classList.add("hidden");
  ui.ratingPanel.classList.add("hidden");
  ui.historyNav.classList.add("hidden");
  ui.previousButton.disabled = !(app.session.history || []).length;
  ui.previousButton.textContent =
    (app.session.history || []).length > 0 ? "返回上一题" : "没有上一题";
  ui.overrideCorrectButton.classList.add("hidden");
  ui.revealButton.classList.remove("hidden");
  ui.options.classList.add("hidden");
  ui.typingForm.classList.add("hidden");
  ui.posSelector.classList.add("hidden");
  ui.posOptions.innerHTML = "";
  ui.genderTestGroup.classList.add("hidden");
  ui.genderTestOptions.innerHTML = "";
  ui.speakButton.classList.add("hidden");
  ui.answerSpeakButton.classList.add("hidden");
  ui.options.innerHTML = "";
  ui.meaningField.classList.add("hidden");
  ui.meaningInput.value = "";
  ui.answerInput.value = "";
  ui.answerInput.placeholder = "";
  ui.answerInput.inputMode = "text";
  ui.feedback.className = "feedback";

  if (mode === "zh-fr") {
    ui.direction.textContent = "写出对应的法语";
    ui.questionText.textContent = card.chinese;
    ui.hint.textContent = `${answerFormatHint(card)}；下方请选择全部适用词性。`;
    ui.answerInput.placeholder = "";
    ui.typingForm.classList.remove("hidden");
    renderPosSelector(card);
    requestAnimationFrame(() => ui.answerInput.focus({ preventScroll: true }));
  } else if (mode === "listen") {
    ui.direction.textContent = "听发音，写出法语单词";
    ui.questionText.textContent = "Écoutez";
    ui.hint.textContent = `填写中文释义和法语答案；${answerFormatHint(card)}。`;
    ui.meaningField.classList.remove("hidden");
    ui.speakButton.classList.remove("hidden");
    ui.typingForm.classList.remove("hidden");
    ui.answerInput.placeholder = "";
    renderPosSelector(card);
    requestAnimationFrame(() =>
      ui.meaningInput.focus({ preventScroll: true }),
    );
    setTimeout(() => speak(displayWord(card)), 180);
  } else if (mode === "ipa") {
    ui.direction.textContent = "根据音标写出法语单词";
    ui.questionText.textContent = card.ipa || "—";
    ui.hint.textContent = "写出完整单词；名词必须带冠词。";
    ui.answerInput.placeholder = "";
    ui.typingForm.classList.remove("hidden");
    renderPosSelector(card);
  }
  restoreDraft(card, mode);
}

function restoreDraft(card, mode) {
  const draft = app.session?.draft;
  if (!draft || draft.cardId !== card.id || draft.mode !== mode) return;
  ui.meaningInput.value = draft.meaning || "";
  ui.answerInput.value = draft.input || "";
  app.question.selectedPos = [...(draft.selectedPos || [])];
  app.question.selectedGenders = { ...(draft.selectedGenders || {}) };
  for (const chip of ui.posOptions.querySelectorAll(".pos-chip")) {
    const selected = app.question.selectedPos.includes(chip.dataset.pos);
    chip.classList.toggle("selected", selected);
    chip.setAttribute("aria-pressed", String(selected));
  }
  renderGenderSelector(card);
  for (const chip of ui.genderTestOptions.querySelectorAll(".pos-chip")) {
    const selected =
      app.question.selectedGenders[chip.dataset.genderKind] ===
      chip.dataset.gender;
    chip.classList.toggle("selected", selected);
    chip.setAttribute("aria-pressed", String(selected));
  }
}

function saveDraftNow() {
  if (!app.session || !app.question || app.question.historyView) return;
  app.session.draft = {
    cardId: app.question.card.id,
    mode: app.question.mode,
    meaning: ui.meaningInput.value,
    input: ui.answerInput.value,
    selectedPos: [...(app.question.selectedPos || [])],
    selectedGenders: { ...(app.question.selectedGenders || {}) },
  };
  saveMeta("session", app.session).catch(() => {});
}

function scheduleDraftSave() {
  clearTimeout(app.draftTimer);
  app.draftTimer = setTimeout(saveDraftNow, 250);
}

function historicalPrompt(card, mode) {
  if (mode === "zh-fr") return card.chinese;
  if (mode === "listen") return "Écoutez";
  if (mode === "ipa") return card.ipa || "—";
  if (mode === "gender") return card.lemma;
  return displayWord(card);
}

function showHistory(index) {
  const history = app.session?.history || [];
  if (!history.length) {
    showToast("本轮还没有可返回的题目。");
    return;
  }
  const target = Math.max(0, Math.min(index, history.length - 1));
  const item = history[target];
  const card = app.byId.get(item.cardId);
  if (!card) return;

  app.historyIndex = target;
  app.question = {
    card,
    mode: item.mode,
    selectedPos: [],
    selectedGenders: {},
    answered: true,
    result: item.correct,
    errorType: null,
    historyView: true,
  };

  ui.dashboard.classList.add("hidden");
  ui.study.classList.remove("hidden");
  ui.title.textContent = MODE_LABELS[item.mode] || "历史题目";
  ui.direction.textContent = "历史题目";
  ui.questionText.textContent = historicalPrompt(card, item.mode);
  ui.hint.textContent = formatGrammar(card);
  ui.typingForm.classList.add("hidden");
  ui.options.classList.add("hidden");
  ui.posSelector.classList.add("hidden");
  ui.speakButton.classList.add("hidden");
  ui.revealButton.classList.add("hidden");
  ui.ratingPanel.classList.add("hidden");
  ui.overrideCorrectButton.classList.add("hidden");
  ui.answerPanel.classList.remove("hidden");
  ui.answerSpeakButton.classList.remove("hidden");
  ui.historyNav.classList.remove("hidden");

  ui.feedback.textContent = item.correct ? "当时的判定：正确" : "当时的判定：错误";
  ui.feedback.className = `feedback ${item.correct ? "correct" : "wrong"}`;
  ui.answerWord.textContent = answerFormsText(card);
  ui.answerIpa.textContent = card.ipa || "—";
  ui.answerChinese.textContent = card.chinese;
  const answerArticle = isNoun(card)
    ? splitTypedArticle(displayWord(card)).article
    : "";
  ui.answerPos.textContent = `${formatGrammar(card)}${
    answerArticle ? ` · 冠词：${answerArticle}` : ""
  }`;
  ui.historyPosition.textContent = `${target + 1} / ${history.length} · 上下滑动`;
  ui.historyOlder.disabled = target === 0;
  ui.historyNewer.disabled = target === history.length - 1;
}

async function closeHistory() {
  app.historyIndex = null;
  await renderCurrentQuestion();
}

function formatGrammar(card) {
  const labels =
    card.partOfSpeechKinds?.length > 0
      ? card.partOfSpeechKinds
      : [card.partOfSpeech].filter(Boolean);
  const genders = labels
    .map((kind) => {
      const value = card.genderByKind?.[kind];
      if (!value || value === "unknown") return null;
      const label = { m: "阳性", f: "阴性", same: "阴阳同形" }[value];
      return label ? `${kind}：${label}` : null;
    })
    .filter(Boolean);
  const genderText =
    genders.length === 1 && labels.length === 1
      ? genders[0].split("：").at(-1)
      : genders.join("；") || "不适用";
  return `词性：${labels.join(" / ") || "未标明"} · 阴阳性：${genderText}`;
}

function answerFormatHint(card) {
  if (!isNoun(card)) return "输入法语原词";
  if (requiresArticle(card)) return "名词答案必须带定冠词";
  return "该名词阴阳同形，不需要输入冠词";
}

function genderOptions(card) {
  const options = new Set([card.article || "l'", "le", "la", "les", "un", "une"]);
  return seededShuffle([...options].slice(0, 4), `${card.id}:gender:options`);
}

function posOptions(card) {
  const correct = card.partOfSpeechKinds || [];
  const pool = [
    "名词",
    "动词",
    "形容词",
    "副词",
    "介词",
    "连词",
    "代词",
    "感叹词",
    "固定短语",
    "限定词",
  ].filter((value) => !correct.includes(value));
  const distractors = seededShuffle(pool, `${card.id}:pos-options`).slice(
    0,
    Math.max(0, 6 - correct.length),
  );
  return seededShuffle(
    [...correct, ...distractors],
    `${card.id}:pos-final-options`,
  );
}

function renderPosSelector(card) {
  app.question.selectedPos = [];
  app.question.selectedGenders = {};
  ui.posOptions.innerHTML = "";
  for (const option of posOptions(card)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pos-chip";
    button.dataset.pos = option;
    button.textContent = option;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const selected = new Set(app.question.selectedPos);
      if (selected.has(option)) selected.delete(option);
      else selected.add(option);
      app.question.selectedPos = [...selected];
      button.classList.toggle("selected", selected.has(option));
      button.setAttribute("aria-pressed", String(selected.has(option)));
      renderGenderSelector(card);
      scheduleDraftSave();
    });
    ui.posOptions.append(button);
  }
  renderGenderSelector(card);
  ui.posSelector.classList.remove("hidden");
}

function renderGenderSelector(card) {
  ui.genderTestOptions.innerHTML = "";
  const selectedKinds = app.question.selectedPos.filter((kind) => {
    const gender = card.genderByKind?.[kind];
    return gender && gender !== "unknown";
  });
  if (!selectedKinds.length) {
    ui.genderTestGroup.classList.add("hidden");
    return;
  }
  for (const kind of selectedKinds) {
    const group = document.createElement("div");
    group.className = "gender-row";
    const label = document.createElement("span");
    label.textContent = `${kind}的阴阳性`;
    const options = document.createElement("div");
    options.className = "pos-options";
    const values = ["阳性", "阴性", "阴阳同形"];
    for (const option of values) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pos-chip";
      button.dataset.genderKind = kind;
      button.dataset.gender = option;
      button.textContent = option;
      button.setAttribute(
        "aria-pressed",
        String(app.question.selectedGenders[kind] === option),
      );
      button.classList.toggle(
        "selected",
        app.question.selectedGenders[kind] === option,
      );
      button.addEventListener("click", () => {
        app.question.selectedGenders[kind] = option;
        for (const chip of options.querySelectorAll(".pos-chip")) {
          const selected = chip.dataset.gender === option;
          chip.classList.toggle("selected", selected);
          chip.setAttribute("aria-pressed", String(selected));
        }
        scheduleDraftSave();
      });
      options.append(button);
    }
    group.append(label, options);
    ui.genderTestOptions.append(group);
  }
  ui.genderTestGroup.classList.remove("hidden");
}

function renderChoiceOptions(options) {
  app.question.options = options;
  ui.options.innerHTML = "";
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.textContent =
      app.question.mode === "pos" ? formatPosValue(option) : option;
    button.dataset.value = option;
    button.addEventListener("click", () => checkChoice(option, button));
    ui.options.append(button);
  }
  ui.options.classList.remove("hidden");
}

function formatPosValue(value) {
  return String(value)
    .split(/[；;]/)
    .map((part) => POS_LABELS[part.trim()] || part.trim())
    .join(" / ");
}

function expectedAnswer(card, mode) {
  if (mode === "gender") return card.article;
  if (mode === "pos") return card.partOfSpeech;
  return card.chinese;
}

function checkChoice(selected, button) {
  if (app.question.answered) return;
  const expected = expectedAnswer(app.question.card, app.question.mode);
  const correct = selected === expected;
  app.question.errorType = correct
    ? null
    : app.question.mode === "gender"
      ? "gender"
      : "pos";
  button.classList.add(correct ? "correct" : "wrong");
  if (!correct) {
    for (const optionButton of ui.options.querySelectorAll(".option-button")) {
      if (optionButton.dataset.value === expected) {
        optionButton.classList.add("correct");
      }
    }
  }
  finishAnswer(correct, selected);
}

function normalizedAnswer(value) {
  return String(value)
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/[.,!?;:«»…]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedAnswerCase(value) {
  return String(value)
    .replaceAll("’", "'")
    .replace(/[.,!?;:«»…]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function accentless(value) {
  return normalizedAnswer(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isNoun(card) {
  return (card.partOfSpeechParts || []).some((part) => part.startsWith("n."));
}

function splitTypedArticle(value) {
  const normalized = normalizedAnswerCase(value);
  const spaced = normalized.match(
    /^(de la|de l'|les|le|la|une|un|des|du)\s+(.+)$/i,
  );
  if (spaced) {
    return { article: spaced[1].toLowerCase(), noun: spaced[2].trim() };
  }
  const elided = normalized.match(/^l'\s*(.+)$/i);
  if (elided) {
    return { article: "l'", noun: elided[1].trim() };
  }
  return { article: "", noun: normalized };
}

function acceptedArticles(card) {
  const articles = new Set();
  if (!requiresArticle(card)) return articles;
  if (card.partOfSpeechParts?.some((part) => part.includes(".pl."))) {
    articles.add("les");
  } else if (/^[aeiouyàâäéèêëîïôöùûüœh]/i.test(card.lemma)) {
    articles.add("l'");
  } else if (nounGender(card) === "m") {
    articles.add("le");
  } else if (nounGender(card) === "f") {
    articles.add("la");
  }
  return articles;
}

function nounGender(card) {
  return card.genderByKind?.["名词"] || card.gender || "unknown";
}

function requiresArticle(card) {
  const gender = nounGender(card);
  return (
    isNoun(card) &&
    gender !== "same" &&
    (gender !== "unknown" || Boolean(card.article))
  );
}

function canonicalArticle(card) {
  const articles = acceptedArticles(card);
  return articles.size ? [...articles][0] : "";
}

function displayWord(card) {
  const withArticle = (article) =>
    article === "l'" ? `l'${card.lemma}` : `${article} ${card.lemma}`;
  if (!isNoun(card)) return card.word;
  const article = canonicalArticle(card);
  return article ? withArticle(article) : card.lemma;
}

function checkFrenchAnswer(card, value, { ignoreCase = false } = {}) {
  const alternatives = card.answerAlternatives || [];
  if (alternatives.length) {
    const insensitive = normalizedAnswer(value);
    const sensitive = normalizedAnswerCase(value);
    const normalizedAlternatives = alternatives.map(
      ignoreCase ? normalizedAnswer : normalizedAnswerCase,
    );
    const comparable = ignoreCase ? insensitive : sensitive;
    return {
      correct: normalizedAlternatives.includes(comparable),
      missingArticle: false,
      caseMismatch:
        !ignoreCase &&
        alternatives.map(normalizedAnswer).includes(insensitive) &&
        !normalizedAlternatives.includes(sensitive),
    };
  }
  if (!isNoun(card)) {
    const insensitive = normalizedAnswer(value);
    const sensitive = normalizedAnswerCase(value);
    const expectedSensitive = normalizedAnswerCase(card.answer);
    return {
      correct:
        (ignoreCase ? insensitive : sensitive) ===
          (ignoreCase ? normalizedAnswer(card.answer) : expectedSensitive) ||
        (ignoreCase ? insensitive : sensitive) ===
          (ignoreCase
            ? normalizedAnswer(card.word)
            : normalizedAnswerCase(card.word)),
      missingArticle: false,
      caseMismatch:
        !ignoreCase &&
        insensitive === normalizedAnswer(card.answer) &&
        sensitive !== expectedSensitive,
    };
  }
  const { article, noun } = splitTypedArticle(value);
  if (!article && requiresArticle(card)) {
    return {
      correct: false,
      missingArticle: true,
      caseMismatch: false,
    };
  }
  const insensitiveNoun = normalizedAnswer(noun);
  const sensitiveNoun = normalizedAnswerCase(noun);
  const expectedInsensitive = normalizedAnswer(card.lemma);
  const expectedSensitive = normalizedAnswerCase(card.lemma);
  const nounCorrect =
    (ignoreCase ? insensitiveNoun : sensitiveNoun) ===
      (ignoreCase ? expectedInsensitive : expectedSensitive) ||
    (ignoreCase ? insensitiveNoun : sensitiveNoun) ===
      (ignoreCase
        ? normalizedAnswer(card.answer)
        : normalizedAnswerCase(card.answer));
  const articleCorrect =
    requiresArticle(card)
      ? acceptedArticles(card).has(article)
      : article === "";
  return {
    correct: nounCorrect && articleCorrect,
    missingArticle: false,
    extraArticle: !requiresArticle(card) && Boolean(article),
    nounCorrect,
    articleCorrect,
    caseMismatch:
      !ignoreCase &&
      insensitiveNoun === expectedInsensitive &&
      sensitiveNoun !== expectedSensitive,
  };
}

function answerFormsText(card) {
  return card.answerAlternatives?.length
    ? card.answerAlternatives.join(" / ")
    : displayWord(card);
}

function selectedPosCorrect(card) {
  const expected = new Set(
    card.partOfSpeechKinds || [],
  );
  const selected = new Set(app.question.selectedPos);
  return (
    expected.size === selected.size &&
    [...expected].every((part) => selected.has(part))
  );
}

function selectedGenderCorrect(card) {
  return app.question.selectedPos
    .filter((kind) => card.genderByKind?.[kind])
    .every((kind) => {
      const expected = {
        m: "阳性",
        f: "阴性",
        same: "阴阳同形",
      }[card.genderByKind[kind]];
      return !expected || app.question.selectedGenders[kind] === expected;
    });
}

function chineseAnswerCorrect(card, value) {
  const normalized = normalizedAnswer(value);
  if (!normalized) return false;
  return [card.chinese, ...(card.chineseParts || [])]
    .map(normalizedAnswer)
    .includes(normalized);
}

function checkTyped(event) {
  event?.preventDefault();
  if (app.question.answered) return;
  const card = app.question.card;
  const actual = ui.answerInput.value.trim();
  const meaning = ui.meaningInput.value.trim();

  if (!actual) {
    showToast("请输入法语答案。");
    return;
  }
  if (app.question.mode === "listen" && !meaning) {
    showToast("请输入中文释义。");
    return;
  }

  if (!app.question.selectedPos.length) {
    showToast("请至少选择一个词性。");
    return;
  }
  const missingGender = app.question.selectedPos.some(
    (kind) =>
      card.genderByKind?.[kind] &&
      ["m", "f", "same"].includes(card.genderByKind[kind]) &&
      !app.question.selectedGenders[kind],
  );
  if (missingGender) {
    showToast("请为已选择的词性填写阴阳性。");
    return;
  }

  const ignoreCase = app.question.mode === "listen";
  const answerResult = checkFrenchAnswer(card, actual, { ignoreCase });
  const meaningCorrect =
    app.question.mode === "listen" ? chineseAnswerCorrect(card, meaning) : true;
  const posCorrect = selectedPosCorrect(card);
  const genderCorrect = selectedGenderCorrect(card);
  let message = "";
  if (!meaningCorrect) {
    message = `中文释义需要修改；标准答案：${card.chinese}`;
  } else if (answerResult.missingArticle) {
    message = `名词答案需要带定冠词，例如：${answerFormsText(card)}`;
  } else if (answerResult.extraArticle) {
    message = "该名词阴阳同形，不需要输入冠词。";
  } else if (!answerResult.correct && posCorrect && genderCorrect) {
    message = answerResult.caseMismatch
      ? `拼写正确，但大小写不正确；标准答案：${answerFormsText(card)}`
      : `法语答案需要修改；标准答案：${answerFormsText(card)}`;
  } else if (answerResult.correct && !posCorrect) {
    message = "法语答案正确，但词性选择不完整或不正确。";
  } else if (answerResult.correct && !genderCorrect) {
    message = "法语答案正确，但阴阳性选择不正确。";
  } else if (!answerResult.correct) {
    message = `法语答案、词性或阴阳性需要修改。标准答案：${answerFormsText(card)}`;
  }

  const answerBase = splitTypedArticle(actual).noun;
  const accentOnly =
    !answerResult.correct &&
    answerResult.articleCorrect !== false &&
    accentless(answerBase) === accentless(card.answer) &&
    normalizedAnswer(answerBase) !== normalizedAnswer(card.answer);
  const ignoreCaseNote =
    ignoreCase &&
    answerResult.correct &&
    normalizedAnswerCase(actual) !==
      normalizedAnswerCase(answerFormsText(card)) &&
    (card.answerAlternatives || []).some(
      (answer) =>
        normalizedAnswer(actual) === normalizedAnswer(answer) &&
        normalizedAnswerCase(actual) !== normalizedAnswerCase(answer),
    )
      ? `听力题不扣大小写；正确写法：${answerFormsText(card)}`
      : "";
  app.question.errorType =
    meaningCorrect && answerResult.correct && posCorrect && genderCorrect
      ? null
      : !meaningCorrect
        ? "meaning"
        : answerResult.missingArticle
        ? "article"
        : !answerResult.correct
          ? app.question.mode === "listen"
            ? "listening"
            : app.question.mode === "ipa"
              ? "ipa"
              : "spelling"
          : !posCorrect
            ? "pos"
            : "gender";
  finishAnswer(
    meaningCorrect && answerResult.correct && posCorrect && genderCorrect,
    actual,
    {
    accentOnly,
    message,
      note: ignoreCaseNote,
    },
  );
}

function revealAnswer() {
  if (app.question.answered) return;
  app.question.errorType =
    {
      "zh-fr": "spelling",
      listen: "listening",
      ipa: "ipa",
    }[app.question.mode] || "spelling";
  finishAnswer(false, "", { revealed: true });
}

function finishAnswer(
  correct,
  submitted,
  {
    accentOnly = false,
    revealed = false,
    close = false,
    message = "",
    note = "",
  } = {},
) {
  if (app.question.answered) return;
  const card = app.question.card;
  app.question.answered = true;
  app.question.result = correct;
  app.session.result = correct;

  ui.revealButton.classList.add("hidden");
  ui.typingForm.classList.add("hidden");
  ui.posSelector.classList.add("hidden");
  if (app.question.mode !== "gender") {
    ui.options.classList.add("hidden");
  }

  if (correct) {
    ui.feedback.textContent =
      note ||
      (accentOnly
        ? "拼写正确，注意法语重音符号。"
        : "回答正确。");
    ui.feedback.classList.add("correct");
  } else if (accentOnly) {
    ui.feedback.textContent = `拼写基本正确，但缺少重音符号：${card.answer}`;
    ui.feedback.classList.add("neutral");
  } else if (close) {
    ui.feedback.textContent = `意思接近，标准答案：${card.chinese}`;
    ui.feedback.classList.add("neutral");
  } else if (message) {
    ui.feedback.textContent = message;
    ui.feedback.classList.add("wrong");
  } else if (revealed) {
    ui.feedback.textContent = "先看一遍答案，再选择记忆程度。";
    ui.feedback.classList.add("neutral");
  } else {
    const expected = app.question.mode === "fr-zh" ? card.chinese : card.answer;
    ui.feedback.textContent = submitted
      ? `再记一次：${expected}`
      : "这题先记作“忘了”。";
    ui.feedback.classList.add("wrong");
  }

  ui.answerWord.textContent = answerFormsText(card);
  ui.answerIpa.textContent = card.ipa || "—";
  ui.answerChinese.textContent = card.chinese;
  const answerArticle = isNoun(card)
    ? splitTypedArticle(displayWord(card)).article
    : "";
  ui.answerPos.textContent = `${formatGrammar(card)}${
    answerArticle ? ` · 冠词：${answerArticle}` : ""
  }`;
  ui.answerPanel.classList.remove("hidden");
  ui.overrideCorrectButton.classList.toggle("hidden", correct);
  ui.answerSpeakButton.classList.remove("hidden");

  const fsrsCard = app.progress.get(card.id)?.fsrsCard || FSRS_API.createEmptyCard(new Date());
  const preview = app.scheduler.repeat(fsrsCard, new Date());
  for (const rating of [1, 2, 3, 4]) {
    el(`interval-${rating}`).textContent = formatInterval(
      preview[rating]?.card?.due,
    );
  }
  ui.ratingPanel.classList.remove("hidden");
  ui.ratingPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function overrideAsCorrect() {
  if (!app.question?.answered || app.question.result) return;
  app.question.result = true;
  app.question.errorType = null;
  app.session.result = true;
  ui.feedback.textContent = "已标记为正确。请选择这次的真实记忆程度。";
  ui.feedback.className = "feedback correct";
  ui.overrideCorrectButton.classList.add("hidden");
}

function formatInterval(due) {
  if (!due) return "";
  const milliseconds = Math.max(0, new Date(due).getTime() - Date.now());
  if (milliseconds < 60 * 60 * 1000) {
    return `${Math.max(1, Math.round(milliseconds / 60000))} 分`;
  }
  if (milliseconds < DAY_MS) {
    return `${Math.round(milliseconds / 3600000)} 小时`;
  }
  return `${Math.round(milliseconds / DAY_MS)} 天`;
}

async function rateCard(rating) {
  if (!app.question?.answered) {
    showToast("先检查答案或选择“忘了”，再进行评分。");
    return;
  }
  const card = app.question.card;
  const now = new Date();
  const existing = app.progress.get(card.id);
  const previousCard = existing?.fsrsCard || FSRS_API.createEmptyCard(now);
  const result = app.scheduler.next(previousCard, now, Number(rating));
  const correct = Boolean(app.question.result);
  const isAgain = Number(rating) === Rating.Again;
  const errorType =
    correct || !app.question.errorType ? null : app.question.errorType;
  const errorCounts = { ...(existing?.errorCounts || {}) };
  if (errorType) {
    errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
  }
  const firstSeenDay = existing?.firstSeenDay || todayKey(now);
  const reviews = [
    ...(existing?.reviews || []),
    {
      at: now.toISOString(),
      rating: Number(rating),
      correct,
      mode: app.question.mode,
    },
  ].slice(-60);

  await putProgress({
    id: card.id,
    fsrsCard: result.card,
    firstSeenDay,
    lastAnswered: now.toISOString(),
    lastRating: Number(rating),
    attempts: (existing?.attempts || 0) + 1,
    correct: (existing?.correct || 0) + (correct ? 1 : 0),
    wrongCount: (existing?.wrongCount || 0) + (isAgain || !correct ? 1 : 0),
    errorCounts,
    lastErrorType: errorType || existing?.lastErrorType || null,
    reviews,
  });

  app.session.history.push({
    cardId: card.id,
    mode: app.question.mode,
    correct,
    rating: Number(rating),
    reviewedAt: now.toISOString(),
  });
  app.session.answered += 1;
  app.session.correct += correct ? 1 : 0;
  app.session.position += 1;
  app.session.updatedAt = now.toISOString();
  app.session.currentMode = null;
  app.session.currentOptions = null;
  app.session.result = null;
  app.session.draft = null;

  await saveMeta("session", app.session);
  app.question = null;
  if (app.session.position >= app.session.queue.length) {
    await finishSession();
  } else {
    await renderCurrentQuestion();
  }
}

async function finishSession() {
  if (!app.session) {
    showDashboard();
    return;
  }
  const answered = app.session.answered;
  const correctRate = answered
    ? Math.round((app.session.correct / answered) * 100)
    : 0;
  ui.summaryAnswered.textContent = String(answered);
  ui.summaryCorrect.textContent = `${correctRate}%`;
  ui.summaryCopy.textContent =
    answered > 0
      ? "所有答题记录都已经自动保存。下次打开会从今天的复习计划继续。"
      : "本轮还没有作答。";
  app.session = null;
  await saveMeta("session", null);
  if (ui.summaryDialog.open) ui.summaryDialog.close();
  ui.summaryDialog.showModal();
  updateDashboard();
}

function showToast(message) {
  clearTimeout(app.toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  app.toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2400);
}

function frenchVoices() {
  return window.speechSynthesis
    ?.getVoices()
    .filter((voice) => voice.lang?.toLowerCase().startsWith("fr"));
}

function speak(text) {
  if (!("speechSynthesis" in window) || !text) {
    showToast("这台设备没有可用的语音朗读。");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.82;
  const voices = frenchVoices();
  const selected =
    voices.find((voice) => voice.name === app.settings.voiceName) ||
    voices.find((voice) => /Amélie|Thomas|Audrey|French/i.test(voice.name)) ||
    voices[0];
  if (selected) utterance.voice = selected;
  window.speechSynthesis.speak(utterance);
}

function populateVoices() {
  const voices = frenchVoices();
  ui.voice.innerHTML = '<option value="">系统默认</option>';
  for (const voice of voices) {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} · ${voice.lang}`;
    ui.voice.append(option);
  }
  ui.voice.value = app.settings.voiceName || "";
}

async function saveSettings() {
  app.settings.newLimit = Number(ui.newLimit.value);
  app.settings.retention = Number(ui.retention.value);
  app.settings.voiceName = ui.voice.value;
  await saveMeta("settings", app.settings);
  createScheduler();
  showToast("设置已保存。");
  updateDashboard();
}

async function exportProgress() {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: app.settings,
    progress: [...app.progress.values()],
    session: app.session,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `法语复习备份-${todayKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("备份文件已生成。");
}

async function importProgress(file) {
  const backup = JSON.parse(await file.text());
  if (!backup || !Array.isArray(backup.progress)) {
    throw new Error("备份文件格式不正确");
  }
  for (const row of backup.progress) {
    await putProgress(hydrateProgress(row));
  }
  app.settings = { ...DEFAULT_SETTINGS, ...(backup.settings || {}) };
  await saveMeta("settings", app.settings);
  if (backup.session) {
    app.session = backup.session;
    await saveMeta("session", app.session);
  }
  createScheduler();
  syncSettingsControls();
  updateDashboard();
  showToast("进度已导入。");
}

async function resetProgress() {
  if (!window.confirm("确定清空这台手机上的全部学习进度吗？此操作无法撤销。")) {
    return;
  }
  await dbRequest("progress", "readwrite", (store) => store.clear());
  await saveMeta("session", null);
  app.progress.clear();
  app.session = null;
  updateDashboard();
  showToast("学习进度已清空。");
}

function syncSettingsControls() {
  ui.newLimit.value = String(app.settings.newLimit);
  ui.retention.value = String(app.settings.retention);
  ui.unitFilter.value = app.settings.unitFilter || "all";
  populateVoices();
}

function bindEvents() {
  ui.startButton.addEventListener("click", () => startSession("today"));
  ui.wrongButton.addEventListener("click", () => startSession("wrong"));
  ui.randomButton.addEventListener("click", () => startSession("random"));
  ui.errorButton.addEventListener("click", () => {
    if (ui.errorTypeFilter.value === "all") {
      showToast("请先选择一个错因。");
      return;
    }
    startSession("error");
  });
  ui.unitFilter.addEventListener("change", async () => {
    app.settings.unitFilter = ui.unitFilter.value;
    await saveMeta("settings", app.settings);
    updateDashboard();
  });
  ui.resumeButton.addEventListener("click", renderCurrentQuestion);
  ui.previousButton.addEventListener("click", () => {
    showHistory((app.session?.history || []).length - 1);
  });
  ui.pauseButton.addEventListener("click", () => {
    saveDraftNow();
    showDashboard();
  });
  ui.endButton.addEventListener("click", () => {
    if (
      app.session &&
      window.confirm("结束本轮复习？已经完成的答题记录仍会保留。")
    ) {
      finishSession();
    }
  });
  ui.historyOlder.addEventListener("click", () => {
    if (app.historyIndex !== null) showHistory(app.historyIndex - 1);
  });
  ui.historyNewer.addEventListener("click", () => {
    if (app.historyIndex !== null) showHistory(app.historyIndex + 1);
  });
  ui.historyReturn.addEventListener("click", closeHistory);
  ui.settingsButton.addEventListener("click", () => {
    syncSettingsControls();
    ui.settingsDialog.showModal();
  });
  ui.typingForm.addEventListener("submit", checkTyped);
  ui.answerInput.addEventListener("input", scheduleDraftSave);
  ui.meaningInput.addEventListener("input", scheduleDraftSave);
  ui.revealButton.addEventListener("click", revealAnswer);
  ui.overrideCorrectButton.addEventListener("click", overrideAsCorrect);
  ui.answerSpeakButton.addEventListener("click", () =>
    speak(displayWord(app.question?.card)),
  );
  ui.speakButton.addEventListener("click", () =>
    speak(app.question?.card?.answer),
  );
  for (const button of document.querySelectorAll("[data-rating]")) {
    button.addEventListener("click", () => rateCard(button.dataset.rating));
  }
  ui.newLimit.addEventListener("change", saveSettings);
  ui.retention.addEventListener("change", saveSettings);
  ui.voice.addEventListener("change", saveSettings);
  ui.exportButton.addEventListener("click", exportProgress);
  ui.importButton.addEventListener("click", () => ui.importFile.click());
  ui.importFile.addEventListener("change", async () => {
    const file = ui.importFile.files?.[0];
    if (!file) return;
    try {
      await importProgress(file);
    } catch (error) {
      showToast(error.message || "导入失败");
    } finally {
      ui.importFile.value = "";
    }
  });
  ui.resetButton.addEventListener("click", resetProgress);
  ui.summaryClose.addEventListener("click", () => {
    ui.summaryDialog.close();
    showDashboard();
  });
  ui.summaryDialog.addEventListener("cancel", () => {
    setTimeout(showDashboard, 0);
  });
  window.speechSynthesis?.addEventListener?.("voiceschanged", populateVoices);
  window.addEventListener("keydown", (event) => {
    if (ui.study.classList.contains("hidden")) return;
    if (
      event.target instanceof HTMLElement &&
      (event.target.matches("input, textarea, select") ||
        event.target.isContentEditable)
    ) {
      return;
    }
    if (event.key === " " && !app.question?.answered) {
      event.preventDefault();
      revealAnswer();
    }
    if (app.question?.answered && ["1", "2", "3", "4"].includes(event.key)) {
      rateCard(event.key);
    }
  });
  ui.study.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      app.touchStart = { x: touch.clientX, y: touch.clientY };
    },
    { passive: true },
  );
  ui.study.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch || !app.touchStart) return;
      const deltaX = touch.clientX - app.touchStart.x;
      const deltaY = touch.clientY - app.touchStart.y;
      app.touchStart = null;
      if (Math.abs(deltaY) < 70 || Math.abs(deltaY) <= Math.abs(deltaX)) return;
      if (app.historyIndex !== null) {
        showHistory(app.historyIndex + (deltaY < 0 ? 1 : -1));
      } else if (deltaY > 0 && (app.session?.history || []).length) {
        showHistory((app.session.history || []).length - 1);
      }
    },
    { passive: true },
  );
  window.addEventListener("pagehide", saveDraftNow);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    app.deferredInstallPrompt = event;
    ui.installButton.classList.remove("hidden");
  });
  ui.installButton.addEventListener("click", async () => {
    if (!app.deferredInstallPrompt) return;
    app.deferredInstallPrompt.prompt();
    await app.deferredInstallPrompt.userChoice;
    app.deferredInstallPrompt = null;
    ui.installButton.classList.add("hidden");
  });
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
    navigator.storage?.persist?.().catch(() => {});
  }
}

async function bootstrap() {
  bindEvents();
  try {
    await loadState();
    syncSettingsControls();
    updateDashboard();
    await registerServiceWorker();
    if (sessionIsActive()) {
      await renderCurrentQuestion();
    } else {
      showDashboard();
    }
  } catch (error) {
    console.error(error);
    ui.dashboard.classList.remove("hidden");
    ui.questionText.textContent = "词表加载失败";
    ui.hint.textContent = "请确认 vocab.json 与网页文件在同一站点中。";
    showToast(error.message || "加载失败");
  }
}

bootstrap();
