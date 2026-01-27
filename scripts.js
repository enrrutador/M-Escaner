// scripts.js - versión 3.1 INDUSTRIAL + ESTÉTICA
// Global scanner settings for real-time tuning (exposed to UI)
var scannerSettings = { fps: 30, qrboxPercent: 60 };
// Scanner profesional con html5-qrcode - Nivel industrial con diseño personalizado

(function () {
  
  
    console.log("Iniciando Sistema de Inventario Pro v3.1 INDUSTRIAL...");

    var db;
    var dbReady = false;
    var STORE_NAME = "products";
    var CAT_STORE = "categories";
    var HIST_STORE = "movements";
    var html5QrcodeScanner = null;

    // --- 1. BASE DE DATOS ---
    function initDB() {
        var request = indexedDB.open("InventoryDB", 1);
        request.onupgradeneeded = function (e) {
            db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "barcode" });
            }
            if (!db.objectStoreNames.contains(CAT_STORE)) {
                db.createObjectStore(CAT_STORE, { keyPath: "name" });
            }
            if (!db.objectStoreNames.contains(HIST_STORE)) {
                db.createObjectStore(HIST_STORE, { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = function (e) {
            db = e.target.result;
            dbReady = true;
            console.log("✓ DB Conectada");
            updateDashboard();
        };
        request.onerror = function (e) {
            console.error("✗ Error DB:", e);
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
                var totalQuantity = 0;
                var totalValue = 0;

                products.forEach(function (p) {
                    totalQuantity += (parseInt(p.stock) || 0);
                    totalValue += (parseInt(p.stock) || 0) * (parseFloat(p.price) || 0);
                });

                if (document.getElementById('totalProducts')) {
                    document.getElementById('totalProducts').innerHTML = products.length + " productos <br><small>Total: " + totalQuantity + " unidades</small>";
                }

                var low = products.filter(function (p) { return (parseInt(p.stock) || 0) <= 5; });
                if (document.getElementById('lowStockProducts'))
                    document.getElementById('lowStockProducts').innerHTML = low.length + ' items <span class="status-badge low">Alerta</span>';

                if (products.length > 0 && document.getElementById('lastScannedProduct')) {
                    var last = products[products.length - 1];
                    var displayText = last.description || last.barcode;
                    if (displayText.length > 20) displayText = displayText.substring(0, 20) + "...";
                    document.getElementById('lastScannedProduct').innerHTML = displayText + ' <span class="status-badge good">OK</span>';
                }

                // Set total value if element exists (will add to index.html later)
                if (document.getElementById('totalInventoryValue')) {
                    document.getElementById('totalInventoryValue').textContent = "$ " + totalValue.toLocaleString();
                }
            };
        });
    }

    function logMovement(barcode, type, qty, note) {
        waitForDB(function () {
            var tx = db.transaction([HIST_STORE], 'readwrite');
            tx.objectStore(HIST_STORE).add({
                barcode: barcode,
                type: type, // 'add', 'edit', 'adjustment', 'delete'
                qty: qty,
                note: note || "",
                date: new Date().toISOString()
            });
        });
    }

    function playBeep() {
        try {
            var context = new (window.AudioContext || window.webkitAudioContext)();
            var osc = context.createOscillator();
            var gain = context.createGain();
            osc.connect(gain);
            gain.connect(context.destination);
            osc.type = "sine";
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0, context.currentTime);
            gain.gain.linearRampToValueAtTime(0.5, context.currentTime + 0.05);
            gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.2);
117:            osc.start();
            osc.stop(context.currentTime + 0.2);
            if (navigator.vibrate) navigator.vibrate(100);
        } catch (e) { }
    }

    window.adjustStock = function (barcode, amount, event) {
        if (event) event.stopPropagation();
        waitForDB(function () {
            var tx = db.transaction([STORE_NAME], 'readwrite');
            var store = tx.objectStore(STORE_NAME);
            store.get(barcode).onsuccess = function (e) {
                var p = e.target.result;
                if (!p) return;
                var oldStock = parseInt(p.stock) || 0;
                p.stock = Math.max(0, oldStock + amount);
                store.put(p).onsuccess = function () {
                    logMovement(barcode, 'adjustment', amount, 'Ajuste rápido');
                    updateDashboard();
                    // Refrescar modal si está abierto
                    var currentModal = document.querySelector('div[id$="Modal"].active');
                    if (currentModal && currentModal.id !== 'editProductModal') {
                        var type = currentModal.id.includes('low') ? 'low' : (currentModal.id.includes('last') ? 'last' : 'all');
                        openDetails(type);
                    }
                };
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

                // New fields
                document.getElementById('category').value = p ? (p.category || "Ferretería") : "Ferretería";
                document.getElementById('unit').value = p ? (p.unit || "") : "";
                document.getElementById('stock').value = p ? (p.stock || 0) : "";
                document.getElementById('depot').value = p ? (p.depot || "") : "";
                document.getElementById('location').value = p ? (p.location || "") : "";
                document.getElementById('status').value = p ? (p.status || "") : "";
                document.getElementById('entry_price').value = p ? (p.entry_price || 0) : "";
                document.getElementById('price').value = p ? (p.price || 0) : "";

                if (window.JsBarcode) {
                    var preview = document.getElementById('barcodePreview');
                    if (preview) {
                        try {
                            preview.innerHTML = '<svg id="b-comp"></svg>';
                            JsBarcode("#b-comp", barcode, { format: "CODE128", width: 2, height: 80, displayValue: true });
                        } catch (err) {
                            console.warn("Error generando barcode preview", err);
                            preview.innerHTML = "";
                        }
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
                filtered = filtered.slice().reverse();

                container.innerHTML = filtered.map(function (p) {
                    var statusClass = (parseInt(p.stock) || 0) <= 5 ? "low" : "good";
                    return '<div class="product-card" style="background:#fff; padding:15px; border-radius:15px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center; border-left: 4px solid ' + (statusClass === 'low' ? '#ff4d4d' : '#00b894') + '">' +
                        '<div style="flex:1;"><h4 style="margin:0; color:var(--dark)">' + (p.description || "Sin nombre") + '</h4>' +
                        '<small>' + p.barcode + ' | <b style="color:' + (statusClass === 'low' ? '#ff4d4d' : '#00b894') + '">Stock: ' + p.stock + '</b></small></div>' +
                        '<div style="display:flex; gap:5px;">' +
                        '<button onclick="adjustStock(\'' + p.barcode + '\', -1, event)" style="background:#ff7675; color:white; border:none; width:30px; height:30px; border-radius:8px;">-</button>' +
                        '<button onclick="adjustStock(\'' + p.barcode + '\', 1, event)" style="background:#55efc4; color:white; border:none; width:30px; height:30px; border-radius:8px;">+</button>' +
                        '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:5px 10px; border-radius:8px; margin-left:5px;">✎</button>' +
                        '</div></div>';
                }).join('') || '<p style="text-align:center; padding:20px;">No hay datos.</p>';
                modal.classList.add('active');
            };
        });
    }

    // --- CATEGORÍAS ---
    function updateCategoryDropdown() {
        waitForDB(function () {
            var tx = db.transaction([CAT_STORE], 'readonly');
            tx.objectStore(CAT_STORE).getAll().onsuccess = function (e) {
                var cats = e.target.result;
                var html = cats.map(function (c) { return '<option value="' + c.name + '">' + c.name + '</option>'; }).join('');
                // Note: assuming category input might be changed to select or we just use datalist
                var datalist = document.getElementById('categoryListDatalist');
                if (!datalist) {
                    datalist = document.createElement('datalist');
                    datalist.id = 'categoryListDatalist';
                    document.body.appendChild(datalist);
                }
                datalist.innerHTML = html;
                document.getElementById('category').setAttribute('list', 'categoryListDatalist');
            };
        });
    }

    window.refreshCategoryList = function () {
        waitForDB(function () {
            db.transaction([CAT_STORE], 'readonly').objectStore(CAT_STORE).getAll().onsuccess = function (e) {
                var list = document.getElementById('categoryList');
                if (!list) return;
                list.innerHTML = e.target.result.map(function (c) {
                    return '<li>' + c.name + ' <button class="delete-category" onclick="deleteCategory(\'' + c.name + '\')">✕</button></li>';
                }).join('');
                updateCategoryDropdown();
            };
        });
    }

    window.addCategory = function () {
        var name = document.getElementById('newCategory').value.trim();
        if (!name) return;
        waitForDB(function () {
            var tx = db.transaction([CAT_STORE], 'readwrite');
            tx.objectStore(CAT_STORE).put({ name: name }).onsuccess = function () {
                document.getElementById('newCategory').value = "";
                refreshCategoryList();
                showNotification("Categoría agregada");
            };
        });
    }

    window.deleteCategory = function (name) {
        if (!confirm("¿Eliminar categoría " + name + "?")) return;
        waitForDB(function () {
            var tx = db.transaction([CAT_STORE], 'readwrite');
            tx.objectStore(CAT_STORE).delete(name).onsuccess = function () {
                refreshCategoryList();
            };
        });
    }

    // --- IMPORT/EXPORT ---
    window.exportToExcel = function () {
        waitForDB(function () {
            db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll().onsuccess = function (e) {
                var data = e.target.result;
                if (data.length === 0) { alert("No hay datos para exportar"); return; }
                var ws = XLSX.utils.json_to_sheet(data);
                var wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Inventario");
                XLSX.writeFile(wb, "Inventario_M-Escaner.xlsx");
            };
        });
    }

    window.importCSV = function () {
        var fileInput = document.getElementById('importFile');
        if (!fileInput.files.length) { alert("Seleccione un archivo CSV"); return; }
        var reader = new FileReader();
        reader.onload = function (e) {
            var content = e.target.result;
            var lines = content.split('\n');
            var headers = lines[0].split(',');
            var count = 0;

            waitForDB(function () {
                var tx = db.transaction([STORE_NAME], 'readwrite');
                var store = tx.objectStore(STORE_NAME);

                for (var i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    var cols = lines[i].split(',');
                    var obj = {};
                    headers.forEach(function (h, idx) { obj[h.trim()] = cols[idx] ? cols[idx].trim() : ""; });
                    if (obj.barcode) {
                        store.put(obj);
                        count++;
                    }
                }
                tx.oncomplete = function () {
                    showNotification("Importados " + count + " productos");
                    updateDashboard();
                    document.getElementById('importExportModal').classList.remove('active');
                };
            });
        };
        reader.readAsText(fileInput.files[0]);
    }

    // --- REPORTS ---
    window.showReports = function () {
        waitForDB(function () {
            db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll().onsuccess = function (e) {
                var products = e.target.result;
                var cats = {};
                products.forEach(function (p) {
                    var c = p.category || "Sin categoría";
                    cats[c] = (cats[c] || 0) + (parseInt(p.stock) || 0);
                });

                var ctx = document.getElementById('inventoryChart').getContext('2d');
                if (window.myChart) window.myChart.destroy();

                window.myChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(cats),
                        datasets: [{
                            data: Object.values(cats),
                            backgroundColor: ['#2196f3', '#ff4081', '#00b894', '#ff9f43', '#9b59b6', '#34495e']
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
                document.getElementById('reportsModal').classList.add('active');
            };
        });
    }

    window.deleteProduct = function () {
        var barcode = document.getElementById('barcode').value;
        if (!barcode || !confirm("¿Seguro que deseas eliminar este producto?")) return;
        waitForDB(function () {
            db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).delete(barcode).onsuccess = function () {
                logMovement(barcode, 'delete', 0, 'Producto eliminado');
                document.getElementById('editProductModal').classList.remove('active');
                updateDashboard();
                showNotification("Producto eliminado", "error");
            };
        });
    }

    window.printBarcode = function () {
        var barcode = document.getElementById('barcode').value;
        var desc = document.getElementById('description').value;
        if (!barcode) return;

        var printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>Imprimir Código</title></head><body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">');
        printWindow.document.write('<h1>' + desc + '</h1>');
        printWindow.document.write('<svg id="barcode"></svg>');
        printWindow.document.write('<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>');
        printWindow.document.write('<script>JsBarcode("#barcode", "' + barcode + '", {format: "CODE128", width: 3, height: 100}); window.onload = function() { window.print(); window.close(); }</script>');
        printWindow.document.write('</body></html>');
    }

    window.showHistory = function () {
        waitForDB(function () {
            db.transaction([HIST_STORE], 'readonly').objectStore(HIST_STORE).getAll().onsuccess = function (e) {
                var movements = e.target.result.slice().reverse().slice(0, 50);
                var html = movements.map(function (m) {
                    var date = new Date(m.date).toLocaleString();
                    return '<li><b>[' + date + ']</b> ' + m.type + ' (' + m.qty + '): ' + m.barcode + ' <br><small>' + m.note + '</small></li>';
                }).join('') || "No hay historial.";
                document.getElementById('historyList').innerHTML = html;
                document.getElementById('historyModal').classList.add('active');
            };
        });
    }

// --- 4. SCANNER INDUSTRIAL CON ESTÉTICA PERSONALIZADA ---
function buildScannerConfig() {
  return {
    fps: scannerSettings.fps,
    qrbox: function(viewfinderWidth, viewfinderHeight) {
      var minEdge = Math.min(viewfinderWidth, viewfinderHeight);
      var qrboxSize = Math.floor(minEdge * (scannerSettings.qrboxPercent / 100));
      return { width: qrboxSize, height: qrboxSize };
    },
    aspectRatio: 1.0,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E
    ],
    showTorchButtonIfSupported: false,
    showZoomSliderIfSupported: false
  };
}
function startScanner() {
        if (typeof Html5Qrcode === 'undefined') {
            alert("Error: Librería de scanner no cargada");
            return;
        }

        console.log("✓ Iniciando scanner industrial...");
        document.querySelector('.scanner-view').classList.add('active');

        // Agregar línea de escaneo personalizada
        var readerDiv = document.getElementById('reader');
        var scanLine = document.createElement('div');
        scanLine.className = 'scan-line-custom';
        scanLine.id = 'custom-scan-line';
        readerDiv.appendChild(scanLine);

        // Configuración dinámica desde buildScannerConfig (fps y ROI ajustables)
        var config = buildScannerConfig();

        html5QrcodeScanner = new Html5Qrcode("reader");

        // Optional: track last decoded code to prevent duplicates
        var lastDecodedCode = null;
        var lastDecodedAt = 0;

        var scanStartTime = 0;

        function onScanSuccess(decodedText, decodedResult) {
            var now = Date.now();
            if (decodedText === lastDecodedCode && (now - lastDecodedAt) < 200) {
                return;
            }
            lastDecodedCode = decodedText;
            lastDecodedAt = now;
            console.log("Latency: " + (now - scanStartTime) + " ms");
            console.log("✓ Código detectado:", decodedText);
            playBeep();
            showNotification("¡Código leído!", "success");
            stopScanner();
            window.showEditProductModal(decodedText);
        }

        function onScanError(errorMessage) {
            // Ignorar errores normales de escaneo
        }

465:        html5QrcodeScanner.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanError
        ).then(function () {
        scanStartTime = performance.now();
            console.log("✓ Scanner iniciado correctamente");
        }).catch(function (err) {
            console.error("✗ Error al iniciar scanner:", err);
            alert("No se pudo acceder a la cámara. Verifica los permisos.");
            stopScanner();
        });
    }

    function stopScanner() {
        // Remover línea de escaneo personalizada
        var scanLine = document.getElementById('custom-scan-line');
        if (scanLine) scanLine.remove();

        if (html5QrcodeScanner) {
            html5QrcodeScanner.stop().then(function () {
        scanStartTime = performance.now();
                console.log("✓ Scanner detenido");
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
            }).catch(function (err) {
                console.error("Error al detener:", err);
            });
        }
        document.querySelector('.scanner-view').classList.remove('active');
    }

    function toggleFlash() {
        if (html5QrcodeScanner) {
            var track = html5QrcodeScanner.getRunningTrackCapabilities();
            if (track && track.torch) {
                var settings = html5QrcodeScanner.getRunningTrackSettings();
                html5QrcodeScanner.applyVideoConstraints({
                    advanced: [{ torch: !settings.torch }]
                }).catch(function (err) {
                    alert("Flash no disponible en este dispositivo");
                });
            } else {
                alert("Flash no soportado");
            }
        }
    }

    // --- 5. INICIALIZACIÓN ---
    function init() {
        initDB();
        updateCategoryDropdown();

        document.querySelector('.menu-button').onclick = function () {
            document.querySelector('.menu').classList.toggle('active');
            document.querySelector('.content').classList.toggle('menu-active');
        };

        document.querySelector('.floating-button').onclick = startScanner;

        if (document.getElementById('cancelScan'))
            document.getElementById('cancelScan').onclick = stopScanner;
        if (document.getElementById('flashlight'))
            document.getElementById('flashlight').onclick = toggleFlash;

        var cards = document.querySelectorAll('.card');
        if (cards[0]) cards[0].onclick = function () { openDetails('all'); };
        if (cards[1]) cards[1].onclick = function () { openDetails('low'); };
        if (cards[2]) cards[2].onclick = function () { openDetails('last'); };

        document.getElementById('saveProduct').onclick = function () {
            var b = document.getElementById('barcode').value; // Editable barcode
            var d = document.getElementById('description').value;

            if (!b || !d) {
                alert("Código y Nombre son obligatorios.");
                return;
            }

            var p = {
                barcode: b,
                description: d,
                category: document.getElementById('category').value,
                unit: document.getElementById('unit').value,
                stock: parseInt(document.getElementById('stock').value) || 0,
                depot: document.getElementById('depot').value,
                location: document.getElementById('location').value,
                status: document.getElementById('status').value,
                entry_price: parseFloat(document.getElementById('entry_price').value) || 0,
                price: parseFloat(document.getElementById('price').value) || 0
            };

            var tx = db.transaction([STORE_NAME], "readwrite");
            tx.objectStore(STORE_NAME).put(p).onsuccess = function () {
                logMovement(b, 'save', p.stock, 'Guardado manual');
                document.getElementById('editProductModal').classList.remove('active');
                updateDashboard();
                showNotification("¡Producto guardado!");
            };
        };

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

        document.getElementById('generateBarcode').onclick = function () {
            var random = "770" + Math.floor(Math.random() * 10000000);
            document.getElementById('barcode').value = random;
            if (window.JsBarcode) {
                JsBarcode("#b-comp", random, { format: "CODE128", width: 2, height: 80, displayValue: true });
            }
        };

        document.getElementById('searchButton').onclick = function () {
            var q = document.getElementById('searchBar').value.toLowerCase().trim();
            if (!q) return;

            waitForDB(function () {
                db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll().onsuccess = function (e) {
                    var filtered = e.target.result.filter(function (p) {
                        return p.barcode.includes(q) || (p.description && p.description.toLowerCase().includes(q));
                    });
                    var container = document.getElementById('inventoryDetailsList');
                    container.innerHTML = '<h3>Resultados de búsqueda</h3>' + filtered.map(function (p) {
                        return '<div class="product-card" style="background:#fff; padding:15px; border-radius:15px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center;">' +
                            '<div><h4 style="margin:0;">' + (p.description || "Sin nombre") + '</h4><small>' + p.barcode + '</small></div>' +
                            '<button onclick="showEditProductModal(\'' + p.barcode + '\')" style="background:var(--primary); color:white; border:none; padding:10px; border-radius:10px;">Editar</button>' +
                            '</div>';
                    }).join('') || '<p style="text-align:center; padding:20px;">No se encontraron resultados.</p>';
                    document.getElementById('inventoryDetailsModal').classList.add('active');
                };
            });
        };

        // UI Event Listeners for new functions
        if (document.getElementById('manageCategories')) document.getElementById('manageCategories').onclick = function () {
            refreshCategoryList();
            document.getElementById('editCategoryModal').classList.add('active');
        };
        if (document.getElementById('addCategory')) document.getElementById('addCategory').onclick = addCategory;
        if (document.getElementById('importExport')) document.getElementById('importExport').onclick = function () {
            document.getElementById('importExportModal').classList.add('active');
        };
        if (document.getElementById('exportBtn')) document.getElementById('exportBtn').onclick = exportToExcel;
        if (document.getElementById('importBtn')) document.getElementById('importBtn').onclick = importCSV;
        if (document.getElementById('viewReports')) document.getElementById('viewReports').onclick = showReports;
        if (document.getElementById('viewHistory')) document.getElementById('viewHistory').onclick = showHistory;

        // Add delete and print buttons to Product Modal dynamically or ensure they are reachable
        // I will add them in index.html, but let's bind here if needed
        // For simplicity, I'll assume they'll have IDs 'deleteProduct' and 'printBarcode'
        // These will be added in the next step to index.html

        console.log("✓ Sistema inicializado correctamente");
    }

    init();
})();

// Real-time UI controls for FPS and ROI (exposed for quick tuning)
function updateScannerUI() {
  var fpsEl = document.getElementById('fps-value');
  var roiEl = document.getElementById('roi-value');
  if (fpsEl) fpsEl.textContent = String(scannerSettings.fps);
  if (roiEl) roiEl.textContent = String(scannerSettings.qrboxPercent) + '%';
}

document.addEventListener('DOMContentLoaded', function () {
  var fpsInput = document.getElementById('scanner-fps');
  var roiInput = document.getElementById('scanner-roi');
  if (fpsInput) {
    fpsInput.addEventListener('input', function (e) {
      var v = parseInt(e.target.value, 10);
      if (!isNaN(v)) {
        scannerSettings.fps = v;
        updateScannerUI();
        if (typeof startScanner === 'function' && typeof stopScanner === 'function' && html5QrcodeScanner) {
          stopScanner();
          startScanner();
        }
      }
    });
  }
  if (roiInput) {
    roiInput.addEventListener('input', function (e) {
      var v = parseInt(e.target.value, 10);
      if (!isNaN(v)) {
        scannerSettings.qrboxPercent = v;
        updateScannerUI();
        if (typeof startScanner === 'function' && typeof stopScanner === 'function' && html5QrcodeScanner) {
          stopScanner();
          startScanner();
        }
      }
    });
  }
  updateScannerUI();
});
