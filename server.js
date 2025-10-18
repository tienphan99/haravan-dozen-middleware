const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
const querystring = require("querystring");
const axios = require("axios");

// --- OAuth: bước 1 - install app ---
app.get("/install", (req, res) => {
  const shop = req.query.shop; // ví dụ: dozen.myharavan.com
  const redirectUri = "http://localhost:3000/callback";
  const clientId = process.env.CLIENT_ID;
  const scopes = "read_products,write_orders,read_customers"; // quyền truy cập

  const installUrl =
    `https://${shop}/admin/oauth/authorize?client_id=${clientId}` +
    `&scope=${scopes}` +
    `&redirect_uri=${redirectUri}`;

  res.redirect(installUrl);
});

// --- OAuth: bước 2 - callback ---
app.get("/callback", async (req, res) => {
  const { code, shop } = req.query;
  const tokenUrl = `https://${shop}/admin/oauth/access_token`;
  const payload = {
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    code,
  };

  try {
    const response = await axios.post(tokenUrl, payload);
    const accessToken = response.data.access_token;
    res.send(`✅ App installed! Access Token: ${accessToken}`);
  } catch (error) {
    console.error(error.response?.data || error);
    res.status(500).send("❌ OAuth error");
  }
});

const cors = require("cors");
app.use(cors({
  origin: "*", // Cho phép tất cả domain (chỉ để test local)
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("✅ Haravan middleware app is running!");
});

app.post("/api/adjust-cart", (req, res) => {
  try {
    const { cart } = req.body;

    if (!cart || !Array.isArray(cart)) {
      return res.status(400).json({ error: "Invalid cart data" });
    }

    // --- Cấu hình chương trình ---
    const ENSURE_PRODUCT_ID = 1070030847; // ID sản phẩm Ensure
    const WHOLESALE_PRICE = 745000;       // Giá sỉ
    const WHOLESALE_QTY = 6;              // Số lượng mua để được giá sỉ
    const GIFT_VARIANT_ID = 1159975862;    // ✅ TODO: thay bằng variant_id sản phẩm quà thật
    const GIFT_TITLE = "Healthy Care Complete Nutrition with Lactoferrin";

    let adjustedCart = [...cart];
    let ensureItem = adjustedCart.find(i => i.product_id === ENSURE_PRODUCT_ID);
    let giftItem = adjustedCart.find(i => i.product_id === GIFT_VARIANT_ID);

    // --- Áp dụng logic ---
    if (ensureItem && ensureItem.quantity >= WHOLESALE_QTY) {
      // 1. Áp dụng giá sỉ
      ensureItem.price = WHOLESALE_PRICE;

      // 2. Thêm quà tặng nếu chưa có
      if (!giftItem) {
        adjustedCart.push({
          product_id: GIFT_VARIANT_ID,
          title: GIFT_TITLE,
          quantity: 1,
          price: 0,
          is_gift: true,
        });
      }
    } else {
      // Nếu chưa đủ điều kiện, xoá quà nếu có
      adjustedCart = adjustedCart.filter(i => i.product_id !== GIFT_VARIANT_ID);
    }

    return res.json({
      message: "✅ Cart adjusted successfully",
      adjusted_cart: adjustedCart,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});



app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});


app.get("/api/products", async (req, res) => {
  const shop = "dozen.myharavan.com";
  const token = "BD2E19F4AEB7F2E75844859D590743EE4CE7871932E130E08069695FAAABAC81";

  try {
    const response = await axios.get(
      `https://${shop}/admin/products.json`,
      {
        headers: { "Authorization": `Bearer ${token}` }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error);
    res.status(500).send("❌ Error fetching products");
  }
});
