import { CatalogProductCard } from "../components/CatalogProductCard";
import { HomeHero } from "../components/HomeHero";
import { PageError } from "../components/PageError";
import { TrustStrip } from "../components/TrustStrip";
import { useHomeCatalog } from "../hooks/useHomeCatalog";

/**
 * Home page — renders the hero, trust strip, and a filterable product catalog.
 * Category filter state and product data are managed by `useHomeCatalog`.
 */
function HomePage() {
  const {
    products,
    categories,
    categoryChipsLoading, // true while category chip list is being fetched
    categoryFilter, // currently active category slug (empty string = "All")
    error,
    loadingCategories, // true while hero category data is loading
    loadingList, // true while the product grid is loading
    setCategory,
  } = useHomeCatalog();

  return (
    <div className="space-y-12">
      <HomeHero categories={categories} loadingCategories={loadingCategories} />

      <TrustStrip />

      {/* Filterable product catalog */}
      <section className="scroll-mt-24" id="catelag">
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-mono text-2xl font-bold uppercase text-base-content md:text-2xl">
            Catalog
          </h2>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-2">
            {/* "All" resets the active filter */}
            <button
              className={`btn btn-sm ${!categoryFilter ? "btn-primary" : "border btn-ghost border-base-300"}`}
              type="button"
              onClick={() => setCategory("")}
            >
              All
            </button>

            {/* Show skeleton placeholders while chips are loading */}
            {categoryChipsLoading
              ? [1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="w-20 h-8 rounded-lg skeleton"
                  />
                ))
              : categories.map((c) => (
                  <button
                    key={c}
                    className={`btn btn-sm ${categoryFilter === c ? "btn-primary" : "btn-ghost border border-base-300"}`}
                    type="button"
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
          </div>
        </div>

        {/* Product grid — handles loading, error, empty, and populated states */}
        {loadingList ? (
          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <li key={i}>
                <div className="w-full h-96 skeleton rounded-box" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <PageError message="We couldn't load products. Please try again in a moment." />
        ) : products.length === 0 ? (
          <div className="py-16 text-center border rounded-box border-base-300 bg-base-100 text-base-content/60">
            No products in this category yet.
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <li key={p.id}>
                <CatalogProductCard product={p} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default HomePage;
