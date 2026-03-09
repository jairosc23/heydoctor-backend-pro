const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "https://heydoctor.health,https://www.heydoctor.health").split(",").map(s => s.trim());

module.exports = [
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https://heydoctor.health", "https://api.heydoctor.health"],
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            "market-assets.strapi.io",
            "res.cloudinary.com",
          ],
          "media-src": [
            "'self'",
            "data:",
            "blob:",
            "market-assets.strapi.io",
            "res.cloudinary.com",
          ],
          upgradeInsecureRequests: null,
          "frame-src": [
            "'self'",
            "sandbox.embed.apollographql.com",
          ],
        },
      },
    },
  },
  {
    name: "strapi::cors",
    config: {
      origin: process.env.NODE_ENV === "production" ? ALLOWED_ORIGINS : ["http://localhost:3000", "http://localhost:1337"],
      credentials: true,
    },
  },
  {
    name: "strapi::poweredBy",
    config: {
      poweredBy: "SAVAC MedTech LLC",
    },
  },
  "strapi::logger",
  "strapi::query",
  "strapi::body",
  {
    name: "strapi::session",
    config: {
      rolling: true,
      renew: true,
    },
  },
  "strapi::favicon",
  "strapi::public",
];
