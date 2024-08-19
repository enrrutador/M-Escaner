



import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs";

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
                resolve(this.db);
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
            const store = transaction.objectStore(this.storeName);
            const request = store.put(product);

            request.onsuccess = () => resolve('Product added successfully');
            request.onerror = event => reject('Error adding product:', event.target.error);
        });
    }

    async getProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(barcode);

            request.onsuccess = () => resolve(request.result);
            request.onerror = event => reject('Error fetching product:', event.target.error);
        });
    }

    async getLowStockProducts(threshold = 10) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor();
            const lowStockProducts = [];

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.stock < threshold) {
                        lowStockProducts.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(lowStockProducts);
                }
            };

            request.onerror = event => reject('Error fetching low stock products:', event.target.error);
        });
    }

    async deleteProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(barcode);

            request.onsuccess = () => resolve('Product deleted successfully');
            request.onerror = event => reject('Error deleting product:', event.target.error);
        });
    }
}

const db = new ProductDatabase();

document.getElementById('save-button').addEventListener('click', async () => {
    const barcode = document.getElementById('barcode').value;
    const description = document.getElementById('description').value;
    const stock = document.getElementById('stock').value;
    const price = document.getElementById('price').value;

    if (barcode && description && stock && price) {
        await db.addProduct({ barcode, description, stock, price });
        alert('Producto guardado');
    } else {
        alert('Por favor, rellena todos los campos');
    }
});

document.getElementById('clear-button').addEventListener('click', () => {
    document.getElementById('barcode').value = '';
    document.getElementById('description').value = '';
    document.getElementById('stock').value = '';
    document.getElementById('price').value = '';
});

document.getElementById('search-button').addEventListener('click', async () => {
    const barcode = document.getElementById('barcode').value;
    const result = await db.getProduct(barcode);
    
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '';
    
    if (result) {
        const item = document.createElement('li');
        item.textContent = `Código: ${result.barcode}, Descripción: ${result.description}, Stock: ${result.stock}, Precio: ${result.price}`;
        resultsList.appendChild(item);
        document.getElementById('search-results').style.display = 'block';
    } else {
        alert('Producto no encontrado');
    }
});

document.getElementById('low-stock-button').addEventListener('click', async () => {
    const lowStockProducts = await db.getLowStockProducts();

    const lowStockList = document.getElementById('low-stock-list');
    lowStockList.innerHTML = '';

    if (lowStockProducts.length > 0) {
        lowStockProducts.forEach(product => {
            const item = document.createElement('li');
            item.textContent = `Código: ${product.barcode}, Descripción: ${product.description}, Stock: ${product.stock}`;
            lowStockList.appendChild(item);
        });
        document.getElementById('low-stock-results').style.display = 'block';
    } else {
        alert('No hay productos con stock bajo');
    }
});

document.getElementById('import-button').addEventListener('click', async () => {
    const fileInput = document.getElementById('excel-file');
    if (fileInput.files.length === 0) {
        alert('Por favor, selecciona un archivo de Excel');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        for (const row of rows) {
            const { Código, Descripción, Stock, Precio } = row;
            const barcode = Código;
            const description = Descripción;
            const stock = Stock;
            const price = Precio;

            if (barcode && description && stock && price) {
                await db.addProduct({ barcode, description, stock, price });
            }
        }

        alert('Productos importados');
    };

    reader.readAsArrayBuffer(file);
});

document.getElementById('export-button').addEventListener('click', async () => {
    const transaction = db.db.transaction([db.storeName], 'readonly');
    const store = transaction.objectStore(db.storeName);
    const request = store.getAll();

    request.onsuccess = (event) => {
        const products = event.target.result;
        const ws = XLSX.utils.json_to_sheet(products);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Productos');
        XLSX.writeFile(wb, 'productos.xlsx');
    };
});
