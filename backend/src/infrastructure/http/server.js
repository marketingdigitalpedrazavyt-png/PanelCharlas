const express = require("express");
const cors = require("cors");
const { buildRouter } = require("./routes");
const { errorHandler } = require("./middlewares");

/** Crea la app Express con la API montada en /api. */
function createServer(uc) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "15mb" }));
  app.use("/api", buildRouter(uc));
  app.use(errorHandler);
  return app;
}

module.exports = { createServer };
