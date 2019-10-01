const aligner = require('monolingual-sentence-aligner');

var aligned = aligner('data/sample.json');

console.log(aligned.stats);
aligned.res.forEach(entry => {
  entry.forEach(el => {
    console.log(el);
  });
});
