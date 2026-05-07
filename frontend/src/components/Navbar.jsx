import { Link } from "react-router";
import { Show, SignInButton, useAuth, UserButton } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import {
  LogInIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  StoreIcon,
} from "lucide-react";

import { apiFetch } from "../lib/api";
import { useCart } from "../store/cart";

const Navbar = () => {
  const { getToken, isSignedIn } = useAuth();

  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/me", { getToken }),
    enabled: isSignedIn,
  });

  const role = meData?.user?.role;

  const cartCount = useCart((s) =>
    s.items.reduce((n, line) => n + line.quantity, 0),
  );

  return (
    <header className="sticky top-0 z-50 border-b shadow-sm backdrop-blur-md border-base-300 bg-base-100/95">
      <div className="navbar mx-auto min-h-14 max-w-7xl px-4 py-2.5 md:px-6 md:py-3">
        <div className="flex-1">
          <Link
            className="gap-2 px-2 font-mono text-lg font-semibold tracking-wide uppercase btn btn-ghost md:text-xl"
            to="/"
          >
            <span className="flex justify-center items-center p-1 rounded-lg size-10 bg-primary/15 text-primary">
              <StoreIcon aria-hidden className="size-8" />
            </span>
            <span className="leading-none">Northwind</span>
          </Link>
        </div>

        <nav className="flex items-center gap-1 md:gap-1.5">
          <Link className="gap-2 font-medium btn btn-ghost" to="/">
            <ShoppingBagIcon aria-hidden className="opacity-90 size-6" />
            <span className="hidden sm:inline">Shop</span>
          </Link>

          <Show when={"signed-in"}>
            <Link className="gap-2 font-medium btn btn-ghost" to="/orders">
              <PackageIcon aria-hidden className="opacity-90 size-6" />
              <span className="hidden sm:inline">Orders</span>
            </Link>

            {role === "admin" ? (
              <Link
                className="gap-2 font-medium btn btn-ghost text-secondary"
                to="/admin"
              >
                <SettingsIcon aria-hidden className="size-6" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            ) : null}
          </Show>

          <Link
            aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
            className="gap-2 font-medium btn btn-ghost indicator"
            to="/cart"
          >
            {cartCount > 0 ? (
              <span className="indicator-item badge badge-sm badge-primary min-w-2 px-1.5 font-sans text-xs tabular-nums">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
            <ShoppingCartIcon aria-hidden className="opacity-90 size-6" />
            <span className="hidden sm:inline">Cart</span>
          </Link>

          <Show when={"signed-out"}>
            <SignInButton mode="modal">
              <button
                className="btn btn-primary btn-sm gap-1.5 px-3 shadow-md"
                type="button"
              >
                <LogInIcon aria-hidden className="drop-shadow-sm size-4" />
                Sign in
              </button>
            </SignInButton>
          </Show>

          <Show when={"signed-in"}>
            <div className="flex gap-2 items-center pl-3 border-l border-base-300">
              <UserButton
                appearance={{
                  elements: { avatarBox: "h-10 w-10 ring-2 ring-base-300" },
                }}
              />
              {role === "support" || role === "admin" ? (
                <span className="hidden capitalize badge badge-primary badge-sm md:inline-flex">
                  {role}
                </span>
              ) : null}
            </div>
          </Show>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
