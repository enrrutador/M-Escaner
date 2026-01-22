// indexeddb.js
const dbName = "InventoryDB";
export const storeName = "products";
const version = 1;

let db;
let dbReady = false; // Indicador de disponibilidad de IndexedDB

export function initializeIndexedDB() {
  const request = indexedDB.open(dbName, version);

  request.onupgradeneeded = function (event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName, { keyPath: "barcode" });
    }
  };

  request.onsuccess = function (event) {
    db = event.target.result;
    dbReady = true; // Marcamos que IndexedDB está lista
    console.log("IndexedDB opened successfully");
    updateProductCount(); // Actualizar la cantidad de productos al cargar la base de datos
    updateLowStockCount(); // Actualizar la cantidad de productos con stock bajo al cargar la base de datos
    updateLastScannedProduct(); // Actualizar el último producto escaneado al cargar la base de datos
  };

  request.onerror = function (event) {
    console.error("Error opening IndexedDB", event.target.errorCode);
  };
}

export async function waitForDB() {
  while (!dbReady) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

export async function updateProductCount() {
  await waitForDB(); // Esperar a que IndexedDB esté lista
  const products = await getAllProducts();
  const productCountElement = document.getElementById('totalProducts');
  if (productCountElement) {
    productCountElement.textContent = `${products.length} productos`;
  }
}

export async function updateLowStockCount() {
  await waitForDB(); // Esperar a que IndexedDB esté lista
  const products = await getAllProducts();
  const lowStockProducts = products.filter(product => product.stock <= 5);
  const lowStockCountElement = document.getElementById('lowStockProducts');
  if (lowStockCountElement) {
    lowStockCountElement.textContent = `${lowStockProducts.length} items`;
  }
}

export async function updateLastScannedProduct() {
  await waitForDB(); // Esperar a que IndexedDB esté lista
  const products = await getAllProducts();
  const lastScannedProduct = products[products.length - 1];
  const lastScannedElement = document.getElementById('lastScannedProduct');
  if (lastScannedElement && lastScannedProduct) {
    lastScannedElement.textContent = `${lastScannedProduct.barcode} ${lastScannedProduct.stock <= 5 ? '<span class="status-badge low">Alerta</span>' : '<span class="status-badge good">OK</span>'}`;
  }
}

export async function getAllProducts() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const request = transaction.objectStore(storeName).getAll();

    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject('Error getting all products:', event.target.error);
  });
}

export async function getProduct(barcode) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const request = transaction.objectStore(storeName).get(barcode);

    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject('Error getting product:', event.target.error);
  });
}

export async function saveProduct(product) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(product);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.errorCode);
  });
}
