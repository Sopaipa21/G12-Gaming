
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
    records: [],
    ligaEquipos: [],
    ligaPartidos: []
};

let detenerSincronizacion = null;

/* NORMALIZACIÓN */

function normalizarEstadistica(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 ? Math.floor(numero) : 0;
}

function normalizarDatos(valor) {
    return {
        ...valor,
        jugadores: Array.isArray(valor?.jugadores)
            ? valor.jugadores.map(jugador => ({
                ...jugador,
                rangoActual: jugador.rangoActual ?? jugador.rango ?? "",
                mmrActual: jugador.mmrActual ?? jugador.mmr ?? null,
                rangoPeak: jugador.rangoPeak ?? "",
                mmrPeak: jugador.mmrPeak ?? null,
                goles: normalizarEstadistica(jugador.goles),
                asistencias: normalizarEstadistica(jugador.asistencias),
                salvadas: normalizarEstadistica(jugador.salvadas)
            }))
            : [],
        torneos: Array.isArray(valor?.torneos) ? valor.torneos : [],
        trofeos: Array.isArray(valor?.trofeos) ? valor.trofeos : [],
        torneosIndividuales: Array.isArray(valor?.torneosIndividuales)
            ? valor.torneosIndividuales
            : [],
        records: Array.isArray(valor?.records) ? valor.records : [],
        ligaEquipos: Array.isArray(valor?.ligaEquipos) ? valor.ligaEquipos : [],
        ligaPartidos: Array.isArray(valor?.ligaPartidos) ? valor.ligaPartidos : []
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

/* CONTADORES GENERALES */

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
    return `
        <article class="data-card player-card">
            <div class="card-topline player-card-top">
                <div class="card-icon player-emblem">G12</div>
                <span class="pill player-rank">
                    ${mostrarTexto(jugador.rangoActual ?? jugador.rango, "Sin rango actual")}
                </span>
            </div>

            <div class="player-identity">
                <h3>${mostrarTexto(jugador.nombre, "Jugador sin nombre")}</h3>
                <p class="player-role">${mostrarTexto(jugador.posicion, "Rol sin registrar")}</p>
            </div>

            <div class="player-stats">
                <div class="player-stat">
                    <span>MMR ACTUAL</span>
                    <strong>${mostrarTexto(jugador.mmrActual ?? jugador.mmr, "—")}</strong>
                </div>
                <div class="player-stat player-stat-peak">
                    <span>MMR MÁXIMO</span>
                    <strong>${mostrarTexto(jugador.mmrPeak, "—")}</strong>
                </div>
            </div>

            <div class="player-peak-rank">
                <span>RANGO MÁXIMO</span>
                <strong>${mostrarTexto(jugador.rangoPeak, "Sin registrar")}</strong>
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

/* ESTADÍSTICAS INDIVIDUALES */

function tarjetaEstadisticasIndividuales(jugador, indice, tipoOrden) {
    const estadisticas = [
        { clave: "goles", etiqueta: "GOLES", icono: "⚽" },
        { clave: "asistencias", etiqueta: "ASISTENCIAS", icono: "🎯" },
        { clave: "salvadas", etiqueta: "SALVADAS", icono: "🛡️" }
    ];

    return `
        <article class="data-card individual-stats-card">
            <div class="individual-stats-card-top">
                <span class="individual-rank">#${indice + 1}</span>
                <span class="pill">G12 PLAYER</span>
            </div>

            <h3>${mostrarTexto(jugador.nombre, "Jugador sin nombre")}</h3>
            <p class="individual-player-role">
                ${mostrarTexto(jugador.posicion, "Miembro de G12 Gaming")}
            </p>

            <div class="individual-stats-grid">
                ${estadisticas.map(estadistica => `
                    <div class="individual-stat ${tipoOrden === estadistica.clave ? "individual-stat-highlight" : ""}">
                        <span class="individual-stat-icon">${estadistica.icono}</span>
                        <span class="individual-stat-label">${estadistica.etiqueta}</span>
                        <strong>${normalizarEstadistica(jugador[estadistica.clave])}</strong>
                    </div>
                `).join("")}
            </div>
        </article>
    `;
}

function renderEstadisticasIndividuales() {
    const contenedor = document.getElementById("lista-estadisticas-individuales");
    if (!contenedor) return;

    contenedor.innerHTML = datos.jugadores.length
        ? datos.jugadores.map((jugador, indice) =>
            tarjetaEstadisticasIndividuales(jugador, indice, "")
        ).join("")
        : mensajeVacio("Todavía no hay jugadores registrados.");
}

const selectorEstadisticas = document.getElementById("orden-estadisticas");

if (selectorEstadisticas) {
    selectorEstadisticas.addEventListener("change", renderEstadisticasIndividuales);
}

/* TORNEOS DEL CLUB */

function tarjetaTorneo(torneo) {
    const nombre = torneo.nombre ?? torneo.titulo ?? torneo.competicion
        ?? torneo.nombreTorneo ?? "Torneo sin nombre";
    const competicion = torneo.competicion ?? torneo.nombreCompeticion ?? "";
    const resultado = torneo.resultado ?? torneo.puesto ?? torneo.posicion
        ?? torneo.clasificacion ?? "";
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

            ${competicion ? `<p>Competición: ${mostrarTexto(competicion)}</p>` : ""}
            ${resultado !== "" ? `<p>Resultado: <strong>${mostrarTexto(resultado)}</strong></p>` : ""}
            ${fecha ? `<p>Fecha: ${formatearFecha(fecha)}</p>` : ""}
            ${jugadores ? `<p>Jugadores: ${mostrarTexto(Array.isArray(jugadores) ? jugadores.join(", ") : jugadores)}</p>` : ""}
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
        torneo.jugadorNombre ?? torneo.jugador ?? torneo.nombreJugador ?? ""
    ).trim();
}

function obtenerTemporada(torneo) {
    if (torneo.temporada !== undefined &&
        torneo.temporada !== null &&
        String(torneo.temporada).trim() !== "") {
        return String(torneo.temporada).trim();
    }

    if (torneo.fecha) {
        const coincidencia = String(torneo.fecha).match(/^(\d{4})/);
        if (coincidencia) return coincidencia[1];
    }

    return "Sin temporada";
}

function obtenerTituloTorneoIndividual(torneo) {
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
                <p class="individual-tournament-result">${escapar(resultado)}</p>
                ${rango !== "" && puesto !== "" ? `<p>Rango: ${escapar(rango)}</p>` : ""}
                ${torneo.fecha ? `<p>Fecha: ${formatearFecha(torneo.fecha)}</p>` : ""}
                ${torneo.descripcion ? `<p>${mostrarTexto(torneo.descripcion)}</p>` : ""}
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
        if (!jugadores.has(clave)) jugadores.set(clave, { nombre, torneos: [] });
    }

    for (const torneo of datos.torneosIndividuales) {
        const nombre = obtenerNombreJugador(torneo);
        if (!nombre) continue;

        const clave = normalizarNombreJugador(nombre);
        if (!jugadores.has(clave)) jugadores.set(clave, { nombre, torneos: [] });

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

        const contenidoTemporadas = temporadasOrdenadas.map(([temporada, torneos]) => {
            const torneosOrdenados = [...torneos].sort((a, b) =>
                String(b.fecha || "").localeCompare(String(a.fecha || ""))
            );

            return `
                <section class="individual-season">
                    <h4 class="individual-season-title">
                        <span class="individual-season-icon">◆</span>
                        ${escapar(temporada === "Sin temporada" ? temporada : `Temporada ${temporada}`)}
                        <span class="individual-season-count">
                            ${torneos.length} ${torneos.length === 1 ? "torneo" : "torneos"}
                        </span>
                    </h4>
                    <div class="individual-tournaments-list">
                        ${torneosOrdenados.map(tarjetaIndividual).join("")}
                    </div>
                </section>
            `;
        }).join("");

        return `
            <details class="individual-player" id="jugador-individual-${indice}">
                <summary class="individual-player-summary">
                    <span class="individual-player-icon">G12</span>
                    <span class="individual-player-name">
                        <strong>${escapar(jugador.nombre)}</strong>
                        <span class="individual-player-subtitle">
                            ${jugador.torneos.length}
                            ${jugador.torneos.length === 1 ? "torneo individual" : "torneos individuales"}
                        </span>
                    </span>
                    <span class="individual-player-arrow" aria-hidden="true">⌄</span>
                </summary>
                <div class="individual-player-content">
                    ${jugador.torneos.length
                        ? contenidoTemporadas
                        : `<div class="individual-empty">Este jugador todavía no tiene torneos individuales registrados.</div>`}
                </div>
            </details>
        `;
    }).join("");
}

/* LIGA */

function obtenerNombreEquipoLiga(id, nombreGuardado) {
    const equipo = datos.ligaEquipos.find(
        equipo => String(equipo.id) === String(id)
    );

    return equipo?.nombre || nombreGuardado || "Equipo desconocido";
}

function crearDetalleEstadistica(etiqueta, valor) {
    const texto = String(valor ?? "").trim();
    if (!texto) return "";

    return `
        <div class="league-stat-line">
            <span class="league-stat-label">${escapar(etiqueta)}</span>
            <span class="league-stat-value">${escapar(texto)}</span>
        </div>
    `;
}

function tarjetaResultadoLiga(partido) {
    const equipo1 = obtenerNombreEquipoLiga(partido.equipo1Id, partido.equipo1Nombre);
    const equipo2 = obtenerNombreEquipoLiga(partido.equipo2Id, partido.equipo2Nombre);

    const goles1 = Number(partido.goles1);
    const goles2 = Number(partido.goles2);

    const marcadorValido = Number.isInteger(goles1) &&
        Number.isInteger(goles2) && goles1 >= 0 && goles2 >= 0;

    const resultado1 = marcadorValido ? goles1 : "—";
    const resultado2 = marcadorValido ? goles2 : "—";

    const ganador1 = marcadorValido && goles1 > goles2;
    const ganador2 = marcadorValido && goles2 > goles1;

    const jornada = partido.jornada !== undefined &&
        partido.jornada !== null &&
        String(partido.jornada).trim() !== ""
        ? `JORNADA ${escapar(partido.jornada)}`
        : "PARTIDO DE LIGA";

    const detalles = [
        crearDetalleEstadistica("Goleadores · " + equipo1, partido.goleadores1),
        crearDetalleEstadistica("Goleadores · " + equipo2, partido.goleadores2),
        crearDetalleEstadistica("Asistencias · " + equipo1, partido.asistencias1),
        crearDetalleEstadistica("Asistencias · " + equipo2, partido.asistencias2),
        crearDetalleEstadistica("Notas del partido", partido.notas)
    ].filter(Boolean);

    const estadisticasHTML = detalles.length
        ? `
            <details class="league-result-stats">
                <summary>
                    <span>Ver estadísticas</span>
                    <span class="league-stats-arrow" aria-hidden="true">⌄</span>
                </summary>
                <div class="league-result-details">${detalles.join("")}</div>
            </details>
        `
        : `<div class="league-result-no-stats">No hay estadísticas adicionales registradas.</div>`;

    return `
        <article class="league-match-card">
            <div class="league-match-top">
                <span class="league-match-competition">
                    <span class="league-live-dot"></span>G12 GAMING
                </span>
                <span class="league-match-round">${jornada}</span>
            </div>

            <div class="league-match-scoreboard">
                <div class="league-match-team ${ganador1 ? "is-winner" : ""}">
                    <span class="league-match-team-name">${escapar(equipo1)}</span>
                    ${ganador1 ? '<span class="league-match-winner">VICTORIA</span>' : ""}
                </div>

                <div class="league-match-score">
                    <span class="${ganador1 ? "score-winner" : ""}">${resultado1}</span>
                    <span class="league-match-dash">:</span>
                    <span class="${ganador2 ? "score-winner" : ""}">${resultado2}</span>
                </div>

                <div class="league-match-team league-match-team-right ${ganador2 ? "is-winner" : ""}">
                    <span class="league-match-team-name">${escapar(equipo2)}</span>
                    ${ganador2 ? '<span class="league-match-winner">VICTORIA</span>' : ""}
                </div>
            </div>

            <div class="league-match-footer">
                <span class="league-match-date">
                    ${partido.fecha ? escapar(formatearFecha(partido.fecha)) : "Fecha no registrada"}
                </span>
                <span class="league-match-status">
                    ${marcadorValido ? "RESULTADO FINAL" : "MARCADOR PENDIENTE"}
                </span>
            </div>

            <div class="league-match-statistics">${estadisticasHTML}</div>
        </article>
    `;
}

function renderResultadosLiga() {
    const contenedor = document.getElementById("liga-resultados");
    if (!contenedor) return;

    const partidos = [...datos.ligaPartidos].sort((a, b) =>
        (Number(b.jornada) || 0) - (Number(a.jornada) || 0) ||
        String(b.fecha || "").localeCompare(String(a.fecha || ""))
    );

    const partidosValidos = partidos.filter(partido => {
        const tieneEquipo1 = datos.ligaEquipos.some(
            equipo => String(equipo.id) === String(partido.equipo1Id)
        );
        const tieneEquipo2 = datos.ligaEquipos.some(
            equipo => String(equipo.id) === String(partido.equipo2Id)
        );
        return tieneEquipo1 && tieneEquipo2;
    });

    contenedor.innerHTML = partidosValidos.length
        ? partidosValidos.map(tarjetaResultadoLiga).join("")
        : mensajeVacio("Todavía no hay partidos registrados.");
}

function actualizarContadoresLiga() {
    const partidos = document.getElementById("liga-total-partidos");
    const jornadas = document.getElementById("liga-total-jornadas");

    if (partidos) partidos.textContent = datos.ligaPartidos.length;

    if (jornadas) {
        const jornadasRegistradas = new Set(
            datos.ligaPartidos
                .map(partido => Number(partido.jornada))
                .filter(jornada => Number.isFinite(jornada) && jornada > 0)
        );

        jornadas.textContent = jornadasRegistradas.size;
    }
}

function renderLiga() {
    actualizarContadoresLiga();
    renderResultadosLiga();
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
    renderEstadisticasIndividuales();
    renderTorneos();
    renderTorneosIndividuales();
    renderTrofeos();
    renderLiga();
}

/* SINCRONIZACIÓN */

function establecerEstado(texto) {
    const elemento = document.getElementById("estado-datos");
    if (elemento) elemento.textContent = texto;
}

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

        datos = normalizarDatos({});
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
