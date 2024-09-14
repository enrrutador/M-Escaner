import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { firebaseConfig } from "./firebaseConfig.js";

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Inicializa Quagga
const scanner = new Quagga.Scanner({
  inputStream: {
    name: "Live",
    type: "LiveStream",
    target: document.querySelector("#video"),
  },
  decoder: {
    readers: ["code_128_reader"],
  },
  locate: true,
});

document.addEventListener("DOMContentLoaded", () => {
  // Oculta el contenedor de la aplicación al cargar la página
  document.getElementById("app-container").style.display = "none";

  // Maneja el formulario de inicio de sesión
  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    // Autenticar al usuario con Firebase
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Inicio de sesión exitoso
        const user = userCredential.user;
        console.log("Usuario autenticado:", user);

        // Mostrar el contenedor de la aplicación
        document.getElementById("login-container").style.display = "none";
        document.getElementById("app-container").style.display = "block";

        // Inicializar la base de datos local
        loadProducts();
        loadClients();
        loadOrders();

        // Mostrar la lista de clientes
        showClientsList();

        // Mostrar la lista de pedidos
        showOrdersList();
      })
      .catch((error) => {
        // Error de autenticación
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error("Error de autenticación:", errorCode, errorMessage);
        document.getElementById("login-error").textContent = errorMessage;
      });
  });

  // Maneja el botón "Escanear Código de Barras"
  document.getElementById("scan-button").addEventListener("click", () => {
    scanner.start();
    document.getElementById("scanner-container").style.display = "block";
  });

  // Maneja el botón "Buscar Producto"
  document.getElementById("search-button").addEventListener("click", () => {
    const barcode = document.getElementById("barcode").value;
    searchProduct(barcode);
  });

  // Maneja el botón "Guardar"
  document.getElementById("save-button").addEventListener("click", () => {
    const description = document.getElementById("description").value;
    const stock = parseInt(document.getElementById("stock").value);
    const price = parseFloat(document.getElementById("price").value);
    const barcode = document.getElementById("barcode").value;

    saveProduct(barcode, description, stock, price);
  });

  // Maneja el botón "Borrar"
  document.getElementById("clear-button").addEventListener("click", () => {
    clearForm();
  });

  // Maneja el botón "Exportar a Excel"
  document.getElementById("export-button").addEventListener("click", () => {
    exportToExcel();
  });

  // Maneja el botón "Importar"
  document.getElementById("import-button").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  // Maneja el botón "Ver Productos con Stock Bajo"
  document.getElementById("low-stock-button").addEventListener("click", () => {
    showLowStockProducts();
  });

  // Maneja la selección de archivo para importar
  document.getElementById("fileInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    importFromExcel(file);
  });

  // Inicializa la base de datos local
  loadProducts();
  loadClients();
  loadOrders();

  // Mostrar la lista de clientes
  showClientsList();

  // Mostrar la lista de pedidos
  showOrdersList();

  // Mostrar el formulario de nuevo cliente
  document.getElementById("nuevoClienteBtn").addEventListener("click", () => {
    mostrarSeccion("nuevoCliente");
  });

  // Mostrar el formulario de nuevo pedido
  document.getElementById("nuevoPedidoBtn").addEventListener("click", () => {
    mostrarSeccion("nuevoPedido");
    cargarClientes();
  });

  // Mostrar la lista de clientes
  document.getElementById("listaClientesBtn").addEventListener("click", () => {
    mostrarSeccion("listaClientes");
    showClientsList();
  });

  // Mostrar la lista de pedidos
  document.getElementById("listaPedidosBtn").addEventListener("click", () => {
    mostrarSeccion("listaPedidos");
    showOrdersList();
  });

  // Guardar un nuevo cliente
  document.getElementById("guardarClienteBtn").addEventListener("click", () => {
    saveClient();
  });

  // Agregar un producto a un pedido
  document.getElementById("agregarProductoBtn").addEventListener("click", () => {
    addProductToOrder();
  });

  // Confirmar un pedido
  document.getElementById("confirmarPedidoBtn").addEventListener("click", () => {
    confirmOrder();
  });

  // Mostrar detalles del pedido
  document.querySelector("#pedidosTable tbody").addEventListener("click", (e) => {
    if (e.target.classList.contains("pedido-id")) {
      const pedidoId = e.target.getAttribute("data-pedido-id");
      showOrderDetails(pedidoId);
    }
  });

  // Volver a la lista de pedidos
  document.getElementById("volverListaPedidos").addEventListener("click", () => {
    mostrarSeccion("listaPedidos");
    showOrdersList();
  });

  // Mostrar pedidos del cliente
  document
    .querySelector("#clientesTable tbody")
    .addEventListener("click", (e) => {
      if (e.target.classList.contains("clienteLink")) {
        const clienteId = e.target.getAttribute("data-id");
        const clienteNombre = e.target.textContent;
        showClientOrders(clienteId, clienteNombre);
      }
    });

  // Maneja el botón "Cerrar Scanner"
  document
    .getElementById("closeScannerBtn")
    .addEventListener("click", () => {
      scanner.stop();
      document.getElementById("scanner-container").style.display = "none";
    });
});

// Función para escanear un código de barras
function scanBarcode(code) {
  // Buscar producto por código de barras
  const product = findProductByBarcode(code);

  if (product) {
    // Si se encuentra el producto, muestra su información
    document.getElementById("description").value = product.description;
    document.getElementById("stock").value = product.stock;
    document.getElementById("price").value = product.price;
    document.getElementById("product-image").src = product.image || "";
    document.getElementById("product-image-container").style.display =
      product.image ? "block" : "none";
  } else {
    // Si no se encuentra el producto, muestra un mensaje
    alert("Producto no encontrado.");
  }
}

// Función para buscar un producto por código de barras
function searchProduct(barcode) {
  // Buscar producto por código de barras
  const product = findProductByBarcode(barcode);

  if (product) {
    // Si se encuentra el producto, muestra su información
    document.getElementById("description").value = product.description;
    document.getElementById("stock").value = product.stock;
    document.getElementById("price").value = product.price;
    document.getElementById("product-image").src = product.image || "";
    document.getElementById("product-image-container").style.display =
      product.image ? "block" : "none";
  } else {
    // Si no se encuentra el producto, muestra un mensaje
    alert("Producto no encontrado.");
  }
}

// Función para guardar un producto
function saveProduct(barcode, description, stock, price) {
  // Crea un nuevo producto
  const newProduct = {
    barcode: barcode,
    description: description,
    stock: stock,
    price: price,
    image: "", // Agrega una imagen por defecto
  };

  // Guarda el producto en la base de datos local
  saveProductToLocalStorage(newProduct);

  // Actualiza la lista de productos
  loadProducts();
  showProductsList();

  // Limpia el formulario
  clearForm();
}

// Función para guardar un producto en localStorage
function saveProductToLocalStorage(product) {
  let products = getProductsFromLocalStorage();
  products.push(product);
  localStorage.setItem("products", JSON.stringify(products));
}

// Función para obtener los productos de localStorage
function getProductsFromLocalStorage() {
  const products = localStorage.getItem("products");
  return products ? JSON.parse(products) : [];
}

// Función para encontrar un producto por código de barras
function findProductByBarcode(barcode) {
  const products = getProductsFromLocalStorage();
  return products.find((p) => p.barcode === barcode);
}

// Función para exportar los productos a Excel
function exportToExcel() {
  const products = getProductsFromLocalStorage();

  // Crea un nuevo libro de trabajo de Excel
  const workbook = XLSX.utils.book_new();

  // Crea una hoja de cálculo para los productos
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Código de Barras", "Descripción", "Stock", "Precio"],
    ...products.map((product) => [
      product.barcode,
      product.description,
      product.stock,
      product.price,
    ]),
  ]);

  // Agrega la hoja de cálculo al libro de trabajo
  XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");

  // Descarga el libro de trabajo como un archivo Excel
  XLSX.writeFile(workbook, "productos.xlsx");
}

// Función para importar productos desde Excel
function importFromExcel(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const products = XLSX.utils.sheet_to_json(worksheet);

    // Guarda los productos en la base de datos local
    products.forEach((product) => {
      saveProductToLocalStorage(product);
    });

    // Actualiza la lista de productos
    loadProducts();
    showProductsList();
  };
  reader.readAsArrayBuffer(file);
}

// Función para mostrar los productos con stock bajo
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

// Función para limpiar el formulario
function clearForm() {
  document.getElementById("description").value = "";
  document.getElementById("stock").value = "";
  document.getElementById("price").value = "";
  document.getElementById("barcode").value = "";
  document.getElementById("product-image-container").style.display = "none";
}

// Función para mostrar la lista de productos
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

// Función para cargar los productos de la base de datos local
function loadProducts() {
  const products = getProductsFromLocalStorage();

  // Mostrar la lista de productos
  showProductsList();
}

// Función para obtener los clientes de localStorage
function getClientsFromLocalStorage() {
  const clients = localStorage.getItem("clients");
  return clients ? JSON.parse(clients) : [];
}

// Función para guardar un nuevo cliente
function saveClient() {
  const nombre = document.getElementById("nombreCliente").value;
  const apellido = document.getElementById("apellidoCliente").value;
  const direccion = document.getElementById("direccionCliente").value;
  const telefono = document.getElementById("telefonoCliente").value;
  const email = document.getElementById("emailCliente").value;

  const newClient = {
    id: generateClientId(),
    nombre: nombre,
    apellido: apellido,
    direccion: direccion,
    telefono: telefono,
    email: email,
  };

  saveClientToLocalStorage(newClient);

  // Actualiza la lista de clientes
  loadClients();
  showClientsList();

  // Limpia el formulario
  clearClientForm();
}

// Función para generar un ID de cliente
function generateClientId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
    option.value = client.id;
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
            <td><a href="#" class="clienteLink" data-id="${client.id}">${client.nombre} ${client.apellido}</a>
