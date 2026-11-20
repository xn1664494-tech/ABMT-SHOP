const fs = require('fs');
const content = fs.readFileSync('src/views/pages/cart.ejs', 'utf8');

// Find all <%= ... %> tags
const regex = /<%=([\s\S]*?)%>/g;
let match;
const matches = [];
while ((match = regex.exec(content)) !== null) {
  matches.push({ start: match.index, end: match.index + match[0].length, text: match[1] });
}
console.log('Found ' + matches.length + ' <%= ... %> tags');
matches.forEach((m, i) => {
  console.log('Tag ' + (i+1) + ': length=' + m.text.length + ' text=' + JSON.stringify(m.text.substring(0, 60)));
});

// Also find all <% ... %> (not <%=) tags
const regex2 = /<%([^%]*)%>/g;
const matches2 = [];
while ((match = regex2.exec(content)) !== null) {
  // Skip <%= matches
  if (match[0].startsWith('<!')) continue;
  matches2.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
}
console.log('Found ' + matches2.length + ' <% ... %> tags (excl. <!%)');
matches2.forEach((m, i) => {
  console.log('Tag ' + (i+1) + ': text=' + JSON.stringify(m.text.substring(0, 60)));
});

// Count <% and %>
const openCount = (content.match(/<%/g) || []).length;
const closeCount = (content.match(/%>/g) || []).length;
console.log('Total open <%: ' + openCount);
console.log('Total close %>: ' + closeCount);
console.log('Balance: ' + (openCount - closeCount));