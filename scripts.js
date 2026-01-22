// Consolidated scripts for Inventory Scanner Pro
// Version: 1.2 Premium

(function () {
  // Global Variables
  const dbName = "InventoryDB";
  const storeName = "products";
  const version = 1;
  let db;
  let dbReady = false;

  // --- IndexedDB Logic ---
  function initializeIndexedDB() {
    const request = indexedDB.open(dbName, version);
    request.onupgradeneeded = function (event) {
      db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "barcode" });
      }
    };
    request.onsuccess = function (event) {
      db = event.target.result;
      dbReady = true;
      console.log("IndexedDB opened successfully");
      updateDashboard();
    };
    request.onerror = function (event) {
      console.error("Error opening IndexedDB", event.target.errorCode);
    };
  }

  async function waitForDB() {
    while (!dbReady) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async function getAllProducts() {
    await waitForDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject(event.target.error);
    });
  }

  async function getProduct(barcode) {
    await waitForDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const request = transaction.objectStore(storeName).get(barcode);
      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject(event.target.error);
    });
  }

  async function saveProduct(product) {
    await waitForDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(product);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.errorCode);
    });
  }

  // --- Dashboard Updates ---
  async function updateDashboard() {
    const products = await getAllProducts();

    // Total Count
    const totalEl = document.getElementById('totalProducts');
    if (totalEl) totalEl.textContent = `${products.length} productos`;

    // Low Stock
    const lowStockProducts = products.filter(p => p.stock <= 5);
    const lowEl = document.getElementById('lowStockProducts');
    if (lowEl) lowEl.textContent = `${lowStockProducts.length} items`;

    // Last Scanned
    const lastEl = document.getElementById('lastScannedProduct');
    if (lastEl && products.length > 0) {
      const last = products[products.length - 1];
      lastEl.innerHTML = `${last.barcode} ${last.stock <= 5 ? '<span class="status-badge low">Alerta</span>' : '<span class="status-badge good">OK</span>'}`;
    }
  }

  // --- Notifications ---
  function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  // --- Modal Logic ---
  function generateProductHTML(product, cssClass) {
    return `
      <div class="product-card ${cssClass} ${product.stock <= 5 ? 'low-stock' : ''}">
        <div class="product-info">
          <h4 class="product-name">${product.description}</h4>
          <p class="product-barcode"><span>Barcode:</span> ${product.barcode}</p>
          <div class="product-stats">
            <p class="product-stock"><span>Stock:</span> ${product.stock}</p>
            <p class="product-price"><span>Precio:</span> $${product.price}</p>
          </div>
        </div>
        <div class="product-actions" onclick="showEditProductModal('${product.barcode}')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--primary)">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </div>
      </div>
    `;
  }

  window.showEditProductModal = function (barcode) {
    const modal = document.getElementById('editProductModal');
    const barcodeInput = document.getElementById('barcode');
    const barcodePreview = document.getElementById('barcodePreview');
    if (barcodeInput) barcodeInput.value = barcode;
    if (barcodePreview) {
      barcodePreview.innerHTML = '<svg id="barcodeDisplay"></svg>';
      try {
        JsBarcode("#barcodeDisplay", barcode, { format: "CODE128", width: 2, height: 100, displayValue: true });
      } catch (err) { console.error(err); }
    }
    if (modal) modal.classList.add('active');
  };

  async function showInventoryDetails() {
    const modal = document.getElementById('inventoryDetailsModal');
    const list = document.getElementById('inventoryDetailsList');
    const products = await getAllProducts();
    list.innerHTML = products.map(p => generateProductHTML(p, 'inventory-item')).join('');
    modal.classList.add('active');
  }

  async function showLowStockDetails() {
    const modal = document.getElementById('lowStockModal');
    const list = document.getElementById('lowStockList');
    const products = await getAllProducts();
    const low = products.filter(p => p.stock <= 5);
    list.innerHTML = low.length ? low.map(p => generateProductHTML(p, 'low-stock-item')).join('') : '<p>No hay productos con stock bajo.</p>';
    modal.classList.add('active');
  }

  async function showLastScannedDetails() {
    const modal = document.getElementById('lastScanModal');
    const list = document.getElementById('lastScanDetails');
    const products = await getAllProducts();
    const last = products.slice(-10).reverse();
    list.innerHTML = last.length ? last.map(p => generateProductHTML(p, 'last-scan-item')).join('') : '<p>No hay escaneos recientes.</p>';
    modal.classList.add('active');
  }

  // --- Scanner Logic ---
  function setupScanner() {
    if (typeof Quagga === 'undefined') {
      showNotification('Error: Librería de escaneo no cargada.', 'error');
      return;
    }
    const videoElement = document.getElementById('camera-feed');
    Quagga.init({
      inputStream: { name: "Live", type: "LiveStream", target: videoElement, constraints: { facingMode: "environment", width: { min: 640 }, height: { min: 480 }, aspectRatio: { min: 1, max: 2 } } },
      locator: { patchSize: "medium", halfSample: true },
      numOfWorkers: navigator.hardwareConcurrency || 4,
      decoder: { readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader", "upc_reader", "upc_e_reader"] },
      locate: true
    }, function (err) {
      if (err) {
        showNotification('No se pudo acceder a la cámara. Revisa los permisos e HTTPS.', 'error');
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected(async function (result) {
      const code = result.codeResult.code;
      const product = await getProduct(code);
      if (product) {
        fillForm(product);
      } else {
        showEditProductModal(code);
      }
      stopScanner();
    });
  }

  function stopScanner() {
    const videoElement = document.getElementById('camera-feed');
    if (videoElement && videoElement.srcObject) {
      videoElement.srcObject.getTracks().forEach(track => track.stop());
    }
    if (typeof Quagga !== 'undefined') Quagga.stop();
    document.querySelector('.scanner-view').classList.remove('active');
  }

  function fillForm(product) {
    document.getElementById('barcode').value = product.barcode;
    document.getElementById('description').value = product.description;
    document.getElementById('stock').value = product.stock;
    document.getElementById('price').value = product.price;
  }

  // --- Main Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    initializeIndexedDB();

    // Menu
    const menuBtn = document.querySelector('.menu-button');
    const menu = document.querySelector('.menu');
    const content = document.querySelector('.content');
    menuBtn?.addEventListener('click', () => {
      menu.classList.toggle('active');
      content.classList.toggle('menu-active');
    });

    // Menu Options
    document.getElementById('manageCategories')?.addEventListener('click', () => { document.getElementById('editCategoryModal').classList.add('active'); menu.classList.remove('active'); content.classList.remove('menu-active'); });
    document.getElementById('importExport')?.addEventListener('click', () => { document.getElementById('importExportModal').classList.add('active'); menu.classList.remove('active'); content.classList.remove('menu-active'); });
    document.getElementById('viewReports')?.addEventListener('click', () => { document.getElementById('reportsModal').classList.add('active'); menu.classList.remove('active'); content.classList.remove('menu-active'); });
    document.getElementById('viewHistory')?.addEventListener('click', () => { document.getElementById('historyModal').classList.add('active'); menu.classList.remove('active'); content.classList.remove('menu-active'); });

    // Floating Action Button (Scanner)
    document.querySelector('.floating-button')?.addEventListener('click', () => {
      document.querySelector('.scanner-view').classList.add('active');
      setupScanner();
    });

    // Scanner Controls
    document.getElementById('cancelScan')?.addEventListener('click', stopScanner);

    // Dashboard Cards
    document.querySelectorAll('.card').forEach((card, index) => {
      card.addEventListener('click', () => {
        if (index === 0) showInventoryDetails();
        if (index === 1) showLowStockDetails();
        if (index === 2) showLastScannedDetails();
      });
    });

    // Modal Actions
    document.getElementById('saveProduct')?.addEventListener('click', async () => {
      const barcode = document.getElementById('barcode').value;
      const description = document.getElementById('description').value;
      const stock = parseInt(document.getElementById('stock').value) || 0;
      const price = parseFloat(document.getElementById('price').value) || 0;

      if (!barcode || !description) {
        showNotification('Código y descripción son obligatorios', 'error');
        return;
      }

      await saveProduct({ barcode, description, stock, price });
      showNotification('Guardado con éxito', 'success');
      document.getElementById('editProductModal').classList.remove('active');
      updateDashboard();
    });

    document.getElementById('cancelEdit')?.addEventListener('click', () => {
      document.getElementById('editProductModal').classList.remove('active');
    });

    document.getElementById('generateBarcode')?.addEventListener('click', () => {
      const random = Math.floor(Math.random() * 1000000000000).toString();
      document.getElementById('barcode').value = random;
      showEditProductModal(random);
    });

    // Close Modals
    document.querySelectorAll('button[id^="close"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('div[id$="Modal"]');
        if (modal) modal.classList.remove('active');
      });
    });

    // Search
    document.getElementById('searchButton')?.addEventListener('click', async () => {
      const query = document.getElementById('searchBar').value.trim().toLowerCase();
      if (!query) return;
      const products = await getAllProducts();
      const filtered = products.filter(p => p.barcode.includes(query) || p.description.toLowerCase().includes(query));

      const container = document.getElementById('searchResultsContainer') || document.createElement('div');
      container.id = 'searchResultsContainer';
      container.innerHTML = filtered.length ? filtered.map(p => generateProductHTML(p, 'search-item')).join('') : '<p>No se encontraron productos.</p>';

      const contentEl = document.querySelector('.content');
      if (!document.getElementById('searchResultsContainer')) contentEl.insertBefore(container, contentEl.children[1]);
    });

    // Ripple
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.card, .floating-button, .menu-item, .search-button, .scanner-button');
      if (target) {
        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        const rect = target.getBoundingClientRect();
        ripple.style.left = e.clientX - rect.left + 'px';
        ripple.style.top = e.clientY - rect.top + 'px';
        target.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
      }
    });

    // Export
    document.getElementById('exportBtn')?.addEventListener('click', async () => {
      const products = await getAllProducts();
      if (!products.length) return showNotification('Nada que exportar', 'error');
      const ws = XLSX.utils.json_to_sheet(products);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      XLSX.writeFile(wb, 'inventario.xlsx');
    });
  });

  // Global Helpers for onclick
  window.showNotification = showNotification;
  window.updateDashboard = updateDashboard;
})();
