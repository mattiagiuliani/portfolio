export function createHomeFixtures(identity) {
  const marker = `HOME E2E FIXTURE ${identity}`
  const settings = {
    name: `Home Harness Fixture 1A ${identity.slice(0, 8)}`,
    heroTagline: '// Checkpoint 1A fixture',
    jobTitle: 'Cross-browser test fixture',
    heroDescription: `${marker}: isolated public Home data.`,
    aboutText: 'Controlled local fixture content for Home browser checks.',
    email: 'home-fixture@example.invalid',
    linkedinUrl: 'https://example.invalid/home-fixture',
    githubUrl: 'https://example.invalid/home-fixture',
    twitterUrl: '',
    resumeUrl: '',
    updatedAt: '2026-10-01',
  }
  const projects = [{
    _id: 'home-checkpoint-1a-project',
    title: 'Checkpoint 1A Fixture Project',
    description: `${marker}: project content served by the local fixture API.`,
    technologies: ['Playwright', 'Fixture API'],
    githubUrl: '',
    liveUrl: '',
  }]
  const posts = [{
    _id: 'home-checkpoint-1b-post',
    title: 'Checkpoint 1B Fixture Article',
    slug: 'checkpoint-1b-fixture-article',
    excerpt: 'Controlled fixture content for the cinematic Home lifecycle check.',
    category: 'Engineering',
    tags: [],
    publishedAt: '2026-10-01T00:00:00.000Z',
    readingTime: 2,
  }]

  function respond(path) {
    const url = new URL(path, 'http://home-fixture')
    if (url.pathname === `/__home_fixture_health/${identity}`) {
      return { status: 200, body: { identity, marker } }
    }
    if (!url.pathname.startsWith(`/${identity}/api/`)) {
      return { status: 404, body: { success: false, message: 'Unknown fixture route' } }
    }
    const route = url.pathname.slice(identity.length + 1)
    if (route === '/api/settings') return { status: 200, body: { success: true, data: settings } }
    if (route === '/api/projects') return { status: 200, body: { success: true, data: projects } }
    if (route === '/api/posts') {
      return {
        status: 200,
        body: {
          success: true,
          data: posts,
          pagination: { total: posts.length, page: 1, limit: Number(url.searchParams.get('limit') || 9), pages: 1, hasNext: false, hasPrev: false },
        },
      }
    }
    return { status: 404, body: { success: false, message: 'Unknown fixture route' } }
  }

  return { marker, projects, respond, settings }
}