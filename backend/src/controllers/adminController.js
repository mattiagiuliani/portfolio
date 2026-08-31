import Contact from '../models/Contact.js'
import Post    from '../models/Post.js'
import Project from '../models/Project.js'

// ─── GET /api/admin/stats ──────────────────────────────────────────────────────
/**
 * Returns aggregate counts and recent-activity lists for the dashboard.
 * All Mongoose queries run in parallel via Promise.all for minimal latency.
 */
export const getStats = async (req, res, next) => {
  try {
    const [
      unreadMessages,
      publishedPosts,
      draftPosts,
      totalProjects,
      featuredProjects,
      recentMessages,
      recentPosts,
    ] = await Promise.all([
      Contact.countDocuments({ status: 'unread' }),
      Post.countDocuments({ published: true }),
      Post.countDocuments({ published: false }),
      Project.countDocuments({}),
      Project.countDocuments({ featured: true }),

      // Last 5 unread messages for the activity feed
      Contact.find({ status: 'unread' })
        .select('name email message status createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // Last 5 posts (any status) for the activity feed
      Post.find({})
        .select('title slug category published publishedAt createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ])

    res.json({
      success: true,
      data: {
        unreadMessages,
        publishedPosts,
        draftPosts,
        totalProjects,
        featuredProjects,
        recentMessages,
        recentPosts,
      },
    })
  } catch (err) {
    next(err)
  }
}
