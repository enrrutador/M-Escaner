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

// Clase para la base de datos de productos
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

            request.onerror = (event) => reject('Error opening database:', event.target.error);

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const store = db.createObjectStore(this.storeName, { keyPath: 'barcode' });
                store.createIndex('description', 'description', { unique: false });
            };
        });
    }

    async addProduct(product) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const request = transaction.objectStore(this.storeName).put(product);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject('Error adding product:', event.target.error);
        });
    }

    async getProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const request = transaction.objectStore(this.storeName).get(barcode);

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject('Error getting product:', event.target.error);
        });
    }

    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const request = transaction.objectStore(this.storeName).getAll();

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject('Error getting all products:', event.target.error);
        });
    }

    async searchProducts(query) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('description');
            const request = index.openCursor();
            const results = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const normalizedDescription = normalizeText(cursor.value.description);
                    const normalizedQuery = normalizeText(query);
                    if (normalizedDescription.includes(normalizedQuery)) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = (event) => reject('Error searching products:', event.target.error);
        });
    }
}

// Función para normalizar texto
function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
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
    const lowStockButton = document.getElementById('low-stock-button');
    const lowStockResults = document.getElementById('low-stock-results');
    const lowStockList = document.getElementById('low-stock-list');
    const fileInput = document.getElementById('fileInput');
    const exportButton = document.getElementById('export-button');
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
        const isBarcode = /^\d+$/.test(query);

        if (cache.has(query)) {
            fillForm(cache.get(query));
            return;
        }

        let product;

        if (isBarcode) {
            product = await db.getProduct(query);
        } else {
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
        barcodeInput.value = product.barcode || '';
        descriptionInput.value = product.description || '';
        stockInput.value = product.stock || '';
        priceInput.value = product.price || '';
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
        const query = barcodeInput.value.trim() || descriptionInput.value.trim();
        if (query) {
            searchProduct(query);
        } else {
            alert('Por favor, introduce un código de barras o nombre de producto para buscar.');
        }
    });

    document.getElementById('save-button').addEventListener('click', async () => {
        const product = {
            barcode: barcodeInput.value.trim(),
            description: descriptionInput.value.trim(),
            stock: parseInt(stockInput.value) || 0,
            price: parseFloat(priceInput.value) || 0,
            image: productImage.src || ''
        };

        await db.addProduct(product);
        cache.set(product.barcode, product);
        alert('Producto guardado correctamente.');
    });

    lowStockButton.addEventListener('click', async () => {
        if (lowStockResults.style.display === 'block') {
            lowStockResults.style.display = 'none';
            lowStockList.innerHTML = '';
            return;
        }

        const products = await db.getAllProducts();
        const lowStockProducts = products.filter(product => product.stock < 10);

        if (lowStockProducts.length > 0) {
            lowStockResults.style.display = 'block';
            lowStockList.innerHTML = lowStockProducts.map(product => `
                <li>${product.description} (Stock: ${product.stock})</li>
            `).join('');
        } else {
            alert('No hay productos con stock bajo.');
        }
    });

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            const extension = file.name.split('.').pop().toLowerCase();
            if (extension === 'csv') {
                await handleFile(file);
            } else if (extension === 'xlsx') {
                await handleXLSX(file);
            } else {
                alert('Formato de archivo no soportado. Por favor, usa un archivo .csv o .xlsx.');
            }
            fileInput.value = ''; // Limpiar el input después de manejar el archivo
        }
    });

    exportButton.addEventListener('click', async () => {
        const products = await db.getAllProducts();
        const csvContent = generateCSVContent(products);

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'productos.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    function generateCSVContent(products) {
        const headers = [
            'Código de barras', 'Descripción', 'Rubro', 'Precio Costo',
            '% IVA', '% Utilidad', 'Precio Venta', 'Proveedor',
            'Stock', 'Stock mínimo', 'Stock máximo', 'Control Stock', 'Activo'
        ];
        const rows = products.map(product => [
            product.barcode || '',
            product.description || '',
            '', '', '', '', // Rubro, Precio Costo, % IVA, % Utilidad
            product.price || '',
            '', '', '', '', '', '' // Proveedor, Stock mínimo, Stock máximo, Control Stock, Activo
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.join(';'))
        ].join('\n');

        return csvContent;
    }

    async function handleXLSX(file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            const products = jsonData.slice(1).map(row => ({
                barcode: row[0]?.toString() || '',
                description: row[1] || '',
                stock: parseInt(row[8]) || 0,
                price: parseFloat(row[6]) || 0,
                image: '' // No se maneja imagen en la importación de XLSX
            }));

            for (const product of products) {
                await db.addProduct(product);
                cache.set(product.barcode, product);
            }
            alert('Productos importados correctamente desde XLSX.');
        };
        reader.readAsArrayBuffer(file);
    }

    async function handleFile(file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const products = text.split('\n').slice(1).map(line => {
                const [barcode, description, , , , , price, , stock] = line.split(';');
                return {
                    barcode: barcode?.trim() || '',
                    description: description?.trim() || '',
                    stock: parseInt(stock) || 0,
                    price: parseFloat(price) || 0,
                    image: '' // No se maneja imagen en la importación de CSV
                };
            });

            for (const product of products) {
                await db.addProduct(product);
                cache.set(product.barcode, product);
            }
            alert('Productos importados correctamente desde CSV.');
        };
        reader.readAsText(file);
    }
});

