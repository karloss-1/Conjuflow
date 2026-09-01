"use strict";

/* ---------- Configuration and data ---------- */

const DB_NAME = "mexican-spanish-flashcards-db";
const DB_VERSION = 2;
const PROGRESS_STORE = "cardProgress";
const FILTERS_KEY = "conjuflow-filters-v1";
const TS_FSRS_VERSION = "ts-fsrs@5.4.1";
const MAX_TIMER_DELAY = 2147483647;
const CONTENT = ConjuFlowCore.normalizeContent(window.CONJUGATION_CONTENT);
const CARD_BY_ID = new Map(CONTENT.cards.map(card => [card.card_id, card]));
const TENSES = [
  ["presente_indicativo", "Presente"],
  ["preterito", "Pretérito"],
  ["imperfecto", "Imperfecto"],
  ["futuro", "Futuro"],
  ["condicional", "Condicional"],
  ["presente_subjuntivo", "Presente de subjuntivo"],
  ["imperfecto_subjuntivo", "Imperfecto de subjuntivo"],
  ["imperativo_afirmativo", "Imperativo afirmativo"],
  ["imperativo_negativo", "Imperativo negativo"]
];
const REGULARITY_LABELS = { all: "Todos", regular: "Regulares", irregular: "Irregulares", ortografico: "Cambio ortográfico" };
const ENDING_LABELS = { all: "Todas", ar: "-AR", er: "-ER", ir: "-IR" };
const PRONOMINAL_LABELS = { all: "Todos", no: "No pronominales", "sí": "Pronominales" };

const fsrsScheduler = window.FSRS.fsrs();
const FsrsRating = window.FSRS.Rating;
const FsrsState = window.FSRS.State;

/* ---------- Application state ---------- */

let db;
let progressByCard = new Map();
let session = null;
let currentIndex = 0;
let showingAnswer = false;
let dueTimer = null;

const $ = id => document.getElementById(id);
const elements = {
  toolbar: $("toolbar"), filterBody: $("filterBody"), toggleFiltersButton: $("toggleFiltersButton"),
  collapsedSummary: $("collapsedSummary"), tense: $("tenseSelect"), regularity: $("regularitySelect"),
  ending: $("endingSelect"), pattern: $("patternSelect"), pronominal: $("pronominalSelect"), rank: $("rankSelect"),
  matchCount: $("matchCount"), availabilityCount: $("availabilityCount"), startButton: $("startButton"),
  activeFilters: $("activeFilters"), progress: $("progress"), emptyState: $("emptyState"),
  emptyTitle: $("emptyTitle"), emptyMessage: $("emptyMessage"), card: $("card"), front: $("front"), back: $("back"),
  sideLabel: $("sideLabel"), revealNote: $("revealNote"), previous: $("previousButton"), next: $("nextButton"), status: $("status"),
  gradeButtons: [...document.querySelectorAll(".grade")]
};

/* ---------- IndexedDB persistence ---------- */

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const database = request.result;
      if (event.oldVersion < 2) {
        if (database.objectStoreNames.contains("deckProgress")) database.deleteObjectStore("deckProgress");
        if (database.objectStoreNames.contains(PROGRESS_STORE)) database.deleteObjectStore(PROGRESS_STORE);
        database.createObjectStore(PROGRESS_STORE, { keyPath: "cardId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function progressStore(mode = "readonly") {
  return db.transaction(PROGRESS_STORE, mode).objectStore(PROGRESS_STORE);
}

async function loadProgress() {
  const records = await requestAsPromise(progressStore().getAll());
  progressByCard = new Map(records.filter(record => record.schedulerVersion === TS_FSRS_VERSION).map(record => [record.cardId, record]));
}

async function saveCardProgress(cardId, fsrs) {
  const record = { cardId, fsrs, schedulerVersion: TS_FSRS_VERSION, updatedAt: Date.now() };
  await requestAsPromise(progressStore("readwrite").put(record));
  progressByCard.set(cardId, record);
}

/* ---------- FSRS adapter ---------- */

function emptyFsrsState() {
  return window.FSRS.createEmptyCard(new Date());
}

function progressRecord(cardId) {
  return progressByCard.get(cardId) || null;
}

function schedulerCard(cardId) {
  const state = progressRecord(cardId)?.fsrs || emptyFsrsState();
  return {
    ...state,
    due: state.due ? new Date(state.due) : new Date(),
    last_review: state.last_review ? new Date(state.last_review) : undefined
  };
}

function cardAvailability(cardId, now = Date.now()) {
  const record = progressRecord(cardId);
  if (!record || record.fsrs.state === FsrsState.New) return "new";
  const due = new Date(record.fsrs.due).getTime();
  return Number.isFinite(due) && due <= now ? "due" : "scheduled";
}

function nextDueAt(cards, now = Date.now()) {
  return cards.map(card => {
    const record = progressRecord(card.card_id);
    return record ? new Date(record.fsrs.due).getTime() : NaN;
  }).filter(due => Number.isFinite(due) && due > now).sort((a, b) => a - b)[0] || null;
}

/* ---------- Filters ---------- */

function currentFilters() {
  return {
    tense: elements.tense.value,
    regularity: elements.regularity.value,
    ending: elements.ending.value,
    pattern: elements.pattern.value,
    pronominal: elements.pronominal.value,
    rank: elements.rank.value
  };
}

function filteredCards(filters = currentFilters()) {
  return ConjuFlowCore.filterCards(CONTENT.cards, filters);
}

function saveFilters() {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(currentFilters()));
}

function restoreFilters() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(FILTERS_KEY)) || {}; } catch (_) { saved = {}; }
  elements.tense.value = TENSES.some(([id]) => id === saved.tense) ? saved.tense : TENSES[0][0];
  for (const [element, value] of [[elements.regularity, saved.regularity], [elements.ending, saved.ending], [elements.pronominal, saved.pronominal], [elements.rank, saved.rank]]) {
    if ([...element.options].some(option => option.value === value)) element.value = value;
  }
  updatePatternOptions(saved.pattern);
}

function updatePatternOptions(preferred = elements.pattern.value) {
  const patterns = ConjuFlowCore.availablePatterns(CONTENT.cards, currentFilters());
  if (!patterns.length) {
    elements.pattern.replaceChildren(new Option("No patterns available", "all"));
    elements.pattern.value = "all";
    elements.pattern.disabled = true;
    return;
  }
  elements.pattern.disabled = false;
  elements.pattern.replaceChildren(new Option("Todos los patrones", "all"));
  for (const pattern of patterns) elements.pattern.add(new Option(ConjuFlowCore.patternLabel(pattern), pattern));
  elements.pattern.value = ConjuFlowCore.resolvePatternSelection(patterns, preferred);
}

function filterSummary(filters, includeSecondary = true) {
  const labels = [TENSES.find(([id]) => id === filters.tense)?.[1] || filters.tense, REGULARITY_LABELS[filters.regularity] || filters.regularity];
  if (includeSecondary) {
    if (filters.ending !== "all") labels.push(ENDING_LABELS[filters.ending]);
    if (filters.pattern !== "all") labels.push(ConjuFlowCore.patternLabel(filters.pattern));
    if (filters.pronominal !== "all") labels.push(PRONOMINAL_LABELS[filters.pronominal]);
    if (filters.rank !== "all") labels.push(`1–${filters.rank}`);
  }
  return labels.join(" · ");
}

function updateMatchPreview() {
  const filters = currentFilters();
  const matches = filteredCards(filters);
  const availability = matches.reduce((counts, card) => {
    counts[cardAvailability(card.card_id)] += 1;
    return counts;
  }, { due: 0, new: 0, scheduled: 0 });
  elements.matchCount.textContent = `${matches.length} tarjetas coinciden con estos filtros`;
  elements.availabilityCount.textContent = `${availability.due} pendientes · ${availability.new} nuevas`;
  elements.startButton.disabled = false;
  saveFilters();
}

/* ---------- Session management ---------- */

function sessionSort(a, b) {
  const order = { due: 0, new: 1 };
  const aType = cardAvailability(a.card_id);
  const bType = cardAvailability(b.card_id);
  if (aType !== bType) return order[aType] - order[bType];
  const aDue = new Date(progressRecord(a.card_id)?.fsrs?.due || 0).getTime();
  const bDue = new Date(progressRecord(b.card_id)?.fsrs?.due || 0).getTime();
  return aDue - bDue || a.rank_corpus - b.rank_corpus;
}

function startPractice() {
  clearDueTimer();
  const filters = currentFilters();
  const matches = filteredCards(filters);
  const eligible = matches.filter(card => cardAvailability(card.card_id) !== "scheduled").sort(sessionSort);
  session = { filters: { ...filters }, matchIds: matches.map(card => card.card_id), queue: eligible.map(card => card.card_id) };
  currentIndex = 0;
  showingAnswer = false;
  elements.status.textContent = "";
  elements.toggleFiltersButton.hidden = false;
  if (window.matchMedia("(max-width: 560px)").matches) setFiltersCollapsed(true);
  render();
  scheduleNextDueCheck();
}

function currentCard() {
  return session?.queue.length ? CARD_BY_ID.get(session.queue[currentIndex]) : null;
}

function navigate(offset) {
  if (!session?.queue.length) return;
  currentIndex = (currentIndex + offset + session.queue.length) % session.queue.length;
  showingAnswer = false;
  render();
}

function reveal() {
  if (!currentCard()) return;
  showingAnswer = !showingAnswer;
  render();
}

async function grade(rating) {
  const card = currentCard();
  if (!card || !showingAnswer) return;
  const ratings = { 1: FsrsRating.Again, 2: FsrsRating.Hard, 3: FsrsRating.Good, 4: FsrsRating.Easy };
  const result = fsrsScheduler.next(schedulerCard(card.card_id), new Date(), ratings[rating]);
  try {
    await saveCardProgress(card.card_id, result.card);
    session.queue.splice(currentIndex, 1);
    if (currentIndex >= session.queue.length) currentIndex = 0;
    showingAnswer = false;
    updateMatchPreview();
    render();
    scheduleNextDueCheck();
  } catch (error) {
    console.error(error);
    elements.status.textContent = "This review could not be saved. Please try again.";
  }
}

function clearDueTimer() {
  if (dueTimer !== null) clearTimeout(dueTimer);
  dueTimer = null;
}

function scheduleNextDueCheck() {
  clearDueTimer();
  if (!session || session.queue.length) return;
  const cards = session.matchIds.map(id => CARD_BY_ID.get(id));
  const dueAt = nextDueAt(cards);
  if (!dueAt) return;
  dueTimer = setTimeout(() => {
    dueTimer = null;
    refreshDueSession();
    updateMatchPreview();
    render();
    scheduleNextDueCheck();
  }, Math.min(Math.max(dueAt - Date.now(), 0), MAX_TIMER_DELAY));
}

function refreshDueSession() {
  if (!session || session.queue.length) return;
  const eligible = session.matchIds.map(id => CARD_BY_ID.get(id)).filter(card => cardAvailability(card.card_id) !== "scheduled").sort(sessionSort);
  if (eligible.length) {
    session.queue = eligible.map(card => card.card_id);
    currentIndex = 0;
    showingAnswer = false;
  }
}

/* ---------- Rendering ---------- */

function renderFront(container, card) {
  container.replaceChildren();
  const verb = document.createElement("div");
  verb.className = "front-verb";
  verb.textContent = card.verbo;
  const tense = document.createElement("div");
  tense.className = "front-tense";
  tense.textContent = card.tiempo;
  container.append(verb, tense);
}

function renderBack(container, card) {
  container.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "back-heading";
  const verb = document.createElement("strong");
  verb.textContent = card.verbo;
  const tense = document.createElement("span");
  tense.textContent = card.tiempo;
  heading.append(verb, tense);

  const paradigm = document.createElement("div");
  paradigm.className = "paradigm";
  for (const [pronoun, form] of ConjuFlowCore.paradigmRows(card)) {
    const row = document.createElement("div");
    row.className = "form-row";
    const pronounElement = document.createElement("span");
    pronounElement.className = "pronoun";
    pronounElement.textContent = pronoun;
    const formElement = document.createElement("span");
    formElement.className = "conjugation";
    formElement.textContent = form;
    row.append(pronounElement, formElement);
    paradigm.append(row);
  }
  container.append(heading, paradigm);
  if (card.nota) {
    const note = document.createElement("div");
    note.className = "note";
    note.textContent = card.nota;
    container.append(note);
  }
}

function setButtons(answerVisible) {
  elements.gradeButtons.forEach(button => { button.disabled = !answerVisible; });
  const canNavigate = Boolean(session?.queue.length > 1);
  elements.previous.disabled = !canNavigate;
  elements.next.disabled = !canNavigate;
}

function renderEmpty(title, message) {
  elements.emptyState.hidden = false;
  elements.card.hidden = true;
  elements.revealNote.hidden = true;
  elements.emptyTitle.textContent = title;
  elements.emptyMessage.textContent = message;
  setButtons(false);
}

function render() {
  elements.status.textContent = "";
  if (!session) {
    elements.activeFilters.textContent = "";
    elements.progress.textContent = "";
    renderEmpty("Choose your filters", "Then start a practice session.");
    return;
  }

  const matchingCards = session.matchIds.map(id => CARD_BY_ID.get(id));
  elements.activeFilters.textContent = filterSummary(session.filters);
  elements.collapsedSummary.textContent = filterSummary(currentFilters());

  if (!session.matchIds.length) {
    elements.progress.textContent = "";
    renderEmpty("No verbs match these filters.", "Try changing one or more practice settings.");
    return;
  }

  const card = currentCard();
  if (!card) {
    const dueAt = nextDueAt(matchingCards);
    elements.progress.textContent = "";
    renderEmpty("You're caught up.", dueAt ? `Next review: ${new Date(dueAt).toLocaleString()}` : "There are no pending reviews in this selection.");
    return;
  }

  elements.emptyState.hidden = true;
  elements.card.hidden = false;
  const kind = cardAvailability(card.card_id) === "new" ? "New" : "Due";
  elements.progress.textContent = `${currentIndex + 1} / ${session.queue.length} · ${kind}`;
  elements.sideLabel.textContent = showingAnswer ? "Answer" : "Prompt";
  elements.front.hidden = showingAnswer;
  elements.back.hidden = !showingAnswer;
  elements.revealNote.hidden = showingAnswer;
  setButtons(showingAnswer);
  (showingAnswer ? renderBack : renderFront)(showingAnswer ? elements.back : elements.front, card);
}

function setFiltersCollapsed(collapsed) {
  elements.toolbar.classList.toggle("is-collapsed", collapsed);
  elements.collapsedSummary.hidden = !collapsed;
  elements.toggleFiltersButton.textContent = collapsed ? "Edit filters" : "Hide filters";
  elements.toggleFiltersButton.setAttribute("aria-expanded", String(!collapsed));
}

/* ---------- Controls and startup ---------- */

function populateTenses() {
  elements.tense.replaceChildren(...TENSES.map(([value, label]) => new Option(label, value)));
}

function handleFilterChange(event) {
  if (event.target !== elements.pattern) updatePatternOptions();
  updateMatchPreview();
}

function attachEvents() {
  for (const select of [elements.tense, elements.regularity, elements.ending, elements.pattern, elements.pronominal, elements.rank]) {
    select.addEventListener("change", handleFilterChange);
  }
  elements.startButton.addEventListener("click", startPractice);
  elements.toggleFiltersButton.addEventListener("click", () => setFiltersCollapsed(!elements.toolbar.classList.contains("is-collapsed")));
  elements.card.addEventListener("click", reveal);
  elements.card.addEventListener("keydown", event => {
    if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); reveal(); }
  });
  elements.previous.addEventListener("click", () => navigate(-1));
  elements.next.addEventListener("click", () => navigate(1));
  elements.gradeButtons.forEach(button => button.addEventListener("click", () => grade(Number(button.dataset.grade))));
  document.addEventListener("keydown", event => {
    if (event.target.matches("select, button, summary")) return;
    if (event.code === "Space") { event.preventDefault(); reveal(); }
    if (event.key === "ArrowRight") navigate(1);
    if (event.key === "ArrowLeft") navigate(-1);
    if (showingAnswer && /^[1-4]$/.test(event.key)) grade(Number(event.key));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { refreshDueSession(); updateMatchPreview(); render(); scheduleNextDueCheck(); }
  });
  window.addEventListener("pageshow", () => { refreshDueSession(); updateMatchPreview(); render(); scheduleNextDueCheck(); });
}

async function init() {
  try {
    if (!window.FSRS || CONTENT.cards.length === 0) throw new Error("Required application data is missing.");
    populateTenses();
    restoreFilters();
    db = await openDatabase();
    await loadProgress();
    attachEvents();
    updateMatchPreview();
    render();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(error => console.warn("Service worker registration failed", error));
  } catch (error) {
    console.error(error);
    elements.status.textContent = "ConjuFlow could not start. Please check that its data files and local storage are available.";
  }
}

init();
