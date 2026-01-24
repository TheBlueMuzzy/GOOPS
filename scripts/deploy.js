import { execSync } from 'child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const BASE_PATH = '/GOOPS';

console.log('Building...');
execSync('npm run build', { stdio: 'inherit' });

console.log('Copying fonts...');
mkdirSync('dist/fonts', { recursive: true });
cpSync('fonts/Amazon Ember.ttf', 'dist/fonts/AmazonEmber.ttf');
cpSync('fonts/Amazon Ember Bold.ttf', 'dist/fonts/AmazonEmber-Bold.ttf');
cpSync('fonts/FromWhereYouAre-4Y86.ttf', 'dist/fonts/FromWhereYouAre.ttf');

console.log('Copying sw.js...');
cpSync('sw.js', 'dist/sw.js');

console.log('Creating index.css placeholder...');
writeFileSync('dist/index.css', '/* placeholder */');

console.log('Fixing paths in index.html...');
let html = readFileSync('dist/index.html', 'utf-8');
html = html.replace(/url\('\/fonts\//g, `url('${BASE_PATH}/fonts/`);
html = html.replace(/href="\/index\.css"/, `href="${BASE_PATH}/index.css"`);
writeFileSync('dist/index.html', html);

console.log('Deploying to GitHub Pages...');
execSync('npx gh-pages -d dist', { stdio: 'inherit' });

console.log(`\nDeployed! Live at: https://thebluemuzzy.github.io${BASE_PATH}/`);
