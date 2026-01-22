// scripts.js - versión 1.6 (Restauración Original)
// Lógica simplificada y robusta para evitar conflictos de cámara

(function () {
    console.log("Iniciando Sistema de Inventario Pro v1.6...");

    var db;
    var dbReady = false;
    var STORE_NAME = "products";

    // --- 1. BASE DE DATOS ---
    function initDB() {
        var request = indexedDB.open("InventoryDB", 1);
        request.onupgradeneeded = function (e) {
            db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "barcode" });
            }
        };
        request.onsuccess = function (e) {
            db = e.target.result;
            dbReady = true;
            console.log("DB Conectada");
            updateDashboard();
        };
    }

    function waitForDB(cb) {
        if (dbReady) return cb();
        var i = setInterval(function () { if (dbReady) { clearInterval(i); cb(); } }, 100);
    }

    // --- 2. GESTIÓN DE UI ---
    function showNotification(msg, type) {
        var container = document.getElementById('notification-container');
        if (!container) return;
        var div = document.createElement('div');
        div.className = 'notification ' + (type || 'success');
        div.textContent = msg;
        container.appendChild(div);
        setTimeout(function () { div.remove(); }, 3000);
    }

    function updateDashboard() {
        waitForDB(function () {
            var tx = db.transaction([STORE_NAME], 'readonly');
            tx.objectStore(STORE_NAME).getAll().onsuccess = function (e) {
                var products = e.target.result;
                if (document.getElementById('totalProducts'))
                    document.getElementById('totalProducts').textContent = products.length + " productos";

                var low = products.filter(function (p) { return (parseInt(p.stock) || 0) <= 5; });
                if (document.getElementById('lowStockProducts'))
                    document.getElementById('lowStockProducts').innerHTML = low.length + ' items <span class="status-badge low">Alerta</span>';

                if (products.length > 0 && document.getElementById('lastScannedProduct')) {
                    var last = products[products.length - 1]; // Último guardado
                    document.getElementById('lastScannedProduct').innerHTML = (last.description || last.barcode) + ' <span class="status-badge good">OK</span>';
                }
            };
        });
    }

    // --- 3. MODALES ---
    window.showEditProductModal = function (barcode) {
        waitForDB(function () {
            var tx = db.transaction([STORE_NAME], 'readonly');
            tx.objectStore(STORE_NAME).get(barcode).onsuccess = function (e) {
                var p = e.target.result;
                document.getElementById('barcode').value = barcode;
                document.getElementById('description').value = p ? (p.description || "") : "";
                document.getElementById('stock').value = p ? (p.stock || 0) : "";
                document.getElementById('price').value = p ? (p.price || 0) : "";

                if (window.JsBarcode) {
                    var preview = document.getElementById('barcodePreview');
                    if (preview) {
                        preview.innerHTML = '<svg id="b-comp"></svg>';
                        JsBarcode("#b-comp", barcode, { format: "CODE128", width: 2, height: 80, displayValue: true });
                    }
                }
                document.getElementById('editProductModal').classList.add('active');
            };
        });
    };

    function openDetails(type) {
        var modalId = "inventoryDetailsModal";
        var listId = "inventoryDetailsList";
        var filter = null;

        if (type === 'low') {
            modalId = "lowStockModal";
            listId = "lowStockList";
            filter = function (p) { return (parseInt(p.stock) || 0) <= 5; };
        } else if (type === 'last') {
            modalId = "lastScanModal";
            listId = "lastScanDetails";
        }

        var modal = document.getElementById(modalId);
        var container = document.getElementById(listId);
        if (!modal || !container) return;

        waitForDB(function () {
            db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll().onsuccess = function (e) {
                var products = e.target.result;
                var filtered = filter ? products.filter(filter) : products;
                if (type === 'last') filtered = filtered.slice(-10).reverse();

                container.innerHTML = filtered.map(function (p) {
                    var statusClass = (parseInt(p.stock) || 0) <= 5 ? "low" : "good";
                    return '<div class="product-card" style="background:#fff; padding:15px; border-radius:15px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center; border-left: 4px solid ' + (statusClass === 'low' ? '#ff4d4d' : '#00b894') + '">' +
                        '<div><h4 style="margin:0; color:var(--dark)">' + (p.description || "Sin nombre") + '</h4>' +
                        '<small>' + p.barcode + ' | <b style="color:' + (statusClass === 'low' ? '#ff4d4d' : '#00b894') + '">Stock: ' + p.stock + '</b></small></div>' +
                        '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:10px; border-radius:10px; font-size:12px;">Editar</button>' +
                        '</div>';
                }).join('') || '<p style="text-align:center; padding:20px;">No hay datos para mostrar.</p>';
                modal.classList.add('active');
            };
        });
    }

    // --- 4. SCANNER (LÓGICA ORIGINAL RESTAURADA) ---
    function startScanner() {
        if (typeof Quagga === 'undefined') {
            alert("Error: Librería de escaneo no cargada.");
            return;
        }

        // 1. Asegurar visibilidad
        document.querySelector('.scanner-view').classList.add('active');
        var videoTarget = document.getElementById('camera-feed');

        // 2. Intentar inicializar Quagga directamente (como funcionaba antes)
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: videoTarget,
                constraints: {
                    facingMode: "environment", // Usar cámara trasera
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
            },
            locator: { patchSize: "medium", halfSample: true },
            numOfWorkers: 2,
            decoder: {
                readers: ["ean_reader", "code_128_reader", "upc_reader", "code_39_reader"]
            },
            locate: true
        }, function (err) {
            if (err) {
                console.error("Quagga Error:", err);
                alert("Error al abrir la cámara. Asegúrate de dar permisos en el navegador.");
                stopScanner();
                return;
            }
            console.log("Scanner iniciado correctamente.");
            Quagga.start();
        });

        // 3. Callback de detección
        Quagga.onDetected(function (res) {
            if (res && res.codeResult) {
                var code = res.codeResult.code;
                console.log("Código detectado:", code);

                // Beep visual/auditivo rápido
                showNotification("¡Código Leído!", "success");

                stopScanner();
                window.showEditProductModal(code);

                // Remover el listener para evitar disparos múltiples
                Quagga.offDetected();
            }
        });
    }

    function stopScanner() {
        if (typeof Quagga !== 'undefined') {
            Quagga.stop();
        }
        // Matar los tracks de video manualmente para liberar la cámara
        var v = document.getElementById('camera-feed');
        if (v && v.srcObject) {
            v.srcObject.getTracks().forEach(function (track) { track.stop(); });
            v.srcObject = null;
        }
        document.querySelector('.scanner-view').classList.remove('active');
    }

    function toggleFlash() {
        if (typeof Quagga === 'undefined') return;
        var track = Quagga.CameraAccess.getActiveTrack();
        if (track && typeof track.getCapabilities === 'function') {
            var capabilities = track.getCapabilities();
            if (capabilities.torch) {
                var isTorchOn = track.getSettings().torch;
                track.applyConstraints({ advanced: [{ torch: !isTorchOn }] }).catch(function (e) {
                    console.error("Error flash:", e);
                });
            } else {
                alert("Tu dispositivo no permite controlar la linterna desde el navegador.");
            }
        }
    }

    // --- 5. INICIALIZACIÓN ---
    function init() {
        initDB();

        // Menú Hamburguesa
        var menuBtn = document.querySelector('.menu-button');
        if (menuBtn) {
            menuBtn.onclick = function () {
                document.querySelector('.menu').classList.toggle('active');
                document.querySelector('.content').classList.toggle('menu-active');
            };
        }

        // Botón Flotante (Abrir Scanner)
        var floatBtn = document.querySelector('.floating-button');
        if (floatBtn) {
            floatBtn.onclick = startScanner;
        }

        // Controles de Scanner
        if (document.getElementById('cancelScan'))
            document.getElementById('cancelScan').onclick = stopScanner;

        if (document.getElementById('flashlight'))
            document.getElementById('flashlight').onclick = toggleFlash;

        // Click en Tarjetas del Dashboard
        var cards = document.querySelectorAll('.card');
        if (cards[0]) cards[0].onclick = function () { openDetails('all'); };
        if (cards[1]) cards[1].onclick = function () { openDetails('low'); };
        if (cards[2]) cards[2].onclick = function () { openDetails('last'); };

        // Botón Guardar Producto
        var saveBtn = document.getElementById('saveProduct');
        if (saveBtn) {
            saveBtn.onclick = function () {
                var barcodeVal = document.getElementById('barcode').value;
                var descVal = document.getElementById('description').value;

                if (!barcodeVal || !descVal) {
                    alert("Cuidado: El código y la descripción son obligatorios.");
                    return;
                }

                var p = {
                    barcode: barcodeVal,
                    description: descVal,
                    stock: parseInt(document.getElementById('stock').value) || 0,
                    price: parseFloat(document.getElementById('price').value) || 0
                };

                var tx = db.transaction([STORE_NAME], "readwrite");
                tx.objectStore(STORE_NAME).put(p).onsuccess = function () {
                    document.getElementById('editProductModal').classList.remove('active');
                    updateDashboard();
                    showNotification("Producto actualizado correctamente.");
                };
            };
        }

        // Botón Cancelar Edición
        if (document.getElementById('cancelEdit')) {
            document.getElementById('cancelEdit').onclick = function () {
                document.getElementById('editProductModal').classList.remove('active');
            };
        }

        // Cerrar Modales (X o botones de cerrar)
        document.querySelectorAll('button[id^="close"]').forEach(function (b) {
            b.onclick = function (e) {
                var m = e.target.closest('div[id$="Modal"]');
                if (m) m.classList.remove('active');
            };
        });

        // Generar Código Aleatorio
        var genBtn = document.getElementById('generateBarcode');
        if (genBtn) {
            genBtn.onclick = function () {
                var randomSuffix = Math.floor(Math.random() * 10000000);
                var fullCode = "770" + randomSuffix;
                document.getElementById('barcode').value = fullCode;
                // Refrescar código de barras visual
                if (window.JsBarcode) {
                    JsBarcode("#b-comp", fullCode, { format: "CODE128", width: 2, height: 80, displayValue: true });
                }
            }
        }

        // Buscador
        var sBtn = document.getElementById('searchButton');
        if (sBtn) {
            sBtn.onclick = function () {
                var query = document.getElementById('searchBar').value.toLowerCase().trim();
                if (!query) return;

                waitForDB(function () {
                    db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll().onsuccess = function (e) {
                        var all = e.target.result;
                        var results = all.filter(function (p) {
                            return p.barcode.includes(query) || (p.description && p.description.toLowerCase().includes(query));
                        });

                        var container = document.getElementById('inventoryDetailsList');
                        container.innerHTML = '<h3>Resultados para: "' + query + '"</h3>' + results.map(function (p) {
                            return '<div class="product-card" style="background:#fff; padding:15px; border-radius:15px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center;">' +
                                '<div><h4 style="margin:0;">' + (p.description || "Sin nombre") + '</h4><small>' + p.barcode + '</small></div>' +
                                '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:10px; border-radius:10px;">Editar</button>' +
                                '</div>';
                        }).join('') || '<p style="text-align:center; padding:20px;">No se encontraron productos con ese nombre o código.</p>';

                        document.getElementById('inventoryDetailsModal').classList.add('active');
                    };
                });
            };
        }
    }

    init();
})();
