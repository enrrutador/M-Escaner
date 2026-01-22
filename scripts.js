// scripts.js - versión 1.8 (INGENIERÍA FINAL)
// Optimizado para evitar pantalla negra en PWA y mejorar el Dashboard

(function () {
    console.log("Iniciando Sistema de Inventario Pro v1.8...");

    var db;
    var dbReady = false;
    var STORE_NAME = "products";
    var _scannerInitialized = false;

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
        setTimeout(function () { if (div) div.remove(); }, 3000);
    }

    function updateDashboard() {
        waitForDB(function () {
            var tx = db.transaction([STORE_NAME], 'readonly');
            tx.objectStore(STORE_NAME).getAll().onsuccess = function (e) {
                var products = e.target.result;

                // Actualizar total
                if (document.getElementById('totalProducts'))
                    document.getElementById('totalProducts').textContent = products.length + " productos";

                // Actualizar bajos en stock
                var low = products.filter(function (p) { return (parseInt(p.stock) || 0) <= 5; });
                if (document.getElementById('lowStockProducts'))
                    document.getElementById('lowStockProducts').innerHTML = low.length + ' items <span class="status-badge low">Alerta</span>';

                // Actualizar último escaneado (basado en el último del array)
                if (products.length > 0 && document.getElementById('lastScannedProduct')) {
                    var last = products[products.length - 1];
                    document.getElementById('lastScannedProduct').innerHTML = (p => {
                        let d = p.description || p.barcode;
                        return (d.length > 15 ? d.substring(0, 15) + "..." : d) + ' <span class="status-badge good">OK</span>';
                    })(last);
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
                filtered = filtered.slice().reverse(); // Siempre más nuevos arriba

                container.innerHTML = filtered.map(function (p) {
                    var statusClass = (parseInt(p.stock) || 0) <= 5 ? "low" : "good";
                    return '<div class="product-card" style="background:#fff; padding:15px; border-radius:15px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center;">' +
                        '<div style="flex:1;"><h4 style="margin:0; font-size:16px; color:var(--dark)">' + (p.description || "Sin nombre") + '</h4>' +
                        '<small style="color:#666;">' + p.barcode + ' | <span style="font-weight:bold; color:' + (statusClass === 'low' ? '#ff9800' : '#4caf50') + '">Stock: ' + p.stock + '</span></small></div>' +
                        '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:8px 12px; border-radius:10px; font-size:12px;">Editar</button>' +
                        '</div>';
                }).join('') || '<p style="text-align:center; padding:20px;">No hay productos registrados.</p>';
                modal.classList.add('active');
            };
        });
    }

    // --- 4. SCANNER (INGENIERÍA ROBUSTA v1.8) ---
    async function startScanner() {
        if (typeof Quagga === 'undefined') return alert("Error: Quagga no detectado.");

        const scannerView = document.querySelector('.scanner-view');
        const video = document.getElementById('camera-feed');

        scannerView.classList.add('active');
        showNotification("Iniciando cámara...", "success");

        // PASO 1: Matar cualquier proceso previo
        if (_scannerInitialized) {
            try { Quagga.stop(); } catch (e) { }
        }
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }

        // PASO 2: Pequeña pausa para que el hardware se libere
        await new Promise(r => setTimeout(r, 300));

        // PASO 3: Configuración Quagga con parámetros de alta compatibilidad
        const config = {
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: video,
                constraints: {
                    facingMode: "environment", // Prioriza la de atrás
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                willReadFrequently: true
            },
            locator: { patchSize: "medium", halfSample: true },
            decoder: {
                readers: ["ean_reader", "code_128_reader", "upc_reader", "code_39_reader", "upc_e_reader", "ean_8_reader"]
            },
            locate: true
        };

        Quagga.init(config, function (err) {
            if (err) {
                console.error("Fallo inicial:", err);
                // Intento #2: Sin restricciones (por si el móvil no reconoce 'environment')
                config.inputStream.constraints = {};
                Quagga.init(config, function (err2) {
                    if (err2) {
                        alert("Error fatal de cámara: " + err2);
                        stopScanner();
                        return;
                    }
                    finalizeScannerStart();
                });
                return;
            }
            finalizeScannerStart();
        });

        function finalizeScannerStart() {
            Quagga.start();
            _scannerInitialized = true;
            // Forzar play si el video se queda en negro
            video.play().catch(e => console.log("Auto-play blocked, waiting for interaction"));
        }

        Quagga.onDetected(function (res) {
            if (res && res.codeResult) {
                var code = res.codeResult.code;
                console.log("DETECTADO:", code);
                stopScanner();
                window.showEditProductModal(code);
            }
        });
    }

    function stopScanner() {
        if (_scannerInitialized) {
            try { Quagga.stop(); } catch (e) { }
            _scannerInitialized = false;
        }
        var v = document.getElementById('camera-feed');
        if (v && v.srcObject) {
            v.srcObject.getTracks().forEach(t => t.stop());
            v.srcObject = null;
        }
        document.querySelector('.scanner-view').classList.remove('active');
    }

    function toggleFlash() {
        var v = document.getElementById('camera-feed');
        if (v && v.srcObject) {
            var track = v.srcObject.getVideoTracks()[0];
            if (track && track.getCapabilities && track.getCapabilities().torch) {
                var s = track.getSettings();
                track.applyConstraints({ advanced: [{ torch: !s.torch }] }).catch(e => console.error(e));
            } else { alert("Tu móvil no permite flash en el navegador."); }
        }
    }

    // --- 5. INICIALIZACIÓN ---
    function init() {
        initDB();

        // Hamburguesa
        document.querySelector('.menu-button').onclick = function () {
            document.querySelector('.menu').classList.toggle('active');
            document.querySelector('.content').classList.toggle('menu-active');
        };

        // Botón Flotante
        document.querySelector('.floating-button').onclick = startScanner;

        // Controles Scanner
        document.getElementById('cancelScan').onclick = stopScanner;
        document.getElementById('flashlight').onclick = toggleFlash;

        // Dashboard
        var cards = document.querySelectorAll('.card');
        if (cards[0]) cards[0].onclick = function () { openDetails('all'); };
        if (cards[1]) cards[1].onclick = function () { openDetails('low'); };
        if (cards[2]) cards[2].onclick = function () { openDetails('last'); };

        // Guardar
        document.getElementById('saveProduct').onclick = function () {
            var b = document.getElementById('barcode').value;
            var d = document.getElementById('description').value;
            if (!b || !d) return alert("Falta el código o la descripción.");

            var p = {
                barcode: b,
                description: d,
                stock: parseInt(document.getElementById('stock').value) || 0,
                price: parseFloat(document.getElementById('price').value) || 0
            };

            var tx = db.transaction([STORE_NAME], "readwrite");
            tx.objectStore(STORE_NAME).put(p).onsuccess = function () {
                document.getElementById('editProductModal').classList.remove('active');
                updateDashboard();
                showNotification("¡Producto Guardado!");
            };
        };

        // Cancelar y cerrar
        if (document.getElementById('cancelEdit')) {
            document.getElementById('cancelEdit').onclick = function () {
                document.getElementById('editProductModal').classList.remove('active');
            };
        }

        document.querySelectorAll('button[id^="close"]').forEach(function (b) {
            b.onclick = function (e) {
                var m = e.target.closest('div[id$="Modal"]');
                if (m) m.classList.remove('active');
            };
        });

        // Generar Código Manual
        document.getElementById('generateBarcode').onclick = function () {
            var randomCode = "770" + Math.floor(Math.random() * 10000000);
            document.getElementById('barcode').value = randomCode;
            if (window.JsBarcode) {
                JsBarcode("#b-comp", randomCode, { format: "CODE128", width: 2, height: 80, displayValue: true });
            }
        };

        // Buscar
        document.getElementById('searchButton').onclick = function () {
            var q = document.getElementById('searchBar').value.toLowerCase().trim();
            if (!q) return;

            waitForDB(function () {
                db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll().onsuccess = function (e) {
                    var filtered = e.target.result.filter(p => p.barcode.includes(q) || (p.description && p.description.toLowerCase().includes(q)));
                    var container = document.getElementById('inventoryDetailsList');
                    container.innerHTML = '<h3>Resultados</h3>' + filtered.map(function (p) {
                        return '<div class="product-card" style="background:#fff; padding:15px; border-radius:15px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center;">' +
                            '<div><h4 style="margin:0;">' + (p.description || "Sin nombre") + '</h4><small>' + p.barcode + '</small></div>' +
                            '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:8px 12px; border-radius:10px;">Editar</button>' +
                            '</div>';
                    }).join('') || '<p style="text-align:center; padding:20px;">No se encontró nada con "' + q + '".</p>';
                    document.getElementById('inventoryDetailsModal').classList.add('active');
                };
            });
        };
    }

    init();
})();
