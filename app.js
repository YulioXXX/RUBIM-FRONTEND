// ============================================================================
// RUBIM — app.js
// Cambios clave vs. la versión anterior:
//  1. Toda petición protegida ahora manda "Authorization: Bearer <token>".
//  2. El menú lateral se muestra/oculta según el rol — esto es SOLO cosmético,
//     la seguridad real ya la exige el backend (antes localStorage era la
//     única barrera, y era trivialmente manipulable desde la consola).
//  3. El "canal" del cliente ya no lo decide el navegador: solo se muestra
//     una vista previa; el valor real lo calcula y guarda el backend.
//  4. Módulos nuevos: Leads, Facturación, y Citas/Personal ya alineados a
//     los procesos del DFD.
// ============================================================================

// API_BASE ahora vive en config.js (compartido con login.html), cargado
// ANTES que este archivo en index.html — así solo hay que cambiar la URL
// del backend en un solo lugar cuando despliegues en la nube.

// --- SESIÓN ---
const token = localStorage.getItem('rubim_token');
const usuario = localStorage.getItem('rubim_usuario');
const rol = localStorage.getItem('rubim_rol');

document.getElementById('texto-usuario').textContent = usuario || '—';
document.getElementById('texto-rol').textContent = rol || '—';

function cerrarSesion() {
    localStorage.removeItem('rubim_token');
    localStorage.removeItem('rubim_usuario');
    localStorage.removeItem('rubim_rol');
    window.location.href = 'login.html';
}
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

// --- FETCH CON AUTENTICACIÓN ---
// Envuelve fetch() para adjuntar el token y manejar sesión expirada/ inválida
// de forma centralizada, en vez de repetir el try/catch en cada módulo.
async function fetchAutenticado(ruta, opciones = {}) {
    const headers = Object.assign(
        { 'Content-Type': 'application/json' },
        opciones.headers || {},
        token ? { 'Authorization': `Bearer ${token}` } : {}
    );

    const respuesta = await fetch(`${API_BASE}${ruta}`, { ...opciones, headers });

    if (respuesta.status === 401) {
        // Token vencido o inválido: no tiene sentido seguir, forzamos re-login.
        cerrarSesion();
        throw new Error('Sesión expirada.');
    }
    return respuesta;
}

function mostrarMensaje(idDiv, texto, tipo) {
    const div = document.getElementById(idDiv);
    div.textContent = texto;
    div.className = `mensaje-box ${tipo}`;
}

// --- PERMISOS POR MÓDULO (cosmético — oculta/deshabilita según rol) ---
const PERMISOS = {
    leads:       { ver: ['Asesor de Marketing', 'Administrador'], crear: ['Asesor de Marketing', 'Administrador'] },
    citas:       { ver: ['Secretaria', 'Administrador'], crear: ['Secretaria', 'Administrador'] },
    expedientes: { ver: ['Secretaria', 'Contador Auxiliar', 'Contador Junior', 'Contador Senior', 'Contador Gerente', 'Administrador'],
                   crear: ['Contador Auxiliar', 'Contador Junior', 'Contador Senior', 'Contador Gerente', 'Administrador'] },
    facturas:    { ver: ['Asesor Financiero', 'Secretaria', 'Administrador'], crear: ['Asesor Financiero', 'Administrador'] },
    cuentas:     { ver: ['Administrador', 'Contador Gerente'], crear: ['Administrador', 'Contador Gerente'] },
    personal:    { ver: ['Administrador'], crear: ['Administrador'] },
};

function aplicarPermisos() {
    for (const [modulo, reglas] of Object.entries(PERMISOS)) {
        const navItem = document.getElementById(`nav-${modulo}`);
        if (!navItem) continue;
        if (!reglas.ver.includes(rol)) {
            navItem.style.display = 'none';
        }
    }
    // Ocultar formularios de creación si el rol solo puede consultar
    const formulariosPorModulo = {
        leads: 'panel-form-lead', citas: 'panel-form-cita',
        expedientes: 'panel-form-expediente', facturas: 'panel-form-factura',
    };
    for (const [modulo, idPanel] of Object.entries(formulariosPorModulo)) {
        const reglas = PERMISOS[modulo];
        const panel = document.getElementById(idPanel);
        if (panel && reglas && !reglas.crear.includes(rol)) {
            panel.innerHTML = '<p class="nota-permiso">Tu rol solo tiene permiso de consulta en este módulo.</p>';
        }
    }
}

// --- NAVEGACIÓN SPA ---
function mostrarModulo(idModulo, elementoClick) {
    document.querySelectorAll('.modulo').forEach(m => m.style.display = 'none');
    const seleccionado = document.getElementById(idModulo);
    if (seleccionado) seleccionado.style.display = 'block';

    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('activo'));
    if (elementoClick) elementoClick.classList.add('activo');
}

document.querySelectorAll('.menu-item[data-modulo]').forEach(item => {
    item.addEventListener('click', () => {
        mostrarModulo(item.dataset.modulo, item);
        cargarDatosDelModulo(item.dataset.modulo);
    });
});

function cargarDatosDelModulo(idModulo) {
    const cargas = {
        'modulo-clientes': cargarClientes,
        'modulo-leads': cargarLeads,
        'modulo-citas': cargarCitas,
        'modulo-expedientes': cargarExpedientes,
        'modulo-facturas': cargarFacturas,
        'modulo-cuentas': cargarCuentas,
    };
    if (cargas[idModulo]) cargas[idModulo]();
}

// ============================================================================
// CLIENTES
// ============================================================================
const selectTipoCliente = document.getElementById('tipo_cliente');
const inputCanalPreview = document.getElementById('canal_preview');

// Vista previa únicamente — la Fuente de verdad es el backend (routers/clientes.py).
if (selectTipoCliente) {
    selectTipoCliente.addEventListener('change', function () {
        if (this.value === 'Industriales' || this.value === 'Comerciantes') {
            inputCanalPreview.value = 'Canales Altos';
        } else if (this.value === 'Particulares') {
            inputCanalPreview.value = 'Canales Bajos';
        } else {
            inputCanalPreview.value = '';
        }
    });
}

document.getElementById('form-cliente')?.addEventListener('submit', async function (event) {
    event.preventDefault();
    const datos = {
        nombre: document.getElementById('nombre').value,
        tipo_cliente: selectTipoCliente.value,
        telefono: document.getElementById('telefono').value || null,
    };
    mostrarMensaje('mensaje-cliente', 'Procesando...', 'procesando');
    try {
        const respuesta = await fetchAutenticado('/clientes/', { method: 'POST', body: JSON.stringify(datos) });
        if (respuesta.ok) {
            mostrarMensaje('mensaje-cliente', 'Cliente registrado con éxito.', 'exito');
            this.reset();
            inputCanalPreview.value = '';
            cargarClientes();
        } else {
            const err = await respuesta.json();
            mostrarMensaje('mensaje-cliente', err.detail || 'No se pudo registrar el cliente.', 'error');
        }
    } catch (e) {
        mostrarMensaje('mensaje-cliente', 'Error de conexión con el servidor.', 'error');
    }
});

async function cargarClientes() {
    const tbody = document.getElementById('tabla-clientes');
    if (!tbody) return;
    try {
        const respuesta = await fetchAutenticado('/clientes/');
        const data = await respuesta.json();
        tbody.innerHTML = data.map(c => `
            <tr>
                <td>${c.nombre} <span class="mono" style="color:var(--rubim-plata)">#${c.id}</span></td>
                <td>${c.tipo_cliente}</td>
                <td>${c.canal}</td>
                <td>${c.estatus_expediente}</td>
                <td>${c.telefono || '—'}</td>
            </tr>
        `).join('') || `<tr><td colspan="5">Sin clientes registrados todavía.</td></tr>`;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5">Error al cargar clientes.</td></tr>`;
    }
}

// ============================================================================
// LEADS (Proceso 1)
// ============================================================================
document.getElementById('form-lead')?.addEventListener('submit', async function (event) {
    event.preventDefault();
    const datos = {
        nombre_prospecto: document.getElementById('lead_nombre').value,
        telefono: document.getElementById('lead_telefono').value,
        correo: document.getElementById('lead_correo').value || null,
        servicio_interes: document.getElementById('lead_servicio').value,
    };
    mostrarMensaje('mensaje-lead', 'Procesando...', 'procesando');
    try {
        const respuesta = await fetchAutenticado('/leads/', { method: 'POST', body: JSON.stringify(datos) });
        if (respuesta.ok) {
            mostrarMensaje('mensaje-lead', 'Lead registrado con éxito.', 'exito');
            this.reset();
            cargarLeads();
        } else {
            const err = await respuesta.json();
            mostrarMensaje('mensaje-lead', err.detail || 'No se pudo registrar el lead.', 'error');
        }
    } catch (e) {
        mostrarMensaje('mensaje-lead', 'Error de conexión con el servidor.', 'error');
    }
});

async function cargarLeads() {
    const tbody = document.getElementById('tabla-leads');
    if (!tbody) return;
    try {
        const respuesta = await fetchAutenticado('/leads/');
        if (respuesta.status === 403) {
            tbody.innerHTML = `<tr><td colspan="4">Tu rol no tiene permiso para ver los leads.</td></tr>`;
            return;
        }
        const data = await respuesta.json();
        tbody.innerHTML = data.filter(l => !l.convertido).map(l => `
            <tr>
                <td>${l.nombre_prospecto}</td>
                <td>${l.telefono}${l.correo ? ' · ' + l.correo : ''}</td>
                <td>${l.servicio_interes}</td>
                <td>
                    <div class="accion-tabla">
                        <select id="tipo-lead-${l.id}">
                            <option value="Industriales">Industriales</option>
                            <option value="Comerciantes">Comerciantes</option>
                            <option value="Particulares">Particulares</option>
                        </select>
                        <button onclick="convertirLead(${l.id})">Convertir</button>
                    </div>
                </td>
            </tr>
        `).join('') || `<tr><td colspan="4">No hay prospectos pendientes de conversión.</td></tr>`;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4">Error al cargar leads.</td></tr>`;
    }
}

async function convertirLead(leadId) {
    const tipoCliente = document.getElementById(`tipo-lead-${leadId}`).value;
    try {
        const respuesta = await fetchAutenticado(`/leads/${leadId}/convertir?tipo_cliente=${encodeURIComponent(tipoCliente)}`, { method: 'POST' });
        if (respuesta.ok) {
            cargarLeads();
            cargarClientes();
        } else {
            const err = await respuesta.json();
            alert(err.detail || 'No se pudo convertir el lead.');
        }
    } catch (e) {
        alert('Error de conexión con el servidor.');
    }
}

// ============================================================================
// CITAS
// ============================================================================
document.getElementById('form-cita')?.addEventListener('submit', async function (event) {
    event.preventDefault();
    const datos = {
        cliente_id: parseInt(document.getElementById('cita_cliente_id').value, 10),
        fecha_solicitud: document.getElementById('cita_fecha').value,
        motivo: document.getElementById('cita_motivo').value,
    };
    mostrarMensaje('mensaje-cita', 'Procesando...', 'procesando');
    try {
        const respuesta = await fetchAutenticado('/citas/', { method: 'POST', body: JSON.stringify(datos) });
        if (respuesta.ok) {
            mostrarMensaje('mensaje-cita', 'Cita programada con éxito.', 'exito');
            this.reset();
            cargarCitas();
        } else {
            const err = await respuesta.json();
            mostrarMensaje('mensaje-cita', err.detail || 'No se pudo programar la cita.', 'error');
        }
    } catch (e) {
        mostrarMensaje('mensaje-cita', 'Error de conexión con el servidor.', 'error');
    }
});

async function cargarCitas() {
    const tbody = document.getElementById('tabla-citas');
    if (!tbody) return;
    try {
        const respuesta = await fetchAutenticado('/citas/');
        const data = await respuesta.json();
        tbody.innerHTML = data.map(c => `
            <tr>
                <td class="mono">#${c.cliente_id}</td>
                <td>${new Date(c.fecha_solicitud).toLocaleString('es-VE')}</td>
                <td>${c.motivo}</td>
                <td><span class="estado-tag ${c.confirmada ? 'estado-confirmada' : 'estado-no-confirmada'}">${c.confirmada ? 'Confirmada' : 'Pendiente'}</span></td>
                <td>${c.confirmada ? '' : `<button onclick="confirmarCita(${c.id})" class="btn-ghost btn" style="padding:5px 9px;font-size:11px;">Confirmar</button>`}</td>
            </tr>
        `).join('') || `<tr><td colspan="5">No hay citas registradas.</td></tr>`;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5">Error al cargar citas.</td></tr>`;
    }
}

async function confirmarCita(citaId) {
    try {
        const respuesta = await fetchAutenticado(`/citas/${citaId}/confirmar`, { method: 'PATCH' });
        if (respuesta.ok) cargarCitas();
    } catch (e) { /* silencioso, no crítico */ }
}

// ============================================================================
// EXPEDIENTES (Proceso 3/4)
// ============================================================================
document.getElementById('form-expediente')?.addEventListener('submit', async function (event) {
    event.preventDefault();
    const datos = {
        cliente_id: parseInt(document.getElementById('exp_cliente_id').value, 10),
        tipo_documento: document.getElementById('exp_tipo').value,
        procesado_por: document.getElementById('exp_procesado_por').value || null,
    };
    mostrarMensaje('mensaje-expediente', 'Procesando...', 'procesando');
    try {
        const respuesta = await fetchAutenticado('/transacciones/', { method: 'POST', body: JSON.stringify(datos) });
        if (respuesta.ok) {
            mostrarMensaje('mensaje-expediente', 'Documento registrado con éxito.', 'exito');
            this.reset();
            cargarExpedientes();
        } else {
            const err = await respuesta.json();
            mostrarMensaje('mensaje-expediente', err.detail || 'No se pudo registrar el documento.', 'error');
        }
    } catch (e) {
        mostrarMensaje('mensaje-expediente', 'Error de conexión con el servidor.', 'error');
    }
});

const clasesEstado = {
    'Pendiente': 'estado-pendiente',
    'En revisión': 'estado-revision',
    'Completado': 'estado-completado',
};

async function cargarExpedientes() {
    const tbody = document.getElementById('tabla-expedientes');
    if (!tbody) return;
    try {
        const respuesta = await fetchAutenticado('/transacciones/');
        const data = await respuesta.json();
        tbody.innerHTML = data.map(t => `
            <tr>
                <td class="mono">#${t.cliente_id}</td>
                <td>${t.tipo_documento}</td>
                <td><span class="estado-tag ${clasesEstado[t.estado] || ''}">${t.estado}</span></td>
                <td>
                    <div class="accion-tabla">
                        <select id="estado-exp-${t.id}">
                            <option value="Pendiente" ${t.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="En revisión" ${t.estado === 'En revisión' ? 'selected' : ''}>En revisión</option>
                            <option value="Completado" ${t.estado === 'Completado' ? 'selected' : ''}>Completado</option>
                        </select>
                        <button onclick="actualizarEstadoExpediente(${t.id})">Guardar</button>
                    </div>
                </td>
            </tr>
        `).join('') || `<tr><td colspan="4">No hay expedientes registrados.</td></tr>`;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4">Error al cargar expedientes.</td></tr>`;
    }
}

async function actualizarEstadoExpediente(transaccionId) {
    const nuevoEstado = document.getElementById(`estado-exp-${transaccionId}`).value;
    try {
        const respuesta = await fetchAutenticado(`/transacciones/${transaccionId}/estado?nuevo_estado=${encodeURIComponent(nuevoEstado)}`, { method: 'PATCH' });
        if (respuesta.ok) {
            cargarExpedientes();
        } else {
            const err = await respuesta.json();
            alert(err.detail || 'No se pudo actualizar el estado.');
        }
    } catch (e) {
        alert('Error de conexión con el servidor.');
    }
}

// ============================================================================
// FACTURACIÓN (Proceso 6)
// ============================================================================
document.getElementById('form-factura')?.addEventListener('submit', async function (event) {
    event.preventDefault();
    const transaccionIdRaw = document.getElementById('fac_transaccion_id').value;
    const datos = {
        cliente_id: parseInt(document.getElementById('fac_cliente_id').value, 10),
        transaccion_id: transaccionIdRaw ? parseInt(transaccionIdRaw, 10) : null,
        servicio: document.getElementById('fac_servicio').value,
        costo: parseFloat(document.getElementById('fac_costo').value),
    };
    mostrarMensaje('mensaje-factura', 'Procesando...', 'procesando');
    try {
        const respuesta = await fetchAutenticado('/facturas/', { method: 'POST', body: JSON.stringify(datos) });
        if (respuesta.ok) {
            mostrarMensaje('mensaje-factura', 'Factura generada con éxito.', 'exito');
            this.reset();
            cargarFacturas();
        } else {
            const err = await respuesta.json();
            mostrarMensaje('mensaje-factura', err.detail || 'No se pudo generar la factura.', 'error');
        }
    } catch (e) {
        mostrarMensaje('mensaje-factura', 'Error de conexión con el servidor.', 'error');
    }
});

async function cargarFacturas() {
    const tbody = document.getElementById('tabla-facturas');
    if (!tbody) return;
    try {
        const respuesta = await fetchAutenticado('/facturas/');
        const data = await respuesta.json();
        tbody.innerHTML = data.map(f => `
            <tr>
                <td class="mono">${f.numero_operacion}</td>
                <td class="mono">#${f.cliente_id}</td>
                <td>${f.servicio}</td>
                <td>$${Number(f.costo).toFixed(2)}</td>
                <td>${new Date(f.fecha).toLocaleDateString('es-VE')}</td>
            </tr>
        `).join('') || `<tr><td colspan="5">No hay facturas emitidas.</td></tr>`;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5">Error al cargar facturas.</td></tr>`;
    }
}

// ============================================================================
// CUENTAS APP MÓVIL (Administrador / Contador Gerente)
// ============================================================================
const CLASES_ESTATUS_SOLICITUD = {
    'Pendiente': 'estado-pendiente',
    'Aprobada': 'estado-completado',
    'Rechazada': 'estado-no-confirmada',
};

async function cargarCuentas() {
    const tbody = document.getElementById('tabla-cuentas');
    if (!tbody) return;
    try {
        const respuesta = await fetchAutenticado('/cuentas-clientes/');
        if (respuesta.status === 403) {
            tbody.innerHTML = `<tr><td colspan="5">Tu rol no tiene permiso para ver las solicitudes.</td></tr>`;
            return;
        }
        const data = await respuesta.json();
        tbody.innerHTML = data.map(s => `
            <tr>
                <td class="mono">#${s.cliente_id}</td>
                <td>${s.telefono}</td>
                <td>${s.correo || '—'}</td>
                <td>
                    <span class="estado-tag ${CLASES_ESTATUS_SOLICITUD[s.estatus_solicitud] || ''}">${s.estatus_solicitud}</span>
                    ${s.estatus_solicitud === 'Rechazada' && s.motivo_rechazo ? `<div style="font-size:11px;color:var(--rubim-plata);margin-top:4px;">${s.motivo_rechazo}</div>` : ''}
                </td>
                <td>
                    ${s.estatus_solicitud === 'Pendiente' ? `
                        <div class="accion-tabla">
                            <button onclick="aprobarCuenta(${s.id})">Aprobar</button>
                            <button onclick="rechazarCuenta(${s.id})" style="background:var(--rubim-carmesi);">Rechazar</button>
                        </div>
                    ` : ''}
                </td>
            </tr>
        `).join('') || `<tr><td colspan="5">No hay solicitudes de acceso todavía.</td></tr>`;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5">Error al cargar las solicitudes.</td></tr>`;
    }
}

async function aprobarCuenta(solicitudId) {
    try {
        const respuesta = await fetchAutenticado(`/cuentas-clientes/${solicitudId}/aprobar`, { method: 'PATCH' });
        if (respuesta.ok) {
            cargarCuentas();
        } else {
            const err = await respuesta.json();
            alert(err.detail || 'No se pudo aprobar la solicitud.');
        }
    } catch (e) {
        alert('Error de conexión con el servidor.');
    }
}

async function rechazarCuenta(solicitudId) {
    const motivo = prompt('¿Por qué se rechaza esta solicitud? (el cliente verá este motivo)');
    if (!motivo) return; // el staff canceló el prompt — no mandamos nada
    try {
        const respuesta = await fetchAutenticado(`/cuentas-clientes/${solicitudId}/rechazar`, {
            method: 'PATCH',
            body: JSON.stringify({ motivo_rechazo: motivo }),
        });
        if (respuesta.ok) {
            cargarCuentas();
        } else {
            const err = await respuesta.json();
            alert(err.detail || 'No se pudo rechazar la solicitud.');
        }
    } catch (e) {
        alert('Error de conexión con el servidor.');
    }
}

// ============================================================================
// PERSONAL (solo Administrador)
// ============================================================================
document.getElementById('form-personal')?.addEventListener('submit', async function (event) {
    event.preventDefault();
    const datos = {
        usuario: document.getElementById('nuevo_usuario').value,
        contrasena: document.getElementById('nueva_contrasena').value,
        rol: document.getElementById('nuevo_rol').value,
        nombre_completo: document.getElementById('nuevo_nombre').value || null,
    };
    mostrarMensaje('mensaje-personal', 'Procesando...', 'procesando');
    try {
        const respuesta = await fetchAutenticado('/auth/registrar', { method: 'POST', body: JSON.stringify(datos) });
        if (respuesta.ok) {
            mostrarMensaje('mensaje-personal', 'Empleado registrado con éxito.', 'exito');
            this.reset();
        } else {
            const err = await respuesta.json();
            mostrarMensaje('mensaje-personal', err.detail || 'No se pudo crear el acceso.', 'error');
        }
    } catch (e) {
        mostrarMensaje('mensaje-personal', 'Error de conexión con el servidor.', 'error');
    }
});

// --- INICIALIZACIÓN ---
aplicarPermisos();
cargarClientes();
