import { FirebaseError } from "firebase/app";
import { ORDER_ERROR_CODES, type OrderErrorCode } from "./orderErrorCodes";

/**
 * Error estructurado del checkout: { code, message, retryable }.
 *
 * Mismo criterio que AuthError (ver authErrors.ts): "code" es el contrato
 * estable, "message" es el texto humano que se muestra, y "cause" preserva el
 * error original para debug interno sin exponerlo nunca al usuario.
 *
 * "retryable" se suma acá porque en el checkout la diferencia importa de verdad:
 * ante un problema de red conviene ofrecer "Reintentar", mientras que ante un
 * carrito vacío o un permiso denegado reintentar solo repetiría el mismo error.
 * Sin este dato, quien consume el error tiene que adivinar.
 */
export class OrderError extends Error {
  readonly code: OrderErrorCode;
  readonly retryable: boolean;

  constructor(
    code: OrderErrorCode,
    message: string,
    options?: ErrorOptions & { retryable?: boolean },
  ) {
    super(message, options);
    this.name = "OrderError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }
}

/**
 * Traduce cualquier error que pueda salir de Firestore al crear una orden en un
 * OrderError con mensaje en español.
 *
 * Nunca se deja pasar el error crudo: los mensajes del SDK están en inglés, son
 * técnicos, y a veces revelan detalles internos (nombres de colecciones, reglas)
 * que no deberían llegar a la pantalla del usuario.
 */
export function mapOrderError(error: unknown): OrderError {
  // Un OrderError ya mapeado (por ejemplo, el de "carrito vacío" que lanza el
  // propio service) se devuelve tal cual, sin volver a envolverlo.
  if (error instanceof OrderError) {
    return error;
  }

  if (error instanceof FirebaseError) {
    if (error.code === "permission-denied") {
      return new OrderError(
        ORDER_ERROR_CODES.PERMISSION_DENIED,
        "No tenés permiso para crear esta orden. Iniciá sesión de nuevo e intentá otra vez.",
        { cause: error },
      );
    }

    if (error.code === "unavailable" || error.code === "deadline-exceeded") {
      return new OrderError(
        ORDER_ERROR_CODES.NETWORK_ERROR,
        "No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.",
        { cause: error, retryable: true },
      );
    }
  }

  return new OrderError(
    ORDER_ERROR_CODES.UNKNOWN_ERROR,
    "No pudimos confirmar tu compra. Intentá de nuevo en unos minutos.",
    { cause: error, retryable: true },
  );
}
