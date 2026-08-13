interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

// Input controlado y sin lógica propia: la página dueña del estado decide
// cuándo aplicar debounce y cuándo disparar la búsqueda real.
export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="search-bar">
      <label htmlFor="product-search">Buscar productos</label>
      <input
        id="product-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Nombre del producto (mínimo 2 caracteres)"
        aria-describedby="product-search-hint"
      />
      <span id="product-search-hint" className="visually-hidden">
        La búsqueda se aplica automáticamente después de dejar de escribir.
      </span>
    </div>
  );
}
