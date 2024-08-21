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
    const fileInput = document.getElementById('fileInput');
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
                const barcode = barcodes[0].rawValue;
                barcodeInput.value = barcode;
                displayProduct(await db.getProduct(barcode));
                scannerContainer.style.display = 'none';
            }
        }
        requestAnimationFrame(scan);
    }

    function displayProduct(product) {
        if (product) {
            descriptionInput.value = product.description;
            stockInput.value = product.stock;
            priceInput.value = product.price;
            productImage.src = product.image || '';
            productImage.style.display = product.image ? 'block' : 'none';
        } else {
            descriptionInput.value = '';
            stockInput.value = '';
            priceInput.value = '';
            productImage.src = '';
            productImage.style.display = 'none';
            if (!productNotFoundAlertShown) {
                alert('Producto no encontrado');
                productNotFoundAlertShown = true;
            }
        }
    }

    async function saveProduct() {
        const barcode = barcodeInput.value;
        const description = descriptionInput.value;
        const stock = stockInput.value;
        const price = priceInput.value;
        const image = productImage.src;

        const product = { barcode, description, stock, price, image };
        await db.addProduct(product);
        alert('Producto Guardado');
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.src = '';
        productImage.style.display = 'none';
    }

    async function searchProduct() {
        const query = barcodeInput.value || descriptionInput.value;
        if (query.trim() === '') {
            alert('Por favor, ingresa un código de barras o una descripción.');
            return;
        }

        const products = await db.searchProducts(query);
        if (products.length > 0) {
            displayProduct(products[0]);  // Mostrar el primer producto encontrado en los campos editables
            resultsList.innerHTML = '';
            products.forEach(product => {
                const item = document.createElement('li');
                item.textContent = `${product.barcode} - ${product.description} - ${product.stock} - ${product.price}`;
                resultsList.appendChild(item);
            });
            searchResults.style.display = 'block';
        } else {
            resultsList.innerHTML = '<li>Producto no encontrado</li>';
            searchResults.style.display = 'block';
        }
    }

    async function loadProducts() {
        const products = await db.getAllProducts();
        if (products.length > 0) {
            lowStockList.innerHTML = '';
            products.forEach(product => {
                if (parseInt(product.stock) < 10) {
                    const item = document.createElement('li');
                    item.textContent = `${product.barcode} - ${product.description} - ${product.stock} - ${product.price}`;
                    lowStockList.appendChild(item);
                }
            });
            lowStockResults.style.display = 'block';
        } else {
            lowStockList.innerHTML = '<li>No hay productos con stock bajo</li>';
            lowStockResults.style.display = 'block';
        }
    }

    function exportToExcel() {
        db.getAllProducts().then(products => {
            const ws = XLSX.utils.json_to_sheet(products);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Products');
            XLSX.writeFile(wb, 'productos.xlsx');
        });
    }

    async function importFromExcel(file) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);

        for (const product of json) {
            await db.addProduct(product);
        }
        alert('Productos importados exitosamente');
    }

    fileInput.addEventListener('change', (event
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
    const fileInput = document.getElementById('fileInput');
    let barcodeDetector;
    let productNotFoundAlertShown = false;

    // Cache para almacenar productos
    const cache = new Map();

    // Función para iniciar el escáner de códigos de barras
    async function startScanner() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        scannerContainer.style.display = 'flex';
        video.play();
        scan();
    }

    // Función para escanear códigos de barras
    async function scan() {
        if (barcodeDetector && video.readyState === video.HAVE_ENOUGH_DATA) {
            const barcodes = await barcodeDetector.detect(video);
            if (barcodes.length > 0) {
                const barcode = barcodes[0].rawValue;
                barcodeInput.value = barcode;
                const product = await db.getProduct(barcode);
                displayProduct(product);
                scannerContainer.style.display = 'none';
            }
        }
        requestAnimationFrame(scan);
    }

    // Función para mostrar un producto en los campos editables
    function displayProduct(product) {
        if (product) {
            descriptionInput.value = product.description;
            stockInput.value = product.stock;
            priceInput.value = product.price;
            productImage.src = product.image || '';
            productImage.style.display = product.image ? 'block' : 'none';
        } else {
            descriptionInput.value = '';
            stockInput.value = '';
            priceInput.value = '';
            productImage.src = '';
            productImage.style.display = 'none';
            if (!productNotFoundAlertShown) {
                alert('Producto no encontrado');
                productNotFoundAlertShown = true;
            }
        }
    }

    // Función para guardar un producto en la base de datos
    async function saveProduct() {
        const barcode = barcodeInput.value;
        const description = descriptionInput.value;
        const stock = stockInput.value;
        const price = priceInput.value;
        const image = productImage.src;

        const product = { barcode, description, stock, price, image };
        await db.addProduct(product);
        alert('Producto Guardado');
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.src = '';
        productImage.style.display = 'none';
    }

    // Función para buscar productos por código de barras o descripción
    async function searchProduct() {
        const query = barcodeInput.value || descriptionInput.value;
        if (query.trim() === '') {
            alert('Por favor, ingresa un código de barras o una descripción.');
            return;
        }

        const products = await db.searchProducts(query);
        if (products.length > 0) {
            displayProduct(products[0]);  // Mostrar el primer producto encontrado en los campos editables
            resultsList.innerHTML = '';
            products.forEach(product => {
                const item = document.createElement('li');
                item.textContent = `${product.barcode} - ${product.description} - ${product.stock} - ${product.price}`;
                resultsList.appendChild(item);
            });
            searchResults.style.display = 'block';
        } else {
            resultsList.innerHTML = '<li>Producto no encontrado</li>';
            searchResults.style.display = 'block';
        }
    }

    // Función para cargar productos con stock bajo
    async function loadProducts() {
        const products = await db.getAllProducts();
        if (products.length > 0) {
            lowStockList.innerHTML = '';
            products.forEach(product => {
                if (parseInt(product.stock) < 10) {
                    const item = document.createElement('li');
                    item.textContent = `${product.barcode} - ${product.description} - ${product.stock} - ${product.price}`;
                    lowStockList.appendChild(item);
                }
            });
            lowStockResults.style.display = 'block';
        } else {
            lowStockList.innerHTML = '<li>No hay productos con stock bajo</li>';
            lowStockResults.style.display = 'block';
        }
    }

    // Función para exportar productos a Excel
    function exportToExcel() {
        db.getAllProducts().then(products => {
            const ws = XLSX.utils.json_to_sheet(products);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Products');
            XLSX.writeFile(wb, 'productos.xlsx');
        });
    }

    // Función para importar productos desde un archivo Excel
    async function importFromExcel(file) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);

        for (const product of json) {
            await db.addProduct(product);
        }
        alert('Productos importados exitosamente');
    }

    // Manejar el evento de carga de archivos Excel
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        importFromExcel(file);
    });

    // Configurar eventos de los botones
    document.getElementById('scan-button').addEventListener('click', startScanner);
    document.getElementById('save-button').addEventListener('click', saveProduct);
    document.getElementById('search-button').addEventListener('click', searchProduct);
    document.getElementById('export-button').addEventListener('click', exportToExcel);
    lowStockButton.addEventListener('click', () => {
        if (lowStockResults.style.display === 'block') {
            lowStockResults.style.display = 'none';
        } else {
            loadProducts();
        }
    });

    // Verificar soporte para BarcodeDetector
    if ('BarcodeDetector' in window) {
        barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'upc_a', 'ean_8'] });
    } else {
        alert('Barcode Detector no está disponible en este navegador.');
    }
});
