import Nav from '../components/Nav'
import Hero from '../components/Hero'
import Interview from '../components/Interview'
import LabRecord from '../components/LabRecord'
import Seats from '../components/Seats'
import Batch from '../components/Batch'
import Viva from '../components/Viva'
import { FinalCta, Footer } from '../components/Closing'

export default function Landing() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Interview />
        <LabRecord />
        <Seats />
        <Batch />
        <Viva />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
