import {
  Outlet,
} from "react-router-dom";

import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import SiteFooter from "../components/SiteFooter";

import "../styles/SiteFooter.css";


function MainLayout() {
  return (
    <div className="app-shell">

      <Sidebar />

      <div className="app-content app-content-with-footer">

        <Header />

        <main className="page-content">
          <Outlet />
        </main>

        <SiteFooter />

      </div>

    </div>
  );
}


export default MainLayout;
