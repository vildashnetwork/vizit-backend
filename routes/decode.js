import jwt from "jsonwebtoken";

export default function decodeTokenFromReq(req) {

    const token = (req.body && req.body.token) ||
        (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
            ? req.headers.authorization.split(" ")[1]
            : undefined)

    if (!token) {
        return { ok: false, status: 401, message: "Token missing (provide in body, Authorization header, or cookie)" };
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        return { ok: true, payload };
    } catch (err) {
        if (err && err.name === "TokenExpiredError") {
            return { ok: false, status: 401, message: "Token expired" };
        }
        return { ok: false, status: 401, message: "Invalid token" };
    }
}
