import type { RequestHandler } from "express";
import { authCookie, getCurrentUser, login, refresh, register, revokeRefreshToken } from "../services/auth-service.js";

export const registerController: RequestHandler = async (request, response) => {
  const result = await register(request.body);
  response.cookie(authCookie.name, result.refreshToken, {
    ...authCookie.options,
    maxAge: authCookie.maxAge,
    expires: result.refreshTokenExpiresAt
  });
  response.status(201).json({
    data: { user: result.user, accessToken: result.accessToken }
  });
};

export const loginController: RequestHandler = async (request, response) => {
  const result = await login(request.body);
  response.cookie(authCookie.name, result.refreshToken, {
    ...authCookie.options,
    maxAge: authCookie.maxAge,
    expires: result.refreshTokenExpiresAt
  });
  response.status(200).json({
    data: { user: result.user, accessToken: result.accessToken }
  });
};

export const refreshController: RequestHandler = async (request, response) => {
  const result = await refresh(request.cookies[authCookie.name]);
  response.cookie(authCookie.name, result.refreshToken, {
    ...authCookie.options,
    maxAge: authCookie.maxAge,
    expires: result.refreshTokenExpiresAt
  });
  response.status(200).json({
    data: { user: result.user, accessToken: result.accessToken }
  });
};

export const logoutController: RequestHandler = async (request, response) => {
  await revokeRefreshToken(request.cookies[authCookie.name]);
  response.clearCookie(authCookie.name, authCookie.options);
  response.status(204).end();
};

export const currentUserController: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(response.locals.authUserId ?? "");
  response.status(200).json({ data: { user } });
};
