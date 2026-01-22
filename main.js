// main.js
import {
  initializeIndexedDB,
  updateProductCount,
  updateLowStockCount,
  updateLastScannedProduct,
  saveProduct,
  getAllProducts
} from './indexeddb.js';
import { setupScanner } from './scanner.js';
import {
  setupModals,
  showInventoryDetails,
  showLowStockDetails,
  showLastScannedDetails,
  showEditProductModal
} from './modals.js';
import { setupSearch } from './search.js';
import { setupNotifications } from './notifications.js';

document.addEventListener('DOMContentLoaded', async function () {
  console.log("DOM fully loaded and parsed");

  // Initialize Modules
  initializeIndexedDB();
  setupModals();
  setupSearch();
  setupNotifications();

  // Menu Toggle Handler
  const menuButton = document.querySelector('.menu-button');
  const menu = document.querySelector('.menu');
  const content = document.querySelector('.content');

  if (menuButton && menu && content) {
    menuButton.addEventListener('click', function () {
      console.log("Menu button clicked");
      menu.classList.toggle('active');
      content.classList.toggle('menu-active');
    });
  }

  // Menu Item Click Handlers
  document.getElementById('manageCategories')?.addEventListener('click', () => {
    document.getElementById('editCategoryModal')?.classList.add('active');
    menu.classList.remove('active');
    content.classList.remove('menu-active');
  });

  document.getElementById('importExport')?.addEventListener('click', () => {
    document.getElementById('importExportModal')?.classList.add('active');
    menu.classList.remove('active');
    content.classList.remove('menu-active');
  });

  document.getElementById('viewReports')?.addEventListener('click', () => {
    document.getElementById('reportsModal')?.classList.add('active');
    menu.classList.remove('active');
    content.classList.remove('menu-active');
  });

  document.getElementById('viewHistory')?.addEventListener('click', () => {
    document.getElementById('historyModal')?.classList.add('active');
    menu.classList.remove('active');
    content.classList.remove('menu-active');
  });

  // Scanner Button Handler
  const floatingButton = document.querySelector('.floating-button');
  if (floatingButton) {
    floatingButton.addEventListener('click', async function () {
      console.log("Floating button clicked");
      document.hasInteracted = true;

      if (typeof Quagga !== 'undefined' && typeof Quagga.stop === 'function') {
        try { Quagga.stop(); } catch (err) { }
      }

      document.querySelector('.scanner-view').classList.add('active');
      setupScanner();
    });
  }

  // Cancel Scan Handler
  const cancelScanBtn = document.getElementById('cancelScan');
  if (cancelScanBtn) {
    cancelScanBtn.addEventListener('click', function () {
      console.log("Cancel scan button clicked");
      const videoElement = document.getElementById('camera-feed');
      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
      }
      if (typeof Quagga !== 'undefined' && typeof Quagga.stop === 'function') {
        Quagga.stop();
      }
      document.querySelector('.scanner-view').classList.remove('active');
    });
  }

  // Dashboard Cards Click Handlers
  document.querySelectorAll('.card').forEach((card, index) => {
    card.addEventListener('click', function () {
      console.log("Card clicked with index:", index);
      switch (index) {
        case 0: // Inventario Total
          showInventoryDetails();
          break;
        case 1: // Productos Bajos
          showLowStockDetails();
          break;
        case 2: // Últimos Escaneados
          showLastScannedDetails();
          break;
      }
    });
  });

  // Product Save Handler
  const saveProductBtn = document.getElementById('saveProduct');
  if (saveProductBtn) {
    saveProductBtn.addEventListener('click', async function () {
      const barcodeInput = document.getElementById('barcode');
      const descriptionInput = document.getElementById('description');
      const stockInput = document.getElementById('stock');
      const priceInput = document.getElementById('price');

      if (!barcodeInput?.value || !descriptionInput?.value) {
        if (window.showNotification) window.showNotification('Complete los campos obligatorios', 'error');
        return;
      }

      const product = {
        barcode: barcodeInput.value,
        description: descriptionInput.value,
        stock: parseInt(stockInput.value) || 0,
        price: parseFloat(priceInput.value) || 0
      };

      try {
        await saveProduct(product);
        if (window.showNotification) window.showNotification('Producto guardado correctamente', 'success');
        clearForm();
        document.getElementById('editProductModal')?.classList.remove('active');

        // Refresh dashboard
        updateProductCount();
        updateLowStockCount();
        updateLastScannedProduct();
      } catch (err) {
        console.error("Error saving product", err);
        if (window.showNotification) window.showNotification('Error al guardar el producto', 'error');
      }
    });
  }

  document.getElementById('cancelEdit')?.addEventListener('click', () => {
    clearForm();
    document.getElementById('editProductModal')?.classList.remove('active');
  });

  document.getElementById('generateBarcode')?.addEventListener('click', () => {
    const randomBarcode = Math.floor(Math.random() * 1000000000000).toString();
    const barcodeInput = document.getElementById('barcode');
    if (barcodeInput) barcodeInput.value = randomBarcode;
    showEditProductModal(randomBarcode);
  });

  // Export to Excel Handler
  document.getElementById('exportBtn')?.addEventListener('click', async () => {
    try {
      const products = await getAllProducts();
      if (!products.length) {
        if (window.showNotification) window.showNotification('No hay productos para exportar', 'error');
        return;
      }
      const worksheet = XLSX.utils.json_to_sheet(products);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');
      XLSX.writeFile(workbook, 'inventario.xlsx');
    } catch (err) {
      console.error("Export error:", err);
    }
  });

  // Close other modals
  document.querySelectorAll('button[id^="close"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('div[id$="Modal"]');
      if (modal) modal.classList.remove('active');
    });
  });

  // Ripple effect
  document.addEventListener('click', function (e) {
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

  function clearForm() {
    ['barcode', 'description', 'stock', 'price'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }
});
