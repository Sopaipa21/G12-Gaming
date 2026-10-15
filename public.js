
"use strict";

/* G12 GAMING — Web pública conectada a Firestore */

const firebaseConfig = {
    apiKey: "AIzaSyA8YjGYef5Lj7412Z45-JOVxb7ZixCFuKs",
    authDomain: "g12-gaming.firebaseapp.com",
    projectId: "g12-gaming",
    storageBucket: "g12-gaming.firebasestorage.app",
    messagingSenderId: "718943523917",
    appId: "1:718943523917:web:791fada14e9f450f223804",
    measurementId: "G-7CQDJQ1HCS"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const documentoDatos = db.collection("g12").doc("datos");

let datos = {
    jugadores: [],
    torneos: [],
    trofeos: [],
    torneosIndividuales: [],
    records: []
};

let detenerSincronizacion = null;

/* NORMALIZACIÓN DE DATOS */

function normalizarDatos(valor) {
    return {
        jugadores: Array.isArray(valor?.jugadores)
            ? valor.jugadores.map(jugador => ({
                ...jugador,
                rangoActual: jugador.rangoActual ?? jugador.rango ?? "",
                mmrActual: jugador.mmrActual ?? jugador.mmr ?? null,
                rangoPeak: jugador.rangoPeak ?? "",
                mmrPeak: jugador.mmrPeak ?? null
            }))
            : [],

        torneos: Array.isArray(valor?.torneos) ? valor.torneos : [],
        trofeos: Array.isArray(valor?.trofeos) ? valor.trofeos : [],
        torneosIndividuales: Array.isArray(valor?.torneosIndividuales)
            ? valor.torneosIndividuales
            : [],
        records: Array.isArray(valor?.records) ? valor.records : []
    };
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

function mensajeVacio(texto) {
    return `<div class="empty-state">${escapar(texto)}</div>`;
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
        if (elemento) elemento.textContent = cantidad;
    }
}

/* JUGADORES */

function tarjetaJugador(jugador) {
    const rangoActual = jugador.rangoActual ?? jugador.rango;
    const mmrActual = jugador.mmrActual ?? jugador.mmr;
    const rangoPeak = jugador.rangoPeak;
    const mmrPeak = jugador.mmrPeak;

    return `
        <article class="data-card player-card">
            <div class="card-topline player-card-top">
                <div class="card-icon player-emblem">G12</div>
                <span class="pill player-rank">
                    ${mostrarTexto(rangoActual, "Sin rango actual")}
                </span>
            </div>

            <div class="player-identity">
                <h3>${mostrarTexto(jugador.nombre, "Jugador sin nombre")}</h3>
                <p class="player-role">
                    ${mostrarTexto(jugador.posicion, "Rol sin registrar")}
                </p>
            </div>

            <div class="player-stats">
                <div class="player-stat">
                    <span>MMR ACTUAL</span>
                    <strong>${mostrarTexto(mmrActual, "—")}</strong>
                </div>
                <div class="player-stat player-stat-peak">
                    <span>MMR MÁXIMO</span>
                    <strong>${mostrarTexto(mmrPeak, "—")}</strong>
                </div>
            </div>

            <div class="player-peak-rank">
                <span>RANGO MÁXIMO</span>
                <strong>${mostrarTexto(rangoPeak, "Sin registrar")}</strong>
            </div>
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

/* TORNEOS DEL CLUB */

function tarjetaTorneo(torneo) {
    const nombre = torneo.nombre
        ?? torneo.titulo
        ?? torneo.competicion
        ?? torneo.nombreTorneo
        ?? "Torneo sin nombre";

    const competicion = torneo.competicion
        ?? torneo.nombreCompeticion
        ?? "";

    const resultado = torneo.resultado
        ?? torneo.puesto
        ?? torneo.posicion
        ?? torneo.clasificacion
        ?? "";

    const fecha = torneo.fecha ?? "";
    const descripcion = torneo.descripcion ?? torneo.notas ?? "";
    const jugadores = torneo.jugadores ?? torneo.equipo ?? "";
    const estado = torneo.estado ?? torneo.formato ?? "";

    return `
        <article class="data-card tournament-card">
            <div class="card-topline">
                <div class="card-icon">🏆</div>
                <span class="pill">${mostrarTexto(estado, "Torneo")}</span>
            </div>

            <h3>${mostrarTexto(nombre, "Torneo sin nombre")}</h3>

            ${competicion
                ? `<p>Competición: ${mostrarTexto(competicion)}</p>`
                : ""}

            ${resultado !== ""
                ? `<p>Resultado: <strong>${mostrarTexto(resultado)}</strong></p>`
                : ""}

            ${fecha ? `<p>Fecha: ${formatearFecha(fecha)}</p>` : ""}

            ${jugadores
                ? `<p>Jugadores: ${mostrarTexto(
                    Array.isArray(jugadores) ? jugadores.join(", ") : jugadores
                )}</p>`
                : ""}

            ${descripcion ? `<p>${mostrarTexto(descripcion)}</p>` : ""}
        </article>
    `;
}

function renderTorneos() {
    const contenedor = document.getElementById("lista-torneos");
    if (!contenedor) return;

    const ordenados = [...datos.torneos].sort((a, b) =>
        String(b.fecha ?? "").localeCompare(String(a.fecha ?? ""))
    );

    contenedor.innerHTML = ordenados.length
        ? ordenados.map(tarjetaTorneo).join("")
        : mensajeVacio("Todavía no hay torneos registrados.");
}

/* TORNEOS INDIVIDUALES */

function normalizarNombreJugador(nombre) {
    return String(nombre ?? "").trim().toLocaleLowerCase("es");
}

function obtenerNombreJugador(torneo) {
    return String(
        torneo.jugadorNombre ??
        torneo.jugador ??
        torneo.nombreJugador ??
        ""
    ).trim();
}

function obtenerTemporada(torneo) {
    if (
        torneo.temporada !== undefined &&
        torneo.temporada !== null &&
        String(torneo.temporada).trim() !== ""
    ) {
        return String(torneo.temporada).trim();
    }

    if (torneo.fecha) {
        const coincidencia = String(torneo.fecha).match(/^(\d{4})/);
        if (coincidencia) return coincidencia[1];
    }

    return "Sin temporada";
}

function obtenerTituloTorneoIndividual(torneo) {
    // Comprobar primero el tipo evita mostrar un título antiguo incorrecto.
    if (torneo.tipoTorneo === "pentatlon") {
        return torneo.temporada
            ? `Pentatlón — Temporada ${torneo.temporada}`
            : "Pentatlón";
    }

    if (torneo.tipoTorneo === "temporada") {
        return `Torneo de temporada ${torneo.temporada || ""}`.trim();
    }

    if (torneo.tipoTorneo === "fin-semana") {
        return "Torneo de fin de semana";
    }

    return torneo.nombre && String(torneo.nombre).trim()
        ? String(torneo.nombre).trim()
        : "Torneo individual";
}

function tarjetaIndividual(torneo) {
    const titulo = obtenerTituloTorneoIndividual(torneo);
    const puesto = torneo.puesto ?? torneo.posicion ?? "";
    const rango = torneo.rango ?? "";

    const resultado = puesto !== ""
        ? `Puesto: ${puesto}`
        : rango !== ""
            ? `Rango conseguido: ${rango}`
            : "Resultado no registrado";

    return `
        <article class="individual-tournament">
            <div class="individual-tournament-icon">★</div>

            <div class="individual-tournament-info">
                <h4>${escapar(titulo)}</h4>

                <p class="individual-tournament-result">
                    ${escapar(resultado)}
                </p>

                ${rango !== "" && puesto !== ""
                    ? `<p>Rango: ${escapar(rango)}</p>`
                    : ""}

                ${torneo.fecha
                    ? `<p>Fecha: ${formatearFecha(torneo.fecha)}</p>`
                    : ""}

                ${torneo.descripcion
                    ? `<p>${mostrarTexto(torneo.descripcion)}</p>`
                    : ""}
            </div>
        </article>
    `;
}

function renderTorneosIndividuales() {
    const contenedor = document.getElementById("lista-torneos-individuales");
    if (!contenedor) return;

    const jugadores = new Map();

    for (const jugador of datos.jugadores) {
        const nombre = String(jugador.nombre ?? "").trim();
        if (!nombre) continue;

        const clave = normalizarNombreJugador(nombre);

        if (!jugadores.has(clave)) {
            jugadores.set(clave, { nombre, torneos: [] });
        }
    }

    for (const torneo of datos.torneosIndividuales) {
        const nombre = obtenerNombreJugador(torneo);
        if (!nombre) continue;

        const clave = normalizarNombreJugador(nombre);

        if (!jugadores.has(clave)) {
            jugadores.set(clave, { nombre, torneos: [] });
        }

        jugadores.get(clave).torneos.push(torneo);
    }

    const listaJugadores = [...jugadores.values()].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es")
    );

    if (!listaJugadores.length) {
        contenedor.innerHTML = mensajeVacio(
            "Todavía no hay jugadores ni torneos individuales registrados."
        );
        return;
    }

    contenedor.innerHTML = listaJugadores.map((jugador, indice) => {
        const grupos = new Map();

        for (const torneo of jugador.torneos) {
            const temporada = obtenerTemporada(torneo);

            if (!grupos.has(temporada)) grupos.set(temporada, []);
            grupos.get(temporada).push(torneo);
        }

        const temporadasOrdenadas = [...grupos.entries()].sort((a, b) => {
            if (a[0] === "Sin temporada") return 1;
            if (b[0] === "Sin temporada") return -1;

            return b[0].localeCompare(a[0], "es", { numeric: true });
        });

        const totalTorneos = jugador.torneos.length;

        const contenidoTemporadas = temporadasOrdenadas.map(
            ([temporada, torneos]) => {
                const torneosOrdenados = [...torneos].sort((a, b) =>
                    String(b.fecha || "").localeCompare(String(a.fecha || ""))
                );

                return `
                    <section class="individual-season">
                        <h4 class="individual-season-title">
                            <span class="individual-season-icon">◆</span>

                            ${escapar(
                                temporada === "Sin temporada"
                                    ? temporada
                                    : `Temporada ${temporada}`
                            )}

                            <span class="individual-season-count">
                                ${torneos.length}
                                ${torneos.length === 1 ? "torneo" : "torneos"}
                            </span>
                        </h4>

                        <div class="individual-tournaments-list">
                            ${torneosOrdenados.map(tarjetaIndividual).join("")}
                        </div>
                    </section>
                `;
            }
        ).join("");

        return `
            <details class="individual-player" id="jugador-individual-${indice}">
                <summary class="individual-player-summary">
                    <span class="individual-player-icon">G12</span>

                    <span class="individual-player-name">
                        <strong>${escapar(jugador.nombre)}</strong>
                        <span class="individual-player-subtitle">
                            ${totalTorneos}
                            ${totalTorneos === 1
                                ? "torneo individual"
                                : "torneos individuales"}
                        </span>
                    </span>

                    <span class="individual-player-arrow" aria-hidden="true">⌄</span>
                </summary>

                <div class="individual-player-content">
                    ${totalTorneos
                        ? contenidoTemporadas
                        : `<div class="individual-empty">Este jugador todavía no tiene torneos individuales registrados.</div>`
                    }
                </div>
            </details>
        `;
    }).join("");
}

/* PALMARÉS DEL CLUB */

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

            ${trofeo.notas ? `<p>${mostrarTexto(trofeo.notas)}</p>` : ""}
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
    renderTorneosIndividuales();
    renderTrofeos();
}

function establecerEstado(texto) {
    const elemento = document.getElementById("estado-datos");
    if (elemento) elemento.textContent = texto;
}

/* SINCRONIZACIÓN CON FIRESTORE */

function iniciarSincronizacion() {
    if (detenerSincronizacion) {
        detenerSincronizacion();
        detenerSincronizacion = null;
    }

    detenerSincronizacion = documentoDatos.onSnapshot(snapshot => {
        if (snapshot.exists) {
            datos = normalizarDatos(snapshot.data());
            actualizarWeb();
            establecerEstado("Datos sincronizados con G12 Gaming.");
            return;
        }

        datos = {
            jugadores: [],
            torneos: [],
            trofeos: [],
            torneosIndividuales: [],
            records: []
        };

        actualizarWeb();
        establecerEstado("Todavía no hay datos registrados en el club.");
    }, error => {
        console.error("Error leyendo Firestore:", error);

        establecerEstado(
            "No se pudieron cargar los datos. Comprueba la conexión y las reglas de Firestore."
        );
    });
}

/* ARRANQUE */

actualizarWeb();
establecerEstado("Conectando con la base de datos del club...");
iniciarSincronizacion();
