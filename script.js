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
            transaction.objectStore(this.storeName).get(barcode).onsuccess = event => resolve(event.target.result);
            transaction.onerror = event => reject('Error getting product:', event.target.error);
        });
    }

    async getLowStockProducts(threshold = 5) {
        return new Promise((resolve, reject) => {
            const products = [];
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor();

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.stock <= threshold) {
                        products.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(products);
                }
            };

            request.onerror = event => reject('Error retrieving low stock products:', event.target.error);
        });
    }

    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const products = [];
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor();

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    products.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(products);
                }
            };

            request.onerror = event => reject('Error retrieving all products:', event.target.error);
        });
    }
}

const productDB = new ProductDatabase();
await productDB.init();

const scanButton = document.getElementById('scan-button');
const searchButton = document.getElementById('search-button');
const saveButton = document.getElementById('save-button');
const exportButton = document.getElementById('export-button');
const lowStockButton = document.getElementById('low-stock-button');
const searchResults = document.getElementById('search-results');
const lowStockResults = document.getElementById('low-stock-results');
const barcodeInput = document.getElementById('barcode');
const descriptionInput = document.getElementById('description');
const stockInput = document.getElementById('stock');
const priceInput = document.getElementById('price');
const resultsList = document.getElementById('results-list');
const lowStockList = document.getElementById('low-stock-list');
const productImage = document.getElementById('product-image');

scanButton.addEventListener('click', startBarcodeScanner);
searchButton.addEventListener('click', searchProduct);
saveButton.addEventListener('click', saveProduct);
exportButton.addEventListener('click', exportToExcel);
lowStockButton.addEventListener('click', toggleLowStockProducts);

async function startBarcodeScanner() {
    // Lógica para iniciar el escáner de código de barras
}

async function searchProduct() {
    const barcode = barcodeInput.value.trim();
    const description = descriptionInput.value.trim();

    if (barcode === '' && description === '') {
        alert('Por favor, ingresa un código de barras o una descripción del producto.');
        return;
    }

    try {
        let product = null;

        if (barcode !== '') {
            product = await productDB.getProduct(barcode);
        }

        if (!product && description !== '') {
            const allProducts = await productDB.getAllProducts();
            product = allProducts.find(p => p.description.toLowerCase() === description.toLowerCase());
        }

        if (product) {
            displayProductDetails(product);
            displaySearchResults([product]);
        } else {
            alert('Producto no encontrado.');
        }
    } catch (error) {
        console.error('Error searching product:', error);
    }
}

async function saveProduct() {
    const barcode = barcodeInput.value.trim();
    const description = descriptionInput.value.trim();
    const stock = parseInt(stockInput.value.trim());
    const price = parseFloat(priceInput.value.trim());

    if (barcode === '' || description === '' || isNaN(stock) || isNaN(price)) {
        alert('Por favor, completa todos los campos.');
        return;
    }

    try {
        const product = { barcode, description, stock, price };
        await productDB.addProduct(product);

        alert('Producto guardado correctamente.');
        clearFormFields();
    } catch (error) {
        console.error('Error saving product:', error);
    }
}

async function exportToExcel() {
    try {
        const products = await productDB.getAllProducts();
        if (products.length === 0) {
            alert('No hay productos para exportar.');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(products);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Productos');
        XLSX.writeFile(wb, 'productos.xlsx');
    } catch (error) {
        console.error('Error exporting to Excel:', error);
    }
}

async function toggleLowStockProducts() {
    if (lowStockResults.style.display === 'block') {
        lowStockResults.style.display = 'none';
        return;
    }

    try {
        const products = await productDB.getLowStockProducts();

        if (products.length === 0) {
            alert('No hay productos con stock bajo.');
            return;
        }

        displayLowStockProducts(products);
        lowStockResults.style.display = 'block';
    } catch (error) {
        console.error('Error retrieving low stock products:', error);
    }
}

function displayProductDetails(product) {
    barcodeInput.value = product.barcode;
    descriptionInput.value = product.description;
    stockInput.value = product.stock;
    priceInput.value = product.price;
    productImage.src = ''; // Ruta de la imagen del producto, si está disponible
    productImage.style.display = 'block';
}

function displaySearchResults(products) {
    resultsList.innerHTML = '';
    searchResults.style.display = 'block';

    products.forEach(product => {
        const li = document.createElement('li');
        li.textContent = `${product.description} - Stock: ${product.stock} - Precio: ${product.price}`;
        resultsList.appendChild(li);
    });
}

function displayLowStockProducts(products) {
    lowStockList.innerHTML = '';

    products.forEach(product => {
        const li = document.createElement('li');
        li.textContent = `${product.description} - Stock: ${product.stock}`;
        lowStockList.appendChild(li);
    });
}

function clearFormFields() {
    barcodeInput.value = '';
    descriptionInput.value = '';
    stockInput.value = '';
    priceInput.value = '';
    productImage.style.display = 'none';
    searchResults.style.display = 'none';
}
