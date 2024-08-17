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
    db.init().catch(error => console.error(error));

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
    const viewfinder = document.getElementById('viewfinder');

    let codeReader;

    const clearForm = () => {
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.src = '';
        productImage.style.display = 'none';
    };

    document.getElementById('scan-button').addEventListener('click', async () => {
        scannerContainer.style.display = 'block';
        codeReader = new ZXing.BrowserBarcodeReader();
        try {
            const result = await codeReader.decodeOnceFromVideoDevice(undefined, 'video');
            barcodeInput.value = result.text;
            const product = await db.getProduct(result.text);
            if (product) {
                descriptionInput.value = product.description;
                stockInput.value = product.stock;
                priceInput.value = product.price;
                if (product.image) {
                    productImage.src = product.image;
                    productImage.style.display = 'block';
                }
            } else {
                alert('Producto no encontrado');
            }
        } catch (err) {
            console.error(err);
        } finally {
            scannerContainer.style.display = 'none';
            if (codeReader) codeReader.reset();
        }
    });

    document.getElementById('search-button').addEventListener('click', async () => {
        const query = barcodeInput.value || descriptionInput.value;
        if (!query) return alert('Por favor, ingrese un código de barras o descripción para buscar');
        try {
            const products = await db.searchProducts(query);
            if (products.length > 0) {
                searchResults.style.display = 'block';
                resultsList.innerHTML = '';
                products.forEach(product => {
                    const li = document.createElement('li');
                    li.textContent = `${product.description} - ${product.barcode}`;
                    li.addEventListener('click', () => {
                        barcodeInput.value = product.barcode;
                        descriptionInput.value = product.description;
                        stockInput.value = product.stock;
                        priceInput.value = product.price;
                        if (product.image) {
                            productImage.src = product.image;
                            productImage.style.display = 'block';
                        }
                        searchResults.style.display = 'none';
                    });
                    resultsList.appendChild(li);
                });
            } else {
                alert('Producto no encontrado');
            }
        } catch (err) {
            console.error(err);
        }
    });

    document.getElementById('save-button').addEventListener('click', async () => {
        const barcode = barcodeInput.value;
        const description = descriptionInput.value;
        const stock = stockInput.value;
        const price = priceInput.value;

        if (!barcode || !description || !stock || !price) {
            return alert('Por favor, complete todos los campos antes de guardar');
        }

        const product = {
            barcode,
            description,
            stock: parseInt(stock),
            price: parseFloat(price),
            image: productImage.src || ''
        };

        try {
            await db.addProduct(product);
            alert('Producto Guardado');
            clearForm();
        } catch (err) {
            console.error('Error saving product:', err);
        }
    });

    document.getElementById('clear-button').addEventListener('click', clearForm);

    document.getElementById('export-button').addEventListener('click', async () => {
        try {
            const products = await db.getAllProducts();
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(products);
            XLSX.utils.book_append_sheet(wb, ws, 'Productos');
            XLSX.writeFile(wb, 'productos.xlsx');
        } catch (err) {
            console.error('Error exporting products:', err);
        }
    });

    lowStockButton.addEventListener('click', async () => {
        if (lowStockResults.style.display === 'block') {
            lowStockResults.style.display = 'none';
            return;
        }

        try {
            const products = await db.getAllProducts();
            const lowStockProducts = products.filter(p => p.stock < 10); // Ajusta el límite de stock bajo si es necesario

            if (lowStockProducts.length > 0) {
                lowStockResults.style.display = 'block';
                lowStockList.innerHTML = '';
                lowStockProducts.forEach(product => {
                    const li = document.createElement('li');
                    li.textContent = `${product.description} - Stock: ${product.stock}`;
                    lowStockList.appendChild(li);
                });
            } else {
                alert('No hay productos con stock bajo');
            }
        } catch (err) {
            console.error('Error fetching low stock products:', err);
        }
    });
});
