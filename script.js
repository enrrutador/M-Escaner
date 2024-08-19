/**
 * Copyright © [SYSMARKETHM] [2024]. Todos los derechos reservados.
 * 
 * Este código está protegido por derechos de autor. No está permitido copiar, distribuir
 * o modificar este código sin el permiso explícito del autor.
 */

import { auth, db } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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
        const user = userCredential.user;

        // Verificar el dispositivo al iniciar sesión
        const deviceId = localStorage.getItem('deviceId');
        const deviceRef = doc(db, 'userDevices', user.uid);
        const deviceDoc = await getDoc(deviceRef);

        if (deviceDoc.exists()) {
            const deviceData = deviceDoc.data();
            if (deviceData.deviceId !== deviceId) {
                throw new Error('El inicio de sesión está restringido a un solo dispositivo.');
            }
        } else {
            await setDoc(deviceRef, { deviceId: deviceId });
        }

        console.log('Usuario autenticado:', user);
    } catch (error) {
        console.error('Error de autenticación:', error.code, error.message);
        loginError.textContent = 'Error al iniciar sesión. Verifica tu correo y contraseña.';
        if (error.message.includes('dispositivo')) {
            alert('No puedes iniciar sesión en este dispositivo.');
        }
    }
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
                    if (product.barcode.includes(query) || product.description.toLowerCase().includes(query.toLowerCase())) {
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
    let barcodeDetector;
    let productNotFoundAlertShown = false;

    const cache = new Map();

    async function startScanner() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        scannerContainer.style.display = 'flex';
        video.play();
        scan();
    }

    async function scan() {
        if (barcodeDetector && video.readyState === video.HAVE_ENOUGH_DATA) {
            const barcodes = await barcodeDetector.detect(video);
            if (barcodes.length > 0) {
                barcodeInput.value = barcodes[0].rawValue;
                stopScanner();
                searchProduct(barcodes[0].rawValue);
            }
        }
        requestAnimationFrame(scan);
    }

    function stopScanner() {
        video.srcObject.getTracks().forEach(track => track.stop());
        scannerContainer.style.display = 'none';
    }

    async function searchProduct(query) {
        if (cache.has(query)) {
            fillForm(cache.get(query));
            return;
        }

        let product = await db.getProduct(query);

        if (!product) {
            const results = await db.searchProducts(query);
            if (results.length > 0) {
                product = results[0];
            }
        }

        if (!product) {
            product = await searchInOpenFoodFacts(query);
        }

        if (product) {
            cache.set(query, product);
            fillForm(product);
            productNotFoundAlertShown = false;
        } else {
            if (!productNotFoundAlertShown) {
                alert('Producto no encontrado.');
                productNotFoundAlertShown = true;
            }
        }
    }

    async function searchInOpenFoodFacts(query) {
        try {
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${query}.json`, { timeout: 5000 });
            const data = await response.json();

            if (data.product) {
                const product = {
                    barcode: data.product.code || query,
                    description: data.product.product_name || 'No disponible',
                    stock: 0,
                    price: 0,
                };
                return product;
            }
            return null;
        } catch (error) {
            console.error('Error fetching product from Open Food Facts:', error);
            return null;
        }
    }

    function fillForm(product) {
        barcodeInput.value = product.barcode;
        descriptionInput.value = product.description;
        stockInput.value = product.stock;
        priceInput.value = product.price;
        if (product.image) {
            productImage.src = product.image;
            productImage.style.display = 'block';
        } else {
            productImage.style.display = 'none';
        }
        searchResults.style.display = 'none';

        updateStockColors();
    }

    function updateStockColors() {
        const stock = parseInt(stockInput.value);
        if (stock <= 5) {
            stockInput.classList.add('low-stock');
            stockInput.classList.add('low');
        } else {
            stockInput.classList.remove('low-stock');
            stockInput.classList.remove('low');
        }
    }

    function saveProduct() {
        const product = {
            barcode: barcodeInput.value,
            description: descriptionInput.value,
            stock: parseInt(stockInput.value),
            price: parseFloat(priceInput.value)
        };
        db.addProduct(product).then(() => {
            alert('Producto guardado.');
            clearForm();
        });
    }

    function clearForm() {
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.style.display = 'none';
        searchResults.style.display = 'none';
    }

    function exportToCSV() {
        db.getAllProducts().then(products => {
            const csv = generateCSV(products);
            downloadCSV(csv, 'productos.csv');
        });
    }

    function generateCSV(products) {
        const header = ['Código de barras', 'Descripción del producto', 'Stock', 'Precio'];
        const rows = products.map(product => [product.barcode, product.description, product.stock, product.price]);
        return [header, ...rows].map(row => row.join(',')).join('\n');
    }

    function downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    document.getElementById('scan-button').addEventListener('click', startScanner);
    document.getElementById('save-button').addEventListener('click', saveProduct);
    document.getElementById('export-button').addEventListener('click', exportToCSV);

    document.getElementById('search-button').addEventListener('click', () => {
        searchProduct(barcodeInput.value.trim());
    });

    lowStockButton.addEventListener('click', () => {
        db.getAllProducts().then(products => {
            const lowStockProducts = products.filter(product => product.stock <= 5);
            lowStockList.innerHTML = '';
            lowStockProducts.forEach(product => {
                const listItem = document.createElement('li');
                listItem.textContent = `${product.description} (Stock: ${product.stock})`;
                lowStockList.appendChild(listItem);
            });
            lowStockResults.style.display = 'block';
        });
    });
});
