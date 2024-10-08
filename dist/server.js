"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ClsJugador {
    constructor(Ln_id, Lv_nombre, Lb_esCreador, Ln_puntaje = 0) {
        this.Ln_id = Ln_id;
        this.Lv_nombre = Lv_nombre;
        this.Lb_esCreador = Lb_esCreador;
        this.Ln_puntaje = Ln_puntaje;
    }
}
class ClsSala {
    constructor(Ln_id) {
        this.Ln_id = Ln_id;
        this.jugadores = [];
        this.Lv_preguntaActual = null;
        this.Ln_indicePregunta = 0;
        this.Lb_juegoIniciado = false;
        this.preguntasRealizadas = [];
    }
}
class ClsRespuesta {
    constructor(Lv_texto, Lb_esCorrecta) {
        this.Lv_texto = Lv_texto;
        this.Lb_esCorrecta = Lb_esCorrecta;
    }
}
class ClsPregunta {
    constructor(Lv_categoria, Ln_nivel, Lv_pregunta, Lv_respuestas, Lv_imagen) {
        this.Lv_categoria = Lv_categoria;
        this.Ln_nivel = Ln_nivel;
        this.Lv_pregunta = Lv_pregunta;
        this.Lv_respuestas = Lv_respuestas;
        this.Lv_imagen = Lv_imagen;
    }
}
class ClsServidorTrivia {
    constructor(Ln_puerto = process.env.PORT || 5000) {
        this.Ln_puerto = Ln_puerto;
        this.Gv_salas = {};
        this.Gv_preguntas = [];
        this.Lv_app = (0, express_1.default)();
        this.Gv_servidor = http_1.default.createServer(this.Lv_app);
        this.Gv_io = new socket_io_1.Server(this.Gv_servidor, {
            cors: {
                origin: "http://localhost:5173",
                methods: ["GET", "POST"],
            },
        });
        this.inicializarMiddlewares();
        this.inicializarEventosSocket();
        this.cargarPreguntas();
    }
    inicializarMiddlewares() {
        this.Lv_app.use((0, cors_1.default)());
    }
    inicializarEventosSocket() {
        this.Gv_io.on("connection", (Lv_socket) => {
            console.log("Un usuario conectado");
            Lv_socket.on("crearSala", (Lv_datos) => {
                this.manejarCrearSala(Lv_socket, Lv_datos);
            });
            Lv_socket.on("unirseSala", (Lv_datos) => {
                this.manejarUnirseSala(Lv_socket, Lv_datos);
            });
            Lv_socket.on("enviarMensaje", (Lv_datos) => {
                this.manejarEnviarMensaje(Lv_socket, Lv_datos);
            });
            Lv_socket.on("volverAlChat", (Lv_datos) => {
                this.manejarVolverAlChat(Lv_socket, Lv_datos.Lv_sala);
            });
            Lv_socket.on("iniciarJuego", (Ln_idSala) => {
                this.manejarIniciarJuego(Lv_socket, Ln_idSala);
            });
            Lv_socket.on("enviarRespuesta", (Lv_datos) => {
                this.manejarEnviarRespuesta(Lv_socket, Lv_datos);
            });
            Lv_socket.on("salirDeSala", (Lv_datos) => {
                this.manejarSalirDeSala(Lv_socket, Lv_datos);
            });
            Lv_socket.on("disconnect", () => {
                this.manejarDesconexion(Lv_socket);
            });
        });
    }
    manejarCrearSala(Lv_socket, Lv_datos) {
        const { Lv_nombreUsuario, Lv_sala } = Lv_datos;
        console.log(`${Lv_nombreUsuario} está creando la sala ${Lv_sala}`);
        if (this.Gv_salas[Lv_sala]) {
            Lv_socket.emit('salaYaExiste');
            return;
        }
        const Lv_jugador = new ClsJugador(Lv_socket.id, Lv_nombreUsuario, true);
        this.Gv_salas[Lv_sala] = new ClsSala(Lv_sala);
        this.Gv_salas[Lv_sala].jugadores.push(Lv_jugador);
        Lv_socket.join(Lv_sala);
        Lv_socket.emit('salaUnida', {
            jugadores: this.Gv_salas[Lv_sala].jugadores,
            Lb_esCreador: true
        });
        console.log(`Sala ${Lv_sala} creada`);
    }
    manejarUnirseSala(Lv_socket, Lv_datos) {
        const { Lv_nombreUsuario, Lv_sala } = Lv_datos;
        console.log(`${Lv_nombreUsuario} está uniéndose a la sala ${Lv_sala}`);
        if (!this.Gv_salas[Lv_sala]) {
            Lv_socket.emit('salaNoEncontrada');
            return;
        }
        if (this.Gv_salas[Lv_sala].Lb_juegoIniciado) {
            Lv_socket.emit('juegoEnProgreso', "La sala ya está en juego");
            return;
        }
        const Lv_jugador = new ClsJugador(Lv_socket.id, Lv_nombreUsuario, false);
        this.Gv_salas[Lv_sala].jugadores.push(Lv_jugador);
        Lv_socket.join(Lv_sala);
        Lv_socket.emit('salaUnida', {
            jugadores: this.Gv_salas[Lv_sala].jugadores,
            Lb_esCreador: false
        });
        this.Gv_io.to(Lv_sala).emit('jugadorUnido', this.Gv_salas[Lv_sala].jugadores);
        console.log(`La sala ${Lv_sala} ahora tiene ${this.Gv_salas[Lv_sala].jugadores.length} jugadores`);
    }
    manejarEnviarMensaje(Lv_socket, Lv_datos) {
        console.log(`Mensaje en la sala ${Lv_datos.Lv_sala} de ${Lv_datos.Lv_nombreUsuario}: ${Lv_datos.Lv_mensaje}`);
        this.Gv_io.to(Lv_datos.Lv_sala).emit('mensajeChat', { Lv_nombreUsuario: Lv_datos.Lv_nombreUsuario, Lv_mensaje: Lv_datos.Lv_mensaje });
    }
    manejarIniciarJuego(Lv_socket, Ln_idSala) {
        console.log(`Intentando iniciar el juego en la sala ${Ln_idSala}`);
        const Lv_sala = this.Gv_salas[Ln_idSala];
        if (Lv_sala && !Lv_sala.Lb_juegoIniciado) {
            if (Lv_sala.jugadores.length < 2) {
                console.log(`No hay suficientes jugadores para iniciar el juego en la sala ${Ln_idSala}`);
                Lv_socket.emit('jugadoresInsuficientes', 'Se necesitan al menos 2 jugadores para iniciar el juego.');
                return;
            }
            Lv_sala.Lb_juegoIniciado = true;
            Lv_sala.preguntasRealizadas = [];
            Lv_sala.jugadores.forEach(Lv_jugador => {
                Lv_jugador.Ln_puntaje = 0;
            });
            this.Gv_io.to(Ln_idSala).emit('juegoIniciado');
            this.Gv_io.to(Ln_idSala).emit('actualizarPuntajes', Lv_sala.jugadores);
            this.enviarSiguientePregunta(Ln_idSala);
        }
    }
    enviarSiguientePregunta(Ln_idSala) {
        const Lv_sala = this.Gv_salas[Ln_idSala];
        if (Lv_sala && Lv_sala.preguntasRealizadas.length < 10) {
            let Ln_indiceAleatorio;
            do {
                Ln_indiceAleatorio = Math.floor(Math.random() * this.Gv_preguntas.length);
            } while (Lv_sala.preguntasRealizadas.includes(Ln_indiceAleatorio));
            Lv_sala.preguntasRealizadas.push(Ln_indiceAleatorio);
            Lv_sala.Lv_preguntaActual = this.Gv_preguntas[Ln_indiceAleatorio];
            this.Gv_io.to(Ln_idSala).emit('nuevaPregunta', {
                Lv_pregunta: Lv_sala.Lv_preguntaActual.Lv_pregunta,
                Lv_respuestas: Lv_sala.Lv_preguntaActual.Lv_respuestas.map(r => r.Lv_texto),
                Lv_imagen: Lv_sala.Lv_preguntaActual.Lv_imagen,
                Ln_nivel: Lv_sala.Lv_preguntaActual.Ln_nivel,
                Lv_categoria: Lv_sala.Lv_preguntaActual.Lv_categoria,
                Ln_temporizador: 10,
                Ln_numeroPregunta: Lv_sala.preguntasRealizadas.length
            });
            clearTimeout(Lv_sala.Lv_tiempoEspera);
            Lv_sala.Lv_tiempoEspera = setTimeout(() => {
                if (this.Gv_salas[Ln_idSala]) {
                    this.enviarSiguientePregunta(Ln_idSala);
                }
            }, 10000);
        }
        else {
            this.finalizarJuego(Ln_idSala);
        }
    }
    manejarEnviarRespuesta(Lv_socket, Lv_datos) {
        const Lv_sala = this.Gv_salas[Lv_datos.Lv_sala];
        if (Lv_sala && Lv_sala.Lv_preguntaActual) {
            const Lv_jugador = Lv_sala.jugadores.find(j => j.Ln_id === Lv_socket.id);
            if (Lv_jugador) {
                const Lb_esCorrecta = Lv_sala.Lv_preguntaActual.Lv_respuestas[Lv_datos.Ln_indiceRespuesta].Lb_esCorrecta;
                if (Lb_esCorrecta) {
                    Lv_jugador.Ln_puntaje += 1;
                }
                const Lv_mensaje = Lb_esCorrecta ? '¡Respuesta correcta!' : 'Respuesta incorrecta';
                Lv_socket.emit('resultadoRespuesta', {
                    Lb_esCorrecto: Lb_esCorrecta,
                    Lv_mensaje: Lv_mensaje
                });
                this.Gv_io.to(Lv_datos.Lv_sala).emit('actualizarPuntajes', Lv_sala.jugadores);
                if (Lv_jugador.Ln_puntaje >= 5) {
                    this.finalizarJuego(Lv_datos.Lv_sala, Lv_jugador);
                }
                else {
                    clearTimeout(Lv_sala.Lv_tiempoEspera);
                    this.enviarSiguientePregunta(Lv_datos.Lv_sala);
                }
            }
        }
    }
    manejarSalirDeSala(Lv_socket, Lv_datos) {
        const { Lv_sala, Lv_nombreUsuario } = Lv_datos;
        console.log(`${Lv_nombreUsuario} está saliendo de la sala ${Lv_sala}`);
        const Lv_datosSala = this.Gv_salas[Lv_sala];
        if (Lv_datosSala) {
            const Lv_jugadorSaliente = Lv_datosSala.jugadores.find(Lv_jugador => Lv_jugador.Lv_nombre === Lv_nombreUsuario);
            Lv_datosSala.jugadores = Lv_datosSala.jugadores.filter(Lv_jugador => Lv_jugador.Lv_nombre !== Lv_nombreUsuario);
            Lv_socket.leave(Lv_sala);
            if (Lv_datosSala.jugadores.length === 0) {
                delete this.Gv_salas[Lv_sala];
            }
            else if (Lv_jugadorSaliente && Lv_jugadorSaliente.Lb_esCreador) {
                this.Gv_io.to(Lv_sala).emit('mensajeImportante', {
                    tipo: 'creadorSalio',
                    mensaje: 'El creador de la sala se ha ido. La sala se cerrará.'
                });
                this.Gv_io.to(Lv_sala).emit('cerrarSala');
                delete this.Gv_salas[Lv_sala];
            }
            else if (Lv_datosSala.Lb_juegoIniciado && Lv_datosSala.jugadores.length === 1) {
                this.finalizarJuego(Lv_sala);
            }
            else if (Lv_datosSala.jugadores.length > 0 && !Lv_datosSala.jugadores.some(j => j.Lb_esCreador)) {
                Lv_datosSala.jugadores[0].Lb_esCreador = true;
                this.Gv_io.to(Lv_sala).emit('nuevoCreador', Lv_datosSala.jugadores[0].Ln_id);
            }
            this.Gv_io.to(Lv_sala).emit('jugadorSalio', Lv_datosSala.jugadores);
        }
    }
    manejarDesconexion(Lv_socket) {
        console.log("Un usuario se ha desconectado");
        for (const Ln_idSala in this.Gv_salas) {
            const Lv_jugador = this.Gv_salas[Ln_idSala].jugadores.find(j => j.Ln_id === Lv_socket.id);
            if (Lv_jugador) {
                this.manejarSalirDeSala(Lv_socket, { Lv_sala: Ln_idSala, Lv_nombreUsuario: Lv_jugador.Lv_nombre });
            }
        }
    }
    manejarVolverAlChat(Lv_socket, Ln_idSala) {
        const Lv_sala = this.Gv_salas[Ln_idSala];
        if (Lv_sala) {
            Lv_sala.jugadores.forEach(Lv_jugador => {
                Lv_jugador.Ln_puntaje = 0;
            });
            Lv_sala.Lb_juegoIniciado = false;
            Lv_sala.preguntasRealizadas = [];
            this.Gv_io.to(Ln_idSala).emit('actualizarPuntajes', Lv_sala.jugadores);
        }
    }
    finalizarJuego(Ln_idSala, Lv_jugadorGanador) {
        const Lv_sala = this.Gv_salas[Ln_idSala];
        if (Lv_sala) {
            clearTimeout(Lv_sala.Lv_tiempoEspera);
            let Lv_ganadores = [];
            const Ln_puntajeMaximo = Math.max(...Lv_sala.jugadores.map(j => j.Ln_puntaje));
            if (Lv_jugadorGanador) {
                Lv_ganadores = [Lv_jugadorGanador];
            }
            else if (Ln_puntajeMaximo > 0) {
                Lv_ganadores = Lv_sala.jugadores.filter(j => j.Ln_puntaje === Ln_puntajeMaximo);
            }
            const Lb_esEmpate = Lv_ganadores.length > 1;
            this.Gv_io.to(Ln_idSala).emit('finJuego', {
                Lv_ganadores: Lb_esEmpate ? null : Lv_ganadores.map(g => g.Lv_nombre),
                Lb_esEmpate: Lb_esEmpate,
                Lv_puntajes: Lv_sala.jugadores,
                Ln_totalPreguntas: Lv_sala.preguntasRealizadas.length
            });
            Lv_sala.Lb_juegoIniciado = false;
        }
    }
    cargarPreguntas() {
        try {
            const Lv_archivoPreguntas = path_1.default.join(__dirname, 'questions.json');
            const Lv_datosPreguntas = JSON.parse(fs_1.default.readFileSync(Lv_archivoPreguntas, 'utf-8'));
            this.Gv_preguntas = Lv_datosPreguntas.map((p) => new ClsPregunta(p.Lv_categoria, p.Ln_nivel, p.Lv_pregunta, p.Lv_respuestas.map((r) => new ClsRespuesta(r.Lv_texto, r.Lb_esCorrecta)), p.Lv_imagen));
        }
        catch (error) {
            console.error('Error al cargar las preguntas:', error);
        }
    }
    iniciar() {
        this.Gv_servidor.listen(this.Ln_puerto, () => {
            console.log(`El servidor se está ejecutando en el puerto ${this.Ln_puerto}`);
        });
    }
}
const Gv_servidorTrivia = new ClsServidorTrivia();
Gv_servidorTrivia.iniciar();
