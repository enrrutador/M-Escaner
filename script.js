import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const errorMessage = document.getElementById('error-message');
    const logoutButton = document.getElementById('logout-button'); // Asume que tienes un botón de logout

    loginForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Previene que el formulario se envíe y recargue la página

        const email = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Autenticación con Firebase
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Inicio de sesión exitoso
                console.log('Usuario autenticado:', userCredential.user);
                loginContainer.style.display = 'none';
                appContainer.style.display = 'block';
            })
            .catch((error) => {
                // Si las credenciales son incorrectas, muestra un mensaje de error
                console.error('Error al iniciar sesión:', error);
                errorMessage.textContent = 'Comunicate con un representante de SYSMARKETHM.';
                errorMessage.style.display = 'block';
                loginForm.reset(); // Limpia los campos del formulario
            });
    });

    // Verifica el estado de autenticación del usuario
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Si el usuario está autenticado, muestra la aplicación principal
            loginContainer.style.display = 'none';
            appContainer.style.display = 'block';
        } else {
            // Si no hay usuario autenticado, muestra el formulario de inicio de sesión
            loginContainer.style.display = 'block';
            appContainer.style.display = 'none';
        }
    });

    // Función para cerrar sesión
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            signOut(auth)
                .then(() => {
                    console.log('Sesión cerrada');
                    loginContainer.style.display = 'block';
                    appContainer.style.display = 'none';
                })
                .catch((error) => {
                    console.error('Error al cerrar sesión:', error);
                });
        });
    }
});

// Aquí seguiría el resto de tu código JavaScript para la funcionalidad de la aplicación

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

    const scanButton = document.getElementById('scan-button');
    const searchButton = document.getElementById('search-button');
    const barcodeInput = document.getElementById('barcode');
    const descriptionInput = document.getElementById('description');
    const stockInput = document.getElementById('stock');
    const priceInput = document.getElementById('price');
    const saveButton = document.getElementById('save-button');
    const clearButton = document.getElementById('clear-button');
    const exportButton = document.getElementById('export-button');
    const lowStockButton = document.getElementById('low-stock-button');
    const resultsList = document.getElementById('results-list');
    const lowStockList = document.getElementById('low-stock-list');
    const scannerContainer = document.getElementById('scanner-container');
    const productImage = document.getElementById('product-image');
    const scanner = new Instascan.Scanner({ video: document.getElementById('video') });

    scanButton.addEventListener('click', () => {
        scannerContainer.style.display = 'block';
        Instascan.Camera.getCameras().then(cameras => {
            if (cameras.length > 0) {
                scanner.start(cameras[0]);
            } else {
                console.error('No cameras found.');
            }
        }).catch(e => console.error(e));
    });

    scanner.addListener('scan', content => {
        barcodeInput.value = content;
        scannerContainer.style.display = 'none';
        // Aquí puedes hacer algo con el código escaneado
    });

    searchButton.addEventListener('click', async () => {
        const query = barcodeInput.value;
        const results = await db.searchProducts(query);

        resultsList.innerHTML = '';
        results.forEach(product => {
            const li = document.createElement('li');
            li.textContent = `${product.barcode} - ${product.description} - ${product.stock} - ${product.price}`;
            resultsList.appendChild(li);
        });

        document.getElementById('search-results').style.display = 'block';
    });

    saveButton.addEventListener('click', async () => {
        const product = {
            barcode: barcodeInput.value,
            description: descriptionInput.value,
            stock: parseInt(stockInput.value, 10),
            price: parseFloat(priceInput.value),
        };

        await db.addProduct(product);
        console.log('Producto guardado:', product);
    });

    clearButton.addEventListener('click', () => {
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
    });

    exportButton.addEventListener('click', async () => {
        const products = await db.getAllProducts();
        const csvRows = [
            ['Barcode', 'Description', 'Stock', 'Price'],
            ...products.map(p => [p.barcode, p.description, p.stock, p.price])
        ];

        const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'products.csv');
        document.body.appendChild(link);
        link.click();
    });

    lowStockButton.addEventListener('click', async () => {
        const allProducts = await db.getAllProducts();
        const lowStockProducts = allProducts.filter(p => p.stock < 10);

        lowStockList.innerHTML = '';
        lowStockProducts.forEach(product => {
            const li = document.createElement('li');
            li.textContent = `${product.barcode} - ${product.description} - ${product.stock} - ${product.price}`;
            lowStockList.appendChild(li);
        });

        document.getElementById('low-stock-results').style.display = 'block';
    });
});
