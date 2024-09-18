// Inicialización de variables
const scannerPage = document.getElementById('scanner-page');
const productosPage = document.getElementById('productos-page');
const stockBajoPage = document.getElementById('stock-Mínimo-page');
const dashPage = document.getElementById('dash-page');
const menuButton = document.getElementById('menu-button');

// Función para cambiar entre páginas
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';

    if (pageId === 'productos-page') {
        displayAllProducts();
    } else if (pageId === 'stock-Mínimo-page') {
        displayLowStockProducts();
    }
}

// Eventos de navegación del menú
document.querySelectorAll('.menu-list a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = e.target.getAttribute('href').substring(1) + '-page';
        showPage(pageId);
    });
});

// Eventos para los botones "Volver al Escáner"
document.querySelectorAll('.back-button').forEach(button => {
    button.addEventListener('click', () => showPage('scanner-page'));
});

// Función para mostrar productos con stock bajo
function displayLowStockProducts() {
    const products = JSON.parse(localStorage.getItem('products')) || [];
    const lowStockList = document.getElementById('stock-bajo-list');
    lowStockList.innerHTML = '';

    // Filtrar productos con stock menor o igual al stock mínimo
    const lowStockProducts = products.filter(product => product.stock <= product.minimumStock);

    if (lowStockProducts.length === 0) {
        lowStockList.innerHTML = '<p>No hay productos con stock mínimo.</p>';
        removeMenuFlashing();
    } else {
        const table = document.createElement('table');
        table.innerHTML = `
            <tr>
                <th>Nombre</th>
                <th>Código de Barras</th>
                <th>Stock Actual</th>
                <th>Stock Mínimo</th>
            </tr>
        `;

        lowStockProducts.forEach(product => {
            const row = table.insertRow();
            row.innerHTML = `
                <td>${product.name}</td>
                <td>${product.barcode}</td>
                <td>${product.stock}</td>
                <td>${product.minimumStock}</td>
            `;
        });

        lowStockList.appendChild(table);
        applyMenuFlashing();  // Aplicar el efecto de titilación cuando haya productos en stock mínimo
    }
}

// Función para mostrar todos los productos
function displayAllProducts() {
    const products = JSON.parse(localStorage.getItem('products')) || [];
    const productsList = document.getElementById('productos-list');
    productsList.innerHTML = '';

    if (products.length === 0) {
        productsList.innerHTML = '<p>No hay productos registrados.</p>';
    } else {
        const table = document.createElement('table');
        table.innerHTML = `
            <tr>
                <th>Nombre</th>
                <th>Código de Barras</th>
                <th>Precio de Compra</th>
                <th>Precio de Venta</th>
                <th>Stock</th>
                <th>Stock Mínimo</th>
            </tr>
        `;

        products.forEach(product => {
            const row = table.insertRow();
            row.innerHTML = `
                <td>${product.name}</td>
                <td>${product.barcode}</td>
                <td>${product.purchasePrice || '-'}</td>
                <td>${product.salePrice || '-'}</td>
                <td>${product.stock}</td>
                <td>${product.minimumStock}</td>
            `;
        });

        productsList.appendChild(table);
    }
}

// Función para aplicar el efecto de titilación en el botón del menú
function applyMenuFlashing() {
    menuButton.classList.add('shadow-flashing');
}

// Función para remover el efecto de titilación en el botón del menú
function removeMenuFlashing() {
    menuButton.classList.remove('shadow-flashing');
}

// Guardar producto en localStorage o actualizarlo si ya existe
document.getElementById('product-form').addEventListener('submit', function(event) {
    event.preventDefault();

    // Recopilar y validar los datos ingresados
    const product = {
        name: document.getElementById('product-name').value.trim(),
        barcode: document.getElementById('barcode').value.trim(),
        purchasePrice: parseFloat(document.getElementById('purchase-price').value) || null,
        salePrice: parseFloat(document.getElementById('sale-price').value) || null,
        stock: parseInt(document.getElementById('stock').value),
        minimumStock: parseInt(document.getElementById('minimum-stock').value)
    };

    if (!product.name || !product.barcode || isNaN(product.stock) || isNaN(product.minimumStock)) {
        alert("Por favor, complete todos los campos correctamente.");
        return;
    }

    saveOrUpdateProduct(product);  // Guardar o actualizar producto
    this.reset();
    displayLowStockProducts();  // Actualizar el stock bajo después de guardar
});

// Función para guardar o actualizar el producto en localStorage
function saveOrUpdateProduct(product) {
    let products = JSON.parse(localStorage.getItem('products')) || [];
    
    // Verificar si el producto ya existe
    const index = products.findIndex(p => p.barcode === product.barcode);
    
    if (index !== -1) {
        // Actualizar producto existente
        products[index] = {
            ...products[index],
            name: product.name,
            purchasePrice: product.purchasePrice,
            salePrice: product.salePrice,
            stock: product.stock,
            minimumStock: product.minimumStock
        };
    } else {
        // Agregar nuevo producto
        products.push(product);
    }

    // Guardar en localStorage
    localStorage.setItem('products', JSON.stringify(products));
}

// Evento del botón "Borrar"
document.getElementById('clear-button').addEventListener('click', function() {
    document.querySelectorAll('.editable').forEach(input => input.value = '');
});

// Mostrar/Ocultar menú
menuButton.addEventListener('click', function() {
    const menuList = document.querySelector('.menu-list');
    menuList.style.display = menuList.style.display === 'block' ? 'none' : 'block';
});

// Función para buscar el producto por nombre
function fetchProductByName(productName) {
    const products = JSON.parse(localStorage.getItem('products')) || [];
    const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());

    if (product) {
        fillProductFields(product);
    } else {
        alert("Producto no encontrado.");
    }
}

// Función para buscar el producto por código de barras
function fetchProductDetails(barcode) {
    const products = JSON.parse(localStorage.getItem('products')) || [];
    let product = products.find(p => p.barcode === barcode);

    if (product) {
        fillProductFields(product);
    } else {
        alert("Producto no encontrado.");
    }
}

// Función para rellenar los campos del formulario
function fillProductFields(product) {
    document.getElementById('product-name').value = product.name;
    document.getElementById('barcode').value = product.barcode;
    document.getElementById('purchase-price').value = product.purchasePrice || '';
    document.getElementById('sale-price').value = product.salePrice || '';
    document.getElementById('stock').value = product.stock;
    document.getElementById('minimum-stock').value = product.minimumStock;
}

// Evento del botón "Buscar"
document.getElementById('search-button').addEventListener('click', function() {
    const barcode = document.getElementById('barcode').value;
    const productName = document.getElementById('product-name').value;

    if (barcode) {
        fetchProductDetails(barcode);
    } else if (productName) {
        fetchProductByName(productName);
    } else {
        alert("Por favor, ingrese un Código de Barras o Nombre de Producto para buscar.");
    }
});

// **Nuevo código para el botón Escanear** (Aquí está la nueva funcionalidad)
document.getElementById('scan-button').addEventListener('click', function() {
    const scannerOverlay = document.getElementById('scanner-overlay');
    scannerOverlay.style.display = 'flex'; // Mostrar el escáner
    startScanner();
});

function startScanner() {
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#scanner-container'),
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment" // Usar la cámara trasera
            }
        },
        decoder: {
            readers: [
                "code_128_reader", 
                "ean_reader", 
                "ean_8_reader", 
                "upc_reader", 
                "code_39_reader"
            ],
            multiple: false // Detectar solo un código de barras a la vez
        },
        locator: {
            patchSize: "large", // Aumentar el área de localización para mejorar la precisión
            halfSample: false // Procesar la imagen completa para mayor precisión
        },
        locate: true, // Activar localización en toda la imagen
        numOfWorkers: 4, // Incrementar el número de workers para procesar más rápido
    }, function(err) {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Escáner iniciado.");
        Quagga.start(); // Iniciar el escaneo
    });

    // Filtrar y procesar resultados para mejorar la precisión del escaneo
    Quagga.onProcessed(function(result) {
        const drawingCtx = Quagga.canvas.ctx.overlay;
        const drawingCanvas = Quagga.canvas.dom.overlay;

        if (result) {
            // Limpiar el canvas
            drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

            if (result.boxes) {
                // Dibuja los rectángulos de detección (muestra cómo está buscando)
                result.boxes.filter(box => box !== result.box).forEach(box => {
                    Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {
                        color: "green",
                        lineWidth: 2
                    });
                });
            }

            if (result.box) {
                // Dibuja el cuadro sobre el código de barras detectado
                Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {
                    color: "blue",
                    lineWidth: 2
                });
            }
        }
    });

    // Captura el código de barras una vez detectado correctamente
    Quagga.onDetected(function(result) {
        if (result && result.codeResult && result.codeResult.code) {
            const barcode = result.codeResult.code;
            alert("Código escaneado: " + barcode);
            document.getElementById('barcode').value = barcode; // Rellenar el campo del código de barras
            stopScanner(); // Detener el escáner
        }
    });
}

function stopScanner() {
    Quagga.stop(); // Detener el escáner
    document.getElementById('scanner-overlay').style.display = 'none'; // Ocultar el overlay del escáner
}

// Inicialización: mostrar la página del escáner al cargar y verificar el stock bajo
window.addEventListener('load', () => {
    showPage('scanner-page');
    displayLowStockProducts();
});
