import { getCategoryLabel } from "../constants/categories";
import { AddToCartButton } from "../features/cart/components/AddToCartButton";
import { formatPrice } from "../lib/formatPrice";
import type { Product } from "../types/product";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const categoryLabel = getCategoryLabel(product.categoryId);

  return (
    <article className="product-card">
      {/*
        La imagen es opcional: los productos cargados por el seed no tienen, y
        solo los creados desde el panel de administración la traen.

        El alt es el nombre del producto a secas. No dice "Foto de..." porque el
        lector de pantalla ya anuncia que es una imagen — agregarlo sería como
        leer "link link".

        loading="lazy" hace que el navegador descargue la imagen recién cuando
        está por entrar en pantalla. En una grilla de 20 productos, eso evita 20
        descargas simultáneas de las cuales el usuario ve tres.
      */}
      {product.imageUrl !== undefined && (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="product-card__image"
          loading="lazy"
        />
      )}
      <h3 className="product-card__name">{product.name}</h3>
      <p className="product-card__category">{categoryLabel}</p>
      {product.price !== undefined && (
        <p className="product-card__price">{formatPrice(product.price)}</p>
      )}
      <AddToCartButton product={product} />
    </article>
  );
}
