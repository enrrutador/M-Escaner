/**
 * Copyright © [SYSMARKETHM] [2024]. Todos los derechos reservados.
 * 
 * Este código está protegido por derechos de autor. No está permitido copiar, distribuir
 * o modificar este código sin el permiso explícito del autor.
 */

import { auth, firestore } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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
        const userRef = doc(firestore, `users/${user.uid}`);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.deviceId && userData.deviceId !== deviceId) {
                // Invalida el token anterior
                await signOut(auth);
                throw new Error('La cuenta ya está en uso en otro dispositivo.');
            }

            // Actualiza el ID del dispositivo
            await updateDoc(userRef, { deviceId });
        } else {
            // Crea un nuevo documento para el usuario
            await setDoc(userRef, { deviceId });
        }

        localStorage.setItem('sessionToken', deviceId);
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
    } catch (error) {
        console.error('Error de autenticación:', error.code, error.message);
        if (error.message.includes('otro dispositivo')) {
            loginError.textContent = 'Error: La cuenta ya está en uso en otro dispositivo.';
        } else {
            loginError.textContent = 'Error al iniciar sesión. Verifica tu correo y contraseña.';
        }
    }
});

onAuthStateChanged(auth, async (user) => {
    const sessionToken = localStorage.getItem('sessionToken');
    if (user) {
        const userRef = doc(firestore, `users/${user.uid}`);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (sessionToken && sessionToken !== userData.deviceId) {
                await signOut(auth);
                localStorage.removeItem('sessionToken');
                loginContainer.style.display = 'block';
                appContainer.style.display = 'none';
            } else {
                loginContainer.style.display = 'none';
                appContainer.style.display = 'block';
            }
        } else {
            loginContainer.style.display = 'block';
            appContainer.style.display = 'none';
        }
    } else {
        loginContainer.style.display = 'block';
        appContainer.style.display = 'none';
    }
});

function generateDeviceId() {
    return 'device-' + Math.random().toString(36).substr(2, 9);
}

// Clase para manejar la base de datos de productos
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

            request.onerror = event => reject('Error abriendo la base de datos:', event.target.error);

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
            transaction.onerror = event => reject('Error agregando el producto:', event.target.error);
        });
    }

    async getProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const request = transaction.objectStore(this.storeName).get(barcode);

            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject('Error obteniendo el producto:', event.target.error);
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
            store.onerror = event => reject('Error buscando productos:', event.target.error);
        });
    }

    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const request = transaction.objectStore(this.storeName).getAll();

            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject('Error obteniendo todos los productos:', event.target.error);
        });
    }
}

// Código para manejar la interfaz de usuario y la lógica de la aplicación
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
            clearForm();
        }
    }

    function fillForm(product) {
        barcodeInput.value = product.barcode;
        descriptionInput.value = product.description;
        stockInput.value = product.stock;
        priceInput.value = product.price;
        productImage.src = product.image || '';
    }

    function clearForm() {
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.src = '';
    }

    async function saveProduct() {
        const barcode = barcodeInput.value;
        const description = descriptionInput.value;
        const stock = parseInt(stockInput.value, 10) || 0;
        const price = parseFloat(priceInput.value) || 0;

        if (barcode) {
            const product = { barcode, description, stock, price, image: productImage.src };
            await db.addProduct(product);
            clearForm();
            alert('Producto Guardado');
        }
    }

    function exportProducts() {
        db.getAllProducts().then(products => {
            const filteredProducts = products.map(p => ({
                'Código de Barras': p.barcode,
                'Descripción': p.description,
                'Stock': p.stock,
                'Precio': p.price
            }));

            const csvContent = "data:text/csv;charset=utf-8," +
                Object.keys(filteredProducts[0]).join(',') + '\n' +
                filteredProducts.map(p => Object.values(p).join(',')).join('\n');

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', 'productos.csv');
            document.body.appendChild(link);
            link.click();
        });
    }

    async function searchInOpenFoodFacts(query) {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${query}.json`);
        const data = await response.json();
        if (data.status === 1 && data.product) {
            const product = {
                barcode: data.product.code || query,
                description: data.product.product_name || 'Desconocido',
                stock: 0,
                price: 0,
                image: data.product.image_url || ''
            };
            await db.addProduct(product);
            return product;
        }
        return null;
    }

    function toggleLowStockView() {
        if (lowStockResults.style.display === 'none') {
            lowStockResults.style.display = 'block';
            loadLowStockProducts();
        } else {
            lowStockResults.style.display = 'none';
        }
    }

    function loadLowStockProducts() {
        db.searchProducts('').then(products => {
            lowStockList.innerHTML = '';
            products.filter(p => p.stock <= 5).forEach(product => {
                const item = document.createElement('li');
                item.textContent = `${product.description} - Stock: ${product.stock}`;
                lowStockList.appendChild(item);
            });
        });
    }

    lowStockButton.addEventListener('click', toggleLowStockView);
    document.getElementById('scan-button').addEventListener('click', startScanner);
    document.getElementById('save-button').addEventListener('click', saveProduct);
    document.getElementById('export-button').addEventListener('click', exportProducts);

    barcodeInput.addEventListener('input', () => searchProduct(barcodeInput.value));
});
