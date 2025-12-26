import express from "express";
import {
    handleAuthCheck,
    handleCallback,
    redirectToEveLogin,
} from "../controllers/eveAuthController.js";
const esiRouter = express.Router();

esiRouter.get("/login", redirectToEveLogin);
esiRouter.get("/callback", handleCallback);
esiRouter.get("/me", handleAuthCheck);

export default esiRouter;
