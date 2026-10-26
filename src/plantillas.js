// Plantilla generada desde la pauta Word "Pauta_CdR_Dialogo_Desempeno_V3.docx".
// Se copia al crear un formulario nuevo desde plantilla; editarla acá no afecta a los formularios ya creados.
export const PLANTILLA_PAUTA_V3 = {
  "nombre": "Pauta de CdR — Diálogo de Desempeño V3.0",
  "descripcion": "Aplica solo a diálogos con personal de supervisión, jefes de área, superintendentes y/o gerentes (no personal operativo/mantenedor). Versión 3.0 propuesta, basada en V2.4.",
  "parametros": {
    "umbralEfectiva": 85,
    "umbralDesarrollo": 70
  },
  "seccionA": [
    {
      "id": "a1",
      "etiqueta": "Diálogo o rutina",
      "tipo": "rutina",
      "opciones": [],
      "obligatorio": true
    },
    {
      "id": "a2",
      "etiqueta": "Líder del diálogo",
      "tipo": "lider",
      "opciones": [],
      "obligatorio": true
    },
    {
      "id": "a3",
      "etiqueta": "Evaluador",
      "tipo": "evaluador",
      "opciones": [],
      "obligatorio": true
    },
    {
      "id": "a4",
      "etiqueta": "Fecha",
      "tipo": "fecha",
      "opciones": [],
      "obligatorio": true
    },
    {
      "id": "a5",
      "etiqueta": "Área",
      "tipo": "seleccion",
      "opciones": [
        "MIN",
        "MTTO",
        "PRO",
        "GRG"
      ],
      "obligatorio": true
    },
    {
      "id": "a6",
      "etiqueta": "Hora inicio según estándar",
      "tipo": "hora",
      "opciones": [],
      "obligatorio": true
    },
    {
      "id": "a7",
      "etiqueta": "Hora término según estándar",
      "tipo": "hora",
      "opciones": [],
      "obligatorio": true
    },
    {
      "id": "a8",
      "etiqueta": "N° de CdR a esta rutina (1ª, 2ª…)",
      "tipo": "numero",
      "opciones": [],
      "obligatorio": false
    },
    {
      "id": "a9",
      "etiqueta": "Fecha CdR anterior",
      "tipo": "fecha",
      "opciones": [],
      "obligatorio": false
    }
  ],
  "seccionB": {
    "horaAutomatica": true,
    "puntos": [
      {
        "id": "p1",
        "texto": "Hora real de inicio y de término: ¿puntual?",
        "criterio": "C5 · C17"
      },
      {
        "id": "p2",
        "texto": "Asistencia: convocados vs. presentes (o delegados)",
        "criterio": "C2"
      },
      {
        "id": "p3",
        "texto": "Tablero: ¿hay KPIs sin dato actualizado al inicio?",
        "criterio": "C4"
      },
      {
        "id": "p4",
        "texto": "Compromisos previos: ¿revisados? ¿atrasados? ¿con nueva fecha?",
        "criterio": "C8"
      },
      {
        "id": "p5",
        "texto": "KPIs con tendencia negativa: ¿tienen acción, responsable y fecha?",
        "criterio": "C10"
      },
      {
        "id": "p6",
        "texto": "Compromisos nuevos: ¿con responsable y fecha?",
        "criterio": "C12"
      },
      {
        "id": "p7",
        "texto": "Escalamientos recibidos de GCOM inferiores: ¿revisados con estado?",
        "criterio": "C7"
      },
      {
        "id": "p8",
        "texto": "Seguridad: ¿se revisaron eventos y el estado de sus acciones?",
        "criterio": "C6"
      },
      {
        "id": "p9",
        "texto": "Participación: intervenciones del líder vs. del equipo; ¿explicaron sus KPIs con datos?",
        "criterio": "C14"
      },
      {
        "id": "p10",
        "texto": "Temas escalados fuera de la sesión",
        "criterio": "C12 · C16"
      },
      {
        "id": "p11",
        "texto": "Temas que se extendieron más de ~3 min sin derivarse",
        "criterio": "C16"
      }
    ]
  },
  "bloques": [
    {
      "nombre": "Preparación y estructura",
      "criterios": [
        {
          "codigo": "C1",
          "nombre": "Estándar de agenda definido",
          "refV24": "P1",
          "nivel2": "Existe estándar escrito con objetivo, horario, participantes, secuencia y duración, y está disponible en la sesión.",
          "nivel1": "Existe estándar, pero le falta algún elemento o no está disponible en la sesión.",
          "nivel0": "No existe estándar definido.",
          "verificar": "Solicitar el estándar antes de la sesión y revisar los 5 elementos.",
          "critico": false,
          "admiteNA": false,
          "id": "c1",
          "peso": 20
        },
        {
          "codigo": "C2",
          "nombre": "Asistencia de participantes o delegados",
          "refV24": "P2",
          "nivel2": "Asisten todos los convocados o sus delegados formales.",
          "nivel1": "Falta 1 participante sin delegado.",
          "nivel0": "Faltan 2 o más sin delegado, o falta un dueño de KPI clave.",
          "verificar": "Convocados vs. presentes (Sección B).",
          "critico": false,
          "admiteNA": false,
          "id": "c2",
          "peso": 20
        },
        {
          "codigo": "C3",
          "nombre": "Preparación del líder",
          "refV24": "P3",
          "nivel2": "El líder conduce con el material listo y conoce el estado de KPIs y compromisos antes de que se presenten.",
          "nivel1": "Material listo, pero el líder se informa del estado durante la sesión.",
          "nivel0": "Improvisa: busca archivos, datos o información durante la reunión.",
          "verificar": "Observar los primeros 5 minutos y la conducción.",
          "critico": false,
          "admiteNA": false,
          "id": "c3",
          "peso": 20
        },
        {
          "codigo": "C4",
          "nombre": "Tablero actualizado antes de la rutina",
          "refV24": "P3",
          "nivel2": "Todos los KPIs con dato del período anterior cargado antes del inicio.",
          "nivel1": "Hasta 20% de los KPIs sin actualizar.",
          "nivel0": "Más de 20% sin actualizar, o se actualiza durante la reunión.",
          "verificar": "Revisar fecha del último dato de cada KPI antes del inicio (Sección B).",
          "critico": false,
          "admiteNA": false,
          "id": "c4",
          "peso": 20
        },
        {
          "codigo": "C5",
          "nombre": "Inicio puntual",
          "refV24": "P3 / P14",
          "nivel2": "Inicia dentro de ±5 min de la hora del estándar.",
          "nivel1": "Desviación de 6 a 10 min.",
          "nivel0": "Desviación mayor a 10 min.",
          "verificar": "Hora estándar vs. hora real (Sección B).",
          "critico": false,
          "admiteNA": false,
          "id": "c5",
          "peso": 20
        }
      ],
      "id": "b1",
      "peso": 29.4
    },
    {
      "nombre": "Seguridad y escalamientos desde niveles inferiores",
      "criterios": [
        {
          "codigo": "C6",
          "nombre": "Revisión de temas de seguridad",
          "refV24": "P4",
          "nivel2": "Se revisan los principales eventos/incidentes del período y el estado de sus acciones.",
          "nivel1": "Se menciona seguridad de forma general, sin revisar el estado de las acciones.",
          "nivel0": "No se trata seguridad.",
          "verificar": "Observar el bloque de seguridad: ¿se muestran acciones, dueños y estado?",
          "critico": true,
          "admiteNA": false,
          "id": "c6",
          "peso": 50
        },
        {
          "codigo": "C7",
          "nombre": "Compromisos escalados desde inicio de turno GCOM",
          "refV24": "P4",
          "nivel2": "Se revisan todos los escalamientos recibidos, mostrando dueño y estado de gestión.",
          "nivel1": "Se revisan parcialmente o sin mostrar su estado.",
          "nivel0": "No se revisan los escalamientos recibidos.",
          "verificar": "Escalamientos recibidos vs. revisados (Sección B). N/A si no hubo escalamientos.",
          "critico": false,
          "admiteNA": true,
          "id": "c7",
          "peso": 50
        }
      ],
      "id": "b2",
      "peso": 11.8
    },
    {
      "nombre": "Gestión del desempeño y compromisos",
      "criterios": [
        {
          "codigo": "C8",
          "nombre": "Revisión de compromisos previos",
          "refV24": "P5",
          "nivel2": "Se revisan todos; los atrasados quedan con causa y nueva fecha.",
          "nivel1": "Se revisan, pero los atrasados quedan sin causa o sin nueva fecha.",
          "nivel0": "No se revisan los compromisos previos.",
          "verificar": "Contrastar lista de compromisos con lo tratado (Sección B).",
          "critico": false,
          "admiteNA": false,
          "id": "c8",
          "peso": 16.7
        },
        {
          "codigo": "C9",
          "nombre": "KPIs alineados al árbol de valor y gestionables",
          "refV24": "P6",
          "nivel2": "Los KPIs están en el árbol de valor, son controlables por el equipo y generan discusión de mejora.",
          "nivel1": "Algunos KPIs no son controlables por el equipo, o solo se informan sin discusión.",
          "nivel0": "Los KPIs solo se leen; no hay vínculo con el árbol de valor ni discusión.",
          "verificar": "Comparar KPIs del tablero con el árbol de valor; observar si generan conversación.",
          "critico": false,
          "admiteNA": false,
          "id": "c9",
          "peso": 16.7
        },
        {
          "codigo": "C10",
          "nombre": "KPIs en rojo con acción definida",
          "refV24": "P7",
          "nivel2": "100% de los KPIs con tendencia negativa o acumulativa tienen acción con responsable y fecha.",
          "nivel1": "Entre 50% y 99% tienen acción completa.",
          "nivel0": "Menos de 50% tienen acción completa.",
          "verificar": "KPIs en rojo vs. KPIs con acción completa (Sección B). N/A si no hay KPIs en rojo.",
          "critico": true,
          "admiteNA": true,
          "id": "c10",
          "peso": 16.7
        },
        {
          "codigo": "C11",
          "nombre": "Explicación de causa de desviación",
          "refV24": "P8",
          "nivel2": "Cada dueño de KPI explica la causa con datos y propone acción para cerrar la brecha.",
          "nivel1": "Explica la causa sin datos, o sin acción.",
          "nivel0": "No sabe explicar la causa, o la explica el líder por él.",
          "verificar": "Columna \"¿Explicó su KPI con datos?\" (Sección B).",
          "critico": false,
          "admiteNA": false,
          "id": "c11",
          "peso": 16.7
        },
        {
          "codigo": "C12",
          "nombre": "Nuevos compromisos y escalamiento",
          "refV24": "P9",
          "nivel2": "Ante cada desviación nueva el líder promueve un compromiso con responsable y fecha, y escala lo que excede al equipo.",
          "nivel1": "Se generan compromisos sin responsable o fecha, o el escalamiento queda implícito.",
          "nivel0": "Desviaciones sin compromiso ni escalamiento.",
          "verificar": "Compromisos nuevos con responsable y fecha (Sección B).",
          "critico": false,
          "admiteNA": false,
          "id": "c12",
          "peso": 16.6
        },
        {
          "codigo": "C13",
          "nombre": "Alertas y riesgos del próximo período",
          "refV24": "P10",
          "nivel2": "Se identifican riesgos del próximo período con acción preventiva o dueño.",
          "nivel1": "Se mencionan riesgos, pero sin acción ni dueño.",
          "nivel0": "No se revisa el próximo período.",
          "verificar": "Observar si hay un momento explícito de anticipación.",
          "critico": false,
          "admiteNA": false,
          "id": "c13",
          "peso": 16.6
        }
      ],
      "id": "b3",
      "peso": 35.3
    },
    {
      "nombre": "Conducta del líder y dinámica",
      "criterios": [
        {
          "codigo": "C14",
          "nombre": "Participación significativa, sin monólogos",
          "refV24": "P11",
          "nivel2": "Todos los participantes con KPI intervienen; las intervenciones del líder son menos del ~40% del total.",
          "nivel1": "Participan solo algunos, o el líder domina partes de la reunión.",
          "nivel0": "Monólogo del líder.",
          "verificar": "Conteo de intervenciones (Sección B).",
          "critico": false,
          "admiteNA": false,
          "id": "c14",
          "peso": 25
        },
        {
          "codigo": "C15",
          "nombre": "Reconocimiento asociado a valores Glencore / propósito",
          "refV24": "P12",
          "nivel2": "Se reconoce al menos un logro o conducta específica (quién y qué hizo) vinculada a valores o propósito.",
          "nivel1": "Reconocimiento genérico (\"buen trabajo, equipo\").",
          "nivel0": "No hay reconocimiento.",
          "verificar": "Escuchar si el reconocimiento nombra persona y conducta.",
          "critico": false,
          "admiteNA": false,
          "id": "c15",
          "peso": 25
        },
        {
          "codigo": "C16",
          "nombre": "Secuencia y control del tiempo por tema",
          "refV24": "P13",
          "nivel2": "Se respeta la secuencia del estándar; ningún tema excede ~3 min sin derivarse.",
          "nivel1": "Se altera la secuencia, o 1 tema se extiende sin derivarse.",
          "nivel0": "2 o más temas se extienden sin derivarse, o se pierde la secuencia.",
          "verificar": "Registro de temas extendidos (Sección B).",
          "critico": false,
          "admiteNA": false,
          "id": "c16",
          "peso": 25
        },
        {
          "codigo": "C17",
          "nombre": "Término puntual",
          "refV24": "P14",
          "nivel2": "Termina dentro de ±5 min de la hora del estándar.",
          "nivel1": "Desviación de 6 a 10 min.",
          "nivel0": "Desviación mayor a 10 min, o la reunión no tiene cierre.",
          "verificar": "Hora estándar vs. hora real (Sección B).",
          "critico": false,
          "admiteNA": false,
          "id": "c17",
          "peso": 25
        }
      ],
      "id": "b4",
      "peso": 23.5
    }
  ],
  "feedback": {
    "fortalezas": true,
    "oportunidades": true,
    "maxPorTipo": 2,
    "compromisoMejora": true,
    "seguimientoAnterior": true
  },
  "rutinas": []
};

export function formularioEnBlanco() {
  return {
    nombre: "Formulario nuevo",
    descripcion: "",
    parametros: { umbralEfectiva: 85, umbralDesarrollo: 70 },
    seccionA: [
      { id: "a1", etiqueta: "Diálogo o rutina", tipo: "rutina", opciones: [], obligatorio: true },
      { id: "a2", etiqueta: "Líder del diálogo", tipo: "lider", opciones: [], obligatorio: true },
      { id: "a3", etiqueta: "Evaluador", tipo: "evaluador", opciones: [], obligatorio: true },
      { id: "a4", etiqueta: "Fecha", tipo: "fecha", opciones: [], obligatorio: true },
    ],
    rutinas: [],
    seccionB: { puntos: [], horaAutomatica: true },
    bloques: [
      {
        id: "b1",
        nombre: "Bloque 1",
        peso: 100,
        criterios: [
          { id: "c1", codigo: "C1", nombre: "Criterio nuevo", refV24: "", nivel2: "", nivel1: "", nivel0: "", verificar: "", critico: false, admiteNA: false, peso: 100 },
        ],
      },
    ],
    feedback: { fortalezas: true, oportunidades: true, maxPorTipo: 2, compromisoMejora: true, seguimientoAnterior: true },
  };
}
