import React from "react";
import PropTypes from 'prop-types';
import { Link, useHistory } from "react-router-dom";
import { useAuth } from "../Context/Authprovider/AuthContext";

export default function Navbar(props) {
  const { isAuthenticated, logout } = useAuth();
  const history = useHistory();

  const handleLogout = () => {
    localStorage.removeItem('token');
    logout();
    history.push('/login');
  };

  return (
    <div>
      <nav className="navbar fixed-top navbar-expand-lg bg-body-tertiary">
        <div className="container-fluid">
          <Link className="navbar-brand" to="/">{props.title}</Link>
          <button
            className="navbar-toggler" 
            type="button" 
            data-bs-toggle="collapse" 
            data-bs-target="#navbarSupportedContent" 
            aria-controls="navbarSupportedContent" 
            aria-expanded="false" 
            aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarSupportedContent">
            <ul className="navbar-nav me-5 mb-2 mb-lg-0">
              <li className="nav-item">
                <Link className="nav-link active" aria-current="page" to="/">{props.myHome}</Link>
              </li>
              <li className="nav-item" >
                <Link className="nav-link active" aria-disabled="true" to="/activity">My Activity</Link>
              </li>
              <li className="nav-item dropdown">
                <Link className="nav-link dropdown-toggle" to="/" role="button" data-bs-toggle="dropdown" aria-expanded="false">Friend</Link>
                <ul className="dropdown-menu">
                  <li><Link className="dropdown-item" to="/allfriends">All Friends</Link></li>
                  <li><Link className="dropdown-item" to="/friendrequest">Friend Request</Link></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><Link className="dropdown-item" to="/suggestions">Suggesetions</Link></li>
                </ul>
              </li>
              <li className="nav-item">
                <Link className="nav-link active" aria-disabled="true" to="/profile">Profile</Link>
              </li>
            </ul>

            {isAuthenticated && (
              <button
                onClick={handleLogout}
                style={{
                  padding: '5px 12px',
                  border: '2px solid blue',
                  margin: '0px 0px 0px 625px',
                  backgroundColor: '#ff4d4d',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}

Navbar.propTypes = {
  title: PropTypes.string.isRequired
};
