# Monolingual Sentence Aligner

## Index

- [Setup](#Setup)
- [Files and Classes](#Files-and-Classes)
- [Example](#Example)
- [Documentation](#Documentation)

## Setup

```bash
npm install monolingual-sentence-aligner
```

## Files and Classes

- algorithm.js

  - class Alignment: represents a sentence alignment, in the form of bigraph.

- data.js

  - class Sentences: represents a list of sentences. Its constructor receives a string and splits them into sentences.
  - class Diff: represents a diff file. Its constructor processes a diff string and splits them into tokens, including sentence boundaries.
  - class EditPair: represents an edit pair (an element in raw data array).

- sentence_boundary.js:  
  a wrapper for NPM sbd package with custom settings and fixing some output

- process.js:  
  The main entry, containing the general flow of processing.

## Example

See details at [example.js](examples/example.js).

- `data/sample.json`

```json
[
  {
    "id": "01",
    "diff": "Hello, world! <del>My</del><ins>I will introduce that my</ins> name is Foo."
  },
  {
    "id": "02",
    "diff": "The Stanton house <del>as it exists now in the present day </del>still shows evidence of <del>the attempt of </del>Cady Stanton<ins>'s attempt</ins> to simplify her household duties.<ins>The novel </ins>Tom Jones <del>is a novel that </del>comically portrays English society in the middle Eighteenth Century."
  }
]
```

- `examples/example.js`

```javascript
const aligner = require('monolingual-sentence-aligner');

var aligned = aligner('data/sample.json');

console.log(aligned.stats);
aligned.res.forEach(entry => {
  entry.forEach(el => {
    console.log(el);
  });
});
```

- result

```
{
  one2one: 4,
  one2many: 0,
  many2one: 0,
  many2many: 0,
  deletions: 0,
  additions: 0
}
{
  x: { ids: [ 0 ], body: [ 'Hello, world!' ] },
  y: { ids: [ 0 ], body: [ 'Hello, world!' ] }
}
{
  x: { ids: [ 1 ], body: [ 'My name is Foo.' ] },
  y: { ids: [ 1 ], body: [ 'I will introduce that my name is Foo.' ] }
}
{
  x: {
    ids: [ 0 ],
    body: [
      'The Stanton house as it exists now in the present day still shows evidence of the attempt of Cady Stanton to simplify her household duties.'
    ]
  },
  y: {
    ids: [ 0 ],
    body: [
      "The Stanton house still shows evidence of Cady Stanton's attempt to simplify her household duties."
    ]
  }
}
{
  x: {
    ids: [ 1 ],
    body: [
      'Tom Jones is a novel that comically portrays English society in the middle Eighteenth Century.'
    ]
  },
  y: {
    ids: [ 1 ],
    body: [
      'The novel Tom Jones comically portrays English society in the middle Eighteenth Century.'
    ]
  }
}
```

## Documents

- `Alignment`
  - `Alignment.getClusterString()`
    Returns result of the alignment in a readable text form. We recommend writing the result in a txt file.
  - `Alignment.getJSONFormat()`
    Returns json format of the alignment result.  
    Format:
    ```javascript
    [{ x: { ids: [], body: '' }, y: { ids: [], body: '' } }];
    ```
- `aligner(inputFileName)`  
  Returns two type of result: `stats`, `res`.
  `stats` contains number of one2one, one2many, many2one, many2many, deletions, and additions.  
  `res` contains the result of `Alignment.getJSONFormat()`.

- input  
  The input file should contain at least two attributes: `id`, and `diff`.
  `id` should be unique, and the `diff` contains information of original & revision sentences.  
  The XML-like tag `<ins>` means revision text is made from insertion to the original text, `<del>` means deletion from original text makes revision text.

  For example:

  ```
  Origin: Hello! My name is Foo.
  Revision: Hello! I'm Foo.
  Diff: Hello! <del>My name is</del><ins>I'm</ins> Foo.
  ```
