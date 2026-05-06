import { Link } from "react-router";
import { HeadphonesIcon, TruckIcon } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-base-300 bg-base-100">
      <div className="px-4 py-12 mx-auto max-w-7xl md:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex gap-2 items-center font-semibold text-base-content">
              <TruckIcon aria-hidden className="size-8 text-primary" />
              Northwind Supply
            </div>
            <p className="mt-3 text-sm leading-relaxed text-base-content/65">
              Curated hardware and workspace tools. Paid orders include priority
              support; chat with our team and join a video call when we share a
              link.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wider uppercase text-base-content/50">
              Shop
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link className="link link-hover text-base-content/80" to="/">
                  All products
                </Link>
              </li>
              <li>
                <Link
                  className="link link-hover text-base-content/80"
                  to="/cart"
                >
                  Cart
                </Link>
              </li>
              <li>
                <Link
                  className="link link-hover text-base-content/80"
                  to="/orders"
                >
                  Orders
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wider uppercase text-base-content/50">
              Support
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-base-content/70">
              <li className="flex gap-2 items-start">
                <HeadphonesIcon
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-primary"
                />
                <span>
                  Order-scoped chat after payment; video links shared in-thread.
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wider uppercase text-base-content/50">
              Company
            </h3>
            <p className="mt-3 text-sm text-base-content/65">
              Built for teams who care about clear specs, fast fulfillment, and
              human support when it matters.
            </p>
          </div>
        </div>

        <div className="pt-6 mt-10 space-y-4 border-t border-base-300">
          <p className="text-xs text-center text-base-content/50">
            © {new Date().getFullYear()} Northwind Supply · All prices in USD
          </p>
        </div>
      </div>
    </footer>
  );
}
