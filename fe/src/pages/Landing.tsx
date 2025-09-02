import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const Landing = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/board/1");
  }, []);
  return <div> </div>;
};
