import { getCategoryLabel } from "../constants/categories";
import type { Product } from "../types/product";

interface ProductCardProps {
  product: Product;
}

const priceFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

export function ProductCard({ product }: ProductCardProps) {
  const categoryLabel = getCategoryLabel(product.categoryId);

  return (
    <article className="product-card">
      <h3 className="product-card__name">{product.name}</h3>
      <p className="product-card__category">{categoryLabel}</p>
      {product.price !== undefined && (
        <p className="product-card__price">{priceFormatter.format(product.price)}</p>
      )}
    </article>
  );
}
