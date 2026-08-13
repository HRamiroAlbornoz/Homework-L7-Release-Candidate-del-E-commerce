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
      <h3 className="product-card__name">{product.name}</h3>
      <p className="product-card__category">{categoryLabel}</p>
      {product.price !== undefined && (
        <p className="product-card__price">{formatPrice(product.price)}</p>
      )}
      <AddToCartButton product={product} />
    </article>
  );
}
