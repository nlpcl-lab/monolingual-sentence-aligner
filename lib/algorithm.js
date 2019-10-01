// Base cost of removing or creating a single sentence
const COST_DISCONNECTED = 0;
// Adding or removing a charater
const COST_EDIT = 2;
// Moving a single sentence by 1
const COST_REORDER = 0;

// Cost for unknown operations
const COST_UNKNOWN = 999999;

const levenshtein = require('fast-levenshtein');
const { TOKEN } = require('./data.js');

let inclusion_dist = (x, y) =>
  levenshtein.get(x, y) - Math.abs(x.length - y.length);

class DisjointSet {
  constructor(data) {
    this.parent = this;
    this.rank = 0;
    this.data = data;
  }
  getRoot() {
    if (this.parent === this.parent.parent) return this.parent;
    if (this.parent !== this) this.parent = this.parent.getRoot();
    return this.parent;
  }
  union(that) {
    let xroot = this.getRoot(),
      yroot = that.getRoot();
    if (xroot === yroot) return;
    if (xroot.rank < yroot.rank) [xroot, yroot] = [yroot, xroot];
    yroot.parent = xroot;
    if (xroot.rank === yroot.rank) xroot.rank += 1;
  }
}

class Alignment {
  constructor(editPair) {
    this.editPair = editPair;
    this.xSents = editPair.diff.origSents;
    this.ySents = editPair.diff.revSents;
    this.xl = this.xSents.length;
    this.yl = this.ySents.length;
    this.initEdges();
  }
  initEdges() {
    this.xEdges = []; // this.xEdges[x] : {y | (x, y) in E}
    this.yEdges = []; // this.yEdges[y] : {x | (x, y) in E}
    for (let x = 0; x < this.xl; x++) this.xEdges[x] = new Set();
    for (let y = 0; y < this.yl; y++) this.yEdges[y] = new Set();
  }
  addEdge(x, y) {
    this.xEdges[x].add(y);
    this.yEdges[y].add(x);
  }
  addEdges(xs, ys) {
    xs.forEach(x => ys.forEach(y => this.addEdge(x, y)));
  }
  removeEdge(x, y) {
    this.xEdges[x].remove(y);
    this.yEdges[y].remove(x);
  }
  // Computes the connected components
  getClusters() {
    let xd = [],
      yd = [];
    let clusters = [];
    let clusterID = {},
      currCID = 0;
    for (let x = 0; x < this.xl; x++) xd[x] = new DisjointSet(2 * x);
    for (let y = 0; y < this.yl; y++) yd[y] = new DisjointSet(2 * y + 1);
    for (let x = 0; x < this.xl; x++) {
      for (let y of this.xEdges[x]) xd[x].union(yd[y]);
    }
    for (let y = 0; y < this.yl; y++) {
      for (let x of this.yEdges[y]) xd[x].union(yd[y]);
    }
    for (let x = 0; x < this.xl; x++) {
      let c = xd[x].getRoot().data;
      if (!(c in clusterID)) {
        clusters[currCID] = [[], []];
        clusterID[c] = currCID++;
      }
      clusters[clusterID[c]][0].push(x);
    }
    for (let y = 0; y < this.yl; y++) {
      let c = yd[y].getRoot().data;
      if (!(c in clusterID)) {
        clusters[currCID] = [[], []];
        clusterID[c] = currCID++;
      }
      clusters[clusterID[c]][1].push(y);
    }
    return clusters;
  }
  toString() {
    return `[Alignment ${this.xl}x${this.yl} for ${
      this.editPair.id
    }]\n${this.getClusterString()}`;
  }
  toExportString() {
    return `align ${this.editPair.id}\n${this.getClusterString()}`;
  }
  getTableString() {
    let lines = [];
    for (let x = 0; x < this.xl; x++) {
      let line = [];
      for (let y = 0; y < this.yl; y++)
        line.push(this.xEdges[x].has(y) ? 'X' : ' ');
      lines.push('|' + line.join('') + '|');
    }
    return lines.join('\n');
  }
  getClusterString() {
    return this.getClusters()
      .map(([xs, ys]) => {
        let xStr = xs
          .map(ind => `\t${this.xSents[ind].replace(/\s/g, ' ')}`)
          .join('\n');
        let yStr = ys
          .map(ind => `\t${this.ySents[ind].replace(/\s/g, ' ')}`)
          .join('\n');
        return `pair [${xs.join(' ')}] [${ys.join(
          ' '
        )}]\nX sentences\n${xStr}\nY sentences\n${yStr}`;
      })
      .join('\n');
  }
  getJSONFormat() {
    return this.getClusters().map(([xs, ys]) => {
      let xStr = xs.map(ind => this.xSents[ind].replace(/\s/g, ' '));
      let yStr = ys.map(ind => this.ySents[ind].replace(/\s/g, ' '));
      return {
        x: {
          ids: xs,
          body: xStr
        },
        y: {
          ids: ys,
          body: yStr
        }
      };
    });
  }
}

// Create an alignment directly from diff
Alignment.useDiff = editPair => {
  const align = new Alignment(editPair);
  let currX = 0,
    currY = 0;
  // Pair sentences with identical STR tokens
  editPair.diff.tokens.forEach(token => {
    if (TOKEN.isBorder(token.type)) {
      if (token.type !== TOKEN.INS_BD) currX++;
      if (token.type !== TOKEN.DEL_BD) currY++;
    } else {
      if (token.type === TOKEN.STR && token.value.trim())
        align.addEdge(currX, currY);
    }
  });
  let xOrphans = new Set(),
    yOrphans = new Set();
  let xNSents = [],
    yNSents = []; // Normalized sentences
  for (let x = 0; x < align.xl; x++) {
    xNSents[x] = align.xSents[x].toLowerCase().replace(/\s+/g, '');
    if (align.xEdges[x].size === 0) xOrphans.add(x);
  }
  for (let y = 0; y < align.yl; y++) {
    yNSents[y] = align.ySents[y].toLowerCase().replace(/\s+/g, '');
    if (align.yEdges[y].size === 0) yOrphans.add(y);
  }
  // All sentences are perfectly paired!
  if (xOrphans.size === 0 && yOrphans.size === 0) return align;

  // Find a perfect pair (reordering)
  for (let xo of xOrphans) {
    yLoop: for (let yo of yOrphans) {
      if (xNSents[xo] === yNSents[yo]) {
        align.addEdge(xo, yo);
        xOrphans.delete(xo);
        yOrphans.delete(yo);
        break yLoop;
      }
    }
  }

  // Find a sentence which will be aligned to the orphan sentences.
  let processOrphans = (self, other, addEdge) => {
    for (let o of self.orphans) {
      // indices of first sentences before and after the orphan which is not an orphan
      let o_before = o - 1,
        o_after = o + 1;
      let sent = self.nSents[o];

      // clip o_before and o_after
      if (o_before < 0) o_before = 0;
      if (o_after >= self.edges.length) o_after = self.edges.length - 1;

      while (o_before > 0 && self.orphans.has(o_before)) o_before--;
      while (o_after < self.edges.length - 1 && self.orphans.has(o_after))
        o_after++;

      let candidates = new Set();
      for (let c of self.edges[o_before]) candidates.add(c);
      for (let c of self.edges[o_after]) candidates.add(c);
      for (let c of other.orphans) candidates.add(c);

      let min_cost = COST_DISCONNECTED + sent.length,
        min_c = -1;
      for (let c of candidates) {
        let otherSent = other.nSents[c];
        // Edit distance
        let edit_cost = inclusion_dist(sent, otherSent);
        // Panelty for shortening
        edit_cost += Math.max(0, sent.length - otherSent.length);
        // Panelty for inclusion
        // TODO: find how much of otherSent is explained by other sentences
        if (otherSent.length > sent.length) {
          edit_cost += Math.sqrt((edit_cost * otherSent.length) / sent.length);
        }
        edit_cost *= COST_EDIT;
        if (edit_cost < min_cost) {
          min_cost = edit_cost;
          min_c = c;
        }
      }

      min_cost /= sent.length;

      // console.log("L", self.edges.length, "COST", min_cost, o, "->", min_c);
      // console.log(">", self.sents[o]);
      // console.log(">", other.sents[min_c]);

      if (min_c >= 0) {
        // console.log("ADD");
        self.orphans.delete(o);
        other.orphans.delete(min_c);
        addEdge(o, min_c);
      }
    }
  };

  let iter = 0;
  let xObj = {
    orphans: xOrphans,
    nSents: xNSents,
    sents: align.xSents,
    edges: align.xEdges
  };
  let yObj = {
    orphans: yOrphans,
    nSents: yNSents,
    sents: align.ySents,
    edges: align.yEdges
  };
  while ((xOrphans.size > 0 || yOrphans.size > 0) && iter++ < 2) {
    // console.log("Iteration %d (x%d, y%d)", iter, xOrphans.size, yOrphans.size);
    processOrphans(xObj, yObj, (x, y) => align.addEdge(x, y));
    processOrphans(yObj, xObj, (y, x) => align.addEdge(x, y));
  }
  // console.log(xOrphans, yOrphans);
  return align;
};

let alignSentences = editPair => {
  return Alignment.useDiff(editPair);
};

module.exports = alignSentences;
