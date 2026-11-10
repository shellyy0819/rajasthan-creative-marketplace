/** Small scenes for the How it works page, drawn with the same stall classes (st-*) and animations as the hero. */
const Ground = () => (
  <>
    <path d="M10 280V120a190 190 0 0 1 380 0v160Z" className="st-f-sand" />
    <path d="M46 280V132a154 154 0 0 1 308 0v148Z" className="st-f-sage" opacity=".3" />
    <rect x="0" y="236" width="400" height="44" className="st-f-ground" />
  </>
);
const Person = ({ x, y = 0, shirt, bob = '' }: { x: number; y?: number; shirt: string; bob?: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <g className={`st-bob ${bob}`}>
      <rect x="-18" y="116" width="36" height="84" rx="16" className={`st-f-${shirt}`} />
      <circle cx="0" cy="98" r="17" className="st-f-skin" />
      <path d="M-18 96a18 18 0 0 1 36 0c-7-9-29-9-36 0z" className="st-f-hair" />
    </g>
  </g>
);
const Heart = ({ x, y, d = '' }: { x: number; y: number; d?: string }) => (
  <g transform={`translate(${x} ${y})`}><g className={`st-bob ${d}`}><path d="M0 6C-9-2-5-11 0-6 5-11 9-2 0 6Z" className="st-f-terra" /></g></g>
);
const Awning = ({ x, w }: { x: number; w: number }) => (
  <g>
    {Array.from({ length: Math.floor(w / 24) }, (_, i) => (
      <path key={i} d={`M${x + i * 24} 40h24v16a12 12 0 0 1-24 0z`} className={i % 2 ? 'st-f-mustard' : 'st-f-terra'} />
    ))}
  </g>
);
const Svg = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <svg className="help-scene" viewBox="0 0 400 280" role="img" aria-label={label} focusable="false">{children}</svg>
);

/** A shopper finds a handmade piece, likes it and contacts the maker. */
export function ShopperScene() {
  return (
    <Svg label="A shopper looks at a stall of handmade pots and taps contact on their phone">
      <Ground />
      <Awning x={190} w={192} />
      <rect x="196" y="56" width="180" height="8" className="st-f-woodd" />
      <rect x="196" y="64" width="6" height="172" className="st-f-woodd" />
      <rect x="370" y="64" width="6" height="172" className="st-f-woodd" />
      <rect x="202" y="168" width="168" height="8" className="st-f-wood" />
      <path d="M226 168c-10-18-8-44 6-52h24c14 8 16 34 6 52z" className="st-f-indigo" />
      <path d="M296 168c-6-16-2-34 12-40h20c14 6 18 24 12 40z" className="st-f-terra" />
      <circle cx="346" cy="152" r="14" className="st-f-mustard" /><circle cx="346" cy="152" r="5" className="st-f-green" />
      <rect x="202" y="176" width="168" height="60" className="st-f-paper" /><rect x="202" y="176" width="168" height="60" fill="none" className="st-s-line" />
      <path d="M0 0" />
      <Person x={104} shirt="green" />
      <g className="st-nod"><rect x="124" y="156" width="22" height="36" rx="4" className="st-f-board" /><rect x="127" y="160" width="16" height="22" rx="2" className="st-f-chalk" /><path d="M135 178c-5-3-6-8-3-10 2-1 3 0 3 1 0-1 1-2 3-1 3 2 2 7-3 10z" className="st-f-terra" /></g>
      <Heart x={150} y={110} /><Heart x={168} y={92} d="b2" />
      <g className="st-twinkle"><circle cx="40" cy="70" r="3" className="st-f-mustard" /></g><g className="st-twinkle d1"><circle cx="70" cy="40" r="2.5" className="st-f-terra" /></g>
    </Svg>
  );
}

/** A maker at the table with a finished piece and a message coming in. */
export function MakerScene() {
  return (
    <Svg label="A maker crocheting at a table while a customer message arrives">
      <Ground />
      <rect x="40" y="168" width="250" height="10" className="st-f-wood" />
      <rect x="52" y="178" width="8" height="58" className="st-f-woodd" /><rect x="270" y="178" width="8" height="58" className="st-f-woodd" />
      <Person x={150} y={-4} shirt="terra" />
      <rect x="40" y="168" width="250" height="10" className="st-f-wood" />
      <circle cx="108" cy="150" r="14" className="st-f-sage" /><circle cx="108" cy="150" r="14" fill="none" strokeWidth="2" strokeDasharray="3 3" className="st-s-chalk" />
      <path d="M200 168c-10-16-8-34 6-40h22c14 6 16 24 6 40z" className="st-f-indigo" />
      <rect x="236" y="144" width="28" height="24" rx="3" className="st-f-chalk" /><text x="250" y="161" textAnchor="middle" fontSize="12" fontWeight="700" className="st-t-terrad st-hand">₹</text>
      <g className="st-sway"><rect x="300" y="70" width="84" height="46" rx="12" className="st-f-chalk" /><path d="M324 116l-6 14 18-14z" className="st-f-chalk" />
        <text x="342" y="90" textAnchor="middle" fontSize="11" fontWeight="700" className="st-t-hair st-hand">Interested!</text>
        <text x="342" y="105" textAnchor="middle" fontSize="10" className="st-t-terrad st-hand">Can I order?</text></g>
      <g className="st-twinkle"><circle cx="318" cy="52" r="3" className="st-f-mustard" /></g>
    </Svg>
  );
}

/** A workshop host with a chalk sign and supplies laid out. */
export function HostScene() {
  return (
    <Svg label="A workshop host stands beside a chalkboard sign with craft supplies on the table">
      <Ground />
      <path d="M20 30Q200 66 380 30" fill="none" strokeWidth="1.5" className="st-s-woodd" />
      {[40, 100, 160, 220, 280, 340].map((x, i) => (
        <circle key={x} cx={x} cy={44 + Math.sin(i) * 3 + 8} r="5" className={`st-f-${['mustard', 'terra', 'sage'][i % 3]} st-twinkle${i % 2 ? ' d1' : ''}`} />
      ))}
      <g className="st-sway"><rect x="238" y="84" width="130" height="92" rx="6" className="st-f-board" /><rect x="238" y="84" width="130" height="92" rx="6" fill="none" strokeWidth="4" className="st-s-woodd" />
        <text x="303" y="112" textAnchor="middle" fontSize="13" fontWeight="700" className="st-t-chalk st-hand">WORKSHOP</text>
        <text x="303" y="134" textAnchor="middle" fontSize="12" className="st-t-mustard st-hand">Sat · 4 PM</text>
        <text x="303" y="154" textAnchor="middle" fontSize="11" className="st-t-chalk st-hand">8 seats</text></g>
      <rect x="262" y="176" width="6" height="60" className="st-f-woodd" /><rect x="338" y="176" width="6" height="60" className="st-f-woodd" />
      <rect x="30" y="178" width="190" height="8" className="st-f-wood" />
      <rect x="40" y="186" width="6" height="50" className="st-f-woodd" /><rect x="204" y="186" width="6" height="50" className="st-f-woodd" />
      <path d="M58 178c-4-10-3-20 4-24h14c7 4 8 14 4 24z" className="st-f-indigo" /><path d="M110 178c-4-10-3-20 4-24h14c7 4 8 14 4 24z" className="st-f-terra" />
      <circle cx="176" cy="164" r="14" className="st-f-sage" /><circle cx="196" cy="168" r="10" className="st-f-mustard" />
      <Person x={150} y={-34} shirt="indigo" />
      <g className="st-wave"><path d="M168 118l22-24" strokeWidth="6" strokeLinecap="round" fill="none" className="st-s-skin" /></g>
    </Svg>
  );
}

/** Attenders around a table with a reserved ticket. */
export function AttenderScene() {
  return (
    <Svg label="Three attendees make crafts at a shared table, with a reserved ticket above them">
      <Ground />
      <rect x="30" y="178" width="340" height="10" className="st-f-wood" />
      <rect x="44" y="188" width="8" height="48" className="st-f-woodd" /><rect x="348" y="188" width="8" height="48" className="st-f-woodd" />
      <Person x={100} y={-8} shirt="terra" bob="b1" />
      <Person x={200} y={-8} shirt="green" bob="b2" />
      <Person x={300} y={-8} shirt="mustard" bob="b3" />
      <rect x="30" y="178" width="340" height="10" className="st-f-wood" />
      <circle cx="100" cy="170" r="10" className="st-f-sage" /><rect x="188" y="158" width="24" height="20" rx="3" className="st-f-indigo" /><path d="M290 178c-2-8 2-16 10-16s12 8 10 16z" className="st-f-terra" />
      <g className="st-sway b"><rect x="136" y="36" width="130" height="52" rx="8" className="st-f-chalk" /><rect x="136" y="36" width="130" height="52" rx="8" fill="none" strokeWidth="1.5" className="st-s-line" />
        <circle cx="136" cy="62" r="7" className="st-f-ground" /><circle cx="266" cy="62" r="7" className="st-f-ground" />
        <text x="201" y="58" textAnchor="middle" fontSize="12" fontWeight="700" className="st-t-hair st-hand">Spot reserved</text>
        <text x="201" y="76" textAnchor="middle" fontSize="11" className="st-t-terrad st-hand">Sat · 4 PM</text></g>
      <g className="st-twinkle"><circle cx="60" cy="70" r="3" className="st-f-mustard" /></g><g className="st-twinkle d2"><circle cx="340" cy="90" r="3" className="st-f-terra" /></g>
    </Svg>
  );
}
