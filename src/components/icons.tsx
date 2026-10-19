// Line icons drawn for the shop (24px grid, 1.8 stroke). Names match the icon choices in the website editor.
const P: Record<string, React.ReactNode> = {
  truck: (<><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>),
  bag: (<><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>),
  bike: (<><circle cx="6" cy="16" r="3.2" /><circle cx="18" cy="16" r="3.2" /><path d="M6 16l4-7h5l3 7M10 9l-1.5-3H6M15 9l-2 7" /></>),
  snow: (<><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" /><path d="M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5" /></>),
  leaf: (<><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19c3-4 6-6 9-8" /></>),
  chat: (<><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>),
  shield: (<><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>),
  star: (<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z" />),
  gift: (<><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" /><path d="M12 7c-2-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3-2-5 1" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>),
  menu: (<path d="M4 7h16M4 12h16M4 17h16" />),
  close: (<path d="M6 6l12 12M18 6L6 18" />),
  arrowL: (<path d="M15 5l-7 7 7 7" />),
  arrowR: (<path d="M9 5l7 7-7 7" />),
  instagram: (<><rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17" cy="7" r=".6" /></>),
  facebook: (<path d="M14 8h3V4.5h-3c-2.5 0-4 1.6-4 4V11H7.5v3.5H10V20h3.5v-5.5H16l.5-3.5h-3V9c0-.6.4-1 1-1z" />),
  tiktok: (<path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.5 2.5 2.2 4 5 4.3" />),
  whatsapp: (<><path d="M4 20l1.2-3.8A8 8 0 1 1 8 19z" /><path d="M9 9c0 3 2 5.5 5.5 6l1.3-1.5-2-1-1 .8c-1-.5-2-1.5-2.4-2.5l.8-1-1-2z" /></>),
};

export function Icon({ name, size = 22, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {P[name] ?? P.star}
    </svg>
  );
}
