module.exports = {
  entry: './main.js',
  output: {
    library: 'monolingual-sentence-aligner',
    libraryTarget: 'umd',
    filename: 'aligner.js',
    auxiliaryComment: 'Test Comment'
  },
  target: 'node'
};
