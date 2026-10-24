import Link from "next/link";

export const metadata = { title: "Data & accuracy" };

const SOURCES = [
  ["Restaurant locations & hours", "OpenStreetMap contributors via the Overpass API (ODbL). Refreshed on a schedule; places that disappear are flagged for review, not silently deleted."],
  ["Chain menus", "Compiled from each chain's public menu. Item names and descriptions are reported, not verified per location."],
  ["Prices", "Marked Verified only when someone checked this location's price on a stated date. Otherwise they're Est. — a typical range, never a quote. Delivery apps usually charge more than in-store."],
  ["Delivery platforms", "DoorDash, Uber Eats and Grubhub don't offer public data access to apps like CRAVE, and we don't scrape them. We link to their search or to a store page an admin verified by hand. We can't see whether they deliver to your address, current fees or wait times."],
  ["Ratings & photos", "Shown only with their source (e.g. Google) when that integration is enabled. Meals without a licensed photo show a designed placeholder instead of a stock photo."],
  ["Your data", "Preferences stay on your device unless you sign in to sync. Location is used only to find nearby restaurants."],
];

export default function About() {
  return (
    <div className="mx-auto max-w-xl px-5 pb-16 pt-[calc(20px+var(--safe-top))]">
      <Link href="/profile" className="text-sm text-mute hover:text-bone">← Back</Link>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">Data & accuracy</h1>
      <p className="mt-3 text-dust">CRAVE would rather say &ldquo;we don&apos;t know&rdquo; than guess. Here&apos;s where everything comes from.</p>
      <dl className="mt-8 space-y-6">
        {SOURCES.map(([k, v]) => (
          <div key={k}>
            <dt className="font-semibold">{k}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-dust">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-10 text-xs text-mute">Map data © OpenStreetMap contributors, available under the Open Database License. CRAVE is not affiliated with any restaurant or delivery platform shown.</p>
    </div>
  );
}
