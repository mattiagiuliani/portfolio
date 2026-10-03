import Universe from '../sections/Universe'
import CinematicHome from '../components/cinematic/CinematicHome'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import ScrollToLocation from '../components/layout/ScrollToLocation'
import Hero from '../sections/Hero'
import About from '../sections/About'
import Skills from '../sections/Skills'
import Projects from '../sections/Projects'
import Contact from '../sections/Contact'
import BlogPreview from '../sections/BlogPreview'
import { getPageSnapshot } from '../lib/publicApi.server'
import { pageMetadata, absoluteUrl, jsonLd } from '../lib/seo'

export const revalidate = 3600

export async function generateMetadata() {
  const { data: { settings } } = await getPageSnapshot('/')
  const title = `${settings.name} | ${settings.jobTitle}`
  return { ...pageMetadata({ title, description: settings.heroDescription || undefined, path: '/' }), title: { absolute: title } }
}

export default async function HomePage() {
  const { data: { settings, projects, preview }, revision } = await getPageSnapshot('/')

  return (
    <CinematicHome>
      <Navbar />
      <ScrollToLocation />
      <main data-public-version={revision}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({
          '@context': 'https://schema.org', '@type': 'ProfilePage', '@id': absoluteUrl('/#profile'),
          url: absoluteUrl('/'), mainEntity: {
            '@type': 'Person', '@id': absoluteUrl('/#person'), name: settings.name,
            jobTitle: settings.jobTitle, description: settings.heroDescription,
            url: absoluteUrl('/'), image: absoluteUrl('/brand/mattia-profile.webp'),
            sameAs: [settings.linkedinUrl, settings.githubUrl, settings.twitterUrl].filter((url) => /^https:\/\//.test(url || '')),
          },
        }) }} />
        <Hero settings={settings} />
        <Projects projects={projects} />
        <About settings={settings} />
        <Skills />
        <BlogPreview posts={preview} />
        <Contact settings={settings} />
        <Universe />
      </main>
      <Footer />
    </CinematicHome>
  )
}
