import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { CartState } from "@/features/cart/types";
import { db } from "@/lib/firebase";
import { ORDER_ERROR_CODES } from "@/lib/orderErrorCodes";
import { mapOrderError, OrderError } from "@/lib/orderErrors";

// Nombre de la colección en una constante: se usa acá y en firestore.rules, y
// tenerlo escrito a mano en varios lugares es la forma más fácil de que un día
// no coincidan.
export const ORDERS_COLLECTION = "orders";

/**
 * Crea una orden en Firestore a partir del carrito del usuario.
 *
 * @param userId  uid del usuario autenticado que hace la compra.
 * @param cart    estado actual del carrito (ítems + totales).
 * @returns       el id del documento de la orden recién creada.
 * @throws        OrderError con { code, message, retryable } — nunca un error crudo de Firebase.
 */
export async function createOrderFromCart(userId: string, cart: CartState): Promise<string> {
  // Validaciones de negocio ANTES de tocar la red. No es solo eficiencia: si se
  // dejara que Firestore rechace la escritura, el usuario recibiría un error de
  // permisos genérico en vez de saber que su carrito está vacío.
  if (userId.length === 0) {
    throw new OrderError(
      ORDER_ERROR_CODES.INVALID_ORDER,
      "Necesitás iniciar sesión para confirmar la compra.",
    );
  }

  if (cart.items.length === 0) {
    throw new OrderError(
      ORDER_ERROR_CODES.INVALID_ORDER,
      "No podés confirmar una compra con el carrito vacío.",
    );
  }

  try {
    const orderRef = await addDoc(collection(db, ORDERS_COLLECTION), {
      userId,
      items: cart.items,
      totalItems: cart.totalItems,
      totalPrice: cart.totalPrice,
      // El estado inicial lo fija el service, nunca lo recibe como parámetro:
      // así no existe ningún camino por el que alguien pueda crear una orden ya
      // marcada como pagada sin haber pagado.
      status: "created",
      // serverTimestamp() lo resuelve el SERVIDOR de Firestore, no el navegador.
      // Con new Date() la fecha saldría del reloj del usuario, que puede estar
      // mal configurado o manipulado, y el orden cronológico de las órdenes
      // dejaría de ser confiable.
      createdAt: serverTimestamp(),
    });

    return orderRef.id;
  } catch (error) {
    // Todo lo que salga de Firestore se traduce a un OrderError con mensaje en
    // español. El error original queda en "cause" para poder diagnosticarlo, sin
    // que su texto técnico llegue nunca a la pantalla.
    throw mapOrderError(error);
  }
}
