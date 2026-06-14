import React from "react";
import { NavLink, useRouteMatch } from "react-router-dom";

const IdeNavLink = () => {
  const match = useRouteMatch<{ id?: string; server?: string }>("/server/:id") || useRouteMatch<{ id?: string; server?: string }>("/server/:server");
  if (!match) return null;
  const serverId = match.params.id || match.params.server;
  if (!serverId) return null;

  return (
    <NavLink to={`/server/${serverId}/ide`} exact>
      IDE
    </NavLink>
  );
};

export default IdeNavLink;
