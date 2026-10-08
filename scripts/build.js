#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

async function build() {
	const core = fs.readFileSync(path.join(SRC, 'media-library-core.js'), 'utf8');
	const picker = fs.readFileSync(path.join(SRC, 'media-library-picker.js'), 'utf8');
	const css = fs.readFileSync(path.join(SRC, 'media-library.css'), 'utf8');

	const combined = [
		'/*! Media Library Picker — combined build. See src/ for commented sources. */',
		core,
		picker,
	].join('\n');

	const result = await minify(
		{ 'media-library.js': combined },
		{
			compress: true,
			mangle: true,
			format: { comments: /^!/ },
		}
	);

	if (result.error) throw result.error;

	if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
	fs.writeFileSync(path.join(DIST, 'media-library.min.js'), result.code, 'utf8');
	fs.copyFileSync(path.join(SRC, 'media-library.css'), path.join(DIST, 'media-library.css'));
	fs.writeFileSync(path.join(DIST, 'media-library-core.js'), core, 'utf8');
	fs.writeFileSync(path.join(DIST, 'media-library-picker.js'), picker, 'utf8');

	const minCss = css
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\s+/g, ' ')
		.replace(/;\s*}/g, '}')
		.replace(/\s*{\s*/g, '{')
		.replace(/;\s*/g, ';')
		.replace(/:\s*/g, ':')
		.replace(/,\s*/g, ',')
		.trim();
	fs.writeFileSync(path.join(DIST, 'media-library.min.css'), minCss, 'utf8');

	console.log('Built dist/media-library.min.js (' + (result.code.length / 1024).toFixed(1) + ' KB)');
	console.log('Built dist/media-library.min.css (' + (minCss.length / 1024).toFixed(1) + ' KB)');
}

build().catch((err) => {
	console.error(err);
	process.exit(1);
});
