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

    // Biến kết quả tổng hợp cuối cùng
    let adjustedCart = [];

    for (const cartItem of cart) {
      const productId = cartItem.product_id;

      // 1️⃣ Lấy dữ liệu từ 2 API của Haravan
      const wholesaleRes = await axios.get(`https://wholesale-apps.haravan.com/js/policy?product_id=${productId}`);
      const giftRes = await axios.get(`https://buyxgety-omni.haravan.com/js/recommendeds?product_id=${productId}`);

      const wholesalePromo = wholesaleRes.data?.program?.promotions?.[0];
      const giftProgram = giftRes.data?.recommendeds?.[0];

      // 2️⃣ Áp dụng giá sỉ nếu đủ điều kiện
      if (wholesalePromo && cartItem.quantity >= wholesalePromo.quantity_min) {
        const discount = wholesalePromo.value || 0;
        cartItem.price = Math.max(cartItem.price - discount, 0);
      }

      // Luôn push sản phẩm gốc vào adjustedCart
      adjustedCart.push(cartItem);

      // 3️⃣ Áp dụng quà tặng nếu đủ điều kiện
      if (giftProgram && cartItem.quantity >= giftProgram.quantity) {
        // Kiểm tra xem quà tặng đã có trong giỏ hàng chưa
        const giftExists = adjustedCart.find(
          (i) => i.product_id === giftProgram.product_id && i.is_gift
        );

        if (!giftExists) {
          adjustedCart.push({
            product_id: giftProgram.product_id,
            title: giftProgram.product_name,
            quantity: giftProgram.apply_quantity || 1,
            price: 0,
            is_gift: true,
            image: giftProgram.product_images?.[0] || null,
            note: "🎁 Added by middleware (Buy X Get Y)"
          });
        }
      }
    }

    // ✅ Trả kết quả hợp lệ
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
