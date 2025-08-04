const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("../swagger.json");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const app = express();

// MongoDB Connection
const DB_URI = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8fkcsmr.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;

mongoose.connect(DB_URI)
  .then(() => console.log("Successfully connected to the database"))
  .catch((err) => console.error("Failed to connect to the database:", err));

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Swagger API Docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  swaggerOptions: {
    url: './swagger.json',
  },
}));

// Routes
app.get('/', (req, res) => {
  return res.json({ message: "Hello from Vercel" });
});

app.use("/auth", require("../routes/auth.routes"));
app.use("/users", require("../routes/user.routes"));
app.use("/wishlist", require("../routes/wishlist.routes"));
app.use("/products", require("../routes/product.routes"));
app.use("/carts", require("../routes/cart.routes"));
app.use("/orders", require("../routes/order.routes"));
app.use("/categories", require("../routes/category.routes"));
app.use("/subcategories", require("../routes/subcategory.routes"));
app.use("/ratings", require("../routes/rating.routes"));
app.use("/posts", require("../routes/post.routes"));
app.use("/upload-image", require("../routes/uploadImage.routes"));
app.use("/chatbot", require("../routes/chatbot.routes"));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: `${req.originalUrl} Not Found` });
});

// Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Api Error";
  res.status(statusCode).json({ message });
});

// ✅ أهم سطر لـ Vercel
module.exports = app;
