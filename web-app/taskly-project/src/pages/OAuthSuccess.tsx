import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const OAuthSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { googleLogin } = useAuth();

  useEffect(() => {
    const handleGoogleAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (token) {
        try {
          await googleLogin(token);
          navigate("/dashboard");
        } catch (error) {
          navigate("/");
        }
      } else {
        navigate("/");
      }
    };

    handleGoogleAuth();
  }, []);

  return (
    <div className="h-screen flex items-center justify-center">
      Logging you in with Google...
    </div>
  );
};

export default OAuthSuccess;