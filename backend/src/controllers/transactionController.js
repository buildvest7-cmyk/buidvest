const crypto = require("crypto");
const pool = require("../config/database");

async function createTransaction(req, res) {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { investment_id } = req.body;

    if (!investment_id) {
      return res.status(400).json({
        success: false,
        message: "Investment ID is required",
      });
    }

    await client.query("BEGIN");

    const investmentResult = await client.query(
      `
      SELECT
        i.id,
        i.user_id,
        i.amount,
        i.status,
        i.property_id,
        p.title AS property_title
      FROM buildvest_investments i
      INNER JOIN buildvest_properties p
        ON p.id = i.property_id
      WHERE i.id = $1
        AND i.user_id = $2
      FOR UPDATE
      `,
      [investment_id, userId]
    );

    if (investmentResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Investment not found",
      });
    }

    const investment = investmentResult.rows[0];

    if (investment.status !== "APPROVED") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Investment must be approved before payment",
      });
    }

    const existingTransaction = await client.query(
      `
      SELECT
        id,
        amount,
        transaction_type,
        status,
        reference,
        created_at
      FROM buildvest_transactions
      WHERE investment_id = $1
        AND user_id = $2
        AND status IN ('PENDING', 'SUCCESS')
      LIMIT 1
      `,
      [investment.id, userId]
    );

    if (existingTransaction.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "This investment has already been paid or has a pending payment",
        transaction: existingTransaction.rows[0],
      });
    }

    const walletResult = await client.query(
      `
      SELECT
        user_id,
        balance,
        currency,
        status
      FROM buildvest_wallets
      WHERE user_id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (walletResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    const wallet = walletResult.rows[0];

    if (wallet.status !== "ACTIVE") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Wallet is not active",
      });
    }

    const investmentAmount = Number(
      investment.amount
    );

    const walletBalanceBefore = Number(
      wallet.balance
    );

    if (walletBalanceBefore < investmentAmount) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    const walletBalanceAfter =
      walletBalanceBefore - investmentAmount;

    const reference =
      `BV-INV-${crypto.randomUUID()}`;

    const transactionResult =
      await client.query(
        `
        INSERT INTO buildvest_transactions (
          user_id,
          investment_id,
          amount,
          transaction_type,
          status,
          reference
        )
        VALUES (
          $1,
          $2,
          $3,
          'INVESTMENT_PAYMENT',
          'SUCCESS',
          $4
        )
        RETURNING
          id,
          user_id,
          investment_id,
          amount,
          transaction_type,
          status,
          reference,
          created_at
        `,
        [
          userId,
          investment.id,
          investmentAmount,
          reference,
        ]
      );

    const transaction =
      transactionResult.rows[0];

    await client.query(
      `
      UPDATE buildvest_wallets
      SET
        balance = $1,
        updated_at = NOW()
      WHERE user_id = $2
      `,
      [
        walletBalanceAfter,
        userId,
      ]
    );

    await client.query(
      `
      INSERT INTO buildvest_wallet_transactions (
        wallet_user_id,
        amount,
        balance_before,
        balance_after,
        type,
        reference
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'INVESTMENT_PAYMENT',
        $5
      )
      `,
      [
        userId,
        investmentAmount,
        walletBalanceBefore,
        walletBalanceAfter,
        `${reference}-OUT`,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Investment payment completed successfully",
      transaction,
      investment: {
        id: investment.id,
        property_id: investment.property_id,
        property_title: investment.property_title,
        amount: investmentAmount.toFixed(2),
      },
      wallet: {
        balance: walletBalanceAfter.toFixed(2),
        currency: wallet.currency,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Create transaction error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to complete investment payment",
    });
  } finally {
    client.release();
  }
}

async function getMyTransactions(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        t.id,
        t.investment_id,
        p.title AS property_title,
        t.amount,
        t.transaction_type,
        t.status,
        t.reference,
        t.created_at
      FROM buildvest_transactions t
      LEFT JOIN buildvest_investments i
        ON i.id = t.investment_id
      LEFT JOIN buildvest_properties p
        ON p.id = i.property_id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
      `,
      [userId]
    );

    res.json({
      success: true,
      transactions: result.rows,
    });
  } catch (error) {
    console.error("Get my transactions error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve transactions",
    });
  }
}

async function getAllTransactions(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        t.id,
        t.user_id,
        u.full_name AS customer_name,
        u.email AS customer_email,
        t.investment_id,
        p.title AS property_title,
        t.amount,
        t.transaction_type,
        t.status,
        t.reference,
        t.created_at
      FROM buildvest_transactions t
      INNER JOIN users u
        ON u.id = t.user_id
      LEFT JOIN buildvest_investments i
        ON i.id = t.investment_id
      LEFT JOIN buildvest_properties p
        ON p.id = i.property_id
      ORDER BY t.created_at DESC
    `);

    res.json({
      success: true,
      transactions: result.rows,
    });
  } catch (error) {
    console.error("Get all transactions error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve transactions",
    });
  }
}

async function getTransactionById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        t.id,
        t.user_id,
        t.investment_id,
        p.title AS property_title,
        p.location,
        t.amount,
        t.transaction_type,
        t.status,
        t.reference,
        t.created_at
      FROM buildvest_transactions t
      LEFT JOIN buildvest_investments i
        ON i.id = t.investment_id
      LEFT JOIN buildvest_properties p
        ON p.id = i.property_id
      WHERE t.id = $1
        AND t.user_id = $2
      `,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.json({
      success: true,
      transaction: result.rows[0],
    });
  } catch (error) {
    console.error("Get transaction by ID error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve transaction",
    });
  }
}

async function getTransactionByReference(req, res) {
  try {
    const userId = req.user.id;
    const { reference } = req.params;

    const result = await pool.query(
      `
      SELECT
        t.id,
        t.user_id,
        t.investment_id,
        p.title AS property_title,
        p.location,
        t.amount,
        t.transaction_type,
        t.status,
        t.reference,
        t.created_at
      FROM buildvest_transactions t
      LEFT JOIN buildvest_investments i
        ON i.id = t.investment_id
      LEFT JOIN buildvest_properties p
        ON p.id = i.property_id
      WHERE t.reference = $1
        AND t.user_id = $2
      `,
      [reference, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.json({
      success: true,
      transaction: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Get transaction by reference error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve transaction",
    });
  }
}

async function updateTransactionStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "SUCCESS",
      "FAILED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction status",
      });
    }

    const result = await pool.query(
      `
      UPDATE buildvest_transactions
      SET status = $1
      WHERE id = $2
        AND status = 'PENDING'
      RETURNING
        id,
        user_id,
        investment_id,
        amount,
        transaction_type,
        status,
        reference,
        created_at
      `,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending transaction not found",
      });
    }

    res.json({
      success: true,
      message: "Transaction status updated successfully",
      transaction: result.rows[0],
    });
  } catch (error) {
    console.error("Update transaction status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update transaction status",
    });
  }
}

async function fundWalletForTesting(req, res) {
  const client = await pool.connect();

  try {
    const { user_id, amount } = req.body;
    const fundingAmount = Number(amount);

    if (!user_id || !Number.isFinite(fundingAmount) || fundingAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "user_id and a positive amount are required",
      });
    }

    await client.query("BEGIN");

    const walletResult = await client.query(
      `
      SELECT
        user_id,
        balance,
        currency,
        status
      FROM buildvest_wallets
      WHERE user_id = $1
      FOR UPDATE
      `,
      [user_id]
    );

    if (walletResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    const wallet = walletResult.rows[0];

    if (wallet.status !== "ACTIVE") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Wallet is not active",
      });
    }

    const balanceBefore = Number(wallet.balance);
    const balanceAfter = balanceBefore + fundingAmount;

    await client.query(
      `
      UPDATE buildvest_wallets
      SET
        balance = $1,
        updated_at = NOW()
      WHERE user_id = $2
      `,
      [balanceAfter, user_id]
    );

    const reference = `BV-FUND-${crypto.randomUUID()}`;

    const transactionResult = await client.query(
      `
      INSERT INTO buildvest_wallet_transactions
      (
        wallet_user_id,
        amount,
        balance_before,
        balance_after,
        type,
        reference
      )
      VALUES
      ($1, $2, $3, $4, 'TEST_FUNDING', $5)
      RETURNING
        id,
        wallet_user_id,
        amount,
        balance_before,
        balance_after,
        type,
        reference,
        created_at
      `,
      [
        user_id,
        fundingAmount,
        balanceBefore,
        balanceAfter,
        reference,
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Test funding added successfully",
      transaction: transactionResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Fund wallet error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fund wallet",
    });
  } finally {
    client.release();
  }
}

module.exports = {
  createTransaction,
  getMyTransactions,
  getAllTransactions,
  getTransactionById,
  getTransactionByReference,
  updateTransactionStatus,
  fundWalletForTesting,
};