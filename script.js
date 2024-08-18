import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Manejar el formulario de inicio de sesión
const loginForm = document.getElementById('loginForm');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            console.log('Usuario autenticado:', userCredential.user);
        })
        .catch((error) => {
            console.error('Error de autenticación:', error.code, error.message);
            loginError.textContent = 'Error al iniciar sesión. Verifica tu correo y contraseña.';
        });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
    } else {
        loginContainer.style.display = 'block';
        appContainer.style.display = 'none';
    }
});

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

            request.onerror = event => reject('Error opening database:', event.target.error);

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
            transaction.objectStore(this.storeName).put(product).onsuccess = () => resolve();
            transaction.onerror = event => reject('Error adding product:', event.target.error);
        });
    }

    async getProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const request = transaction.objectStore(this.storeName).get(barcode);

            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject('Error getting product:', event.target.error);
        });
    }

    async getProductsByDescription(description) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const products = [];
            const index = objectStore.index('description');

            index.openCursor().onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.description.toLowerCase().includes(description.toLowerCase())) {
                        products.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(products);
                }
            };

            transaction.onerror = event => reject('Error searching products:', event.target.error);
        });
    }

    async getLowStockProducts(threshold = 10) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const products = [];

            objectStore.openCursor().onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.stock < threshold) {
                        products.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(products);
                }
            };

            transaction.onerror = event => reject('Error getting low stock products:', event.target.error);
        });
    }
}

const productDB = new ProductDatabase();
productDB.init();

const scanButton = document.getElementById('scan-button');
const searchButton = document.getElementById('search-button');
const saveButton = document.getElementById('save-button');
const exportButton = document.getElementById('export-button');
const lowStockButton = document.getElementById('low-stock-button');

const barcodeInput = document.getElementById('barcode');
const descriptionInput = document.getElementById('description');
const stockInput = document.getElementById('stock');
const priceInput = document.getElementById('price');

const searchResults = document.getElementById('search-results');
const resultsList = document.getElementById('results-list');
const lowStockResults = document.getElementById('low-stock-results');
const lowStockList = document.getElementById('low-stock-list');

scanButton.addEventListener('click', startScanning);
searchButton.addEventListener('click', searchProduct);
saveButton.addEventListener('click', saveProduct);
lowStockButton.addEventListener('click', toggleLowStockProducts);

function startScanning() {
    // Lógica para abrir la cámara y escanear el código de barras
    console.log('Escaneando código de barras...');
}

async function searchProduct() {
    const description = descriptionInput.value.trim();
    if (description === '') return;

    const products = await productDB.getProductsByDescription(description);
    resultsList.innerHTML = '';
    searchResults.style.display = 'block';

    if (products.length > 0) {
        products.forEach(product => {
            const listItem = document.createElement('li');
            listItem.textContent = `${product.description} - Stock: ${product.stock} - Precio: ${product.price}`;
            listItem.addEventListener('click', () => {
                descriptionInput.value = product.description;
                stockInput.value = product.stock;
                priceInput.value = product.price;
                searchResults.style.display = 'none';
            });
            resultsList.appendChild(listItem);
        });
    } else {
        const listItem = document.createElement('li');
        listItem.textContent = 'Producto no encontrado';
        resultsList.appendChild(listItem);
    }
}

async function saveProduct() {
    const barcode = barcodeInput.value.trim();
    const description = descriptionInput.value.trim();
    const stock = parseInt(stockInput.value);
    const price = parseFloat(priceInput.value);

    if (barcode === '' || description === '' || isNaN(stock) || isNaN(price)) {
        alert('Por favor, complete todos los campos.');
        return;
    }

    const product = { barcode, description, stock, price };
    await productDB.addProduct(product);

    barcodeInput.value = '';
    descriptionInput.value = '';
    stockInput.value = '';
    priceInput.value = '';

    alert('Producto guardado');
}

async function toggleLowStockProducts() {
    if (lowStockResults.style.display === 'block') {
        lowStockResults.style.display = 'none';
    } else {
        const lowStockProducts = await productDB.getLowStockProducts();
        lowStockList.innerHTML = '';
        lowStockResults.style.display = 'block';

        if (lowStockProducts.length > 0) {
            lowStockProducts.forEach(product => {
                const listItem = document.createElement('li');
                listItem.textContent = `${product.description} - Stock: ${product.stock}`;
                lowStockList.appendChild(listItem);
            });
        } else {
            const listItem = document.createElement('li');
            listItem.textContent = 'No hay productos con stock bajo';
            lowStockList.appendChild(listItem);
        }
    }
}

