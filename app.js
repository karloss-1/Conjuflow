"use strict";

/* ---------- Configuration and data ---------- */

const DB_NAME = "conjuflow-db";
const DB_VERSION = 1;
const PROGRESS_STORE = "cardProgress";
const FILTERS_KEY = "conjuflow-filters-v1";
const ROUND_SIZE_KEY = "conjuflow-round-size-v1";
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
  ["imperativo", "Imperativo"]
];
const REGULARITY_LABELS = { all: "Todos", regular: "Regulares", irregular: "Irregulares" };
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
  helpButton: $("helpButton"), helpDialog: $("helpDialog"), closeHelpButton: $("closeHelpButton"),
  sessionProgress: $("sessionProgress"), progressBar: $("progressBar"),
  toolbar: $("toolbar"), filterBody: $("filterBody"), toggleFiltersButton: $("toggleFiltersButton"),
  collapsedSummary: $("collapsedSummary"), tense: $("tenseSelect"), regularity: $("regularitySelect"),
  ending: $("endingSelect"), pattern: $("patternSelect"), pronominal: $("pronominalSelect"),
  roundSize: $("roundSizeSelect"), matchCount: $("matchCount"), availabilityCount: $("availabilityCount"),
  roundPreview: $("roundPreview"), startButton: $("startButton"), practiceMoreButton: $("practiceMoreButton"),
  activeFilters: $("activeFilters"), progress: $("progress"), emptyState: $("emptyState"),
  emptyTitle: $("emptyTitle"), emptyMessage: $("emptyMessage"), nextReview: $("nextReview"),
  card: $("card"), front: $("front"), back: $("back"),
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
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROGRESS_STORE)) database.createObjectStore(PROGRESS_STORE, { keyPath: "cardId" });
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

function fsrsStateName(cardId) {
  const state = progressRecord(cardId)?.fsrs?.state;
  if (state === FsrsState.Learning) return "learning";
  if (state === FsrsState.Relearning) return "relearning";
  if (state === FsrsState.Review) return "review";
  return "new";
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
    pronominal: elements.pronominal.value
  };
}

function filteredCards(filters = currentFilters()) {
  return ConjuFlowCore.filterCards(CONTENT.cards, filters);
}

function saveFilters() {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(currentFilters()));
}

function saveRoundSize() {
  localStorage.setItem(ROUND_SIZE_KEY, elements.roundSize.value);
}

function restoreFilters() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(FILTERS_KEY)) || {}; } catch (_) { saved = {}; }
  elements.tense.value = TENSES.some(([id]) => id === saved.tense) ? saved.tense : TENSES[0][0];
  for (const [element, value] of [[elements.regularity, saved.regularity], [elements.ending, saved.ending], [elements.pronominal, saved.pronominal]]) {
    if ([...element.options].some(option => option.value === value)) element.value = value;
  }
  updatePatternOptions(saved.pattern);
  const savedRoundSize = localStorage.getItem(ROUND_SIZE_KEY);
  elements.roundSize.value = ["10", "20", "all"].includes(savedRoundSize) ? savedRoundSize : "10";
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
  }
  return labels.join(" · ");
}

function roundSizeSummary() {
  return elements.roundSize.value === "all" ? "All available" : `${elements.roundSize.value}-card rounds`;
}

function candidateFor(card, now = Date.now()) {
  const availability = cardAvailability(card.card_id, now);
  const dueAt = progressRecord(card.card_id)?.fsrs?.due ? new Date(progressRecord(card.card_id).fsrs.due).getTime() : 0;
  return { card, availability, fsrsState: fsrsStateName(card.card_id), dueAt };
}

function selectVoluntaryRound(cards, introducedNewIds = new Set(), now = Date.now()) {
  return ConjuFlowCore.selectPracticeRound(cards.map(card => candidateFor(card, now)), elements.roundSize.value, introducedNewIds);
}

function updateMatchPreview() {
  const filters = currentFilters();
  const matches = filteredCards(filters);
  const availability = matches.reduce((counts, card) => {
    counts[cardAvailability(card.card_id)] += 1;
    return counts;
  }, { due: 0, new: 0, scheduled: 0 });
  elements.matchCount.textContent = `${matches.length} cards match these filters`;
  const availableNow = availability.due + availability.new;
  elements.availabilityCount.textContent = availability.scheduled
    ? `${availableNow} available now · ${availability.scheduled} scheduled for later`
    : (availability.due && availability.new ? `${availability.due} due · ${availability.new} new` : `${availableNow} available now`);
  const roundCount = Math.min(availableNow, ConjuFlowCore.normalizeRoundLimit(elements.roundSize.value));
  elements.roundPreview.textContent = `${roundCount} ${roundCount === 1 ? "card" : "cards"} in this round`;
  elements.startButton.disabled = false;
  saveFilters();
  saveRoundSize();
}

/* ---------- Session management ---------- */

function sameFilters(a, b) {
  return Boolean(a && b && Object.keys(a).every(key => a[key] === b[key]));
}

function installRound(candidates, mode, incrementRound = false) {
  session.queue = candidates.map(candidate => candidate.card.card_id);
  session.mode = mode;
  session.roundTotal = candidates.length;
  session.reviewedIds = new Set();
  if (incrementRound) session.round += 1;
  if (mode === "voluntary") {
    for (const candidate of candidates) {
      if (candidate.availability === "new") session.introducedNewIds.add(candidate.card.card_id);
    }
  }
  currentIndex = 0;
  showingAnswer = false;
}

function startPractice() {
  clearDueTimer();
  const filters = currentFilters();
  const matches = filteredCards(filters);
  const continuingContext = sameFilters(session?.filters, filters);
  const introducedNewIds = continuingContext ? session.introducedNewIds : new Set();
  session = { filters: { ...filters }, matchIds: matches.map(card => card.card_id), queue: [], round: continuingContext ? session.round : 1, roundTotal: 0, reviewedIds: new Set(), introducedNewIds, mode: "voluntary" };
  installRound(selectVoluntaryRound(matches, introducedNewIds), "voluntary", continuingContext);
  elements.status.textContent = "";
  elements.toggleFiltersButton.hidden = false;
  setFiltersCollapsed(true);
  render();
  scheduleNextDueCheck();
}

function practiceMore() {
  if (!session || session.queue.length) return;
  clearDueTimer();
  const cards = session.matchIds.map(id => CARD_BY_ID.get(id));
  installRound(selectVoluntaryRound(cards, session.introducedNewIds), "voluntary", true);
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
    session.reviewedIds.add(card.card_id);
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
  const due = ConjuFlowCore.selectPracticeRound(
    session.matchIds.map(id => candidateFor(CARD_BY_ID.get(id))).filter(candidate => candidate.availability === "due"),
    "all"
  );
  if (due.length) installRound(due, "automatic", true);
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

function renderEmpty(title, message, nextReview = "") {
  elements.emptyState.hidden = false;
  elements.card.hidden = true;
  elements.revealNote.hidden = true;
  elements.emptyTitle.textContent = title;
  elements.emptyMessage.textContent = message;
  elements.nextReview.textContent = nextReview;
  elements.practiceMoreButton.hidden = true;
  setButtons(false);
}

function renderSessionProgress() {
  const total = session?.roundTotal || 0;
  elements.sessionProgress.hidden = total === 0;
  if (!total) {
    elements.progress.textContent = "";
    elements.progressBar.value = 0;
    elements.progressBar.max = 1;
    return;
  }
  const reviewed = session.reviewedIds.size;
  const card = currentCard();
  const kind = card ? (cardAvailability(card.card_id) === "new" ? "New" : "Due") : "Round complete";
  const roundLabel = session.mode === "automatic" ? "Automatic review · " : "";
  elements.progress.textContent = `${roundLabel}${reviewed} of ${total} reviewed · ${kind}`;
  elements.progressBar.max = total;
  elements.progressBar.value = reviewed;
}

function render() {
  renderSessionProgress();
  elements.status.textContent = "";
  if (!session) {
    elements.activeFilters.textContent = "";
    elements.emptyState.hidden = true;
    elements.card.hidden = true;
    elements.revealNote.hidden = true;
    setButtons(false);
    return;
  }

  const matchingCards = session.matchIds.map(id => CARD_BY_ID.get(id));
  elements.activeFilters.textContent = filterSummary(session.filters);
  elements.collapsedSummary.textContent = `${filterSummary(currentFilters())} · ${roundSizeSummary()}`;

  if (!session.matchIds.length) {
    renderEmpty("No verbs match these filters.", "Try changing one or more practice settings.");
    return;
  }

  const card = currentCard();
  if (!card) {
    const dueAt = nextDueAt(matchingCards);
    const completed = session.roundTotal > 0 && session.reviewedIds.size === session.roundTotal;
    const title = completed ? "Round complete" : "No cards available right now";
    const message = completed ? `${session.roundTotal} ${session.roundTotal === 1 ? "card" : "cards"} practiced` : "All matching cards are scheduled for later.";
    renderEmpty(title, message, dueAt ? `Next review: ${new Date(dueAt).toLocaleString()}` : "No review is currently scheduled.");
    if (completed && session.mode === "voluntary") {
      const additional = selectVoluntaryRound(matchingCards, session.introducedNewIds).length;
      if (additional) {
        elements.practiceMoreButton.textContent = `Practice ${additional} more`;
        elements.practiceMoreButton.hidden = false;
      }
    }
    return;
  }

  elements.emptyState.hidden = true;
  elements.practiceMoreButton.hidden = true;
  elements.card.hidden = false;
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
  elements.helpButton.addEventListener("click", () => elements.helpDialog.showModal());
  elements.closeHelpButton.addEventListener("click", () => elements.helpDialog.close());
  elements.helpDialog.addEventListener("close", () => elements.helpButton.focus());
  for (const select of [elements.tense, elements.regularity, elements.ending, elements.pattern, elements.pronominal, elements.roundSize]) {
    select.addEventListener("change", handleFilterChange);
  }
  elements.startButton.addEventListener("click", startPractice);
  elements.practiceMoreButton.addEventListener("click", practiceMore);
  elements.toggleFiltersButton.addEventListener("click", () => setFiltersCollapsed(!elements.toolbar.classList.contains("is-collapsed")));
  elements.card.addEventListener("click", reveal);
  elements.card.addEventListener("keydown", event => {
    if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); reveal(); }
  });
  elements.previous.addEventListener("click", () => navigate(-1));
  elements.next.addEventListener("click", () => navigate(1));
  elements.gradeButtons.forEach(button => button.addEventListener("click", () => grade(Number(button.dataset.grade))));
  document.addEventListener("keydown", event => {
    if (elements.helpDialog.open || event.target.matches("select, button, summary")) return;
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
