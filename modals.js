// modals.js
import { getAllProducts } from './indexeddb.js';

export function setupModals() {
  // Modal functions
  async function showInventoryDetails() {
    const modal = document.getElementById('inventoryDetailsModal');
    const detailsList = document.getElementById('inventoryDetailsList');
    
    const products = await getAllProducts();
    let inventoryHTML = '';
    products.forEach(product => {
      inventoryHTML += `
        <div class="inventory-item">
          <h4>${product.description}</h4>
          <p>Código de Barras: ${product.barcode}</p>
          <p>Stock: ${product.stock}</p>
          <p>Precio: $${product.price}</p>
        </div>
      `;
    });
    
    detailsList.innerHTML = inventoryHTML;
    modal.classList.add('active');
  }

  async function showLowStockDetails() {
    const modal = document.getElementById('lowStockModal');
    const lowStockList = document.getElementById('lowStockList');
    
    const products = await getAllProducts();
    const lowStockProducts = products.filter(product => product.stock <= 5);
    let lowStockHTML = '';
    lowStockProducts.forEach(product => {
      lowStockHTML += `
        <div class="low-stock-item">
          <h4>${product.description}</h4>
          <p>Código de Barras: ${product.barcode}</p>
          <p>Stock: ${product.stock}</p>
          <p>Precio: $${product.price}</p>
        </div>
      `;
    });
    
    lowStockList.innerHTML = lowStockHTML;
    modal.classList.add('active');
  }

  async function showLastScannedDetails() {
    const modal = document.getElementById('lastScanModal');
    const lastScanDetails = document.getElementById('lastScanDetails');
    
    const products = await getAllProducts();
    const lastScannedProducts = products.slice(-4).reverse();
    let lastScannedHTML = '';
    lastScannedProducts.forEach(product => {
      lastScannedHTML += `
        <div class="last-scan-item">
          <h4>${product.description}</h4>
          <p>Código de Barras: ${product.barcode}</p>
          <p>Stock: ${product.stock}</p>
          <p>Precio: $${product.price}</p>
        </div>
      `;
    });
    
    lastScanDetails.innerHTML = lastScannedHTML;
    modal.classList.add('active');
  }

  // Close modal handlers
  document.querySelectorAll('.modal-content button[id^="close"]').forEach(button => {
    button.addEventListener('click', function() {
      console.log("Close modal button clicked");
      const modal = button.closest('.inventory-details-modal, .low-stock-modal, .last-scan-modal');
      if (modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Export functions
  window.showInventoryDetails = showInventoryDetails;
  window.showLowStockDetails = showLowStockDetails;
  window.showLastScannedDetails = showLastScannedDetails;
}

// Export the function directly
export function showEditProductModal(barcode) {
  console.log("Showing edit product modal for barcode:", barcode);
  const modal = document.getElementById('editProductModal');
  const barcodeInput = document.getElementById('barcode');
  const barcodePreview = document.getElementById('barcodePreview');
  
  // Set the scanned barcode
  if (barcodeInput) {
    barcodeInput.value = barcode;
  }

  // Generate barcode preview
  if (barcodePreview) {
    // Clear previous barcode
    barcodePreview.innerHTML = '<svg id="barcodeDisplay"></svg>';
    
    try {
      JsBarcode("#barcodeDisplay", barcode, {
        format: "CODE128",
        width: 2,
        height: 100,
        displayValue: true
      });
    } catch (err) {
      console.error("Error generating barcode preview:", err);
      barcodePreview.innerHTML = '<p>Error generating barcode preview</p>';
    }
  }

  // Show the modal
  if (modal) {
    modal.classList.add('active');
  }
}
