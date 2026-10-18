
"use strict";

/* G12 GAMING — Firebase + Firestore */

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
const CLAVE_DATOS = "g12-gaming-datos";

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const documentoDatos = db.collection("g12").doc("datos");

let esAdmin = false;
let usuarioActual = null;
let datos = datosVacios();
let detenerSincronizacion = null;
let migracionIntentada = false;

const formularioTorneo = document.getElementById("form-torneo");
const estadoDatos = document.getElementById("estado-datos");
const accesoAdmin = document.getElementById("acceso-admin");
const contenidoAdmin = document.getElementById("admin-contenido");
const formularioLogin = document.getElementById("form-login");
const botonCerrarSesion = document.getElementById("cerrar-sesion");
const mensajeLogin = document.getElementById("login-mensaje");
const formularioJugador = document.getElementById("form-jugador");

/* DATOS */

function datosVacios() {
    return {
        jugadores: [],
        torneos: [],
        trofeos: [],
        records: [],
        torneosIndividuales: [],
        ligaEquipos: [],
        ligaPartidos: []
    };
}

function normalizarEstadistica(valor) {
    const numero = Number(valor);

    if (!Number.isFinite(numero) || numero < 0) return 0;

    return Math.floor(numero);
}

function normalizarJugador(jugador) {
    return {
        ...jugador,
        goles: normalizarEstadistica(jugador.goles),
        asistencias: normalizarEstadistica(jugador.asistencias),
        salvadas: normalizarEstadistica(jugador.salvadas)
    };
}

function normalizarDatos(valor) {
    return {
        ...datosVacios(),
        ...(valor && typeof valor === "object" ? valor : {}),

        jugadores: Array.isArray(valor?.jugadores)
            ? valor.jugadores.map(normalizarJugador)
            : [],

        torneos: Array.isArray(valor?.torneos)
            ? valor.torneos
            : [],

        trofeos: Array.isArray(valor?.trofeos)
            ? valor.trofeos
            : [],

        records: Array.isArray(valor?.records)
            ? valor.records
            : [],

        torneosIndividuales: Array.isArray(valor?.torneosIndividuales)
            ? valor.torneosIndividuales
            : [],

        ligaEquipos: Array.isArray(valor?.ligaEquipos)
            ? valor.ligaEquipos
            : [],

        ligaPartidos: Array.isArray(valor?.ligaPartidos)
            ? valor.ligaPartidos
            : []
    };
}

function cargarDatosLocales() {
    try {
        const guardados = JSON.parse(
            localStorage.getItem(CLAVE_DATOS)
        );

        return guardados && typeof guardados === "object"
            ? normalizarDatos(guardados)
            : datosVacios();
    } catch (error) {
        console.error("No se pudieron leer los datos locales:", error);
        return datosVacios();
    }
}

function crearId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/* UTILIDADES */

function escapar(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caracter]);
}

function mostrarTexto(valor, alternativa = "Sin especificar") {
    const texto = String(valor ?? "").trim();
    return texto ? escapar(texto) : alternativa;
}

function formatearFecha(fecha) {
    if (!fecha) return "Fecha sin especificar";

    const partes = String(fecha).split("-");

    if (partes.length !== 3) return escapar(fecha);

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function establecerEstado(texto) {
    if (estadoDatos) estadoDatos.textContent = texto;
}

function mensajeVacio(texto) {
    return `<div class="empty-state">${escapar(texto)}</div>`;
}

/* ACCESO DE ADMINISTRADOR */

function actualizarAcceso() {
    if (!accesoAdmin || !contenidoAdmin || !botonCerrarSesion ||
        !formularioLogin || !mensajeLogin) {
        return;
    }

    accesoAdmin.classList.remove("hidden");
    contenidoAdmin.classList.toggle("hidden", !esAdmin);
    botonCerrarSesion.classList.toggle("hidden", !esAdmin);

    if (esAdmin) {
        const titulo = accesoAdmin.querySelector("h3");

        if (titulo) {
            titulo.textContent = "Sesión de administrador";
        }

        mensajeLogin.textContent = usuarioActual?.email
            ? `Sesión iniciada: ${usuarioActual.email}`
            : "Sesión iniciada";

        formularioLogin.classList.add("hidden");
    } else {
        const titulo = accesoAdmin.querySelector("h3");

        if (titulo) {
            titulo.textContent = "Acceso de administrador";
        }

        formularioLogin.classList.remove("hidden");
        mensajeLogin.textContent = "";
    }
}

/* CONTADORES */

function actualizarContadores() {
    const contadores = {
        "total-jugadores": datos.jugadores.length,
        "total-torneos": datos.torneos.length,
        "total-trofeos": datos.trofeos.length
    };

    for (const [id, cantidad] of Object.entries(contadores)) {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent = cantidad;
        }
    }
}

/* CAMPOS DE ESTADÍSTICAS INDIVIDUALES */

function asegurarCamposEstadisticas() {
    if (!formularioJugador) return;

    const botonGuardar = formularioJugador.querySelector(
        'button[type="submit"]'
    );

    const campos = [
        {
            nombre: "goles",
            etiqueta: "Goles",
            id: "jugador-goles"
        },
        {
            nombre: "asistencias",
            etiqueta: "Asistencias",
            id: "jugador-asistencias"
        },
        {
            nombre: "salvadas",
            etiqueta: "Salvadas",
            id: "jugador-salvadas"
        }
    ];

    let contenedor = formularioJugador.querySelector(
        ".campos-estadisticas-individuales"
    );

    if (!contenedor) {
        contenedor = document.createElement("div");
        contenedor.className = "campos-estadisticas-individuales";

        if (botonGuardar) {
            formularioJugador.insertBefore(contenedor, botonGuardar);
        } else {
            formularioJugador.appendChild(contenedor);
        }
    }

    for (const campo of campos) {
        let input = formularioJugador.elements.namedItem(campo.nombre);

        if (!input) {
            const grupo = document.createElement("div");
            grupo.className = "form-group";

            const label = document.createElement("label");
            label.htmlFor = campo.id;
            label.textContent = campo.etiqueta;

            input = document.createElement("input");
            input.type = "number";
            input.id = campo.id;
            input.name = campo.nombre;
            input.min = "0";
            input.step = "1";
            input.value = "0";
            input.required = true;

            grupo.appendChild(label);
            grupo.appendChild(input);
            contenedor.appendChild(grupo);
        } else if (input instanceof HTMLInputElement) {
            input.type = "number";
            input.min = "0";
            input.step = "1";
            input.required = true;
        }
    }
}

/* BOTONES DE EDICIÓN Y ELIMINACIÓN */

function botonesAccion(tipo, id) {
    if (!esAdmin) return "";

    return `
        <div class="card-actions">
            <button type="button" class="action-button"
                data-action="edit"
                data-type="${escapar(tipo)}"
                data-id="${escapar(id)}">
                EDITAR
            </button>

            <button type="button" class="action-button delete"
                data-action="delete"
                data-type="${escapar(tipo)}"
                data-id="${escapar(id)}">
                ELIMINAR
            </button>
        </div>
    `;
}

/* JUGADORES */

function tarjetaJugador(jugador) {
    return `
        <article class="data-card">
            <div class="card-topline">
                <div class="card-icon">G12</div>
                <span class="pill">
                    ${mostrarTexto(
                        jugador.rangoActual ?? jugador.rango,
                        "Sin rango"
                    )}
                </span>
            </div>

            <h3>${mostrarTexto(jugador.nombre, "Jugador sin nombre")}</h3>

            <p>Rol: ${mostrarTexto(jugador.posicion)}</p>

            <p>
                MMR:
                <strong>
                    ${mostrarTexto(
                        jugador.mmrActual ?? jugador.mmr,
                        "Sin registrar"
                    )}
                </strong>
            </p>

            ${botonesAccion("jugador", jugador.id)}
        </article>
    `;
}

function renderJugadores() {
    const contenedor = document.getElementById("lista-jugadores");

    if (!contenedor) return;

    contenedor.innerHTML = datos.jugadores.length
        ? datos.jugadores.map(tarjetaJugador).join("")
        : mensajeVacio("Todavía no hay jugadores registrados.");
}

/* TORNEOS Y SERIES BO3 */

function obtenerPartidas(torneo) {
    if (Array.isArray(torneo.partidas)) {
        return torneo.partidas;
    }

    const partidas = [];

    for (let numero = 1; numero <= 3; numero++) {
        const g12 = torneo[`g12_${numero}`];
        const rival = torneo[`rival_${numero}`];

        if (g12 !== undefined && g12 !== "" &&
            rival !== undefined && rival !== "") {
            partidas.push({
                g12: Number(g12),
                rival: Number(rival)
            });
        }
    }

    return partidas;
}

function calcularSerie(partidas) {
    let victoriasG12 = 0;
    let victoriasRival = 0;
    const jugadas = [];

    for (const partida of partidas) {
        if (victoriasG12 === 2 || victoriasRival === 2) break;

        if (!Number.isInteger(partida.g12) ||
            !Number.isInteger(partida.rival) ||
            partida.g12 < 0 ||
            partida.rival < 0 ||
            partida.g12 === partida.rival) {
            continue;
        }

        jugadas.push(partida);

        if (partida.g12 > partida.rival) {
            victoriasG12++;
        } else {
            victoriasRival++;
        }
    }

    return {
        victoriasG12,
        victoriasRival,
        ganador: victoriasG12 === 2
            ? "G12 Gaming"
            : victoriasRival === 2
                ? "Rival"
                : "",
        partidas: jugadas
    };
}

function resumenSerie(torneo) {
    const partidas = obtenerPartidas(torneo);

    if (!partidas.length) return "";

    const serie = calcularSerie(partidas);

    const resultados = serie.partidas.map((partida, indice) => `
        <div class="match-result ${partida.g12 > partida.rival ? "won" : ""}">
            <span>Partida ${indice + 1}</span>
            <strong>${partida.g12} – ${partida.rival}</strong>
        </div>
    `).join("");

    let ganador = "Serie sin terminar";

    if (serie.ganador === "G12 Gaming") {
        ganador = `G12 Gaming gana ${serie.victoriasG12}–${serie.victoriasRival}`;
    } else if (serie.ganador === "Rival") {
        ganador = `${mostrarTexto(torneo.rival, "Rival")} gana ${serie.victoriasRival}–${serie.victoriasG12}`;
    }

    return `
        <div class="match-results">${resultados}</div>
        <p><strong>${ganador}</strong></p>

        ${torneo.jugadoresG12
            ? `<p>G12: ${mostrarTexto(torneo.jugadoresG12)}</p>`
            : ""}

        ${torneo.jugadoresRival
            ? `<p>Rival: ${mostrarTexto(torneo.jugadoresRival)}</p>`
            : ""}
    `;
}

function tarjetaTorneo(torneo) {
    return `
        <article class="history-card">
            <div class="history-main">
                <div class="card-topline">
                    <span class="pill">
                        ${mostrarTexto(torneo.modo, "Modo sin especificar")}
                    </span>

                    <span class="section-tag">
                        ${formatearFecha(torneo.fecha)}
                    </span>
                </div>

                <h3>${mostrarTexto(torneo.nombre, "Torneo sin nombre")}</h3>

                <p>Participantes G12: ${mostrarTexto(torneo.jugadores)}</p>

                ${torneo.rival
                    ? `<p>Final contra: <strong>${mostrarTexto(torneo.rival)}</strong></p>`
                    : ""}

                <p>
                    Resultado:
                    <strong>${mostrarTexto(torneo.resultado, "Sin resultado")}</strong>
                </p>

                ${resumenSerie(torneo)}

                ${torneo.notas
                    ? `<p class="history-notes">${mostrarTexto(torneo.notas)}</p>`
                    : ""}

                ${botonesAccion("torneo", torneo.id)}
            </div>

            <div class="history-side">
                <span class="pill">
                    ${mostrarTexto(torneo.hora, "Hora no indicada")}
                </span>
            </div>
        </article>
    `;
}

function renderTorneos() {
    const contenedor = document.getElementById("lista-torneos");

    if (!contenedor) return;

    const ordenados = [...datos.torneos].sort((a, b) =>
        String(b.fecha || "").localeCompare(String(a.fecha || ""))
    );

    contenedor.innerHTML = ordenados.length
        ? ordenados.map(tarjetaTorneo).join("")
        : mensajeVacio("Todavía no hay torneos registrados.");
}

/* PALMARÉS */

function tarjetaTrofeo(trofeo) {
    return `
        <article class="data-card">
            <div class="card-topline">
                <div class="card-icon">★</div>
                <span class="pill">${mostrarTexto(trofeo.puesto, "Logro")}</span>
            </div>

            <h3>${mostrarTexto(trofeo.nombre, "Logro sin nombre")}</h3>

            <p>Competición: ${mostrarTexto(trofeo.competicion)}</p>
            <p>Fecha: ${formatearFecha(trofeo.fecha)}</p>
            <p>Jugadores: ${mostrarTexto(trofeo.jugadores)}</p>

            ${trofeo.notas
                ? `<p>${mostrarTexto(trofeo.notas)}</p>`
                : ""}

            ${botonesAccion("trofeo", trofeo.id)}
        </article>
    `;
}

function renderTrofeos() {
    const contenedor = document.getElementById("lista-trofeos");

    if (!contenedor) return;

    const ordenados = [...datos.trofeos].sort((a, b) =>
        String(b.fecha || "").localeCompare(String(a.fecha || ""))
    );

    contenedor.innerHTML = ordenados.length
        ? ordenados.map(tarjetaTrofeo).join("")
        : mensajeVacio("Los trofeos que consigas aparecerán aquí.");
}

/* ACTUALIZACIÓN DE LA WEB */

function actualizarWeb() {
    actualizarContadores();
    renderJugadores();
    renderTorneos();
    renderTrofeos();
}

/* GUARDADO COMPARTIDO */

async function guardarDatos() {
    if (!esAdmin || usuarioActual?.uid !== ADMIN_UID) {
        throw new Error("No tienes permisos de administrador.");
    }

    try {
        /*
         * datos contiene también los torneos individuales,
         * la liga y cualquier otro campo existente en Firestore.
         */
        await documentoDatos.set(datos);

        establecerEstado(
            "Datos guardados y sincronizados con G12 Gaming."
        );
    } catch (error) {
        console.error("Error guardando en Firestore:", error);

        establecerEstado(
            "No se pudieron guardar los cambios. Comprueba la conexión y los permisos."
        );

        alert(
            "No se han podido guardar los datos. Comprueba tu sesión y las reglas de Firestore."
        );

        throw error;
    }
}

function normalizarIds() {
    ["jugadores", "torneos", "trofeos"].forEach(coleccion => {
        datos[coleccion] = datos[coleccion].map(elemento => ({
            ...elemento,
            id: elemento.id || crearId()
        }));
    });
}

/* SINCRONIZACIÓN CON FIRESTORE */

function iniciarSincronizacion() {
    if (detenerSincronizacion) {
        detenerSincronizacion();
        detenerSincronizacion = null;
    }

    detenerSincronizacion = documentoDatos.onSnapshot(
        async snapshot => {
            if (snapshot.exists) {
                datos = normalizarDatos(snapshot.data());

                asegurarCamposEstadisticas();
                actualizarWeb();

                establecerEstado(
                    "Datos sincronizados con la base de datos del club."
                );

                return;
            }

            datos = datosVacios();

            if (esAdmin && !migracionIntentada) {
                migracionIntentada = true;

                const locales = cargarDatosLocales();

                const hayDatosLocales = Object.values(locales).some(
                    lista => lista.length > 0
                );

                if (hayDatosLocales) {
                    datos = locales;
                    normalizarIds();
                    actualizarWeb();

                    try {
                        await guardarDatos();
                    } catch (error) {
                        console.error(
                            "No se pudieron migrar los datos locales:",
                            error
                        );
                    }

                    return;
                }
            }

            actualizarWeb();

            establecerEstado(
                esAdmin
                    ? "Base de datos lista. Añade el primer registro."
                    : "Todavía no hay datos registrados en el club."
            );
        },
        error => {
            console.error("Error leyendo Firestore:", error);

            establecerEstado(
                "Error al conectar con la base de datos. Revisa la configuración y las reglas."
            );
        }
    );
}

/* INICIO Y CIERRE DE SESIÓN */

if (formularioLogin) {
    formularioLogin.addEventListener("submit", async evento => {
        evento.preventDefault();

        mensajeLogin.textContent = "Comprobando acceso...";

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            formularioLogin.reset();
            mensajeLogin.textContent = "";
        } catch (error) {
            console.error("Error de inicio de sesión:", error);

            mensajeLogin.textContent =
                "No se pudo iniciar sesión. Comprueba el correo y la contraseña.";
        }
    });
}

if (botonCerrarSesion) {
    botonCerrarSesion.addEventListener("click", async () => {
        try {
            await auth.signOut();
        } catch (error) {
            console.error("Error cerrando sesión:", error);
            alert("No se ha podido cerrar la sesión. Inténtalo de nuevo.");
        }
    });
}

auth.onAuthStateChanged(usuario => {
    usuarioActual = usuario;
    esAdmin = Boolean(usuario && usuario.uid === ADMIN_UID);

    actualizarAcceso();
    asegurarCamposEstadisticas();
    actualizarWeb();
    iniciarSincronizacion();

    if (usuario && !esAdmin) {
        establecerEstado(
            "La cuenta iniciada no tiene permisos de administración."
        );
    }
});

/* FORMULARIOS */

function obtenerFormulario(formulario) {
    return Object.fromEntries(new FormData(formulario).entries());
}

function limpiarFormulario(formulario) {
    if (!formulario) return;

    formulario.reset();

    if (formulario.elements.id) {
        formulario.elements.id.value = "";
    }

    const tipo = formulario.id.replace("form-", "");
    const cancelar = document.getElementById(`cancelar-${tipo}`);

    if (cancelar) cancelar.classList.add("hidden");

    const boton = formulario.querySelector('button[type="submit"]');

    if (boton) {
        boton.textContent = tipo === "jugador"
            ? "GUARDAR JUGADOR"
            : tipo === "torneo"
                ? "GUARDAR TORNEO"
                : "GUARDAR LOGRO";
    }

    if (tipo === "jugador") {
        ["goles", "asistencias", "salvadas"].forEach(nombre => {
            const campo = formulario.elements.namedItem(nombre);

            if (campo) campo.value = "0";
        });
    }

    if (tipo === "torneo") {
        actualizarResumenFormulario();
    }
}

function prepararEdicion(tipo, id) {
    if (!esAdmin) return;

    const coleccion = tipo === "jugador"
        ? "jugadores"
        : tipo === "torneo"
            ? "torneos"
            : "trofeos";

    const elemento = datos[coleccion].find(
        item => String(item.id) === String(id)
    );

    if (!elemento) return;

    const formulario = document.getElementById(
        tipo === "jugador"
            ? "form-jugador"
            : tipo === "torneo"
                ? "form-torneo"
                : "form-trofeo"
    );

    if (!formulario) return;

    formulario.reset();

    if (tipo === "jugador") {
        asegurarCamposEstadisticas();
    }

    for (const campo of formulario.elements) {
        if (!campo.name) continue;

        if (
            campo.name in elemento &&
            campo.type !== "button" &&
            campo.type !== "submit"
        ) {
            campo.value = elemento[campo.name] ?? "";
        }
    }

    if (tipo === "jugador") {
        ["goles", "asistencias", "salvadas"].forEach(nombre => {
            const campo = formulario.elements.namedItem(nombre);

            if (campo) {
                campo.value = normalizarEstadistica(elemento[nombre]);
            }
        });
    }

    if (tipo === "torneo") {
        const partidas = obtenerPartidas(elemento);

        for (let numero = 1; numero <= 3; numero++) {
            const partida = partidas[numero - 1];

            formulario.elements[`g12_${numero}`].value =
                partida ? partida.g12 : "";

            formulario.elements[`rival_${numero}`].value =
                partida ? partida.rival : "";
        }

        actualizarResumenFormulario();
    }

    const cancelar = document.getElementById(`cancelar-${tipo}`);

    if (cancelar) cancelar.classList.remove("hidden");

    const boton = formulario.querySelector('button[type="submit"]');

    if (boton) boton.textContent = "GUARDAR CAMBIOS";

    formulario.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

/* VALIDACIÓN DE MARCADORES */

function leerMarcadoresFormulario() {
    const partidas = [];

    if (!formularioTorneo) {
        return { partidas };
    }

    for (let numero = 1; numero <= 3; numero++) {
        const g12 = formularioTorneo.elements[`g12_${numero}`].value;
        const rival = formularioTorneo.elements[`rival_${numero}`].value;

        if (g12 === "" && rival === "") continue;

        if (g12 === "" || rival === "") {
            return {
                error: `Completa los dos marcadores de la partida ${numero}.`
            };
        }

        const golesG12 = Number(g12);
        const golesRival = Number(rival);

        if (
            !Number.isInteger(golesG12) ||
            !Number.isInteger(golesRival) ||
            golesG12 < 0 ||
            golesRival < 0 ||
            golesG12 > 99 ||
            golesRival > 99
        ) {
            return {
                error: `Los goles de la partida ${numero} deben estar entre 0 y 99.`
            };
        }

        if (golesG12 === golesRival) {
            return {
                error: `La partida ${numero} no puede acabar empatada.`
            };
        }

        partidas.push({
            numero,
            g12: golesG12,
            rival: golesRival
        });
    }

    return { partidas };
}

function actualizarResumenFormulario() {
    const resultado = leerMarcadoresFormulario();

    const elementoG12 = document.getElementById("victorias-g12");
    const elementoRival = document.getElementById("victorias-rival");
    const elementoResultado = document.getElementById("resultado-serie");

    if (!elementoG12 || !elementoRival || !elementoResultado) return;

    if (resultado.error) {
        elementoG12.textContent = "–";
        elementoRival.textContent = "–";
        elementoResultado.textContent = "Revisar marcadores";
        return;
    }

    const serie = calcularSerie(resultado.partidas);

    elementoG12.textContent = serie.victoriasG12;
    elementoRival.textContent = serie.victoriasRival;

    elementoResultado.textContent = serie.ganador === "G12 Gaming"
        ? `G12 gana ${serie.victoriasG12}–${serie.victoriasRival}`
        : serie.ganador === "Rival"
            ? `Rival gana ${serie.victoriasRival}–${serie.victoriasG12}`
            : "Pendiente";
}

if (formularioTorneo) {
    [1, 2, 3].forEach(numero => {
        formularioTorneo.elements[`g12_${numero}`]
            .addEventListener("input", actualizarResumenFormulario);

        formularioTorneo.elements[`rival_${numero}`]
            .addEventListener("input", actualizarResumenFormulario);
    });
}

/* GUARDAR JUGADOR */

async function guardarJugador(evento) {
    evento.preventDefault();

    if (!esAdmin || usuarioActual?.uid !== ADMIN_UID) {
        return alert("Inicia sesión como administrador.");
    }

    const formulario = evento.currentTarget;
    const valores = obtenerFormulario(formulario);
    const id = valores.id || crearId();

    const jugadorAnterior = datos.jugadores.find(
        item => String(item.id) === String(id)
    ) || {};

    const estadisticas = {};

    for (const nombre of ["goles", "asistencias", "salvadas"]) {
        const valor = valores[nombre] ?? jugadorAnterior[nombre] ?? 0;
        const numero = Number(valor);

        if (
            !Number.isInteger(numero) ||
            numero < 0 ||
            numero > 1000000000
        ) {
            alert(`El valor de ${nombre} debe ser un número entero igual o superior a 0.`);
            formulario.elements.namedItem(nombre)?.focus();
            return;
        }

        estadisticas[nombre] = numero;
    }

    const jugador = {
        ...jugadorAnterior,
        id,
        nombre: valores.nombre.trim(),
        rango: valores.rango.trim(),
        mmr: valores.mmr === "" ? "" : Number(valores.mmr),
        posicion: valores.posicion.trim(),
        ...estadisticas
    };

    const indice = datos.jugadores.findIndex(
        item => String(item.id) === String(id)
    );

    const datosAnteriores = datos;

    datos = {
        ...datos,
        jugadores: indice >= 0
            ? datos.jugadores.map((item, i) => i === indice ? jugador : item)
            : [...datos.jugadores, jugador]
    };

    actualizarWeb();

    try {
        await guardarDatos();
        limpiarFormulario(formulario);
    } catch (_) {
        datos = datosAnteriores;
        actualizarWeb();
    }
}

/* GUARDAR TORNEO */

async function guardarTorneo(evento) {
    evento.preventDefault();

    if (!esAdmin || usuarioActual?.uid !== ADMIN_UID) {
        return alert("Inicia sesión como administrador.");
    }

    const formulario = evento.currentTarget;
    const valores = obtenerFormulario(formulario);
    const id = valores.id || crearId();
    const rival = valores.rival.trim();
    const lectura = leerMarcadoresFormulario();
    const camposMarcador = [];

    for (let numero = 1; numero <= 3; numero++) {
        camposMarcador.push(
            formulario.elements[`g12_${numero}`].value,
            formulario.elements[`rival_${numero}`].value
        );
    }

    const hayMarcadores = camposMarcador.some(valor => valor !== "");

    let partidas = [];
    let resultadoFinal = valores.resultado;
    let victoriasG12 = 0;
    let victoriasRival = 0;
    let ganadorSerie = "";

    if (hayMarcadores && !rival) {
        alert("Escribe el equipo rival para guardar los marcadores.");
        formulario.elements.rival.focus();
        return;
    }

    if (rival && !hayMarcadores) {
        alert("Has indicado un rival, pero faltan los marcadores.");
        formulario.elements.g12_1.focus();
        return;
    }

    if (hayMarcadores) {
        if (lectura.error) return alert(lectura.error);

        if (lectura.partidas.length < 2) {
            return alert("Una final BO3 necesita al menos dos partidas.");
        }

        const primerasDos = calcularSerie(
            lectura.partidas.slice(0, 2)
        );

        if (!primerasDos.ganador && lectura.partidas.length < 3) {
            alert("La serie va 1–1. Introduce el marcador de la tercera partida.");
            formulario.elements.g12_3.focus();
            return;
        }

        if (primerasDos.ganador && lectura.partidas.length > 2) {
            return alert("La serie ya terminó 2–0. Deja vacía la tercera partida.");
        }

        const serie = calcularSerie(lectura.partidas);

        partidas = serie.partidas.map(partida => ({
            g12: partida.g12,
            rival: partida.rival
        }));

        victoriasG12 = serie.victoriasG12;
        victoriasRival = serie.victoriasRival;
        ganadorSerie = serie.ganador;

        if (ganadorSerie === "G12 Gaming") {
            resultadoFinal = "Campeón";
        }

        if (ganadorSerie === "Rival") {
            resultadoFinal = "Subcampeón";
        }
    }

    const torneo = {
        id,
        nombre: valores.nombre.trim(),
        fecha: valores.fecha,
        hora: valores.hora,
        modo: valores.modo,
        jugadores: valores.jugadores.trim(),
        resultado: resultadoFinal,
        notas: valores.notas.trim(),
        rival,
        jugadoresG12: valores.jugadoresG12.trim(),
        jugadoresRival: valores.jugadoresRival.trim(),
        partidas,
        victoriasG12,
        victoriasRival,
        ganadorSerie
    };

    const indice = datos.torneos.findIndex(
        item => String(item.id) === String(id)
    );

    const datosAnteriores = datos;

    datos = {
        ...datos,
        torneos: indice >= 0
            ? datos.torneos.map((item, i) => i === indice ? torneo : item)
            : [...datos.torneos, torneo]
    };

    actualizarWeb();

    try {
        await guardarDatos();
        limpiarFormulario(formulario);
    } catch (_) {
        datos = datosAnteriores;
        actualizarWeb();
    }
}

/* GUARDAR TROFEO */

async function guardarTrofeo(evento) {
    evento.preventDefault();

    if (!esAdmin || usuarioActual?.uid !== ADMIN_UID) {
        return alert("Inicia sesión como administrador.");
    }

    const formulario = evento.currentTarget;
    const valores = obtenerFormulario(formulario);
    const id = valores.id || crearId();

    const trofeo = {
        id,
        nombre: valores.nombre.trim(),
        competicion: valores.competicion.trim(),
        fecha: valores.fecha,
        puesto: valores.puesto,
        jugadores: valores.jugadores.trim(),
        notas: valores.notas.trim()
    };

    const indice = datos.trofeos.findIndex(
        item => String(item.id) === String(id)
    );

    const datosAnteriores = datos;

    datos = {
        ...datos,
        trofeos: indice >= 0
            ? datos.trofeos.map((item, i) => i === indice ? trofeo : item)
            : [...datos.trofeos, trofeo]
    };

    actualizarWeb();

    try {
        await guardarDatos();
        limpiarFormulario(formulario);
    } catch (_) {
        datos = datosAnteriores;
        actualizarWeb();
    }
}

/* REGISTRO DE FORMULARIOS */

if (formularioJugador) {
    asegurarCamposEstadisticas();
    formularioJugador.addEventListener("submit", guardarJugador);
}

if (formularioTorneo) {
    formularioTorneo.addEventListener("submit", guardarTorneo);
}

const formularioTrofeo = document.getElementById("form-trofeo");

if (formularioTrofeo) {
    formularioTrofeo.addEventListener("submit", guardarTrofeo);
}

["jugador", "torneo", "trofeo"].forEach(tipo => {
    const boton = document.getElementById(`cancelar-${tipo}`);

    if (boton) {
        boton.addEventListener("click", () => {
            const formulario = document.getElementById(`form-${tipo}`);

            if (formulario) limpiarFormulario(formulario);
        });
    }
});

/* EDICIÓN Y ELIMINACIÓN */

document.addEventListener("click", async evento => {
    const boton = evento.target.closest("[data-action]");

    if (!boton) return;

    if (!esAdmin || usuarioActual?.uid !== ADMIN_UID) {
        alert("No tienes permisos para modificar el club.");
        return;
    }

    const { action, type, id } = boton.dataset;

    const coleccion = type === "jugador"
        ? "jugadores"
        : type === "torneo"
            ? "torneos"
            : type === "trofeo"
                ? "trofeos"
                : null;

    if (!coleccion) return;

    if (action === "edit") {
        prepararEdicion(type, id);
        return;
    }

    if (action !== "delete") return;

    const elemento = datos[coleccion].find(
        item => String(item.id) === String(id)
    );

    if (!elemento) return;

    const confirmar = confirm(
        `¿Seguro que quieres eliminar "${elemento.nombre || "este registro"}"? Esta acción no se puede deshacer.`
    );

    if (!confirmar) return;

    const datosAnteriores = datos;

    datos = {
        ...datos,
        [coleccion]: datos[coleccion].filter(
            item => String(item.id) !== String(id)
        )
    };

    actualizarWeb();

    try {
        await guardarDatos();

        const formulario = document.getElementById(
            type === "jugador"
                ? "form-jugador"
                : type === "torneo"
                    ? "form-torneo"
                    : "form-trofeo"
        );

        if (
            formulario?.elements.id &&
            formulario.elements.id.value === String(id)
        ) {
            limpiarFormulario(formulario);
        }
    } catch (_) {
        datos = datosAnteriores;
        actualizarWeb();
    }
});

/* ARRANQUE */

asegurarCamposEstadisticas();
actualizarAcceso();
actualizarWeb();
establecerEstado("Conectando con la base de datos del club...");
