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
    const searchResults = document.getElementById('search-results');
    const resultsList = document.getElementById('results-list');
    const lowStockResults = document.getElementById('low-stock-results');
    const lowStockList = document.getElementById('low-stock-list');

    let scanner;

    document.getElementById('scan-button').addEventListener('click', () => startScanner());
    document.getElementById('search-button').addEventListener('click', () => searchProduct());
    document.getElementById('save-button').addEventListener('click', () => saveProduct());
    document.getElementById('low-stock-button').addEventListener('click', () => toggleLowStock());

    async function startScanner() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = stream;
            scannerContainer.style.display = 'flex';
            video.play();
            scan();
        } catch (error) {
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                alert('Permiso de cámara denegado. Por favor, habilita el acceso a la cámara en la configuración del navegador.');
            } else if (error.name === 'NotFoundError') {
                alert('No se ha encontrado una cámara disponible.');
            } else {
                alert('Error accediendo a la cámara: ' + error.message);
            }
        }
    }

    async function scan() {
        const codeReader = new ZXing.BrowserBarcodeReader();
        scanner = codeReader;
        try {
            const result = await codeReader.decodeFromVideoDevice(null, 'video');
            if (result) {
                video.pause();
                scannerContainer.style.display = 'none';
                barcodeInput.value = result.text;
                fetchProduct(result.text);
            }
        } catch (err) {
            console.error('Error decoding barcode:', err);
        }
    }

    async function searchProduct() {
        const query = barcodeInput.value.trim() || descriptionInput.value.trim();
        if (query) {
            const results = await db.searchProducts(query);
            resultsList.innerHTML = '';
            if (results.length > 0) {
                results.forEach(product => {
                    const li = document.createElement('li');
                    li.textContent = `${product.description} - ${product.stock} en stock`;
                    resultsList.appendChild(li);
                });
                searchResults.style.display = 'block';
            } else {
                alert('Producto no encontrado');
            }
        }
    }

    async function saveProduct() {
        const barcode = barcodeInput.value.trim();
        const description = descriptionInput.value.trim();
        const stock = stockInput.value;
        const price = priceInput.value;
        const product = { barcode, description, stock, price };

        if (barcode && description && stock && price) {
            await db.addProduct(product);
            alert('Producto guardado');
            clearForm();
        } else {
            alert('Por favor, complete todos los campos antes de guardar.');
        }
    }

    async function fetchProduct(barcode) {
        const product = await db.getProduct(barcode);
        if (product) {
            descriptionInput.value = product.description;
            stockInput.value = product.stock;
            priceInput.value = product.price;
            productImage.src = `https://world.openfoodfacts.org/images/products/${barcode}.jpg`;
            productImage.style.display = 'block';
        } else {
            alert('Producto no encontrado');
        }
    }

    async function toggleLowStock() {
        if (lowStockResults.style.display === 'none') {
            const products = await db.getAllProducts();
            const lowStockProducts = products.filter(product => product.stock < 5);
            lowStockList.innerHTML = '';
            lowStockProducts.forEach(product => {
                const li = document.createElement('li');
                li.textContent = `${product.description} - ${product.stock} en stock`;
                lowStockList.appendChild(li);
            });
            lowStockResults.style.display = 'block';
        } else {
            lowStockResults.style.display = 'none';
        }
    }

    function clearForm() {
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.src = '';
        productImage.style.display = 'none';
    }
});
