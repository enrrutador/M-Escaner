// Importar los módulos necesarios desde Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCMv--zL7er-80cFO4kE4BjEaU5HoAT4xM",
    authDomain: "autenticacion-escaner.firebaseapp.com",
    projectId: "autenticacion-escaner",
    storageBucket: "autenticacion-escaner.appspot.com",
    messagingSenderId: "425593572191",
    appId: "1:425593572191:web:ffc9141ff393d17e3f04ea",
    measurementId: "G-BN79XGDJW5"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const analytics = getAnalytics(app);

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
                errorMessage.textContent = 'Usuario o contraseña incorrectos.';
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
    // Aquí seguiría el resto del código JavaScript para la funcionalidad de la aplicación
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
});
