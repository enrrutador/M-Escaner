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

    function clearFields() {
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.src = '';
        productImage.style.display = 'none';
    }

    function saveProduct() {
        const product = {
            barcode: barcodeInput.value,
            description: descriptionInput.value,
            stock: parseInt(stockInput.value),
            price: parseFloat(priceInput.value)
        };

        db.addProduct(product)
            .then(() => {
                alert('Producto guardado correctamente.');
                clearFields();
            })
            .catch(error => console.error(error));
    }

    document.getElementById('scan-button').addEventListener('click', () => {
        scannerContainer.style.display = 'flex';

        const codeReader = new ZXing.BrowserBarcodeReader();
        codeReader.decodeOnceFromVideoDevice(undefined, 'video')
            .then(result => {
                barcodeInput.value = result.text;
                scannerContainer.style.display = 'none';
            })
            .catch(err => {
                console.error(err);
                scannerContainer.style.display = 'none';
            });
    });

    document.getElementById('search-button').addEventListener('click', () => {
        const query = barcodeInput.value || descriptionInput.value;
        if (query) {
            db.searchProducts(query)
                .then(results => {
                    resultsList.innerHTML = '';
                    searchResults.style.display = results.length > 0 ? 'block' : 'none';
                    if (results.length > 0) {
                        results.forEach(product => {
                            const li = document.createElement('li');
                            li.textContent = `${product.description} - Stock: ${product.stock} - Precio: ${product.price}`;
                            li.addEventListener('click', () => {
                                barcodeInput.value = product.barcode;
                                descriptionInput.value = product.description;
                                stockInput.value = product.stock;
                                priceInput.value = product.price;
                                searchResults.style.display = 'none';
                            });
                            resultsList.appendChild(li);
                        });
                    } else {
                        alert('Producto no encontrado.');
                    }
                })
                .catch(error => console.error(error));
        } else {
            alert('Por favor, ingrese un código de barras o descripción para buscar.');
        }
    });

    document.getElementById('save-button').addEventListener('click', saveProduct);

    document.getElementById('export-button').addEventListener('click', () => {
        db.getAllProducts()
            .then(products => {
                const ws = XLSX.utils.json_to_sheet(products);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Productos');
                XLSX.writeFile(wb, 'productos.xlsx');
            })
            .catch(error => console.error(error));
    });

    document.getElementById('low-stock-button').addEventListener('click', () => {
        db.getAllProducts()
            .then(products => {
                lowStockList.innerHTML = '';
                const lowStockProducts = products.filter(product => product.stock < 5);
                lowStockResults.style.display = lowStockProducts.length > 0 ? 'block' : 'none';
                if (lowStockProducts.length > 0) {
                    lowStockProducts.forEach(product => {
                        const li = document.createElement('li');
                        li.textContent = `${product.description} - Stock: ${product.stock} - Precio: ${product.price}`;
                        lowStockList.appendChild(li);
                    });
                } else {
                    alert('No hay productos con stock bajo.');
                }
            })
            .catch(error => console.error(error));
    });

    document.getElementById('clear-button').addEventListener('click', clearFields);
});
