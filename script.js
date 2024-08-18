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

    async searchProducts(query) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const results = [];
            store.openCursor().onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    const product = cursor.value;
                    if (product.description.toLowerCase().includes(query.toLowerCase())) {
                        results.push(product);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            store.onerror = event => reject('Error searching products:', event.target.error);
        });
    }

    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const request = transaction.objectStore(this.storeName).getAll();

            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject('Error getting all products:', event.target.error);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const db = new ProductDatabase();
    db.init();

    const barcodeInput = document.getElementById('barcode');
    const descriptionInput = document.getElementById('description');
    const stockInput = document.getElementById('stock');
    const priceInput = document.getElementById('price');
    const productImage = document.getElementById('product-image');
    const scannerContainer = document.getElementById('scanner-container');
    const video = document.getElementById('video');
    const resultsList = document.getElementById('results-list');
    const searchResults = document.getElementById('search-results');
    const lowStockButton = document.getElementById('low-stock-button');
    const lowStockResults = document.getElementById('low-stock-results');
    const lowStockList = document.getElementById('low-stock-list');
    const clearResultsButton = document.getElementById('clear-results-button');

    const handleScanButtonClick = () => {
        scannerContainer.style.display = 'block';
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                video.srcObject = stream;
                // Aquí agregarás el código para leer el código de barras usando la cámara
            })
            .catch(err => console.error('Error accessing camera:', err));
    };

    const handleSearchButtonClick = async () => {
        const description = descriptionInput.value.trim();
        if (description) {
            const products = await db.searchProducts(description);
            resultsList.innerHTML = '';
            if (products.length) {
                products.forEach(product => {
                    const li = document.createElement('li');
                    li.textContent = `${product.description} - ${product.stock} - ${product.price}`;
                    resultsList.appendChild(li);
                });
                searchResults.style.display = 'block';
            } else {
                resultsList.innerHTML = '<li>No se encontraron productos.</li>';
                searchResults.style.display = 'block';
            }
        }
    };

    const handleSaveButtonClick = async () => {
        const barcode = barcodeInput.value.trim();
        const description = descriptionInput.value.trim();
        const stock = stockInput.value.trim();
        const price = priceInput.value.trim();
        if (barcode && description && stock && price) {
            await db.addProduct({
                barcode,
                description,
                stock: parseInt(stock, 10),
                price: parseFloat(price)
            });
            alert('Producto guardado');
            barcodeInput.value = '';
            descriptionInput.value = '';
            stockInput.value = '';
            priceInput.value = '';
            productImage.src = '';
            productImage.style.display = 'none';
        } else {
            alert('Por favor complete todos los campos.');
        }
    };

    const handleClearResultsButtonClick = () => {
        resultsList.innerHTML = '';
        searchResults.style.display = 'none';
    };

    const handleLowStockButtonClick = async () => {
        const allProducts = await db.getAllProducts();
        const lowStockProducts = allProducts.filter(product => product.stock < 10); // Por ejemplo, stock bajo es menor a 10
        lowStockList.innerHTML = '';
        lowStockProducts.forEach(product => {
            const li = document.createElement('li');
            li.textContent = `${product.description} - ${product.stock} - ${product.price}`;
            lowStockList.appendChild(li);
        });
        lowStockResults.style.display = lowStockResults.style.display === 'none' ? 'block' : 'none';
    };

    document.getElementById('scan-button').addEventListener('click', handleScanButtonClick);
    document.getElementById('search-button').addEventListener('click', handleSearchButtonClick);
    document.getElementById('save-button').addEventListener('click', handleSaveButtonClick);
    document.getElementById('clear-results-button').addEventListener('click', handleClearResultsButtonClick);
    lowStockButton.addEventListener('click', handleLowStockButtonClick);
});


