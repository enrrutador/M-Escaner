document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM fully loaded and parsed");

  // Add this function definition before the existing script
  function showEditProductModal(barcode) {
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

  document.querySelector('.menu-button').addEventListener('click', function() {
    console.log("Menu button clicked");
    document.querySelector('.menu').classList.toggle('active');
    document.querySelector('.content').classList.toggle('menu-active');
  });

  const floatingButton = document.querySelector('.floating-button');
  floatingButton.addEventListener('click', async function() {
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
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { min: 640 },
          height: { min: 480 },
          aspectRatio: { min: 1, max: 2 }
        } 
      });
      const videoElement = document.getElementById('camera-feed');
      if (videoElement) {
        videoElement.srcObject = stream;
      }
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: videoElement,
          constraints: {
            facingMode: "environment",
            width: { min: 640 },
            height: { min: 480 },
            aspectRatio: { min: 1, max: 2 }
          }
        },
        locator: {
          patchSize: "medium",
          halfSample: true
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        decoder: {
          readers: [
            "ean_reader",
            "ean_8_reader",
            "code_128_reader",
            "code_39_reader",
            "upc_reader",
            "upc_e_reader"
          ]
        },
        locate: true
      }, function(err) {
        if (err) {
          console.error(err);
          return;
        }
        console.log("Quagga initialization succeeded");
        Quagga.start();
      });

      Quagga.onDetected(async function(result) {
        const code = result.codeResult.code;
        console.log("Barcode detected and processed : [" + code + "]");
        
        showEditProductModal(code);

        try {
          if (document.hasInteracted) {
            const beep = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWoGAACBhYqFbF1FVU1aZH2Sqa3wdnaBjpacopuYn6eipZ+RhoJ6hpGUeqxhTlFKSlBYY36GmZyQhHp1hI6apK2up7KzqJyYkZCJhH58R0xGR0RBPkRPVlVZXl9ubXh3gYOMjYmFf4eDgH58f4GBgoKIipCMmI6Ihn1tZV9jZ2dvb25qbmyhoJ2koZ6Wk5edm5KKkZSVkpKVm5eTkYt7l4zhSUJGSEIxP0hOUVZhY21wbG1wcnR2eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5f");
            await beep.play();
          }

          // Stop video stream and Quagga
          if (videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
          }
          Quagga.stop();
          
          // Hide scanner view
          document.querySelector('.scanner-view').classList.remove('active');
        } catch (error) {
          console.error("Error playing beep:", error);
        }
      });

    } catch (err) {
      console.error('Error accessing camera:', err);
      showNotification('Error al acceder a la cámara', 'error');
    }
  });

  // Cancel scan button handler
  document.getElementById('cancelScan').addEventListener('click', function() {
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
    card.addEventListener('click', function() {
      console.log("Card clicked with index:", index);
      switch(index) {
        case 0: // Inventario Total
          showInventoryDetails();
          break;
        case 1: // Productos Bajos
          showLowStockDetails();
          break;
        case 2: // Último Escaneo
          showLastScanDetails();
          break;
      }
    });
  });

  // Modal functions
  function showInventoryDetails() {
    console.log("Showing inventory details modal");
    const modal = document.getElementById('inventoryDetailsModal');
    const detailsList = document.getElementById('inventoryDetailsList');
    
    // Example data - replace with actual inventory data
    const inventoryHTML = `
      <div class="inventory-summary">
        <h3>Resumen de Inventario</h3>
        <p>Total de Productos: 1,234</p>
        <p>Categorías: 8</p>
        <p>Valor Total: $45,678</p>
      </div>
    `;
    
    detailsList.innerHTML = inventoryHTML;
    modal.classList.add('active');
  }

  function showLowStockDetails() {
    console.log("Showing low stock details modal");
    const modal = document.getElementById('lowStockModal');
    const lowStockList = document.getElementById('lowStockList');
    
    // Example data - replace with actual low stock data
    const lowStockHTML = `
      <div class="low-stock-items">
        <div class="low-stock-item">
          <h4>Producto A</h4>
          <p>Stock: 2 unidades</p>
          <p class="status-badge low">Crítico</p>
        </div>
        <div class="low-stock-item">
          <h4>Producto B</h4>
          <p>Stock: 5 unidades</p>
          <p class="status-badge warning">Bajo</p>
        </div>
      </div>
    `;
    
    lowStockList.innerHTML = lowStockHTML;
    modal.classList.add('active');
  }

  function showLastScanDetails() {
    console.log("Showing last scan details modal");
    const modal = document.getElementById('lastScanModal');
    const lastScanDetails = document.getElementById('lastScanDetails');
    
    // Example data - replace with actual last scan data
    const lastScanHTML = `
      <div class="last-scan-info">
        <h3>Último Producto Escaneado</h3>
        <div class="barcode-display">
          <svg id="lastScanBarcode"></svg>
        </div>
        <p>SKU: SKU-123456</p>
        <p>Producto: Ejemplo Producto</p>
        <p>Fecha: ${new Date().toLocaleDateString()}</p>
        <p class="status-badge good">Escaneado Correctamente</p>
      </div>
    `;
    
    lastScanDetails.innerHTML = lastScanHTML;
    
    // Generate barcode
    try {
      JsBarcode("#lastScanBarcode", "SKU-123456", {
        format: "CODE128",
        width: 2,
        height: 100,
        displayValue: true
      });
    } catch (err) {
      console.error("Error generating barcode:", err);
    }
    
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

  // Add these event handlers at the end of your existing script
  document.getElementById('saveProduct').addEventListener('click', function() {
    console.log("Save product button clicked");
    // Save product logic here
    const modal = document.getElementById('editProductModal');
    if (modal) {
      modal.classList.remove('active');
    }
    showNotification('Producto guardado correctamente', 'success');
  });

  document.getElementById('cancelEdit').addEventListener('click', function() {
    console.log("Cancel edit button clicked");
    const modal = document.getElementById('editProductModal');
    if (modal) {
      modal.classList.remove('active');
    }
  });

  document.getElementById('generateBarcode').addEventListener('click', function() {
    console.log("Generate barcode button clicked");
    const barcodeInput = document.getElementById('barcode');
    const randomBarcode = Math.floor(Math.random() * 1000000000000).toString();
    barcodeInput.value = randomBarcode;
    showEditProductModal(randomBarcode);
  });

  // Notification function
  function showNotification(message, type = 'success') {
    console.log("Showing notification:", message, type);
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    const container = document.getElementById('notification-container');
    container.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Handle ripple effect
  document.addEventListener('click', function(e) {
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
});