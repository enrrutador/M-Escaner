// main.js
import { initializeIndexedDB, waitForDB, updateProductCount, updateLowStockCount, updateLastScannedProduct } from './indexeddb.js';
import { setupScanner } from './scanner.js';
import { setupModals, showInventoryDetails, showLowStockDetails, showLastScannedDetails } from './modals.js';
import { setupSearch } from './search.js';
import { setupNotifications } from './notifications.js';

document.addEventListener('DOMContentLoaded', function () {
  console.log("DOM fully loaded and parsed");

  // Initialize IndexedDB
  initializeIndexedDB();

  // Event listeners
  document.querySelector('.menu-button').addEventListener('click', function () {
    console.log("Menu button clicked");
    document.querySelector('.menu').classList.toggle('active');
    document.querySelector('.content').classList.toggle('menu-active');
  });

  const floatingButton = document.querySelector('.floating-button');
  floatingButton.addEventListener('click', async function () {
    console.log("Floating button clicked");
    document.hasInteracted = true; // Mark that user has interacted
    if (Quagga && typeof Quagga.stop === 'function') {
      try {
        Quagga.stop(); // Stop any existing instance
      } catch (err) {
        console.log('No previous Quagga instance running');
      }
    }

    document.querySelector('.scanner-view').classList.add('active');
    setupScanner();
  });

  // Cancel scan button handler
  document.getElementById('cancelScan').addEventListener('click', function () {
    console.log("Cancel scan button clicked");
    const videoElement = document.getElementById('camera-feed');
    if (videoElement.srcObject) {
      videoElement.srcObject.getTracks().forEach(track => track.stop());
    }
    if (Quagga && typeof Quagga.stop === 'function') {
      Quagga.stop();
    }
    document.querySelector('.scanner-view').classList.remove('active');
  });

  // Card click handlers for modals
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

  // Close modal handlers
  document.querySelectorAll('.modal-content button[id^="close"]').forEach(button => {
    button.addEventListener('click', function () {
      console.log("Close modal button clicked");
      const modal = button.closest('.inventory-details-modal, .low-stock-modal, .last-scan-modal');
      if (modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Add these event handlers at the end of your existing script
  document.getElementById('saveProduct').addEventListener('click', function () {
    console.log("Save product button clicked");
    const barcodeInput = document.getElementById('barcode');
    const descriptionInput = document.getElementById('description');
    const stockInput = document.getElementById('stock');
    const priceInput = document.getElementById('price');

    if (!barcodeInput || !descriptionInput || !stockInput || !priceInput) {
      console.error("Barcode, description, stock, or price input not found");
      return;
    }

    const product = {
      barcode: barcodeInput.value,
      description: descriptionInput.value,
      stock: parseInt(stockInput.value),
      price: parseFloat(priceInput.value)
    };

    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(product);

    request.onsuccess = function (event) {
      console.log("Product saved successfully");
      showNotification('Producto guardado correctamente', 'success');
      clearForm();
      const modal = document.getElementById('editProductModal');
      if (modal) {
        modal.classList.remove('active');
      }
      updateProductCount(); // Actualizar la cantidad de productos después de guardar
      updateLowStockCount(); // Actualizar la cantidad de productos con stock bajo después de guardar
      updateLastScannedProduct(); // Actualizar el último producto escaneado después de guardar
    };

    request.onerror = function (event) {
      console.error("Error saving product", event.target.errorCode);
      showNotification('Error al guardar el producto', 'error');
    };
  });

  document.getElementById('cancelEdit').addEventListener('click', function () {
    console.log("Cancel edit button clicked");
    clearForm();
    const modal = document.getElementById('editProductModal');
    if (modal) {
      modal.classList.remove('active');
    }
  });

  document.getElementById('generateBarcode').addEventListener('click', function () {
    console.log("Generate barcode button clicked");
    const barcodeInput = document.getElementById('barcode');
    const randomBarcode = Math.floor(Math.random() * 1000000000000).toString();
    barcodeInput.value = randomBarcode;
    showEditProductModal(randomBarcode);
  });

  // Handle ripple effect
  document.addEventListener('click', function (e) {
    if (e.target.closest('.card, .floating-button, .menu-item')) {
      const ripple = document.createElement('div');
      ripple.className = 'ripple';
      const rect = e.target.getBoundingClientRect();
      ripple.style.left = e.clientX - rect.left + 'px';
      ripple.style.top = e.clientY - rect.top + 'px';
      e.target.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 600);
    }
  });

  // Export to Excel
  document.getElementById('export-button').addEventListener('click', async () => {
    const products = await getAllProducts();
    const worksheet = XLSX.utils.json_to_sheet(products);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, 'productos.xlsx');
  });

  // Show low stock products
  document.getElementById('low-stock-button').addEventListener('click', async () => {
    const products = await getAllProducts();
    const lowStockProducts = products.filter(product => product.stock <= 5);
    const lowStockList = document.getElementById('low-stock-list');
    lowStockList.innerHTML = '';
    if (lowStockProducts.length > 0) {
      lowStockProducts.forEach(product => {
        const li = document.createElement('li');
        li.textContent = `${product.description} (Stock: ${product.stock})`;
        lowStockList.appendChild(li);
      });
      document.getElementById('low-stock-results').style.display = 'block';
    } else {
      document.getElementById('low-stock-results').style.display = 'none';
      alert('No hay productos con stock bajo.');
    }
  });

  // Clear form fields
  function clearForm() {
    const barcodeInput = document.getElementById('barcode');
    const descriptionInput = document.getElementById('description');
    const stockInput = document.getElementById('stock');
    const priceInput = document.getElementById('price');

    if (barcodeInput) barcodeInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    if (stockInput) stockInput.value = '';
    if (priceInput) priceInput.value = '';
  }

  // Fill form fields with product data
  function fillForm(product) {
    const barcodeInput = document.getElementById('barcode');
    const descriptionInput = document.getElementById('description');
    const stockInput = document.getElementById('stock');
    const priceInput = document.getElementById('price');

    if (barcodeInput) barcodeInput.value = product.barcode;
    if (descriptionInput) descriptionInput.value = product.description;
    if (stockInput) stockInput.value = product.stock;
    if (priceInput) priceInput.value = product.price;
  }
});
