const express = require('express');
const del = require('del');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const babel = require('@babel/core');
const NodeCache = require('node-cache');
const crypto = require('crypto');
const browserify = require('browserify');

const cache = new NodeCache({
  stdTTL: 30,
  useClones: false,
  checkperiod: 14,
});

const app = express();

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

app.post('/', async (req, res) => {
  const { code: rawCode } = req.body;

  if (!rawCode || typeof rawCode !== 'string') {
    return res.status(400).send({ error: 'You must enter some code' });
  }

  const code = `
    ${rawCode.includes('import React ') || "import React from 'react'"};
    ${
      rawCode.includes('import ReactDOM ') || "import ReactDOM from 'react-dom'"
    };

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

  let result;
  try {
    result = babel.transform(code, {
      presets: ['@babel/preset-react', '@babel/preset-env'],
    });
  } catch (err) {
    res.status(400).send({
      error: err.message.replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        ''
      ),
    });
    return;
  }

  if (result.code.length > 3000) {
    return res.status(400).send('Too much code');
  }

  const key = crypto
    .scryptSync(result.code, 'a', 16, {
      cost: 4,
    })
    .toString('hex');

  let dir;
  try {
    dir = await fs.promises.mkdtemp('t');
    const tmpFile = path.join(dir, key);

    await fs.promises.writeFile(tmpFile, result.code);
    const b = browserify();
    b.add(tmpFile);
    b.external('react');
    b.external('react-dom');

    const code = await streamToString(b.bundle());
    cache.set(key, code);
    res.send({ key });
  } finally {
    if (dir) {
      del(dir);
    }
  }
  console.log(cache.getStats());
});

app.get('/:key', (req, res) => {
  const { key } = req.params;

  const code = cache.get(key);

  res.send(`
    <html>
      <head>
        <script src="/common.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.5.0/css/bootstrap.css">
        <style>
          body {
            margin: 5px;
          }
        </style>
      </head>
      <body>
        <div style="color: red;" id="err"></div>
        <div id="root"></div>
        <script>
          try {
            ${code}
          } catch (err) {
            document.querySelector('#err').innerHTML = err.message;
          }
        </script>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});

function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
