
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

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const documentoDatos = db.collection("g12").doc("datos");

let datos = {
    jugadores: [],
    torneos: [],
    trofeos: [],
    torneosIndividuales: [],
    
};

let detenerSincronizacion = null;

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
        <article class="data-card">
            <div class="card-topline">
                <div class="card-icon">G12</div>
                <span class="pill">${mostrarTexto(rangoActual, "Sin rango actual")}</span>
            </div>

            <h3>${mostrarTexto(jugador.nombre, "Jugador sin nombre")}</h3>
            <p>Rol: ${mostrarTexto(jugador.posicion)}</p>
            <p>MMR actual: <strong>${mostrarTexto(mmrActual, "Sin registrar")}</strong></p>
            <p>Rango peak: <strong>${mostrarTexto(rangoPeak, "Sin registrar")}</strong></p>
            <p>MMR peak: <strong>${mostrarTexto(mmrPeak, "Sin registrar")}</strong></p>
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
    if (Array.isArray(torneo.partidas)) return torneo.partidas;

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

        if (
            !Number.isInteger(partida.g12) ||
            !Number.isInteger(partida.rival) ||
            partida.g12 < 0 ||
            partida.rival < 0 ||
            partida.g12 === partida.rival
        ) continue;

        jugadas.push(partida);

        if (partida.g12 > partida.rival) victoriasG12++;
        else victoriasRival++;
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
        ${torneo.jugadoresG12 ? `<p>G12: ${mostrarTexto(torneo.jugadoresG12)}</p>` : ""}
        ${torneo.jugadoresRival ? `<p>Rival: ${mostrarTexto(torneo.jugadoresRival)}</p>` : ""}
    `;
}

function tarjetaTorneo(torneo) {
    return `
        <article class="history-card">
            <div class="history-main">
                <div class="card-topline">
                    <span class="pill">${mostrarTexto(torneo.modo, "Modo sin especificar")}</span>
                    <span class="section-tag">${formatearFecha(torneo.fecha)}</span>
                </div>

                <h3>${mostrarTexto(torneo.nombre, "Torneo sin nombre")}</h3>
                <p>Participantes G12: ${mostrarTexto(torneo.jugadores)}</p>

                ${torneo.rival ? `<p>Final contra: <strong>${mostrarTexto(torneo.rival)}</strong></p>` : ""}

                <p>Resultado: <strong>${mostrarTexto(torneo.resultado, "Sin resultado")}</strong></p>

                ${resumenSerie(torneo)}

                ${torneo.notas ? `<p class="history-notes">${mostrarTexto(torneo.notas)}</p>` : ""}
            </div>

            <div class="history-side">
                <span class="pill">${mostrarTexto(torneo.hora, "Hora no indicada")}</span>
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

/* TORNEOS INDIVIDUALES: LISTA DESPLEGABLE POR JUGADOR */

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
    if (torneo.nombre && String(torneo.nombre).trim()) {
        return String(torneo.nombre).trim();
    }

    if (torneo.tipoTorneo === "temporada") {
        return `Torneo de temporada ${torneo.temporada || ""}`.trim();
    }

    if (torneo.tipoTorneo === "fin-semana") {
        return "Torneo de fin de semana";
    }

    return "Torneo individual";
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

    /*
     * Incluye a todos los jugadores registrados, incluso si aún
     * no tienen torneos individuales.
     */
    const jugadores = new Map();

    for (const jugador of datos.jugadores) {
        const nombre = String(jugador.nombre ?? "").trim();
        if (!nombre) continue;

        const clave = normalizarNombreJugador(nombre);

        if (!jugadores.has(clave)) {
            jugadores.set(clave, {
                nombre,
                torneos: []
            });
        }
    }

    /*
     * Asocia cada torneo al jugador correspondiente.
     * También conserva registros de jugadores que ya no figuren
     * en la lista actual del roster.
     */
    for (const torneo of datos.torneosIndividuales) {
        const nombre = obtenerNombreJugador(torneo);
        if (!nombre) continue;

        const clave = normalizarNombreJugador(nombre);

        if (!jugadores.has(clave)) {
            jugadores.set(clave, {
                nombre,
                torneos: []
            });
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

            if (!grupos.has(temporada)) {
                grupos.set(temporada, []);
            }

            grupos.get(temporada).push(torneo);
        }

        const temporadasOrdenadas = [...grupos.entries()].sort((a, b) => {
            if (a[0] === "Sin temporada") return 1;
            if (b[0] === "Sin temporada") return -1;

            return b[0].localeCompare(a[0], "es", {
                numeric: true
            });
        });

        const totalTorneos = jugador.torneos.length;

        const contenidoTemporadas = temporadasOrdenadas.map(([temporada, torneos]) => {
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
                            ${totalTorneos} ${totalTorneos === 1 ? "torneo individual" : "torneos individuales"}
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

/* LECTURA EN TIEMPO REAL */

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
