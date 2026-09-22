const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn:
  process.env.JWT_EXPIRES_IN || "7d",
    }
  );
}

async function register(req, res) {
  try {
    const {
      full_name,
      email,
      phone,
      password,
    } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required",
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO users (
        full_name,
        email,
        phone,
        password_hash,
        role,
        account_status,
        is_verified
      )
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE', FALSE)
      RETURNING
        id,
        full_name,
        email,
        phone,
        role,
        account_status,
        is_verified,
        created_at
      `,
      [
        full_name,
        email.toLowerCase(),
        phone || null,
        passwordHash,
        "CUSTOMER",
      ]
    );

    const user = result.rows[0];

    await pool.query(
  `
  INSERT INTO buildvest_user_profiles (
    user_id,
    account_status,
    verification_status
  )
  VALUES ($1, 'ACTIVE', 'PENDING')
  ON CONFLICT (user_id) DO NOTHING
  `,
  [user.id]
);

   await pool.query(
  `
  INSERT INTO buildvest_wallets(user_id)
  VALUES($1)
  ON CONFLICT DO NOTHING
  `,
  [user.id]
);

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
}

async function login(req, res) {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await pool.query(
  `
  SELECT
    u.id,
    u.full_name,
    u.email,
    u.phone,
    u.password_hash,
    u.role,
    u.account_status,
    u.is_verified,
    u.created_at,
    bp.account_status AS buildvest_account_status
  FROM users u
  INNER JOIN buildvest_user_profiles bp
  ON bp.user_id = u.id
  WHERE u.email = $1
  `,
  [email.toLowerCase()]
);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    if (user.account_status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Account is not active",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.buildvest_account_status === "SUSPENDED") {
  return res.status(403).json({
    success: false,
    message: "BuildVest account is suspended",
  });
}

    delete user.password_hash;

    const token = generateToken(user);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
}

module.exports = {
  register,
  login,
};