/**
 * Dominio: Cálculo de asistencia y sueldos.
 * Lógica PURA (sin IO).
 *
 * La hora de apertura de caja = hora de entrada del trabajador.
 * Retraso = apertura después de (hora esperada + tolerancia).
 * Descuento: proporcional (valor hora × tiempo) o monto fijo por retraso.
 */

export interface ConfigTrabajador {
  horaIngreso: string;       // "HH:MM"
  horasDia: number;
  diasMes: number;
  sueldoMensual: number;
  tipoDescuento: "proporcional" | "fijo";
  montoDescuentoFijo: number;
  toleranciaMin: number;
}

export interface Apertura {
  fecha: string;             // "YYYY-MM-DD"
  horaApertura: string;      // "HH:MM:SS"
  horaCierre?: string;       // "HH:MM:SS"
}

export interface DiaCalculado {
  fecha: string;
  horaEntrada: string;
  horaSalida: string | null;
  minutosRetraso: number;
  horasTrabajadas: number;
}

export interface ResumenSueldo {
  diasTrabajados: number;
  horasTotales: number;
  cantidadRetrasos: number;
  minutosRetrasoTotal: number;
  valorHora: number;
  descuento: number;
  sueldoFinal: number;
  detalle: DiaCalculado[];
}

const redondear = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;
const aMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Calcula minutos de retraso de una apertura respecto a la config del trabajador. */
export function calcularRetraso(horaApertura: string, cfg: ConfigTrabajador): number {
  const esperado = aMinutos(cfg.horaIngreso);
  const real = aMinutos(horaApertura);
  return Math.max(0, real - esperado - cfg.toleranciaMin);
}

/** Calcula horas trabajadas entre apertura y cierre, manejando cruce de medianoche. */
export function calcularHoras(horaApertura: string, horaCierre?: string): number {
  if (!horaCierre) return 0;
  let diff = aMinutos(horaCierre) - aMinutos(horaApertura);
  if (diff < 0) diff += 24 * 60;     // cerró pasada la medianoche
  if (diff > 16 * 60) return 0;       // dato inconsistente, ignorar
  return redondear(diff / 60);
}

/** Construye el resumen mensual de sueldo a partir de las aperturas de caja. */
export function calcularResumenMensual(aperturas: Apertura[], cfg: ConfigTrabajador): ResumenSueldo {
  const detalle: DiaCalculado[] = aperturas.map((a) => ({
    fecha: a.fecha,
    horaEntrada: a.horaApertura,
    horaSalida: a.horaCierre || null,
    minutosRetraso: calcularRetraso(a.horaApertura, cfg),
    horasTrabajadas: calcularHoras(a.horaApertura, a.horaCierre),
  }));

  const diasTrabajados = detalle.length;
  const horasTotales = redondear(detalle.reduce((s, d) => s + d.horasTrabajadas, 0));
  const retrasos = detalle.filter((d) => d.minutosRetraso > 0);
  const minutosRetrasoTotal = detalle.reduce((s, d) => s + d.minutosRetraso, 0);

  const horasMes = cfg.horasDia * cfg.diasMes;
  const valorHora = horasMes > 0 ? cfg.sueldoMensual / horasMes : 0;

  let descuento = 0;
  if (cfg.tipoDescuento === "fijo") {
    descuento = retrasos.length * cfg.montoDescuentoFijo;
  } else {
    descuento = valorHora * (minutosRetrasoTotal / 60);
  }
  descuento = redondear(descuento);

  return {
    diasTrabajados,
    horasTotales,
    cantidadRetrasos: retrasos.length,
    minutosRetrasoTotal,
    valorHora: redondear(valorHora),
    descuento,
    sueldoFinal: redondear(cfg.sueldoMensual - descuento),
    detalle,
  };
}
