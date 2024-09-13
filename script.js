/*
  © [2024] [SYSMARKETHM]. Todos los derechos reservados.
  
  Este archivo es parte de [M-Escaner], propiedad de [SYSMARKETHM].
  
  El uso, distribución o reproducción no autorizados de este material están estrictamente prohibidos.
  Para obtener permiso para usar cualquier parte de este código, por favor contacta a [https://sysmarket-hm.web.app/].
*/
import { auth, database } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import Dexie from 'https://cdnjs.cloudflare.com/ajax/libs/dexie/3.0.3/dexie.min.js';

// Inicializar Dexie
const db = new Dexie('TiendaDB');
db.version(7).stores({
  clientes: '++id, nombre, apellido, direccion, telefono, email',
  productos: '++id, nombre, precio, barcode',
  pedidos: '++id, customId, clienteId, fecha, total, items, entregado'
});

// Función para obtener o generar un ID de dispositivo único
function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

// Función para vincular el ID del dispositivo al usuario en Realtime Database
async function linkDeviceToUser(userId, deviceId) {
    const userRef = ref(database, `users/${userId}`);
    await set(userRef, { deviceId, lastLogin: new Date().toISOString() });
}

// Función para obtener el ID del dispositivo vinculado desde Realtime Database
async function getUserDevice(userId) {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    return snapshot.exists() ? snapshot.val() : null;
}

// Manejar el formulario de inicio de sesión
const loginForm = document.getElementById('loginForm');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const deviceId = getDeviceId();

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Recuperar el ID del dispositivo vinculado desde Realtime Database
        const userDoc = await getUserDevice(user.uid);

        if (userDoc && userDoc.deviceId) {
            // Si ya existe un dispositivo vinculado
            if (userDoc.deviceId !== deviceId) {
                // Si el dispositivo actual no coincide con el vinculado, denegar acceso
                await auth.signOut();
                loginError.textContent = 'Acceso denegado. Esta cuenta está vinculada a otro dispositivo.';
                return;
            }
        } else {
            // Si es la primera vez que se inicia sesión, vincular el dispositivo
            await linkDeviceToUser(user.uid, deviceId);
        }

        console.log('Usuario autenticado:', user);
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
    } catch (error) {
        console.error('Error de autenticación:', error.code, error.message);
        loginError.textContent = 'Error al iniciar sesión. Verifica tu correo y contraseña.';
    }
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
            const store = transaction.objectStore(this.storeName);
            const request = store.put(product);

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

document.addEventListener('DOMContentLoaded', async () => {
    const productDb = new ProductDatabase();
    await productDb.init();

    // Configuración de eventos para Dexie
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

        if (isBarcode) {
            try {
                const product = await productDb.getProduct(query);
                if (product) {
                    cache.set(query, product);
                    fillForm(product);
                } else {
                    alert('Producto no encontrado en la base de datos local.');
                }
            } catch (error) {
                console.error('Error al buscar producto:', error);
            }
        } else {
            try {
                const products = await productDb.searchProducts(query);
                if (products.length > 0) {
                    cache.set(query, products[0]);
                    fillForm(products[0]);
                } else {
                    alert('Producto no encontrado en la base de datos local.');
                }
            } catch (error) {
                console.error('Error al buscar producto:', error);
            }
        }
    }

    function fillForm(product) {
        descriptionInput.value = product.description;
        stockInput.value = product.stock;
        priceInput.value = product.price;
        productImage.src = product.image || 'default.jpg';
    }

    async function addProductToLocalDatabase() {
        const product = {
            barcode: barcodeInput.value,
            description: descriptionInput.value,
            stock: parseInt(stockInput.value, 10),
            price: parseFloat(priceInput.value),
            image: productImage.src
        };

        try {
            await productDb.addProduct(product);
            alert('Producto agregado a la base de datos local.');
        } catch (error) {
            console.error('Error al agregar producto:', error);
        }
    }

    async function loadExcelData() {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = event.target.result;
            // Aquí puedes usar una librería como SheetJS para procesar el archivo Excel
            // const workbook = XLSX.read(data, { type: 'binary' });
            // const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            // const products = XLSX.utils.sheet_to_json(worksheet);
            // products.forEach(product => productDb.addProduct(product));
        };
        reader.readAsBinaryString(file);
    }

    async function exportToExcel() {
        const products = await productDb.getAllProducts();
        // Aquí puedes usar una librería como SheetJS para exportar productos a un archivo Excel
        // const workbook = XLSX.utils.book_new();
        // const worksheet = XLSX.utils.json_to_sheet(products);
        // XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
        // XLSX.writeFile(workbook, 'products.xlsx');
    }

    document.getElementById('scan-button').addEventListener('click', startScanner);
    document.getElementById('add-product-button').addEventListener('click', addProductToLocalDatabase);
    fileInput.addEventListener('change', loadExcelData);
    document.getElementById('export-button').addEventListener('click', exportToExcel);

    // Mostrar productos con stock bajo
    lowStockButton.addEventListener('click', async () => {
        const products = await productDb.getAllProducts();
        const lowStockProducts = products.filter(p => p.stock < 10);
        lowStockList.innerHTML = lowStockProducts.map(p => `<li>${p.description} - Stock: ${p.stock}</li>`).join('');
    });
});
