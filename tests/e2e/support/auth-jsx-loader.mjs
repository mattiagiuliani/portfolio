import swc from '../../../frontend/portfolio/node_modules/next/dist/build/swc/index.js'

// Compile the real provider without rewriting its imports or authentication logic.
export default function loader(source) {
  const done = this.async()
  swc.loadBindings().then(() => swc.transform(source, {
    filename: this.resourcePath,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
  })).then(({ code }) => done(null, code), done)
}
