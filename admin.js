
"use strict";

/* G12 GAMING — Panel privado de administración */

const firebaseConfig = {
    apiKey: "AIzaSyA8YjGYef5Lj7412Z45-JOVxb7ZixCFuKs",
    authDomain: "g12-gaming.firebaseapp.com",
    projectId: "g12-gaming",
    storageBucket: "g12-gaming.firebasestorage.app",
    messagingSenderId: "718943523917",
    appId: "1:718943523917:web:791fada14e9f450f223804",
    measurementId: "G-7CQDJQ1HCS"
};

const ADMIN_UID = "J3m0lDm2jvPy6P16cvao9t9TcFG3";

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const documentoDatos = db.collection("g12").doc("datos");

const formularioLogin = document.getElementById("form-login");
const accesoAdmin = document.getElementById("acceso-admin");
const contenidoAdmin = document.getElementById("admin-contenido");
const botonCerrarSesion = document.getElementById("cerrar-sesion");
const mensajeLogin = document.getElementById("login-mensaje");
const estadoDatos = document.getElementById("estado-datos");

const formularioJugador = document.getElementById("form-jugador");
const formularioTorneo = document.getElementById("form-torneo");
const formularioTrofeo = document.getElementById("form-trofeo");

const datos = {
    jugadores: [],
    torneos: [],
    trofeos: [],
    records: [],
    torneosIndividuales: [],
    ligaEquipos: [],
    ligaPartidos: []
};

let usuarioActual = null;
let detenerSincronizacion = null;
let guardando = false;

const formularios = {
    jugadores: formularioJugador,
    torneos: formularioTorneo,
    trofeos: formularioTrofeo
};

const nombresSingulares = {
    jugadores: "jugador",
    torneos: "torneo",
    trofeos: "trofeo"
};

function mostrarMensajeLogin(mensaje) {
    if (mensajeLogin) mensajeLogin.textContent = mensaje;
}

function mostrarEstado(mensaje) {
    if (estadoDatos) estadoDatos.textContent = mensaje;
}

function esAdministrador() {
    return Boolean(usuarioActual && usuarioActual.uid === ADMIN_UID);
}

function actualizarInterfaz(esAdmin) {
    contenidoAdmin?.classList.toggle("hidden", !esAdmin);
    formularioLogin?.classList.toggle("hidden", esAdmin);
    botonCerrarSesion?.classList.toggle("hidden", !esAdmin);

    const titulo = accesoAdmin?.querySelector("h3");
    if (titulo) {
        titulo.textContent = esAdmin
            ? "Sesión de administrador"
            : "Acceso de administrador";
    }
}

function crearId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return "g12-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

function valor(formulario, nombre) {
    return String(formulario.elements.namedItem(nombre)?.value ?? "").trim();
}

function numeroOpcional(formulario, nombre) {
    const texto = valor(formulario, nombre);
    if (texto === "") return null;

    const numero = Number(texto);

    if (!Number.isFinite(numero) || numero < 0) {
        throw new Error(`El campo "${nombre}" debe ser un número válido igual o superior a 0.`);
    }

    return numero;
}

function normalizarEstadistica(valorOriginal) {
    const numero = Number(valorOriginal ?? 0);

    return Number.isInteger(numero) && numero >= 0
        ? numero
        : 0;
}

function numeroEstadistica(formulario, nombre) {
    const texto = valor(formulario, nombre);

    if (texto === "") return 0;

    const numero = Number(texto);

    if (!Number.isInteger(numero) || numero < 0) {
        throw new Error(
            `La estadística "${nombre}" debe ser un número entero igual o superior a 0.`
        );
    }

    return numero;
}

/* NORMALIZACIÓN: MANTENER TODAS LAS COLECCIONES */

function prepararColecciones() {
    for (const clave of Object.keys(datos)) {
        if (!Array.isArray(datos[clave])) datos[clave] = [];
    }

    datos.jugadores = datos.jugadores.map(jugador => ({
        ...jugador,
        rangoActual: jugador.rangoActual ?? jugador.rango ?? "",
        mmrActual: jugador.mmrActual ?? jugador.mmr ?? null,
        rangoPeak: jugador.rangoPeak ?? "",
        mmrPeak: jugador.mmrPeak ?? null,
        goles: normalizarEstadistica(jugador.goles),
        asistencias: normalizarEstadistica(jugador.asistencias),
        salvadas: normalizarEstadistica(jugador.salvadas)
    }));
}

/* FIRESTORE */

function detenerLecturaDatos() {
    if (detenerSincronizacion) {
        detenerSincronizacion();
        detenerSincronizacion = null;
    }
}

function iniciarLecturaDatos() {
    detenerLecturaDatos();
    mostrarEstado("Conectando con la base de datos...");

    detenerSincronizacion = documentoDatos.onSnapshot(documento => {
        if (!esAdministrador()) return;

        const contenido = documento.exists ? (documento.data() || {}) : {};

        // Lee las claves conocidas sin borrar ni ignorar el resto al guardar.
        for (const clave of Object.keys(datos)) {
            datos[clave] = Array.isArray(contenido[clave])
                ? contenido[clave]
                : [];
        }

        prepararColecciones();

        mostrarEstado(
            documento.exists
                ? "Conectado con la base de datos del club."
                : "Conexión correcta. Guarda tu primer registro para crear los datos del club."
        );

        renderizarListas();
        actualizarMarcadorSerie();
    }, error => {
        console.error("Error al leer Firestore:", error);
        mostrarEstado("Error al cargar los datos. Comprueba las reglas de Firestore y la conexión.");
    });
}

async function guardarColecciones() {
    if (!esAdministrador()) {
        throw new Error("No tienes permisos de administrador.");
    }

    if (guardando) {
        throw new Error("Ya hay una operación de guardado en curso.");
    }

    guardando = true;
    mostrarEstado("Guardando cambios en Firebase...");

    try {
        // merge conserva las colecciones que no se modifican desde este panel.
        await documentoDatos.set({
            jugadores: datos.jugadores,
            torneos: datos.torneos,
            trofeos: datos.trofeos,
            records: datos.records,
            torneosIndividuales: datos.torneosIndividuales,
            ligaEquipos: datos.ligaEquipos,
            ligaPartidos: datos.ligaPartidos
        }, { merge: true });

        mostrarEstado("Cambios guardados correctamente.");
    } finally {
        guardando = false;
    }
}

/* MARCADORES BO3 */

function calcularSerie(torneo) {
    let victoriasG12 = 0;
    let victoriasRival = 0;

    for (let i = 1; i <= 3; i++) {
        const g12 = torneo[`g12_${i}`];
        const rival = torneo[`rival_${i}`];

        if (
            g12 === null || g12 === undefined || g12 === "" ||
            rival === null || rival === undefined || rival === ""
        ) continue;

        if (Number(g12) > Number(rival)) victoriasG12++;
        if (Number(rival) > Number(g12)) victoriasRival++;
    }

    let resultado = "Pendiente";
    if (victoriasG12 >= 2) resultado = "Victoria G12";
    else if (victoriasRival >= 2) resultado = "Victoria rival";

    return { victoriasG12, victoriasRival, resultado };
}

function actualizarMarcadorSerie() {
    if (!formularioTorneo) return;

    const serie = {
        g12_1: numeroOpcional(formularioTorneo, "g12_1"),
        rival_1: numeroOpcional(formularioTorneo, "rival_1"),
        g12_2: numeroOpcional(formularioTorneo, "g12_2"),
        rival_2: numeroOpcional(formularioTorneo, "rival_2"),
        g12_3: numeroOpcional(formularioTorneo, "g12_3"),
        rival_3: numeroOpcional(formularioTorneo, "rival_3")
    };

    const resultado = calcularSerie(serie);

    const victoriasG12 = document.getElementById("victorias-g12");
    const victoriasRival = document.getElementById("victorias-rival");
    const resultadoSerie = document.getElementById("resultado-serie");

    if (victoriasG12) victoriasG12.textContent = resultado.victoriasG12;
    if (victoriasRival) victoriasRival.textContent = resultado.victoriasRival;
    if (resultadoSerie) resultadoSerie.textContent = resultado.resultado;
}

function validarMarcadores(torneo) {
    const partidas = [1, 2, 3].map(i => ({
        g12: torneo[`g12_${i}`],
        rival: torneo[`rival_${i}`]
    }));

    for (const partida of partidas) {
        const unoVacio = partida.g12 === null;
        const otroVacio = partida.rival === null;

        if (unoVacio !== otroVacio) {
            return "Completa los dos marcadores de cada partida que introduzcas.";
        }
    }

    const hayMarcadores = partidas.some(p => p.g12 !== null && p.rival !== null);
    if (!hayMarcadores) return "";

    if (partidas[0].g12 === null || partidas[1].g12 === null) {
        return "Para registrar una final, completa las partidas 1 y 2.";
    }

    const primera = partidas[0];
    const segunda = partidas[1];

    const g12GanoDos =
        primera.g12 > primera.rival &&
        segunda.g12 > segunda.rival;

    const rivalGanoDos =
        primera.rival > primera.g12 &&
        segunda.rival > segunda.g12;

    if (!g12GanoDos && !rivalGanoDos && partidas[2].g12 === null) {
        return "Si la final queda 1-1, completa también la partida 3.";
    }

    if (
        !g12GanoDos &&
        !rivalGanoDos &&
        partidas[2].g12 !== null &&
        partidas[2].g12 === partidas[2].rival
    ) {
        return "La tercera partida no puede terminar empatada.";
    }

    return "";
}

/* LISTAS DE GESTIÓN */

function crearElemento(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);

    if (clase) elemento.className = clase;
    if (texto !== undefined) elemento.textContent = String(texto ?? "");

    return elemento;
}

function crearBoton(texto, accion, tipo, id) {
    const boton = crearElemento(
        "button",
        tipo === "eliminar" ? "button button-secondary" : "button",
        texto
    );

    boton.type = "button";
    boton.dataset.action = accion;
    boton.dataset.tipo = tipo;
    boton.dataset.id = id;

    return boton;
}

function descripcionRegistro(tipo, item) {
    if (tipo === "jugadores") {
        const rangoActual = item.rangoActual ?? item.rango ?? "";
        const mmrActual = item.mmrActual ?? item.mmr;
        const rangoPeak = item.rangoPeak ?? "";
        const mmrPeak = item.mmrPeak;

        return [
            rangoActual ? `Actual: ${rangoActual}` : "Rango actual sin indicar",
            mmrActual !== null && mmrActual !== undefined && mmrActual !== ""
                ? `MMR: ${mmrActual}` : "",
            rangoPeak ? `Peak: ${rangoPeak}` : "",
            mmrPeak !== null && mmrPeak !== undefined && mmrPeak !== ""
                ? `MMR peak: ${mmrPeak}` : "",
            item.posicion || "",
            `Goles: ${normalizarEstadistica(item.goles)}`,
            `Asistencias: ${normalizarEstadistica(item.asistencias)}`,
            `Salvadas: ${normalizarEstadistica(item.salvadas)}`
        ].filter(Boolean).join(" · ");
    }

    if (tipo === "torneos") {
        const fecha = [item.fecha, item.hora].filter(Boolean).join(" · ");
        const serie = calcularSerie(item);

        return [
            fecha,
            item.modo || "",
            item.resultado || "",
            serie.resultado !== "Pendiente"
                ? `${serie.victoriasG12}-${serie.victoriasRival}` : ""
        ].filter(Boolean).join(" · ");
    }

    return [
        item.competicion || "",
        item.fecha || "",
        item.puesto || ""
    ].filter(Boolean).join(" · ");
}

function crearTarjetaRegistro(tipo, item) {
    const tarjeta = crearElemento("article", "admin-card");

    tarjeta.append(
        crearElemento("h3", "", item.nombre || "Registro sin nombre"),
        crearElemento("p", "muted", descripcionRegistro(tipo, item) || "Sin detalles adicionales.")
    );

    if (tipo === "torneos" && item.rival) {
        tarjeta.append(crearElemento("p", "small", `Rival: ${item.rival}`));
    }

    if ((tipo === "torneos" || tipo === "trofeos") && item.notas) {
        tarjeta.append(crearElemento("p", "small", item.notas));
    }

    const acciones = crearElemento("div", "admin-actions");

    acciones.append(
        crearBoton("EDITAR", "editar", tipo, item.id),
        crearBoton("ELIMINAR", "eliminar", tipo, item.id)
    );

    tarjeta.append(acciones);
    return tarjeta;
}

function renderizarListas() {
    if (!contenidoAdmin) return;

    const secciones = [
        ["jugadores", "Jugadores registrados"],
        ["torneos", "Torneos registrados"],
        ["trofeos", "Trofeos y logros"]
    ];

    let contenedor = document.getElementById("listas-administracion");

    if (!contenedor) {
        contenedor = crearElemento("div");
        contenedor.id = "listas-administracion";
        contenedor.style.gridColumn = "1 / -1";
        contenidoAdmin.appendChild(contenedor);
    }

    contenedor.replaceChildren();

    for (const [tipo, titulo] of secciones) {
        const seccion = crearElemento("section", "admin-card");
        seccion.style.marginTop = "1rem";

        const cabecera = crearElemento("h3", "", titulo);
        const lista = crearElemento("div", "admin-record-list");

        seccion.append(cabecera, lista);

        if (datos[tipo].length === 0) {
            lista.append(crearElemento("p", "muted", "Todavía no hay registros."));
        } else {
            const ordenados = [...datos[tipo]].sort((a, b) =>
                String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")
            );

            for (const item of ordenados) {
                lista.append(crearTarjetaRegistro(tipo, item));
            }
        }

        contenedor.append(seccion);
    }
}

/* FORMULARIOS: CREAR Y EDITAR */

function rellenarFormulario(formulario, item) {
    for (const elemento of formulario.elements) {
        if (!elemento.name) continue;

        let valorCampo;

        if (Object.prototype.hasOwnProperty.call(item, elemento.name)) {
            valorCampo = item[elemento.name];
        } else if (elemento.name === "rangoActual") {
            valorCampo = item.rango ?? "";
        } else if (elemento.name === "mmrActual") {
            valorCampo = item.mmr ?? "";
        } else if (elemento.name === "id") {
            valorCampo = item.id || "";
        } else if (
            ["goles", "asistencias", "salvadas"].includes(elemento.name)
        ) {
            valorCampo = 0;
        } else {
            valorCampo = "";
        }

        elemento.value =
            valorCampo === null || valorCampo === undefined
                ? ""
                : String(valorCampo);
    }
}

function cancelarEdicion(tipo) {
    const formulario = formularios[tipo];
    if (!formulario) return;

    formulario.reset();

    const campoId = formulario.elements.namedItem("id");
    if (campoId) campoId.value = "";

    if (tipo === "jugadores") {
        for (const campo of ["goles", "asistencias", "salvadas"]) {
            const input = formulario.elements.namedItem(campo);
            if (input) input.value = "0";
        }
    }

    document.getElementById(
        `cancelar-${nombresSingulares[tipo]}`
    )?.classList.add("hidden");

    const botonGuardar = formulario.querySelector('button[type="submit"]');

    if (botonGuardar) {
        botonGuardar.disabled = false;
        botonGuardar.textContent =
            tipo === "jugadores" ? "GUARDAR JUGADOR" :
            tipo === "torneos" ? "GUARDAR TORNEO" :
            "GUARDAR LOGRO";
    }

    if (tipo === "torneos") actualizarMarcadorSerie();
}

function editarRegistro(tipo, id) {
    if (!esAdministrador()) return;

    const formulario = formularios[tipo];
    const item = datos[tipo].find(registro => registro.id === id);

    if (!formulario || !item) {
        mostrarEstado("No se ha encontrado el registro que quieres editar.");
        return;
    }

    rellenarFormulario(formulario, item);

    document.getElementById(
        `cancelar-${nombresSingulares[tipo]}`
    )?.classList.remove("hidden");

    const botonGuardar = formulario.querySelector('button[type="submit"]');

    if (botonGuardar) {
        botonGuardar.textContent =
            tipo === "jugadores" ? "ACTUALIZAR JUGADOR" :
            tipo === "torneos" ? "ACTUALIZAR TORNEO" :
            "ACTUALIZAR LOGRO";
    }

    if (tipo === "torneos") actualizarMarcadorSerie();

    formulario.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* CONSTRUIR REGISTROS */

function construirJugador(formulario, id) {
    return {
        id,
        nombre: valor(formulario, "nombre"),
        rangoActual: valor(formulario, "rangoActual"),
        mmrActual: numeroOpcional(formulario, "mmrActual"),
        rangoPeak: valor(formulario, "rangoPeak"),
        mmrPeak: numeroOpcional(formulario, "mmrPeak"),
        posicion: valor(formulario, "posicion"),
        goles: numeroEstadistica(formulario, "goles"),
        asistencias: numeroEstadistica(formulario, "asistencias"),
        salvadas: numeroEstadistica(formulario, "salvadas")
    };
}

function construirTorneo(formulario, id) {
    const torneo = {
        id,
        nombre: valor(formulario, "nombre"),
        fecha: valor(formulario, "fecha"),
        hora: valor(formulario, "hora"),
        modo: valor(formulario, "modo"),
        jugadores: valor(formulario, "jugadores"),
        resultado: valor(formulario, "resultado"),
        rival: valor(formulario, "rival"),
        jugadoresG12: valor(formulario, "jugadoresG12"),
        jugadoresRival: valor(formulario, "jugadoresRival"),
        notas: valor(formulario, "notas"),
        g12_1: numeroOpcional(formulario, "g12_1"),
        rival_1: numeroOpcional(formulario, "rival_1"),
        g12_2: numeroOpcional(formulario, "g12_2"),
        rival_2: numeroOpcional(formulario, "rival_2"),
        g12_3: numeroOpcional(formulario, "g12_3"),
        rival_3: numeroOpcional(formulario, "rival_3")
    };

    const serie = calcularSerie(torneo);

    torneo.victoriasG12 = serie.victoriasG12;
    torneo.victoriasRival = serie.victoriasRival;
    torneo.resultadoSerie = serie.resultado;

    return torneo;
}

function construirTrofeo(formulario, id) {
    return {
        id,
        nombre: valor(formulario, "nombre"),
        competicion: valor(formulario, "competicion"),
        fecha: valor(formulario, "fecha"),
        puesto: valor(formulario, "puesto"),
        jugadores: valor(formulario, "jugadores"),
        notas: valor(formulario, "notas")
    };
}

/* GUARDAR REGISTROS */

async function guardarRegistro(tipo, formulario) {
    if (!esAdministrador()) {
        mostrarEstado("No tienes permisos para guardar información.");
        return;
    }

    if (guardando) {
        mostrarEstado("Espera a que termine el guardado actual.");
        return;
    }

    const campoId = formulario.elements.namedItem("id");
    const idExistente = String(campoId?.value || "").trim();
    const id = idExistente || crearId();

    let registro;

    try {
        if (tipo === "jugadores") {
            registro = construirJugador(formulario, id);
        } else if (tipo === "torneos") {
            registro = construirTorneo(formulario, id);

            const errorMarcadores = validarMarcadores(registro);
            if (errorMarcadores) {
                mostrarEstado(errorMarcadores);
                return;
            }
        } else {
            registro = construirTrofeo(formulario, id);
        }
    } catch (error) {
        mostrarEstado(error.message || "Revisa los valores introducidos.");
        return;
    }

    if (!registro.nombre) {
        mostrarEstado("El nombre es obligatorio.");
        return;
    }

    const nombreDuplicado = datos[tipo].some(item =>
        item.id !== id &&
        String(item.nombre || "").toLocaleLowerCase("es") ===
        registro.nombre.toLocaleLowerCase("es")
    );

    if (nombreDuplicado) {
        mostrarEstado(`Ya existe un registro con ese nombre en ${tipo}.`);
        return;
    }

    const anterior = datos[tipo].findIndex(item => item.id === id);
    const copiaAnterior = datos[tipo].map(item => ({ ...item }));

    if (anterior >= 0) {
        datos[tipo][anterior] = registro;
    } else {
        datos[tipo].push(registro);
    }

    const botonGuardar = formulario.querySelector('button[type="submit"]');
    if (botonGuardar) botonGuardar.disabled = true;

    try {
        await guardarColecciones();
        cancelarEdicion(tipo);
        renderizarListas();
    } catch (error) {
        console.error("Error al guardar:", error);
        datos[tipo] = copiaAnterior;
        mostrarEstado("No se pudieron guardar los cambios. Comprueba tu conexión y los permisos de Firestore.");
        renderizarListas();
    } finally {
        if (botonGuardar) botonGuardar.disabled = false;
    }
}

/* ELIMINAR REGISTROS */

async function eliminarRegistro(tipo, id) {
    if (!esAdministrador()) return;

    const registro = datos[tipo].find(item => item.id === id);
    if (!registro) return;

    if (!window.confirm(
        `¿Seguro que quieres eliminar "${registro.nombre}"? Esta acción no se puede deshacer.`
    )) return;

    const copiaAnterior = datos[tipo].map(item => ({ ...item }));
    datos[tipo] = datos[tipo].filter(item => item.id !== id);

    try {
        await guardarColecciones();

        const campoId = formularios[tipo]?.elements.namedItem("id");
        if (campoId && campoId.value === id) cancelarEdicion(tipo);

        renderizarListas();
    } catch (error) {
        console.error("Error al eliminar:", error);
        datos[tipo] = copiaAnterior;
        mostrarEstado("No se pudo eliminar el registro. Comprueba la conexión y los permisos.");
        renderizarListas();
    }
}

/* CONECTAR FORMULARIOS Y BOTONES */

for (const [tipo, formulario] of Object.entries(formularios)) {
    if (!formulario) continue;

    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        await guardarRegistro(tipo, formulario);
    });

    document.getElementById(
        `cancelar-${nombresSingulares[tipo]}`
    )?.addEventListener("click", () => {
        cancelarEdicion(tipo);
        mostrarEstado("Edición cancelada.");
    });
}

contenidoAdmin?.addEventListener("click", async evento => {
    const boton = evento.target.closest("button[data-action]");
    if (!boton || !esAdministrador()) return;

    const { action: accion, tipo, id } = boton.dataset;

    if (!formularios[tipo] || !id) return;

    if (accion === "editar") {
        editarRegistro(tipo, id);
    } else if (accion === "eliminar") {
        await eliminarRegistro(tipo, id);
    }
});

if (formularioTorneo) {
    formularioTorneo.addEventListener("input", actualizarMarcadorSerie);
    formularioTorneo.addEventListener("change", actualizarMarcadorSerie);
}

/* AUTENTICACIÓN */

if (formularioLogin) {
    formularioLogin.addEventListener("submit", async evento => {
        evento.preventDefault();

        const email = document.getElementById("login-email")?.value.trim();
        const password = document.getElementById("login-password")?.value;

        if (!email || !password) {
            mostrarMensajeLogin("Introduce tu correo y contraseña.");
            return;
        }

        const boton = formularioLogin.querySelector('button[type="submit"]');

        if (boton) {
            boton.disabled = true;
            boton.textContent = "INICIANDO SESIÓN...";
        }

        mostrarMensajeLogin("");

        try {
            const resultado = await auth.signInWithEmailAndPassword(email, password);

            if (resultado.user.uid !== ADMIN_UID) {
                await auth.signOut();
                mostrarMensajeLogin("Esta cuenta no tiene permisos de administración.");
            }
        } catch (error) {
            console.error("Error de inicio de sesión:", error);

            const mensajes = {
                "auth/invalid-credential": "Correo o contraseña incorrectos.",
                "auth/invalid-email": "El correo electrónico no es válido.",
                "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
                "auth/network-request-failed": "Error de conexión. Comprueba tu internet."
            };

            mostrarMensajeLogin(
                mensajes[error.code] ||
                "No se pudo iniciar sesión. Comprueba los datos e inténtalo de nuevo."
            );
        } finally {
            if (boton) {
                boton.disabled = false;
                boton.textContent = "INICIAR SESIÓN";
            }
        }
    });
}

botonCerrarSesion?.addEventListener("click", async () => {
    detenerLecturaDatos();

    try {
        await auth.signOut();
        mostrarMensajeLogin("Sesión cerrada correctamente.");
        mostrarEstado("Sesión cerrada.");
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        mostrarEstado("No se pudo cerrar la sesión.");
    }
});

auth.onAuthStateChanged(async usuario => {
    usuarioActual = usuario;

    if (usuario && usuario.uid !== ADMIN_UID) {
        detenerLecturaDatos();
        actualizarInterfaz(false);
        mostrarMensajeLogin("Esta cuenta no tiene permisos de administración.");
        mostrarEstado("Acceso restringido.");

        try {
            await auth.signOut();
        } catch (error) {
            console.error("Error al cerrar sesión no autorizada:", error);
        }

        return;
    }

    const esAdmin = esAdministrador();
    actualizarInterfaz(esAdmin);

    if (esAdmin) {
        mostrarMensajeLogin(`Sesión iniciada: ${usuario.email || "Administrador"}`);
        iniciarLecturaDatos();
    } else {
        detenerLecturaDatos();
        mostrarEstado("Inicia sesión para acceder a la administración.");
    }
});

actualizarMarcadorSerie();
