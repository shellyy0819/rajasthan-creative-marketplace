import './CafeScene.css';

/**
 * A flat illustration for the empty /workshops page: three people crocheting and shaping pottery around a long café table, under bunting and
 * lamps, with a chalkboard sign. The sign says "Workshop live" (one) or "N workshops live" (several) when workshops are on today; otherwise "Stay Tuned!".
 * Every colour comes from a class in CafeScene.css, so it follows the site's light and dark themes.
 */
export function CafeScene({ liveCount = 0 }: { liveCount?: number }) {
  const many = liveCount >= 2 ? `${liveCount > 99 ? '99+' : liveCount} workshops` : '';
  const sign = liveCount <= 0 ? 'Stay Tuned!' : liveCount === 1 ? 'Workshop live' : `${many} live`;
  return (
    <div className="cafe-scene">
      <svg viewBox="0 0 560 420" preserveAspectRatio="xMidYMin meet" role="img" aria-label={`Three people crocheting and shaping pottery around a long table in a café, under bunting and hanging lamps, with a chalkboard sign that says ${sign}`}>
        <rect width="560" height="420" className="f-wall" />
        <rect y="340" width="560" height="80" className="f-floor" />
        <path d="M70 340V190A210 140 0 0 1 490 190V340Z" className="f-window s-line s-5" />
        <circle cx="404" cy="150" r="24" className="f-sun" />
        <path d="M72 302Q172 246 282 290T488 282V338H72Z" className="f-hill" />
        <path d="M72 322Q190 288 300 316T488 308V338H72Z" className="f-hill2" />
        <path d="M280 52V340M72 200H488" className="n-fill s-line s-3" />
        <path d="M20 30Q280 150 540 30" className="n-fill s-line s-2" />
        <path d="M66 51l14 0l-7 28z" className="f-orange" />
        <path d="M126 70l14 0l-7 28z" className="f-cup" />
        <path d="M186 82l14 0l-7 28z" className="f-sage" />
        <path d="M246 88l14 0l-7 28z" className="f-clay" />
        <path d="M306 87l14 0l-7 28z" className="f-orange" />
        <path d="M366 79l14 0l-7 28z" className="f-cup" />
        <path d="M426 65l14 0l-7 28z" className="f-sage" />
        <path d="M486 45l14 0l-7 28z" className="f-clay" />
        <path d="M130 0V114M430 0V114" className="n-fill s-line s-2" />
        <circle cx="130" cy="146" r="38" className="f-glow o-28" />
        <circle cx="430" cy="146" r="38" className="f-glow o-28" />
        <path d="M106 134A24 24 0 0 1 154 134Z" className="f-orange" />
        <path d="M406 134A24 24 0 0 1 454 134Z" className="f-orange" />
        <ellipse cx="130" cy="138" rx="14" ry="6" className="f-glow" />
        <ellipse cx="430" cy="138" rx="14" ry="6" className="f-glow" />
        <rect x="470" y="198" width="86" height="8" rx="3" className="f-clay" />
        <path d="M480 198l3-20h18l3 20z" className="f-orange" />
        <path d="M522 198l3-16h16l3 16z" className="f-sageD" />
        <ellipse cx="492" cy="166" rx="6" ry="13" className="f-green" transform="rotate(-18 492 178)" />
        <ellipse cx="500" cy="164" rx="6" ry="13" className="f-green" transform="rotate(18 500 178)" />
        <ellipse cx="533" cy="170" rx="5" ry="11" className="f-green" transform="rotate(-14 533 182)" />
        <ellipse cx="541" cy="170" rx="5" ry="11" className="f-green" transform="rotate(16 541 182)" />
        <ellipse cx="285" cy="345" rx="200" ry="10" className="f-shadow" />
        <rect x="160" y="212" width="58" height="82" rx="24" className="f-green" />
        <circle cx="189" cy="190" r="18" className="f-skin1" />
        <path d="M170 188a19 19 0 0 1 38 0q-19-9-38 0Z" className="f-hair" />
        <path d="M172 240Q176 262 204 268M206 240Q214 262 232 268" className="n-fill s-skin1 s-9 cap" />
        <rect x="262" y="206" width="58" height="88" rx="24" className="f-orange" />
        <circle cx="291" cy="184" r="18" className="f-skin2" />
        <path d="M272 184a19 19 0 0 1 38 0q-19-12-38 0Z" className="f-hair" />
        <circle cx="291" cy="162" r="9" className="f-hair" />
        <path d="M274 238Q280 262 262 270M308 238Q312 262 330 270" className="n-fill s-skin2 s-9 cap" />
        <rect x="370" y="198" width="62" height="96" rx="26" className="f-sageD" />
        <rect x="380" y="232" width="42" height="62" rx="8" className="f-cup s-line s-2" />
        <circle cx="401" cy="176" r="19" className="f-skin3" />
        <path d="M381 174a20 20 0 0 1 40 0q-20-10-40 0Z" className="f-hair" />
        <circle cx="394" cy="180" r="5" className="n-fill s-ink s-16" />
        <circle cx="408" cy="180" r="5" className="n-fill s-ink s-16" />
        <path d="M399 180h4" className="n-fill s-ink s-16" />
        <path d="M426 232Q444 230 442 214" className="n-fill s-skin3 s-9 cap" />
        <path d="M430 216l3-16q9-6 18 0l3 16z" className="f-clay" />
        <path d="M432 206h18" className="n-fill s-orange s-3" />
        <rect x="110" y="270" width="350" height="20" rx="5" className="f-clay" />
        <rect x="118" y="290" width="334" height="12" className="f-orange" />
        <rect x="130" y="302" width="10" height="38" className="f-orange" />
        <rect x="430" y="302" width="10" height="38" className="f-orange" />
        <rect x="160" y="270" width="250" height="5" className="f-sage" />
        <circle cx="146" cy="258" r="12" className="f-orange" />
        <path d="M136 256q10-8 20 2M137 262q10-4 18 0" className="n-fill s-cup s-14" />
        <circle cx="174" cy="262" r="8" className="f-sage" />
        <path d="M221 252h26v10a13 13 0 0 1-26 0z" className="f-cup" />
        <path d="M247 256q8 0 8 6t-8 6" className="n-fill s-cup s-3" />
        <path d="M229 245q-4-8 0-14M239 245q-4-8 0-14" className="n-fill s-line s-2 cap" />
        <path d="M285 270l4-20q16-8 32 0l4 20z" className="f-orange" />
        <path d="M288 258h30" className="n-fill s-cup s-3" />
        <circle cx="360" cy="258" r="11" className="f-sage" />
        <circle cx="360" cy="258" r="4" className="f-orange" />
        <path d="M376 266l28-6" className="n-fill s-line s-3 cap" />
        <rect x="22" y="236" width="98" height="104" rx="8" className="f-ink s-line s-5" />
        {liveCount > 0 ? (
          <>
            <text x="71" y="272" textAnchor="middle" className="cs-text f-chalk">{liveCount === 1 ? 'Workshop' : many}</text>
            <text x="71" y="292" textAnchor="middle" className="cs-text f-chalk">live</text>
          </>
        ) : (
          <text x="71" y="282" textAnchor="middle" className="cs-text f-chalk">Stay Tuned!</text>
        )}
        <path d="M44 308q8-8 16 0t16 0t16 0" className="n-fill s-chalk s-2 cap" />
        <circle cx="71" cy="324" r="5" className="f-orange" />
        <path d="M38 340l-6 8M104 340l6 8" className="n-fill s-line s-4 cap" />
        <path d="M508 340l6-36h32l6 36z" className="f-orange" />
        <ellipse cx="527" cy="286" rx="9" ry="26" className="f-green" transform="rotate(-26 527 306)" />
        <ellipse cx="527" cy="282" rx="9" ry="28" className="f-sageD" />
        <ellipse cx="527" cy="286" rx="9" ry="26" className="f-green" transform="rotate(26 527 306)" />
      </svg>
    </div>
  );
}
