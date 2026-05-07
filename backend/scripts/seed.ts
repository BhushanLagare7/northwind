/**
 * @file seed.ts
 * @description Seeds the `products` table with the initial product catalog.
 * Runs as a one-off script — safe to re-run (upserts on `slug`).
 *
 * Usage: node scripts/seed.ts
 * Requires: DATABASE_URL set in .env
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import "dotenv/config";
import { products } from "../src/db/schema.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

/**
 * Static product catalog to seed.
 * Each entry maps 1-to-1 to a row in the `products` table.
 *
 * @type {Array<{
 *   slug: string,       - URL-safe unique identifier
 *   name: string,       - Display name
 *   category: string,   - Product category label
 *   description: string,- Marketing copy / feature list
 *   priceCents: number, - Price in the smallest currency unit (e.g. 24900 = $249.00)
 *   imageUrl: string    - Public image URL
 * }>}
 */
const CATALOG = [
  {
    slug: "aurora-headphones",
    name: "Aurora ANC Headphones",
    category: "Audio",
    description:
      "Hybrid active noise cancellation, 40mm titanium drivers, 32-hour battery (ANC on), multipoint Bluetooth 5.3, fold-flat case included. Tuned for balanced mids — ideal for travel and focused work.",
    priceCents: 24900,
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
  },
  {
    slug: "nova-watch",
    name: "Nova Smart Watch Pro",
    category: "Wearables",
    description:
      'Always-on AMOLED 1.4", SpO₂ & ECG-ready sensors, sleep stages, 5 ATM swim-proof, 18-day battery in saver mode. GPS + GLONASS for outdoor workouts.',
    priceCents: 19900,
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
  },
  {
    slug: "pulse-speaker",
    name: "Pulse Go Speaker",
    category: "Audio",
    description:
      "360° sound with dual passive radiators, IP67 dust/water, 14h playtime, stereo pairing. USB-C fast charge — party-ready footprint.",
    priceCents: 8900,
    imageUrl:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=80",
  },
  {
    slug: "vertex-laptop-stand",
    name: "Vertex Aluminum Stand",
    category: "Workspace",
    description:
      'Ergonomic 6-step height, silicone pads, supports up to 10 kg. Folds flat for commute. Fits 11–17" laptops.',
    priceCents: 7900,
    imageUrl:
      "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80",
  },
  {
    slug: "lumen-keyboard",
    name: "Lumen Mechanical Keyboard",
    category: "Workspace",
    description:
      "Hot-swappable linear switches, PBT keycaps, gasket mount, tri-mode (USB-C / BT / 2.4G). Per-key RGB with onboard profiles.",
    priceCents: 15900,
    imageUrl:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80",
  },
  {
    slug: "orbit-mouse",
    name: "Orbit Ergo Mouse",
    category: "Workspace",
    description:
      "Vertical 57° grip, silent main buttons, 4000 DPI sensor, 70-day battery, USB-C. Reduces wrist pronation during long sessions.",
    priceCents: 6900,
    imageUrl:
      "https://images.unsplash.com/photo-1527814050087-3793815479db?w=800&q=80",
  },
  {
    slug: "cascade-monitor-lamp",
    name: "Cascade Monitor Light Bar",
    category: "Workspace",
    description:
      "Asymmetric optics avoid screen glare, RA>95, auto-dimming via ambient sensor. Touch controls + warm/cool CCT presets.",
    priceCents: 9900,
    imageUrl:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80",
  },
  {
    slug: "ember-kettle",
    name: "Ember Smart Kettle",
    category: "Home",
    description:
      "Variable temperature 40–100°C, keep-warm 2h, stainless interior, boil-dry protection. App scheduling (Wi‑Fi).",
    priceCents: 12900,
    imageUrl:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&q=80",
  },
  {
    slug: "linen-air-purifier",
    name: "Linen HEPA Air Purifier",
    category: "Home",
    description:
      "CADR 350 m³/h, H13 HEPA + carbon, whisper 24 dB sleep mode, filter life indicator. Rooms up to 40 m².",
    priceCents: 22900,
    imageUrl:
      "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
  },
  {
    slug: "summit-backpack",
    name: "Summit 28L Backpack",
    category: "Travel",
    description:
      'Weatherproof shell, lay-flat laptop compartment (16"), luggage pass-through, recycled ripstop. 980 g.',
    priceCents: 13900,
    imageUrl:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
  },
  {
    slug: "voyage-organizer",
    name: "Voyage Tech Organizer",
    category: "Travel",
    description:
      "Ripstop panels, elastic grids for cables & adapters, RFID pocket, slim profile for carry-on.",
    priceCents: 4500,
    imageUrl:
      "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=800&q=80",
  },
  {
    slug: "apex-mirrorless",
    name: "Apex Mirrorless Body",
    category: "Cameras",
    description:
      "24 MP BSI sensor, 4K60 10-bit internal, 5-axis IBIS, dual SD. Weather-sealed magnesium chassis — body only.",
    priceCents: 149900,
    imageUrl:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80",
  },
  {
    slug: "prime-lens-35",
    name: "Prime 35mm f/1.4",
    category: "Cameras",
    description:
      "Nano-coated elements, linear AF motor, 0.25 m close focus, 67 mm filter thread. Street & low-light staple.",
    priceCents: 79900,
    imageUrl:
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&q=80",
  },
  {
    slug: "nimbus-hub",
    name: "Nimbus USB-C Hub",
    category: "Accessories",
    description:
      "2× USB-A 10 Gbps, HDMI 2.1 4K120, SD/microSD UHS-II, 100 W PD passthrough. Aluminum unibody, braided cable.",
    priceCents: 7900,
    imageUrl:
      "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80",
  },
  {
    slug: "solstice-power-bank",
    name: "Solstice 20K Power Bank",
    category: "Accessories",
    description:
      "20000 mAh, 140 W PD PPS, dual USB-C + USB-A, airline-safe. OLED charge readout, soft-touch shell.",
    priceCents: 8900,
    imageUrl:
      "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80",
  },
  {
    slug: "echo-earbuds",
    name: "Echo True Wireless",
    category: "Audio",
    description:
      "Adaptive ANC, spatial audio, 8h buds + 28h case, wireless charging. IPX4 sweat resistance.",
    priceCents: 17900,
    imageUrl:
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80",
  },
  {
    slug: "meridian-desk-mat",
    name: "Meridian Desk Mat XL",
    category: "Workspace",
    description:
      "900×400 mm vegan leather surface, anti-slip base, stitched edges. Coffee & pen safe.",
    priceCents: 5900,
    imageUrl:
      "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800&q=80",
  },
  {
    slug: "atlas-water-bottle",
    name: "Atlas Insulated Bottle",
    category: "Travel",
    description:
      "32 oz vacuum stainless, 24h cold / 12h hot, powder coat, leak-proof chug cap + optional straw.",
    priceCents: 3900,
    imageUrl:
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80",
  },
];

/**
 * Upserts every product in CATALOG into the `products` table.
 * Conflict resolution: if a row with the same `slug` already exists,
 * all mutable fields are overwritten — the slug itself is never changed.
 */
async function main() {
  // Attach fixed defaults (currency, active flag) not present in CATALOG entries
  const rows = CATALOG.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    description: p.description,
    priceCents: p.priceCents,
    currency: "usd",
    imageUrl: p.imageUrl,
    active: true,
  }));

  for (const row of rows) {
    await db
      .insert(products)
      .values(row)
      .onConflictDoUpdate({
        target: products.slug, // unique conflict key
        set: {
          name: row.name,
          category: row.category,
          description: row.description,
          priceCents: row.priceCents,
          currency: row.currency,
          imageUrl: row.imageUrl,
          active: row.active,
        },
      });
  }

  console.log(`Seed complete (${CATALOG.length} products upserted).`);

  // Release the connection pool so the process can exit cleanly
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
