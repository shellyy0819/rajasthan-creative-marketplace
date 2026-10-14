import { ImageResponse } from 'next/og';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';
export default function Icon() {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#405746', color: '#fff5e9', fontSize: 22, borderRadius: 16 }}>R</div>, size);
}
