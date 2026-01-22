// scripts.js - Sistema de Escaneo y Gestión de Inventario (Versión Consolidada)
// Optimizado para compatibilidad móvil y persistencia con IndexedDB

(function () {
    console.log("Inicializando sistema...");

    // --- VARIABLES GLOBALES ---
    var db;
    var dbReady = false;
    var DB_NAME = "InventoryDB";
    var STORE_NAME = "products";

    // --- 1. BASE DE DATOS (IndexedDB) ---
    function initDB() {
        var request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = function (e) {
            db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "barcode" });
            }
        };

        request.onsuccess = function (e) {
            db = e.target.result;
            dbReady = true;
            console.log("Base de datos conectada.");
            updateDashboard();
        };

        request.onerror = function (e) {
            console.error("Error IndexedDB:", e.target.errorCode);
            showNotification("Error de base de datos", "error");
        };
    }

    function waitForDB(callback) {
        if (dbReady) return callback();
        var check = setInterval(function () {
            if (dbReady) {
                clearInterval(check);
                callback();
            }
        }, 100);
    }

    // --- 2. GESTIÓN DE DATOS ---
    function getAllProducts(callback) {
        waitForDB(function () {
            var tx = db.transaction([STORE_NAME], 'readonly');
            var store = tx.objectStore(STORE_NAME);
            var req = store.getAll();
            req.onsuccess = function () { callback(req.result); };
        });
    }

    function getProduct(barcode, callback) {
        waitForDB(function () {
            var tx = db.transaction([STORE_NAME], 'readonly');
            var store = tx.objectStore(STORE_NAME);
            var req = store.get(barcode);
            req.onsuccess = function () { callback(req.result); };
        });
    }

    function saveProduct(product, callback) {
        waitForDB(function () {
            var tx = db.transaction([STORE_NAME], "readwrite");
            var store = tx.objectStore(STORE_NAME);
            var req = store.put(product);
            req.onsuccess = function () {
                updateDashboard();
                if (callback) callback();
            };
        });
    }

    // --- 3. ACTUALIZACIÓN DE UI (Dashboard) ---
    function updateDashboard() {
        getAllProducts(function (products) {
            // Total
            var totalEl = document.getElementById('totalProducts');
            if (totalEl) totalEl.textContent = products.length + " productos";

            // Stock Bajo
            var lowStock = products.filter(function (p) { return (parseInt(p.stock) || 0) <= 5; });
            var lowEl = document.getElementById('lowStockProducts');
            if (lowEl) lowEl.innerHTML = lowStock.length + ' items <span class="status-badge low">Alerta</span>';

            // Último Escaneado
            var lastEl = document.getElementById('lastScannedProduct');
            if (lastEl) {
                if (products.length > 0) {
                    var last = products[products.length - 1];
                    lastEl.innerHTML = last.barcode + ' <span class="status-badge good">OK</span>';
                } else {
                    lastEl.textContent = "Ninguno";
                }
            }
        });
    }

    function showNotification(msg, type) {
        var container = document.getElementById('notification-container');
        if (!container) return;
        var div = document.createElement('div');
        div.className = 'notification ' + (type || 'success');
        div.textContent = msg;
        container.appendChild(div);
        setTimeout(function () { div.remove(); }, 3000);
    }

    // --- 4. MODALES Y DIÁLOGOS ---
    window.showEditProductModal = function (barcode) {
        getProduct(barcode, function (product) {
            var modal = document.getElementById('editProductModal');
            document.getElementById('barcode').value = barcode;

            if (product) {
                document.getElementById('description').value = product.description || "";
                document.getElementById('stock').value = product.stock || 0;
                document.getElementById('price').value = product.price || 0;
            } else {
                document.getElementById('description').value = "";
                document.getElementById('stock').value = "";
                document.getElementById('price').value = "";
            }

            // Generar Barcode Preview con JsBarcode si existe
            if (window.JsBarcode) {
                var preview = document.getElementById('barcodePreview');
                if (preview) {
                    preview.innerHTML = '<svg id="barcode-canvas"></svg>';
                    JsBarcode("#barcode-canvas", barcode, {
                        format: "CODE128",
                        width: 2,
                        height: 100,
                        displayValue: true
                    });
                }
            }

            modal.classList.add('active');
        });
    };

    function generateProductHTML(p) {
        var statusClass = (parseInt(p.stock) || 0) <= 5 ? 'low-stock' : '';
        return '<div class="product-card ' + statusClass + '" style="background:white; padding:15px; border-radius:15px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 10px rgba(0,0,0,0.05);">' +
            '<div style="flex:1;">' +
            '<h4 style="margin:0; color:var(--dark);">' + (p.description || "Sin descripción") + '</h4>' +
            '<p style="margin:4px 0; font-size:0.85em; color:#666;">SKU/Bar: ' + p.barcode + '</p>' +
            '<div style="display:flex; gap:15px; font-size:0.9em; font-weight:600;">' +
            '<span>Stock: ' + p.stock + '</span><span>$' + p.price + '</span>' +
            '</div></div>' +
            '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:10px; border-radius:12px; cursor:pointer;">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>' +
            '</button></div>';
    }

    function showListModal(modalId, listId, filterFn) {
        var modal = document.getElementById(modalId);
        var container = document.getElementById(listId);
        getAllProducts(function (products) {
            var filtered = filterFn ? products.filter(filterFn) : products;
            if (filtered.length === 0) {
                container.innerHTML = "<p style='text-align:center; padding:20px;'>No hay productos.</p>";
            } else {
                container.innerHTML = filtered.map(generateProductHTML).join('');
            }
            modal.classList.add('active');
        });
    }

    // --- 5. LÓGICA DEL SCANNER (QuaggaJS) ---
    function initScanner() {
        if (typeof Quagga === 'undefined') {
            showNotification("Error: Librería de cámara no cargada", "error");
            return;
        }

        var videoTarget = document.getElementById('camera-feed');

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: videoTarget,
                constraints: {
                    facingMode: "environment",
                    width: { min: 640 },
                    height: { min: 480 },
                    aspectRatio: { min: 1, max: 2 }
                },
            },
            locator: { patchSize: "medium", halfSample: true },
            numOfWorkers: navigator.hardwareConcurrency || 4,
            decoder: {
                readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader", "upc_reader", "upc_e_reader"]
            },
            locate: true
        }, function (err) {
            if (err) {
                console.error("Scanner Error:", err);
                showNotification("Error al acceder a la cámara", "error");
                document.querySelector('.scanner-view').classList.remove('active');
                return;
            }
            console.log("Scanner iniciado.");
            Quagga.start();
        });

        Quagga.onDetected(function (result) {
            var code = result.codeResult.code;
            console.log("Detectado:", code);

            // Beep sound (opcional)
            var audio = new Audio('data:audio/wav;base64,UklGRl9vT1... (short beep base64)'); // Omitido por brevedad

            stopScanner();
            document.querySelector('.scanner-view').classList.remove('active');
            window.showEditProductModal(code);
        });
    }

    function stopScanner() {
        if (typeof Quagga !== 'undefined') Quagga.stop();
        var video = document.getElementById('camera-feed');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(function (track) { track.stop(); });
        }
    }

    // --- 6. EVENTOS DE INTERACCIÓN ---
    function setupEventListeners() {
        // Menú Hamburguesa
        var menuBtn = document.querySelector('.menu-button');
        var menu = document.querySelector('.menu');
        var content = document.querySelector('.content');
        if (menuBtn) {
            menuBtn.onclick = function () {
                menu.classList.toggle('active');
                content.classList.toggle('menu-active');
            };
        }

        // Botón Flotante (Abrir Cámara)
        var floatBtn = document.querySelector('.floating-button');
        if (floatBtn) {
            floatBtn.onclick = function () {
                document.querySelector('.scanner-view').classList.add('active');
                initScanner();
            };
        }

        // Dashboard Cards
        var cards = document.querySelectorAll('.card');
        if (cards.length >= 1) {
            cards[0].onclick = function () { showListModal('inventoryDetailsModal', 'inventoryDetailsList'); };
        }
        if (cards.length >= 2) {
            cards[1].onclick = function () { showListModal('lowStockModal', 'lowStockList', function (p) { return (parseInt(p.stock) || 0) <= 5; }); };
        }
        if (cards.length >= 3) {
            cards[2].onclick = function () { showListModal('lastScanModal', 'lastScanDetails', null); }; // Últimos 10 (simplificado)
        }

        // Guardar Producto
        var saveBtn = document.getElementById('saveProduct');
        if (saveBtn) {
            saveBtn.onclick = function () {
                var p = {
                    barcode: document.getElementById('barcode').value,
                    description: document.getElementById('description').value,
                    stock: parseInt(document.getElementById('stock').value) || 0,
                    price: parseFloat(document.getElementById('price').value) || 0
                };
                if (!p.barcode || !p.description) {
                    showNotification("Faltan campos obligatorios", "error");
                    return;
                }
                saveProduct(p, function () {
                    showNotification("Guardado con éxito");
                    document.getElementById('editProductModal').classList.remove('active');
                });
            };
        }

        // Buscar
        var searchBtn = document.getElementById('searchButton');
        if (searchBtn) {
            searchBtn.onclick = function () {
                var query = document.getElementById('searchBar').value.toLowerCase();
                if (!query) return;
                showListModal('inventoryDetailsModal', 'inventoryDetailsList', function (p) {
                    return p.barcode.includes(query) || (p.description && p.description.toLowerCase().includes(query));
                });
            };
        }

        // Cerrar Modales
        document.querySelectorAll('button[id^="close"], #cancelEdit, #cancelScan').forEach(function (btn) {
            btn.onclick = function (e) {
                stopScanner();
                var m = e.target.closest('div[id$="Modal"], .scanner-view');
                if (m) m.classList.remove('active');
            };
        });

        // Generar Código Manual
        var genBtn = document.getElementById('generateBarcode');
        if (genBtn) {
            genBtn.onclick = function () {
                var random = "GEN-" + Math.floor(Math.random() * 89999 + 10000);
                window.showEditProductModal(random);
            };
        }

        // Efecto Ripple (Opcional)
        document.addEventListener('click', function (e) {
            var target = e.target.closest('.card, .floating-button, .menu-item');
            if (target) {
                var ripple = document.createElement('div');
                ripple.className = 'ripple';
                var rect = target.getBoundingClientRect();
                ripple.style.left = (e.clientX - rect.left) + 'px';
                ripple.style.top = (e.clientY - rect.top) + 'px';
                target.appendChild(ripple);
                setTimeout(function () { ripple.remove(); }, 600);
            }
        });
    }

    // INICIALIZACIÓN
    initDB();
    setupEventListeners();

})();
