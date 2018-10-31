# Monolingual Sentence Aligner


## Setup

This code uses Node.js (https://nodejs.org).
Use `npm install` to install the dependencies of the code.

Execute `node process.js` to process the file located at `data/sample.json`.
This can be changed by modifying the first line of `process.js`.

Align results will be placed at `out.txt`.
Again, this can be changed by modifying the second line of `process.js`.

## Files and Classes

- algorithm.js
  - class Alignment: represents a sentence alignment, in a form of bigraph.

- data.js
  - class Sentences: represents a list of sentences. Its constructor receives a string and splits them into sentences.
  - class Diff: represents a diff file. Its constructor processes a diff string and splits them into tokens, including sentence boundaries.
  - class EditPair: represents an edit pair (an element in raw data array).

- sentence_boundary.js:  
a wrapper for NPM sbd package with custom settings and fixing some output

- process.js:  
The main entry, contains general flow of processing.
