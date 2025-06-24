const express = require("express");
const http = require("http");
const app = express();
const cors = require("cors");

const connectDB = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");
const routes = require("./routes/index");
app.use(express.json());

connectDB();
app.use(cors());

app.use("/api", routes);
app.use(errorHandler);

const server = http.createServer(app);

server.listen("4003", () => {
  console.log("server running on port 4003");
});
