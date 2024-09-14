import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebaseConfig.js";

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Inicializa Quagga
const scanner = new Quagga({
  inputStream: {
    name: "Live",
    type: "Live",
    target: "#video",
  },
  decoder: {
    readers: ["code_128_reader"],
  },
  locate: true,
  numOfWorkers: 2,
  frequency: 10,
  debug: {
    drawBoundingBox: true,
    showFrequency: true,
    drawScanline: true,
    showPattern: true,
  },
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("app-container").style.display = "none";

  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    firebase.auth()
      .signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        console.log("Usuario autenticado:", user);

        document.getElementById("login-container").style.display = "none";
        document.getElementById("app-container").style.display = "block";

        loadProducts();
        loadClients();
        loadOrders();

        showClientsList();
        showOrdersList();
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error("Error de autenticación:", errorCode, errorMessage);
        document.getElementById("login-error").textContent = errorMessage;
      });
  });

  document.getElementById("scan-button").addEventListener("click", () => {
    scanner.start();
    document.getElementById("scanner-container").style.display = "block";
  });

  document.getElementById("search-button").addEventListener("click", () => {
    const barcode = document.getElementById("barcode").value;
    searchProduct(barcode);
  });

  document.getElementById("save-button").addEventListener("click", () => {
    const description = document.getElementById("description").value;
    const stock = parseInt(document.getElementById("stock").value);
    const price = parseFloat(document.getElementById("price").value);
    const barcode = document.getElementById("barcode").value;

    saveProduct(barcode, description, stock, price);
  });

  document.getElementById("clear-button").addEventListener("click", () => {
    clearForm();
  });

  document.getElementById("export-button").addEventListener("click", () => {
    exportToExcel();
  });

  document.getElementById("import-button").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  document.getElementById("low-stock-button").addEventListener("click", () => {
    showLowStockProducts();
  });

  document.getElementById("fileInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    importFromExcel(file);
  });

  scanner.start();

  loadProducts();
  loadClients();
  loadOrders();

  showClientsList();
  showOrdersList();

  document.getElementById("nuevoClienteBtn").addEventListener("click", () => {
    mostrarSeccion("nuevoCliente");
  });

  document.getElementById("nuevoPedidoBtn").addEventListener("click", () => {
    mostrarSeccion("nuevoPedido");
    cargarClientes();
  });

  document.getElementById("listaClientesBtn").addEventListener("click", () => {
    mostrarSeccion("listaClientes");
    showClientsList();
  });

  document.getElementById("listaPedidosBtn").addEventListener("click", () => {
    mostrarSeccion("listaPedidos");
    showOrdersList();
  });

  document.getElementById("guardarClienteBtn").addEventListener("click", () => {
    saveClient();
  });

  document.getElementById("agregarProductoBtn").addEventListener("click", () => {
    addProductToOrder();
  });

  document.getElementById("confirmarPedidoBtn").addEventListener("click", () => {
    confirmOrder();
  });

  document.querySelector("#pedidosTable tbody").addEventListener("click", (e) => {
    if (e.target.classList.contains("pedido-id")) {
      const pedidoId = parseInt(e.target.getAttribute("data-pedido-id"));
      showOrderDetails(pedidoId);
    }
  });

  document.getElementById("volverListaPedidos").addEventListener("click", () => {
    mostrarSeccion("listaPedidos");
    showOrdersList();
  });

  document.querySelector("#clientesTable tbody").addEventListener("click", (e) => {
    if (e.target.classList.contains("clienteLink")) {
      const clienteId = parseInt(e.target.getAttribute("data-id"));
      const clienteNombre = e.target.textContent.split(" ")[0] + " " + e.target.textContent.split(" ")[1];
      showClientOrders(clienteId, clienteNombre);
    }
  });

  showClientsList();
  showOrdersList();

  document.getElementById("closeScannerBtn").addEventListener("click", () => {
    scanner.stop();
    document.getElementById("scanner-container").style.display = "none";
  });
});

function scanBarcode(code) {
  const product = findProductByBarcode(code);

  if (product) {
    document.getElementById("description").value = product.description;
    document.getElementById("stock").value = product.stock;
    document.getElementById("price").value = product.price;
    document.getElementById("product-image").src = product.image;
    document.getElementById("product-image-container").style.display = "block";
  } else {
    alert("Producto no encontrado.");
  }
}

function searchProduct(barcode) {
  const product = findProductByBarcode(barcode);

  if (product) {
    document.getElementById("description").value = product.description;
    document.getElementById("stock").value = product.stock;
    document.getElementById("price").value = product.price;
    document.getElementById("product-image").src = product.image;
    document.getElementById("product-image-container").style.display = "block";
  } else {
    alert("Producto no encontrado.");
  }
}

function saveProduct(barcode, description, stock, price) {
  const newProduct = {
    barcode: barcode,
    description: description,
    stock: stock,
    price: price,
    image: "",
  };

  saveProductToLocalStorage(newProduct);

  loadProducts();
  showProductsList();
  clearForm();
}

function saveProductToLocalStorage(product) {
  let products = getProductsFromLocalStorage();
  products.push(product);
  localStorage.setItem("products", JSON.stringify(products));
}

function getProductsFromLocalStorage() {
  const products = localStorage.getItem("products");
  return products ? JSON.parse(products) : [];
}

function findProductByBarcode(barcode) {
  const products = getProductsFromLocalStorage();
  return products.find((p) => p.barcode === barcode);
}

function exportToExcel() {
  const products = getProductsFromLocalStorage();
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Código de Barras", "Descripción", "Stock", "Precio"],
    ...products.map((product) => [
      product.barcode,
      product.description,
      product.stock,
      product.price,
    ]),
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
  XLSX.writeFile(workbook, "productos.xlsx");
}

function importFromExcel(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const products = XLSX.utils.sheet_to_json(worksheet);
    products.forEach((product) => {
      saveProductToLocalStorage(product);
    });
    loadProducts();
    showProductsList();
  };
  reader.readAsArrayBuffer(file);
}

function showLowStockProducts() {
  const products = getProductsFromLocalStorage();
  const lowStockProducts = products.filter((p) => p.stock < 5);

  const lowStockList = document.getElementById("low-stock-list");
  lowStockList.innerHTML = "";

  lowStockProducts.forEach((product) => {
    const listItem = document.createElement("li");
    listItem.textContent = `${product.description} - Stock: ${product.stock}`;
    lowStockList.appendChild(listItem);
  });

  document.getElementById("low-stock-results").style.display = "block";
}

function clearForm() {
  document.getElementById("description").value = "";
  document.getElementById("stock").value = "";
  document.getElementById("price").value = "";
  document.getElementById("barcode").value = "";
  document.getElementById("product-image-container").style.display = "none";
}

function showProductsList() {
  const products = getProductsFromLocalStorage();
  const resultsList = document.getElementById("results-list");
  resultsList.innerHTML = "";

  products.forEach((product) => {
    const listItem = document.createElement("li");
    listItem.textContent = `${product.description} - Stock: ${product.stock}`;
    resultsList.appendChild(listItem);
  });

  document.getElementById("search-results").style.display = "block";
}

function loadProducts() {
  const products = getProductsFromLocalStorage();
  showProductsList();
}
// Función para guardar un cliente en localStorage
function saveClientToLocalStorage(client) {
  let clients = getClientsFromLocalStorage();
  clients.push(client);
  localStorage.setItem("clients", JSON.stringify(clients));
}

// Función para cargar los clientes de la base de datos local
function loadClients() {
  const clients = getClientsFromLocalStorage();
  const select = document.getElementById("clienteSelect");
  select.innerHTML = '<option value="">Seleccione un cliente</option>';
  clients.forEach((client) => {
    const option = document.createElement("option");
    option.value = client.nombre;
    option.textContent = `${client.nombre} ${client.apellido}`;
    select.appendChild(option);
  });
}

// Función para mostrar la lista de clientes
function showClientsList() {
  const clients = getClientsFromLocalStorage();
  const tbody = document.getElementById("clientesTableBody");
  tbody.innerHTML = "";
  clients.forEach((client) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="#" class="clienteLink" data-id="${client.nombre}">${client.nombre} ${client.apellido}</a></td>
      <td>${client.direccion}</td>
      <td>${client.telefono}</td>
      <td>${client.email}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Función para limpiar el formulario de cliente
function clearClientForm() {
  document.getElementById("nombreCliente").value = "";
  document.getElementById("apellidoCliente").value = "";
  document.getElementById("direccionCliente").value = "";
  document.getElementById("telefonoCliente").value = "";
  document.getElementById("emailCliente").value = "";
}

// Función para guardar un pedido en localStorage
function saveOrderToLocalStorage(order) {
  let orders = getOrdersFromLocalStorage();
  orders.push(order);
  localStorage.setItem("orders", JSON.stringify(orders));
}

// Función para cargar los pedidos de la base de datos local
function loadOrders() {
  const orders = getOrdersFromLocalStorage();
  const tbody = document.querySelector("#pedidosTable tbody");
  tbody.innerHTML = "";
  orders.forEach((order) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="pedido-id" data-pedido-id="${order.id}">${order.id}</span></td>
      <td>${order.cliente}</td>
      <td>${new Date(order.fecha).toLocaleString()}</td>
      <td>$${order.total.toFixed(2)}</td>
      <td><div class="estado-circulo ${order.entregado ? "estado-entregado" : "estado-pendiente"}"></div></td>
    `;
    tbody.appendChild(tr);
  });
}

// Función para mostrar la lista de pedidos
function showOrdersList() {
  loadOrders();
}

// Función para confirmar un pedido
function confirmOrder() {
  const clienteId = document.getElementById("clienteSelect").value;
  const filas = document.querySelectorAll("#pedidoTable tbody tr");

  const items = Array.from(filas).map((fila) => ({
    barcode: fila.cells[0].textContent,
    descripcion: fila.cells[1].textContent,
    cantidad: parseInt(fila.cells[2].textContent),
    precioUnitario: parseFloat(fila.cells[3].textContent.replace("$", "")),
    subtotal: parseFloat(fila.cells[4].textContent.replace("$", "")),
  }));

  const total = parseFloat(document.getElementById("totalPedido").textContent);
  const newOrder = {
    id: generateOrderId(),
    cliente: clienteId,
    fecha: new Date(),
    total: total,
    items: items,
    entregado: false,
  };

  saveOrderToLocalStorage(newOrder);

  alert("Pedido confirmado exitosamente");
  clearFormFields("nuevoPedido");
  document.querySelector("#pedidoTable tbody").innerHTML = "";
  document.getElementById("totalPedido").textContent = "0.00";
  loadOrders();
}

// Función para mostrar detalles del pedido
function showOrderDetails(pedidoId) {
  const orders = getOrdersFromLocalStorage();
  const pedido = orders.find((order) => order.id === pedidoId);

  document.getElementById("pedidoDetalleId").textContent = pedido.id;
  const content = document.getElementById("pedidoDetalleContent");
  content.innerHTML = `
    <p><strong>Cliente:</strong> ${pedido.cliente}</p>
    <p><strong>Fecha:</strong> ${new Date(pedido.fecha).toLocaleString()}</p>
    <p><strong>Total:</strong> $${pedido.total.toFixed(2)}</p>
    <p><strong>Estado:</strong> ${pedido.entregado ? "Entregado" : "Pendiente"}</p>
    <h3>Productos:</h3>
    <table>
      <thead>
        <tr>
          <th>Código de Barras</th>
          <th>Descripción</th>
          <th>Cantidad</th>
          <th>Precio Unitario</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${pedido.items
          .map(
            (item) => `
              <tr>
                <td>${item.barcode}</td>
                <td>${item.descripcion}</td>
                <td>${item.cantidad}</td>
                <td>$${item.precioUnitario.toFixed(2)}</td>
                <td>$${item.subtotal.toFixed(2)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;

  mostrarSeccion("pedidoDetalle");
}
