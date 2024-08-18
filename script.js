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

    async searchProductsByDescription(query) {
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
                    resolve(results.length > 0 ? results : []);
                }
            };
            store.onerror = event => reject('Error searching products by description:', event.target.error);
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
    let barcodeDetector;
    let productNotFoundAlertShown = false;

    const cache = new Map();

    async function startScanner() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            video.setAttribute('playsinline', true);
            video.play();

            const scan = () => {
                if (barcodeDetector) {
                    barcodeDetector.detect(video)
                        .then(barcodes => {
                            if (barcodes.length > 0) {
                                const barcode = barcodes[0].rawValue;
                                barcodeInput.value = barcode;
                                searchProduct(barcode);
                                scannerContainer.style.display = 'none';
                                video.srcObject.getTracks().forEach(track => track.stop());
                            }
                            requestAnimationFrame(scan);
                        })
                        .catch(err => console.error('Error detecting barcodes:', err));
                }
            };

            barcodeDetector = new BarcodeDetector({ formats: ['ean_8', 'ean_13', 'upc_a', 'upc_e'] });
            scan();
        } catch (error) {
            console.error('Error starting camera:', error);
        }
    }

    async function searchProduct(barcode) {
        try {
            let product = await db.getProduct(barcode);
            if (product) {
                barcodeInput.value = product.barcode;
                descriptionInput.value = product.description;
                stockInput.value = product.stock || '';
                priceInput.value = product.price || '';
                productImage.src = product.image || '';
                productImage.style.display = product.image ? 'block' : 'none';
            } else {
                productNotFoundAlertShown = true;
                await searchProductInAPI(barcode);
            }
        } catch (error) {
            console.error('Error searching product:', error);
        }
    }

    async function searchProductInAPI(barcode) {
        try {
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
            const data = await response.json();
            if (data.product) {
                const product = {
                    barcode: data.product.code || barcode,
                    description: data.product.product_name || 'No description available',
                    stock: '',
                    price: '',
                    image: data.product.image_url || ''
                };
                barcodeInput.value = product.barcode;
                descriptionInput.value = product.description;
                stockInput.value = product.stock || '';
                priceInput.value = product.price || '';
                productImage.src = product.image || '';
                productImage.style.display = product.image ? 'block' : 'none';

                if (productNotFoundAlertShown) {
                    alert('El producto no se encontró en la base de datos local. Los datos se han cargado desde Open Food Facts.');
                    productNotFoundAlertShown = false;
                }
            } else {
                if (productNotFoundAlertShown) {
                    alert('El producto no se encontró en Open Food Facts. Puedes ingresar manualmente los datos.');
                }
            }
        } catch (error) {
            console.error('Error fetching product from API:', error);
        }
    }

    document.getElementById('scan-button').addEventListener('click', () => {
        scannerContainer.style.display = 'block';
        startScanner();
    });

    document.getElementById('search-button').addEventListener('click', async () => {
        const barcode = barcodeInput.value.trim();
        const description = descriptionInput.value.trim();
        if (barcode) {
            await searchProduct(barcode);
        } else if (description) {
            const products = await db.searchProductsByDescription(description);
            displaySearchResults(products);
        } else {
            alert('Ingresa un código de barras o una descripción para buscar.');
        }
    });

    document.getElementById('save-button').addEventListener('click', async () => {
        try {
            const product = {
                barcode: barcodeInput.value.trim(),
                description: descriptionInput.value.trim(),
                stock: stockInput.value.trim(),
                price: priceInput.value.trim(),
                image: productImage.src || ''
            };
            await db.addProduct(product);
            alert('Producto guardado.');
        } catch (error) {
            console.error('Error saving product:', error);
        }
    });

    document.getElementById('clear-button').addEventListener('click', () => {
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.src = '';
        productImage.style.display = 'none';
    });

    document.getElementById('export-button').addEventListener('click', async () => {
        try {
            const products = await db.getAllProducts();
            const worksheet = XLSX.utils.json_to_sheet(products);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
            XLSX.writeFile(workbook, 'productos.xlsx');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
        }
    });

    lowStockButton.addEventListener('click', async () => {
        try {
            const allProducts = await db.getAllProducts();
            const lowStockProducts = allProducts.filter(product => product.stock && parseInt(product.stock) < 10);
            displayLowStockResults(lowStockProducts);
        } catch (error) {
            console.error('Error retrieving low stock products:', error);
        }
    });

    function displaySearchResults(products) {
        resultsList.innerHTML = '';
        if (products.length === 0) {
            resultsList.innerHTML = '<li>No se encontraron productos.</li>';
        } else {
            products.forEach(product => {
                const listItem = document.createElement('li');
                listItem.textContent = `Código: ${product.barcode}, Descripción: ${product.description}, Stock: ${product.stock}, Precio: ${product.price}`;
                resultsList.appendChild(listItem);
            });
        }
        searchResults.style.display = 'block';
    }

    function displayLowStockResults(products) {
        lowStockList.innerHTML = '';
        if (products.length === 0) {
            lowStockList.innerHTML = '<li>No hay productos con stock bajo.</li>';
        } else {
            products.forEach(product => {
                const listItem = document.createElement('li');
                listItem.textContent = `Código: ${product.barcode}, Descripción: ${product.description}, Stock: ${product.stock}, Precio: ${product.price}`;
                lowStockList.appendChild(listItem);
            });
        }
        lowStockResults.style.display = 'block';
    }
});

