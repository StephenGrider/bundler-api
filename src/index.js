const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');
const stripAnsi = require('strip-ansi');

const md5 = require('md5');
const template = require('./template');
const bundler = require('./bundler');

const cache = new NodeCache({
  stdTTL: 60,
  useClones: false,
  checkperiod: 15,
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

  const key = md5(rawCode);
  if (cache.has(key)) {
    return res.send({ key });
  }

  try {
    const code = await bundler(rawCode);
    cache.set(key, code);
    res.send({ key });
  } catch (err) {
    return res.status(400).send({
      error: stripAnsi(err.message),
    });
  }
});

app.get('/:key', (req, res) => {
  const { key } = req.params;
  const code = cache.get(key);

  res.send(template(code));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
