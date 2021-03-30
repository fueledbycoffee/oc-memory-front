// Express de base pour heroku 

const express = require('express');
const path = require('path');
const port = process.env.PORT || 8080;
const app = express();

// Le __dirname est ou s'execute l'application
app.use(express.static(__dirname + "/dist"));

// Envoi le user vers index.html peut-importe l'url
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(port);