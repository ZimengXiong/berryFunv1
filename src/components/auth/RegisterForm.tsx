import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function RegisterForm() {
  const navigate = useNavigate();

  // Redirect to login since we use Google OAuth
  useEffect(() => {
    navigate("/login", { replace: true });
  }, [navigate]);

  return null;
}
