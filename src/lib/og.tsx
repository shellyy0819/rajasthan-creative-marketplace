import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';

const logoSrc = () => {
  try { return `data:image/png;base64,${fs.readFileSync(path.join(process.cwd(), 'public/logos/horizontal-color.png')).toString('base64')}`; } catch { return null; }
};

export const ogSize = { width: 1200, height: 630 };

export function renderOg(title: string, subtitle: string) {
  const logo = logoSrc();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f6efe4', padding: 72, color: '#252a24' }}>
        {logo ? <img src={logo} alt="Craftology" width={277} height={72} style={{ display: 'flex' }} /> : <div style={{ display: 'flex', fontSize: 30, color: '#c66b43', letterSpacing: 4 }}>CRAFTOLOGY</div>}
        <div style={{ display: 'flex', fontSize: 76, lineHeight: 1.1, fontWeight: 600 }}>{title}</div>
        <div style={{ display: 'flex', fontSize: 34, color: '#405746' }}>{subtitle}</div>
      </div>
    ),
    ogSize,
  );
}
