import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <section className="page narrow">
      <h1>Lost in a crater.</h1>
      <p className="lead">This page doesn’t exist.</p>
      <Link className="btn" to="/">Back to the surface</Link>
    </section>
  )
}
