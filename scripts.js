// scripts.js - versión 1.4 PRO
// Consolidado, Robusto y con soporte para Linterna e IndexedDB

(function () {
    console.log("Iniciando Sistema de Inventario Pro v1.4...");

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
                    var last = products[products.length - 1];
                    document.getElementById('lastScannedProduct').innerHTML = last.barcode + ' <span class="status-badge good">OK</span>';
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

        waitForDB(function () {
            db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll().onsuccess = function (e) {
                var products = e.target.result;
                var filtered = filter ? products.filter(filter) : products;
                if (type === 'last') filtered = filtered.slice(-10).reverse();

                container.innerHTML = filtered.map(function (p) {
                    return '<div class="product-card" style="background:#fff; padding:15px; border-radius:15px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center;">' +
                        '<div><h4 style="margin:0;">' + (p.description || "Sin nombre") + '</h4><small>' + p.barcode + ' | Stock: ' + p.stock + '</small></div>' +
                        '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:10px; border-radius:10px;">Editar</button>' +
                        '</div>';
                }).join('') || '<p style="text-align:center; padding:20px;">No hay datos.</p>';
                modal.classList.add('active');
            };
        });
    }

    // --- 4. SCANNER ---
    function startScanner() {
        if (typeof Quagga === 'undefined') return alert("Error: Librería no cargada");

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.getElementById('camera-feed'),
                constraints: {
                    facingMode: "environment",
                    width: { min: 640 },
                    height: { min: 480 }
                }
            },
            decoder: { readers: ["ean_reader", "code_128_reader", "upc_reader", "code_39_reader"] }
        }, function (err) {
            if (err) { console.error(err); return alert("Error de cámara: Asegúrate de habilitar los permisos."); }
            Quagga.start();
        });

        Quagga.onDetected(function (res) {
            var code = res.codeResult.code;
            stopScanner();
            window.showEditProductModal(code);
        });
    }

    function stopScanner() {
        if (typeof Quagga !== 'undefined') Quagga.stop();
        var v = document.getElementById('camera-feed');
        if (v && v.srcObject) v.srcObject.getTracks().forEach(function (t) { t.stop(); });
        document.querySelector('.scanner-view').classList.remove('active');
    }

    function toggleFlash() {
        var v = document.getElementById('camera-feed');
        if (v && v.srcObject) {
            var track = v.srcObject.getVideoTracks()[0];
            if (track && track.getCapabilities && track.getCapabilities().torch) {
                var s = track.getSettings();
                track.applyConstraints({ advanced: [{ torch: !s.torch }] });
            } else { alert("Linterna no soportada en este móvil."); }
        }
    }

    // --- 5. INICIALIZACIÓN ---
    function init() {
        initDB();

        // Menú
        document.querySelector('.menu-button').onclick = function () {
            document.querySelector('.menu').classList.toggle('active');
            document.querySelector('.content').classList.toggle('menu-active');
        };

        // Escaneo
        document.querySelector('.floating-button').onclick = function () {
            document.querySelector('.scanner-view').classList.add('active');
            startScanner();
        };

        // Acciones Scanner
        document.getElementById('cancelScan').onclick = stopScanner;
        document.getElementById('flashlight').onclick = toggleFlash;

        // Dashboard
        var cards = document.querySelectorAll('.card');
        if (cards[0]) cards[0].onclick = function () { openDetails('all'); };
        if (cards[1]) cards[1].onclick = function () { openDetails('low'); };
        if (cards[2]) cards[2].onclick = function () { openDetails('last'); };

        // Modales
        document.getElementById('saveProduct').onclick = function () {
            var p = {
                barcode: document.getElementById('barcode').value,
                description: document.getElementById('description').value,
                stock: parseInt(document.getElementById('stock').value) || 0,
                price: parseFloat(document.getElementById('price').value) || 0
            };
            if (!p.barcode || !p.description) return alert("Completa Código y Descripción");

            var tx = db.transaction([STORE_NAME], "readwrite");
            tx.objectStore(STORE_NAME).put(p).onsuccess = function () {
                document.getElementById('editProductModal').classList.remove('active');
                updateDashboard();
                showNotification("¡Guardado!", "success");
            };
        };

        document.getElementById('cancelEdit').onclick = function () {
            document.getElementById('editProductModal').classList.remove('active');
        };

        document.querySelectorAll('button[id^="close"]').forEach(function (b) {
            b.onclick = function (e) {
                var m = e.target.closest('div[id$="Modal"]');
                if (m) m.classList.remove('active');
            };
        });

        // Búsqueda
        document.getElementById('searchButton').onclick = function () {
            var q = document.getElementById('searchBar').value.toLowerCase();
            if (!q) return;
            openDetails('all'); // Re-usamos el modal de inventario pero lo filtraremos si quisiéramos
        };
    }

    init();
})();
