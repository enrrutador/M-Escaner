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

// Tu código existente aquí...

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
    let barcodeDetector;
    let productNotFoundAlertShown = false;

    const cache = new Map();

    async function startScanner() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = stream;
            scannerContainer.style.display = 'flex';
            video.play();
            scan();
        } catch (error) {
            alert('Error accediendo a la cámara. Asegúrate de que tu navegador tiene permiso para usar la cámara.');
        }
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
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${query}.json`);
            const data = await response.json();

            if (data.product) {
                const product = {
                    barcode: data.product.code,
                    description: data.product.product_name || 'Sin nombre',
                    stock: 0,
                    price: 0,
                    image: data.product.image_url || ''
                };

                await db.addProduct(product);
                return product;
            }
        } catch (error) {
            console.error('Error al buscar en OpenFoodFacts:', error);
        }
        return null;
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
    }

    document.getElementById('scan-button').addEventListener('click', async () => {
        if (!('BarcodeDetector' in window)) {
            alert('API de detección de códigos de barras no soportada en este navegador.');
            return;
        }

        if (!barcodeDetector) {
            barcodeDetector = new BarcodeDetector({ formats: ['ean_13'] });
        }

        startScanner();
    });

    document.getElementById('search-button').addEventListener('click', () => {
        const query = barcodeInput.value.trim();
        if (query) {
            searchProduct(query);
        } else {
            alert('Por favor, introduce un código de barras para buscar.');
        }
    });

    document.getElementById('save-button').addEventListener('click', async () => {
        const product = {
            barcode: barcodeInput.value.trim(),
            description: descriptionInput.value.trim(),
            stock: parseInt(stockInput.value),
            price: parseFloat(priceInput.value),
            image: productImage.src || ''
        };

        await db.addProduct(product);
        alert('Producto guardado.');
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
        const products = await db.getAllProducts();
        const worksheet = XLSX.utils.json_to_sheet(products);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
        XLSX.writeFile(workbook, 'productos.xlsx');
    });

    lowStockButton.addEventListener('click', async () => {
        const products = await db.getAllProducts();
        const lowStockProducts = products.filter(product => product.stock <= 5);
        lowStockList.innerHTML = '';
        if (lowStockProducts.length > 0) {
            lowStockProducts.forEach(product => {
                const li = document.createElement('li');
                li.textContent = `${product.description} (Stock: ${product.stock})`;
                lowStockList.appendChild(li);
            });
            lowStockResults.style.display = 'block';
        } else {
            lowStockResults.style.display = 'none';
            alert('No hay productos con stock bajo.');
        }
    });
});

// Agrega esto al final del script JavaScript
document.getElementById('import-button').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0]; // Asume que los datos están en la primera hoja
                const sheet = workbook.Sheets[sheetName];
                const products = XLSX.utils.sheet_to_json(sheet);
                
                // Validar y agregar productos
                for (const product of products) {
                    if (product.barcode && product.description && product.stock !== undefined && product.price !== undefined) {
                        await db.addProduct(product);
                    }
                }
                
                alert('Productos importados correctamente.');
            } catch (error) {
                console.error('Error al importar productos:', error);
                alert('Error al importar productos.');
            }
        };
        reader.readAsArrayBuffer(file);
    }
});
