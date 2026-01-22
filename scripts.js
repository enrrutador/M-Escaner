// scripts.js - versión 1.7 (Ultra Robust Camera)
// Corrección de pantalla negra en móviles y actualización de dashboard

(function () {
    console.log("Iniciando Sistema de Inventario Pro v1.7...");

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

                // Actualizar último escaneado (basado en el último agregado o modificado)
                if (products.length > 0 && document.getElementById('lastScannedProduct')) {
                    // Ordenamos por una fecha supuesta o simplemente tomamos el último del array si no hay fecha
                    var last = products[products.length - 1];
                    document.getElementById('lastScannedProduct').innerHTML = (last.description || last.barcode).substring(0, 15) + '... <span class="status-badge good">OK</span>';
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
                if (type === 'last' || type === 'all') filtered = filtered.slice().reverse(); // Mostrar más recientes primero

                container.innerHTML = filtered.map(function (p) {
                    var statusClass = (parseInt(p.stock) || 0) <= 5 ? "low" : "good";
                    return '<div class="product-card" style="background:#fff; padding:15px; border-radius:15px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center;">' +
                        '<div style="flex:1;"><h4 style="margin:0; font-size:16px;">' + (p.description || "Sin nombre") + '</h4>' +
                        '<small style="color:#666;">' + p.barcode + ' | <span style="font-weight:bold; color:' + (statusClass === 'low' ? '#f39c12' : '#27ae60') + '">Stock: ' + p.stock + '</span></small></div>' +
                        '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:8px 12px; border-radius:8px; font-size:12px;">Editar</button>' +
                        '</div>';
                }).join('') || '<p style="text-align:center; padding:20px;">No hay productos.</p>';
                modal.classList.add('active');
            };
        });
    }

    // --- 4. SCANNER (THE ULTIMATE FIX) ---
    async function startScanner() {
        if (typeof Quagga === 'undefined') return alert("Error: Quagga no cargado");

        var video = document.getElementById('camera-feed');
        document.querySelector('.scanner-view').classList.add('active');

        try {
            // PASO 1: Forzar reinicio de cualquier stream previo
            if (video.srcObject) {
                video.srcObject.getTracks().forEach(t => t.stop());
            }

            // PASO 2: Solicitar cámara explícitamente para asegurar permisos
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
            });

            video.srcObject = stream;
            // IMPORTANTE: Algunos navegadores requieren llamar a play() manualmente
            await video.play();

            // PASO 3: Iniciar Quagga adjuntándolo al stream ya abierto
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: video,
                    constraints: {
                        facingMode: "environment"
                    }
                },
                locator: { patchSize: "medium", halfSample: true },
                decoder: { readers: ["ean_reader", "code_128_reader", "upc_reader", "code_39_reader"] },
                locate: true
            }, function (err) {
                if (err) {
                    console.error(err);
                    showNotification("Error de Scanner: " + err, "error");
                    return;
                }
                Quagga.start();
            });

            Quagga.onDetected(function (res) {
                if (res && res.codeResult) {
                    var code = res.codeResult.code;
                    console.log("Detectado:", code);
                    stopScanner();
                    window.showEditProductModal(code);
                }
            });

        } catch (err) {
            console.error("Fallo de cámara:", err);
            alert("No se pudo acceder a la cámara. Revisa los permisos.");
            stopScanner();
        }
    }

    function stopScanner() {
        if (typeof Quagga !== 'undefined') Quagga.stop();
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
            } else { alert("Tu móvil no soporta linterna web."); }
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

        // Escanear
        document.querySelector('.floating-button').onclick = startScanner;

        // Controles Scanner
        document.getElementById('cancelScan').onclick = stopScanner;
        document.getElementById('flashlight').onclick = toggleFlash;

        // Tarjetas Dashboard
        var cards = document.querySelectorAll('.card');
        if (cards[0]) cards[0].onclick = function () { openDetails('all'); };
        if (cards[1]) cards[1].onclick = function () { openDetails('low'); };
        if (cards[2]) cards[2].onclick = function () { openDetails('last'); };

        // Guardar
        document.getElementById('saveProduct').onclick = function () {
            var p = {
                barcode: document.getElementById('barcode').value,
                description: document.getElementById('description').value,
                stock: parseInt(document.getElementById('stock').value) || 0,
                price: parseFloat(document.getElementById('price').value) || 0
            };
            if (!p.barcode || !p.description) return alert("Código y Descripción son obligatorios.");

            var tx = db.transaction([STORE_NAME], "readwrite");
            tx.objectStore(STORE_NAME).put(p).onsuccess = function () {
                document.getElementById('editProductModal').classList.remove('active');
                updateDashboard();
                showNotification("¡Guardado!", "success");
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

        // Generar Código
        document.getElementById('generateBarcode').onclick = function () {
            var random = "7" + Date.now().toString().slice(-11);
            document.getElementById('barcode').value = random;
            if (window.JsBarcode) {
                JsBarcode("#b-comp", random, { format: "CODE128", width: 2, height: 80, displayValue: true });
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
                            '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:8px 12px; border-radius:8px;">Editar</button>' +
                            '</div>';
                    }).join('') || '<p style="text-align:center; padding:20px;">No se encontró nada.</p>';
                    document.getElementById('inventoryDetailsModal').classList.add('active');
                };
            });
        };
    }

    init();
})();
