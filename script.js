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
  if (!str) return null;
  str = str.trim();
  if (str.includes(':')) {
    const parts = str.split(':');
    const min = parseInt(parts[0], 10);
    const secRaw = (parts[1] || '').replace(/\D/g, '').slice(0, 2);

    if (isNaN(min)) return null;
    if (!secRaw) return min * 60;

    // While typing, treat a single second digit as tens (e.g. 12:3 -> 12:30)
    let sec = secRaw.length === 1 ? parseInt(secRaw, 10) * 10 : parseInt(secRaw, 10);
    if (isNaN(sec)) sec = 0;
    sec = Math.max(0, Math.min(59, sec));

    return min * 60 + sec;
  }

  const digits = str.replace(/\D/g, '').slice(0, 4);
  if (!digits) return null;
  if (digits.length <= 2) return parseInt(digits, 10) * 60;

  const min = parseInt(digits.slice(0, 2), 10);
  let sec = parseInt(digits.slice(2), 10);
  if (isNaN(min)) return null;
  if (isNaN(sec)) sec = 0;
  sec = Math.max(0, Math.min(59, sec));
  return min * 60 + sec;
}

function formatRunInputValue(raw) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

// ---- Rating ----
function getRating(score) {
  if (score >= 90) return { label: 'Excellent',      cls: 'excellent' };
  if (score >= 75) return { label: 'Satisfactory',   cls: 'satisfactory' };
  if (score >= 70) return { label: 'Marginal',        cls: 'marginal' };
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
  renderHAMRTable();
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
      updateSilhouette();
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
        state.cardioEvent = pill.dataset.val;
        document.getElementById('cardio-unit').textContent = pill.dataset.val === 'hamr' ? 'reps' : 'mm:ss';
        document.getElementById('cardio_val').placeholder = pill.dataset.val === 'hamr' ? '0' : '00:00';
      }
      liveCalc();
    });
  });

  // Event value inputs — live recalc
  ['hrpushup_val', 'core_val', 'cardio_val'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      if (id === 'cardio_val' && state.cardioEvent === 'run') {
        const cardioInput = document.getElementById('cardio_val');
        cardioInput.value = formatRunInputValue(cardioInput.value);
      }
      readEventInputs();
      liveCalc();
    });
  });

  updateWhtrLive();
  liveCalc();
}

function updateSilhouette() {
  const isMale = state.sex === 'Male';
  document.getElementById('stick-male').style.display   = isMale ? '' : 'none';
  document.getElementById('stick-female').style.display = isMale ? 'none' : '';
  // Female waist bracket is baked into stick-female at y=83; male at y=95 — no JS needed
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
    state.cardioVal = parseRunTime(cardioRaw);
  } else {
    state.cardioVal = cardioRaw !== '' ? parseInt(cardioRaw) : null;
  }
}

function liveCalc() {
  // Need sex + age + height + waist at minimum to show anything
  if (!state.sex || !state.age || !state.heightIn || !state.waistIn) {
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
  const rating = getRating(total);

  renderScorePanel(total, rating, waistPts, strPts, corePts, cardioPts);

  // Goal planner
  const nextGoal = getNextGoal(total);
  renderGoalBanner(total, nextGoal);
  renderGoals({
    sex: state.sex, ageGroup,
    whtr, waistPts,
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
        suggestions.push({
          event: strEv, label: lbl, category: 'strength',
          currentVal: strVal, targetVal: hit.thresh,
          currentPts: strPts, targetPts: hit.pts,
          ptGain: hit.gain,
          valDiff: hit.thresh - strVal,
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
        suggestions.push({
          event: coreEv, label: lbl, category: 'core',
          currentVal: coreVal, targetVal: hit.thresh,
          currentPts: corePts, targetPts: hit.pts,
          ptGain: hit.gain,
          valDiff: hit.thresh - coreVal,
          direction: 'up', unit: coreEv === 'plank' ? 'sec' : 'reps'
        });
      }
    }
  }

  // ---- Cardio ----
  const { cardioEvent: cardEv, cardioVal, cardioPts } = inputs;
  if (cardEv && cardioVal !== null && !isNaN(cardioVal) && data[cardEv]) {
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
  const { whtr: waistWhtr, waistPts } = inputs;
  if (waistWhtr !== null && !isNaN(waistWhtr) && waistPts < 20) {
    const brackets = [0.599,0.589,0.579,0.569,0.559,0.549,0.539,0.529,0.519,0.509,0.499];
    const pts      = [2.5,  5,    7.5,  10,   12.5, 15,   16,   17,   18,   19,   20  ];
    // Find minimum WHtR drop that achieves needed pts gain
    for (let i = brackets.length - 1; i >= 0; i--) {
      if (pts[i] > waistPts && brackets[i] < waistWhtr) {
        const gain = pts[i] - waistPts;
        if (gain >= needed) {
          suggestions.push({
            event: 'waist', label: 'WHtR', category: 'waist',
            currentVal: waistWhtr, targetVal: brackets[i],
            currentPts: waistPts, targetPts: pts[i],
            ptGain: gain,
            valDiff: parseFloat((waistWhtr - brackets[i]).toFixed(3)),
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

    if (singles.length) {
      html += '<div class="goal-section-title">⚡ Single-Event Paths</div>';
      singles.forEach(c => { html += renderComboCard(c); });
    }
    if (multis.length) {
      html += '<div class="goal-section-title">🔀 Combinations</div>';
      multis.slice(0,4).forEach(c => { html += renderComboCard(c); });
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
      changeStr = `↓ ${item.valDiff} → ≤ ${item.targetVal.toFixed(3)}`;
    } else {
      changeStr = `+${item.valDiff} reps → ${item.targetVal}`;
    }
    html += `<div class="combo-item">
      <span class="combo-event">${item.label}</span>
      <span class="combo-change">${changeStr}</span>
      <span class="combo-gain">+${item.ptGain.toFixed(1)} pts</span>
    </div>`;
  });
  html += `<div class="combo-total">Total gain: +${combo.totalGain.toFixed(1)} pts</div></div>`;
  return html;
}

// ================================================================
// HAMR EXPLORER
// ================================================================
function setupHAMR() {
  const slider  = document.getElementById('hamr-rep-slider');
  const input   = document.getElementById('hamr-rep-input');
  const display = document.getElementById('hamr-rep-display');

  function syncHAMR(val) {
    val = Math.max(1, Math.min(100, parseInt(val) || 1));
    slider.value = val;
    input.value  = val;
    display.textContent = val;
    updateHAMRDisplay(val);
  }

  slider.addEventListener('input', () => syncHAMR(slider.value));
  input.addEventListener('input',  () => syncHAMR(input.value));
  syncHAMR(54);

  // Comparison
  const cmpSlider = document.getElementById('hamr-cmp-slider');
  const cmpInput  = document.getElementById('hamr-cmp-input');

  function syncCmp(val) {
    val = Math.max(1, Math.min(100, parseInt(val) || 1));
    cmpSlider.value = val;
    cmpInput.value  = val;
    updateHAMRComparison();
  }

  cmpSlider.addEventListener('input', () => syncCmp(cmpSlider.value));
  cmpInput.addEventListener('input',  () => syncCmp(cmpInput.value));
  syncCmp(72);
}

function updateHAMRDisplay(rep) {
  const d = getHAMRRepData(rep);
  if (!d) return;

  // Level – Rep (e.g. "7 – 10")
  document.getElementById('hamr-level-rep').textContent = `${d.level} – ${d.repInLevel}`;
  document.getElementById('hamr-elapsed').textContent   = fmtTime(d.elapsed);
  document.getElementById('hamr-beep').textContent      = d.secPerBeep.toFixed(1) + 's';
  document.getElementById('hamr-speed-mph').textContent = d.mph.toFixed(2) + ' mph';
  document.getElementById('hamr-speed-ms').textContent  = d.ms.toFixed(2) + ' m/s';
  document.getElementById('hamr-equiv').textContent     = fmtTime(d.equiv2mi);

  // Distance in meters and miles
  const distM  = rep * 20;
  const distMi = (distM * 0.000621371).toFixed(3);
  document.getElementById('hamr-dist-m').textContent  = distM + ' m';
  document.getElementById('hamr-dist-mi').textContent = distMi + ' mi';

  // Track lap pace: how fast a lap (¼ mile = 402.336m) at this speed
  // Speed in m/s → time for 402.336m = 402.336 / ms seconds
  const lapSec = 402.336 / d.ms;
  document.getElementById('hamr-lap-pace').textContent = fmtTime(lapSec);

  updateHAMRComparison();
}

function updateHAMRComparison() {
  const curRep = parseInt(document.getElementById('hamr-rep-input').value);
  const tgtRep = parseInt(document.getElementById('hamr-cmp-input').value);
  const el = document.getElementById('hamr-comparison');

  if (isNaN(curRep) || isNaN(tgtRep)) { el.innerHTML = ''; return; }

  const cur = getHAMRRepData(Math.min(curRep, 100));
  const tgt = getHAMRRepData(Math.min(tgtRep, 100));
  if (!cur || !tgt) return;

  if (tgtRep <= curRep) {
    el.innerHTML = '<p class="dimmed">Set a target higher than current reps.</p>';
    return;
  }

  const timeDiff = cur.equiv2mi - tgt.equiv2mi;
  el.innerHTML = `
    <div class="cmp-grid">
      <div class="cmp-col">
        <div class="cmp-label">Current — ${curRep} reps</div>
        <div class="cmp-val">${fmtTime(cur.equiv2mi)}</div>
        <div class="cmp-sub">Lvl ${cur.level} · ${cur.mph} mph</div>
      </div>
      <div class="cmp-arrow">→</div>
      <div class="cmp-col target">
        <div class="cmp-label">Target — ${tgtRep} reps</div>
        <div class="cmp-val">${fmtTime(tgt.equiv2mi)}</div>
        <div class="cmp-sub">Lvl ${tgt.level} · ${tgt.mph} mph</div>
      </div>
    </div>
    <div class="cmp-delta">+${tgtRep - curRep} reps = ${fmtTime(timeDiff)} faster 2-mile equivalent</div>
  `;
}

// ================================================================
// HAMR TABLE — grouped by level, compact cells
// ================================================================
function renderHAMRTable(filterRep) {
  const container = document.getElementById('hamr-level-groups');
  let html = '';

  HAMR_LEVELS.forEach(lvl => {
    // Collect reps for this level (apply filter if set)
    const repData = [];
    for (let r = lvl.repStart; r <= lvl.repEnd; r++) {
      if (filterRep !== undefined && r !== filterRep) continue;
      repData.push(getHAMRRepData(r));
    }
    if (repData.length === 0) return;

    html += `<div class="hamr-level-group">
      <div class="hamr-level-header">
        <span class="hamr-level-badge">LVL ${lvl.level}</span>
        <span class="hamr-level-meta">
          <span class="sec-per-shuttle">${lvl.secPerBeep}s</span>/shuttle
          &nbsp;·&nbsp; ${lvl.mph} mph
          &nbsp;·&nbsp; reps ${lvl.repStart}–${lvl.repEnd}
        </span>
      </div>
      <div class="hamr-reps-grid">`;

    repData.forEach(d => {
      html += `<div class="hamr-rep-cell">
        <div class="cell-lv-rep">${lvl.level}&nbsp;–&nbsp;${d.repInLevel}</div>
        <div class="cell-shuttles">${d.rep} shuttles</div>
        <div class="cell-equiv">${fmtTime(d.equiv2mi)}</div>
        <div class="cell-elapsed">${fmtTime(d.elapsed)}</div>
      </div>`;
    });

    html += `</div></div>`;
  });

  container.innerHTML = html || '<p class="dimmed">No reps match.</p>';
}

// Wire search
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hamr-table-search').addEventListener('input', e => {
    const v = parseInt(e.target.value.trim());
    renderHAMRTable(isNaN(v) ? undefined : v);
  });
});

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

  if (event === 'whtr') {
    title.textContent = 'WHtR — All Ages & Sexes';
    renderWhtrChart(wrap);
    return;
  }

  title.textContent = `${meta.label} — ${sex}, Age ${age}`;

  const data = SCORE_DATA[sex][age];
  if (!data || !data[event]) { wrap.innerHTML = '<p class="dimmed">No data.</p>'; return; }

  const table = data[event];
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
    html += `<div class="chart-band" style="min-width:110px;">
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