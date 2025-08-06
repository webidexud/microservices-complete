// app.js
const express = require('express');
const path = require('path');
const pageRoutes = require('./routes/pageRoutes');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

app.use('/public', express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use("/", pageRoutes);


// Ruta principal
app.get('/hola', (req, res) => {
  res.send('¡Hola me.js con Express asdsadas!');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
