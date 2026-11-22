import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import "../styles/HeaderProfile.css";


function Header() {
  const navigate = useNavigate();

  const {
    user,
    logout,
    profilePhotoUrl,
  } = useAuth();


  const handleLogout = async () => {
    const didLogout =
      await logout();

    if (didLogout) {
      navigate(
        "/login"
      );
    }
  };


  const handleProfileClick = () => {
    navigate(
      "/profile"
    );
  };


  const initials = [
    user?.first_name?.[0],
    user?.last_name?.[0],
  ]
    .filter(Boolean)
    .join("")
    .toUpperCase();


  return (
    <header className="topbar">

      <div className="topbar-left">

        <div>
          <span className="topbar-kicker">
            Barangay Health Center
          </span>

          <strong className="topbar-title">
            Health Management System
          </strong>
        </div>

      </div>


      <div className="topbar-right">

        <button
          type="button"
          className="topbar-user topbar-user-button"
          onClick={
            handleProfileClick
          }
          aria-label="Open my profile"
          title="My Profile"
        >

          <div className="topbar-avatar">

            {profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
                alt=""
                className="topbar-avatar-image"
              />
            ) : (
              initials || "U"
            )}

          </div>


          <div className="topbar-user-info">

            <strong>
              {user?.first_name}{" "}
              {user?.last_name}
            </strong>

            <span>
              {user?.roles?.join(", ")}
            </span>

          </div>

        </button>


        <button
          type="button"
          className="topbar-logout"
          onClick={handleLogout}
        >
          Logout
        </button>

      </div>

    </header>
  );
}


export default Header;
