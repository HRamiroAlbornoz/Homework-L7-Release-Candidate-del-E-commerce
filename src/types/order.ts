import { z } from "zod";
import { Timestamp } from "firebase/firestore";
import { cartItemSchema } from "@/features/cart/types";

// Estado de la orden. Unión cerrada (z.enum) y no un string libre: los estados
// posibles son un conjunto conocido, y con enum el compilador avisa si alguien
// escribe "payed" o "Paid".
//
// Solo existe "created" por ahora. Los otros dos están declarados porque la
// orden nace con la expectativa de avanzar: dejar el tipo preparado no cuesta
// nada y evita que quien agregue el pago tenga que tocar el schema base.
export const orderStatusSchema = z.enum(["created", "paid", "cancelled"]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

// Los ítems de la orden son EXACTAMENTE los ítems del carrito. Se reutiliza el
// schema en vez de escribir uno igual: si mañana un ítem suma un campo, la orden
// se entera sola y no quedan dos definiciones que se pisan.
//
// Guardar la foto completa (nombre y precio incluidos) y no solo los ids es
// deliberado: una orden es un registro histórico. Si dentro de un año cambia el
// precio del producto o se lo borra del catálogo, la orden tiene que seguir
// mostrando qué se compró y a cuánto.
export const orderItemSchema = cartItemSchema;

// Forma del documento tal como vive DENTRO de Firestore, sin "id" (el id no es
// un campo del documento: llega aparte, vía snapshot.id). Mismo criterio que
// productDocSchema y userDocSchema.
export const orderDocSchema = z.object({
  userId: z.string().min(1),
  // min(1): una orden sin ítems no tiene sentido de negocio, así que se rechaza
  // a nivel de schema en vez de confiar en que nadie la cree.
  items: z.array(orderItemSchema).min(1),
  totalItems: z.number().int().positive(),
  totalPrice: z.number().nonnegative(),
  status: orderStatusSchema,
  createdAt: z.custom<Timestamp>((value) => value instanceof Timestamp, {
    message: "createdAt debe ser un Timestamp de Firestore",
  }),
});

export type OrderDoc = z.infer<typeof orderDocSchema>;

// Forma completa que usa la app, con el id del documento ya incorporado.
export const orderSchema = orderDocSchema.extend({ id: z.string() });

export type Order = z.infer<typeof orderSchema>;
