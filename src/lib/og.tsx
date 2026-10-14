import { ImageResponse } from 'next/og';

export const ogSize = { width: 1200, height: 630 };

export function renderOg(title: string, subtitle: string) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f8f4ee', padding: 72, color: '#252a24' }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#c66b43', letterSpacing: 4 }}>RANG RAJASTHAN</div>
        <div style={{ display: 'flex', fontSize: 76, lineHeight: 1.1, fontWeight: 600 }}>{title}</div>
        <div style={{ display: 'flex', fontSize: 34, color: '#405746' }}>{subtitle}</div>
      </div>
    ),
    ogSize,
  );
}
