const { Readable } = require('stream');
const browserify = require('browserify');
const babel = require('@babel/core');

const CODE_LENGTH_LIMIT = 10000;

module.exports = (rawCode) => {
  const code = `
    ${injectReact(rawCode)}
    ${injectReactDOM(rawCode)}

    ${rawCode}
    (() => {
      const root = document.querySelector('#root');
      if (!root.innerHTML && typeof App !== 'undefined') {
        ReactDOM.render(React.createElement(App), root);
      } else  if (!root.innerHTML && typeof App === 'undefined') {
        root.innerHTML = 'Found nothing to render. Either call ReactDOM.render yourself or make sure your component is called "App"';
      }
    })()
  `;

  const result = babel.transform(code, {
    presets: ['@babel/preset-react', '@babel/preset-env'],
  });

  if (result.code.length > CODE_LENGTH_LIMIT) {
    throw new Error('Too much code');
  }

  const b = browserify();
  b.add(Readable.from(result.code));
  b.external('react');
  b.external('react-dom');

  return streamToString(b.bundle());
};

function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function injectReact(rawCode) {
  if (rawCode.includes('import React ') || rawCode.includes('import React,')) {
    return '';
  }

  return "import React from 'react';";
}

function injectReactDOM(rawCode) {
  if (rawCode.includes('import ReactDOM ')) {
    return '';
  }

  return "import ReactDOM from 'react-dom';";
}
