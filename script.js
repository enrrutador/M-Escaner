import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

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
            const store = transaction.objectStore(this.storeName);
            const request = store.put(product);

            request.onsuccess = () => resolve();
            request.onerror = event => reject('Error al agregar producto:', event.target.error);
        });
    }

    async getProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName]);
            const store = transaction.objectStore(this.storeName);
            const request = store.get(barcode);

            request.onsuccess = () => resolve(request.result);
            request.onerror = event => reject('Error al obtener producto:', event.target.error);
        });
    }

    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName]);
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = event => reject('Error al obtener todos los productos:', event.target.error);
        });
    }
}

const db = new ProductDatabase();
db.init();

// Función para iniciar el escáner de códigos de barras
function startScanner() {
    const video = document.getElementById('video');
    const scannerOverlay = document.getElementById('scanner-container');
    
    // Configuración del video y la cámara
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
            video.srcObject = stream;
            video.setAttribute('playsinline', true); // necesario para iOS
            video.play();
            
            // Agregar la lógica de escaneo con ZXing
            import { BrowserMultiFormatReader } from 'https://cdn.jsdelivr.net/npm/@zxing/library@0.18.7/esm/index.js';
            const codeReader = new BrowserMultiFormatReader();
            
            codeReader.decodeFromVideoDevice(null, video)
                .then(result => {
                    console.log('Código de barras detectado:', result.text);
                    document.getElementById('barcode').value = result.text;
                })
                .catch(err => console.error('Error al escanear el código de barras:', err));
        })
        .catch(err => {
            console.error('Error al acceder a la cámara:', err);
            alert('No se pudo acceder a la cámara.');
        });

    // Cerrar el escáner cuando se haga clic fuera del área del escáner
    scannerOverlay.addEventListener('click', () => {
        scannerOverlay.style.display = 'none';
        video.srcObject.getTracks().forEach(track => track.stop());
    });
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
    const searchResults = document.getElementById('search-results');
    const resultsList = document.getElementById('results-list');

    resultsList.innerHTML = '';

    if (barcode) {
        try {
            const product = await db.getProduct(barcode);
            if (product) {
                displayProduct(product);
            } else {
                displayNotFound();
            }
        } catch (error) {
            console.error('Error en la búsqueda del producto:', error);
            displayNotFound();
        }
    } else if (description) {
        try {
            const products = await db.getAllProducts();
            const filteredProducts = products.filter(p => p.description.toLowerCase().includes(description.toLowerCase()));
            if (filteredProducts.length > 0) {
                filteredProducts.forEach(product => displayProduct(product));
            } else {
                displayNotFound();
            }
        } catch (error) {
            console.error('Error en la búsqueda de productos:', error);
            displayNotFound();
        }
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
        await db.addProduct(product);
        alert('Producto Guardado');
        clearForm();
    }
});

document.getElementById('export-button').addEventListener('click', async () => {
    const products = await db.getAllProducts();
    const ws = XLSX.utils.json_to_sheet(products);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'productos.xlsx');
});

document.getElementById('low-stock-button').addEventListener('click', async () => {
    const lowStockResults = document.getElementById('low-stock-results');
    const lowStockList = document.getElementById('low-stock-list');

    lowStockList.innerHTML = '';
    lowStockResults.style.display = lowStockResults.style.display === 'none' ? 'block' : 'none';

    if (lowStockResults.style.display === 'block') {
        const products = await db.getAllProducts();
        const lowStockProducts = products.filter(p => p.stock < 5);
        lowStockProducts.forEach(product => {
            const listItem = document.createElement('li');
            listItem.textContent = `Código: ${product.barcode}, Descripción: ${product.description}, Stock: ${product.stock}, Precio: ${product.price}`;
            lowStockList.appendChild(listItem);
        });
    }
});

document.getElementById('clear-search-results').addEventListener('click', () => {
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '';
    document.getElementById('search-results').style.display = 'none';
});

function clearForm() {
    document.getElementById('barcode').value = '';
    document.getElementById('description').value = '';
    document.getElementById('stock').value = '';
    document.getElementById('price').value = '';
    document.getElementById('product-image').src = '';
    document.getElementById('product-image').style.display = 'none';
}


