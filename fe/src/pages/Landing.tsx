import { getLocalPath } from "@/utils/landing";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const Landing = () => {
  const path: string = getLocalPath();
  const navigate = useNavigate();
  useEffect(() => {
    if (path) {
      navigate(path);
    }
  }, [path]);
  return <> </>;
};
