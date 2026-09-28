const API_BASE_URL = "/api";

function getToken() {
  return localStorage.getItem("buildvest_token");
}

function getAdminToken() {
  return localStorage.getItem("buildvest_admin_token");
}

async function adminApiRequest(
  endpoint,
  options = {}
) {
  const token =
    getAdminToken();

  const response =
    await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        headers: {
          "Content-Type":
            "application/json",
          ...(options.headers || {}),
          Authorization:
            `Bearer ${token}`,
        },
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
      "Admin request failed"
    );
  }

  return data;
}

async function loadAdminDashboard() {
  const data =
    await adminApiRequest("/admin/dashboard");

  const dashboard =
    data.dashboard;

  document.getElementById(
    "adminTotalUsers"
  ).textContent =
    dashboard.users.total_users;

  document.getElementById(
    "adminActiveProperties"
  ).textContent =
    dashboard.properties.active_properties;

  document.getElementById(
    "adminApprovedInvestments"
  ).textContent =
    dashboard.investments.approved_investments;

  document.getElementById(
    "adminPendingInvestments"
  ).textContent =
    dashboard.investments.pending_investments;

  document.getElementById(
    "adminInvestmentValue"
  ).textContent =
    formatKES(
      dashboard.investments
        .total_approved_investment_value
    );

  document.getElementById(
    "adminAllocatedUnits"
  ).textContent =
    dashboard.investments
      .allocated_investment_units;

  document.getElementById(
    "adminSuccessfulTransactions"
  ).textContent =
    dashboard.transactions
      .successful_transactions;

  document.getElementById(
    "adminSuccessfulPayments"
  ).textContent =
    formatKES(
      dashboard.transactions
        .total_successful_payments
    );

  document.getElementById(
    "adminQualifiedReferrals"
  ).textContent =
    dashboard.referrals.qualified_referrals;

    document.getElementById(
  "adminPendingFunding"
).textContent =
  dashboard.funding.pending_funding_requests;

  document.getElementById(
    "pendingInvestmentBadge"
  ).textContent =
    `${dashboard.investments.pending_investments} Pending`;
}

async function loadAdminPendingInvestments() {
  const container =
    document.getElementById(
      "adminPendingInvestmentsList"
    );

  if (!container) {
    return;
  }

  try {
    const data =
      await adminApiRequest(
        "/investments/admin/all"
      );

    const pendingInvestments =
      data.investments.filter(
        (investment) =>
          investment.status === "PENDING"
      );

    if (pendingInvestments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          No pending investment requests.
        </div>
      `;

      return;
    }

    container.innerHTML =
      pendingInvestments
        .slice(0, 10)
        .map((investment) => {
          return `
            <div class="transaction-item">

              <div class="transaction-main">

                <p class="transaction-title">
                  ${investment.property_title}
                </p>

                <div class="transaction-reference">
                  ${investment.investor_name}
                  · ${investment.investor_email}
                  · ${investment.units} units
                </div>

                <div class="transaction-reference">
                  ${investment.location}
                  · ${formatKES(investment.amount)}
                </div>

              </div>

              <div class="table-actions">

                <span class="badge badge-warning">
                  PENDING
                </span>

                <button
                  type="button"
                  class="btn btn-success btn-sm"
                  data-approve-investment="${investment.id}"
                >
                  Approve
                </button>

                <button
                  type="button"
                  class="btn btn-danger btn-sm"
                  data-reject-investment="${investment.id}"
                >
                  Reject
                </button>

              </div>

            </div>
          `;
        })
        .join("");

            container
      .querySelectorAll(
        "[data-approve-investment]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          async () => {
            const investmentId =
              button.dataset.approveInvestment;

            button.disabled = true;
            button.textContent = "Approving...";

            try {
              await adminApiRequest(
                `/investments/${investmentId}/approve`,
                {
                  method: "PATCH",
                }
              );

              await loadAdminDashboard();
              await loadAdminPendingInvestments();
            } catch (error) {
              alert(error.message);

              button.disabled = false;
              button.textContent = "Approve";
            }
          }
        );
      });

    container
      .querySelectorAll(
        "[data-reject-investment]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          async () => {
            const investmentId =
              button.dataset.rejectInvestment;

            button.disabled = true;
            button.textContent = "Rejecting...";

            try {
              await adminApiRequest(
                `/investments/${investmentId}/reject`,
                {
                  method: "PATCH",
                }
              );

              await loadAdminDashboard();
              await loadAdminPendingInvestments();
            } catch (error) {
              alert(error.message);

              button.disabled = false;
              button.textContent = "Reject";
            }
          }
        );
      });
  } catch (error) {
    container.innerHTML = `
      <div class="error-state">
        ${error.message}
      </div>
    `;
  }
}

function saveToken(token) {
  localStorage.setItem("buildvest_token", token);
}

function removeToken() {
  localStorage.removeItem("buildvest_token");
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Request failed"
    );
  }

  return data;
}

function requireAuthentication() {
  if (!getToken()) {
    window.location.href = "./index.html";
  }
}

function formatKES(amount) {
  return `KES ${Number(amount || 0).toLocaleString(
    "en-KE",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

async function loadWallet() {
  const data = await apiRequest(
    "/transfers/wallet"
  );

  const balance = formatKES(
    data.wallet.balance
  );

  const walletBalance =
    document.getElementById(
      "walletBalance"
    );

  const walletCardBalance =
    document.getElementById(
      "walletCardBalance"
    );

  if (walletBalance) {
    walletBalance.textContent = balance;
  }

  if (walletCardBalance) {
    walletCardBalance.textContent = balance;
  }
}

async function loadWalletTransactions() {
  const container =
    document.getElementById(
      "walletTransactions"
    );

  if (!container) {
    return;
  }

  try {
    const data = await apiRequest(
      "/transfers/wallet/transactions?limit=5"
    );

    if (
      !data.transactions ||
      data.transactions.length === 0
    ) {
      container.innerHTML = `
        <div class="empty-state">
          No wallet transactions yet.
        </div>
      `;

      return;
    }

    container.innerHTML =
      data.transactions
        .map((transaction) => {
          const isIncoming =
            transaction.type ===
              "TRANSFER_IN" ||
            transaction.type ===
              "TEST_FUNDING";

          const amountPrefix =
            isIncoming ? "+" : "-";

          return `
            <div class="transaction-item">
              <div class="transaction-main">
                <p class="transaction-title">
                  ${transaction.type.replaceAll(
                    "_",
                    " "
                  )}
                </p>

                <div class="transaction-reference">
                  ${transaction.reference}
                </div>
              </div>

              <div
                class="transaction-amount ${
                  isIncoming
                    ? "text-success"
                    : "text-danger"
                }"
              >
                ${amountPrefix}${formatKES(
                  transaction.amount
                )}
              </div>
            </div>
          `;
        })
        .join("");

          
  } catch (error) {
    container.innerHTML = `
      <div class="error-state">
        ${error.message}
      </div>
    `;
  }
}

async function loadDashboardSummary() {
  const data = await apiRequest("/dashboard");

  const investments =
    data.dashboard.investments;

  const referrals =
    data.dashboard.referrals;

  const totalInvested =
    document.getElementById("totalInvested");

  const propertyCount =
    document.getElementById("propertyCount");

  const totalReferrals =
    document.getElementById("totalReferrals");

  if (totalInvested) {
    totalInvested.textContent =
      formatKES(investments.total_invested);
  }

  if (propertyCount) {
    const portfolioData =
      await apiRequest("/portfolio/summary");

    propertyCount.textContent =
      portfolioData.summary.property_count;
  }

  if (totalReferrals) {
    totalReferrals.textContent =
      referrals.total_referrals;
  }
}

async function loadMyInvestments() {
  const container =
    document.getElementById("myInvestments");

  if (!container) {
    return;
  }

  try {
    const data =
      await apiRequest("/investments/my");

    const activeInvestments =
      data.investments.filter(
        (investment) =>
          investment.status === "APPROVED" ||
          investment.status === "PENDING"
      );

    if (activeInvestments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          You do not have any active investments yet.
        </div>
      `;

      return;
    }

    container.innerHTML =
      activeInvestments
        .slice(0, 5)
        .map((investment) => {
          const statusClass =
            investment.status === "APPROVED"
              ? "badge-success"
              : "badge-warning";

          return `
            <div class="transaction-item">

              <div class="transaction-main">

                <p class="transaction-title">
                  ${investment.property_title}
                </p>

                <div class="transaction-reference">
                  ${investment.location}
                  · ${investment.units} units
                </div>

              </div>

              <div>
                <div class="transaction-amount">
                  ${formatKES(investment.amount)}
                </div>

                <span class="badge ${statusClass}">
                  ${investment.status}
                </span>
              </div>

            </div>
          `;
        })
        .join("");
  } catch (error) {
    container.innerHTML = `
      <div class="error-state">
        ${error.message}
      </div>
    `;
  }
}

async function loadInvestmentOpportunities() {
  const container =
    document.getElementById(
      "investmentOpportunities"
    );

  if (!container) {
    return;
  }

  try {
    const data =
      await apiRequest("/properties");

    if (
      !data.properties ||
      data.properties.length === 0
    ) {
      container.innerHTML = `
        <div class="empty-state">
          No investment opportunities are currently available.
        </div>
      `;

      return;
    }

    container.innerHTML =
      data.properties
        .slice(0, 6)
        .map((property) => {
          return `
            <article class="property-card">

              <div
                class="property-image"
                aria-hidden="true"
              ></div>

              <div class="property-content">

                <h3 class="property-title">
                  ${property.title}
                </h3>

                <div class="property-location">
                  ${property.location}
                </div>

                <div class="property-meta">

                  <div class="property-meta-item">
                    <div class="property-meta-label">
                      Unit price
                    </div>

                    <div class="property-meta-value">
                      ${formatKES(property.unit_price)}
                    </div>
                  </div>

                  <div class="property-meta-item">
                    <div class="property-meta-label">
                      Available units
                    </div>

                    <div class="property-meta-value">
                      ${property.available_units}
                    </div>
                  </div>

                </div>

                <div class="flex justify-between items-center gap-3">

                  <span class="badge badge-success">
                    ${property.status}
                  </span>

                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    data-property-id="${property.id}"
                  >
                    View Opportunity
                  </button>

                </div>

              </div>

            </article>
          `;
        })
        .join("");

            container
      .querySelectorAll("[data-property-id]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const propertyId =
            button.dataset.propertyId;

          if (!propertyId) {
            return;
          }

          window.location.href =
            `./property.html?id=${encodeURIComponent(
              propertyId
            )}`;
        });
      });
  } catch (error) {
    container.innerHTML = `
      <div class="error-state">
        ${error.message}
      </div>
    `;
  }
}

async function loadPropertyDetails() {
  const container =
    document.getElementById("propertyDetails");

  if (!container) {
    return;
  }

  const params =
    new URLSearchParams(window.location.search);

  const propertyId =
    params.get("id");

  if (!propertyId) {
    container.innerHTML = `
      <div class="error-state">
        Property ID is missing.
      </div>
    `;
    return;
  }

  try {
    const data =
      await apiRequest(
        `/properties/${encodeURIComponent(propertyId)}`
      );

    const property = data.property;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <span class="badge badge-success">
            ${property.status}
          </span>

          <h1 class="page-title mt-3">
            ${property.title}
          </h1>

          <p class="page-subtitle">
            ${property.location}
          </p>
        </div>
      </div>

      <div class="grid grid-2">

        <div class="card">
          <div class="card-body">

            <h2 class="section-title">
              Property Overview
            </h2>

            <p class="text-secondary mt-4">
              ${property.description || "No description available."}
            </p>

            <div class="property-meta mt-6">

              <div class="property-meta-item">
                <div class="property-meta-label">
                  Property Type
                </div>

                <div class="property-meta-value">
                  ${property.property_type || "—"}
                </div>
              </div>

              <div class="property-meta-item">
                <div class="property-meta-label">
                  Unit Price
                </div>

                <div class="property-meta-value">
                  ${formatKES(property.unit_price)}
                </div>
              </div>

              <div class="property-meta-item">
                <div class="property-meta-label">
                  Total Units
                </div>

                <div class="property-meta-value">
                  ${property.total_units}
                </div>
              </div>

              <div class="property-meta-item">
                <div class="property-meta-label">
                  Available Units
                </div>

                <div class="property-meta-value">
                  ${property.available_units}
                </div>
              </div>

            </div>

          </div>
        </div>

        <div class="card">

          <div class="card-body">

            <h2 class="section-title">
              Investment Overview
            </h2>

            <div class="stat-card mt-4">

              <div class="stat-label">
                Total Property Value
              </div>

              <div class="stat-value">
                ${formatKES(property.total_value)}
              </div>

            </div>

            <div class="stat-card mt-4">

              <div class="stat-label">
                Allocation
              </div>

              <div class="stat-value">
                ${property.allocation_percentage}%
              </div>

            </div>

           <div class="form-group mt-5">
  <label for="investmentUnits">
    Number of units
  </label>

  <input
    id="investmentUnits"
    type="number"
    min="1"
    max="${property.available_units}"
    value="1"
  >

  <div class="form-help">
    ${property.available_units} units available
    at ${formatKES(property.unit_price)} per unit.
  </div>
</div>

<div class="stat-card mt-4">
  <div class="stat-label">
    Estimated Investment
  </div>

  <div
    id="investmentAmount"
    class="stat-value"
  >
    ${formatKES(property.unit_price)}
  </div>
</div>

<button
  type="button"
  class="btn btn-primary btn-lg btn-block mt-5"
  id="investButton"
  data-property-id="${property.id}"
  data-unit-price="${property.unit_price}"
>
  Request Investment
</button>

<div
  id="investmentMessage"
  class="message mt-4"
  aria-live="polite"
></div>

          </div>

        </div>

      </div>
    `;

        const unitsInput =
      document.getElementById("investmentUnits");

    const amountDisplay =
      document.getElementById("investmentAmount");

    if (unitsInput && amountDisplay) {
      unitsInput.addEventListener(
        "input",
        () => {
          const units =
            Number(unitsInput.value) || 0;

          const unitPrice =
            Number(property.unit_price) || 0;

          amountDisplay.textContent =
            formatKES(units * unitPrice);
        }
      );
    }

        const investButton =
      document.getElementById("investButton");

    const investmentMessage =
      document.getElementById("investmentMessage");

    if (investButton) {
      investButton.addEventListener(
        "click",
        async () => {
          const units =
            Number(unitsInput?.value) || 0;

          if (
            !Number.isInteger(units) ||
            units <= 0
          ) {
            investmentMessage.textContent =
              "Please enter a valid number of units.";

            investmentMessage.className =
              "message error";

            return;
          }

          if (
            units > Number(property.available_units)
          ) {
            investmentMessage.textContent =
              "The requested units are not available.";

            investmentMessage.className =
              "message error";

            return;
          }

          if (!getToken()) {
  window.location.href = "./login.html";
  return;
}

          investButton.disabled = true;
          investButton.textContent =
            "Submitting...";

          try {
            const data =
              await apiRequest(
                "/investments",
                {
                  method: "POST",
                  body: JSON.stringify({
                    property_id: property.id,
                    units,
                  }),
                }
              );

            investmentMessage.textContent =
              data.message ||
              "Investment request submitted successfully.";

            investmentMessage.className =
              "message success";

            investButton.textContent =
              "Request Submitted";

          } catch (error) {
            investmentMessage.textContent =
              error.message;

            investmentMessage.className =
              "message error";

            investButton.disabled = false;
            investButton.textContent =
              "Request Investment";
          }
        }
      );
    }
  } catch (error) {
    container.innerHTML = `
      <div class="error-state">
        ${error.message}
      </div>
    `;
  }
}

function setupLogout() {
  const logoutButton =
    document.getElementById(
      "logoutButton"
    );

  if (!logoutButton) {
    return;
  }

  logoutButton.addEventListener(
    "click",
    () => {
      removeToken();
      window.location.href =
        "./index.html";
    }
  );
}

function setupMobileSidebar() {
  const button =
    document.getElementById(
      "mobileMenuButton"
    );

  const sidebar =
    document.getElementById("sidebar");

  if (!button || !sidebar) {
    return;
  }

  button.addEventListener(
    "click",
    () => {
      sidebar.classList.toggle("open");
    }
  );
}

async function initializeDashboard() {
  requireAuthentication();

  setupLogout();
  setupMobileSidebar();

  try {
    const userData =
      await apiRequest("/auth/protected");

    const welcomeMessage =
      document.getElementById(
        "welcomeMessage"
      );

    if (
      welcomeMessage &&
      userData.user?.full_name
    ) {
      welcomeMessage.textContent =
        `Welcome back, ${userData.user.full_name}.`;
    }

    await loadWallet();
    await loadWalletTransactions();
    await loadDashboardSummary();
    await loadMyInvestments();
    await loadInvestmentOpportunities();

  } catch (error) {
    console.error(
      "Dashboard initialization error:",
      error
    );
  }
}

const loginForm =
  document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const email =
        document
          .getElementById("email")
          .value.trim();

      const password =
        document
          .getElementById("password")
          .value;

      const message =
        document.getElementById(
          "loginMessage"
        );

      message.textContent =
        "Signing in...";

      message.className =
        "message";

      try {
        const data =
          await apiRequest(
            "/auth/login",
            {
              method: "POST",
              body: JSON.stringify({
                email,
                password,
              }),
            }
          );

        saveToken(data.token);

        localStorage.setItem(
  "buildvest_user",
  JSON.stringify(data.user)
);

        message.textContent =
          "Login successful.";

        message.className =
          "message success";

        window.location.href =
          "./dashboard.html";
      } catch (error) {
        message.textContent =
          error.message;

        message.className =
          "message error";
      }
    }
  );
}

const registerForm =
  document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const full_name =
        document
          .getElementById("fullName")
          .value.trim();

      const email =
        document
          .getElementById("registerEmail")
          .value.trim();

      const phone =
        document
          .getElementById("registerPhone")
          .value.trim();

      const password =
        document
          .getElementById("registerPassword")
          .value;

      const message =
        document.getElementById(
          "registerMessage"
        );

      message.textContent =
        "Creating your account...";

      message.className =
        "message";

      try {
        const data =
          await apiRequest(
            "/auth/register",
            {
              method: "POST",
              body: JSON.stringify({
                full_name,
                email,
                phone,
                password,
              }),
            }
          );

        saveToken(data.token);

        message.textContent =
          "Account created successfully.";

        message.className =
          "message success";

        window.location.href =
          "./dashboard.html";
      } catch (error) {
        message.textContent =
          error.message;

        message.className =
          "message error";
      }
    }
  );
}

if (
  document.querySelector(".dashboard-layout") &&
  !document.getElementById("propertiesContainer")
) {
  initializeDashboard();
}

if (
  document.getElementById(
    "propertyDetails"
  )
) {
  loadPropertyDetails();
}

const adminLoginForm =
  document.getElementById("adminLoginForm");

if (adminLoginForm) {
  adminLoginForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const email =
        document
          .getElementById("adminEmail")
          .value.trim();

      const password =
        document
          .getElementById("adminPassword")
          .value;

      const message =
        document.getElementById(
          "adminLoginMessage"
        );

      message.textContent =
        "Signing in...";

      message.className =
        "message";

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Login failed"
          );
        }

        if (data.user?.role !== "ADMIN") {
          throw new Error(
            "Administrator access is required"
          );
        }

        localStorage.setItem(
          "buildvest_admin_token",
          data.token
        );

        message.textContent =
          "Login successful.";

        message.className =
          "message success";

        window.location.href =
          "./admin.html";
      } catch (error) {
        message.textContent =
          error.message;

        message.className =
          "message error";
      }
    }
  );
}


if (
  document.getElementById(
    "adminTotalUsers"
  )
) {
  loadAdminDashboard().catch((error) => {
    console.error(
      "Admin dashboard error:",
      error
    );
  });

  loadAdminPendingInvestments().catch((error) => {
    console.error(
      "Admin pending investments error:",
      error
    );
  });
}

async function loadHomepageProperties() {

  const container =
    document.getElementById("homepageProperties");

  if (!container) {
    return;
  }

  try {

    const response =
      await fetch("/api/properties");

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "Failed to load investment opportunities"
      );
    }

    const properties =
      data.properties || [];

    if (properties.length === 0) {

      container.innerHTML = `
        <div class="empty-state">
          No investment opportunities are currently available.
        </div>
      `;

      return;
    }

    container.innerHTML =
      properties
        .slice(0, 3)
        .map(
          (property) => `
            <div class="site-feature-card">

              <span class="badge badge-success">
                ${property.status}
              </span>

              <h3>
                ${property.title}
              </h3>

              <p class="text-muted">
                ${property.location}
              </p>

              <p>
                ${
                  property.description ||
                  "Explore this BuildVest investment opportunity."
                }
              </p>

              <div class="property-meta mt-5">

                <div>
                  <span>
                    Unit Price
                  </span>

                  <strong>
                    KES ${Number(
                      property.unit_price
                    ).toLocaleString("en-KE")}
                  </strong>
                </div>

                <div>
                  <span>
                    Available Units
                  </span>

                  <strong>
                    ${property.available_units}
                  </strong>
                </div>

              </div>

              <a
                href="./property.html?id=${property.id}"
                class="btn btn-primary btn-block mt-5"
              >
                View Opportunity
              </a>

            </div>
          `
        )
        .join("");

  } catch (error) {

    console.error(
      "Homepage properties error:",
      error
    );

    container.innerHTML = `
      <div class="error-state">
        Investment opportunities could not be loaded.
      </div>
    `;

  }
}

if (
  document.getElementById(
    "homepageProperties"
  )
) {
  loadHomepageProperties();
}


async function loadPublicPropertiesPage() {
  const container =
    document.getElementById("propertiesContainer");

  if (!container) {
    return;
  }

  try {
    const response = await fetch("/api/properties");
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to load properties"
      );
    }

    if (!data.properties || data.properties.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          No investment properties are currently available.
        </div>
      `;
      return;
    }

    container.innerHTML = data.properties
      .map(
        (property) => `
          <div class="property-card">
            <div class="property-card-body">

              <span class="badge badge-success">
                ${property.status}
              </span>

              <h3 class="property-card-title">
                ${property.title}
              </h3>

              <p class="text-muted">
                ${property.location}
              </p>

              <p class="property-description">
                ${property.description || ""}
              </p>

              <div class="property-meta">
                <div>
                  <span>Unit Price</span>
                  <strong>
                    KES ${Number(property.unit_price).toLocaleString()}
                  </strong>
                </div>

                <div>
                  <span>Available Units</span>
                  <strong>
                    ${property.available_units}
                  </strong>
                </div>
              </div>

              <a
                href="./property.html?id=${property.id}"
                class="btn btn-primary btn-block"
              >
                View Opportunity
              </a>

            </div>
          </div>
        `
      )
      .join("");

  } catch (error) {
    console.error(
      "Public properties error:",
      error
    );

    container.innerHTML = `
      <div class="error-state">
        Investment properties could not be loaded.
      </div>
    `;
  }
}

if (
  document.getElementById("propertiesContainer")
) {
  loadPublicPropertiesPage();
}

