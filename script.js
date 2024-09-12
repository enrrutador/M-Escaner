import { auth, database } from './firebaseConfig.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { ref, set, get, push, child } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

// Clase ProductDatabase (mantener el código existente)

// Función para obtener o generar un ID de dispositivo único
function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

// Función para vincular el ID del dispositivo al usuario en Realtime Database
async function linkDeviceToUser(userId, deviceId) {
    const userRef = ref(database, `users/${userId}`);
    await set(userRef, { deviceId, lastLogin: new Date().toISOString() });
}

// Función para obtener el ID del dispositivo vinculado desde Realtime Database
async function getUserDevice(userId) {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    return snapshot.exists() ? snapshot.val() : null;
}

// Manejar el formulario de inicio de sesión
const loginForm = document.getElementById('loginForm');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const deviceId = getDeviceId();

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Recuperar el ID del dispositivo vinculado desde Realtime Database
        const userDoc = await getUserDevice(user.uid);

        if (userDoc && userDoc.deviceId) {
            // Si ya existe un dispositivo vinculado
            if (userDoc.deviceId !== deviceId) {
                // Si el dispositivo actual no coincide con el vinculado, denegar acceso
                await auth.signOut();
                loginError.textContent = 'Acceso denegado. Esta cuenta está vinculada a otro dispositivo.';
                return;
            }
        } else {
            // Si es la primera vez que se inicia sesión, vincular el dispositivo
            await linkDeviceToUser(user.uid, deviceId);
        }

        console.log('Usuario autenticado:', user);
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
    } catch (error) {
        console.error('Error de autenticación:', error.code, error.message);
        loginError.textContent = 'Error al iniciar sesión. Verifica tu correo y contraseña.';
    }
});

// Función para cargar clientes
async function cargarClientes() {
    const clientesRef = ref(database, 'clientes');
    const snapshot = await get(clientesRef);
    const clienteSelect = document.getElementById('cliente-select');
    clienteSelect.innerHTML = '<option value="">Seleccione un cliente</option>';
    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const cliente = childSnapshot.val();
            const option = document.createElement('option');
            option.value = childSnapshot.key;
            option.textContent = `${cliente.nombre} ${cliente.apellido}`;
            clienteSelect.appendChild(option);
        });
    }
}

// Variables y funciones para la gestión de pedidos
let pedidoActual = [];
const db = new ProductDatabase();

async function agregarProductoAPedido() {
    const barcode = document.getElementById('producto-barcode').value;
    const cantidad = parseInt(document.getElementById('producto-cantidad').value);
    
    if (!barcode || isNaN(cantidad) || cantidad <= 0) {
        alert('Por favor, ingrese un código de barras válido y una cantidad mayor que cero.');
        return;
    }
    
    const producto = await db.getProduct(barcode);
    if (!producto) {
        alert('Producto no encontrado.');
        return;
    }
    
    const subtotal = producto.price * cantidad;
    pedidoActual.push({ ...producto, cantidad, subtotal });
    actualizarTablaPedido();
    actualizarTotalPedido();
}

function actualizarTablaPedido() {
    const tbody = document.querySelector('#pedido-table tbody');
    tbody.innerHTML = '';
    pedidoActual.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.barcode}</td>
            <td>${item.description}</td>
            <td>${item.cantidad}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td>$${item.subtotal.toFixed(2)}</td>
            <td><button class="remove-item" data-index="${index}">Eliminar</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function actualizarTotalPedido() {
    const total = pedidoActual.reduce((sum, item) => sum + item.subtotal, 0);
    document.getElementById('total-pedido').textContent = total.toFixed(2);
}

async function confirmarPedido() {
    const clienteId = document.getElementById('cliente-select').value;
    if (!clienteId || pedidoActual.length === 0) {
        alert('Por favor, seleccione un cliente y agregue al menos un producto al pedido.');
        return;
    }
    
    const pedidosRef = ref(database, 'pedidos');
    const newPedidoRef = push(pedidosRef);
    const pedidoData = {
        clienteId,
        fecha: new Date().toISOString(),
        items: pedidoActual,
        total: pedidoActual.reduce((sum, item) => sum + item.subtotal, 0),
        estado: 'pendiente'
    };
    
    await set(newPedidoRef, pedidoData);
    alert('Pedido confirmado con éxito.');
    pedidoActual = [];
    actualizarTablaPedido();
    actualizarTotalPedido();
}

async function cargarListaPedidos() {
    const pedidosRef = ref(database, 'pedidos');
    const snapshot = await get(pedidosRef);
    const tbody = document.querySelector('#pedidos-table tbody');
    tbody.innerHTML = '';
    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const pedido = childSnapshot.val();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${childSnapshot.key}</td>
                <td>${pedido.clienteId}</td>
                <td>${new Date(pedido.fecha).toLocaleString()}</td>
                <td>$${pedido.total.toFixed(2)}</td>
                <td>${pedido.estado}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();

    document.getElementById('nuevo-pedido-btn').addEventListener('click', () => {
        document.getElementById('nuevo-pedido').style.display = 'block';
        document.getElementById('lista-pedidos').style.display = 'none';
        cargarClientes();
    });

    document.getElementById('lista-pedidos-btn').addEventListener('click', () => {
        document.getElementById('nuevo-pedido').style.display = 'none';
        document.getElementById('lista-pedidos').style.display = 'block';
        cargarListaPedidos();
    });

    document.getElementById('agregar-producto-btn').addEventListener('click', agregarProductoAPedido);

    document.getElementById('confirmar-pedido-btn').addEventListener('click', confirmarPedido);

    document.querySelector('#pedido-table tbody').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-item')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            pedidoActual.splice(index, 1);
            actualizarTablaPedido();
            actualizarTotalPedido();
        }
    });

    // Mantener los event listeners existentes
});

// Manejar el estado de autenticación
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        console.log('Usuario autenticado:', user);
    } else {
        loginContainer.style.display = 'block';
        appContainer.style.display = 'none';
        console.log('Usuario no autenticado');
    }
});

// Mantener el resto del código existente (funciones para escaneo, búsqueda, etc.)