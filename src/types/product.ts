import { z } from "zod";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

// Forma completa de un producto tal como lo usa la app (incluye el "id" del documento).
export const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  nameLower: z.string().min(1),
  categoryId: z.string().min(1),
  price: z.number().nonnegative().optional(),
});

export type Product = z.infer<typeof productSchema>;

// Forma del documento tal como vive DENTRO de Firestore: sin "id",
// porque el id no es un campo del documento, es el identificador del documento
// (llega aparte, vía snapshot.id). Este schema es el que se usa para validar
// los datos crudos que devuelve Firestore antes de confiar en su forma.
export const productDocSchema = productSchema.omit({ id: true });

export type ProductDoc = z.infer<typeof productDocSchema>;

// Parámetros para pedir una página de productos al service.
// No se valida con Zod porque "cursor" es una instancia de clase del SDK
// de Firestore (QueryDocumentSnapshot), no un dato serializable como los demás campos.
export const productQueryParamsSchema = z.object({
  categoryId: z.string().optional(),
  searchPrefix: z.string().optional(),
  pageSize: z.number().int().positive(),
});

export type ProductQueryParams = z.infer<typeof productQueryParamsSchema> & {
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
};
