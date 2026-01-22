// scripts.js - versión 1.5 PRO (Robust Camera Fix)
// Consolidado, con manual getUserMedia y Quagga robusto

(function () {
    console.log("Iniciando Sistema de Inventario Pro v1.5...");

    var db;
    var dbReady = false;
    var STORE_NAME = "products";
    var scannerActive = false;

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
        var titleId = "";
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
                    return '<div class="product-card" style="background:#fff; padding:15px; border-radius:15px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center;">' +
                        '<div><h4 style="margin:0;">' + (p.description || "Sin nombre") + '</h4>' +
                        '<small>' + p.barcode + ' | <span class="status-badge ' + statusClass + '">Stock: ' + p.stock + '</span></small></div>' +
                        '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:10px; border-radius:10px;">Editar</button>' +
                        '</div>';
                }).join('') || '<p style="text-align:center; padding:20px;">No hay datos.</p>';
                modal.classList.add('active');
            };
        });
    }

    // --- 4. SCANNER (THE HEART) ---
    async function startScanner() {
        if (typeof Quagga === 'undefined') return alert("Error: Librería no cargada");

        var videoTarget = document.getElementById('camera-feed');
        if (!videoTarget) return;

        scannerActive = true;
        document.querySelector('.scanner-view').classList.add('active');

        try {
            // "Despertar" la cámara primero manualmente (Fix para Safari/PWA)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            videoTarget.srcObject = stream;
            videoTarget.setAttribute('playsinline', true);
            await videoTarget.play();

            // Iniciar Quagga
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: videoTarget,
                    constraints: {
                        facingMode: "environment",
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        aspectRatio: { ideal: 1.3333333333 }
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
                    console.error("Quagga Init Error:", err);
                    showNotification("Error de inicialización de scanner", "error");
                    return;
                }
                if (scannerActive) Quagga.start();
            });

            Quagga.onDetected(function (res) {
                if (res && res.codeResult) {
                    var code = res.codeResult.code;
                    console.log("Detectado:", code);
                    // Reproducir beep si es posible
                    try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWoGAACBhYqFbF1FVU1aZH2Sqa3wdnaBjpacopuYn6eipZ+RhoJ6hpGUeqxhTlFKSlBYY36GmZyQhHp1hI6apK2up7KzqJyYkZCJhH58R0xGR0RBPkRPVlVZXl9ubXh3gYOMjYmFf4eDgH58f4GBgoKIipCMmI6Ihn1tZV9jZ2dvb25qbmyhoJ2koZ6Wk5edm5KKkZSVkpKVm5eTkYt7l4zhSUJGSEIxP0hOUVZhY21wbG1wcnR2eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5fHp0cG9ubGlvcXR3eHZwb3N5f").play(); } catch (e) { }

                    stopScanner();
                    window.showEditProductModal(code);
                }
            });

        } catch (err) {
            console.error("Cámara error:", err);
            alert("Acceso a cámara denegado o no disponible.");
            stopScanner();
        }
    }

    function stopScanner() {
        scannerActive = false;
        if (typeof Quagga !== 'undefined') Quagga.stop();
        var v = document.getElementById('camera-feed');
        if (v && v.srcObject) {
            v.srcObject.getTracks().forEach(function (t) { t.stop(); });
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
                track.applyConstraints({ advanced: [{ torch: !s.torch }] }).catch(alert);
            } else { alert("Linterna no soportada o no accesible."); }
        }
    }

    // --- 5. INICIALIZACIÓN ---
    function init() {
        initDB();

        // Menú
        var menuBtn = document.querySelector('.menu-button');
        if (menuBtn) {
            menuBtn.onclick = function () {
                document.querySelector('.menu').classList.toggle('active');
                document.querySelector('.content').classList.toggle('menu-active');
            };
        }

        // Abrir Scanner
        var floatBtn = document.querySelector('.floating-button');
        if (floatBtn) {
            floatBtn.onclick = startScanner;
        }

        // Acciones Scanner
        var cancelScanBtn = document.getElementById('cancelScan');
        if (cancelScanBtn) cancelScanBtn.onclick = stopScanner;

        var flashBtn = document.getElementById('flashlight');
        if (flashBtn) flashBtn.onclick = toggleFlash;

        // Dashboard
        var cards = document.querySelectorAll('.card');
        if (cards[0]) cards[0].onclick = function () { openDetails('all'); };
        if (cards[1]) cards[1].onclick = function () { openDetails('low'); };
        if (cards[2]) cards[2].onclick = function () { openDetails('last'); };

        // Modales - Guardar
        var saveBtn = document.getElementById('saveProduct');
        if (saveBtn) {
            saveBtn.onclick = function () {
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
                    showNotification("¡Producto Guardado!", "success");
                };
            };
        }

        // Modales - Cancelar/Cerrar
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
        var genBtn = document.getElementById('generateBarcode');
        if (genBtn) {
            genBtn.onclick = function () {
                var random = "7" + Math.floor(Math.random() * 100000000000);
                document.getElementById('barcode').value = random;
                window.showEditProductModal(random);
            }
        }

        // Búsqueda
        var sBtn = document.getElementById('searchButton');
        if (sBtn) {
            sBtn.onclick = function () {
                var q = document.getElementById('searchBar').value.toLowerCase();
                if (!q) return alert("Escribe algo para buscar");

                waitForDB(function () {
                    db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll().onsuccess = function (e) {
                        var filtered = e.target.result.filter(function (p) {
                            return p.barcode.includes(q) || (p.description && p.description.toLowerCase().includes(q));
                        });

                        var modal = document.getElementById('inventoryDetailsModal');
                        var container = document.getElementById('inventoryDetailsList');
                        container.innerHTML = '<h3>Resultados de Búsqueda</h3>' + filtered.map(function (p) {
                            return '<div class="product-card" style="background:#fff; padding:15px; border-radius:15px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center;">' +
                                '<div><h4 style="margin:0;">' + (p.description || "Sin nombre") + '</h4><small>' + p.barcode + '</small></div>' +
                                '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:10px; border-radius:10px;">Editar</button>' +
                                '</div>';
                        }).join('') || '<p style="text-align:center; padding:20px;">No se encontraron coincidencias.</p>';
                        modal.classList.add('active');
                    };
                });
            };
        }
    }

    init();
})();
