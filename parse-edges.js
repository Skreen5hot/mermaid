import { readFileSync } from 'fs';

const text = readFileSync('Test Pattern Violations.mmd', 'utf-8');
const lines = text.split('\n');

console.log('Edge lines found:');
lines.forEach((line, i) => {
  const edgeMatch = line.match(/(\w+)\s*-->?\s*\|([^|]+)\|\s*(\w+)/);
  if (edgeMatch) {
    const [, subject, predicate, object] = edgeMatch;
    console.log(`Line ${i+1}: ${subject} -${predicate}-> ${object}`);
  }
});
