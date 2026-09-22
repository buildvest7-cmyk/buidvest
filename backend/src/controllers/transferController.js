const crypto = require("crypto");
const pool = require("../config/database");

async function createTransfer(req, res) {
  const client = await pool.connect();

  try {
    const senderId = req.user.id;

    const {
      recipient_email,
      amount,
    } = req.body;

    if (!recipient_email || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Recipient email and amount are required",
      });
    }

    const transferAmount = Number(amount);

    if (
      !Number.isFinite(transferAmount) ||
      transferAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero",
      });
    }

    const recipientResult = await client.query(
      `
      SELECT
        u.id,
        u.full_name,
        u.email,
        bp.account_status,
        bp.verification_status
      FROM users u
      INNER JOIN buildvest_user_profiles bp
        ON bp.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)
      `,
      [recipient_email.trim()]
    );

    if (recipientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Recipient not found",
      });
    }

    const recipient = recipientResult.rows[0];

    if (recipient.id === senderId) {
      return res.status(400).json({
        success: false,
        message: "You cannot send money to yourself",
      });
    }

    if (recipient.account_status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Recipient BuildVest account is not active",
      });
    }

    if (recipient.verification_status !== "VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "Recipient BuildVest account is not verified",
      });
    }

    await client.query("BEGIN");

    let senderWallet;
    let recipientWallet;

    if (senderId < recipient.id) {
      const firstWalletResult = await client.query(
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
        [senderId]
      );

      const secondWalletResult = await client.query(
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
        [recipient.id]
      );

      senderWallet = firstWalletResult.rows[0];
      recipientWallet = secondWalletResult.rows[0];
    } else {
      const firstWalletResult = await client.query(
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
        [recipient.id]
      );

      const secondWalletResult = await client.query(
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
        [senderId]
      );

      recipientWallet = firstWalletResult.rows[0];
      senderWallet = secondWalletResult.rows[0];
    }

    if (!senderWallet) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Sender wallet not found",
      });
    }

    if (!recipientWallet) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Recipient wallet not found",
      });
    }

    if (senderWallet.status !== "ACTIVE") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Sender wallet is not active",
      });
    }

    if (recipientWallet.status !== "ACTIVE") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Recipient wallet is not active",
      });
    }

    const senderBalanceBefore = Number(senderWallet.balance);
    const recipientBalanceBefore = Number(recipientWallet.balance);

    if (senderBalanceBefore < transferAmount) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    const senderBalanceAfter =
      senderBalanceBefore - transferAmount;

    const recipientBalanceAfter =
      recipientBalanceBefore + transferAmount;

    const reference = `BV-TRF-${crypto.randomUUID()}`;

    const transferResult = await client.query(
      `
      INSERT INTO buildvest_transfers (
        sender_id,
        recipient_id,
        amount,
        status,
        reference
      )
      VALUES ($1, $2, $3, 'SUCCESS', $4)
      RETURNING
        id,
        sender_id,
        recipient_id,
        amount,
        status,
        reference,
        created_at
      `,
      [
        senderId,
        recipient.id,
        transferAmount,
        reference,
      ]
    );

    const transfer = transferResult.rows[0];

    await client.query(
      `
      UPDATE buildvest_wallets
      SET
        balance = $1,
        updated_at = NOW()
      WHERE user_id = $2
      `,
      [
        senderBalanceAfter,
        senderId,
      ]
    );

    await client.query(
      `
      UPDATE buildvest_wallets
      SET
        balance = $1,
        updated_at = NOW()
      WHERE user_id = $2
      `,
      [
        recipientBalanceAfter,
        recipient.id,
      ]
    );

    await client.query(
      `
      INSERT INTO buildvest_wallet_transactions
      (
        wallet_user_id,
        transfer_id,
        amount,
        balance_before,
        balance_after,
        type,
        reference
      )
      VALUES
      ($1, $2, $3, $4, $5, 'TRANSFER_OUT', $6)
      `,
      [
        senderId,
        transfer.id,
        transferAmount,
        senderBalanceBefore,
        senderBalanceAfter,
       `${reference}-OUT`,
      ]
    );

    await client.query(
      `
      INSERT INTO buildvest_wallet_transactions
      (
        wallet_user_id,
        transfer_id,
        amount,
        balance_before,
        balance_after,
        type,
        reference
      )
      VALUES
      ($1, $2, $3, $4, $5, 'TRANSFER_IN', $6)
      `,
      [
        recipient.id,
        transfer.id,
        transferAmount,
        recipientBalanceBefore,
        recipientBalanceAfter,
       `${reference}-IN`,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Transfer completed successfully",
      transfer,
      recipient: {
        id: recipient.id,
        full_name: recipient.full_name,
        email: recipient.email,
      },
      wallet: {
        sender_balance: senderBalanceAfter.toFixed(2),
        recipient_balance: recipientBalanceAfter.toFixed(2),
        currency: senderWallet.currency,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create transfer error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to complete transfer",
    });
  } finally {
    client.release();
  }
}

async function getMyTransfers(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        t.id,
        t.recipient_id,
        u.full_name AS recipient_name,
        u.email AS recipient_email,
        t.amount,
        t.status,
        t.reference,
        t.created_at
      FROM buildvest_transfers t
      INNER JOIN users u
        ON u.id = t.recipient_id
      WHERE t.sender_id = $1
      ORDER BY t.created_at DESC
      `,
      [userId]
    );

    res.json({
      success: true,
      transfers: result.rows,
    });
  } catch (error) {
    console.error("Get my transfers error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve transfers",
    });
  }
}

async function getReceivedTransfers(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        t.id,
        t.sender_id,
        u.full_name AS sender_name,
        u.email AS sender_email,
        t.amount,
        t.status,
        t.reference,
        t.created_at
      FROM buildvest_transfers t
      INNER JOIN users u
        ON u.id = t.sender_id
      WHERE t.recipient_id = $1
      ORDER BY t.created_at DESC
      `,
      [userId]
    );

    res.json({
      success: true,
      transfers: result.rows,
    });
  } catch (error) {
    console.error("Get received transfers error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve received transfers",
    });
  }
}

async function getAllTransfers(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        t.id,
        t.sender_id,
        sender.full_name AS sender_name,
        sender.email AS sender_email,
        t.recipient_id,
        recipient.full_name AS recipient_name,
        recipient.email AS recipient_email,
        t.amount,
        t.status,
        t.reference,
        t.created_at
      FROM buildvest_transfers t
      INNER JOIN users sender
        ON sender.id = t.sender_id
      INNER JOIN users recipient
        ON recipient.id = t.recipient_id
      ORDER BY t.created_at DESC
      `
    );

    res.json({
      success: true,
      transfers: result.rows,
    });
  } catch (error) {
    console.error("Get all transfers error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve transfers",
    });
  }
}

async function updateTransferStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status === "SUCCESS") {
      return res.status(400).json({
        success: false,
        message:
          "Wallet transfers are completed atomically. SUCCESS cannot be set manually.",
      });
    }

    if (status !== "FAILED") {
      return res.status(400).json({
        success: false,
        message: "Status must be FAILED",
      });
    }

    const result = await pool.query(
      `
      UPDATE buildvest_transfers
      SET status = 'FAILED'
      WHERE id = $1
        AND status = 'PENDING'
      RETURNING
        id,
        sender_id,
        recipient_id,
        amount,
        status,
        reference,
        created_at
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending transfer not found",
      });
    }

    res.json({
      success: true,
      message: "Transfer marked as failed",
      transfer: result.rows[0],
    });
  } catch (error) {
    console.error("Update transfer status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update transfer status",
    });
  }
}

async function getMyWallet(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        user_id,
        balance,
        currency,
        status,
        created_at,
        updated_at
      FROM buildvest_wallets
      WHERE user_id = $1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    res.json({
      success: true,
      wallet: result.rows[0],
    });
  } catch (error) {
    console.error("Get wallet error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve wallet",
    });
  }
}

async function getAllWallets(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          w.user_id,
          u.full_name,
          u.email,
          bp.account_status,
          bp.verification_status,
          w.balance,
          w.currency,
          w.status,
          w.created_at,
          w.updated_at
        FROM buildvest_wallets w
        INNER JOIN users u
          ON u.id = w.user_id
        INNER JOIN buildvest_user_profiles bp
          ON bp.user_id = w.user_id
        ORDER BY w.updated_at DESC
      `
    );

    res.json({
      success: true,
      wallets: result.rows,
    });
  } catch (error) {
    console.error("Get all wallets error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve wallets",
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

async function getWalletTransactions(req, res) {
  try {
    const userId = req.user.id;

    const page = Math.max(
      Number.parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        Number.parseInt(req.query.limit, 10) || 20,
        1
      ),
      100
    );

    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM buildvest_wallet_transactions
      WHERE wallet_user_id = $1
      `,
      [userId]
    );

    const total = Number(countResult.rows[0].total);

    const result = await pool.query(
      `
      SELECT
        id,
        wallet_user_id,
        transfer_id,
        amount,
        balance_before,
        balance_after,
        type,
        reference,
        created_at
      FROM buildvest_wallet_transactions
      WHERE wallet_user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      OFFSET $3
      `,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get wallet transactions error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve wallet transactions",
    });
  }
}

module.exports = {
  createTransfer,
  getMyTransfers,
  getReceivedTransfers,
  getAllTransfers,
  updateTransferStatus,
  getMyWallet,
 fundWalletForTesting,
   getWalletTransactions,
   getAllWallets,
};