
"use strict";

/*
 * G12 GAMING
 * Guardado local: g12-gaming-datos
 * Mantiene los datos existentes y añade los nuevos campos de las finales BO3.
 */

const CLAVE_DATOS = "g12-gaming-datos";

function cargarDatos() {
    try {
        const guardados = JSON.parse(localStorage.getItem(CLAVE_DATOS));

        if (guardados && typeof guardados === "object") {
            return {
                jugadores: Array.isArray(guardados.jugadores) ? guardados.jugadores : [],
                torneos: Array.isArray(guardados.torneos) ? guardados.torneos : [],
                trofeos: Array.isArray(guardados.trofeos) ? guardados.trofeos : [],
                records: Array.isArray(guardados.records) ? guardados.records : []
            };
        }
    } catch (error) {
        console.error("No se pudieron leer los datos guardados:", error);
    }

    return {
        jugadores: [],
        torneos: [],
        trofeos: [],
        records: []
    };
}

let datos = cargarDatos();

function crearId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function guardarDatos() {
    try {
        localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos));
    } catch (error) {
        console.error("No se pudieron guardar los datos:", error);
        alert("No se han podido guardar los datos. Comprueba el espacio disponible del navegador.");
    }
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

function contarTorneos() {
    return datos.torneos.length;
}

function contarTrofeos() {
    return datos.trofeos.length;
}

function actualizarContadores() {
    document.getElementById("total-jugadores").textContent = datos.jugadores.length;
    document.getElementById("total-torneos").textContent = contarTorneos();
    document.getElementById("total-trofeos").textContent = contarTrofeos();
    document.getElementById("total-records").textContent = datos.records.length;
}

function mensajeVacio(texto) {
    return `<div class="empty-state">${escapar(texto)}</div>`;
}

function botonesAccion(tipo, id) {
    return `
        <div class="card-actions">
            <button type="button" class="action-button"
                data-action="edit" data-type="${tipo}" data-id="${escapar(id)}">
                EDITAR
            </button>
            <button type="button" class="action-button delete"
                data-action="delete" data-type="${tipo}" data-id="${escapar(id)}">
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
                <span class="pill">${mostrarTexto(jugador.rango, "Sin rango")}</span>
            </div>
            <h3>${mostrarTexto(jugador.nombre, "Jugador sin nombre")}</h3>
            <p>Rol: ${mostrarTexto(jugador.posicion)}</p>
            <p>MMR: <strong>${mostrarTexto(jugador.mmr, "Sin registrar")}</strong></p>
            ${botonesAccion("jugador", jugador.id)}
        </article>
    `;
}

function renderJugadores() {
    const contenedor = document.getElementById("lista-jugadores");

    contenedor.innerHTML = datos.jugadores.length
        ? datos.jugadores.map(tarjetaJugador).join("")
        : mensajeVacio("Todavía no hay jugadores registrados. Añade el primero desde el panel de gestión.");
}

/* TORNEOS Y RESULTADOS BO3 */

function obtenerPartidas(torneo) {
    if (Array.isArray(torneo.partidas)) {
        return torneo.partidas;
    }

    // Compatibilidad con los registros antiguos que no guardaban marcadores.
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

    let ganador = "";

    if (victoriasG12 === 2) ganador = "G12 Gaming";
    if (victoriasRival === 2) ganador = "Rival";

    return {
        victoriasG12,
        victoriasRival,
        ganador,
        partidas: jugadas
    };
}

function resumenSerie(torneo) {
    const partidas = obtenerPartidas(torneo);
    const serie = calcularSerie(partidas);

    if (!partidas.length) return "";

    const resultados = serie.partidas.map((partida, indice) => {
        const ganoG12 = partida.g12 > partida.rival;

        return `
            <div class="match-result ${ganoG12 ? "won" : ""}">
                <span>Partida ${indice + 1}</span>
                <strong>${partida.g12} – ${partida.rival}</strong>
            </div>
        `;
    }).join("");

    let textoGanador = "Serie sin terminar";

    if (serie.ganador === "G12 Gaming") {
        textoGanador = "G12 Gaming gana " +
            `${serie.victoriasG12}–${serie.victoriasRival}`;
    } else if (serie.ganador === "Rival") {
        textoGanador = `${mostrarTexto(torneo.rival, "Rival")} gana ` +
            `${serie.victoriasRival}–${serie.victoriasG12}`;
    }

    return `
        <div class="match-results">${resultados}</div>
        <p><strong>${textoGanador}</strong></p>
        ${torneo.jugadoresG12 ? `<p>G12: ${mostrarTexto(torneo.jugadoresG12)}</p>` : ""}
        ${torneo.jugadoresRival ? `<p>Rival: ${mostrarTexto(torneo.jugadoresRival)}</p>` : ""}
    `;
}

function tarjetaTorneo(torneo) {
    const rival = torneo.rival
        ? `<p>Final contra: <strong>${mostrarTexto(torneo.rival)}</strong></p>`
        : "";

    return `
        <article class="history-card">
            <div class="history-main">
                <div class="card-topline">
                    <span class="pill">${mostrarTexto(torneo.modo, "Modo sin especificar")}</span>
                    <span class="section-tag">${formatearFecha(torneo.fecha)}</span>
                </div>
                <h3>${mostrarTexto(torneo.nombre, "Torneo sin nombre")}</h3>
                <p>Participantes G12: ${mostrarTexto(torneo.jugadores)}</p>
                ${rival}
                <p>Resultado: <strong>${mostrarTexto(torneo.resultado, "Sin resultado")}</strong></p>
                ${resumenSerie(torneo)}
                ${torneo.notas ? `<p class="history-notes">${mostrarTexto(torneo.notas)}</p>` : ""}
                ${botonesAccion("torneo", torneo.id)}
            </div>
            <div class="history-side">
                <span class="pill">${mostrarTexto(torneo.hora, "Hora no indicada")}</span>
            </div>
        </article>
    `;
}

function renderTorneos() {
    const contenedor = document.getElementById("lista-torneos");

    const ordenados = [...datos.torneos].sort((a, b) =>
        String(b.fecha || "").localeCompare(String(a.fecha || ""))
    );

    contenedor.innerHTML = ordenados.length
        ? ordenados.map(tarjetaTorneo).join("")
        : mensajeVacio("Todavía no hay torneos. Registra el próximo desde el panel de gestión.");
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
            ${botonesAccion("trofeo", trofeo.id)}
        </article>
    `;
}

function renderTrofeos() {
    const contenedor = document.getElementById("lista-trofeos");

    const ordenados = [...datos.trofeos].sort((a, b) =>
        String(b.fecha || "").localeCompare(String(a.fecha || ""))
    );

    contenedor.innerHTML = ordenados.length
        ? ordenados.map(tarjetaTrofeo).join("")
        : mensajeVacio("Los trofeos que consigas aparecerán aquí.");
}

/* RÉCORDS */

function renderRecords() {
    const contenedor = document.getElementById("lista-records");

    contenedor.innerHTML = datos.records.length
        ? datos.records.map(record => `
            <article class="data-card">
                <div class="card-topline"><div class="card-icon">#</div></div>
                <h3>${mostrarTexto(record.nombre || record.titulo, "Récord del club")}</h3>
                <p>${mostrarTexto(record.descripcion || record.valor, "Sin detalles")}</p>
            </article>
        `).join("")
        : mensajeVacio("Aquí aparecerán los récords y curiosidades del club cuando los registres.");
}

function actualizarWeb() {
    actualizarContadores();
    renderJugadores();
    renderTorneos();
    renderTrofeos();
    renderRecords();
}

/* CÁLCULO EN DIRECTO DEL MARCADOR BO3 */

const formularioTorneo = document.getElementById("form-torneo");

function leerMarcadoresFormulario() {
    const partidas = [];

    for (let numero = 1; numero <= 3; numero++) {
        const g12 = formularioTorneo.elements[`g12_${numero}`].value;
        const rival = formularioTorneo.elements[`rival_${numero}`].value;

        if (g12 === "" && rival === "") continue;

        if (g12 === "" || rival === "") {
            return { error: `Completa los dos marcadores de la partida ${numero}.` };
        }

        const golesG12 = Number(g12);
        const golesRival = Number(rival);

        if (!Number.isInteger(golesG12) || !Number.isInteger(golesRival) ||
            golesG12 < 0 || golesRival < 0 ||
            golesG12 > 99 || golesRival > 99) {
            return { error: `Los goles de la partida ${numero} deben estar entre 0 y 99.` };
        }

        if (golesG12 === golesRival) {
            return { error: `La partida ${numero} no puede acabar empatada.` };
        }

        partidas.push({ numero, g12: golesG12, rival: golesRival });
    }

    return { partidas };
}

function actualizarResumenFormulario() {
    const resultado = leerMarcadoresFormulario();

    const elementoG12 = document.getElementById("victorias-g12");
    const elementoRival = document.getElementById("victorias-rival");
    const elementoResultado = document.getElementById("resultado-serie");

    if (resultado.error) {
        elementoG12.textContent = "–";
        elementoRival.textContent = "–";
        elementoResultado.textContent = "Revisar marcadores";
        return;
    }

    const serie = calcularSerie(resultado.partidas);

    elementoG12.textContent = serie.victoriasG12;
    elementoRival.textContent = serie.victoriasRival;

    if (serie.ganador === "G12 Gaming") {
        elementoResultado.textContent = `G12 gana ${serie.victoriasG12}–${serie.victoriasRival}`;
    } else if (serie.ganador === "Rival") {
        elementoResultado.textContent = `Rival gana ${serie.victoriasRival}–${serie.victoriasG12}`;
    } else {
        elementoResultado.textContent = "Pendiente";
    }
}

[1, 2, 3].forEach(numero => {
    formularioTorneo.elements[`g12_${numero}`].addEventListener("input", actualizarResumenFormulario);
    formularioTorneo.elements[`rival_${numero}`].addEventListener("input", actualizarResumenFormulario);
});

/* FORMULARIOS: AÑADIR Y EDITAR */

function obtenerFormulario(form) {
    return Object.fromEntries(new FormData(form).entries());
}

function limpiarFormulario(form) {
    form.reset();
    form.elements.id.value = "";

    const botonCancelar = document.getElementById(`cancelar-${form.id.replace("form-", "")}`);
    if (botonCancelar) botonCancelar.classList.add("hidden");

    const botonGuardar = form.querySelector('button[type="submit"]');
    if (botonGuardar) {
        if (form.id === "form-jugador") botonGuardar.textContent = "GUARDAR JUGADOR";
        if (form.id === "form-torneo") botonGuardar.textContent = "GUARDAR TORNEO";
        if (form.id === "form-trofeo") botonGuardar.textContent = "GUARDAR LOGRO";
    }

    if (form.id === "form-torneo") actualizarResumenFormulario();
}

function prepararEdicion(tipo, id) {
    const coleccion = tipo === "jugador" ? "jugadores"
        : tipo === "torneo" ? "torneos"
        : "trofeos";

    const elemento = datos[coleccion].find(item => String(item.id) === String(id));
    if (!elemento) return;

    const formulario = document.getElementById(
        tipo === "jugador" ? "form-jugador"
            : tipo === "torneo" ? "form-torneo"
            : "form-trofeo"
    );

    formulario.reset();

    for (const campo of formulario.elements) {
        if (!campo.name) continue;

        if (campo.name in elemento && campo.type !== "button" && campo.type !== "submit") {
            campo.value = elemento[campo.name] ?? "";
        }
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

    const botonGuardar = formulario.querySelector('button[type="submit"]');
    botonGuardar.textContent = "GUARDAR CAMBIOS";

    formulario.scrollIntoView({ behavior: "smooth", block: "start" });
    formulario.elements.id.focus({ preventScroll: true });
}

function guardarJugador(evento) {
    evento.preventDefault();

    const formulario = evento.currentTarget;
    const valores = obtenerFormulario(formulario);
    const id = valores.id || crearId();

    const jugador = {
        id,
        nombre: valores.nombre.trim(),
        rango: valores.rango.trim(),
        mmr: valores.mmr === "" ? "" : Number(valores.mmr),
        posicion: valores.posicion.trim()
    };

    const indice = datos.jugadores.findIndex(item => String(item.id) === String(id));

    if (indice >= 0) datos.jugadores[indice] = jugador;
    else datos.jugadores.push(jugador);

    guardarDatos();
    actualizarWeb();
    limpiarFormulario(formulario);
}

function guardarTorneo(evento) {
    evento.preventDefault();

    const formulario = evento.currentTarget;
    const valores = obtenerFormulario(formulario);
    const id = valores.id || crearId();
    const rival = valores.rival.trim();

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
        alert("Escribe el nombre del equipo rival para guardar los marcadores de la final.");
        formulario.elements.rival.focus();
        return;
    }

    if (rival && !hayMarcadores) {
        alert("Has indicado un rival, pero no has introducido los marcadores de la final. Rellena al menos las dos primeras partidas o deja vacío el rival.");
        formulario.elements.g12_1.focus();
        return;
    }

    if (hayMarcadores) {
        const lectura = leerMarcadoresFormulario();

        if (lectura.error) {
            alert(lectura.error);
            return;
        }

        const introducidas = lectura.partidas;

        if (introducidas.length < 2) {
            alert("Una final BO3 necesita al menos dos partidas registradas.");
            return;
        }

        const primerasDos = calcularSerie(introducidas.slice(0, 2));

        if (!primerasDos.ganador && introducidas.length < 3) {
            alert("La serie va 1–1. Tienes que introducir el marcador de la tercera partida.");
            formulario.elements.g12_3.focus();
            return;
        }

        if (primerasDos.ganador && introducidas.length > 2) {
            alert("La serie ya terminó 2–0. Deja vacía la tercera partida.");
            return;
        }

        const serie = calcularSerie(introducidas);
        partidas = serie.partidas.map(partida => ({
            g12: partida.g12,
            rival: partida.rival
        }));

        victoriasG12 = serie.victoriasG12;
        victoriasRival = serie.victoriasRival;
        ganadorSerie = serie.ganador;

        if (ganadorSerie === "G12 Gaming") resultadoFinal = "Campeón";
        if (ganadorSerie === "Rival") resultadoFinal = "Subcampeón";
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

    const indice = datos.torneos.findIndex(item => String(item.id) === String(id));

    if (indice >= 0) datos.torneos[indice] = torneo;
    else datos.torneos.push(torneo);

    guardarDatos();
    actualizarWeb();
    limpiarFormulario(formulario);
}

function guardarTrofeo(evento) {
    evento.preventDefault();

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

    const indice = datos.trofeos.findIndex(item => String(item.id) === String(id));

    if (indice >= 0) datos.trofeos[indice] = trofeo;
    else datos.trofeos.push(trofeo);

    guardarDatos();
    actualizarWeb();
    limpiarFormulario(formulario);
}

document.getElementById("form-jugador").addEventListener("submit", guardarJugador);
document.getElementById("form-torneo").addEventListener("submit", guardarTorneo);
document.getElementById("form-trofeo").addEventListener("submit", guardarTrofeo);

document.getElementById("cancelar-jugador").addEventListener("click", () =>
    limpiarFormulario(document.getElementById("form-jugador"))
);

document.getElementById("cancelar-torneo").addEventListener("click", () =>
    limpiarFormulario(document.getElementById("form-torneo"))
);

document.getElementById("cancelar-trofeo").addEventListener("click", () =>
    limpiarFormulario(document.getElementById("form-trofeo"))
);

/* BOTONES DE EDITAR Y ELIMINAR */

document.addEventListener("click", evento => {
    const boton = evento.target.closest("[data-action]");
    if (!boton) return;

    const { action, type, id } = boton.dataset;

    const coleccion = type === "jugador" ? "jugadores"
        : type === "torneo" ? "torneos"
        : type === "trofeo" ? "trofeos"
        : null;

    if (!coleccion) return;

    if (action === "edit") {
        prepararEdicion(type, id);
        return;
    }

    if (action === "delete") {
        const elemento = datos[coleccion].find(item => String(item.id) === String(id));
        if (!elemento) return;

        const nombre = elemento.nombre || "este registro";

        if (!confirm(`¿Seguro que quieres eliminar "${nombre}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        datos[coleccion] = datos[coleccion].filter(item => String(item.id) !== String(id));

        guardarDatos();
        actualizarWeb();

        const formulario = document.getElementById(
            type === "jugador" ? "form-jugador"
                : type === "torneo" ? "form-torneo"
                : "form-trofeo"
        );

        if (formulario.elements.id.value === String(id)) {
            limpiarFormulario(formulario);
        }
    }
});

/* PREPARAR IDENTIFICADORES PARA REGISTROS ANTIGUOS SIN ID */

["jugadores", "torneos", "trofeos"].forEach(coleccion => {
    datos[coleccion] = datos[coleccion].map(elemento => ({
        ...elemento,
        id: elemento.id || crearId()
    }));
});

guardarDatos();
actualizarWeb();
