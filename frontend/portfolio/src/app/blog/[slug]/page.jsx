import { notFound } from 'next/navigation'
import Navbar from '../../../components/layout/Navbar'
import Footer from '../../../components/layout/Footer'
import BlogPost from '../../../_pages/BlogPost'
import { getPageSnapshot, getPosts, PublicApiError } from '../../../lib/publicApi.server'
import { pageMetadata, absoluteUrl, jsonLd, socialImage } from '../../../lib/seo'
import { isValidBlogCoverImage } from '../../../lib/blogCoverImage'

export const revalidate = 3600
export const dynamicParams = true

async function readArticle(slug) {
  try { return await getPageSnapshot(`/blog/${slug}`) }
  catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound()
    throw error
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const { data: { post } } = await readArticle(slug)
  return pageMetadata({
    title: post.title, description: post.excerpt || `Read ${post.title} in Mattia Giuliani's engineering journal.`,
    path: `/blog/${slug}`, type: 'article',
    image: isValidBlogCoverImage(post.coverImage) ? post.coverImage : socialImage,
    publishedTime: post.publishedAt, modifiedTime: post.updatedAt,
  })
}

export async function generateStaticParams() {
  const params = []
  let page = 1
  let hasNext = true

  while (hasNext) {
    const listing = await getPosts({ page, limit: 50 })
    params.push(...listing.data.map((post) => ({ slug: post.slug })))
    hasNext = listing.pagination.hasNext
    page += 1
  }

  return params
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params
  const response = await readArticle(slug)
  const post = response.data.post

  return (
    <>
      <Navbar />
      <main data-public-version={response.revision}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({
          '@context': 'https://schema.org', '@type': 'BlogPosting',
          headline: post.title, description: post.excerpt,
          mainEntityOfPage: absoluteUrl(`/blog/${slug}`),
          image: absoluteUrl(isValidBlogCoverImage(post.coverImage) ? post.coverImage : socialImage),
          datePublished: post.publishedAt, dateModified: post.updatedAt || post.publishedAt,
          author: { '@type': 'Person', '@id': absoluteUrl('/#person'), name: 'Mattia Giuliani', url: absoluteUrl('/') },
        }) }} />
        <BlogPost post={response.data.post} />
      </main>
      <Footer />
    </>
  )
}
