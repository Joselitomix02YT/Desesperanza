let carrito = [];
let sesionActiva = false;
let usuarioActual = null;

// Toggle menú móvil
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
        
        // Cerrar menú al hacer click en un enlace
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
    }
});

// Verificar sesión al cargar la página
async function verificarSesion() {
    try {
        const response = await fetch('/api/sesion');
        const data = await response.json();
        
        if (data.loggedIn) {
            sesionActiva = true;
            usuarioActual = data.username;
            actualizarUIConSesion(data.username, data.isAdmin);
            
            // Mostrar sección "Mis Pedidos" en ambos menús
            document.getElementById('mis-pedidos-link')?.classList.remove('hidden');
            document.getElementById('mis-pedidos-link-mobile')?.classList.remove('hidden');
            document.getElementById('mis-pedidos')?.classList.remove('hidden');
            
            // Cargar pedidos del usuario
            cargarMisPedidos();
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
    }
}

// Función para cargar los pedidos del usuario
async function cargarMisPedidos() {
    try {
        const response = await fetch('/api/mis-pedidos');
        
        if (!response.ok) {
            throw new Error('Error al cargar pedidos');
        }
        
        const pedidos = await response.json();
        const container = document.getElementById('pedidos-container');
        
        if (pedidos.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-2xl text-stone-600 mb-4">📦</p>
                    <p class="text-lg text-stone-600">Aún no has realizado ningún pedido</p>
                    <a href="#productos" class="inline-block mt-6 px-6 py-3 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors">
                        Ver Productos
                    </a>
                </div>
            `;
            return;
        }
        
        // Agrupar pedidos por fecha (hasta el minuto)
        const pedidosAgrupados = {};
        pedidos.forEach(pedido => {
            const fechaObj = new Date(pedido.fecha_pedido);
            
            // Crear clave agrupando por fecha hasta el minuto
            const fechaKey = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth()+1).padStart(2,'0')}-${String(fechaObj.getDate()).padStart(2,'0')} ${String(fechaObj.getHours()).padStart(2,'0')}:${String(fechaObj.getMinutes()).padStart(2,'0')}`;
            
            if (!pedidosAgrupados[fechaKey]) {
                pedidosAgrupados[fechaKey] = {
                    fecha: fechaObj.toLocaleString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    fecha_raw: pedido.fecha_pedido,
                    items: [],
                    total: 0
                };
            }
            
            pedidosAgrupados[fechaKey].items.push(pedido);
            pedidosAgrupados[fechaKey].total += parseFloat(pedido.precio) * parseInt(pedido.cantidad);
        });
        
        // Convertir a array y ordenar por fecha descendente
        const pedidosArray = Object.values(pedidosAgrupados).sort((a, b) => 
            new Date(b.fecha_raw) - new Date(a.fecha_raw)
        );
        
        // Mostrar pedidos agrupados
        container.innerHTML = pedidosArray.map((grupo, index) => `
            <div class="bg-white border border-gray-100 p-6 mb-6">
                <div class="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                    <div>
                        <h3 class="text-lg">Pedido #${pedidosArray.length - index}</h3>
                        <p class="text-xs opacity-60">${grupo.fecha}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs opacity-60 mb-1">Total</p>
                        <p class="text-2xl">$${grupo.total.toFixed(2)}</p>
                    </div>
                </div>
                
                <div class="space-y-3">
                    ${grupo.items.map(item => `
                        <div class="flex justify-between items-center py-2 border-b border-gray-50">
                            <div class="flex-1">
                                <p class="text-sm">${item.nombre}</p>
                                <p class="text-xs opacity-60">Cantidad: ${item.cantidad}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-sm">$${parseFloat(item.precio).toFixed(2)} c/u</p>
                                <p class="text-xs opacity-60">$${(parseFloat(item.precio) * parseInt(item.cantidad)).toFixed(2)}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-4 flex justify-end">
                    <button class="ticket-btn px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors" 
                            data-pedido-index="${index}"
                            data-pedido-numero="${pedidosArray.length - index}"
                            data-fecha="${grupo.fecha}"
                            data-total="${grupo.total.toFixed(2)}"
                            data-items='${JSON.stringify(grupo.items)}'
                            title="Mostrar ticket">
                        Mostrar Ticket 🧾
                    </button>
                    <button onclick="imprimirTicket(${index})" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            Imprimir 🖨️
                        </button>
                </div>
                
                <div id="area-ticket-${index}" class="area-ticket hidden mt-4 border border-stone-300 p-5 bg-white font-mono text-sm">
                </div>
            </div>
        `).join('');

        // Agregar event listeners a los botones de ticket
        document.querySelectorAll('.ticket-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pedidoIndex = btn.dataset.pedidoIndex;
                const pedidoNumero = btn.dataset.pedidoNumero;
                const fecha = btn.dataset.fecha;
                const total = btn.dataset.total;
                const items = JSON.parse(btn.dataset.items);
                
                const areaTicket = document.getElementById(`area-ticket-${pedidoIndex}`);
                
                // Generar la lista de artículos
                let itemsHTML = items.map(item => 
                    `<li>${item.nombre} - ${item.cantidad} x $${parseFloat(item.precio).toFixed(2)} = $${(parseFloat(item.precio) * parseInt(item.cantidad)).toFixed(2)}</li>`
                ).join('');

                let contenidoHTML = `
                    <h3 style="text-align: center;">--- Recibo de Compra ---</h3>
                    <p>Pedido #${pedidoNumero}</p>
                    <p>Fecha: ${fecha}</p>
                    <p>Cliente: ${usuarioActual || 'Usuario'}</p>
                    <p>-------------------------</p>
                    <h4>Artículos:</h4>
                    <ul style="list-style: none; padding: 0;">
                        ${itemsHTML}
                    </ul>
                    <p>-------------------------</p>
                    <h4>Total: $${total}</h4>
                    <p style="text-align: center;">--- ¡Gracias por su compra! ---</p>
                `;

                areaTicket.innerHTML = contenidoHTML;
                areaTicket.classList.remove('hidden');
            });
        });
        
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        document.getElementById('pedidos-container').innerHTML = `
            <div class="text-center py-12">
                <p class="text-red-600">Error al cargar tus pedidos. Intenta recargar la página.</p>
            </div>
        `;
    }
}

function generarDatosDelTicket(i, i_n,i_p,i_c, i_u) {
    // Simulación de datos de compra
    const datosDeCompra = {
        idTransaccion: i,
        fecha: new Date().toLocaleString(),
        cliente: i_u,
        articulos: [
            { nombre: i_n, cantidad: i_c, precio: i_p },
            { nombre: i_n, cantidad: i_c, precio: i_p }
        ],
    };
    console.log('Datos del ticket generados:', datosDeCompra);
    return datosDeCompra;
}

function imprimirTicket(pedidoIndex) {
    const elementosAImprimir = document.getElementById(`area-ticket-${pedidoIndex}`);
    
    if (!elementosAImprimir) {
        console.error('No se encontró el ticket para imprimir');
        return;
    }
    
    const contenidoOriginal = document.body.innerHTML;

    document.body.innerHTML = elementosAImprimir.innerHTML;

    // Abre el diálogo de impresión del navegador
    window.print();

    document.body.innerHTML = contenidoOriginal;
    
    // Recargar para restaurar los event listeners
    location.reload();
}



// Actualizar UI cuando hay sesión activa
async function actualizarUIConSesion(username, isAdmin) {
    const sesionContainer = document.getElementById('sesion-container');
    const sesionContainerMobile = document.getElementById('sesion-container-mobile');
    const loginContainer = document.getElementById('login-container');
    
    // Reemplazar botón de login por botón de usuario y cerrar sesión (DESKTOP)
    sesionContainer.innerHTML = `
        <div class="flex items-center gap-6">
            <span class="opacity-60 text-xs tracking-wider uppercase">${username}</span>
            ${isAdmin ? '<a href="/index2.html" class="px-6 py-3 bg-black text-white hover:opacity-80 transition text-xs tracking-wider">ADMIN</a>' : ''}
            <button id="logout-btn" class="px-6 py-3 border border-gray-200 hover:bg-gray-50 transition text-xs tracking-wider">
                SALIR
            </button>
        </div>
    `;

    // Actualizar menú MÓVIL
    if (sesionContainerMobile) {
        sesionContainerMobile.innerHTML = `
            <div class="flex flex-col gap-3">
                <span class="block opacity-60 text-xs tracking-wider uppercase py-2">${username}</span>
                ${isAdmin ? '<a href="/index2.html" class="block px-6 py-3 bg-black text-white hover:opacity-80 transition text-xs tracking-wider text-center">ADMIN</a>' : ''}
                <button id="logout-btn-mobile" class="w-full px-6 py-3 border border-gray-200 hover:bg-gray-50 transition text-xs tracking-wider">
                    SALIR
                </button>
            </div>
        `;
    }

    
    // Ocultar formulario de login
    if (loginContainer) {
        // Obtener fondos de forma asíncrona
        const fondos = await obtenerFondos();
        
        loginContainer.innerHTML = `
            <div class="text-center max-w-2xl mx-auto">
                <h3 class="text-4xl sm:text-5xl tracking-tighter mb-6">Bienvenido, ${username}</h3>
                <p class="opacity-60 mb-12 text-lg">Tu sesión está activa</p>
                
                <a href="#mis-pedidos" class="inline-block px-8 py-4 bg-black text-white hover:opacity-80 transition text-xs tracking-wider mb-8">
                    VER MIS PEDIDOS
                </a>
                
                <div class="my-12 pt-12 border-t border-gray-100">
                    <p class="text-xs uppercase tracking-[0.3em] opacity-30 mb-4">Saldo disponible</p>
                    <p class="text-5xl sm:text-6xl tracking-tight mb-8">$${fondos.toFixed(2)}</p>
                    <button onclick="AgregarFondos()" class="px-8 py-4 border border-gray-200 hover:bg-gray-50 transition text-xs tracking-wider">
                        AGREGAR FONDOS
                    </button>
                </div>
                
                ${isAdmin ? '<a href="/index2.html" class="inline-block px-8 py-4 bg-black text-white hover:opacity-80 transition text-xs tracking-wider mt-8">PANEL ADMIN</a>' : ''}
            </div>
        `;
    }

    // Agregar evento al botón de cerrar sesión (desktop y móvil)
    document.getElementById('logout-btn')?.addEventListener('click', cerrarSesion);
    document.getElementById('logout-btn-mobile')?.addEventListener('click', cerrarSesion);
}

async function obtenerFondos() {
    try {
        const response = await fetch('/api/usuario/fondos');
        
        if (!response.ok) {
            throw new Error('Error al obtener fondos');
        }
        
        const data = await response.json();
        console.log('Fondos del usuario:', data.fondos);
        return data.fondos;
    } catch (error) {
        console.error('Error al obtener fondos:', error);
        return 0;
    }
}

// Función para abrir el modal de agregar fondos
function AgregarFondos() {
    document.getElementById('fondos-modal').classList.remove('hidden');
}

// Cerrar modal de fondos
document.getElementById('cerrar-fondos')?.addEventListener('click', function() {
    document.getElementById('fondos-modal').classList.add('hidden');
    document.getElementById('fondosForm').reset();
    document.getElementById('mensaje-fondos').classList.add('hidden');
});

// Cerrar modal al hacer clic fuera
document.getElementById('fondos-modal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        this.classList.add('hidden');
        document.getElementById('fondosForm').reset();
        document.getElementById('mensaje-fondos').classList.add('hidden');
    }
});

// Manejo del formulario de agregar fondos
document.getElementById('fondosForm')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const cantidad = document.getElementById('cantidad-fondos').value;
    const fondosButton = document.getElementById('fondosButton');
    const mensajeDiv = document.getElementById('mensaje-fondos');
    
    fondosButton.disabled = true;
    fondosButton.textContent = 'Procesando...';
    fondosButton.classList.add('opacity-50', 'cursor-not-allowed');
    mensajeDiv.classList.add('hidden');
    
    try {
        const response = await fetch('/api/usuario/agregar-fondos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cantidad: parseFloat(cantidad) })
        });

        const data = await response.json();
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.textContent = data.mensaje || data.error || 'Ocurrió un error';
        
        if (response.ok) {
            mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-green-100 text-green-800 border border-green-300';
            document.getElementById('fondosForm').reset();
            
            // Recargar la página después de 1.5 segundos para mostrar los fondos actualizados
            setTimeout(function() {
                location.reload();
            }, 1500);
        } else {
            mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-red-100 text-red-800 border border-red-300';
        }
    } catch (error) {
        console.error('Error:', error);
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-red-100 text-red-800 border border-red-300';
        mensajeDiv.textContent = 'Error al conectar con el servidor';
    } finally {
        fondosButton.disabled = false;
        fondosButton.textContent = 'Agregar Fondos';
        fondosButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
});

// Función para cerrar sesión
async function cerrarSesion() {
    if (!confirm('¿Estás seguro de cerrar sesión?')) {
        return;
    }

    try {
        const response = await fetch('/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            mostrarNotificacion('Sesión cerrada correctamente');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        alert('Error al cerrar sesión');
    }
}

// Llamar a verificarSesion al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    verificarSesion();
    cargarProductos();
});

// Abrir/Cerrar modal de registro
document.getElementById('mostrar-registro')?.addEventListener('click', function() {
    document.getElementById('registro-modal').classList.remove('hidden');
});

document.getElementById('cerrar-registro').addEventListener('click', function() {
    document.getElementById('registro-modal').classList.add('hidden');
    document.getElementById('registroForm').reset();
    document.getElementById('mensaje-registro').classList.add('hidden');
});

// Cerrar modal al hacer clic fuera
document.getElementById('registro-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        this.classList.add('hidden');
        document.getElementById('registroForm').reset();
        document.getElementById('mensaje-registro').classList.add('hidden');
    }
});

// Manejo del formulario de registro
document.getElementById('registroForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;
    const registroButton = document.getElementById('registroButton');
    const mensajeDiv = document.getElementById('mensaje-registro');
    
    // Validar que las contraseñas coincidan
    if (password !== passwordConfirm) {
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-red-100 text-red-800 border border-red-300';
        mensajeDiv.textContent = 'Las contraseñas no coinciden';
        return;
    }

    // Deshabilitar botón
    registroButton.disabled = true;
    registroButton.textContent = 'Registrando...';
    registroButton.classList.add('opacity-50', 'cursor-not-allowed');
    
    // Limpiar mensaje anterior
    mensajeDiv.classList.add('hidden');
    
    try {
        const response = await fetch('/registro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username: username, 
                password: password 
            })
        });

        const data = await response.json();
        const mensaje = data.mensaje || data.error || 'Ocurrió un error';
        
        // Mostrar mensaje
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.textContent = mensaje;
        
        if (response.ok) {
            // Registro exitoso
            mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-green-100 text-green-800 border border-green-300';
            
            // Limpiar formulario
            document.getElementById('registroForm').reset();
            
            // Cerrar modal después de 2 segundos
            setTimeout(function() {
                document.getElementById('registro-modal').classList.add('hidden');
                mensajeDiv.classList.add('hidden');
            }, 2000);
            
        } else {
            // Registro fallido
            mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-red-100 text-red-800 border border-red-300';
        }
        
    } catch (error) {
        console.error('Error:', error);
        
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-red-100 text-red-800 border border-red-300';
        mensajeDiv.textContent = 'Error al conectar con el servidor';
    } finally {
        // Rehabilitar botón SIEMPRE
        registroButton.disabled = false;
        registroButton.textContent = 'Registrarse';
        registroButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
});

// Función para agregar producto al carrito CON VALIDACIÓN DE STOCK
function agregarAlCarrito(id, nombre, precio, imagen_url, cantidadDisponible) {
    const productoExistente = carrito.find(item => item.id === id);
    
    if (productoExistente) {
        // Verificar si hay stock suficiente antes de incrementar
        if (productoExistente.cantidad >= cantidadDisponible) {
            alert(`No hay más stock disponible de ${nombre}. Solo quedan ${cantidadDisponible} unidades.`);
            return;
        }
        productoExistente.cantidad++;
    } else {
        // Verificar stock disponible antes de agregar
        if (cantidadDisponible <= 0) {
            alert(`${nombre} está agotado.`);
            return;
        }
        
        carrito.push({
            id: id,
            nombre: nombre,
            precio: parseFloat(precio),
            imagen_url: imagen_url,
            cantidad: 1,
            cantidadDisponible: cantidadDisponible
        });
    }
    
    actualizarCarrito();
    mostrarNotificacion(`${nombre} agregado al carrito`);
}

// Función para actualizar el carrito visual
function actualizarCarrito() {
    const carritoItems = document.getElementById('carrito-items');
    const carritoCounts = document.querySelectorAll('.carrito-count');
    const totalProductos = document.getElementById('total-productos');
    const totalPrecio = document.getElementById('total-precio');
    
    // Calcular totales
    const cantidadTotal = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    const precioTotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    // Actualizar badge del carrito (ambos: mobile y desktop)
    carritoCounts.forEach(carritoCount => {
        if (cantidadTotal > 0) {
            carritoCount.textContent = cantidadTotal;
            carritoCount.classList.remove('hidden');
        } else {
            carritoCount.classList.add('hidden');
        }
    });
    
    // Actualizar totales
    totalProductos.textContent = cantidadTotal;
    totalPrecio.textContent = `$${precioTotal.toFixed(2)}`;
    
    // Actualizar lista de items
    if (carrito.length === 0) {
        carritoItems.innerHTML = '<p class="text-center opacity-60">El carrito está vacío</p>';
    } else {
        carritoItems.innerHTML = carrito.map(item => `
            <div class="flex items-center gap-4 border-b border-gray-100 pb-4">
                <img src="${item.imagen_url || 'https://via.placeholder.com/80'}" 
                     alt="${item.nombre}" 
                     class="w-12 h-12 object-cover"
                     onerror="this.src='https://via.placeholder.com/80'">
                <div class="flex-1">
                    <h4 class="text-sm mb-1">${item.nombre}</h4>
                    <p class="text-xs opacity-60">$${item.precio.toFixed(2)} x ${item.cantidad}</p>
                    <p class="text-xs opacity-40">Stock: ${item.cantidadDisponible}</p>
                    <p class="text-sm mt-1">$${(item.precio * item.cantidad).toFixed(2)}</p>
                </div>
                <div class="flex flex-col gap-1">
                    <button onclick="cambiarCantidad(${item.id}, 1)" class="px-2 py-1 bg-black text-white text-xs hover:opacity-80">+</button>
                    <button onclick="cambiarCantidad(${item.id}, -1)" class="px-2 py-1 border border-gray-200 text-xs hover:bg-gray-50">-</button>
                    <button onclick="eliminarDelCarrito(${item.id})" class="px-2 py-1 text-xs opacity-60 hover:opacity-100">×</button>
                </div>
            </div>
        `).join('');
    }
}

// Función para cambiar cantidad CON VALIDACIÓN DE STOCK
function cambiarCantidad(id, cambio) {
    const producto = carrito.find(item => item.id === id);
    if (producto) {
        const nuevaCantidad = producto.cantidad + cambio;
        
        // Validar que no exceda el stock disponible
        if (nuevaCantidad > producto.cantidadDisponible) {
            alert(`No puedes agregar más de ${producto.cantidadDisponible} unidades de ${producto.nombre}.`);
            return;
        }
        
        producto.cantidad = nuevaCantidad;
        
        if (producto.cantidad <= 0) {
            eliminarDelCarrito(id);
        } else {
            actualizarCarrito();
        }
    }
}

// Función para eliminar producto del carrito
function eliminarDelCarrito(id) {
    carrito = carrito.filter(item => item.id !== id);
    actualizarCarrito();
}

// Función para vaciar el carrito
document.getElementById('vaciar-carrito').addEventListener('click', function() {
    if (confirm('¿Estás seguro de vaciar el carrito?')) {
        carrito = [];
        actualizarCarrito();
        mostrarNotificacion('Carrito vaciado');
    }
});

// Función para guardar carrito en base de datos (ACTUALIZADA)
document.getElementById('guardar-carrito').addEventListener('click', async function() {
    if (carrito.length === 0) {
        alert('El carrito está vacío');
        return;
    }

    // Verificar si hay sesión activa
    if (!sesionActiva) {
        alert('Debes iniciar sesión para realizar un pedido');
        // Scroll hacia el formulario de login
        document.getElementById('loginForm')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    if (!confirm('¿Deseas hacer tu compra?')) {
        return;
    }

    try {
        const response = await fetch('/api/carrito/guardar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productos: carrito })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`${data.mensaje}\n\nTotal gastado: $${data.totalGastado}\nFondos restantes: $${data.fondosRestantes}\n\n¡Gracias por tu pedido, ${usuarioActual}!`);
            carrito = [];
            actualizarCarrito();
            cerrarCarritoPanel();
            await cargarProductos();
            
            // Recargar pedidos del usuario
            await cargarMisPedidos();
            
            // Recargar página para actualizar fondos
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            // Mostrar mensaje de error específico
            if (data.error === 'Fondos insuficientes') {
                alert(`❌ ${data.mensaje}\n\nTe faltan: $${data.faltante}\n\nPor favor, agrega fondos a tu cuenta antes de continuar.`);
            } else {
                alert(data.error || 'Error al guardar el pedido');
            }
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Error al conectar con el servidor');
    }
});

// Función para mostrar notificación
function mostrarNotificacion(mensaje) {
    const notif = document.createElement('div');
    notif.className = 'fixed top-20 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notif.textContent = mensaje;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.remove();
    }, 2000);
}

// Abrir/Cerrar panel del carrito
document.querySelectorAll('.carritoBtn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.getElementById('carrito-panel').classList.remove('translate-x-full');
        document.getElementById('carrito-overlay').classList.remove('hidden');
    });
});

function cerrarCarritoPanel() {
    document.getElementById('carrito-panel').classList.add('translate-x-full');
    document.getElementById('carrito-overlay').classList.add('hidden');
}

document.getElementById('cerrar-carrito').addEventListener('click', cerrarCarritoPanel);
document.getElementById('carrito-overlay').addEventListener('click', cerrarCarritoPanel);

// Función para cargar productos desde la base de datos
async function cargarProductos() {
    try {
        const response = await fetch('/api/productos');
        
        if (!response.ok) {
            throw new Error('Error al cargar productos');
        }
        
        const productos = await response.json();
        const container = document.getElementById('productos-container');
        
        // Limpiar contenedor
        container.innerHTML = '';
        
        // Crear tarjeta para cada producto
        productos.forEach(producto => {
            const article = document.createElement('article');
            article.className = 'group';
            
            const cantidadDisponible = producto.cantidad || 0;
            const agotado = cantidadDisponible <= 0;
            
            article.innerHTML = `
                <div class="aspect-square overflow-hidden bg-gray-50 relative mb-4">
                    <img src="${producto.imagen_url || 'https://via.placeholder.com/400?text=Sin+Imagen'}" 
                         alt="${producto.nombre}" 
                         class="w-full h-full object-cover group-hover:opacity-80 transition ${agotado ? 'opacity-30' : ''}"
                         onerror="this.src='https://via.placeholder.com/400?text=Sin+Imagen'">
                    ${agotado ? '<div class="absolute inset-0 flex items-center justify-center"><span class="text-black text-sm">AGOTADO</span></div>' : ''}
                </div>
                <div>
                    <h3 class="text-lg mb-1">${producto.nombre}</h3>
                    <p class="text-sm opacity-60 mb-3">${producto.descripcion || 'Sin descripción'}</p>
                    
                    <p class="text-xs mb-3 ${agotado ? 'opacity-40' : 'opacity-60'}">
                        ${agotado ? 'Sin stock' : `Stock: ${cantidadDisponible}`}
                    </p>
                    
                    <div class="flex justify-between items-center mb-3">
                        <p class="text-xl">$${parseFloat(producto.precio).toFixed(2)}</p>
                    </div>
                    
                    <button 
                        onclick='agregarAlCarrito(${producto.id}, "${producto.nombre.replace(/'/g, "\\'")}", ${producto.precio}, "${producto.imagen_url || ''}", ${cantidadDisponible})' 
                        class="w-full px-4 py-3 text-sm transition ${agotado ? 'bg-gray-200 cursor-not-allowed opacity-50' : 'bg-black hover:opacity-80'} text-white"
                        ${agotado ? 'disabled' : ''}>
                        ${agotado ? 'Agotado' : 'Agregar'}
                    </button>
                </div>
            `;
            
            container.appendChild(article);
        });
        
        if (productos.length === 0) {
            container.innerHTML = '<p class="text-center text-stone-600 col-span-full text-lg">No hay productos disponibles en este momento.</p>';
        }
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('productos-container').innerHTML = 
            '<p class="text-center text-red-600 col-span-full text-lg">Error al cargar los productos. Intenta recargar la página.</p>';
    }
}

// Manejo del login
document.getElementById('loginForm')?.addEventListener('submit', function(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginButton = document.getElementById('loginButton');
    const mensajeDiv = document.getElementById('mensaje');
    
    loginButton.disabled = true;
    loginButton.textContent = 'Iniciando sesión...';
    loginButton.classList.add('opacity-50', 'cursor-not-allowed');
    
    mensajeDiv.classList.add('hidden');
    
    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(function(response) {
        return response.json().then(function(data) {
            return { status: response.status, data: data };
        });
    })
    .then(function(result) {
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.textContent = result.data.mensaje;
        
        if (result.status === 200) {
            mensajeDiv.className = 'mb-6 p-4 border border-gray-200 bg-gray-50 text-sm tracking-wide';
            
            setTimeout(function() {
                window.location.href = result.data.redirect;
            }, 500);
            
        } else {
            mensajeDiv.className = 'mb-6 p-4 border border-black bg-white text-sm tracking-wide';
            
            loginButton.disabled = false;
            loginButton.textContent = 'Entrar';
            loginButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    })
    .catch(function(error) {
        console.error('Error:', error);
        
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.className = 'mb-6 p-4 border border-black bg-white text-sm tracking-wide';
        mensajeDiv.textContent = 'Error al conectar con el servidor. Intenta nuevamente.';
        
        loginButton.disabled = false;
        loginButton.textContent = 'Entrar';
        loginButton.classList.remove('opacity-50', 'cursor-not-allowed');
    });
});

// Función para obtener fondos del usuario
async function obtenerFondos() {
    try {
        const response = await fetch('/api/usuario/fondos');
        
        if (!response.ok) {
            console.error('Error al obtener fondos');
            return 0;
        }
        
        const data = await response.json();
        return data.fondos || 0;
    } catch (error) {
        console.error('Error:', error);
        return 0;
    }
}

// Función para agregar fondos
async function AgregarFondos() {
    const cantidad = prompt('¿Cuánto deseas agregar a tus fondos? (MXN)');
    
    if (cantidad === null || cantidad.trim() === '') {
        return;
    }
    
    const cantidadNumerica = parseFloat(cantidad);
    
    if (isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
        alert('Por favor ingresa una cantidad válida mayor a 0');
        return;
    }
    
    try {
        const response = await fetch('/api/usuario/agregar-fondos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cantidad: cantidadNumerica })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`¡Fondos agregados exitosamente! Nuevo saldo: $${data.nuevosFondos.toFixed(2)} MXN`);
            window.location.reload();
        } else {
            alert('Error al agregar fondos: ' + (data.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al conectar con el servidor');
    }
}

window.agregarAlCarrito = agregarAlCarrito;
window.eliminarDelCarrito = eliminarDelCarrito;
window.AgregarFondos = AgregarFondos;
