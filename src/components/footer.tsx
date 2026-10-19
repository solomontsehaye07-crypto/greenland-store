import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="display text-2xl font-extrabold text-green">Greenland</span>
          <p className="mt-2 max-w-xs text-sm text-muted">
            African, Asian and Latin American groceries, beauty and home décor — from our shop in Kaiserslautern to your kitchen.
          </p>
        </div>
        <div>
          <h3 className="text-base font-bold">Shop</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><Link href="/c/food" className="hover:text-green">Food</Link></li>
            <li><Link href="/c/beauty" className="hover:text-green">Beauty</Link></li>
            <li><Link href="/c/home-deco" className="hover:text-green">Home & Deco</Link></li>
            <li><Link href="/c/frozen" className="hover:text-green">Frozen food</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-base font-bold">Help</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><Link href="/legal/versand" className="hover:text-green">Delivery & pickup</Link></li>
            <li><Link href="/legal/widerruf" className="hover:text-green">Returns (Widerruf)</Link></li>
            <li>
              <a href="https://wa.me/4915213945662" className="hover:text-green">WhatsApp 0152 13945662</a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-base font-bold">Legal</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li><Link href="/legal/impressum" className="hover:text-green">Impressum</Link></li>
            <li><Link href="/legal/agb" className="hover:text-green">AGB</Link></li>
            <li><Link href="/legal/datenschutz" className="hover:text-green">Datenschutz</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">
        All prices include VAT, plus shipping. © {new Date().getFullYear()} Greenland Afro Asia Store, Kaiserslautern
      </div>
    </footer>
  );
}
