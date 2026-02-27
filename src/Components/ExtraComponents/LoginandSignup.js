import React, { useState } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export function SoShoLifeLogin() {
    const [showLogin, setShowLogin] = useState(true);
    const [credentials, setCredentials] = useState({email: "", password: ""});
    const [accredentials, setACCredentials] = useState({rname: "", rusername:"", remail: "", rphonenumber:"", rpassword: ""});

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: credentials.email,
                    password: credentials.password
                })
            });
            const json = await response.json();
            console.log(json);
            alert("Login successful!");
        } catch (error) {
            console.error("Error during login:", error);
            alert("Login failed!");
        }
    };

    const handleACSubmit = async (e) => {
        e.preventDefault();
        const { rname, rusername, remail, rphonenumber, rpassword } = accredentials;
        try {
            const response = await fetch(`${BACKEND_URL}/api/auth/createuser`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ rname, rusername, remail, rphonenumber, rpassword })
            });
            const json = await response.json();
            console.log(json);
            alert("Signup successful!");
        } catch (error) {
            console.error("Error during signup:", error);
            alert("Signup failed!");
        }
    };

    const onChange = (e) => {
        if (showLogin) {
            setCredentials({...credentials, [e.target.name]: e.target.value});
        } else {
            setACCredentials({...accredentials, [e.target.name]: e.target.value});
        }
    };

    const toggleForms = () => {
        setShowLogin(!showLogin);
    };

    return (
        <div className="content">
            <div className="flex-div">
                <div className="name-content">
                    <h1 className="logo d-flex"><b>SoShoLife</b></h1>
                    <p className="tagline">Your own digital platform "To Get Recognition"</p>
                </div>
                {showLogin ? (
                    <form id="loginForm" onSubmit={handleSubmit}>
                        <h3 className='text-white'>Login</h3>
                        <input type="text" placeholder="Email or Phone Number" value={credentials.email} id="email" name="email" onChange={onChange} required />
                        <input type="password" placeholder="Password" value={credentials.password} id="password" name="password" onChange={onChange} required />
                        <button className="login">Log In</button>
                        <a href="/">Forgot Password?</a>
                        <hr />
                        <button type="button" className="create-account" onClick={toggleForms}>Create New Account</button>
                    </form>
                ) : (
                    <form id="registerForm" onSubmit={handleACSubmit}>
                        <h3 className='text-white'>Signup</h3>
                        <input type="text" placeholder="Full Name" value={accredentials.rname} id="rname" name="rname" onChange={onChange} required />
                        <input type="text" placeholder="Username" value={accredentials.rusername} id="rusername" name="rusername" onChange={onChange} required />
                        <input type="email" placeholder="Email" value={accredentials.remail} id="remial" name="remail" onChange={onChange} required />
                        <input type="phonenumber" placeholder="Phone Number" value={accredentials.rphonenumber} id="rphonenumber" name="rphonenumber" onChange={onChange} required />
                        <input type="password" placeholder="Password" value={accredentials.rpassword} id="rpassword" name="rpassword" onChange={onChange} required />
                        <button className="register">Sign Up</button>
                        <hr />
                        <button type="button" className="login-switch" onClick={toggleForms}>Already have an account? Log In</button>
                    </form>
                )}
            </div>
        </div>
    );
}

export default SoShoLifeLogin;
