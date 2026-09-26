import Image from 'next/image'

export default function BrandMark({ compact = false }) {
  return (
    <span className="brand-signature">
      <Image src="/brand/mg-logo.webp" alt="MG" width={80} height={40} className="brand-mark" />
      {!compact && <span className="brand-wordmark">MATTIA GIULIANI<span>BUILD. LEARN. IMPROVE. REPEAT.</span></span>}
    </span>
  )
}
