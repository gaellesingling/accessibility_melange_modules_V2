const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const widgetPath = path.resolve(__dirname, '../assets/widget.js');
const widgetSource = fs.readFileSync(widgetPath, 'utf8');
const startMarker = 'const FRENCH_HYPHENATION_DATA';
const endMarker = 'function insertReadingGuideMiddots';
const startIndex = widgetSource.indexOf(startMarker);
const endIndex = widgetSource.indexOf(endMarker);

if(startIndex === -1 || endIndex === -1 || endIndex <= startIndex){
  throw new Error('Unable to locate French hyphenation block in widget.js');
}

const snippet = widgetSource.slice(startIndex, endIndex);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(snippet, sandbox);

const syllabify = sandbox.syllabifyReadingGuideWord;
if(typeof syllabify !== 'function'){
  throw new Error('Failed to load syllabification routine from widget.js');
}

const expectedPairs = new Map([
  ['bonjour', 'bon·jour'],
  ['famille', 'fa·mille'],
  ['travailleur', 'tra·vailleur'],
  ['communication', 'com·mu·ni·ca·tion'],
  ['accentuation', 'ac·cen·tua·tion'],
  ['aération', 'aé·ra·tion'],
  ['éducation', 'édu·ca·tion'],
  ['coïncidence', 'coïn·ci·dence'],
  ['psychiatre', 'psy·chiatre'],
  ['parler', 'par·ler'],
  ['Éléphant', 'Élé·phant'],
]);

for(const [word, expected] of expectedPairs.entries()){
  const actual = syllabify(word);
  assert.strictEqual(actual, expected, `Unexpected syllabification for ${word}: ${actual}`);
}

const monosyllables = ['paille', 'brouille', 'mœurs', 'SOUFFLE'];
monosyllables.forEach(word => {
  const actual = syllabify(word);
  assert(!actual.includes('·'), `Monosyllabic word ${word} should not contain a middot: ${actual}`);
});

console.log('All syllabification checks passed.');
