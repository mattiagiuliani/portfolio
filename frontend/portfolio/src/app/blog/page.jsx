import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'
import Blog from '../../_pages/Blog'
import { getPageSnapshot } from '../../lib/publicApi.server'
import { pageMetadata } from '../../lib/seo'

export const metadata = pageMetadata({ title: 'Engineering Journal', description: 'Notes by Mattia Giuliani on full stack development, testing, and the ideas behind his projects. Explore practical lessons from building software.', path: '/blog' })

export const revalidate = 3600

export default async function BlogPage() {
  const { data, revision } = await getPageSnapshot('/blog')
  return <>
    <Navbar />
    <main data-public-version={revision}>
      <Blog initialPosts={data.posts} initialPagination={data.pagination} initialFeatured={data.featured} initialQuery="" />
    </main>
    <Footer />
  </>
}
