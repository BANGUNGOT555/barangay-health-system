import {
  Link,
} from "react-router-dom";


function SiteFooter() {
  return (
    <footer className="site-footer">

      <div className="site-footer-inner">

        <div className="site-footer-links">
          <Link
            to="/about"
            className="site-footer-link"
          >
            About Us
          </Link>
        </div>

        <div className="site-footer-meta">
          <span>
            Krus na Ligas Health Center
          </span>

          <span
            className="site-footer-dot"
            aria-hidden="true"
          >
            •
          </span>

          <span>
            Health Management System
          </span>
        </div>

      </div>

    </footer>
  );
}


export default SiteFooter;
