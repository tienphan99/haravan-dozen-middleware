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
app.post("/api/adjust-cart", async (req, res) => {
  try {
    const { cart } = req.body;
    if (!cart || !Array.isArray(cart)) {
      return res.status(400).json({ error: "Invalid cart data" });
    }

    let adjustedCart = [...cart];

    for (const item of cart) {
      const productId = item.product_id;

      // 1️⃣ Gọi API Wholesale
      const wholesaleUrl = `https://wholesale-apps.haravan.com/js/policy?product_id=${productId}`;
      const wholesaleResp = await axios.get(wholesaleUrl);
      const giftRes = await axios.get(`https://buyxgety-omni.haravan.com/js/recommendeds?product_id=${productId}`);

      const wholesaleData = wholesaleResp.data?.program?.promotions?.[0];

      if (wholesaleData && item.quantity >= wholesaleData.quantity_min) {
        const discount = wholesaleData.value || 0;
        const newPrice = item.price - discount;
        item.price = newPrice > 0 ? newPrice : 0;
      }

      // 2️⃣ Gọi API Buy X Get Y
      const buyxgetyUrl = `https://buyxgety-omni.haravan.com/js/recommendeds?product_id=${productId}`;
      const buyxgetyResp = await axios.get(buyxgetyUrl);
      const recommended = buyxgetyResp.data?.recommendeds?.[0];

      if (recommended && item.quantity >= recommended.quantity) {
        const giftExists = adjustedCart.find(
          (i) => i.product_id === recommended.product_id
        );

        if (!giftExists) {
          adjustedCart.push({
            product_id: recommended.product_id,
            title: recommended.product_name,
            quantity: recommended.apply_quantity || 1,
            price: 0,
            is_gift: true,
            image: recommended.product_images?.[0] || null,
            note: "Added by middleware (Buy X Get Y)"
          });
        }
      }
      let adjustedCart = [];

        if (cartItem.quantity >= wholesaleData.program.promotions[0].quantity_min) {
        adjustedCart.push({
            product_id: cartItem.product_id,
            title: cartItem.title,
            quantity: cartItem.quantity,
            price: cartItem.price - wholesaleData.program.promotions[0].value
        });
        }

        if (giftData.recommendeds && giftData.recommendeds.length > 0) {
        const gift = giftData.recommendeds[0];
        if (cartItem.quantity >= gift.quantity) {
            adjustedCart.push({
            product_id: gift.product_id,
            title: gift.product_name,
            quantity: gift.apply_quantity,
            price: 0,
            is_gift: true
            });
        }
        }
    }

    return res.json({
      message: "✅ Cart adjusted successfully (auto API merge)",
      adjusted_cart: adjustedCart
    });
  } catch (err) {
    console.error("❌ Adjust cart error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
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
