 import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Inicializar Firestore
const db = getFirestore();

// Función para obtener o generar un ID de dispositivo único
function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = crypto.randomUUID();  // Generar un UUID
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

// Función para vincular el ID del dispositivo al usuario en Firestore
async function linkDeviceToUser(userId, deviceId) {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { deviceId }, { merge: true });
}

// Función para obtener el ID del dispositivo vinculado desde Firestore
async function getUserDevice(userId) {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    return userDoc.exists() ? userDoc.data() : null;
}

// Manejar el formulario de inicio de sesión
const loginForm = document.getElementById('loginForm');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const deviceId = getDeviceId();

    signInWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
            const user = userCredential.user;

            // Recuperar el ID del dispositivo vinculado desde Firestore
            const userDoc = await getUserDevice(user.uid);

            if (userDoc && userDoc.deviceId && userDoc.deviceId !== deviceId) {
                // Si hay una discrepancia, cerrar sesión y mostrar un error
                await auth.signOut();
                alert('Este usuario ya está vinculado a otro dispositivo.');
                return;
            }

            // Vincular el ID del dispositivo actual con la cuenta del usuario si aún no está vinculado
            if (!userDoc || !userDoc.deviceId) {
                await linkDeviceToUser(user.uid, deviceId);
            }

            console.log('Usuario autenticado:', user);
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
    const db = new ProductDatabase();
    await db.init();

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
            const response = await fetch(https://world.openfoodfacts.org/api/v0/product/${query}.json);
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
        alert('Producto guardado correctamente.');
        clearForm();
    });

    document.getElementById('clear-button').addEventListener('click', clearForm);

    function clearForm() {
        barcodeInput.value = '';
        descriptionInput.value = '';
        stockInput.value = '';
        priceInput.value = '';
        productImage.src = '';
        productImage.style.display = 'none';
    }

    lowStockButton.addEventListener('click', async () => {
        if (lowStockResults.style.display === 'block') {
            lowStockResults.style.display = 'none';
            return;
        }

        lowStockList.innerHTML = '';
        const allProducts = await db.getAllProducts();
        const lowStockProducts = allProducts.filter(product => product.stock <= 5);

        if (lowStockProducts.length > 0) {
            lowStockProducts.forEach(product => {
                const li = document.createElement('li');
                li.textContent = ${product.description} (Código: ${product.barcode}) - Stock: ${product.stock};
                lowStockList.appendChild(li);
            });
        } else {
            lowStockList.innerHTML = '<li>No hay productos con stock bajo.</li>';
        }

        lowStockResults.style.display = 'block';
    });

    document.getElementById('import-button').addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const products = XLSX.utils.sheet_to_json(worksheet);

                console.log('Productos leídos del archivo:', products);

                let importedCount = 0;
                for (let product of products) {
                    console.log('Procesando producto:', product);
                    
                    // Función auxiliar para buscar la clave correcta
                    const findKey = (possibleKeys) => {
                        return possibleKeys.find(key => product.hasOwnProperty(key));
                    };

                    // Buscar las claves correctas
                    const barcodeKey = findKey(['Código de barras', 'Codigo de Barras', 'codigo de barras', 'barcode']);
                    const descriptionKey = findKey(['Descripción', 'Descripcion', 'descripcion', 'description']);
                    const stockKey = findKey(['Stock', 'stock']);
                    const priceKey = findKey(['Precio Costo', 'Precio', 'precio', 'price']);
                    const imageKey = findKey(['Imagen', 'imagen', 'image']);

                    if (!barcodeKey) {
                        console.warn('Producto sin código de barras:', product);
                        continue;
                    }

                    try {
                        const newProduct = {
                            barcode: product[barcodeKey].toString(),
                            description: product[descriptionKey] || '',
                            stock: parseInt(product[stockKey] || '0'),
                            price: parseFloat(product[priceKey] || '0'),
                            image: product[imageKey] || ''
                        };

                        console.log('Intentando agregar producto:', newProduct);
                        await db.addProduct(newProduct);
                        importedCount++;
                        console.log('Producto agregado con éxito');
                    } catch (error) {
                        console.error('Error al agregar producto:', product, error);
                    }
                }

                console.log(Importación completada. ${importedCount} productos importados correctamente.);
                alert(Importación completada. ${importedCount} productos importados correctamente.);
            } catch (error) {
                console.error('Error durante la importación:', error);
                alert('Error durante la importación. Por favor, revisa la consola para más detalles.');
            }
        };

        reader.onerror = (error) => {
            console.error('Error al leer el archivo:', error);
            alert('Error al leer el archivo. Por favor, intenta de nuevo.');
        };

        reader.readAsArrayBuffer(file);
    });

    document.getElementById('export-button').addEventListener('click', async () => {
        const allProducts = await db.getAllProducts();
        const worksheet = XLSX.utils.json_to_sheet(allProducts.map(product => ({
            'Código de Barras': product.barcode,
            'Descripción': product.description,
            'Stock': product.stock,
            'Precio': product.price
        })));
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
        
        XLSX.writeFile(workbook, "productos_exportados.xlsx");
    });
});

