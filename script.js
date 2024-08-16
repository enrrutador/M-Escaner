document.addEventListener('DOMContentLoaded', () => {
    const loginModal = document.getElementById('login-modal');
    const loginButton = document.getElementById('login-button');
    const loginError = document.getElementById('login-error');
    const appContainer = document.getElementById('app-container');

    // Mostrar el modal de inicio de sesión
    loginModal.classList.add('show');

    loginButton.addEventListener('click', () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Verificar usuario y contraseña
        if (username === 'admin' && password === '1234') {
            loginModal.classList.remove('show');
            appContainer.style.display = 'block';
        } else {
            loginError.style.display = 'block';
        }
    });

    // Código existente para el manejo de productos, escaneo, etc.
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

    async function searchInOpenFoodFacts(query) {
        try {
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${query}.json`, { timeout: 5000 });
            const data = await response.json();

            if (data.product) {
                const product = {
                    barcode: data.product.code || query,
                    description: data.product.product_name || 'No disponible',
                    stock: 0,
                    price: 0,
                    image: data.product.image_url || ''
                };
                return product;
            }
            return null;
        } catch (error) {
            console.error('Error fetching product from Open Food Facts:', error);
            return null;
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
            const worksheet = XLSX.utils.json_to_sheet(filteredProducts, { header: headers });
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
            XLSX.writeFile(workbook, 'productos_exportados.xlsx');
        });
    }

    async function showLowStockProducts() {
        const products = await db.getAllProducts();
        const lowStockProducts = products.filter(p => p.stock < 6);

        lowStockList.innerHTML = '';
        lowStockProducts.forEach(product => {
            const li = document.createElement('li');
            li.textContent = `${product.description} (Stock: ${product.stock})`;
            lowStockList.appendChild(li);
        });

        lowStockResults.style.display = lowStockResults.style.display === 'none' ? 'block' : 'none';
    }

    document.getElementById('scan-button').addEventListener('click', startScanner);
    document.getElementById('search-button').addEventListener('click', () => {
        const query = barcodeInput.value || descriptionInput.value;
        searchProduct(query);
    });
    document.getElementById('save-button').addEventListener('click', saveProduct);
    document.getElementById('clear-button').addEventListener('click', clearForm);
    document.getElementById('export-button').addEventListener('click', exportProducts);
    lowStockButton.addEventListener('click', showLowStockProducts);

    if ('BarcodeDetector' in window) {
        barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39'] });
    } else {
        alert('BarcodeDetector no soportado en este navegador.');
    }
});
