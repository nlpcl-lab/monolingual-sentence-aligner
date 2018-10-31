// Wrapper for NPM sbd package with custom settings
const sbd = require('sbd');

const abbrs = [
	"al", "adj", "assn", "Ave", "BSc", "MSc", "Cell", "Ch", "Co", "cc", "Corp", "Dem", "Dept",
	"ed", "eg", "Eq", "Eqs", "est", "est", "etc", "Ex", "ext", "Fig", "fig", "Figs", "figs", "i.e", "ie", "Inc", "inc",
	"Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec", "jr",
	"mi", "Miss", "Mrs", "Mr", "Ms", "Mol", "mt", "mts", "no", "Nos", "PhD", "MD", "BA", "MA", "MM",
	"pl", "pop", "pp", "Prof", "Dr", "pt", "Ref", "Refs", "Rep", "repr", "rev", "Sec", "Secs", "Sgt", "Col", "Gen",
	"Rep", "Sen", 'Gov', "Lt", "Maj", "Capt", "St", "Sr", "sr", "Jr", "jr", "Rev", "Sun", "Mon", "Tu", "Tue", "Tues",
	"Wed", "Th", "Thu", "Thur", "Thurs", "Fri", "Sat", "trans", "Univ", "Viz", "Vol", "vs", "v",
	// Additions
	"Pg", "pg",
];

module.exports = (str) => {
	let raw_sentences = sbd.sentences(str, {'newline_boundaries': true, 'abbreviations': abbrs});

	// Fix missing characters!
	let sentence_inds = [];
	let sentences = [];
	let start_index = 0;
	raw_sentences.forEach((v) => {
		let words = v.split(' ');
		if(words.length === 0) return; // This should not happen.
		let first_index = 0;
		words.forEach((word, word_ind) => {
			let next_index = str.indexOf(word, start_index);
			if(word_ind === 0) first_index = next_index;
			if(next_index < 0){
				console.error("STR", str);
				console.error("SBD", raw_sentences);
				throw new Error("Sentence Boundary is Wrong!");
			}
			start_index = next_index + word.length;
		});

		let matching_sentence = str.slice(first_index, start_index);
		sentence_inds.push([first_index, start_index]);
	});
	sentence_inds.forEach(([start, end], ind) => {
		let next_start = ind === sentence_inds.length-1 ? str.length : sentence_inds[ind+1][0];
		let inbetweener = str.slice(end, next_start).trimRight();
		end += inbetweener.length;
		sentences.push(str.slice(start, end));
	});

	return sentences;
};
