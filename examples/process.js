const IN_FILE = '../data/sample.json';
const OUT_FILE = './out.txt';

const fs = require('fs');
const { Diff, EditPair } = require('../lib/data.js');
const alignSentences = require('../lib/algorithm.js');

console.log(`Processing ${IN_FILE}...`);
console.time('read file');
const raw_data = JSON.parse(fs.readFileSync(IN_FILE, 'utf-8')).map(
  obj => new EditPair(obj)
);
console.timeEnd('read file');

console.log(`Read ${raw_data.length} entries. Aligning...`);
console.time('aligning');
let alignments = raw_data.map(pair => alignSentences(pair));
console.timeEnd('aligning');

console.log(`Aligning completed. Saving to ${OUT_FILE}...`);
fs.writeFileSync(
  OUT_FILE,
  alignments.map(align => align.toExportString()).join('\n'),
  'utf-8'
);

console.log('Computing stats:');
// Stats
let one2one = 0; // single sentence - single sentence
let one2many = 0;
let many2one = 0; // single sentence - multiple sentences
let many2many = 0; // multiple sentences rearranged
let deletions = 0;
let additions = 0; // sentence deletions and additions

alignments.forEach(align => {
  align.getClusters().forEach(cluster => {
    if (cluster[0].length === 0) additions++;
    else if (cluster[1].length === 0) deletions++;
    else if (cluster[0].length === 1) {
      if (cluster[1].length === 1) one2one++;
      else one2many++;
    } else {
      if (cluster[1].length === 1) many2one++;
      else many2many++;
    }
  });
});

console.log(
  '%d sentences paired. 1:m %d / n:1 %d / n:m %d',
  one2one,
  one2many,
  many2one,
  many2many
);
console.log(
  '%d sentences from orig and %d sentences from rev are not paired.',
  deletions,
  additions
);

// console.log(raw_data);
