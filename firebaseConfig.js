import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Configuración de tu aplicación Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCMv--zL7er-80cFO4kE4BjEaU5HoAT4xM",
    authDomain: "autenticacion-escaner.firebaseapp.com",
    projectId: "autenticacion-escaner",
    storageBucket: "autenticacion-escaner.appspot.com",
    messagingSenderId: "425593572191",
    appId: "1:425593572191:web:ffc9141ff393d17e3f04ea",
    measurementId: "G-BN79XGDJW5"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
