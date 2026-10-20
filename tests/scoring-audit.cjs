const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const reference = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/official-pfra-reference.json'), 'utf8'));
const context = { document: { addEventListener() {} } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'scoreData.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'script.js'), 'utf8') + '\nthis.tables = SCORE_DATA;', context);
let tables = 0, chartRows = 0, eventCases = 0, waistCases = 0, compositeCases = 0, ageCases = 0;
const ambiguities = [];
function referenceScore(table, event, value) {
  if (event === 'run' && value <= 0) return 0;
  const eligible = [];
  for (let i = 0; i < table.length; i += 2) {
    if (event === 'run' ? value <= table[i] : value >= table[i]) eligible.push(table[i + 1]);
  }
  return eligible.length ? Math.max(...eligible) : 0;
}
for (const [sex, groups] of Object.entries(reference.tables)) {
  for (const [age, events] of Object.entries(groups)) {
    for (const [event, table] of Object.entries(events)) {
      tables++;
      assert.deepEqual(JSON.parse(JSON.stringify(context.tables[sex][age][event])), table, `${sex}/${age}/${event} chart cells`);
      const seen = new Map();
      for (let i = 0; i < table.length; i += 2) {
        chartRows++;
        if (seen.has(table[i])) ambiguities.push({ sex, age, event, threshold: table[i], points: [seen.get(table[i]), table[i + 1]] });
        seen.set(table[i], table[i + 1]);
      }
      // Exhaustive whole-rep/whole-second domain, including both sides of every boundary.
      const limit = event === 'run' ? 3600 : event === 'plank' ? 400 : 150;
      for (let value = 0; value <= limit; value++) {
        const expected = referenceScore(table, event, value);
        assert.equal(context.scoreEvent(sex, age, event, value), expected, `${sex}/${age}/${event}/${value}`);
        eventCases++;
      }
      assert.equal(context.scoreEvent(sex, age, event, null), 0);
      assert.equal(context.scoreEvent(sex, age, event, NaN), 0);
      eventCases += 2;
    }
    // All age/sex profiles share the official WHtR chart. Integer ticks avoid rounding the oracle.
    const points = {49:20,50:19,51:18,52:17,53:16,54:15,55:12.5,56:10,57:7.5,58:5,59:2.5};
    for (let ticks = 4000; ticks <= 6500; ticks++) {
      const band = Math.floor(ticks / 100);
      const expected = band < 50 ? 20 : band >= 60 ? 0 : points[band];
      assert.equal(context.getWhtrPoints(ticks / 10000), expected, `WHtR ${sex}/${age}/${ticks}`);
      waistCases++;
    }
    for (const strength of ['pushups', 'hr_pushups']) for (const core of ['situps', 'rev_crunch', 'plank']) for (const cardio of ['run', 'hamr']) {
      const maxima = [strength, core, cardio].map(event => context.scoreEvent(sex, age, event, events[event][0]));
      assert.equal(maxima.reduce((a,b)=>a+b,20),100);
      assert.equal(context.getRating(100,maxima).cls,'excellent');
      assert.equal(context.getRating(80,maxima).cls,'satisfactory'); // WHtR has no required minimum.
      for (let missed = 0; missed < 3; missed++) {
        const values = [...maxima]; values[missed] = 0;
        assert.equal(context.getRating(values.reduce((a,b)=>a+b,20),values).cls,'unsat');
      }
      compositeCases += 6;
    }
  }
}
for (const [age, expected] of [[17,'< 25'],[24,'< 25'],[25,'25 - 29'],[29,'25 - 29'],[30,'30 - 34'],[34,'30 - 34'],[35,'35 - 39'],[39,'35 - 39'],[40,'40 - 44'],[44,'40 - 44'],[45,'45 - 49'],[49,'45 - 49'],[50,'50 - 54'],[54,'50 - 54'],[55,'55 - 59'],[59,'55 - 59'],[60,'60 +'],[80,'60 +']]) {
  assert.equal(context.getAgeGroup(age),expected); ageCases++;
}
for (const [score,cls] of [[0,'unsat'],[70,'unsat'],[74.9,'unsat'],[75,'satisfactory'],[89.9,'satisfactory'],[90,'excellent'],[100,'excellent']]) {
  assert.equal(context.getRating(score,[15,15,50]).cls,cls); compositeCases++;
}
const report = { status: 'PASS against the downloaded reference; latest corrected revision not certified', source: reference.source, sourceNote: reference.sourceNote, sha256: reference.sha256, profiles:18, tables, chartRows, eventCases, waistCases, compositeCases, ageCases, totalAssertions: tables + eventCases + waistCases + compositeCases + ageCases, sourceAmbiguities: ambiguities };
console.log(JSON.stringify(report,null,2));
if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(report,null,2)+'\n');
