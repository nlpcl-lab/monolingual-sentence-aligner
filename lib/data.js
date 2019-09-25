const entities = require('entities');
const sbd = require('./sentence_boundary.js');
// Token types for diff string
// STR: not changed, DEL: removed, INS: inserted
// SBD: sentence border (not changed), DEL_BD: sentence border removed, INS_BD: sentence border created
const TOKEN = {
  STR: '=',
  DEL: '-',
  INS: '+',
  SBD: '/',
  DEL_BD: '-/',
  INS_BD: '+/'
};
TOKEN.isBorder = x =>
  x === TOKEN.SBD || x === TOKEN.DEL_BD || x === TOKEN.INS_BD;
const UNICODE_REPLACE = {
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"'
};

let unescapeHTML = str => entities.decodeXML(str); //.replace(/[\u2019\u201c\u201d]/g, (x) => UNICODE_REPLACE[x]));

// A class which contains splitted sentences
class Sentences {
  constructor(str) {
    this.raw_string = str;
    this.sentences = sbd(str);
  }
}

// A class which holds information on diff tokens
class Diff {
  constructor(str) {
    str = str.replace(/\n+|[\s-#=_+*]{4,}/g, '\n');
    let regex = /<(del|ins)[^>]+>([^<]*)<\/[^>]+>|([^<>]+)/g;
    let result,
      tokens = [];
    while ((result = regex.exec(str)) !== null) {
      switch (result[1]) {
        case 'ins':
          if (result[2])
            tokens.push({ type: TOKEN.INS, value: unescapeHTML(result[2]) });
          break;
        case 'del':
          if (result[2])
            tokens.push({ type: TOKEN.DEL, value: unescapeHTML(result[2]) });
          break;
        default:
          tokens.push({ type: TOKEN.STR, value: unescapeHTML(result[3]) });
      }
    }
    this.tokens = tokens;
    this.origSents = null;
    this.revSents = null;
    this.addSBs();
    // Checks whether setnence boundary tokens were added properly.
    // This can be commented out for better performance.
    this.checkSBs();
  }
  addSBs() {
    // Recompute orig and rev because diff is not exact
    // orig === this.getOriginal() && rev === this.getRevised()
    let orig = '',
      rev = '';
    this.tokens.forEach(token => {
      if (token.type !== TOKEN.DEL) rev += token.value;
      if (token.type !== TOKEN.INS) orig += token.value;
    });
    let orig_sentences = new Sentences(orig);
    let rev_sentences = new Sentences(rev);
    this.origSents = orig_sentences.sentences;
    this.revSents = rev_sentences.sentences;

    // Insert sentence boundary tokens by splitting existing tokens
    let new_tokens = [];
    orig = '';
    rev = '';
    let orig_ind = 0,
      rev_ind = 0;

    /*
		console.log("============");
		console.log("Original diff:"); console.log(this.toString());
		console.log("Original text:"); console.log(this.origSents.map((s) => `[sent] ${s}`).join('\n'));
		console.log("Revised text:"); console.log(this.revSents.map((s) => `[sent] ${s}`).join('\n'));
		//*/

    // Split tokens when there are SBs inbetween
    this.tokens.forEach(token => {
      // XXX:
      /*
			console.log("* TOKEN:", token);
			console.log("ORIG:", orig);
			console.log("REV:", rev);
			//*/
      let curr_orig_sent = this.origSents[orig_ind];
      let curr_rev_sent = this.revSents[rev_ind];
      let curr_orig_len = orig.length;
      let curr_rev_len = rev.length;
      let need_cut = (stick, ruler) =>
        ruler != null && stick.length >= ruler.length;
      let add_token = (type, value) =>
        value && new_tokens.push({ type: type, value: value });
      let cut_tokens = (token_type, added_string) => {
        let curr_buffer, target_ind, target_sents, token_type_sbd;
        if (token_type === TOKEN.DEL) {
          curr_buffer = orig;
          target_ind = orig_ind;
          target_sents = this.origSents;
          token_type_sbd = TOKEN.DEL_BD;
        }
        if (token_type === TOKEN.INS) {
          curr_buffer = rev;
          target_ind = rev_ind;
          target_sents = this.revSents;
          token_type_sbd = TOKEN.INS_BD;
        }

        let curr_sliced = 0;
        let curr_buffer_init_len = curr_buffer.length;
        let curr_target = target_sents[target_ind];

        if (curr_buffer === '') curr_buffer = added_string.trimLeft();
        else curr_buffer += added_string;

        while (need_cut(curr_buffer, curr_target)) {
          // XXX: console.log(`> CUT (${token_type})`); console.log("TARGET", curr_target);
          add_token(
            token_type,
            curr_sliced === 0
              ? curr_buffer.slice(curr_buffer_init_len, curr_target.length)
              : curr_target
          );
          new_tokens.push({ type: token_type_sbd });
          curr_buffer = curr_buffer.slice(curr_target.length).trimLeft();
          curr_target = target_sents[++target_ind];
          curr_sliced++;
        }
        if (curr_sliced > 0) add_token(token_type, curr_buffer);
        else new_tokens.push(token);

        if (token_type === TOKEN.DEL) {
          orig = curr_buffer;
          orig_ind = target_ind;
        }
        if (token_type === TOKEN.INS) {
          rev = curr_buffer;
          rev_ind = target_ind;
        }
      };
      switch (token.type) {
        case TOKEN.DEL:
        case TOKEN.INS:
          cut_tokens(token.type, token.value);
          break;
        case TOKEN.STR:
          let token_trimmed = token.value.trimLeft();
          let token_trimmed_len = token.value.length - token_trimmed.length;
          let need_cut_orig, need_cut_rev, cut_type;
          let base_orig = 0,
            base_rev = 0,
            base_all = 0;

          if (orig === '') {
            orig = token_trimmed;
            base_orig = token_trimmed_len;
          } else orig += token.value;
          if (rev === '') {
            rev = token_trimmed;
            base_rev = token_trimmed_len;
          } else rev += token.value;

          const DONT_CUT = token.value.length + 1;
          while (
            (need_cut_orig = need_cut(orig, curr_orig_sent)) |
            (need_cut_rev = need_cut(rev, curr_rev_sent))
          ) {
            let cut_orig_ind = DONT_CUT,
              cut_rev_ind = DONT_CUT,
              cut_min_ind;
            // XXX: console.log(">>> CUT STR L=[%d] o=[%d] r=[%d] a=[%d] (%s/%s)", token.value.length, base_orig, base_rev, base_all, need_cut_orig, need_cut_rev);
            // XXX: console.log("ORIG: [%s]\nTARG: [%s]", orig, curr_orig_sent); console.log("REV: [%s]\nTARG: [%s]", rev, curr_rev_sent);
            if (need_cut_orig) {
              cut_orig_ind = base_orig;
              if (cut_orig_ind === 0)
                cut_orig_ind = curr_orig_sent.length - curr_orig_len;
              else cut_orig_ind += curr_orig_sent.length;
            }
            if (need_cut_rev) {
              cut_rev_ind = base_rev;
              if (cut_rev_ind === 0)
                cut_rev_ind = curr_rev_sent.length - curr_rev_len;
              else cut_rev_ind += curr_rev_sent.length;
            }
            cut_min_ind = Math.min(cut_orig_ind, cut_rev_ind);
            if (cut_orig_ind === cut_rev_ind) cut_type = TOKEN.SBD;
            if (cut_orig_ind < cut_rev_ind) cut_type = TOKEN.DEL_BD;
            if (cut_orig_ind > cut_rev_ind) cut_type = TOKEN.INS_BD;

            add_token(TOKEN.STR, token.value.slice(base_all, cut_min_ind));
            new_tokens.push({ type: cut_type });
            // XXX: console.log("o=[%d], r=[%d], t=[%s]", cut_orig_ind, cut_rev_ind, cut_type);
            if (isNaN(cut_min_ind)) throw new Error('Invalid cut index!');

            if (cut_orig_ind === cut_min_ind) {
              orig = orig.slice(curr_orig_sent.length).trimLeft();
              while (
                cut_orig_ind < token.value.length &&
                token.value[cut_orig_ind].match(/\s/)
              )
                cut_orig_ind++;
              curr_orig_sent = this.origSents[++orig_ind];
              base_orig = cut_orig_ind;
            }
            if (cut_rev_ind === cut_min_ind) {
              rev = rev.slice(curr_rev_sent.length).trimLeft();
              while (
                cut_rev_ind < token.value.length &&
                token.value[cut_rev_ind].match(/\s/)
              )
                cut_rev_ind++;
              curr_rev_sent = this.revSents[++rev_ind];
              base_rev = cut_rev_ind;
            }
            // If both skipped same whitespaces, then skip it in the token.
            if (cut_orig_ind === cut_rev_ind) base_all = cut_orig_ind;
            else base_all = cut_min_ind;
          }
          if (base_all === 0) new_tokens.push(token);
          else add_token(TOKEN.STR, token.value.slice(base_all));
          break;
      }
    });
    while (TOKEN.isBorder(new_tokens[new_tokens.length - 1].type))
      new_tokens.pop();
    this.tokens = new_tokens;
    // console.log("=== Result ===");
    // console.log(this.toString());
    this.simplify();
    // console.log("=== Simplified ===");
    // console.log(this.toString());
  }
  // Check whether SB was added properly
  checkSBs() {
    let orig = '',
      rev = '';
    let orig_ind = 0,
      rev_ind = 0;
    this.tokens.forEach(token => {
      if (TOKEN.isBorder(token.type)) {
        if (token.type !== TOKEN.INS_BD) {
          if (this.origSents[orig_ind].trim() !== orig.trim()) {
            console.error('ORIG', orig_ind);
            console.log('MUST BE', this.origSents[orig_ind]);
            console.log('CURRENT', orig);
          }
          orig = '';
          orig_ind++;
        }
        if (token.type !== TOKEN.DEL_BD) {
          if (this.revSents[rev_ind].trim() !== rev.trim()) {
            console.error('REV', rev_ind);
            console.log('MUST BE', this.revSents[rev_ind]);
            console.log('CURRENT', rev);
          }
          rev = '';
          rev_ind++;
        }
      } else {
        if (token.type !== TOKEN.DEL) rev += token.value;
        if (token.type !== TOKEN.INS) orig += token.value;
      }
    });
    if (orig.trim()) {
      if (this.origSents[orig_ind].trim() !== orig.trim()) {
        console.error('ORIG', orig_ind, this.origSents[orig_ind], orig);
      }
      orig_ind++;
    }
    if (orig_ind < this.origSents.length) console.error('ORIG IND TOO SMALL');
    if (rev.trim()) {
      if (this.revSents[rev_ind].trim() !== rev.trim()) {
        console.error('REV', rev_ind, this.revSents[rev_ind], rev);
      }
      rev_ind++;
    }
    if (rev_ind < this.revSents.length) console.error('REV IND TOO SMALL');
  }
  // Simplifies the diff
  simplify() {
    // Remove whitespaces and null changes
    this.removeWhitespaces();
    // Remove duplicated borders
    this.removeDuplicatedBorders();
    // Remove whitespaces again
    this.removeWhitespaces();
    // Reorder tokens
    // this.reorderTokens();
  }
  // Remove whitespaces before sentences
  removeWhitespaces() {
    let new_tokens = [];
    let after_del_border = true,
      after_ins_border = true;
    // Remove whitespaces
    this.tokens.forEach(token => {
      let do_trim = false;
      switch (token.type) {
        case TOKEN.STR:
          if (after_del_border && after_ins_border) do_trim = true;
          break;
        case TOKEN.DEL:
          if (after_del_border) do_trim = true;
          break;
        case TOKEN.INS:
          if (after_ins_border) do_trim = true;
          break;
        default:
          after_del_border = after_ins_border = false;
          if (token.type !== TOKEN.INS_BD) after_del_border = true;
          if (token.type !== TOKEN.DEL_BD) after_ins_border = true;
          break;
      }
      if (do_trim) token.value = token.value.trimLeft();
      if (TOKEN.isBorder(token.type) || !!token.value) {
        if (!TOKEN.isBorder(token.type))
          after_del_border = after_ins_border = false;
        new_tokens.push(token);
      }
    });
    this.tokens = new_tokens;
  }
  // Reorder tokens so that deletes come before inserts
  reorderTokens() {
    let del_list = [],
      ins_list = [];
    let new_tokens = [];
    let add_tokens = () => {
      new_tokens = new_tokens.concat(del_list, ins_list);
      del_list = [];
      ins_list = [];
    };
    this.tokens.forEach(token => {
      switch (token.type) {
        case TOKEN.DEL:
        case TOKEN.DEL_BD:
          del_list.push(token);
          break;
        case TOKEN.INS:
        case TOKEN.INS_BD:
          ins_list.push(token);
          break;
        default:
          add_tokens();
          new_tokens.push(token);
      }
    });
    add_tokens();
  }
  // Remove duplicated borders
  removeDuplicatedBorders() {
    let new_tokens = this.tokens;
    this.tokens = new_tokens.filter((token, ind) => {
      if (!TOKEN.isBorder(token.type)) return true;
      for (let i = ind + 1; i < new_tokens.length; i++) {
        switch (new_tokens[i].type) {
          case TOKEN.STR:
            return true;
          case TOKEN.DEL:
            if (token.type !== TOKEN.INS_BD) return true;
            break;
          case TOKEN.INS:
            if (token.type !== TOKEN.DEL_BD) return true;
            break;
          default:
            if (new_tokens[i].type !== token.type) {
              new_tokens[i].type = TOKEN.SBD;
            }
            return false;
        }
      }
      return false;
    });
  }
  getOriginal() {
    return this.tokens
      .filter(token => token.type === TOKEN.STR || token.type === TOKEN.DEL)
      .map(token => token.value)
      .join('');
  }
  getRevised() {
    return this.tokens
      .filter(token => token.type === TOKEN.STR || token.type === TOKEN.INS)
      .map(token => token.value)
      .join('');
  }
  toString() {
    let after_border = true;
    return this.tokens
      .map(token => {
        const sp = after_border ? '' : ' ';
        if (TOKEN.isBorder(token.type)) {
          after_border = true;
          return `${sp}${token.type}\n`;
        } else {
          after_border = false;
          return `${sp}${token.type}[${token.value}]`;
        }
      })
      .join('');
  }
}

class EditPair {
  constructor(obj) {
    // metadata
    this.id = obj.id;
    this.tags = obj.tags;
    // original and revision
    this.original = new Sentences(unescapeHTML(obj.original).trim());
    this.revision = new Sentences(unescapeHTML(obj.revision).trim());
    // diff data (not realiable)
    // console.log("CURR ID:", this.id);
    this.diff = new Diff(obj.diff.trim());
    /*
		if(this.diff.origSents.length < this.original.sentences.length){
			console.log(this.id, 'ORIG', this.original.sentences.length, this.diff.origSents.length);
			// console.log(this.original.sentences);
			// console.log(this.diff.origSents);
		}
		if(this.diff.revSents.length < this.revision.sentences.length){
			console.log(this.id, 'REV', this.revision.sentences.length, this.diff.revSents.length);
			// console.log(this.original.sentences);
			// console.log(this.diff.origSents);
		}
		*/
  }
  checkDiff() {
    if (
      this.diff
        .getOriginal()
        .replace(/\s+/g, ' ')
        .trim() !==
      unescapeHTML(obj.original)
        .replace(/\s+/g, ' ')
        .trim()
    ) {
      console.log('%s: original is different', this.id);
    }
    if (
      this.diff
        .getRevised()
        .replace(/\s+/g, ' ')
        .trim() !==
      unescapeHTML(obj.revision)
        .replace(/\s+/g, ' ')
        .trim()
    ) {
      console.log('%s: revision is different', this.id);
    }
  }
}

module.exports = { Diff, EditPair, TOKEN };
