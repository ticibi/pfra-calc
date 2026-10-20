const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = { document: { addEventListener() {} } };
vm.createContext(context);
const root = path.resolve(__dirname, '..');
vm.runInContext(fs.readFileSync(path.join(root,'scoreData.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'script.js'),'utf8'),context);
// Independent fixed schedule for the app's supported 100 shuttles.
const schedule = [[7,8.9],[8,8.1],[8,7.6],[9,7.3],[9,6.9],[9,6.6],[10,6.2],[10,6],[11,5.8],[11,5.6],[8,5.4]];
const durations = schedule.flatMap(([count,seconds])=>Array(count).fill(seconds));
const close = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
for(let reps=1;reps<=100;reps++) {
 const expectedElapsed = durations.slice(0,reps).reduce((sum,value)=>sum+value,0);
 const stats = context.getHAMRStats(reps);
 close(stats.elapsed,expectedElapsed);
 assert.equal(stats.distance,reps*20);
 close(stats.avgBeep,expectedElapsed/reps);
 close(stats.mph,(reps*20/1609.344)/(expectedElapsed/3600));
 close(stats.lap,expectedElapsed*400/(reps*20));
 close(stats.twoMile,expectedElapsed*3218.688/(reps*20));
 close(stats.miles,reps*20/1609.344);
}
assert.equal(context.getHAMRStats(0).distance,0);
assert.equal(context.getHAMRStats(0).mph,null);
for(const value of [null,NaN,-1,101,1.5,'48'])assert.equal(context.getHAMRStats(value),null);
assert.equal(context.parseHAMRInput('6-7','level'),48);
assert.equal(context.parseHAMRInput('6-10','level'),null);
console.log('HAMR stats passed for all 100 shuttles, zero, invalid inputs, and level conversion. Schedule accuracy itself is not certified by these arithmetic tests.');
