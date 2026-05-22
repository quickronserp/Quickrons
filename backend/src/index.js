const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "Quickrons backend live" });
});

app.post("/api/v1/auth/send-otp", (req, res) => {
  const { phone, role = "CUSTOMER" } = req.body;
  console.log(`[DEV OTP] phone=${phone} role=${role} code=123456`);
  res.json({ ok: true, expiresIn: 300, resendIn: 60 });
});

app.post("/api/v1/auth/verify-otp", (req, res) => {
  const { phone, otp, role = "CUSTOMER" } = req.body;

  if (otp !== "123456") {
    return res.status(400).json({
      error: { code: "OTP_INCORRECT", message: "Incorrect OTP." },
    });
  }

  res.json({
    accessToken: "dev-access-token",
    refreshToken: "dev-refresh-token",
    user: {
      id: "dev-user",
      phone,
      role,
    },
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
