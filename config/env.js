const path = require('path');

module.exports = {
  paths: {
    /* Chemin vers les fichiers sources */
    source: path.resolve(__dirname, '../src/'),

    /* Chemin vers les fichiers compilés */
    output: path.resolve(__dirname, '../dist/'),
  },
  server: {
    host: 'localhost',
    port: 8000,
  },
  limits: {
    images: 8192,

    fonts: 8192,
  },
};