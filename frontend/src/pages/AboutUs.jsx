import barangayLogo from "../assets/about/barangay-logo.jpg";
import heraldPhoto from "../assets/about/herald-angeles.jpg";
import racraquinPhoto from "../assets/about/john-michael-racraquin.jpg";
import salongaPhoto from "../assets/about/rheggie-salonga.jpg";
import tarrozaPhoto from "../assets/about/kenneth-tarroza.jpg";

import "../styles/AboutUs.css";


const DEVELOPERS = [
  {
    name: "Herald Paul C. Angeles",
    photo: heraldPhoto,
  },
  {
    name: "John Michael G. Racraquin",
    photo: racraquinPhoto,
  },
  {
    name: "Rheggie Boy I. Salonga",
    photo: salongaPhoto,
  },
  {
    name: "Kenneth R. Tarroza",
    photo: tarrozaPhoto,
  },
];


function AboutUs() {
  return (
    <div className="about-page">

      <section className="about-hero-card">

        <img
          className="about-barangay-logo"
          src={barangayLogo}
          alt="Barangay Krus na Ligas logo"
        />

        <h1>
          Barangay Krus na Ligas
          Health Management System
        </h1>

        <span className="about-kicker about-kicker-below-title">
          ABOUT US
        </span>

        <p>
          A web-based health center information
          system developed to support efficient
          patient record management, consultations,
          disease surveillance, medicine inventory
          monitoring, forecasting, reporting, and
          operational decision support.
        </p>

        <div className="about-capstone-title">
          <span>
            CAPSTONE PROJECT TITLE
          </span>

          <strong>
            A Predictive Analytics-Driven Barangay
            Health Center Management System Using
            Machine Learning for Disease Surveillance
            and Medicine-Based Resource Allocation
          </strong>
        </div>

      </section>


      <section className="about-information-grid">

        <article className="about-info-card">
          <span className="about-section-label">
            ABOUT THE SYSTEM
          </span>

          <h2>
            One workspace for health center operations
          </h2>

          <p>
            The system centralizes important health
            center information so authorized personnel
            can manage records, review consultations,
            monitor disease activity, track medicine
            availability, and prepare reports more
            efficiently.
          </p>
        </article>


        <article className="about-info-card">
          <span className="about-section-label">
            PURPOSE
          </span>

          <h2>
            Supporting better monitoring and planning
          </h2>

          <p>
            It was designed to help Barangay Krus na
            Ligas Health Center organize day-to-day
            operations, monitor health trends and
            medicine stocks, and provide clear
            information that can support planning and
            decision-making.
          </p>
        </article>

      </section>


      <section className="about-developers-section">

        <div className="about-section-heading">
          <span className="about-section-label">
            DEVELOPED BY
          </span>

          <h2>
            Project Development Team
          </h2>

          <p>
            BS Information Technology students of
            Eulogio "Amang" Rodriguez Institute of
            Science and Technology (EARIST).
          </p>
        </div>


        <div className="about-developers-grid">
          {DEVELOPERS.map(
            (developer) => (
              <article
                className="about-developer-card"
                key={developer.name}
              >
                <div className="about-photo-ring">
                  <img
                    src={developer.photo}
                    alt={developer.name}
                    className="about-developer-photo"
                  />
                </div>

                <h3>
                  {developer.name}
                </h3>

                <p>
                  BS Information Technology
                </p>
              </article>
            )
          )}
        </div>

      </section>


      <section className="about-system-footer">

        <div>
          <span className="about-section-label">
            ACADEMIC PROJECT
          </span>

          <h2>
            Eulogio "Amang" Rodriguez Institute
            of Science and Technology
          </h2>

          <p>
            College of Computing Science
            · BS Information Technology
          </p>
        </div>


        <div className="about-version">
          <span>
            System Version
          </span>

          <strong>
            1.0.0
          </strong>
        </div>

      </section>

    </div>
  );
}


export default AboutUs;
