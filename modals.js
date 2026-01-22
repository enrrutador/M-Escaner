import { getAllProducts } from './indexeddb.js';

function setupModals() {
  // Modal functions
  export async function showInventoryDetails() {
    const modal = document.getElementById('inventoryDetailsModal');
    const detailsList = document.getElementById('inventoryDetailsList');

    const products = await getAllProducts();
    let inventoryHTML = '';
    products.forEach(product => {
      inventoryHTML += generateProductHTML(product, 'inventory-item');
    });

    detailsList.innerHTML = inventoryHTML;
    modal.classList.add('active');
  }

  export async function showLowStockDetails() {
    const modal = document.getElementById('lowStockModal');
    const lowStockList = document.getElementById('lowStockList');

    const products = await getAllProducts();
    const lowStockProducts = products.filter(product => product.stock <= 5);
    let lowStockHTML = '';
    lowStockProducts.forEach(product => {
      lowStockHTML += generateProductHTML(product, 'low-stock-item');
    });

    lowStockList.innerHTML = lowStockHTML;
    modal.classList.add('active');
  }

  export async function showLastScannedDetails() {
    const modal = document.getElementById('lastScanModal');
    const lastScanDetails = document.getElementById('lastScanDetails');

    const products = await getAllProducts();
    const lastScannedProducts = products.slice(-10).reverse();
    let lastScannedHTML = '';
    lastScannedProducts.forEach(product => {
      lastScannedHTML += generateProductHTML(product, 'last-scan-item');
    });

    lastScanDetails.innerHTML = lastScannedHTML;
    modal.classList.add('active');
  }

  export function setupModals() {
    // Close modal handlers
    document.querySelectorAll('.modal-content button[id^="close"]').forEach(button => {
      button.addEventListener('click', function () {
        const modal = button.closest('.inventory-details-modal, .low-stock-modal, .last-scan-modal, .edit-product-modal');
        if (modal) {
          modal.classList.remove('active');
        }
      });
    });
  }

  // Utility function to generate product HTML
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
      <div class="product-actions" onclick="window.showEditProductModal('${product.barcode}')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--primary)">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      </div>
    </div>
  `;
  }

  // Exported function to show edit product modal
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

    if (modal) {
      modal.classList.add('active');
    }
  }

  // Global exposure for the onclick event in generated HTML
  window.showEditProductModal = showEditProductModal;
  window.showInventoryDetails = showInventoryDetails;
  window.showLowStockDetails = showLowStockDetails;
  window.showLastScannedDetails = showLastScannedDetails;
