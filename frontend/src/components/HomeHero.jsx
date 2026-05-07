import { Link } from "react-router";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";

/**
 * The main hero section for the home page.
 * Features a rotating promotional banner and a quick overview of categories.
 */
export function HomeHero({ categories, loadingCategories }) {
  return (
    <section className="overflow-hidden relative border shadow-lg rounded-box border-base-300 bg-linear-to-br from-base-100 via-base-100 to-primary/10">
      <div
        aria-hidden
        className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl translate-x-1/4 -translate-y-1/4 bg-primary/10"
      />

      <div className="grid relative gap-8 p-8 md:grid-cols-2 md:items-center md:p-12 lg:p-14">
        <div className="text-left">
          <h1 className="text-3xl font-bold tracking-tight text-base-content md:text-4xl lg:text-5xl">
            Hardware &amp; workspace,{" "}
            <span className="text-primary">ready to ship</span>
          </h1>

          <p className="mt-4 max-w-lg text-base leading-relaxed text-base-content/70">
            Audio, wearables, workspace, and travel—curated for work and home.
            Secure checkout; after payment, use your order page for support chat
            and video.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <a className="gap-2 shadow-md btn btn-primary" href="#catalog">
              Shop catalog
              <ArrowRightIcon aria-hidden className="size-4" />
            </a>

            <Link className="btn btn-outline btn-primary" to="/cart">
              View cart
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="px-4 py-3 border shadow-sm stat rounded-box border-base-300 bg-base-100/80">
            <div className="text-xs uppercase stat-title text-base-content/50">
              Categories
            </div>

            <div className="text-2xl stat-value text-secondary">
              {loadingCategories ? (
                <span
                  aria-hidden
                  className="inline-block w-10 h-8 rounded skeleton"
                />
              ) : (
                categories.length
              )}
            </div>

            <div className="text-xs stat-desc">Curated groups</div>
          </div>

          <div className="px-4 py-3 border border-dashed rounded-box border-primary/30 bg-primary/5">
            <div className="flex gap-2 items-center text-sm font-medium text-base-content">
              <SparklesIcon aria-hidden className="size-4 text-primary" />
              Secure checkout · Priority support on paid orders
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
