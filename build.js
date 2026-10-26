/* Build: node build.js [owner/repo]
   - index.html       loads css/ and js/ (relative paths, or from jsDelivr when a GitHub repo is given)
   - standalone.html  everything inlined in one file (needs nothing but the optional jsDelivr fonts) */
'use strict';
const fs = require('fs'), path = require('path');
const JS = ['util.js', 'config.js', 'maze.js', 'ai.js', 'sim.js', 'render.js', 'audio.js', 'input.js', 'ui.js'];
const repo = process.argv[2] || fs.existsSync(path.join(__dirname, 'CDN')) && fs.readFileSync(path.join(__dirname, 'CDN'), 'utf8').trim();
const base = repo ? `https://cdn.jsdelivr.net/gh/${repo}@main/` : '';
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const tpl = read('src/index.template.html');

fs.writeFileSync(path.join(__dirname, 'index.html'), tpl
  .replace('<!--CSS-->', () => `<link rel="stylesheet" href="${base}css/style.css">`)
  .replace('<!--JS-->', () => JS.map(f => `<script src="${base}js/${f}"></script>`).join('\n  ')));

const js = JS.map(f => read('js/' + f)).join('\n');
if (/<\/script/i.test(js)) throw new Error('JS must not contain </script>');
const single = tpl
  .replace('<!--CSS-->', () => '<style>\n' + read('css/style.css') + '</style>')
  .replace('<!--JS-->', () => '<script>\n' + js + '</script>');
fs.writeFileSync(path.join(__dirname, 'standalone.html'), single);
console.log('index.html (' + (base || 'relative paths') + ') + standalone.html ' + (single.length / 1024).toFixed(0) + ' KB');
