
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
    records: []
};

let detenerSincronizacion = null;

/* --------------------------------------------------
   UTILIDADES
-------------------------------------------------- */

function normalizarDatos(valor) {
    return {
        jugadores: Array.isArray(valor?.jugadores)
            ? valor.jugadores : [],
        torneos: Array.isArray(valor?.torneos)
            ? valor.torneos : [],
        trofeos: Array.isArray(valor?.trofeos)
            ? valor.trofeos : [],
        records: Array.isArray(valor?.records)
            ? valor.records : []
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

    if (partes.length !== 3) {
        return escapar(fecha);
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function mensajeVacio(texto) {
    return `<div class="empty-state">${escapar(texto)}</div>`;
}

function actualizarContadores() {
    const contadores = {
        "total-jugadores": datos.jugadores.length,
        "total-torneos": datos.torneos.length,
        "total-trofeos": datos.trofeos.length,
        "total-records": datos.records.length
    };

    for (const [id, cantidad] of Object.entries(contadores)) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = cantidad;
    }
}

/* --------------------------------------------------
   JUGADORES
-------------------------------------------------- */

function tarjetaJugador(jugador) {
    /*
     * Compatibilidad con jugadores anteriores:
     * rango y mmr se usan como alternativa si todavía
     * no existen rangoActual y mmrActual.
     */

    const rangoActual = jugador.rangoActual ?? jugador.rango;
    const mmrActual = jugador.mmrActual ?? jugador.mmr;

    return `
        <article class="data-card">
            <div class="card-topline">
                <div class="card-icon">G12</div>
                <span class="pill">
                    ${mostrarTexto(rangoActual, "Sin rango")}
                </span>
            </div>

            <h3>${mostrarTexto(jugador.nombre, "Jugador sin nombre")}</h3>

            <p>
                Rol:
                <strong>${mostrarTexto(jugador.posicion)}</strong>
            </p>

            <div class="player-stats">
                <p>
                    Rango actual:
                    <strong>${mostrarTexto(rangoActual, "Sin registrar")}</strong>
                </p>

                <p>
                    MMR actual:
                    <strong>${mostrarTexto(mmrActual, "Sin registrar")}</strong>
                </p>

                <p>
                    Rango peak:
                    <strong>${mostrarTexto(jugador.rangoPeak, "Sin registrar")}</strong>
                </p>

                <p>
                    MMR peak:
                    <strong>${mostrarTexto(jugador.mmrPeak, "Sin registrar")}</strong>
                </p>
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

/* --------------------------------------------------
   TORNEOS Y SERIES BO3
-------------------------------------------------- */

function obtenerPartidas(torneo) {
    if (Array.isArray(torneo.partidas)) {
        return torneo.partidas;
    }

    const partidas = [];

    for (let numero = 1; numero <= 3; numero++) {
        const g12 = torneo[`g12_${numero}`];
        const rival = torneo[`rival_${numero}`];

        if (
            g12 !== undefined && g12 !== null && g12 !== "" &&
            rival !== undefined && rival !== null && rival !== ""
        ) {
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
        ) {
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

/* --------------------------------------------------
   PALMARÉS
-------------------------------------------------- */

function tarjetaTrofeo(trofeo) {
    return `
        <article class="data-card">
            <div class="card-topline">
                <div class="card-icon">★</div>
                <span class="pill">
                    ${mostrarTexto(trofeo.puesto, "Logro")}
                </span>
            </div>

            <h3>${mostrarTexto(trofeo.nombre, "Logro sin nombre")}</h3>
            <p>Competición: ${mostrarTexto(trofeo.competicion)}</p>
            <p>Fecha: ${formatearFecha(trofeo.fecha)}</p>
            <p>Jugadores: ${mostrarTexto(trofeo.jugadores)}</p>

            ${trofeo.notas
                ? `<p>${mostrarTexto(trofeo.notas)}</p>`
                : ""}
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

/* --------------------------------------------------
   RÉCORDS
-------------------------------------------------- */

function renderRecords() {
    const contenedor = document.getElementById("lista-records");
    if (!contenedor) return;

    contenedor.innerHTML = datos.records.length
        ? datos.records.map(record => `
            <article class="data-card">
                <div class="card-topline">
                    <div class="card-icon">#</div>
                </div>

                <h3>${mostrarTexto(record.nombre || record.titulo, "Récord del club")}</h3>
                <p>${mostrarTexto(record.descripcion || record.valor, "Sin detalles")}</p>
            </article>
        `).join("")
        : mensajeVacio("Aquí aparecerán los récords y curiosidades del club.");
}

/* --------------------------------------------------
   ACTUALIZACIÓN DE LA WEB
-------------------------------------------------- */

function actualizarWeb() {
    actualizarContadores();
    renderJugadores();
    renderTorneos();
    renderTrofeos();
    renderRecords();
}

function establecerEstado(texto) {
    const elemento = document.getElementById("estado-datos");
    if (elemento) elemento.textContent = texto;
}

/* --------------------------------------------------
   LECTURA EN TIEMPO REAL
-------------------------------------------------- */

function iniciarSincronizacion() {
    if (detenerSincronizacion) {
        detenerSincronizacion();
        detenerSincronizacion = null;
    }

    detenerSincronizacion = documentoDatos.onSnapshot(
        snapshot => {
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
                records: []
            };

            actualizarWeb();
            establecerEstado("Todavía no hay datos registrados en el club.");
        },
        error => {
            console.error("Error leyendo Firestore:", error);
            establecerEstado(
                "No se pudieron cargar los datos. Comprueba la conexión y las reglas de Firestore."
            );
        }
    );
}

/* --------------------------------------------------
   ARRANQUE
-------------------------------------------------- */

actualizarWeb();
establecerEstado("Conectando con la base de datos del club...");
iniciarSincronizacion();
