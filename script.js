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

            request.onerror = event => reject(`Error opening database: ${event.target.error}`);

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
            transaction.onerror = event => reject(`Error adding product: ${event.target.error}`);
        });
    }

    async getProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const request = transaction.objectStore(this.storeName).get(barcode);

            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(`Error getting product: ${event.target.error}`);
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
            store.onerror = event => reject(`Error searching products: ${event.target.error}`);
        });
    }

    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const request = transaction.objectStore(this.storeName).getAll();

            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(`Error getting all products: ${event.target.error}`);
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

    function showAlert(message) {
        alert(message);
    }

    async function handleScan() {
        // Asegúrate de que la página esté servida sobre HTTPS para permitir el acceso a la cámara
        if (!barcodeDetector) {
            barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'upc_a'] });
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.play();

        const detectBarcode = async () => {
            try {
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes.length > 0) {
                    const barcode = barcodes[0].rawValue;
                    barcodeInput.value = barcode;
                    const product = await db.getProduct(barcode);
                    if (product) {
                        descriptionInput.value = product.description || '';
                        stockInput.value = product.stock || '';
                        priceInput.value = product.price || '';
                        productImage.src = product.image || '';
                        productImage.style.display = product.image ? 'block' : 'none';
                    } else {
                        if (!productNotFoundAlertShown) {
                            showAlert('Producto no encontrado');
                            productNotFoundAlertShown = true;
                        }
                        descriptionInput.value = '';
                        stockInput.value = '';
                        priceInput.value = '';
                        productImage.src = '';
                        productImage.style.display = 'none';
                    }
                }
                requestAnimationFrame(detectBarcode);
            } catch (error) {
                console.error('Error detecting barcode:', error);
            }
        };

        detectBarcode();
        scannerContainer.style.display = 'block';
    }

    document.getElementById('scan-button').addEventListener('click', handleScan);

    async function handleSearch() {
        const query = barcodeInput.value || descriptionInput.value;
        if (!query) {
            showAlert('Por favor ingrese un código de barras o una descripción.');
            return;
        }
        const products = await db.searchProducts(query);
        if (products.length === 0) {
            if (!productNotFoundAlertShown) {
                showAlert('Producto no encontrado');
                productNotFoundAlertShown = true;
            }
            searchResults.style.display = 'none';
            return;
        }
        resultsList.innerHTML = products.map(product => `<li>${product.description} - Stock: ${product.stock} - Precio: ${product.price}</li>`).join('');
        searchResults.style.display = 'block';
    }

    document.getElementById('search-button').addEventListener('click', handleSearch);

    async function handleSave() {
        const barcode = barcodeInput.value;
        if (!barcode) {
            showAlert('Por favor ingrese un código de barras.');
            return;
        }

        const product = {
            barcode,
            description: descriptionInput.value,
            stock: stockInput.value,
            price: priceInput.value,
            image: productImage.src
        };

        await db.addProduct(product);
        showAlert('Producto guardado');
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.src = '';
        productImage.style.display = 'none';
        searchResults.style.display = 'none';
    }

    document.getElementById('save-button').addEventListener('click', handleSave);

    async function handleExport() {
        const products = await db.getAllProducts();
        const worksheet = XLSX.utils.json_to_sheet(products);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
        XLSX.writeFile(workbook, 'productos.xlsx');
    }

    document.getElementById('export-button').addEventListener('click', handleExport);

    async function handleLowStock() {
        const products = await db.getAllProducts();
        const lowStockProducts = products.filter(product => product.stock <= 10);
        lowStockList.innerHTML = lowStockProducts.map(product => `<li>${product.description} - Stock: ${product.stock}</li>`).join('');
        lowStockResults.style.display = 'block';
    }

    lowStockButton.addEventListener('click', handleLowStock);
});
