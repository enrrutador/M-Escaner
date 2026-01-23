# 📋 TEST MANUAL - Inventory Scanner Pro v3.1

## URL de la Aplicación
https://enrrutador.github.io/M-Escaner/

---

## ✅ CHECKLIST DE PRUEBAS

### 1. CARGA INICIAL
- [ ] La página carga sin errores
- [ ] Se muestra el título "Inventory Scanner Pro"
- [ ] El dashboard muestra 3 tarjetas principales
- [ ] No hay warnings en la consola del navegador

### 2. DASHBOARD
- [ ] **Tarjeta 1**: "Inventario Total" - muestra "X productos"
- [ ] **Tarjeta 2**: "Productos Bajos" - muestra "X items" con badge "Alerta"
- [ ] **Tarjeta 3**: "Último Escaneado" - muestra código/nombre con badge "OK"
- [ ] Las tarjetas tienen animación al cargar (slideUp)
- [ ] Al hacer hover, las tarjetas se elevan ligeramente

### 3. MENÚ LATERAL
- [ ] Click en botón hamburguesa (☰) abre el menú
- [ ] El menú se desliza suavemente desde la izquierda
- [ ] El contenido principal se escala y desplaza
- [ ] Opciones visibles:
  - [ ] Categorías
  - [ ] Importar/Exportar
  - [ ] Reportes
  - [ ] Historial
- [ ] Click nuevamente en hamburguesa cierra el menú

### 4. BÚSQUEDA
- [ ] Barra de búsqueda visible en la parte superior
- [ ] Se puede escribir texto
- [ ] Click en "Buscar" abre modal con resultados
- [ ] Si no hay resultados, muestra mensaje apropiado

### 5. SCANNER (CRÍTICO)
#### Apertura
- [ ] Click en botón flotante azul (esquina inferior derecha)
- [ ] La vista del scanner se abre en pantalla completa
- [ ] Fondo negro con cámara activa
- [ ] **ESTÉTICA**: No se ven botones grises de html5-qrcode
- [ ] **ESTÉTICA**: Hay una línea roja/rosa animada moviéndose verticalmente
- [ ] **ESTÉTICA**: El área de escaneo es proporcional y centrada

#### Controles
- [ ] Botón "Cancelar" visible y funcional
- [ ] Botón "Linterna" visible
- [ ] Botón "Galería" visible
- [ ] Los botones tienen el estilo de la app (texto blanco, fondo transparente)

#### Funcionalidad
- [ ] La cámara inicia en menos de 2 segundos
- [ ] No hay pantalla negra
- [ ] No hay warnings de Canvas2D en consola
- [ ] Al detectar un código de barras:
  - [ ] Se cierra el scanner automáticamente
  - [ ] Se abre el modal de "Detalles del Producto"
  - [ ] El código aparece en el campo "Código de Barras"

### 6. MODAL DE PRODUCTO
- [ ] El modal aparece centrado con animación
- [ ] Campos visibles:
  - [ ] Código de Barras (readonly)
  - [ ] Descripción del Producto
  - [ ] Stock
  - [ ] Precio
- [ ] Botón "Generar Código" funciona
- [ ] Se genera un código aleatorio que empieza con "770"
- [ ] Aparece preview del código de barras (imagen SVG)
- [ ] Botón "Guardar" funciona
- [ ] Botón "Cancelar" cierra el modal

### 7. MODALES DE INVENTARIO
#### Al hacer click en "Inventario Total"
- [ ] Se abre modal con lista de todos los productos
- [ ] Cada producto muestra: nombre, código, stock
- [ ] Hay un botón "Editar" por producto
- [ ] Los productos con stock ≤ 5 tienen borde rojo
- [ ] Los productos con stock > 5 tienen borde verde

#### Al hacer click en "Productos Bajos"
- [ ] Se abre modal solo con productos de stock ≤ 5
- [ ] Formato igual al anterior

#### Al hacer click en "Último Escaneado"
- [ ] Se abre modal con los últimos 10 productos
- [ ] Ordenados del más reciente al más antiguo

### 8. GUARDADO DE PRODUCTOS
- [ ] Escanear/generar un código
- [ ] Llenar descripción, stock y precio
- [ ] Click en "Guardar"
- [ ] Aparece notificación verde "¡Producto guardado!"
- [ ] El modal se cierra
- [ ] El dashboard se actualiza con los nuevos números

### 9. NOTIFICACIONES
- [ ] Las notificaciones aparecen en la esquina superior derecha
- [ ] Tienen animación de entrada (fadeIn + slideDown)
- [ ] Desaparecen automáticamente después de 3 segundos
- [ ] Colores correctos:
  - [ ] Verde para éxito
  - [ ] Naranja/rojo para error

### 10. RESPONSIVE (MÓVIL)
- [ ] La app se ve bien en pantalla de celular
- [ ] No hay elementos cortados
- [ ] Los botones son fáciles de presionar
- [ ] El scanner ocupa toda la pantalla
- [ ] Los modales no se salen de la pantalla

---

## 🐛 PROBLEMAS ENCONTRADOS

### Críticos (Bloquean funcionalidad)
```
1. 
2. 
3. 
```

### Menores (Estéticos o de UX)
```
1. 
2. 
3. 
```

### Sugerencias de Mejora
```
1. 
2. 
3. 
```

---

## 📊 RESULTADO FINAL

**Estado General**: [ ] ✅ APROBADO  [ ] ⚠️ CON OBSERVACIONES  [ ] ❌ RECHAZADO

**Comentarios**:
```


```

---

## 🔧 INFORMACIÓN TÉCNICA

- **Versión**: 3.1 INDUSTRIAL
- **Librería de Scanner**: html5-qrcode v2.3.8
- **Navegador de Prueba**: 
- **Dispositivo**: 
- **Fecha de Prueba**: 
- **Probado por**: 

---

## ✨ CARACTERÍSTICAS DESTACADAS v3.1

1. **Scanner Industrial**: Reemplazo de Quagga por html5-qrcode
2. **Sin Warnings**: Eliminado el problema de Canvas2D
3. **Estética Personalizada**: UI del scanner completamente integrada
4. **Línea de Escaneo**: Animación visual para feedback del usuario
5. **Área Responsiva**: El cuadro de escaneo se adapta al tamaño de pantalla
6. **Detección Rápida**: 10 FPS optimizados
7. **Multi-formato**: EAN-13, EAN-8, CODE-128, CODE-39, UPC-A, UPC-E
