require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pool = require("./database");

async function runBuildvestSchema() {
  try {
    const schemaPath = path.join(
      __dirname,
      "../../../database/buildvest_schema.sql"
    );

    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);

    console.log("BuildVest tables created successfully.");
  } catch (error) {
    console.error("BuildVest schema creation failed:", error);
  } finally {
    await pool.end();
  }
}

runBuildvestSchema();