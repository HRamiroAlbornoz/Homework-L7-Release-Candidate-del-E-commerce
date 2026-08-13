import { z } from "zod";
import { CATEGORIES } from "@/constants/categories";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  type AllowedImageType,
} from "@/constants/uploads";

// Los ids de categoría salen de CATEGORIES, la única fuente de verdad del
// proyecto. z.enum sobre esa lista hace que agregar una categoría nueva allá la
// habilite acá automáticamente, y que un id inventado se rechace.
const categoryIds = CATEGORIES.map((category) => category.id);

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    // El límite de longitud no es cosmético: sin él, alguien puede enviar un
    // string de megabytes y hacer crecer la base sin control.
    .max(120, "El nombre no puede superar los 120 caracteres."),

  categoryId: z.enum(categoryIds as [string, ...string[]], {
    message: "Elegí una categoría de la lista.",
  }),

  price: z
    .number({ message: "El precio es obligatorio." })
    .positive("El precio debe ser mayor a 0.")
    .max(99_999_999, "El precio es demasiado alto."),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

/**
 * Valida el archivo de imagen elegido por el admin.
 *
 * Va aparte del schema de Zod porque un File es un objeto del navegador, no un
 * dato serializable: describirlo con Zod no aportaría nada y solo agregaría
 * ruido.
 *
 * IMPORTANTE: esta validación es de conveniencia, para avisarle al usuario antes
 * de que suba 40 MB al pedo. NO es la protección real. El `type` de un File lo
 * declara el navegador a partir de la extensión, y cualquiera puede renombrar
 * un .exe a .png. La validación que cuenta está en la Vercel Function, que es la
 * que decide si firma la subida o no.
 *
 * @returns el mensaje de error, o null si el archivo es aceptable.
 */
export function validateImageFile(file: File | null): string | null {
  if (file === null) {
    return "Elegí una imagen para el producto.";
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
    return "La imagen debe ser JPG, PNG o WebP.";
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return "La imagen no puede pesar más de 5 MB.";
  }

  return null;
}
