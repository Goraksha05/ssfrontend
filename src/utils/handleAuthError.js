import { toast } from "react-toastify";

const handleAuthError = (error) => {
  if (error.response && error.response.status === 401) {
    toast.error("Session expired. Please login again.");
    localStorage.removeItem("token");
    localStorage.removeItem("User");
    setTimeout(() => {
      window.location.href = "/login";
    }, 2000);
  }
};

export default handleAuthError;
