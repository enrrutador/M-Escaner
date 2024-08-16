async function handleScan() {
    // Detectar si se trata de un dispositivo móvil
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (!isMobile) {
        showAlert('La funcionalidad de escaneo está disponible solo en dispositivos móviles.');
        return;
    }

    if (!barcodeDetector) {
        barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'upc_a'] });
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment' // Configura la cámara trasera
            } 
        });
        video.srcObject = stream;
        video.setAttribute('playsinline', true); // Evitar el modo de pantalla completa en iOS
        video.play();

        const detectBarcode = async () => {
            try {
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes.length > 0) {
                    const barcode = barcodes[0].rawValue;
                    barcodeInput.value = barcode;
                    const product = await db.getProduct(barcode);
                    if (product) {
                        descriptionInput.value = product.description || '';
                        stockInput.value = product.stock || '';
                        priceInput.value = product.price || '';
                        productImage.src = product.image || '';
                        productImage.style.display = product.image ? 'block' : 'none';
                    } else {
                        showAlert('Producto no encontrado');
                        descriptionInput.value = '';
                        stockInput.value = '';
                        priceInput.value = '';
                        productImage.src = '';
                        productImage.style.display = 'none';
                    }
                }
                requestAnimationFrame(detectBarcode);
            } catch (error) {
                console.error('Error detecting barcode:', error);
            }
        };

        detectBarcode();
        scannerContainer.style.display = 'block';

    } catch (error) {
        showAlert('No se puede acceder a la cámara: ' + error.message);
        console.error('Error accessing camera:', error);
    }
}
