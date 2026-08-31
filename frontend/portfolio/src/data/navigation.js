// Navigation links — source of truth for the entire app
export const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Skills', href: '#skills' },
  { label: 'Projects', href: '#projects' },
  { label: 'Contact', href: '#contact' },
  { label: 'Blog', href: '/blog' },
]

// Section IDs observed by useActiveSection (route links excluded)
export const sectionIds = navLinks
  .filter((l) => l.href.startsWith('#'))
  .map((l) => l.href.replace('#', ''))
