import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import * as XLSX from 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js';

// Incluir ZXing para el escaneo de códigos de barras
import { BrowserMultiFormatReader } from 'https://cdn.jsdelivr.net/npm/@zxing/library@latest/dist/index.min.js';

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

            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                if (!this.db.objectStoreNames.contains(this.storeName)) {
                    this.db.createObjectStore(this.storeName, { keyPath: 'barcode' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                reject('Error al abrir la base de datos: ' + event.target.errorCode);
            };
        });
    }

    async saveProduct(product) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(product);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject('Error al guardar el producto: ' + event.target.errorCode);
        });
    }

    async getProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName]);
            const store = transaction.objectStore(this.storeName);
            const request = store.get(barcode);

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject('Error al obtener el producto: ' + event.target.errorCode);
        });
    }

    async getLowStockProducts() {
        return new Promise((resolve, reject) => {
            const lowStockThreshold = 10; // Ajusta el umbral según sea necesario
            const transaction = this.db.transaction([this.storeName]);
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor();
            const lowStockProducts = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.stock < lowStockThreshold) {
                        lowStockProducts.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(lowStockProducts);
                }
            };

            request.onerror = (event) => reject('Error al obtener los productos con stock bajo: ' + event.target.errorCode);
        });
    }

    async deleteProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(barcode);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject('Error al eliminar el producto: ' + event.target.errorCode);
        });
    }
}

const productDb = new ProductDatabase();
productDb.init();

// Manejar el botón de importar desde Excel
document.getElementById('import-button').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', handleFile);
    input.click();
});

function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        json.forEach(async (product) => {
            await productDb.saveProduct(product);
        });

        alert('Productos importados');
    };
    reader.readAsArrayBuffer(file);
}

// Manejar el botón de buscar producto
document.getElementById('search-button').addEventListener('click', async () => {
    const barcode = document.getElementById('barcode').value;
    const description = document.getElementById('description').value;

    let product = barcode ? await productDb.getProduct(barcode) : null;
    
    if (!product && description) {
        // Buscar en Open Food Facts
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await response.json();
        if (data.product) {
            product = {
                barcode: barcode,
                description: data.product.product_name || '',
                stock: 0,
                price: 0,
                image: data.product.image_url || ''
            };
        }
    }

    if (product) {
        document.getElementById('barcode').value = product.barcode;
        document.getElementById('description').value = product.description;
        document.getElementById('stock').value = product.stock;
        document.getElementById('price').value = product.price;
        const productImage = document.getElementById('product-image');
        productImage.src = product.image;
        productImage.style.display = product.image ? 'block' : 'none';
    }
});

document.getElementById('save-button').addEventListener('click', async () => {
    const barcode = document.getElementById('barcode').value;
    const description = document.getElementById('description').value;
    const stock = parseInt(document.getElementById('stock').value) || 0;
    const price = parseFloat(document.getElementById('price').value) || 0;
    
    if (barcode) {
        const product = { barcode, description, stock, price };
        await productDb.saveProduct(product);
        alert('Producto guardado');
    }
});

document.getElementById('clear-button').addEventListener('click', () => {
    document.getElementById('barcode').value = '';
    document.getElementById('description').value = '';
    document.getElementById('stock').value = '';
    document.getElementById('price').value = '';
    document.getElementById('product-image').style.display = 'none';
});

document.getElementById('export-button').addEventListener('click', async () => {
    const products = await productDb.getLowStockProducts();
    const ws = XLSX.utils.json_to_sheet(products);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos con Stock Bajo');
    XLSX.writeFile(wb, 'productos_stock_bajo.xlsx');
});

document.getElementById('low-stock-button').addEventListener('click', async () => {
    const lowStockProducts = await productDb.getLowStockProducts();
    const list = document.getElementById('low-stock-list');
    list.innerHTML = '';

    lowStockProducts.forEach(product => {
        const li = document.createElement('li');
        li.textContent = `Código: ${product.barcode}, Descripción: ${product.description}, Stock: ${product.stock}`;
        list.appendChild(li);
    });

    document.getElementById('low-stock-results').style.display = 'block';
});

function startScanner() {
    const video = document.getElementById('video');
    const scannerContainer = document.getElementById('scanner-container');
    const codeReader = new BrowserMultiFormatReader();

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then((stream) => {
                video.srcObject = stream;
                video.setAttribute('playsinline', true);
                video.play();

                codeReader.decodeFromVideoDevice(null, 'video', (result, error) => {
                    if (result) {
                        document.getElementById('barcode').value = result.text;
                        codeReader.reset(); // Detener el escaneo después de leer un código
                    }
                    if (error) {
                        console.error('Error en el escaneo: ', error);
                    }
                });
            })
            .catch((err) => {
                console.error('Error al acceder a la cámara: ', err);
            });
    }
}
