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
    const clearButton = document.getElementById('clear-button');
    const toggleSearchResults = document.getElementById('toggle-search-results');
    const toggleLowStockResults = document.getElementById('toggle-low-stock-results');
    let barcodeDetector;
    let productNotFoundAlertShown = false;

    const cache = new Map();

    async function startScanner() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        scannerContainer.style.display = 'block';

        const codeReader = new ZXing.BrowserMultiFormatReader();
        codeReader.decodeOnceFromVideoDevice(undefined, video)
            .then(result => {
                barcodeInput.value = result.text;
                scannerContainer.style.display = 'none';
                video.srcObject.getTracks().forEach(track => track.stop());
                codeReader.reset();
                loadProductDetails(result.text);
            })
            .catch(err => {
                console.error('Error scanning:', err);
            });
    }

    function loadProductDetails(barcode) {
        db.getProduct(barcode).then(product => {
            if (product) {
                descriptionInput.value = product.description;
                stockInput.value = product.stock;
                priceInput.value = product.price;
                productImage.src = product.imageURL || '';
                productImage.style.display = product.imageURL ? 'block' : 'none';
                productNotFoundAlertShown = false;
            } else {
                descriptionInput.value = '';
                stockInput.value = '';
                priceInput.value = '';
                productImage.style.display = 'none';
                if (!productNotFoundAlertShown) {
                    alert('Producto no encontrado. Por favor ingréselo manualmente.');
                    productNotFoundAlertShown = true;
                }
            }
        }).catch(error => {
            console.error('Error al cargar los detalles del producto:', error);
        });
    }

    document.getElementById('scan-button').addEventListener('click', startScanner);

    document.getElementById('save-button').addEventListener('click', () => {
        const product = {
            barcode: barcodeInput.value,
            description: descriptionInput.value,
            stock: parseInt(stockInput.value),
            price: parseFloat(priceInput.value),
            imageURL: productImage.src
        };
        db.addProduct(product).then(() => {
            alert('Producto guardado con éxito.');
        }).catch(error => {
            console.error('Error al guardar el producto:', error);
        });
    });

    document.getElementById('export-button').addEventListener('click', () => {
        db.getAllProducts().then(products => {
            const worksheet = XLSX.utils.json_to_sheet(products);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
            XLSX.writeFile(workbook, "productos.xlsx");
        });
    });

    document.getElementById('import-button').addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const products = XLSX.utils.sheet_to_json(sheet);
            products.forEach(product => db.addProduct(product));
            alert('Productos importados con éxito.');
        };
        reader.readAsArrayBuffer(file);
    });

    document.getElementById('search-button').addEventListener('click', () => {
        const query = barcodeInput.value;
        db.searchProducts(query).then(results => {
            resultsList.innerHTML = '';
            results.forEach(product => {
                const li = document.createElement('li');
                li.textContent = `Código: ${product.barcode}, Descripción: ${product.description}, Stock: ${product.stock}, Precio: ${product.price}`;
                resultsList.appendChild(li);
            });
            searchResults.style.display = 'block';
        });
    });

    toggleSearchResults.addEventListener('click', () => {
        const display = resultsList.style.display === 'none' ? 'block' : 'none';
        resultsList.style.display = display;
    });

    lowStockButton.addEventListener('click', () => {
        db.getAllProducts().then(products => {
            const lowStockProducts = products.filter(product => product.stock < 10);
            lowStockList.innerHTML = '';
            lowStockProducts.forEach(product => {
                const li = document.createElement('li');
                li.textContent = `Código: ${product.barcode}, Descripción: ${product.description}, Stock: ${product.stock}, Precio: ${product.price}`;
                lowStockList.appendChild(li);
            });
            lowStockResults.style.display = 'block';
        });
    });

    toggleLowStockResults.addEventListener('click', () => {
        const display = lowStockList.style.display === 'none' ? 'block' : 'none';
        lowStockList.style.display = display;
    });

    clearButton.addEventListener('click', () => {
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.style.display = 'none';
    });
});

