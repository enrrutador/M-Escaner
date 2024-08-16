const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const JWT_SECRET = 'your_jwt_secret'; // Cambia esto a una clave secreta fuerte en producción

app.use(bodyParser.json());

// Conectar a MongoDB (asegúrate de tener MongoDB en funcionamiento)
mongoose.connect('mongodb://localhost:27017/mydatabase', { useNewUrlParser: true, useUnifiedTopology: true });

// Esquema y modelo de usuario
const userSchema = new mongoose.Schema({
    username: String,
    passwordHash: String
});

const User = mongoose.model('User', userSchema);

// Endpoint de registro
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, passwordHash });
    await user.save();
    res.status(201).send('User registered');
});

// Endpoint de inicio de sesión
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.passwordHash)) {
        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } else {
        res.status(401).send('Invalid credentials');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
