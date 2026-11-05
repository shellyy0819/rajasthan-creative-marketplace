/** Illustration for /coming-soon: a stall being set up (boxes, string lights, a swinging "Opening soon" board). Decorative; styled by the .st-* classes shared with HeroStall. */
export function ComingSoonStall() {
  const lights = [[124, 247], [168, 255], [212, 260], [256, 263], [300, 264], [344, 263], [388, 260], [432, 255], [476, 247]];
  return (
    <svg className="hero-stall" viewBox="0 0 600 600" focusable="false" aria-hidden="true">
      <defs>
        <pattern id="st-cs-blk" width="30" height="30" patternUnits="userSpaceOnUse">
          <circle cx="15" cy="15" r="7" className="st-f-mustard" /><circle cx="15" cy="15" r="2.6" className="st-f-green" />
          <circle cx="0" cy="0" r="3" className="st-f-chalk" /><circle cx="30" cy="0" r="3" className="st-f-chalk" />
          <circle cx="0" cy="30" r="3" className="st-f-chalk" /><circle cx="30" cy="30" r="3" className="st-f-chalk" />
        </pattern>
      </defs>
      <path d="M14 600V310A286 286 0 0 1 586 310V600Z" className="st-f-sand" />
      <path d="M70 600V330A230 230 0 0 1 530 330V600Z" className="st-f-sage" opacity=".35" />

      <path d="M0 18Q300 64 600 18" fill="none" strokeWidth="1.5" className="st-s-woodd" />
      <path d="M27 23h18l-9 20z" className="st-f-terra" /><path d="M87 30h18l-9 20z" className="st-f-mustard" />
      <path d="M147 35h18l-9 20z" className="st-f-sage" /><path d="M207 38h18l-9 20z" className="st-f-indigo" />
      <path d="M267 41h18l-9 20z" className="st-f-terra" /><path d="M327 41h18l-9 20z" className="st-f-mustard" />
      <path d="M387 39h18l-9 20z" className="st-f-sage" /><path d="M447 35h18l-9 20z" className="st-f-indigo" />
      <path d="M507 29h18l-9 20z" className="st-f-terra" /><path d="M555 23h18l-9 20z" className="st-f-mustard" />

      <rect x="0" y="536" width="600" height="64" className="st-f-ground" />
      <rect x="84" y="150" width="432" height="328" className="st-f-paper" />
      <rect x="74" y="150" width="12" height="386" className="st-f-woodd" /><rect x="514" y="150" width="12" height="386" className="st-f-woodd" />

      {/* shelf 1: moving boxes, one open with a vase peeking out */}
      <rect x="84" y="330" width="432" height="8" className="st-f-wood" />
      <rect x="100" y="288" width="64" height="42" className="st-f-wood" /><path d="M100 306h64" strokeWidth="5" className="st-s-chalk" opacity=".7" fill="none" />
      <rect x="110" y="258" width="44" height="30" className="st-f-wood" /><path d="M110 270h44" strokeWidth="4" className="st-s-chalk" opacity=".7" fill="none" />
      <g className="st-bob"><path d="M214 268c-6 0-8-18 0-26h12c8 8 6 26 0 26z" className="st-f-indigo" /><rect x="212" y="238" width="16" height="5" rx="2" className="st-f-mustard" /></g>
      <rect x="190" y="276" width="60" height="54" className="st-f-wood" />
      <path d="M190 276l-14-14h30zM250 276l14-14h-30z" className="st-f-woodd" />
      <path d="M190 292h60" strokeWidth="2" className="st-s-woodd" fill="none" />
      <rect x="278" y="270" width="22" height="60" rx="11" className="st-f-mustard" /><rect x="304" y="282" width="22" height="48" rx="11" className="st-f-terra" />
      <rect x="330" y="296" width="22" height="34" rx="11" className="st-f-indigo" />
      <g transform="translate(404 330)"><rect x="-26" y="-34" width="52" height="34" className="st-f-wood" /><path d="M-26 -22h52" strokeWidth="5" className="st-s-chalk" opacity=".7" fill="none" />
        <rect x="-18" y="-48" width="36" height="12" rx="2" className="st-f-chalk" /><text x="0" y="-39.5" textAnchor="middle" fontSize="7" fontWeight="600" className="st-t-ink">FRAGILE</text></g>
      <path d="M456 330C452 312 458 300 466 298C474 300 480 312 476 330Z" className="st-f-terra" /><rect x="456" y="294" width="20" height="6" rx="3" className="st-f-terrad" />

      {/* shelf 2: still waiting for stock */}
      <rect x="84" y="410" width="432" height="8" className="st-f-wood" />
      <rect x="110" y="372" width="70" height="38" className="st-f-wood" /><path d="M110 388h70" strokeWidth="5" className="st-s-chalk" opacity=".7" fill="none" />
      <path d="M260 410L266 398H320L326 410Z" className="st-f-terra" /><path d="M264 398L270 386H316L322 398Z" className="st-f-sage" />
      <g className="st-sway"><rect x="396" y="340" width="34" height="46" rx="2" className="st-f-chalk" /><text x="413" y="360" textAnchor="middle" fontSize="8" fontWeight="600" className="st-t-ink">price</text><text x="413" y="374" textAnchor="middle" fontSize="8" fontWeight="600" className="st-t-terrad">₹ ?</text></g>

      {/* awning */}
      <path d="M96 112H492L526 150H62Z" className="st-f-green" />
      <path d="M62 150H120V206a29 29 0 0 1-58 0Z" className="st-f-terra" /><path d="M120 150H178V206a29 29 0 0 1-58 0Z" className="st-f-mustard" />
      <path d="M178 150H236V206a29 29 0 0 1-58 0Z" className="st-f-terra" /><path d="M236 150H294V206a29 29 0 0 1-58 0Z" className="st-f-mustard" />
      <path d="M294 150H352V206a29 29 0 0 1-58 0Z" className="st-f-terra" /><path d="M352 150H410V206a29 29 0 0 1-58 0Z" className="st-f-mustard" />
      <path d="M410 150H468V206a29 29 0 0 1-58 0Z" className="st-f-terra" /><path d="M468 150H526V206a29 29 0 0 1-58 0Z" className="st-f-mustard" />

      {/* string lights */}
      <path d="M80 238Q300 290 520 238" fill="none" strokeWidth="1.5" className="st-s-woodd" />
      {lights.map(([x, y], i) => <circle key={x} cx={x} cy={y + 5} r="4.5" className={`st-f-mustard st-twinkle${i % 3 ? ` d${i % 3}` : ''}`} />)}

      {/* sign */}
      <line x1="214" y1="104" x2="214" y2="113" strokeWidth="2" className="st-s-woodd" /><line x1="374" y1="104" x2="374" y2="113" strokeWidth="2" className="st-s-woodd" />
      <g className="st-sway">
        <rect x="184" y="62" width="220" height="42" rx="5" className="st-f-board" />
        <rect x="189" y="67" width="210" height="32" rx="3" fill="none" strokeWidth="1" className="st-s-mustard" opacity=".7" />
        <text x="294" y="89" textAnchor="middle" fontSize="15" fontWeight="600" letterSpacing="3" className="st-t-chalk">OPENING SOON</text>
      </g>

      {/* counter */}
      <rect x="150" y="440" width="80" height="38" className="st-f-wood" /><path d="M150 456h80" strokeWidth="5" className="st-s-chalk" opacity=".7" fill="none" />
      <path d="M190 440C184 424 192 414 200 412C208 414 214 424 210 440Z" className="st-f-green" />
      <rect x="64" y="478" width="472" height="14" rx="3" className="st-f-chalk" />
      <rect x="70" y="492" width="460" height="44" className="st-f-green" />
      <rect x="70" y="498" width="460" height="38" fill="url(#st-cs-blk)" />
      <rect x="70" y="526" width="460" height="10" className="st-f-terra" />

      <text x="300" y="574" textAnchor="middle" fontSize="17" fontStyle="italic" className="st-t-ink">Unpacking something handmade for you.</text>
    </svg>
  );
}
