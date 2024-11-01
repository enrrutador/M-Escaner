document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM fully loaded and parsed");

  // Initialize IndexedDB
  const dbName = "InventoryDB";
  const storeName = "products";
  const version = 1;

  let db;
  let dbReady = false; // Indicador de disponibilidad de IndexedDB

  const request = indexedDB.open(dbName, version);

  request.onupgradeneeded = function(event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName, { keyPath: "barcode" });
    }
  };

  request.onsuccess = function(event) {
    db = event.target.result;
    dbReady = true; // Marcamos que IndexedDB está lista
    console.log("IndexedDB opened successfully");
    updateProductCount(); // Actualizar la cantidad de productos al cargar la base de datos
    updateLowStockCount(); // Actualizar la cantidad de productos con stock bajo al cargar la base de datos
    updateLastScannedProduct(); // Actualizar el último producto escaneado al cargar la base de datos
  };

  request.onerror = function(event) {
    console.error("Error opening IndexedDB", event.target.errorCode);
  };

  // Función para esperar a que IndexedDB esté lista
  async function waitForDB() {
    while (!dbReady) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Función para actualizar la cantidad de productos en la interfaz
  async function updateProductCount() {
    await waitForDB(); // Esperar a que IndexedDB esté lista
    const products = await getAllProducts();
    const productCountElement = document.getElementById('totalProducts');
    if (productCountElement) {
      productCountElement.textContent = `${products.length} productos`;
    }
  }

  // Función para actualizar la cantidad de productos con stock bajo en la interfaz
  async function updateLowStockCount() {
    await waitForDB(); // Esperar a que IndexedDB esté lista
    const products = await getAllProducts();
    const lowStockProducts = products.filter(product => product.stock <= 5);
    const lowStockCountElement = document.getElementById('lowStockProducts');
    if (lowStockCountElement) {
      lowStockCountElement.textContent = `${lowStockProducts.length} items`;
    }
  }

  // Función para actualizar el último producto escaneado en la interfaz
  async function updateLastScannedProduct() {
    await waitForDB(); // Esperar a que IndexedDB esté lista
    const products = await getAllProducts();
    const lastScannedProduct = products[products.length - 1];
    const lastScannedElement = document.getElementById('lastScannedProduct');
    if (lastScannedElement && lastScannedProduct) {
      lastScannedElement.textContent = `${lastScannedProduct.barcode} ${lastScannedProduct.stock <= 5 ? '<span class="status-badge low">Alerta</span>' : '<span class="status-badge good">OK</span>'}`;
    }
  }

  // Función para mostrar el modal de edición de producto
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
        
        const product = await getProduct(code);
        if (product) {
          fillForm(product);
        } else {
          showEditProductModal(code);
        }

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
        case 2: // Últimos Escaneados
          showLastScannedDetails();
          break;
      }
    });
  });

  // Modal functions
  async function showInventoryDetails() {
    await waitForDB(); // Esperar a que IndexedDB esté lista
    console.log("Showing inventory details modal");
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
    await waitForDB(); // Esperar a que IndexedDB esté lista
    console.log("Showing low stock details modal");
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
    await waitForDB(); // Esperar a que IndexedDB esté lista
    console.log("Showing last scanned details modal");
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

  // Add these event handlers at the end of your existing script
  document.getElementById('saveProduct').addEventListener('click', function() {
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

    request.onsuccess = function(event) {
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

    request.onerror = function(event) {
      console.error("Error saving product", event.target.errorCode);
      showNotification('Error al guardar el producto', 'error');
    };
  });

  document.getElementById('cancelEdit').addEventListener('click', function() {
    console.log("Cancel edit button clicked");
    clearForm();
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

  // Export to Excel
  document.getElementById('export-button').addEventListener('click', async () => {
    const products = await getAllProducts();
    const worksheet = XLSX.utils.json_to_sheet(products);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, 'productos.xlsx');
  });

  // Get all products from IndexedDB
  async function getAllProducts() {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const request = transaction.objectStore(storeName).getAll();

      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject('Error getting all products:', event.target.error);
    });
  }

  // Get product by barcode from IndexedDB
  async function getProduct(barcode) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const request = transaction.objectStore(storeName).get(barcode);

      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject('Error getting product:', event.target.error);
    });
  }

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

  // Search functionality
  document.getElementById('searchButton').addEventListener('click', async () => {
    const searchQuery = document.getElementById('searchBar').value.trim().toLowerCase();
    if (searchQuery) {
      const products = await getAllProducts();
      const filteredProducts = products.filter(product => 
        product.barcode.toLowerCase().includes(searchQuery) ||
        product.description.toLowerCase().includes(searchQuery)
      );
      displaySearchResults(filteredProducts);
    } else {
      alert('Por favor, ingrese un término de búsqueda.');
    }
  });

  function displaySearchResults(products) {
    const searchResultsContainer = document.createElement('div');
    searchResultsContainer.id = 'searchResultsContainer';
    searchResultsContainer.style.display = 'block';

    if (products.length > 0) {
      products.forEach(product => {
        const productItem = document.createElement('div');
        productItem.className = 'search-result-item';
        productItem.innerHTML = `
          <h4>${product.description}</h4>
          <p>Código de Barras: ${product.barcode}</p>
          <p>Stock: ${product.stock}</p>
          <p>Precio: $${product.price}</p>
        `;
        searchResultsContainer.appendChild(productItem);
      });
    } else {
      searchResultsContainer.innerHTML = '<p>No se encontraron productos.</p>';
    }

    const existingContainer = document.getElementById('searchResultsContainer');
    if (existingContainer) {
      existingContainer.remove();
    }

    document.body.appendChild(searchResultsContainer);
  }
});
