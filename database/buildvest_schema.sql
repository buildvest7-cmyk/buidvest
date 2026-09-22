CREATE TABLE IF NOT EXISTS buildvest_user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    account_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS buildvest_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    property_type VARCHAR(100),
    total_value NUMERIC(14,2) NOT NULL,
    total_units INTEGER NOT NULL,
    available_units INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buildvest_investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    property_id UUID NOT NULL REFERENCES buildvest_properties(id),
    amount NUMERIC(14,2) NOT NULL,
    units INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buildvest_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES users(id),
    referred_user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'REGISTERED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (referrer_id, referred_user_id)
);

CREATE TABLE IF NOT EXISTS buildvest_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    investment_id UUID REFERENCES buildvest_investments(id),
    amount NUMERIC(14,2) NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    reference VARCHAR(150) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buildvest_investments_user
ON buildvest_investments(user_id);

CREATE INDEX IF NOT EXISTS idx_buildvest_investments_property
ON buildvest_investments(property_id);

CREATE INDEX IF NOT EXISTS idx_buildvest_referrals_referrer
ON buildvest_referrals(referrer_id);

CREATE INDEX IF NOT EXISTS idx_buildvest_transactions_user
ON buildvest_transactions(user_id);


CREATE TABLE IF NOT EXISTS buildvest_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id),
    recipient_id UUID NOT NULL REFERENCES users(id),
    amount NUMERIC(14,2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    reference VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buildvest_transfers_sender
ON buildvest_transfers(sender_id);

CREATE INDEX IF NOT EXISTS idx_buildvest_transfers_recipient
ON buildvest_transfers(recipient_id);


CREATE TABLE IF NOT EXISTS buildvest_wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id),
        balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT buildvest_wallets_balance_nonnegative CHECK (balance >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buildvest_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_user_id UUID NOT NULL REFERENCES users(id),
    transfer_id UUID REFERENCES buildvest_transfers(id),
    type VARCHAR(30) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    balance_before NUMERIC(14,2) NOT NULL,
    balance_after NUMERIC(14,2) NOT NULL,
    CONSTRAINT buildvest_wallet_transactions_amount_positive CHECK (amount > 0),
    CONSTRAINT buildvest_wallet_transactions_balance_before_nonnegative CHECK (balance_before >= 0),
    CONSTRAINT buildvest_wallet_transactions_balance_after_nonnegative CHECK (balance_after >= 0),
    reference VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buildvest_wallet_transactions_user
ON buildvest_wallet_transactions(wallet_user_id);

CREATE INDEX IF NOT EXISTS idx_buildvest_wallet_transactions_transfer
ON buildvest_wallet_transactions(transfer_id);

INSERT INTO buildvest_wallets (user_id)
SELECT user_id
FROM buildvest_user_profiles
ON CONFLICT (user_id) DO NOTHING;
