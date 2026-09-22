const crypto = require("crypto");
const pool = require("../config/database");

async function createFundingRequest(req, res) {
  try {
    const userId = req.user.id;

    const {
      amount,
      payment_reference,
    } = req.body;

    const fundingAmount = Number(amount);

    if (
      !Number.isFinite(fundingAmount) ||
      fundingAmount <= 0 ||
      !payment_reference ||
      !payment_reference.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Amount and payment reference are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO buildvest_funding_requests
      (
        user_id,
        amount,
        payment_reference
      )
      VALUES
      ($1, $2, $3)
      RETURNING
        id,
        user_id,
        amount,
        payment_reference,
        status,
        created_at
      `,
      [
        userId,
        fundingAmount,
        payment_reference.trim(),
      ]
    );

    res.status(201).json({
      success: true,
      message: "Funding request submitted successfully",
      request: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({
        success: false,
        message: "This payment reference has already been submitted",
      });
    }

    console.error("Create funding request error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to submit funding request",
    });
  }
}

async function getAllFundingRequests(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        fr.id,
        fr.user_id,
        u.full_name,
        u.email,
        fr.amount,
        fr.payment_reference,
        fr.status,
        fr.admin_note,
        fr.created_at,
        fr.updated_at
      FROM buildvest_funding_requests fr
      INNER JOIN users u
        ON u.id = fr.user_id
      ORDER BY fr.created_at DESC
      `
    );

    res.json({
      success: true,
      requests: result.rows,
    });
  } catch (error) {
    console.error(
      "Get all funding requests error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve funding requests",
    });
  }
}

async function approveFundingRequest(req, res) {
  const client = await pool.connect();

  try {
    const requestId = req.params.id;

    await client.query("BEGIN");

    const requestResult = await client.query(
      `
      SELECT
        id,
        user_id,
        amount,
        payment_reference,
        status
      FROM buildvest_funding_requests
      WHERE id = $1
      FOR UPDATE
      `,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Funding request not found",
      });
    }

    const request = requestResult.rows[0];

    if (request.status !== "PENDING") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "Only pending funding requests can be approved",
      });
    }

    const walletResult = await client.query(
      `
      SELECT
        user_id,
        balance,
        status
      FROM buildvest_wallets
      WHERE user_id = $1
      FOR UPDATE
      `,
      [request.user_id]
    );

    if (walletResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "User wallet not found",
      });
    }

    const wallet = walletResult.rows[0];

    if (wallet.status !== "ACTIVE") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "User wallet is not active",
      });
    }

    const balanceBefore =
      Number(wallet.balance);

    const fundingAmount =
      Number(request.amount);

    const balanceAfter =
      balanceBefore + fundingAmount;

    await client.query(
      `
      UPDATE buildvest_wallets
      SET
        balance = $1,
        updated_at = NOW()
      WHERE user_id = $2
      `,
      [
        balanceAfter,
        request.user_id,
      ]
    );

    const ledgerReference =
      `BV-FUND-${crypto.randomUUID()}`;

    await client.query(
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
      ($1, $2, $3, $4, 'MANUAL_FUNDING', $5)
      `,
      [
        request.user_id,
        fundingAmount,
        balanceBefore,
        balanceAfter,
        ledgerReference,
      ]
    );

    const updatedRequest =
      await client.query(
        `
        UPDATE buildvest_funding_requests
        SET
          status = 'APPROVED',
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          user_id,
          amount,
          payment_reference,
          status,
          admin_note,
          created_at,
          updated_at
        `,
        [requestId]
      );

    await client.query("COMMIT");

    res.json({
      success: true,
      message:
        "Funding request approved and wallet funded successfully",
      request: updatedRequest.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Approve funding request error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to approve funding request",
    });
  } finally {
    client.release();
  }
}

async function rejectFundingRequest(req, res) {
  try {
    const requestId = req.params.id;

    const adminNote =
      req.body?.admin_note?.trim() || null;

    const result = await pool.query(
      `
      UPDATE buildvest_funding_requests
      SET
        status = 'REJECTED',
        admin_note = $1,
        updated_at = NOW()
      WHERE id = $2
        AND status = 'PENDING'
      RETURNING
        id,
        user_id,
        amount,
        payment_reference,
        status,
        admin_note,
        created_at,
        updated_at
      `,
      [
        adminNote,
        requestId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Pending funding request not found",
      });
    }

    res.json({
      success: true,
      message:
        "Funding request rejected successfully",
      request: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Reject funding request error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to reject funding request",
    });
  }
}

async function getMyFundingRequests(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        amount,
        payment_reference,
        status,
        admin_note,
        created_at,
        updated_at
      FROM buildvest_funding_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    res.json({
      success: true,
      requests: result.rows,
    });
  } catch (error) {
    console.error(
      "Get my funding requests error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve funding requests",
    });
  }
}

module.exports = {
  createFundingRequest,
  getMyFundingRequests,
  getAllFundingRequests,
  approveFundingRequest,
  rejectFundingRequest,
};
