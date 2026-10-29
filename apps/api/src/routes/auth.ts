import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  currentUserController,
  loginController,
  logoutController,
  refreshController,
  registerController
} from "../controllers/auth-controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";
import { validateBody } from "../middleware/validate-body.js";
import { loginSchema, registerSchema } from "../validation/auth.js";

function createAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: { message: "Too many authentication attempts. Try again later." } }
  });
}

export const authRouter = Router();

authRouter.post("/register", requireSameOrigin, createAuthRateLimit(), validateBody(registerSchema), registerController);
authRouter.post("/login", requireSameOrigin, createAuthRateLimit(), validateBody(loginSchema), loginController);
authRouter.post("/refresh", requireSameOrigin, refreshController);
authRouter.post("/logout", requireSameOrigin, logoutController);
authRouter.get("/me", requireAuth, currentUserController);
