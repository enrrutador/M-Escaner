import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import * as XLSX from 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.2/xlsx.full.min.js'; // Asegúrate de que este URL sea accesible

// Manejar el formulario de inicio de sesión
const loginForm = document.getElementById('loginForm');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('Usuario autenticado:', userCredential.user);
    } catch (error) {
        console.error('Error de autenticación:', error.code, error.message);
        loginError.textContent = 'Error al iniciar sesión. Verifica tu correo y contraseña.';
    }
});

// Manejar el estado de autenticación
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
    } else {
        loginContainer.style.display = 'block';
        appContainer.style.display = 'none';
    }
});

// Manejo de la base de datos en IndexedDB
class ProductDatabase {
    constructor() {
        this.dbName = 'MScannerDB';
        this.dbVersion = 1;
        this.storeName = 'products';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = event => reject('Error abriendo la base de datos: ' + event.target.error);

            request.onsuccess = event => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = event => {
                const db = event.target.result;
                db.createObjectStore(this.storeName, { keyPath: 'barcode' });
            };
        });
    }

    async addProduct(product) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(product);

            request.onsuccess = () => resolve();
            request.onerror = event => reject('Error al agregar producto: ' + event.target.error);
        });
    }

    async getProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName]);
            const store = transaction.objectStore(this.storeName);
            const request = store.get(barcode);

            request.onsuccess = () => resolve(request.result);
            request.onerror = event => reject('Error al obtener producto: ' + event.target.error);
        });
    }

    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName]);
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = event => reject('Error al obtener todos los productos: ' + event.target.error);
        });
    }
}

const db = new ProductDatabase();
db.init();

// Función para iniciar el escáner de códigos de barras
function startScanner() {
    const video = document.getElementById('video');
    const scannerOverlay = document.getElementById('scanner-container');
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
            video.srcObject = stream;
            video.setAttribute('playsinline', true); 
            video.play();

            const barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'ean_8'] });

            const scanBarcode = () => {
                barcodeDetector.detect(video)
                    .then(barcodes => {
                        if (barcodes.length > 0) {
                            const barcode = barcodes[0].rawValue;
                            console.log('Código de barras escaneado:', barcode);
                            populateFormFromBarcode(barcode);
                            scannerOverlay.style.display = 'none';
                            stream.getTracks().forEach(track => track.stop());
                        } else {
                            requestAnimationFrame(scanBarcode);
                        }
                    })
                    .catch(err => console.error('Error al escanear:', err));
            };
            scanBarcode();
        })
        .catch(err => {
            console.error('Error al acceder a la cámara:', err);
            alert('No se pudo acceder a la cámara.');
        });

    // Cerrar el escáner cuando se haga clic fuera del área del escáner
    scannerOverlay.addEventListener('click', () => {
        scannerOverlay.style.display = 'none';
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
    });
}

function populateFormFromBarcode(barcode) {
    document.getElementById('barcode').value = barcode;
    document.getElementById('search-button').click(); 
}

// Manejo de los eventos de botones
document.getElementById('scan-button').addEventListener('click', () => {
    const scannerOverlay = document.getElementById('scanner-container');
    scannerOverlay.style.display = 'flex';
    startScanner();
});

document.getElementById('search-button').addEventListener('click', async () => {
    const barcode = document.getElementById('barcode').value;
    const description = document.getElementById('description').value;
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '';

    try {
        if (barcode) {
            const product = await db.getProduct(barcode);
            if (product) {
                displayProduct(product);
            } else {
                displayNotFound();
            }
        } else if (description) {
            const products = await db.getAllProducts();
            const filteredProducts = products.filter(p => p.description.toLowerCase().includes(description.toLowerCase()));
            if (filteredProducts.length > 0) {
                filteredProducts.forEach(product => displayProduct(product));
            } else {
                displayNotFound();
            }
        }
    } catch (error) {
        console.error('Error al buscar productos:', error);
        displayNotFound();
    }
});

function displayProduct(product) {
    const resultsList = document.getElementById('results-list');
    const listItem = document.createElement('li');
    listItem.textContent = `Código: ${product.barcode}, Descripción: ${product.description}, Stock: ${product.stock}, Precio: ${product.price}`;
    listItem.addEventListener('click', () => populateForm(product));
    resultsList.appendChild(listItem);
}

function displayNotFound() {
    const resultsList = document.getElementById('results-list');
    const listItem = document.createElement('li');
    listItem.textContent = 'Producto no encontrado';
    resultsList.appendChild(listItem);
}

function populateForm(product) {
    document.getElementById('barcode').value = product.barcode;
    document.getElementById('description').value = product.description;
    document.getElementById('stock').value = product.stock;
    document.getElementById('price').value = product.price;
    document.getElementById('product-image').src = product.image || '';
    document.getElementById('product-image').style.display = product.image ? 'block' : 'none';
    document.getElementById('search-results').style.display = 'none';
}

document.getElementById('save-button').addEventListener('click', async () => {
    const barcode = document.getElementById('barcode').value;
    const description = document.getElementById('description').value;
    const stock = document.getElementById('stock').value;
    const price = document.getElementById('price').value;

    if (barcode && description && stock && price) {
        const product = { barcode, description, stock, price };
        try {
            await db.addProduct(product);
            alert('Producto Guardado');
            clearForm();
        } catch (error) {
            console.error('Error al guardar el producto:', error);
            alert('Error al guardar el producto. Inténtalo de nuevo.');
        }
    } else {
        alert('Por favor, completa todos los campos antes de guardar.');
    }
});

document.getElementById('export-button').addEventListener('click', async () => {
    try {
        const products = await db.getAllProducts();
        const ws = XLSX.utils.json_to_sheet(products);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Productos');
        XLSX.writeFile(wb, 'productos.xlsx');
    } catch (error) {
        console.error('Error al exportar productos:', error);
        alert('Error al exportar productos. Inténtalo de nuevo.');
    }
});

document.getElementById('clear-button').addEventListener('click', () => {
    clearForm();
});

function clearForm() {
    document.getElementById('barcode').value = '';
    document.getElementById('description').value = '';
    document.getElementById('stock').value = '';
    document.getElementById('price').value = '';
    document.getElementById('product-image').src = '';
    document.getElementById('product-image').style.display = 'none';
}


