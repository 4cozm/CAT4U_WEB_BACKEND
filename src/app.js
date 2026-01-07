//서버 구동 없이 Express 객체만 반환 , 즉 앱 내부 설정
import cookieParser from "cookie-parser";
import express from "express";
import requireAuth from "./middlewares/requireAuth.js";
import { createSessionMiddleware } from "./middlewares/sessionMiddleware.js";
import router from "./routes/index.js";

export async function createApp() {
    const app = express();

    app.set("trust proxy", 1);

    app.use((req, res, next) => {
        if (req.url.startsWith("/api/") && req.url.length > 5 && req.url.endsWith("/")) {
            req.url = req.url.slice(0, -1);
        }
        next();
    });
    app.use(express.json({ limit: "2mb" }));
    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const sessionMiddleware = await createSessionMiddleware();
    app.use(sessionMiddleware);
    app.use(requireAuth);

    app.use("/api", router);

    app.set("json replacer", (key, value) =>
        typeof value === "bigint" ? value.toString() : value
    );
    return app;
}
