/**
 * Copyright © [SYSMARKETHM] [2024]. Todos los derechos reservados.
 * 
 * Este código está protegido por derechos de autor. No está permitido copiar, distribuir
 * o modificar este código sin el permiso explícito del autor.
 */

import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Manejar el formulario de inicio de sesión
const loginForm = document.getElementById('loginForm');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const deviceId = localStorage.getItem('deviceId') || generateDeviceId();
    localStorage.setItem('deviceId', deviceId);

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (user.displayName && user.displayName !== deviceId) {
            throw new Error('La cuenta ya está en uso en otro dispositivo.');
        }

        if (!user.displayName) {
            await updateProfile(user, { displayName: deviceId });
        }

        console.log('Usuario autenticado:', user);
    } catch (error) {
        console.error('Error de autenticación:', error.code, error.message);
        if (error.message.includes('otro dispositivo')) {
            loginError.textContent = 'Error: La cuenta ya está en uso en otro dispositivo.';
        } else {
            loginError.textContent = 'Error al iniciar sesión. Verifica tu correo y contraseña.';
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

function generateDeviceId() {
    return 'device-' + Math.random().toString(36).substr(2, 9);
}

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
        lowStockResults.style.display = 'none';
    }

    function exportProducts() {
        db.getAllProducts().then(products => {
            const filteredProducts = products.map(({ barcode, description, stock, price }) => ({
                'Código de barras': barcode,
                'Descripción': description,
                'Precio Venta': price,
                'Stock': stock
            }));

            const headers = ['Código de barras', 'Descripción', 'Rubro', 'Precio Costo', '% IVA', '% Utilidad', 'Precio Venta', 'Proveedor', 'Stock', 'Stock mínimo', 'Stock máximo', 'Control Stock', 'Activo'];
            const csvData = convertToCSV(filteredProducts, headers);
            downloadCSV(csvData, 'productos.csv');
        });
    }

    function convertToCSV(data, headers) {
        const headerString = headers.join(',');
        const rowString = data.map(row => Object.values(row).join(',')).join('\n');
        return `${headerString}\n${rowString}`;
    }

    function downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function toggleLowStockProducts() {
        if (lowStockResults.style.display === 'block') {
            lowStockResults.style.display = 'none';
        } else {
            db.getAllProducts().then(products => {
                const lowStockProducts = products.filter(product => product.stock <= 5);
                lowStockList.innerHTML = '';
                lowStockProducts.forEach(product => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `Código de barras: ${product.barcode}, Descripción: ${product.description}, Stock: ${product.stock}`;
                    listItem.style.color = 'black';
                    lowStockList.appendChild(listItem);
                });
                lowStockResults.style.display = 'block';
            });
        }
    }

    async function searchInOpenFoodFacts(query) {
        const url = `https://world.openfoodfacts.org/api/v0/product/${query}.json`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 1) {
                const product = {
                    barcode: data.product.code,
                    description: data.product.product_name,
                    stock: '',
                    price: '',
                    image: data.product.image_url || ''
                };
                return product;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error fetching data from Open Food Facts:', error);
            return null;
        }
    }

    document.getElementById('search').addEventListener('click', () => searchProduct(barcodeInput.value || descriptionInput.value));
    document.getElementById('save').addEventListener('click', saveProduct);
    document.getElementById('scan').addEventListener('click', startScanner);
    document.getElementById('export').addEventListener('click', exportProducts);
    lowStockButton.addEventListener('click', toggleLowStockProducts);

    if ('BarcodeDetector' in window) {
        barcodeDetector = new BarcodeDetector({ formats: ['ean_13'] });
    } else {
        console.warn('BarcodeDetector is not supported by this browser.');
    }
});
