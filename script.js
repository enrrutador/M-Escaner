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

            request.onerror = event => reject('Error abriendo la base de datos:', event.target.error);

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
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(product);

            request.onsuccess = () => resolve();
            request.onerror = event => reject('Error añadiendo producto:', event.target.error);
        });
    }

    async getProduct(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(barcode);

            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject('Error obteniendo producto:', event.target.error);
        });
    }

    async getLowStockProducts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor();
            const lowStockProducts = [];

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.stock <= 5) {
                        lowStockProducts.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(lowStockProducts);
                }
            };

            request.onerror = event => reject('Error obteniendo productos con stock bajo:', event.target.error);
        });
    }
}

const db = new ProductDatabase();
db.init();

// Manejar el botón de escaneo
document.getElementById('scan-button').addEventListener('click', () => {
    const scannerContainer = document.getElementById('scanner-container');
    const video = document.getElementById('video');
    
    scannerContainer.style.display = 'flex';
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            video.srcObject = stream;
            video.play();
            // Aquí iría la lógica para detectar códigos de barras
        })
        .catch(error => {
            console.error('Error accediendo a la cámara:', error);
        });
});

// Manejar la búsqueda de productos
document.getElementById('search-button').addEventListener('click', async () => {
    const barcode = document.getElementById('barcode').value;
    const description = document.getElementById('description').value;

    if (barcode) {
        const product = await db.getProduct(barcode);
        if (product) {
            fillForm(product);
        } else {
            // Buscar en Open Food Facts (ejemplo de uso de fetch)
            try {
                const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
                const data = await response.json();
                if (data.product) {
                    fillForm(data.product);
                } else {
                    alert('Producto no encontrado');
                }
            } catch (error) {
                console.error('Error buscando producto:', error);
                alert('Error buscando producto');
            }
        }
    } else if (description) {
        // Buscar por descripción (en base de datos local o API)
        // ...
    } else {
        alert('Ingrese un código de barras o una descripción para buscar.');
    }
});

// Llenar el formulario con la información del producto
function fillForm(product) {
    document.getElementById('description').value = product.description || '';
    document.getElementById('stock').value = product.stock || '';
    document.getElementById('price').value = product.price || '';
    document.getElementById('product-image').src = product.image_url || '';
    document.getElementById('product-image').style.display = product.image_url ? 'block' : 'none';
}

// Manejar el botón de guardar
document.getElementById('save-button').addEventListener('click', async () => {
    const product = {
        barcode: document.getElementById('barcode').value,
        description: document.getElementById('description').value,
        stock: parseInt(document.getElementById('stock').value, 10),
        price: parseFloat(document.getElementById('price').value),
        image_url: document.getElementById('product-image').src
    };

    try {
        await db.addProduct(product);
        alert('Producto guardado correctamente.');
    } catch (error) {
        console.error('Error guardando producto:', error);
        alert('Error guardando producto.');
    }
});

// Manejar el botón de borrar
document.getElementById('clear-button').addEventListener('click', () => {
    document.getElementById('barcode').value = '';
    document.getElementById('description').value = '';
    document.getElementById('stock').value = '';
    document.getElementById('price').value = '';
    document.getElementById('product-image').src = '';
    document.getElementById('product-image').style.display = 'none';
});

// Manejar el botón de exportar
document.getElementById('export-button').addEventListener('click', async () => {
    try {
        const products = [];
        const transaction = db.db.transaction(db.storeName, 'readonly');
        const store = transaction.objectStore(db.storeName);
        const request = store.openCursor();

        request.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                products.push(cursor.value);
                cursor.continue();
            } else {
                const ws = XLSX.utils.json_to_sheet(products);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Productos');
                XLSX.writeFile(wb, 'productos.xlsx');
                alert('Datos exportados a Excel.');
            }
        };

        request.onerror = event => {
            console.error('Error exportando datos:', event.target.error);
            alert('Error exportando datos.');
        };
    } catch (error) {
        console.error('Error exportando datos:', error);
        alert('Error exportando datos.');
    }
});

// Manejar el botón de importar
document.getElementById('import-button').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const products = XLSX.utils.sheet_to_json(sheet);

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

// Manejar el botón de stock bajo
document.getElementById('low-stock-button').addEventListener('click', async () => {
    try {
        const lowStockProducts = await db.getLowStockProducts();
        const list = document.getElementById('low-stock-list');
        list.innerHTML = '';

        lowStockProducts.forEach(product => {
            const listItem = document.createElement('li');
            listItem.textContent = `${product.description} - Stock: ${product.stock}`;
            list.appendChild(listItem);
        });

        document.getElementById('low-stock-results').style.display = 'block';
    } catch (error) {
        console.error('Error obteniendo productos con stock bajo:', error);
        alert('Error obteniendo productos con stock bajo.');
    }
});

