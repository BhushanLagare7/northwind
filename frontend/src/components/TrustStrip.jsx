import {
  CreditCardIcon,
  HeadphonesIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "lucide-react";

/**
 * Displays a horizontal strip of trust-building features.
 * Includes icons and short descriptions for fulfillment, security, transparency, and support.
 */
const items = [
  {
    icon: TruckIcon,
    title: "Fulfillment",
    desc: "Structured catalog & inventory-ready model",
  },
  {
    icon: ShieldCheckIcon,
    title: "Secure pay",
    desc: "Encrypted payments and order confirmation",
  },
  {
    icon: CreditCardIcon,
    title: "Transparent",
    desc: "Prices in USD, tax where applicable",
  },
  {
    icon: HeadphonesIcon,
    title: "Human support",
    desc: "Order-scoped chat + optional video",
  },
];

/**
 * Displays a horizontal strip of trust-building features.
 * Includes icons and short descriptions for fulfillment, security, transparency, and support.
 */
export function TrustStrip() {
  return (
    <section className="grid gap-4 p-6 border rounded-box border-base-300 bg-base-100 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ icon, title, desc }) => {
        const IconCmp = icon;
        return (
          <div key={title} className="flex gap-3">
            <div className="flex justify-center items-center rounded-lg size-11 shrink-0 bg-primary/10 text-primary">
              <IconCmp aria-hidden className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base-content">{title}</h3>
              <p className="mt-0.5 text-sm text-base-content/65">{desc}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
