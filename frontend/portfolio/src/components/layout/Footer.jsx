import Link from 'next/link'
import BrandMark from '../brand/BrandMark'

export default function Footer() {
  return <footer className="brand-footer">
    <div className="brand-container">
      <div className="footer-top"><Link href="/" aria-label="Mattia Giuliani home"><BrandMark /></Link><p className="footer-tagline">A brighter tomorrow, one idea at a time.</p></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Mattia Giuliani · MG Universe</span><nav aria-label="Footer"><Link href="/#projects">Work</Link><Link href="/#about">About</Link><Link href="/blog">Journal</Link><Link href="/#contact">Get in touch ↗</Link></nav></div>
    </div>
  </footer>
}
