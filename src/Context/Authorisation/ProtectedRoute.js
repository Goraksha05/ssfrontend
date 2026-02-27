import { Route, Redirect } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Adjust the path as needed

const ProtectedRoute = ({ children, ...rest }) => {
  const { isAuthenticated } = useAuth();

  return (
    <Route
      {...rest}
      render={() => 
        isAuthenticated ? children : <Redirect to="/login" />
      }
    />
  );
};

export default ProtectedRoute;
