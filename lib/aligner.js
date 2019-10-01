const fs = require('fs');
const { Diff, EditPair } = require('./data.js');
const alignSentences = require('./algorithm.js');

function logIfVerbose(logStr, verbose) {
  if (verbose) console.log(logStr);
}

function aligner(inFileName, verbose = false) {
  logIfVerbose(`Processing ${inFileName}...`, verbose);
  const raw_data = JSON.parse(fs.readFileSync(inFileName, 'utf-8')).map(
    obj => new EditPair(obj)
  );

  logIfVerbose(`Read ${raw_data.length} entries. Aligning...`, verbose);
  let alignments = raw_data.map(pair => alignSentences(pair));

  /*
  logIfVerbose(`Aligning completed. Saving to ${outFileName}...`, verbose);
  fs.writeFileSync(
    outFileName,
    alignments.map(align => align.toExportString()).join('\n'),
    'utf-8'
  );
  */

  logIfVerbose('Aligning completed. Calculating stats....', verbose);

  let one2one = 0;
  let one2many = 0;
  let many2one = 0;
  let many2many = 0;
  let deletions = 0;
  let additions = 0;

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

  logIfVerbose('Completed.', verbose);

  return {
    res: alignments.map(align => align.getJSONFormat()),
    stats: {
      one2one: one2one,
      one2many: one2many,
      many2one: many2one,
      many2many: many2many,
      deletions: deletions,
      additions: additions
    }
  };
}

module.exports = aligner;
