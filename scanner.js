import { getProduct } from './indexeddb.js';
import { showEditProductModal } from './modals.js';

export function setupScanner() {
  const beep = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWoGAACBhYqFbF1FVU1aZH2Sqa3wdnaBjpacopuYn6eipZ+RhoJ6hpGUeqxhTlFKSlBYY36GmZyQhHp1hI6apK2up7KzqJyYkZCJhH58R0xGR0RBPkRPVlVZXl9ubXh3gYOMjYmFf4eDgH58f4GBgoKIipCMmI6Ihn1tZV9jZ2dvb25qbmyhoJ2koZ6Wk5edm5KKkZSVkpKVm5eTkYt7l4zhSUJGSEIxP0hOUVZhY21wbG1wcnR2eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5f");

  if (typeof Quagga === 'undefined') {
    console.error("Quagga library not loaded!");
    alert("Error: Librería de escaneo no cargada.");
    return;
  }

  const videoElement = document.getElementById('camera-feed');
  if (!videoElement) {
    console.error("Camera feed element not found!");
    return;
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
  }, function (err) {
    if (err) {
      console.error("Error initializing Quagga:", err);
      // Optional: show notification to user
      if (window.showNotification) {
        window.showNotification('No se pudo acceder a la cámara. Asegúrate de dar permisos y usar HTTPS.', 'error');
      }
      return;
    }
    console.log("Quagga initialization succeeded");
    Quagga.start();
  });

  Quagga.onDetected(async function (result) {
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
        await beep.play();
      }

      // Stop camera and Quagga
      stopCamera();

      // Hide scanner view
      document.querySelector('.scanner-view').classList.remove('active');
    } catch (error) {
      console.error("Error playing beep:", error);
    }
  });
}

// Utility function to stop camera and Quagga
function stopCamera() {
  const videoElement = document.getElementById('camera-feed');
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
  }
  Quagga.stop();
}

// Fill the form with product details
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
