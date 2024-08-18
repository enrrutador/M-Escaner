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
            transaction.onerror = event => reject('Error al añadir producto:', event.target.error);
        });
    }

    async getProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const request = transaction.objectStore(this.storeName).get(barcode);

            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject('Error al obtener producto:', event.target.error);
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
            store.onerror = event => reject('Error al buscar productos:', event.target.error);
        });
    }

    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const request = transaction.objectStore(this.storeName).getAll();

            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject('Error al obtener todos los productos:', event.target.error);
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
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = stream;
            scannerContainer.style.display = 'flex';
            video.play();
            scan();
        } catch (error) {
            alert('Error accediendo a la cámara. Asegúrate de que tu navegador tiene permiso para usar la cámara.');
        }
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

    document.getElementById('scan-button').addEventListener('click', () => {
        barcodeDetector = new BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8'] });
        startScanner();
    });

    document.getElementById('search-button').addEventListener('click', async () => {
        const barcode = barcodeInput.value.trim();
        const description = descriptionInput.value.trim();
        if (barcode) {
            searchProduct(barcode);
        } else if (description) {
            searchByDescription(description);
        }
    });

    async function searchProduct(barcode) {
        const product = await db.getProduct(barcode);
        if (product) {
            displayProduct(product);
        } else {
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
            const data = await response.json();
            if (data.product) {
                const product = {
                    barcode: data.product.code,
                    description: data.product.product_name || 'No disponible',
                    stock: 'No disponible',
                    price: 'No disponible',
                    image: data.product.image_url || ''
                };
                displayProduct(product);
                await db.addProduct(product);
            } else {
                alert('Producto no encontrado.');
            }
        }
    }

    async function searchByDescription(description) {
        const products = await db.searchProducts(description);
        if (products.length > 0) {
            displaySearchResults(products);
        } else {
            alert('No se encontraron productos con esa descripción.');
        }
    }

    function displayProduct(product) {
        descriptionInput.value = product.description;
        stockInput.value = product.stock;
        priceInput.value = product.price;
        productImage.src = product.image;
        productImage.style.display = 'block';
    }

    function displaySearchResults(products) {
        resultsList.innerHTML = '';
        products.forEach(product => {
            const li = document.createElement('li');
            li.textContent = `${product.description} - ${product.stock} - ${product.price}`;
            resultsList.appendChild(li);
        });
        searchResults.style.display = 'block';
    }

    document.getElementById('save-button').addEventListener('click', async () => {
        const barcode = barcodeInput.value.trim();
        const description = descriptionInput.value.trim();
        const stock = stockInput.value.trim();
        const price = priceInput.value.trim();
        if (barcode && description) {
            await db.addProduct({ barcode, description, stock, price, image: productImage.src });
            alert('Producto guardado.');
        } else {
            alert('Por favor, rellena el código de barras y la descripción.');
        }
    });

    document.getElementById('clear-button').addEventListener('click', () => {
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.src = '';
        productImage.style.display = 'none';
        resultsList.innerHTML = '';
        searchResults.style.display = 'none';
    });

    document.getElementById('export-button').addEventListener('click', async () => {
        const products = await db.getAllProducts();
        const ws = XLSX.utils.json_to_sheet(products);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Productos');
        XLSX.writeFile(wb, 'productos.xlsx');
    });

    lowStockButton.addEventListener('click', async () => {
        const products = await db.getAllProducts();
        const lowStockProducts = products.filter(product => parseInt(product.stock) < 5);
        displayLowStockProducts(lowStockProducts);
    });

    function displayLowStockProducts(products) {
        lowStockList.innerHTML = '';
        products.forEach(product => {
            const li = document.createElement('li');
            li.textContent = `${product.description} - Stock: ${product.stock}`;
            lowStockList.appendChild(li);
        });
        lowStockResults.style.display = 'block';
    }
});


