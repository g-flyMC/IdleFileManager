import React from "react";
import { NavLink, useRouteMatch } from "react-router-dom";

const IdeNavLink = () => {
  const match = useRouteMatch<{ id: string }>("/server/:id");
  if (!match) return null;

  return (
    <NavLink to={`/server/${match.params.id}/ide`} exact>
      IDE
    </NavLink>
  );
};

export default IdeNavLink;
