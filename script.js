// ================================================================
// AF PFRA Calculator — script.js
// ================================================================

// ---- Age group ----
function getAgeGroup(age) {
  if (age < 25) return "< 25";
  if (age < 30) return "25 - 29";
  if (age < 35) return "30 - 34";
  if (age < 40) return "35 - 39";
  if (age < 45) return "40 - 44";
  if (age < 50) return "45 - 49";
  if (age < 55) return "50 - 54";
  if (age < 60) return "55 - 59";
  return "60 +";
}

// ---- WHtR scoring ----
function getWhtrPoints(whtr) {
  if (!whtr || isNaN(whtr)) return 0;
  if (whtr < 0.50) return 20;
  if (whtr < 0.51) return 19;
  if (whtr < 0.52) return 18;
  if (whtr < 0.53) return 17;
  if (whtr < 0.54) return 16;
  if (whtr < 0.55) return 15;
  if (whtr < 0.56) return 12.5;
  if (whtr < 0.57) return 10;
  if (whtr < 0.58) return 7.5;
  if (whtr < 0.59) return 5;
  if (whtr < 0.60) return 2.5;
  return 0;
}

// ---- Event scoring ----
function getEventPoints(table, value, higherIsBetter) {
  if (!table || value === null || value === undefined || isNaN(value)) return 0;
  if (higherIsBetter) {
    for (let i = 0; i < table.length; i += 2) {
      if (value >= table[i]) return table[i + 1];
    }
    return 0;
  } else {
    for (let i = 0; i < table.length; i += 2) {
      if (value <= table[i]) return table[i + 1];
    }
    return 0;
  }
}

function scoreEvent(sex, ageGroup, event, value) {
  // A run must have a positive duration; zero is not a completed run.
  if (event === 'run' && !(value > 0)) return 0;
  const data = SCORE_DATA[sex][ageGroup];
  if (!data || !data[event]) return 0;
  return getEventPoints(data[event], value, event !== 'run');
}

// ---- Time formatting ----
function fmtTime(sec) {
  if (sec == null || isNaN(sec)) return '—';
  sec = Math.round(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseRunTime(str) {
  if (!/^\d{2}:[0-5]\d$/.test(str || '')) return null;
  const [minutes, seconds] = str.split(':').map(Number);
  return minutes * 60 + seconds;
}

function formatRunInputValue(raw) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 4).padEnd(4, '0');
  return digits.slice(0, 2) + ':' + digits.slice(2);
}

function setupRunTimeInput() {
  const input = document.getElementById('cardio_val');
  input.addEventListener('focus', () => {
    if (state.cardioEvent === 'run') input.select();
  });
  input.addEventListener('beforeinput', event => {
    if (state.cardioEvent !== 'run') return;
    const inserted = event.data;
    if (!event.inputType.startsWith('delete') && inserted == null) return;
    event.preventDefault();
    let digits = input.value.replace(/\D/g, '').padEnd(4, '0').split('');
    const position = n => Math.min(4, n > 2 ? n - 1 : n);
    let start = position(input.selectionStart || 0);
    const end = position(input.selectionEnd || 0);
    if (event.inputType.startsWith('delete')) {
      if (start === end && event.inputType === 'deleteContentBackward') start = Math.max(0, start - 1);
      for (let i = start; i < Math.max(end, start + 1) && i < 4; i++) digits[i] = '0';
      input.dataset.runComplete = 'false';
    } else {
      if (!/^[0-9:]+$/.test(inserted)) return;
      if (end > start) for (let i = start; i < end; i++) digits[i] = '0';
      for (const digit of inserted.replace(/:/g, '')) {
        if (start >= 4) break;
        if (start === 2 && Number(digit) > 5) return;
        digits[start++] = digit;
      }
      input.dataset.runComplete = String(start === 4);
    }
    input.value = digits.slice(0, 2).join('') + ':' + digits.slice(2).join('');
    const caret = start >= 2 ? start + 1 : start;
    input.setSelectionRange(caret, caret);
    readEventInputs();
    liveCalc();
  });
}

// ---- Rating ----
function getRating(score, physicalPoints = []) {
  // AFMAN 36-2905 para. 3.6.1: any missed physical minimum fails the assessment.
  if (physicalPoints.some(points => points <= 0)) return { label: 'Unsatisfactory', cls: 'unsat' };
  if (score >= 90) return { label: 'Excellent',      cls: 'excellent' };
  if (score >= 75) return { label: 'Satisfactory',   cls: 'satisfactory' };
  return               { label: 'Unsatisfactory',  cls: 'unsat' };
}

function getNextGoal(score) {
  if (score < 80) return 80;
  if (score < 85) return 85;
  if (score < 90) return 90;
  if (score < 95) return 95;
  if (score < 100) return 100;
  return null;
}

// ================================================================
// CURRENT STATE
// ================================================================
const state = {
  sex: 'Male',
  age: null,
  heightIn: null,
  waistIn: null,
  strengthEvent: 'hr_pushups',
  strengthVal: null,
  coreEvent: 'situps',
  coreVal: null,
  cardioEvent: 'hamr',
  cardioVal: null,
};

const PERSONAL_CACHE_KEY = 'af_pfra_personal_v1';

function savePersonalCache() {
  const payload = {
    age: state.age,
    heightIn: state.heightIn,
    waistIn: state.waistIn,
  };
  localStorage.setItem(PERSONAL_CACHE_KEY, JSON.stringify(payload));
}

function loadPersonalCache() {
  const raw = localStorage.getItem(PERSONAL_CACHE_KEY);
  if (!raw) return;

  try {
    const cached = JSON.parse(raw);

    const age = Number(cached.age);
    const heightIn = Number(cached.heightIn);
    const waistIn = Number(cached.waistIn);

    state.age = Number.isFinite(age) ? age : null;
    state.heightIn = Number.isFinite(heightIn) ? heightIn : null;
    state.waistIn = Number.isFinite(waistIn) ? waistIn : null;

    document.getElementById('age').value = state.age ?? '';
    document.getElementById('height_in').value = state.heightIn ?? '';
    document.getElementById('waist_in').value = state.waistIn ?? '';
  } catch {
    // Ignore invalid cache payloads and continue with empty defaults.
  }
}

// ================================================================
// DOM READY
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupCalculator();
  setupHAMR();
  setupScoreCharts();
  setupPrint();
});

// ================================================================
// TABS
// ================================================================
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'score-charts') renderScoreChart();
    });
  });
}

// ================================================================
// CALCULATOR
// ================================================================
function setupCalculator() {
  loadPersonalCache();

  // Sex buttons
  document.querySelectorAll('.sex-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sex-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.sex = btn.dataset.sex;
      syncChartSexFromCalculator();
      liveCalc();
    });
  });

  // Personal number inputs
  ['age', 'height_in', 'waist_in'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      state.age      = parseFloat(document.getElementById('age').value) || null;
      state.heightIn = parseFloat(document.getElementById('height_in').value) || null;
      state.waistIn  = parseFloat(document.getElementById('waist_in').value) || null;
      savePersonalCache();
      syncChartAgeFromCalculator();
      updateWhtrLive();
      liveCalc();
    });
  });

  // Event type pills
  document.querySelectorAll('.event-type-pills .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const group = pill.dataset.group;
      // Deactivate siblings
      pill.closest('.event-type-pills').querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      // Update state + unit label
      if (group === 'strength_event') {
        state.strengthEvent = pill.dataset.val;
        document.getElementById('str-unit').textContent = 'reps';
      } else if (group === 'core_event') {
        state.coreEvent = pill.dataset.val;
        document.getElementById('core-unit').textContent = pill.dataset.val === 'plank' ? 'sec' : 'reps';
      } else if (group === 'cardio_event') {
        const changed = state.cardioEvent !== pill.dataset.val;
        state.cardioEvent = pill.dataset.val;
        const cardioInput = document.getElementById('cardio_val');
        if (changed) {
          cardioInput.value = state.cardioEvent === 'run' ? '00:00' : '';
          cardioInput.dataset.runComplete = 'false';
          cardioInput.dataset.hamrMode = 'reps';
        }
        cardioInput.inputMode = state.cardioEvent === 'run' ? 'numeric' : 'decimal';
        if (state.cardioEvent === 'run') {
          cardioInput.maxLength = 5;
          cardioInput.pattern = '[0-9]{2}:[0-5][0-9]';
        } else { cardioInput.removeAttribute('maxlength'); cardioInput.removeAttribute('pattern'); }
        cardioInput.closest('.event-input-row').classList.toggle('run-time-row', state.cardioEvent === 'run');
        document.getElementById('cardio-unit').textContent = pill.dataset.val === 'hamr' ? 'reps' : 'mm:ss';
        document.getElementById('cardio_val').placeholder = pill.dataset.val === 'hamr' ? '0' : '00:00';
      }
      liveCalc();
    });
  });

  setupRunTimeInput();
  setupHAMRInputSwap();

  // Event value inputs — live recalc
  ['hrpushup_val', 'core_val', 'cardio_val'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      if (id === 'cardio_val' && state.cardioEvent === 'run') {
        const cardioInput = document.getElementById('cardio_val');
        const raw = cardioInput.value;
        cardioInput.dataset.runComplete = String(/^\d{2}:[0-5]\d$/.test(raw) || /^\d{2}[0-5]\d$/.test(raw));
        cardioInput.value = formatRunInputValue(raw);
      }
      readEventInputs();
      liveCalc();
    });
  });

  updateWhtrLive();
  liveCalc();
}


function updateWhtrLive() {
  const el = document.getElementById('whtr_live');
  if (state.heightIn && state.waistIn) {
    const whtr = state.waistIn / state.heightIn;
    const pts = getWhtrPoints(whtr);
    el.textContent = `WHtR ${whtr.toFixed(3)} → ${pts} pts`;
    el.className = 'whtr-live ' + whtrColorClass(pts);
  } else {
    el.textContent = '';
    el.className = 'whtr-live';
  }
}

function readEventInputs() {
  // Strength
  const strRaw = document.getElementById('hrpushup_val').value;
  state.strengthVal = strRaw !== '' ? parseInt(strRaw) : null;

  // Core
  const coreRaw = document.getElementById('core_val').value;
  state.coreVal = coreRaw !== '' ? parseInt(coreRaw) : null;

  // Cardio
  const cardioRaw = document.getElementById('cardio_val').value;
  if (state.cardioEvent === 'run') {
    state.cardioVal = document.getElementById('cardio_val').dataset.runComplete === 'true' ? parseRunTime(cardioRaw) : null;
  } else {
    state.cardioVal = parseHAMRInput(cardioRaw, document.getElementById('cardio_val').dataset.hamrMode);
  }
}

function liveCalc() {
  readEventInputs();
  updateHAMRInputSwap();
  updateInputScoreBadges();
  // Need sex + age + height + waist at minimum to show anything
  if (!state.sex || !state.age || !state.heightIn || !state.waistIn) {
    document.getElementById('input-total-score').innerHTML = '—<small> / 100</small>';
    const totalRating = document.getElementById('input-total-rating');
    totalRating.textContent = 'Enter your details';
    totalRating.className = 'input-total-rating';
    return;
  }

  const ageGroup = getAgeGroup(state.age);
  const whtr = state.waistIn / state.heightIn;
  const waistPts = getWhtrPoints(whtr);

  const strPts   = (state.strengthVal !== null && !isNaN(state.strengthVal))
    ? scoreEvent(state.sex, ageGroup, state.strengthEvent, state.strengthVal) : 0;
  const corePts  = (state.coreVal !== null && !isNaN(state.coreVal))
    ? scoreEvent(state.sex, ageGroup, state.coreEvent, state.coreVal) : 0;
  const cardioPts= (state.cardioVal !== null && !isNaN(state.cardioVal))
    ? scoreEvent(state.sex, ageGroup, state.cardioEvent, state.cardioVal) : 0;

  const total = parseFloat((waistPts + strPts + corePts + cardioPts).toFixed(1));
  const rating = getRating(total, [strPts, corePts, cardioPts]);

  renderScorePanel(total, rating, waistPts, strPts, corePts, cardioPts);

  // Goal planner
  const nextGoal = getNextGoal(total);
  renderGoalBanner(total, nextGoal);
  renderGoals({
    sex: state.sex, ageGroup,
    whtr, waistPts,
    heightIn: state.heightIn,
    waistIn: state.waistIn,
    strengthEvent: state.strengthEvent, strengthVal: state.strengthVal, strengthPts: strPts,
    coreEvent: state.coreEvent, coreVal: state.coreVal, corePts,
    cardioEvent: state.cardioEvent, cardioVal: state.cardioVal, cardioPts,
    totalScore: total, nextGoal
  });
}

// ---- Ring circumference = 2π×52 ≈ 326.7 ----
const RING_C = 2 * Math.PI * 52;

// Get the minimum reps/time needed to score at all for an event (first entry from bottom of table)
function getEventMin(sex, ageGroup, event) {
  const data = SCORE_DATA[sex]?.[ageGroup];
  if (!data || !data[event]) return null;
  const t = data[event];
  // Last pair is worst threshold
  return t[t.length - 2];
}

// Get max reps (first entry = best threshold) for an event
function getEventMax(sex, ageGroup, event) {
  const data = SCORE_DATA[sex]?.[ageGroup];
  if (!data || !data[event]) return null;
  return data[event][0];
}

// WHtR color class
function whtrColorClass(pts) {
  if (pts >= 17)  return 'whtr-excellent';
  if (pts >= 12)  return 'whtr-satisfactory';
  if (pts >= 5)   return 'whtr-marginal';
  return 'whtr-unsat';
}

function renderScorePanel(total, rating, waistPts, strPts, corePts, cardioPts) {
  document.getElementById('input-total-score').innerHTML = total.toFixed(1) + '<small> / 100</small>';
  const inputRating = document.getElementById('input-total-rating');
  inputRating.textContent = rating.label;
  inputRating.className = 'input-total-rating ' + rating.cls;
  // Big score
  document.getElementById('score-display').textContent = total.toFixed(1);

  const ratingEl = document.getElementById('rating-label');
  ratingEl.textContent = rating.label;
  ratingEl.className = 'score-rating ' + rating.cls;

  // Ring
  const fill = document.getElementById('ring-fill');
  const pct = Math.min(total / 100, 1);
  fill.style.strokeDasharray = `${pct * RING_C} ${RING_C}`;
  fill.className = 'ring-fill ' + rating.cls;

  // Mini bars + zero-alert
  const barData = [
    { rowId: 'row-str',    fillId: 'sb-str',    ptsId: 'sbl-str',    val: strPts,    max: 15  },
    { rowId: 'row-core',   fillId: 'sb-core',   ptsId: 'sbl-core',   val: corePts,   max: 15  },
    { rowId: 'row-cardio', fillId: 'sb-cardio', ptsId: 'sbl-cardio', val: cardioPts, max: 50  },
  ];

  // WHtR row (never zero-alert — just color)
  document.getElementById('sb-waist').style.width = Math.min(waistPts / 20, 1) * 100 + '%';
  document.getElementById('sbl-waist').textContent = waistPts.toFixed(1);
  // WHtR color
  const whtrLive = document.getElementById('whtr_live');
  whtrLive.className = 'whtr-live ' + whtrColorClass(waistPts);

  barData.forEach(b => {
    const pct = Math.min(b.val / b.max, 1) * 100;
    document.getElementById(b.fillId).style.width = pct + '%';
    document.getElementById(b.ptsId).textContent = b.val.toFixed(1);

    const row = document.getElementById(b.rowId);
    if (b.val === 0) {
      row.classList.add('zero-alert');
    } else {
      row.classList.remove('zero-alert');
    }
  });

  // Update event key labels
  const strLabelMap    = { hr_pushups: 'HR Push', pushups: 'Push-ups' };
  const coreLabelMap   = { situps: 'Sit-ups', rev_crunch: 'Rev.Cr', plank: 'Plank' };
  const cardioLabelMap = { hamr: 'HAMR', run: '2-Mile' };
  document.getElementById('sbl-str-label').textContent    = strLabelMap[state.strengthEvent]   || 'Str';
  document.getElementById('sbl-core-label').textContent   = coreLabelMap[state.coreEvent]      || 'Core';
  document.getElementById('sbl-cardio-label').textContent = cardioLabelMap[state.cardioEvent]  || 'Cardio';

  // Max thresholds — only if we have age/sex
  if (state.age && state.sex) {
    const ag = getAgeGroup(state.age);
    const strMax    = getEventMax(state.sex, ag, state.strengthEvent);
    const coreMax   = getEventMax(state.sex, ag, state.coreEvent);
    const cardioMax = getEventMax(state.sex, ag, state.cardioEvent);

    const strUnit    = 'reps';
    const coreUnit   = state.coreEvent === 'plank' ? 's' : 'reps';
    const cardioUnit = state.cardioEvent === 'run'  ? '' : 'reps';

    const strLabel    = strMax    != null ? `Max: <strong>${strMax} ${strUnit}</strong>`    : '';
    const coreLabel   = coreMax   != null ? `Max: <strong>${coreMax} ${coreUnit}</strong>`  : '';
    const cardioLabel = cardioMax != null
      ? (state.cardioEvent === 'run'
          ? `Max: <strong>≤ ${fmtTime(cardioMax)}</strong>`
          : `Max: <strong>${cardioMax} ${cardioUnit}</strong>`)
      : '';

    document.getElementById('sbmax-str-label').innerHTML    = strLabel;
    document.getElementById('sbmax-core-label').innerHTML   = coreLabel;
    document.getElementById('sbmax-cardio-label').innerHTML = cardioLabel;
    document.getElementById('sb-maxrow').style.display = 'flex';
  }
}

function renderGoalBanner(total, nextGoal) {
  const el = document.getElementById('goal-banner');
  if (!nextGoal) {
    el.style.display = 'block';
    el.textContent = '🏆 Perfect score!';
    return;
  }
  const needed = (nextGoal - total).toFixed(1);
  el.style.display = 'block';
  el.innerHTML = `Next target: <strong>${nextGoal}</strong> &nbsp;·&nbsp; Need <strong>+${needed} pts</strong>`;
}

// ---- Goal planner — finds EXACT minimum change to close the gap ----
function findImprovements(sex, ageGroup, inputs, totalScore, targetScore) {
  const needed = parseFloat((targetScore - totalScore).toFixed(1));
  if (needed <= 0) return [];
  const data = SCORE_DATA[sex][ageGroup];
  const suggestions = [];

  function getMinThresholdForPoints(table, targetPts) {
    if (!table) return null;
    let minThresh = null;
    for (let i = 0; i < table.length; i += 2) {
      const thresh = table[i];
      const pts = table[i + 1];
      if (pts >= targetPts && (minThresh === null || thresh < minThresh)) {
        minThresh = thresh;
      }
    }
    return minThresh;
  }

  // Helper: walk a table and find the SMALLEST val change that yields >= neededPtGain
  // For reps (higherIsBetter=true): find minimum threshold > currentVal where pts gain >= neededGain
  // For run (higherIsBetter=false): find maximum threshold < currentVal where pts gain >= neededGain
  function findMinChange(table, currentVal, currentPts, neededGain, higherIsBetter) {
    // Build sorted list of (threshold, pts) that give a gain >= neededGain
    // We want the one closest to currentVal (minimum effort)
    const candidates = [];
    for (let i = 0; i < table.length; i += 2) {
      const thresh = table[i];
      const pts    = table[i + 1];
      const gain   = pts - currentPts;
      if (gain >= neededGain) {
        // For reps: must be reachable (thresh > currentVal)
        // For run: must be faster (thresh < currentVal)
        if (higherIsBetter && thresh > currentVal) candidates.push({ thresh, pts, gain });
        if (!higherIsBetter && thresh < currentVal) candidates.push({ thresh, pts, gain });
      }
    }
    if (candidates.length === 0) return null;
    // Pick minimum effort: for reps = lowest thresh (fewest extra reps); for run = highest thresh (smallest time drop)
    if (higherIsBetter) candidates.sort((a, b) => a.thresh - b.thresh);
    else                candidates.sort((a, b) => b.thresh - a.thresh);
    return candidates[0];
  }

  // ---- Strength ----
  const { strengthEvent: strEv, strengthVal: strVal, strengthPts: strPts } = inputs;
  if (strEv && strVal !== null && !isNaN(strVal) && data[strEv]) {
    const table  = data[strEv];
    const maxPts = table[1];
    if (strPts < maxPts) {
      const hit = findMinChange(table, strVal, strPts, needed, true);
      if (hit) {
        const lbl = strEv === 'hr_pushups' ? 'Hand-Release Push-ups' : 'Push-ups';
        const altStrengthEvents = ['hr_pushups', 'pushups'].filter(ev => ev !== strEv);
        const alternatives = altStrengthEvents
          .map(ev => {
            const target = getMinThresholdForPoints(data[ev], hit.pts);
            if (target === null) return null;
            return {
              event: ev,
              label: ev === 'hr_pushups' ? 'HR Push-ups' : 'Push-ups',
              targetVal: target,
              unit: 'reps'
            };
          })
          .filter(Boolean);

        suggestions.push({
          event: strEv, label: lbl, category: 'strength',
          currentVal: strVal, targetVal: hit.thresh,
          currentPts: strPts, targetPts: hit.pts,
          ptGain: hit.gain,
          valDiff: hit.thresh - strVal,
          alternatives,
          direction: 'up', unit: 'reps'
        });
      }
    }
  }

  // ---- Core ----
  const { coreEvent: coreEv, coreVal, corePts } = inputs;
  if (coreEv && coreVal !== null && !isNaN(coreVal) && data[coreEv]) {
    const table  = data[coreEv];
    const maxPts = table[1];
    if (corePts < maxPts) {
      const hit = findMinChange(table, coreVal, corePts, needed, true);
      if (hit) {
        const lbl = coreEv === 'situps' ? 'Sit-ups' : coreEv === 'rev_crunch' ? 'Rev. Crunches' : 'Plank';
        const altCoreEvents = ['situps', 'rev_crunch', 'plank'].filter(ev => ev !== coreEv);
        const alternatives = altCoreEvents
          .map(ev => {
            const target = getMinThresholdForPoints(data[ev], hit.pts);
            if (target === null) return null;
            return {
              event: ev,
              label: ev === 'situps' ? 'Sit-ups' : ev === 'rev_crunch' ? 'Rev. Crunches' : 'Plank',
              targetVal: target,
              unit: ev === 'plank' ? 'sec' : 'reps'
            };
          })
          .filter(Boolean);

        suggestions.push({
          event: coreEv, label: lbl, category: 'core',
          currentVal: coreVal, targetVal: hit.thresh,
          currentPts: corePts, targetPts: hit.pts,
          ptGain: hit.gain,
          valDiff: hit.thresh - coreVal,
          alternatives,
          direction: 'up', unit: coreEv === 'plank' ? 'sec' : 'reps'
        });
      }
    }
  }

  // ---- Cardio ----
  const { cardioEvent: cardEv, cardioVal, cardioPts } = inputs;
  if (cardEv && cardioVal !== null && !isNaN(cardioVal) && (cardEv !== 'run' || cardioVal > 0) && data[cardEv]) {
    const table  = data[cardEv];
    const maxPts = table[1];
    if (cardioPts < maxPts) {
      const isRun = cardEv === 'run';
      const hit = findMinChange(table, cardioVal, cardioPts, needed, !isRun);
      if (hit) {
        if (!isRun) {
          const repData = getHAMRRepData(hit.thresh);
          const equiv = repData ? ` ≈ ${fmtTime(repData.equiv2mi)} 2mi` : '';
          suggestions.push({
            event: cardEv, label: 'HAMR', category: 'cardio',
            currentVal: cardioVal, targetVal: hit.thresh,
            currentPts: cardioPts, targetPts: hit.pts,
            ptGain: hit.gain,
            valDiff: hit.thresh - cardioVal,
            direction: 'up', unit: 'reps',
            extra: equiv
          });
        } else {
          suggestions.push({
            event: cardEv, label: '2-Mile Run', category: 'cardio',
            currentVal: cardioVal, targetVal: hit.thresh,
            currentPts: cardioPts, targetPts: hit.pts,
            ptGain: hit.gain,
            valDiff: cardioVal - hit.thresh,
            direction: 'down', unit: 'sec'
          });
        }
      }
    }
  }

  // ---- Waist ----
  const { whtr: waistWhtr, waistPts, heightIn, waistIn } = inputs;
  if (waistWhtr !== null && !isNaN(waistWhtr) && waistPts < 20 && heightIn && waistIn) {
    const brackets = [0.599,0.589,0.579,0.569,0.559,0.549,0.539,0.529,0.519,0.509,0.499];
    const pts      = [2.5,  5,    7.5,  10,   12.5, 15,   16,   17,   18,   19,   20  ];
    // Find minimum WHtR drop that achieves needed pts gain
    for (let i = brackets.length - 1; i >= 0; i--) {
      if (pts[i] > waistPts && brackets[i] < waistWhtr) {
        const gain = pts[i] - waistPts;
        if (gain >= needed) {
          const targetWaistIn = parseFloat((brackets[i] * heightIn).toFixed(2));
          const waistInDiff = parseFloat((waistIn - targetWaistIn).toFixed(2));
          const estLossLow = parseFloat((waistInDiff * 8).toFixed(1));
          const estLossHigh = parseFloat((waistInDiff * 10).toFixed(1));
          const estCalLow = Math.round(estLossLow * 3500);
          const estCalHigh = Math.round(estLossHigh * 3500);

          suggestions.push({
            event: 'waist', label: 'WHtR', category: 'waist',
            currentVal: waistWhtr, targetVal: brackets[i],
            currentPts: waistPts, targetPts: pts[i],
            ptGain: gain,
            valDiff: parseFloat((waistWhtr - brackets[i]).toFixed(3)),
            targetWaistIn,
            waistInDiff,
            estLossLow,
            estLossHigh,
            estCalLow,
            estCalHigh,
            direction: 'down', unit: 'WHtR'
          });
          break;
        }
      }
    }
  }

  return suggestions;
}

// Generate combos — each combo must reach exactly `needed` pts (or minimally overshoot)
function generateCombos(suggestions, needed) {
  // For single events we already found the min change that reaches `needed`
  // so each suggestion already qualifies solo
  const combos = [];

  // Singles
  suggestions.forEach(s => {
    combos.push({ items: [s], totalGain: s.ptGain });
  });

  // Two-event combos: find pairs where combined gain >= needed
  // Look at ALL possible pt gains per event (not just the min-to-reach-needed one)
  // For multi-event combos we want the smallest total change that together reaches `needed`
  // We already have one candidate per event (the min-solo), so combine them and check
  for (let i = 0; i < suggestions.length; i++) {
    for (let j = i + 1; j < suggestions.length; j++) {
      const gain = suggestions[i].ptGain + suggestions[j].ptGain;
      if (gain >= needed) {
        combos.push({ items: [suggestions[i], suggestions[j]], totalGain: gain });
      }
    }
  }

  // Three-event combos
  for (let i = 0; i < suggestions.length; i++) {
    for (let j = i + 1; j < suggestions.length; j++) {
      for (let k = j + 1; k < suggestions.length; k++) {
        const gain = suggestions[i].ptGain + suggestions[j].ptGain + suggestions[k].ptGain;
        if (gain >= needed) {
          combos.push({ items: [suggestions[i], suggestions[j], suggestions[k]], totalGain: gain });
        }
      }
    }
  }

  // Sort: fewer items first, then by total effort (smallest valDiff sum)
  combos.sort((a, b) => {
    if (a.items.length !== b.items.length) return a.items.length - b.items.length;
    const diffA = a.items.reduce((s, x) => s + x.valDiff, 0);
    const diffB = b.items.reduce((s, x) => s + x.valDiff, 0);
    return diffA - diffB;
  });

  return combos.slice(0, 8);
}

function renderGoals(r) {
  const goalCard = document.getElementById('goal-card');
  const goalSection = document.getElementById('goal-section');

  if (!r.nextGoal) {
    goalCard.style.display = 'block';
    goalSection.innerHTML = '<div class="perfect-score">🏆 Perfect Score!</div>';
    return;
  }

  goalCard.style.display = 'block';
  const needed = parseFloat((r.nextGoal - r.totalScore).toFixed(1));
  const suggestions = findImprovements(r.sex, r.ageGroup, r, r.totalScore, r.nextGoal);
  const combos = generateCombos(suggestions, needed);

  let html = `<div class="goal-header-row">
    <span class="goal-target-label">→ ${r.nextGoal}</span>
    <span class="goal-needed-label">Need <strong>+${needed} pts</strong></span>
  </div>`;

  if (combos.length === 0) {
    html += '<p class="dimmed">No single-event improvements found — try reducing WHtR.</p>';
  } else {
    const singles = combos.filter(c => c.items.length === 1);
    const multis  = combos.filter(c => c.items.length > 1);
    const displayedCombos = [];

    if (singles.length) {
      html += '<div class="goal-section-title">⚡ Single-Event Paths</div>';
      singles.forEach(c => {
        displayedCombos.push(c);
        html += renderComboCard(c);
      });
    }
    if (multis.length) {
      html += '<div class="goal-section-title">🔀 Combinations</div>';
      multis.slice(0,4).forEach(c => {
        displayedCombos.push(c);
        html += renderComboCard(c);
      });
    }

    const hasWaistSuggestion = displayedCombos.some(combo =>
      combo.items.some(item => item.event === 'waist')
    );
    if (hasWaistSuggestion) {
      html += '<p class="goal-disclaimer">WHtR estimates use rules of thumb (~8-10 lbs per 1 inch waist and ~3,500 calories per lb) and can vary by person.</p>';
    }
  }

  goalSection.innerHTML = html;
}

function renderComboCard(combo) {
  let html = '<div class="combo-card">';
  combo.items.forEach(item => {
    let changeStr = '';
    if (item.event === 'hamr') {
      changeStr = `+${item.valDiff} reps → ${item.targetVal}${item.extra || ''}`;
    } else if (item.event === 'run') {
      changeStr = `-${fmtTime(item.valDiff)} → ${fmtTime(item.targetVal)}`;
    } else if (item.event === 'plank') {
      changeStr = `+${item.valDiff}s → ${fmtTime(item.targetVal)} hold`;
    } else if (item.event === 'waist') {
      changeStr = `↓ ${item.valDiff} WHtR → ≤ ${item.targetVal.toFixed(3)} (${item.waistInDiff.toFixed(2)} in waist)`;
    } else {
      changeStr = `+${item.valDiff} reps → ${item.targetVal}`;
    }
    html += `<div class="combo-item">
      <span class="combo-event">${item.label}</span>
      <span class="combo-change">${changeStr}</span>
      <span class="combo-gain">+${item.ptGain.toFixed(1)} pts</span>
    </div>`;

    if (item.alternatives && item.alternatives.length) {
      const altText = item.alternatives
        .map(alt => {
          if (alt.event === 'plank') return `OR ${fmtTime(alt.targetVal)} Plank`;
          return `OR ${alt.targetVal} ${alt.label}`;
        })
        .join(' · ');
      html += `<div class="combo-alt">${altText}</div>`;
    }

    if (item.event === 'waist') {
      html += `<div class="combo-note">Est. weight loss for this waist change: ~${item.estLossLow.toFixed(1)}-${item.estLossHigh.toFixed(1)} lbs (~${item.estCalLow.toLocaleString()}-${item.estCalHigh.toLocaleString()} calories)</div>`;
    }
  });
  html += `<div class="combo-total">Total gain: +${combo.totalGain.toFixed(1)} pts</div></div>`;
  return html;
}

// ================================================================
// HAMR EXPLORER
// ================================================================
function getHAMRStats(reps) {
  if (!Number.isInteger(reps) || reps < 0 || reps > 100) return null;
  if (reps === 0) return { reps, elapsed: 0, distance: 0, miles: 0, avgBeep: null, mph: null, lap: null, twoMile: null };
  const data = getHAMRRepData(reps);
  if (!data) return null;
  const distance = reps * 20;
  const speed = distance / data.elapsed;
  return { reps, elapsed: data.elapsed, distance, miles: distance / 1609.344,
    avgBeep: data.elapsed / reps, mph: speed * 3600 / 1609.344,
    lap: 400 / speed, twoMile: 3218.688 / speed };
}

function setupHAMR() {
  const input = document.getElementById('hamr-stats-input');
  const swap = document.getElementById('hamr-stats-swap');
  const label = document.getElementById('hamr-stats-label');
  const error = document.getElementById('hamr-stats-error');
  const down = document.getElementById('hamr-step-down');
  const up = document.getElementById('hamr-step-up');
  let mode = 'reps';
  function render() {
    const reps = parseHAMRInput(input.value, mode);
    const stats = getHAMRStats(reps);
    down.disabled = !stats || reps <= 0;
    up.disabled = !stats || reps >= 100;
    const data = stats && reps > 0 ? getHAMRRepData(reps) : null;
    swap.textContent = mode === 'level' ? (stats ? reps : '—') + ' reps'
      : data ? data.level + '-' + data.repInLevel : reps === 0 ? '0-0' : 'L-R';
    swap.setAttribute('aria-label', mode === 'level' ? 'Switch to total reps input' : 'Switch to level and shuttle input');
    swap.title = mode === 'level' ? 'Enter total reps' : 'Enter level–shuttle';
    label.textContent = mode === 'level' ? 'Level–shuttle' : 'Total reps';
    input.inputMode = mode === 'level' ? 'text' : 'numeric';
    input.placeholder = mode === 'level' ? '6-7' : '48';
    const invalid = input.value.trim() !== '' && !stats;
    error.hidden = !invalid;
    error.textContent = invalid ? 'Enter 0–100 reps or a valid level–shuttle within that range.' : '';
    input.setAttribute('aria-invalid', String(invalid));
    const values = {
      'hamr-elapsed': stats ? fmtTime(stats.elapsed) : '—',
      'hamr-beep': stats && stats.avgBeep != null ? stats.avgBeep.toFixed(2) + ' s' : '—',
      'hamr-speed-mph': stats && stats.mph != null ? stats.mph.toFixed(2) + ' mph' : '—',
      'hamr-lap-pace': stats && stats.lap != null ? fmtTime(stats.lap) : '—',
      'hamr-equiv': stats && stats.twoMile != null ? fmtTime(stats.twoMile) : '—',
      'hamr-dist-m': stats ? stats.distance.toLocaleString() + ' m' : '—',
      'hamr-dist-mi': stats ? stats.miles.toFixed(3) + ' mi' : '—'
    };
    Object.entries(values).forEach(([id, value]) => document.getElementById(id).textContent = value);
  }
  function step(delta) {
    const reps = parseHAMRInput(input.value, mode);
    if (!getHAMRStats(reps)) return;
    const next = Math.max(0, Math.min(100, reps + delta));
    const data = next > 0 ? getHAMRRepData(next) : null;
    input.value = mode === 'reps' ? String(next) : data ? data.level + '-' + data.repInLevel : '0-0';
    render();
  }
  down.addEventListener('click', () => step(-1));
  up.addEventListener('click', () => step(1));
  input.addEventListener('input', render);
  swap.addEventListener('click', () => {
    const reps = parseHAMRInput(input.value, mode);
    if (input.value.trim() && !getHAMRStats(reps)) return;
    const data = reps > 0 ? getHAMRRepData(reps) : null;
    mode = mode === 'reps' ? 'level' : 'reps';
    input.value = reps == null ? '' : mode === 'reps' ? String(reps)
      : data ? data.level + '-' + data.repInLevel : '0-0';
    render();
    input.focus(); input.select();
  });
  render();
}

// ================================================================
// SCORE CHARTS
// ================================================================
const CHART_STATE = { sex: 'Male', age: '< 25', event: 'run' };

const EVENT_META = {
  run:        { label: '2-Mile Run',            unit: 'Time (mm:ss)', isRun: true  },
  hamr:       { label: 'HAMR',                  unit: 'Reps'                       },
  hr_pushups: { label: 'Hand-Release Push-ups', unit: 'Reps'                       },
  pushups:    { label: 'Push-ups',              unit: 'Reps'                       },
  situps:     { label: 'Sit-ups',               unit: 'Reps'                       },
  rev_crunch: { label: 'Reverse Crunches',      unit: 'Reps'                       },
  plank:      { label: 'Plank',                 unit: 'Hold (mm:ss)', isTime: true },
  whtr:       { label: 'WHtR',                  unit: 'WHtR'                       },
};

function tierClass(pts, isCardio) {
  const max = isCardio ? 50 : 20;
  const p = pts / max;
  if (p >= 0.80) return 'excellent';
  if (p >= 0.65) return 'satisfactory';
  if (p >= 0.50) return 'marginal';
  return 'low';
}

function setupScoreCharts() {
  syncChartSexFromCalculator();
  syncChartAgeFromCalculator();

  document.querySelectorAll('[data-cgroup]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.cgroup;
      // Deactivate siblings with same cgroup
      document.querySelectorAll(`[data-cgroup="${group}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      CHART_STATE[group === 'chart_sex' ? 'sex' : group === 'chart_age' ? 'age' : 'event'] = btn.dataset.val;
      renderScoreChart();
    });
  });
  renderScoreChart();
}

function syncChartSexFromCalculator() {
  if (!state.sex) return;

  CHART_STATE.sex = state.sex;

  document.querySelectorAll('[data-cgroup="chart_sex"]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === state.sex);
  });
}

function syncChartAgeFromCalculator() {
  if (!state.age || isNaN(state.age)) return;

  const ageGroup = getAgeGroup(state.age);
  CHART_STATE.age = ageGroup;

  document.querySelectorAll('[data-cgroup="chart_age"]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === ageGroup);
  });
}

function renderScoreChart() {
  const { sex, age, event } = CHART_STATE;
  const meta = EVENT_META[event];
  const wrap = document.getElementById('chart-columns-wrap');
  const title = document.getElementById('chart-table-title');
  const minimumLabel = document.getElementById('chart-minimum');
  minimumLabel.hidden = true;

  if (event === 'whtr') {
    title.textContent = 'WHtR — All Ages & Sexes';
    renderWhtrChart(wrap);
    return;
  }

  title.textContent = `${meta.label} — ${sex}, Age ${age}`;

  const data = SCORE_DATA[sex][age];
  if (!data || !data[event]) { wrap.innerHTML = '<p class="dimmed">No data.</p>'; return; }

  const table = data[event];
  const minimum = getEventMin(sex, age, event);
  const minimumPoints = table[table.length - 1];
  minimumLabel.hidden = false;
  minimumLabel.textContent = event === 'run'
    ? 'Component requirement: finish in ' + fmtTime(minimum) + ' or faster · ' + minimumPoints + ' pts at the limit'
    : event === 'plank'
      ? 'Minimum hold: ' + fmtTime(minimum) + ' · ' + minimumPoints + ' pts'
      : 'Minimum: ' + minimum + ' reps · ' + minimumPoints + ' pts';
  const isCardio = event === 'run' || event === 'hamr';

  // Group rows by unique points value
  const ptMap = new Map();
  for (let i = 0; i < table.length; i += 2) {
    const pts = table[i+1];
    const val = table[i];
    if (!ptMap.has(pts)) ptMap.set(pts, []);
    ptMap.get(pts).push(val);
  }

  // Sort pts descending
  const ptsSorted = [...ptMap.keys()].sort((a,b) => b - a);

  let html = '';
  ptsSorted.forEach(pts => {
    const vals = ptMap.get(pts);
    const tc = tierClass(pts, isCardio);

    // Format thresholds
    const thresholds = vals.map(v => {
      if (event === 'run') return `≤ ${fmtTime(v)}`;
      if (meta.isTime)      return `≥ ${fmtTime(v)}`;
      return `≥ ${v}`;
    });

    html += `<div class="chart-band">
      <div class="chart-band-header">
        <div class="chart-pts-badge ${tc}">${pts}</div>
        <div class="chart-pts-sub">pts</div>
      </div>`;

    if (vals.includes(minimum)) html += '<div class="chart-minimum-tag">' + (event === 'run' ? 'Time limit' : 'Minimum') + '</div>';
    thresholds.forEach(t => {
      html += `<div class="chart-threshold ${tc}-bg">${t}</div>`;
    });

    html += `</div>`;
  });

  wrap.innerHTML = html;
}

function renderWhtrChart(wrap) {
  const rows = [
    { range: '< 0.50',       pts: 20   },
    { range: '0.50–0.509',   pts: 19   },
    { range: '0.51–0.519',   pts: 18   },
    { range: '0.52–0.529',   pts: 17   },
    { range: '0.53–0.539',   pts: 16   },
    { range: '0.54–0.549',   pts: 15   },
    { range: '0.55–0.559',   pts: 12.5 },
    { range: '0.56–0.569',   pts: 10   },
    { range: '0.57–0.579',   pts: 7.5  },
    { range: '0.58–0.589',   pts: 5    },
    { range: '0.59–0.599',   pts: 2.5  },
    { range: '≥ 0.60',       pts: 0    },
  ];

  let html = '';
  rows.forEach(r => {
    const tc = tierClass(r.pts, false);
    html += `<div class="chart-band">
      <div class="chart-band-header">
        <div class="chart-pts-badge ${tc}">${r.pts}</div>
        <div class="chart-pts-sub">pts</div>
      </div>
      <div class="chart-threshold ${tc}-bg">${r.range}</div>
    </div>`;
  });
  wrap.innerHTML = html;
}

// ================================================================
// PRINT
// ================================================================
function setupPrint() {
  document.getElementById('print-btn')?.addEventListener('click', () => window.print());
}
// Route native exercise pickers through the existing event controls.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.event-select').forEach(select => {
    select.addEventListener('change', () => {
      const button = document.querySelector('.pill[data-group="' + select.dataset.eventGroup + '"][data-val="' + select.value + '"]');
      if (button) button.click();
    });
  });
});

// Component colors use the same 90% / 75% rating boundaries as the total score.
function updateInputScoreBadges() {
  const heightHint = document.getElementById('hint-height_in');
  const hasHeight = Number.isFinite(state.heightIn) && state.heightIn > 0;
  heightHint.hidden = !hasHeight;
  if (hasHeight) {
    const feet = Math.floor(state.heightIn / 12);
    const inches = Number((state.heightIn % 12).toFixed(2));
    heightHint.textContent = feet + "′" + inches + "″";
    heightHint.setAttribute('aria-label', feet + ' feet ' + inches + ' inches');
  } else heightHint.textContent = '';
  const ageHint = document.getElementById('hint-age');
  const hasAge = Number.isFinite(state.age) && state.age >= 17 && state.age <= 80;
  ageHint.hidden = !hasAge;
  ageHint.textContent = hasAge ? getAgeGroup(state.age).replace('60 +', '60+').replace(' - ', '–') : '';
  ageHint.setAttribute('aria-label', 'Scoring age range: ' + ageHint.textContent);
  const ratioHint = document.getElementById('waist-ratio-hint');
  const hasRatio = state.heightIn > 0 && state.waistIn > 0;
  ratioHint.hidden = !hasRatio;
  ratioHint.textContent = hasRatio ? (state.waistIn / state.heightIn).toFixed(3) : '';
  ratioHint.setAttribute('aria-label', hasRatio ? 'Waist-to-height ratio: ' + ratioHint.textContent : 'Waist-to-height ratio');
  const ageReady = Number.isFinite(state.age) && state.age >= 17 && state.age <= 80 && state.sex;
  const ageGroup = ageReady ? getAgeGroup(state.age) : null;
  const components = [
    { id: 'hrpushup_val', label: 'Strength', event: state.strengthEvent, value: state.strengthVal, max: 15 },
    { id: 'core_val', label: 'Core', event: state.coreEvent, value: state.coreVal, max: 15 },
    { id: 'cardio_val', label: 'Run', event: state.cardioEvent, value: state.cardioVal, max: 50 },
    { id: 'waist_in', label: 'Waist-to-height ratio', max: 20 }
  ];
  components.forEach(component => {
    const badge = document.getElementById('badge-' + component.id);
    const isWaist = component.id === 'waist_in';
    const ready = isWaist
      ? state.heightIn > 0 && state.waistIn > 0
      : ageReady && Number.isFinite(component.value) && component.value >= 0;
    badge.hidden = !ready;
    const gap = document.getElementById('max-gap-' + component.id);
    if (gap) gap.hidden = true;
    if (!ready) { badge.textContent = ''; return; }
    const points = isWaist ? getWhtrPoints(state.waistIn / state.heightIn)
      : scoreEvent(state.sex, ageGroup, component.event, component.value);
    const rating = points / component.max >= .90 ? 'excellent'
      : points / component.max >= .75 ? 'satisfactory' : 'unsat';
    const label = rating === 'unsat' ? 'Unsatisfactory' : rating[0].toUpperCase() + rating.slice(1);
    badge.className = 'input-score-badge ' + rating;
    badge.classList.toggle('maxed', points >= component.max);
    badge.textContent = String(points);
    badge.title = component.label + ': ' + points + ' / ' + component.max + ' pts · ' + label;
    badge.setAttribute('aria-label', badge.title);
    if (gap && !(component.event === 'run' && component.value <= 0)) {
      const target = getEventMax(state.sex, ageGroup, component.event);
      const remaining = Math.max(0, component.event === 'run' ? component.value - target : target - component.value);
      gap.hidden = target == null;
      const unit = component.event === 'plank' ? 'seconds' : 'reps';
      gap.textContent = remaining === 0 ? 'Max' : component.event === 'run'
        ? '−' + fmtTime(remaining) : '+' + remaining + (component.event === 'plank' ? 's' : '');
      gap.title = remaining === 0 ? 'Full points reached' : component.event === 'run'
        ? fmtTime(remaining) + ' faster for full points'
        : remaining + ' more ' + unit + ' for full points';
      gap.setAttribute('aria-label', gap.title);
    }
  });
}

function parseHAMRInput(raw, mode) {
  if (!raw.trim()) return null;
  if (mode !== 'level') return /^\d+$/.test(raw) ? Number(raw) : null;
  if (raw === '0-0') return 0;
  const match = raw.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const level = HAMR_LEVELS.find(item => item.level === Number(match[1]));
  const shuttle = Number(match[2]);
  return level && shuttle >= 1 && shuttle <= level.repEnd - level.repStart + 1
    ? level.repStart + shuttle - 1 : null;
}

function setupHAMRInputSwap() {
  document.getElementById('hamr-input-swap').addEventListener('click', () => {
    const input = document.getElementById('cardio_val');
    const reps = state.cardioVal;
    const data = reps > 0 ? getHAMRRepData(reps) : null;
    const toLevel = input.dataset.hamrMode !== 'level';
    // Keep unconvertible totals editable instead of discarding them.
    if (toLevel && reps > 0 && !data) return;
    input.dataset.hamrMode = toLevel ? 'level' : 'reps';
    input.value = reps == null ? '' : toLevel
      ? data ? data.level + '-' + data.repInLevel : '0-0' : String(reps);
    liveCalc();
    input.focus();
    input.select();
  });
}

function updateHAMRInputSwap() {
  const input = document.getElementById('cardio_val');
  const button = document.getElementById('hamr-input-swap');
  const isHAMR = state.cardioEvent === 'hamr';
  button.hidden = !isHAMR;
  input.closest('.event-input-row').classList.toggle('hamr-input-row', isHAMR);
  if (!isHAMR) return;
  const levelMode = input.dataset.hamrMode === 'level';
  const data = state.cardioVal > 0 ? getHAMRRepData(state.cardioVal) : null;
  button.textContent = levelMode ? (state.cardioVal == null ? '—' : state.cardioVal) + ' reps'
    : data ? data.level + '-' + data.repInLevel : state.cardioVal === 0 ? '0-0' : 'L-R';
  button.setAttribute('aria-label', levelMode ? 'Switch to total repetitions input' : 'Switch to level and shuttle input');
  button.title = levelMode ? 'Total reps — tap to enter reps' : 'Level–shuttle — tap to enter level–shuttle';
  input.placeholder = levelMode ? '6-7' : '0';
  input.inputMode = levelMode ? 'text' : 'numeric';
  input.setAttribute('aria-label', levelMode ? 'HAMR level and shuttle, for example 6-7' : 'HAMR total repetitions');
  document.getElementById('cardio-unit').textContent = levelMode ? 'level-shuttle' : 'reps';
}
