import mongoose from 'mongoose'

const settingsSchema = new mongoose.Schema(
  {
    // A fixed key makes the single Settings document enforceable at database level.
    // `sparse` keeps existing legacy documents without this field compatible.
    singletonKey:    { type: String, default: 'default', select: false },
    name:            { type: String, default: 'Mattia Giuliani', trim: true, maxlength: 100 },
    email:           { type: String, default: '', trim: true, lowercase: true },
    jobTitle:        { type: String, default: 'Full Stack Developer', trim: true, maxlength: 100 },
    heroTagline:     { type: String, default: '// full stack developer', trim: true },
    heroDescription: { type: String, default: '', trim: true },
    aboutText:       { type: String, default: '', trim: true },
    githubUrl:       { type: String, default: '', trim: true },
    linkedinUrl:     { type: String, default: '', trim: true },
    twitterUrl:      { type: String, default: '', trim: true },
    resumeUrl:       { type: String, default: '', trim: true },
  },
  { timestamps: true }
)

settingsSchema.index({ singletonKey: 1 }, { unique: true, sparse: true })

export default mongoose.model('Settings', settingsSchema)
