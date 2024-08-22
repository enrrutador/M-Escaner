import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

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

document.addEventListener('DOMContentLoaded', async () => {
    const db = new ProductDatabase();
    await db.init();

    const loginForm = document.getElementById('loginForm');
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const loginError = document.getElementById('login-error');
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

    async function startScanner() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = stream;
            scannerContainer.style.display = 'flex';
            video.play();
            scan();
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('No se pudo acceder a la cámara. Por favor, asegúrate de que tienes una cámara disponible y has dado permiso para usarla.');
        }
    }

    async function scan() {
        if (barcodeDetector && video.readyState === video.HAVE_ENOUGH_DATA) {
            try {
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes.length > 0) {
                    const barcode = barcodes[0].rawValue;
                    barcodeInput.value = barcode;
                    const product = await db.getProduct(barcode);
                    if (product) {
                        descriptionInput.value = product.description;
                        stockInput.value = product.stock;
                        priceInput.value = product.price;
                        productImage.src = product.image || '';
                        productImage.style.display = product.image ? 'block' : 'none';
                    } else
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
                    scannerContainer.style.display = 'none';
                    stopScanner();
                }
            } catch (error) {
                console.error('Error scanning barcode:', error);
            }
        }
        requestAnimationFrame(scan);
    }

    function stopScanner() {
        const stream = video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
        scannerContainer.style.display = 'none';
    }

    async function saveProduct() {
        const barcode = barcodeInput.value;
        const description = descriptionInput.value;
        const stock = stockInput.value;
        const price = priceInput.value;
        const image = productImage.src;

        if (!barcode || !description || !stock || !price) {
            alert('Por favor, complete todos los campos antes de guardar.');
            return;
        }

        const product = { barcode, description, stock, price, image };
        await db.addProduct(product);
        alert('Producto Guardado');
        clearForm();
    }

    async function searchProduct() {
        const query = barcodeInput.value || descriptionInput.value;
        if (!query) {
            alert('Por favor, ingrese un código de barras o una descripción para buscar.');
            return;
        }
        const products = await db.searchProducts(query);
        displaySearchResults(products);
    }

    function displaySearchResults(products) {
        resultsList.innerHTML = '';
        if (products.length > 0) {
            products.forEach(product => {
                const item = document.createElement('li');
                item.textContent = `${product.barcode} - ${product.description} - Stock: ${product.stock} - Precio: ${product.price}`;
                item.addEventListener('click', () => fillFormWithProduct(product));
                resultsList.appendChild(item);
            });
        } else {
            resultsList.innerHTML = '<li>No se encontraron productos</li>';
        }
        searchResults.style.display = 'block';
    }

    function fillFormWithProduct(product) {
        barcodeInput.value = product.barcode;
        descriptionInput.value = product.description;
        stockInput.value = product.stock;
        priceInput.value = product.price;
        productImage.src = product.image || '';
        productImage.style.display = product.image ? 'block' : 'none';
    }

    async function loadLowStockProducts() {
        const products = await db.getAllProducts();
        const lowStockProducts = products.filter(product => parseInt(product.stock) < 10);
        displayLowStockProducts(lowStockProducts);
    }

    function displayLowStockProducts(products) {
        lowStockList.innerHTML = '';
        if (products.length > 0) {
            products.forEach(product => {
                const item = document.createElement('li');
                item.textContent = `${product.barcode} - ${product.description} - Stock: ${product.stock} - Precio: ${product.price}`;
                item.addEventListener('click', () => fillFormWithProduct(product));
                lowStockList.appendChild(item);
            });
        } else {
            lowStockList.innerHTML = '<li>No hay productos con stock bajo</li>';
        }
        lowStockResults.style.display = 'block';
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

    function clearForm() {
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.src = '';
        productImage.style.display = 'none';
        productNotFoundAlertShown = false;
    }

    document.getElementById('scan-button').addEventListener('click', startScanner);
    document.getElementById('search-button').addEventListener('click', searchProduct);
    document.getElementById('save-button').addEventListener('click', saveProduct);
    document.getElementById('low-stock-button').addEventListener('click', loadLowStockProducts);
    document.getElementById('export-button').addEventListener('click', exportToExcel);
    document.getElementById('import-button').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importFromExcel(file);
        }
    });

    barcodeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchProduct();
        }
    });

    (async function initBarcodeDetector() {
        if ('BarcodeDetector' in window) {
            barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        } else {
            console.warn('Barcode Detector is not supported by this browser.');
            document.getElementById('scan-button').style.display = 'none';
        }
    })();
});
